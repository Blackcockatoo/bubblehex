"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BubbleHexEngine, type Action } from "./engine";
import { installBubbleHexRuntimeUpgrades } from "./runtime-upgrades";
import "./background-motion.css";
import "./cabinet-polish.css";

const BACKGROUND_BY_LEVEL: Record<string, string> = {
  "The First Sip": "/backgrounds/hex-tunnel.svg",
  "Chain Letter": "/backgrounds/bubble-field.svg",
  "Blue Pressure": "/backgrounds/hex-reactor.svg",
  "Room 108": "/backgrounds/bubble-city.svg",
  "Mirror Teeth": "/backgrounds/hex-storm.svg",
  "Last Lift": "/backgrounds/hex-reactor.svg",
  "Poison Moon": "/backgrounds/bubble-moon.svg",
  "Black Roses": "/backgrounds/hex-storm.svg",
  "Serpent Glass": "/backgrounds/hex-tunnel.svg",
  "Thirteen Candles": "/backgrounds/hex-reactor.svg",
  "Event Horizon": "/backgrounds/hex-tunnel.svg",
  "The Widow Unveiled": "/backgrounds/hex-reactor.svg",
  "The Dirty Gold Vault": "/backgrounds/bubble-city.svg",
};

const PLAY_STATES = new Set([
  "attract",
  "stageIntro",
  "playing",
  "hurry",
  "dying",
  "stageClear",
  "paused",
]);
const MENU_BACKGROUND = "/backgrounds/bubble-city.svg";

function backgroundFor(gameState: string, levelName: string) {
  if (!PLAY_STATES.has(gameState)) return MENU_BACKGROUND;
  return BACKGROUND_BY_LEVEL[levelName] ?? "/backgrounds/hex-tunnel.svg";
}

function stateLabel(gameState: string) {
  return gameState.replace(/([a-z])([A-Z])/g, "$1 $2").toUpperCase();
}

type Snapshot = {
  gameState: string;
  levelName: string;
  campaignMode: string;
  muted: boolean;
};

const INITIAL_SNAPSHOT: Snapshot = {
  gameState: "boot",
  levelName: "THE VEIL",
  campaignMode: "chronicle",
  muted: false,
};

type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};
type OrientationLock = ScreenOrientation & {
  lock?: (orientation: "landscape") => Promise<void>;
  unlock?: () => void;
};

export default function BubbleHex() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const shellRef = useRef<HTMLElement>(null);
  const engineRef = useRef<BubbleHexEngine | null>(null);
  /** Which action each live pointer is holding, so releases never get lost. */
  const pointerActions = useRef(new Map<number, Action>());
  const [running, setRunning] = useState(false);
  const [backgroundSrc, setBackgroundSrc] = useState(MENU_BACKGROUND);
  const [snapshot, setSnapshot] = useState<Snapshot>(INITIAL_SNAPSHOT);
  const [portraitTouch, setPortraitTouch] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [surface, setSurface] = useState({ vw: 0, vh: 0 });

  const press = useCallback((action: Action) => engineRef.current?.press(action), []);
  const release = useCallback((action: Action) => engineRef.current?.release(action), []);

  useEffect(() => {
    if (!canvasRef.current) return;
    installBubbleHexRuntimeUpgrades(BubbleHexEngine);
    const engine = new BubbleHexEngine(canvasRef.current, () => setRunning(true));
    engineRef.current = engine;
    engine.start();

    const stopScroll = (event: KeyboardEvent) => {
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " ", "Tab"].includes(event.key)) {
        event.preventDefault();
      }
    };
    const syncFromCanvas = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const next: Snapshot = {
        gameState: canvas.dataset.gameState ?? "boot",
        levelName: canvas.dataset.levelName || "THE VEIL",
        campaignMode: canvas.dataset.campaignMode ?? "chronicle",
        muted: canvas.dataset.muted === "true",
      };
      setSnapshot((current) =>
        current.gameState === next.gameState &&
        current.levelName === next.levelName &&
        current.campaignMode === next.campaignMode &&
        current.muted === next.muted
          ? current
          : next
      );
      const nextBackground = backgroundFor(next.gameState, next.levelName);
      setBackgroundSrc((current) => (current === nextBackground ? current : nextBackground));
    };

    window.addEventListener("keydown", stopScroll, { passive: false });
    const backgroundTimer = window.setInterval(syncFromCanvas, 200);
    syncFromCanvas();

    return () => {
      window.clearInterval(backgroundTimer);
      window.removeEventListener("keydown", stopScroll);
      engine.destroy();
    };
  }, []);

  // A pointer that lifts outside the button it started on still has to release
  // the action, otherwise the hero keeps running after the thumb is gone.
  useEffect(() => {
    const endPointer = (event: PointerEvent) => {
      const action = pointerActions.current.get(event.pointerId);
      if (!action) return;
      pointerActions.current.delete(event.pointerId);
      release(action);
    };
    window.addEventListener("pointerup", endPointer);
    window.addEventListener("pointercancel", endPointer);
    const blur = () => {
      for (const action of pointerActions.current.values()) release(action);
      pointerActions.current.clear();
    };
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("pointerup", endPointer);
      window.removeEventListener("pointercancel", endPointer);
      window.removeEventListener("blur", blur);
    };
  }, [release]);

  // Phones get the horizontal cabinet no matter how they are being held: try a
  // real orientation lock in fullscreen, and rotate the surface ourselves when
  // the browser refuses (every iOS browser does).
  useEffect(() => {
    const coarse = window.matchMedia("(pointer: coarse)");
    const portrait = window.matchMedia("(orientation: portrait)");
    const evaluate = () => {
      // Tall desktop windows are portrait too, but they are not phones — only
      // rotate when the short edge is genuinely handset-sized.
      const rotate =
        coarse.matches && portrait.matches && Math.min(window.innerWidth, window.innerHeight) < 820;
      setPortraitTouch(rotate);
      // The rotated cabinet lives in a box with the viewport's axes swapped, so
      // the whole sizing model reads these numbers rather than the raw viewport.
      const vw = rotate ? window.innerHeight : window.innerWidth;
      const vh = rotate ? window.innerWidth : window.innerHeight;
      setSurface((current) => (current.vw === vw && current.vh === vh ? current : { vw, vh }));
    };
    evaluate();
    coarse.addEventListener("change", evaluate);
    portrait.addEventListener("change", evaluate);
    window.addEventListener("resize", evaluate);
    const syncFullscreen = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", syncFullscreen);
    return () => {
      coarse.removeEventListener("change", evaluate);
      portrait.removeEventListener("change", evaluate);
      window.removeEventListener("resize", evaluate);
      document.removeEventListener("fullscreenchange", syncFullscreen);
    };
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const shell = shellRef.current as FullscreenElement | null;
    if (!shell) return;
    try {
      if (document.fullscreenElement) {
        (screen.orientation as OrientationLock | undefined)?.unlock?.();
        await document.exitFullscreen();
        return;
      }
      if (shell.requestFullscreen) await shell.requestFullscreen({ navigationUI: "hide" });
      else shell.webkitRequestFullscreen?.();
      await (screen.orientation as OrientationLock | undefined)?.lock?.("landscape");
    } catch {
      // Orientation locks are rejected on desktop and on iOS; the CSS rotation
      // fallback already keeps the game horizontal, so this is not an error.
    }
  }, []);

  const hold = useCallback(
    (action: Action) => ({
      onPointerDown: (event: React.PointerEvent<HTMLButtonElement>) => {
        event.preventDefault();
        pointerActions.current.set(event.pointerId, action);
        press(action);
      },
      onPointerEnter: (event: React.PointerEvent<HTMLButtonElement>) => {
        // Sliding a thumb from one pad to the next should hand over cleanly.
        if (event.buttons === 0 && event.pointerType === "mouse") return;
        if (!event.isPrimary && event.pointerType !== "touch") return;
        if (event.buttons === 0) return;
        pointerActions.current.set(event.pointerId, action);
        press(action);
      },
      onPointerLeave: (event: React.PointerEvent<HTMLButtonElement>) => {
        if (pointerActions.current.get(event.pointerId) !== action) return;
        pointerActions.current.delete(event.pointerId);
        release(action);
      },
      onContextMenu: (event: React.MouseEvent) => event.preventDefault(),
    }),
    [press, release]
  );

  // Menu buttons are momentary: press and let go in the same gesture so the
  // engine never sees a key that is held down forever.
  const tap = useCallback(
    (action: Action) => ({
      onPointerDown: (event: React.PointerEvent<HTMLButtonElement>) => {
        event.preventDefault();
        press(action);
        window.setTimeout(() => release(action), 90);
      },
      onContextMenu: (event: React.MouseEvent) => event.preventDefault(),
    }),
    [press, release]
  );

  const { gameState, levelName, campaignMode, muted } = snapshot;
  const inPlay = PLAY_STATES.has(gameState);
  const motionMode = inPlay ? "is-playing" : "is-menu";
  const original = campaignMode === "original";
  // A successful orientation lock flips the media query back to landscape, so
  // the manual rotation drops away on its own when the browser cooperates.
  const shellClass = useMemo(
    () => ["arcade-page", portraitTouch ? "is-rotated" : ""].filter(Boolean).join(" "),
    [portraitTouch]
  );
  // Short surfaces put the controls beside the screen; roomy ones stack them.
  const layout = surface.vh > 0 && surface.vh < 640 ? "split" : "wide";
  const surfaceVars = useMemo(
    () =>
      surface.vw > 0
        ? ({ "--vw": `${surface.vw}px`, "--vh": `${surface.vh}px` } as React.CSSProperties)
        : undefined,
    [surface]
  );

  return (
    <main
      ref={shellRef}
      className={shellClass}
      style={surfaceVars}
      data-layout={layout}
      data-game-state={gameState}
      data-mode={campaignMode}
    >
      <div className="rotor">
        {/* The cabinet is already horizontal; this just nudges the player to
            turn the handset. It fades itself out via CSS after a few seconds. */}
        {portraitTouch ? (
          <p className="rotate-hint" role="status">
            BUBBLE HEX PLAYS HORIZONTAL — TURN YOUR PHONE
          </p>
        ) : null}
        <header className="top-rail">
          <div className="studio-mark">
            <span>B$S</span> <b>BLUE $NAKE STUDIO</b>
          </div>
          <div className="rail-tools">
            <span className="machine-status">
              <i /> SIGNAL <strong>108</strong>
            </span>
            <button type="button" className="rail-button" onClick={toggleFullscreen}>
              {fullscreen ? "EXIT FULL" : "FULL SCREEN"}
            </button>
          </div>
        </header>

        <section className="cabinet" aria-label="Bubble Hex arcade cabinet">
          <div className="cabinet-crown" aria-hidden="true">
            <span>✦</span>
            <b>BUBBLE HEX</b>
            <span>✦</span>
          </div>

          <div className="hex-data-rail" aria-label="Live cabinet status">
            <span>
              <small>CHAMBER</small>
              <b>{levelName}</b>
            </span>
            <span>
              <small>RITUAL STATE</small>
              <b>{stateLabel(gameState)}</b>
            </span>
            <span>
              <small>MODE</small>
              <b className={original ? "is-original" : undefined}>
                {original ? "ORIGINAL HEX" : "CHRONICLE"}
              </b>
            </span>
          </div>

          <div className="play-layout">
            <div className="screen-bezel">
              <div className="screen-wrap">
                <canvas
                  ref={canvasRef}
                  width={960}
                  height={720}
                  aria-label="Playable Bubble Hex game"
                  tabIndex={0}
                />
                <img
                  key={backgroundSrc}
                  className={`game-background-motion ${motionMode}`}
                  src={backgroundSrc}
                  alt=""
                  aria-hidden="true"
                />
                <div className="game-background-vignette" aria-hidden="true" />
                <div className="scanlines" aria-hidden="true" />
              </div>
            </div>

            <div className="control-deck">
              <div className="dpad" aria-label="Movement controls">
                <button type="button" aria-label="Move left" {...hold("left")}>
                  <span aria-hidden="true">◀</span>
                </button>
                <button type="button" aria-label="Move right" {...hold("right")}>
                  <span aria-hidden="true">▶</span>
                </button>
              </div>

              <div className="mini-controls" data-context={inPlay ? "play" : "menu"}>
                <button type="button" className="is-primary" {...tap("start")}>
                  START
                </button>
                {inPlay ? (
                  <button type="button" {...tap("pause")}>
                    PAUSE
                  </button>
                ) : (
                  <>
                    <button type="button" {...tap("map")}>
                      CHAMBER MAP
                    </button>
                    <button
                      type="button"
                      className={original ? "is-danger" : undefined}
                      onPointerDown={(event) => {
                        event.preventDefault();
                        engineRef.current?.toggleCampaignMode();
                      }}
                    >
                      {original ? "ORIGINAL HEX" : "CHRONICLE"}
                    </button>
                    <button type="button" {...tap("consciousness")}>
                      ENEMY LEVEL
                    </button>
                  </>
                )}
                <button
                  type="button"
                  aria-pressed={muted}
                  onPointerDown={(event) => {
                    event.preventDefault();
                    engineRef.current?.setMuted(!muted);
                  }}
                >
                  {muted ? "SOUND OFF" : "SOUND ON"}
                </button>
              </div>

              <div className="action-controls" aria-label="Action controls">
                <button className="bubble" type="button" aria-label="Blow bubble" {...hold("bubble")}>
                  <span aria-hidden="true">○</span>
                  <small>BUBBLE</small>
                </button>
                <button className="jump" type="button" aria-label="Jump" {...hold("jump")}>
                  <span aria-hidden="true">↑</span>
                  <small>JUMP</small>
                </button>
              </div>
            </div>
          </div>
        </section>

        <footer className="machine-footer">
          <p>{running ? "CABINET ONLINE" : "WARMING TUBES"} · ONE PLAYER</p>
          <p className="desktop-hint">
            A/D OR ←/→ MOVE · SPACE/C JUMP · X/Z BUBBLE · ENTER START · P PAUSE · M CHAMBER MAP
          </p>
          <p className="mobile-hint">MULTI-TOUCH READY · FULL SCREEN LOCKS LANDSCAPE</p>
        </footer>
      </div>
    </main>
  );
}
