"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BubbleHexEngine, type Action } from "./engine";
import { installBubbleHexRuntimeUpgrades } from "./runtime-upgrades";
import "./background-motion.css";

const holdActions: Action[] = ["left", "right"];

type BackgroundKey = "hexTunnel" | "bubbleField" | "hexReactor" | "bubbleCity" | "hexStorm" | "bubbleMoon" | "vaultCave";

const BACKGROUNDS: Record<BackgroundKey, { svg: string; webm: string; mp4: string }> = {
  hexTunnel: { svg: "/backgrounds/hex-tunnel.svg", webm: "/backgrounds/video/hex-tunnel.webm", mp4: "/backgrounds/video/hex-tunnel.mp4" },
  bubbleField: { svg: "/backgrounds/bubble-field.svg", webm: "/backgrounds/video/bubble-field.webm", mp4: "/backgrounds/video/bubble-field.mp4" },
  hexReactor: { svg: "/backgrounds/hex-reactor.svg", webm: "/backgrounds/video/hex-reactor.webm", mp4: "/backgrounds/video/hex-reactor.mp4" },
  bubbleCity: { svg: "/backgrounds/bubble-city.svg", webm: "/backgrounds/video/bubble-city.webm", mp4: "/backgrounds/video/bubble-city.mp4" },
  hexStorm: { svg: "/backgrounds/hex-storm.svg", webm: "/backgrounds/video/hex-storm.webm", mp4: "/backgrounds/video/hex-storm.mp4" },
  bubbleMoon: { svg: "/backgrounds/bubble-moon.svg", webm: "/backgrounds/video/bubble-moon.webm", mp4: "/backgrounds/video/bubble-moon.mp4" },
  vaultCave: { svg: "/backgrounds/bubble-city.svg", webm: "/backgrounds/video/vault-cave.webm", mp4: "/backgrounds/video/vault-cave.mp4" },
};

const BACKGROUND_BY_LEVEL: Record<string, BackgroundKey> = {
  "The First Sip": "hexTunnel",
  "Chain Letter": "bubbleField",
  "Blue Pressure": "hexReactor",
  "Room 108": "bubbleCity",
  "Mirror Teeth": "hexStorm",
  "Last Lift": "hexReactor",
  "Poison Moon": "bubbleMoon",
  "Black Roses": "hexStorm",
  "Serpent Glass": "hexTunnel",
  "Thirteen Candles": "hexReactor",
  "Event Horizon": "hexTunnel",
  "The Widow Unveiled": "hexReactor",
  "The Dirty Gold Vault": "vaultCave",
};

const PLAY_STATES = new Set(["attract", "stageIntro", "playing", "hurry", "dying", "stageClear", "paused"]);
const MENU_BACKGROUND: BackgroundKey = "bubbleCity";

function backgroundFor(gameState: string, levelName: string): BackgroundKey {
  if (!PLAY_STATES.has(gameState)) return MENU_BACKGROUND;
  return BACKGROUND_BY_LEVEL[levelName] ?? "hexTunnel";
}

export default function BubbleHex() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<BubbleHexEngine | null>(null);
  const [muted, setMuted] = useState(false);
  const [running, setRunning] = useState(false);
  const [backgroundKey, setBackgroundKey] = useState<BackgroundKey>(MENU_BACKGROUND);
  const [gameState, setGameState] = useState("boot");
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    setReducedMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  useEffect(() => {
    if (!canvasRef.current) return;
    installBubbleHexRuntimeUpgrades(BubbleHexEngine);
    const engine = new BubbleHexEngine(canvasRef.current, () => setRunning(true));
    engineRef.current = engine;
    engine.start();

    const stopScroll = (event: KeyboardEvent) => {
      if (["ArrowLeft", "ArrowRight", "ArrowUp", " "].includes(event.key)) event.preventDefault();
    };
    const syncBackground = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const nextState = canvas.dataset.gameState ?? "boot";
      const nextBackground = backgroundFor(nextState, canvas.dataset.levelName ?? "");
      setGameState((current) => current === nextState ? current : nextState);
      setBackgroundKey((current) => current === nextBackground ? current : nextBackground);
    };

    window.addEventListener("keydown", stopScroll, { passive: false });
    const backgroundTimer = window.setInterval(syncBackground, 250);
    syncBackground();

    return () => {
      window.clearInterval(backgroundTimer);
      window.removeEventListener("keydown", stopScroll);
      engine.destroy();
    };
  }, []);

  const press = useCallback((action: Action) => engineRef.current?.press(action), []);
  const release = useCallback((action: Action) => engineRef.current?.release(action), []);
  const bind = (action: Action) => ({
    onPointerDown: (event: React.PointerEvent<HTMLButtonElement>) => {
      event.currentTarget.setPointerCapture(event.pointerId);
      press(action);
    },
    onPointerUp: () => release(action),
    onPointerCancel: () => release(action),
    onPointerLeave: () => holdActions.includes(action) && release(action),
  });

  const motionMode = PLAY_STATES.has(gameState) ? "is-playing" : "is-menu";

  return <main className="arcade-page">
    <header className="top-rail">
      <div className="studio-mark"><span>B$S</span> BLUE $NAKE STUDIO</div>
      <div className="machine-status"><i /> ORIGINAL ARCADE SIGNAL <strong>108</strong></div>
    </header>
    <section className="cabinet" aria-label="Bubble Hex arcade cabinet">
      <div className="cabinet-crown" aria-hidden="true"><span>✦</span><b>BUBBLE HEX</b><span>✦</span></div>
      <div className="play-layout">
        <div className="screen-bezel"><div className="screen-wrap">
          <canvas ref={canvasRef} width={960} height={720} aria-label="Playable Bubble Hex game" tabIndex={0}/>
          {reducedMotion
            ? <img key={backgroundKey} className={`game-background-motion ${motionMode}`} src={BACKGROUNDS[backgroundKey].svg} alt="" aria-hidden="true" />
            : <video key={backgroundKey} className={`game-background-motion ${motionMode}`} poster={BACKGROUNDS[backgroundKey].svg} autoPlay loop muted playsInline aria-hidden="true">
                <source src={BACKGROUNDS[backgroundKey].webm} type="video/webm" />
                <source src={BACKGROUNDS[backgroundKey].mp4} type="video/mp4" />
              </video>}
          <div className="game-background-vignette" aria-hidden="true" />
          <div className="scanlines" aria-hidden="true" />
        </div></div>
        <div className="control-deck">
          <div className="dpad" aria-label="Movement controls">
            <button type="button" aria-label="Move left" {...bind("left")}><span aria-hidden="true">◀</span></button>
            <button type="button" aria-label="Move right" {...bind("right")}><span aria-hidden="true">▶</span></button>
          </div>
          <div className="mini-controls">
            <button type="button" onClick={() => press("start")}>START</button>
            <button type="button" onClick={() => press("consciousness")}>ENEMY LEVEL</button>
            <button type="button" onClick={() => press("pause")}>ARCHIVE / PAUSE</button>
            <button type="button" aria-pressed={muted} onClick={() => { const next = !muted; setMuted(next); engineRef.current?.setMuted(next); }}>{muted ? "SOUND OFF" : "SOUND ON"}</button>
          </div>
          <div className="action-controls" aria-label="Action controls">
            <button className="bubble" type="button" aria-label="Blow bubble" {...bind("bubble")}><span aria-hidden="true">○</span></button>
            <button className="jump" type="button" aria-label="Jump" {...bind("jump")}><span aria-hidden="true">↑</span></button>
          </div>
        </div>
      </div>
    </section>
    <footer className="machine-footer">
      <p>{running ? "CABINET ONLINE" : "WARMING TUBES"} · ONE PLAYER · LOCAL HIGH SCORE</p>
      <p className="desktop-hint">MOVE A/D OR ←/→ · JUMP SPACE/C · BUBBLE X/Z · ENTER START · P ARCHIVE/PAUSE</p>
      <p className="mobile-hint">MULTI-TOUCH READY · TURN LANDSCAPE FOR A BIGGER CHAMBER</p>
    </footer>
  </main>;
}
