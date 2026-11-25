/**
 * Manifest-driven loader for the Forbidden Expansion asset pack copied to
 * public/game/expansion/. Categories with a sprite atlas load one sheet plus
 * its frame JSON; others load individual PNGs listed in manifest.json.
 * Every draw call reports failure so callers can fall back to procedural art.
 */
export type ExpansionManifestAsset = {
  id: string; label: string; category: string; svg: string; png: string;
  logical_size: [number, number]; raster_size: [number, number];
};
export type ExpansionManifest = {
  pack: string; version: string;
  assets: ExpansionManifestAsset[];
  animations: Record<string, { frames: string[]; frame_ms: number; loop: boolean }>;
};
type AtlasFrames = { frames: Record<string, { frame: { x: number; y: number; w: number; h: number } }> };
type Sprite = { image: HTMLImageElement; x: number; y: number; w: number; h: number };

export const EXPANSION_BASE = "/game/expansion/";
/** Categories needed by M1: item pickups (atlas), pop frames (atlas), rarity badges (individual). */
export const M1_ATLAS_CATEGORIES = ["items", "effects"] as const;
export const M1_INDIVIDUAL_IDS = [
  "badge_common", "badge_uncommon", "badge_rare", "badge_legendary", "badge_cursed",
  // M2 interface: meter frames and themed panels.
  "meter_combo", "meter_time", "meter_boss", "panel_old_vic", "panel_signal", "panel_velvet",
] as const;

export type ExpansionLoadState = "idle" | "loading" | "ready" | "degraded";

export class ExpansionAssets {
  state: ExpansionLoadState = "idle";
  manifest: ExpansionManifest | null = null;
  private sprites = new Map<string, Sprite>();

  constructor(private base = EXPANSION_BASE) {}

  async preload(): Promise<ExpansionLoadState> {
    if (this.state !== "idle") return this.state;
    this.state = "loading";
    try {
      if (typeof fetch !== "function" || typeof Image === "undefined") throw new Error("no loader");
      const manifest = await fetchJson<ExpansionManifest>(this.base + "manifest.json");
      this.manifest = manifest;
      const byId = new Map(manifest.assets.map(asset => [asset.id, asset]));
      const results = await Promise.all([
        ...M1_ATLAS_CATEGORIES.map(category => this.loadAtlas(category, byId)),
        ...M1_INDIVIDUAL_IDS.map(id => { const asset = byId.get(id); return asset ? this.loadSingle(asset) : Promise.resolve(false); }),
      ]);
      this.state = results.every(Boolean) ? "ready" : "degraded";
    } catch {
      this.state = "degraded";
    }
    return this.state;
  }

  has(id: string): boolean { return this.sprites.has(id); }
  get count(): number { return this.sprites.size; }

  /** Draw a sprite centred at (cx,cy) into a w×h box. Returns false when unavailable. */
  draw(ctx: CanvasRenderingContext2D, id: string, cx: number, cy: number, w: number, h = w): boolean {
    const sprite = this.sprites.get(id);
    if (!sprite) return false;
    const previous = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(sprite.image, sprite.x, sprite.y, sprite.w, sprite.h, cx - w / 2, cy - h / 2, w, h);
    ctx.imageSmoothingEnabled = previous;
    return true;
  }

  private async loadAtlas(category: string, byId: Map<string, ExpansionManifestAsset>): Promise<boolean> {
    try {
      const [frames, image] = await Promise.all([
        fetchJson<AtlasFrames>(`${this.base}atlases/${category}.json`),
        loadImage(`${this.base}atlases/${category}.png`),
      ]);
      if (!image) return false;
      let ok = true;
      for (const [id, entry] of Object.entries(frames.frames)) {
        const asset = byId.get(id);
        if (!asset || asset.category !== category) { ok = false; continue; }
        const { x, y, w, h } = entry.frame;
        if (w !== asset.raster_size[0] || h !== asset.raster_size[1] || x + w > image.naturalWidth || y + h > image.naturalHeight) { ok = false; continue; }
        this.sprites.set(id, { image, x, y, w, h });
      }
      return ok;
    } catch {
      return false;
    }
  }

  private async loadSingle(asset: ExpansionManifestAsset): Promise<boolean> {
    const image = await loadImage(this.base + asset.png);
    if (!image || image.naturalWidth !== asset.raster_size[0] || image.naturalHeight !== asset.raster_size[1]) return false;
    this.sprites.set(asset.id, { image, x: 0, y: 0, w: image.naturalWidth, h: image.naturalHeight });
    return true;
  }
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  return await response.json() as T;
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise(resolve => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });
}
