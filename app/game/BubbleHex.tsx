"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BubbleHexEngine, type Action } from "./engine";

export default function BubbleHex() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<BubbleHexEngine | null>(null);
  const moveDir = useRef<-1 | 0 | 1>(0);
  const [padDir, setPadDir] = useState<-1 | 0 | 1>(0);
  const [muted, setMuted] = useState(false);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!canvasRef.current) return;
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

  // One continuous surface for movement: the thumb slides between ◀ and ▶
  // without lifting, and the active half follows the pointer.
  const setDir = useCallback((dir: -1 | 0 | 1) => {
    if (dir === moveDir.current) return;
    if (moveDir.current === -1) release("left");
    if (moveDir.current === 1) release("right");
    if (dir === -1) press("left");
    if (dir === 1) press("right");
    moveDir.current = dir; setPadDir(dir);
  }, [press, release]);
  const padPoint = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setDir((event.clientX - rect.left) / rect.width < .5 ? -1 : 1);
  }, [setDir]);

  const bind = (action: Action) => ({
    onPointerDown:(event:React.PointerEvent<HTMLButtonElement>)=>{event.currentTarget.setPointerCapture(event.pointerId);press(action);},
    onPointerUp:()=>release(action), onPointerCancel:()=>release(action),
  });

  return <main className="arcade-page" onContextMenu={(event)=>event.preventDefault()}>
    <header className="top-rail">
      <div className="studio-mark"><span>B$S</span> BLUE $NAKE STUDIO</div>
      <div className="machine-status"><i /> ORIGINAL ARCADE SIGNAL <strong>108</strong></div>
    </header>
    <section className="cabinet" aria-label="Bubble Hex arcade cabinet">
      <div className="cabinet-crown" aria-hidden="true"><span>✦</span><b>BUBBLE HEX</b><span>✦</span></div>
      <div className="play-layout">
        <div className="side-pad side-left">
          <div className="sys-cluster">
            <button type="button" aria-pressed={muted} onClick={()=>{const n=!muted;setMuted(n);engineRef.current?.setMuted(n);}}>{muted?"SOUND OFF":"SOUND ON"}</button>
            <button type="button" onClick={()=>press("consciousness")}>ENEMY LV</button>
          </div>
          <div className="move-pad" role="group" aria-label="Move left or right" data-dir={padDir}
            onPointerDown={(event)=>{event.currentTarget.setPointerCapture(event.pointerId);padPoint(event);}}
            onPointerMove={(event)=>{if(event.currentTarget.hasPointerCapture(event.pointerId))padPoint(event);}}
            onPointerUp={()=>setDir(0)} onPointerCancel={()=>setDir(0)}>
            <span className="pad-half half-left" aria-hidden="true">◀</span>
            <span className="pad-ridge" aria-hidden="true" />
            <span className="pad-half half-right" aria-hidden="true">▶</span>
          </div>
        </div>
        <div className="screen-bezel"><div className="screen-wrap">
          <canvas ref={canvasRef} width={960} height={720} aria-label="Playable Bubble Hex game" tabIndex={0}/>
          <div className="scanlines" aria-hidden="true" />
        </div></div>
        <div className="side-pad side-right">
          <div className="sys-cluster">
            <button className="sys-start" type="button" onClick={()=>press("start")}>START</button>
            <button type="button" onClick={()=>press("pause")}>PAUSE</button>
          </div>
          <div className="action-cluster" aria-label="Action controls">
            <button className="bubble" type="button" aria-label="Blow bubble" {...bind("bubble")}><span>BUBBLE</span><small>X / Z</small></button>
            <button className="jump" type="button" aria-label="Jump" {...bind("jump")}><span>JUMP</span><small>C / SPACE</small></button>
          </div>
        </div>
      </div>
    </section>
    <footer className="machine-footer">
      <p>{running?"CABINET ONLINE":"WARMING TUBES"} · ONE PLAYER · LOCAL HIGH SCORE</p>
      <p className="desktop-hint">MOVE A/D OR ←/→ · JUMP SPACE/C · BUBBLE X/Z · ENTER START · P ARCHIVE/PAUSE</p>
      <p className="mobile-hint">SLIDE THE PAD TO STEER · MULTI-TOUCH READY</p>
    </footer>
  </main>;
}
