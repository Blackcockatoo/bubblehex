"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BubbleHexEngine, type Action } from "./engine";
import { installBubbleHexRuntimeUpgrades } from "./runtime-upgrades";

const holdActions: Action[] = ["left", "right"];

export default function BubbleHex() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<BubbleHexEngine | null>(null);
  const [muted, setMuted] = useState(false);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!canvasRef.current) return;
    installBubbleHexRuntimeUpgrades(BubbleHexEngine);
    const engine = new BubbleHexEngine(canvasRef.current, () => setRunning(true));
    engineRef.current = engine; engine.start();
    const stopScroll = (event: KeyboardEvent) => {
      if (["ArrowLeft","ArrowRight","ArrowUp"," "].includes(event.key)) event.preventDefault();
    };
    window.addEventListener("keydown", stopScroll, { passive:false });
    return () => { window.removeEventListener("keydown", stopScroll); engine.destroy(); };
  }, []);

  const press = useCallback((action: Action) => engineRef.current?.press(action), []);
  const release = useCallback((action: Action) => engineRef.current?.release(action), []);
  const bind = (action: Action) => ({
    onPointerDown:(event:React.PointerEvent<HTMLButtonElement>)=>{event.currentTarget.setPointerCapture(event.pointerId);press(action);},
    onPointerUp:()=>release(action), onPointerCancel:()=>release(action),
    onPointerLeave:()=>holdActions.includes(action)&&release(action),
  });

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
          <div className="scanlines" aria-hidden="true" />
        </div></div>
        <div className="control-deck">
          <div className="dpad" aria-label="Movement controls">
            <button type="button" aria-label="Move left" {...bind("left")}><span aria-hidden="true">◀</span></button>
            <button type="button" aria-label="Move right" {...bind("right")}><span aria-hidden="true">▶</span></button>
          </div>
          <div className="mini-controls">
            <button type="button" onClick={()=>press("start")}>START</button>
            <button type="button" onClick={()=>press("consciousness")}>ENEMY LEVEL</button>
            <button type="button" onClick={()=>press("pause")}>ARCHIVE / PAUSE</button>
            <button type="button" aria-pressed={muted} onClick={()=>{const n=!muted;setMuted(n);engineRef.current?.setMuted(n);}}>{muted?"SOUND OFF":"SOUND ON"}</button>
          </div>
          <div className="action-controls" aria-label="Action controls">
            <button className="jump" type="button" aria-label="Jump" {...bind("jump")}><span aria-hidden="true">↑</span></button>
            <button className="bubble" type="button" aria-label="Blow bubble" {...bind("bubble")}><span aria-hidden="true">○</span></button>
          </div>
        </div>
      </div>
    </section>
    <footer className="machine-footer">
      <p>{running?"CABINET ONLINE":"WARMING TUBES"} · ONE PLAYER · LOCAL HIGH SCORE</p>
      <p className="desktop-hint">MOVE A/D OR ←/→ · JUMP SPACE/C · BUBBLE X/Z · ENTER START · P ARCHIVE/PAUSE</p>
      <p className="mobile-hint">MULTI-TOUCH READY · TURN LANDSCAPE FOR A BIGGER CHAMBER</p>
    </footer>
  </main>;
}
