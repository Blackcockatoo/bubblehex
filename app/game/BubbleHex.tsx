"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BubbleHexEngine, type Action } from "./engine";
import { LEVEL_CUES } from "./level-cues";
import { installBubbleHexRuntimeUpgrades } from "./runtime-upgrades";
import "./background-motion.css";
import "./cabinet-polish.css";
import "./comfort-polish.css";


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

export default function BubbleHex() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<BubbleHexEngine | null>(null);
  const [muted, setMuted] = useState(false);
  const [running, setRunning] = useState(false);
  const [backgroundSrc, setBackgroundSrc] = useState(MENU_BACKGROUND);
  const [gameState, setGameState] = useState("boot");
  const [levelName, setLevelName] = useState("THE VEIL");
  const [score, setScore] = useState("0");
  const [volumes, setVolumes] = useState({music:"5",sfx:"6"});
  const [combo, setCombo] = useState("");
  const [reducedMotion, setReducedMotion] = useState(false);
  const pointers = useRef(new Map<number, {action: Action; button: HTMLButtonElement}>());
  const pointerClicks = useRef(new WeakMap<HTMLButtonElement, number>());
  const clearPointers = useCallback(() => {
    for (const [id, {action, button}] of pointers.current) {
      engineRef.current?.release(action, `pointer:${id}`);
      delete button.dataset.held;
    }
    pointers.current.clear();
  }, []);

  useEffect(() => {
    if (!canvasRef.current) return;
    installBubbleHexRuntimeUpgrades(BubbleHexEngine);
    const engine = new BubbleHexEngine(canvasRef.current, () => setRunning(true));
    engineRef.current = engine;
    engine.start();

    const stopScroll = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLButtonElement) return;
      if (["ArrowLeft", "ArrowRight", "ArrowUp", " "].includes(event.key)) {
        event.preventDefault();
      }
    };
    let previousState = "";
    const syncBackground = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const nextState = canvas.dataset.gameState ?? "boot";
      const nextLevelName = canvas.dataset.levelName || "THE VEIL";
      const nextBackground = backgroundFor(nextState, nextLevelName);
      setMuted(canvas.dataset.muted === "true");
      const music = canvas.dataset.musicVolume ?? "5", sfx = canvas.dataset.sfxVolume ?? "6";
      setVolumes(current => current.music === music && current.sfx === sfx ? current : {music,sfx});
      setScore(canvas.dataset.score ?? "0");
      setCombo(canvas.dataset.combo ?? "");
      setReducedMotion(canvas.dataset.reducedMotion === "true");
      if (nextState !== previousState && !["playing", "hurry", "attract"].includes(nextState)) clearPointers();
      previousState = nextState;
      setGameState((current) => (current === nextState ? current : nextState));
      setLevelName((current) =>
        current === nextLevelName ? current : nextLevelName
      );
      setBackgroundSrc((current) =>
        current === nextBackground ? current : nextBackground
      );
    };

    window.addEventListener("keydown", stopScroll, { passive: false });
    window.addEventListener("blur", clearPointers);
    const clearHiddenPointers = () => { if (document.hidden) clearPointers(); };
    document.addEventListener("visibilitychange", clearHiddenPointers);
    const backgroundTimer = window.setInterval(syncBackground, 250);
    syncBackground();

    return () => {
      window.clearInterval(backgroundTimer);
      window.removeEventListener("keydown", stopScroll);
      window.removeEventListener("blur", clearPointers);
      document.removeEventListener("visibilitychange", clearHiddenPointers);
      clearPointers();
      engineRef.current = null;
      engine.destroy();
    };
  }, [clearPointers]);

  const press = useCallback(
    (action: Action) => engineRef.current?.press(action),
    []
  );
  const endPointer = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    const held = pointers.current.get(event.pointerId);
    if (!held) return;
    pointers.current.delete(event.pointerId);
    engineRef.current?.release(held.action, `pointer:${event.pointerId}`);
    if (![...pointers.current.values()].some(p => p.button === held.button)) delete held.button.dataset.held;
  }, []);
  const startPointer = useCallback((action: Action, event: React.PointerEvent<HTMLButtonElement>) => {
      if (event.button !== 0) return;
      event.preventDefault();
      pointerClicks.current.set(event.currentTarget, event.timeStamp);
      canvasRef.current?.focus({preventScroll:true});
      // Capture is best-effort on browsers that cancel a pointer during focus.
      try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* release via normal pointer events */ }
      pointers.current.set(event.pointerId, {action, button: event.currentTarget});
      event.currentTarget.dataset.held = "true";
      engineRef.current?.press(action, `pointer:${event.pointerId}`);
  }, []);
  const activateButton = useCallback((action: Action, event: React.MouseEvent<HTMLButtonElement>) => {
    // Handle click-only/assistive activation too, without firing a second time
    // after the normal pointer-down action.
    const pointerTime = pointerClicks.current.get(event.currentTarget);
    pointerClicks.current.delete(event.currentTarget);
    const nativePointer = "pointerType" in event.nativeEvent && !!event.nativeEvent.pointerType;
    if (event.detail !== 0 && pointerTime !== undefined && (nativePointer || event.timeStamp - pointerTime < 500)) return;
    engineRef.current?.press(action, "button");
    engineRef.current?.release(action, "button");
  }, []);
  const bind = (action: Action) => ({
    onPointerDown: (event: React.PointerEvent<HTMLButtonElement>) => startPointer(action, event),
    onPointerUp: endPointer,
    onPointerCancel: endPointer,
    onLostPointerCapture: endPointer,
    onPointerLeave: (event: React.PointerEvent<HTMLButtonElement>) => {
      if (!event.currentTarget.hasPointerCapture(event.pointerId)) endPointer(event);
    },
    // Native keyboard and assistive activation produces a click with detail=0.
    onClick: (event: React.MouseEvent<HTMLButtonElement>) => activateButton(action, event),
  });
  const tap = (action: Action) => {canvasRef.current?.focus({preventScroll:true});press(action);engineRef.current?.release(action);};
  const activePlay = gameState === "playing" || gameState === "hurry" || gameState === "attract";
  const instruction = gameState === "characterSelect" ? "Choose a hero · Bubble changes look · Jump confirms"
    : gameState === "paused" ? "Paused · Resume with Pause · Start restarts this chamber"
    : gameState === "stageClear" ? "Chamber cleared · Next starts automatically · Start to continue"
    : gameState === "stageIntro" ? (LEVEL_CUES[levelName] || "Trap enemies, then touch their bubbles to pop · Jump to begin")
    : activePlay ? "Hold Bubble to fire · Touch trapped bubbles to pop · Jump twice to climb"
    : gameState === "gameOver" || gameState === "victory" ? "Press Start to play again"
    : gameState === "records/options" ? "Arrows browse the archive · Start returns to the title"
    : "Press Start · Choose your hex";

  const motionMode = PLAY_STATES.has(gameState) ? "is-playing" : "is-menu";
  const cabinetSignal = running ? "ONLINE" : "WARMING";

  return (
    <main className="arcade-page" data-game-state={gameState} data-reduced-motion={reducedMotion}>
      <header className="top-rail">
        <div className="studio-mark">
          <span>B$S</span> BLUE $NAKE STUDIO
        </div>
        <div className="machine-status">
          <i /> ORIGINAL ARCADE SIGNAL <strong>108</strong>
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
            <small>CABINET SIGNAL</small>
            <b>{cabinetSignal} · 108</b>
          </span>
        </div>

        <div className="play-readout">
          <strong aria-label={`Score ${score}`}>SCORE {Number(score).toLocaleString("en-AU")}</strong>
          <span className="combo-readout" aria-live="polite" aria-atomic="true">{combo || instruction}</span>
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
              {gameState === "paused" && <div className="pause-summary" role="note" aria-label="Pause controls">
                <strong>PAUSED</strong>
                <span>Pause to resume · Start to restart</span>
                <span>← / → Music {volumes.music}/10</span>
                <span>Hold Jump + ← / → SFX {volumes.sfx}/10</span>
                <span>Bubble: sound {muted ? "off" : "on"}</span>
                <span>Tap Jump: reduced motion {reducedMotion ? "on" : "off"}</span>
              </div>}
            </div>
          </div>

          <div className="control-deck">
            <div className="dpad" aria-label="Movement controls">
              <button type="button" aria-label="Move left" {...bind("left")}>
                <span aria-hidden="true">◀</span>
              </button>
              <button type="button" aria-label="Move right" {...bind("right")}>
                <span aria-hidden="true">▶</span>
              </button>
            </div>

            <div className="mini-controls">
              <button type="button" disabled={["boot", "playing", "hurry", "dying"].includes(gameState)} onClick={() => tap("start")}>
                {gameState === "paused" ? "RESTART" : gameState === "stageClear" ? "NEXT" : "START"}
              </button>
              <button type="button" disabled={!(["title", "characterSelect"].includes(gameState))} onClick={() => tap("consciousness")}>
                ENEMY LEVEL
              </button>
              <button type="button" disabled={!["title", "characterSelect", "records/options", "playing", "hurry", "paused"].includes(gameState)} aria-pressed={gameState === "paused"} onClick={() => tap("pause")}>
                {gameState === "paused" ? "RESUME" : activePlay ? "PAUSE" : "ARCHIVE"}
              </button>
              <button
                type="button"
                aria-pressed={muted}
                onClick={() => {
                  const next = !muted;
                  setMuted(next);
                  engineRef.current?.setMuted(next);
                }}
              >
                {muted ? "SOUND OFF" : "SOUND ON"}
              </button>
            </div>

            <div className="action-controls" aria-label="Action controls">
              <button
                className="bubble"
                type="button"
                aria-label="Blow bubble"
                {...bind("bubble")}
              >
                <span aria-hidden="true">○</span>
                <small>BUBBLE</small>
              </button>
              <button
                className="jump"
                type="button"
                aria-label="Jump"
                {...bind("jump")}
              >
                <span aria-hidden="true">↑</span>
                <small>JUMP</small>
              </button>
            </div>
          </div>
        </div>
      </section>

      <footer className="machine-footer">
        <p>
          {running ? "CABINET ONLINE" : "WARMING TUBES"} · ONE PLAYER · LOCAL
          HIGH SCORE
        </p>
        <p className="desktop-hint">
          MOVE A/D OR ←/→ · JUMP SPACE/C · BUBBLE X/Z · ENTER START · P
          ARCHIVE/PAUSE
        </p>
        <p className="mobile-hint">
          MULTI-TOUCH READY · TURN LANDSCAPE FOR A BIGGER CHAMBER
        </p>
      </footer>
    </main>
  );
}
