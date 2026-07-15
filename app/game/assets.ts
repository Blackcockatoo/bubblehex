import { ART_MANIFEST, type ArtAsset, type ArtManifest } from "./content";

export type AssetLoadState = "idle" | "loading" | "ready" | "degraded";

export class GameArtAssets {
  private images = new Map<string, HTMLImageElement>();
  state: AssetLoadState = "idle";
  progress = 0;

  constructor(private manifest: ArtManifest = ART_MANIFEST) {}

  async preload(): Promise<AssetLoadState> {
    if (this.state === "ready" || this.state === "degraded") return this.state;
    this.state = "loading";
    const assets = Object.values(this.manifest);
    let loaded = 0;
    let failed = 0;
    await Promise.all(assets.map(asset => this.load(asset).then(ok => {
      loaded++;
      if (!ok) failed++;
      this.progress = loaded / assets.length;
    })));
    this.state = failed ? "degraded" : "ready";
    return this.state;
  }

  get(id: string): HTMLImageElement | undefined {
    return this.images.get(id);
  }

  draw(ctx: CanvasRenderingContext2D, id: string, sx: number, sy: number, sw: number, sh: number, dx: number, dy: number, dw: number, dh: number): boolean {
    const image = this.images.get(id);
    if (!image) return false;
    const previous = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = this.manifest[id]?.smoothing ?? true;
    ctx.drawImage(image, sx, sy, sw, sh, dx, dy, dw, dh);
    ctx.imageSmoothingEnabled = previous;
    return true;
  }

  private load(asset: ArtAsset): Promise<boolean> {
    return new Promise(resolve => {
      const image = new Image();
      image.decoding = "async";
      image.onload = () => {
        if (image.naturalWidth !== asset.width || image.naturalHeight !== asset.height) {
          resolve(false);
          return;
        }
        this.images.set(asset.id, image);
        resolve(true);
      };
      image.onerror = () => resolve(false);
      image.src = asset.src;
    });
  }
}

