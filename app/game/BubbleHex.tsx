"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { BubbleHexEngine, type Action } from "./engine";
import { CABINET_COPY, LANGS, LANG_ARIA, LANG_ENGLISH, LANG_LABEL, chooseLang, clientLang, detectLang, serverLang, subscribeLang, type Lang } from "./i18n";
import { LEVEL_CUES } from "./level-cues";
import { installBubbleHexRuntimeUpgrades } from "./runtime-upgrades";
import "./background-motion.css";
import "./cabinet-polish.css";
import "./comfort-polish.css";
import "./landscape.css";


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
  "The Dirty Gold Vault": "/backgrounds/vault-cave.svg",
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

function stateLabel(gameState: string, states: Record<string, string> = {}) {
  const words = gameState.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
  return states[words] ?? words.toUpperCase();
}

export default function BubbleHex() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const engineRef = useRef<BubbleHexEngine | null>(null);
  const [muted, setMuted] = useState(false);
  const [musicState, setMusicState] = useState("idle");
  const [running, setRunning] = useState(false);
  const [backgroundSrc, setBackgroundSrc] = useState(MENU_BACKGROUND);
  const [gameState, setGameState] = useState("boot");
  const [levelName, setLevelName] = useState("THE VEIL");
  const [score, setScore] = useState("0");
  const [volumes, setVolumes] = useState({music:"5",sfx:"6"});
  const [combo, setCombo] = useState("");
  const [reducedMotion, setReducedMotion] = useState(false);
  // English on the server render; the saved / browser language is applied after hydration.
  const lang = useSyncExternalStore(subscribeLang, clientLang, serverLang);
  const t = CABINET_COPY[lang];
  useEffect(() => {
    engineRef.current?.setLang(lang);
    document.documentElement.lang = lang;
  }, [lang]);
  const pickLang = (next: Lang) => chooseLang(next);
  // In the top rail, and again beside the d-pad on phones where the rail is hidden.
  const langSwitch = (className: string) => (
    <div className={className} role="group" aria-label={LANG_ARIA}>
      <svg className="lang-globe" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
        <g fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9M12 3C9.5 5.6 8.2 8.6 8.2 12s1.3 6.4 3.8 9" />
        </g>
      </svg>
      {LANGS.map((code) => (
        <button key={code} type="button" lang={code} aria-pressed={lang === code} onClick={() => pickLang(code)}>
          <b>{LANG_LABEL[code]}</b>
          <small lang="en">{LANG_ENGLISH[code]}</small>
        </button>
      ))}
    </div>
  );
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
    engine.setLang(detectLang());
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
      setMusicState(canvas.dataset.musicState ?? "idle");
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

  const freezeScene = reducedMotion || gameState === "paused";
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    engineRef.current?.setBackgroundVideo(video);
    const sync = () => {
      if (freezeScene || document.hidden) video.pause();
      else void video.play().catch(() => {});
    };
    sync(); document.addEventListener("visibilitychange", sync);
    return () => { video.pause(); document.removeEventListener("visibilitychange", sync); engineRef.current?.setBackgroundVideo(null); };
  }, [backgroundSrc, freezeScene]);

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
  const startGame = () => {
    tap("start");
    // Android supports orientation locking in fullscreen; CSS remains the
    // horizontal fallback for Safari, embedded browsers and denied requests.
    if (matchMedia("(pointer: coarse)").matches && !document.fullscreenElement) {
      const orientation = screen.orientation as ScreenOrientation & {lock?: (mode: string) => Promise<void>};
      void document.documentElement.requestFullscreen?.().then(() => orientation.lock?.("landscape")).catch(() => {});
    }
  };
  const soundOn = !muted && Number(volumes.music) > 0;
  const needsMusicRetry = musicState === "blocked" || musicState === "failed";
  const needsMusicStart = needsMusicRetry || musicState === "idle" || musicState === "paused";
  const activePlay = gameState === "playing" || gameState === "hurry" || gameState === "attract";
  const instruction = gameState === "characterSelect" ? t.iSelect
    : gameState === "paused" ? t.iPaused
    : gameState === "stageClear" ? t.iClear
    : gameState === "stageIntro" ? ((lang === "en" && LEVEL_CUES[levelName]) || t.iIntro)
    : activePlay ? t.iPlay
    : gameState === "gameOver" || gameState === "victory" ? t.iOver
    : gameState === "records/options" ? t.iArchive
    : t.iTitle;

  const motionMode = PLAY_STATES.has(gameState) ? "is-playing" : "is-menu";
  const cabinetSignal = running ? t.online : t.warming;

  return (
    <main className="arcade-page" data-horizontal="true" data-game-state={gameState} data-reduced-motion={reducedMotion}>
      <header className="top-rail">
        <div className="studio-mark">
          <span>B$S</span> BLUE $NAKE STUDIO
        </div>
        {langSwitch("lang-switch")}
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
            <small>{t.chamber}</small>
            <b>{levelName}</b>
          </span>
          <span>
            <small>{t.ritualState}</small>
            <b>{stateLabel(gameState, t.states)}</b>
          </span>
          <span>
            <small>{t.cabinetSignal}</small>
            <b>{cabinetSignal} · 108</b>
          </span>
        </div>

        <div className="play-readout">
          <strong aria-label={`${t.score} ${score}`}>{t.score} {Number(score).toLocaleString("en-AU")}</strong>
          <span className="combo-readout" aria-live="polite" aria-atomic="true">{combo || instruction}</span>
        </div>
        <div className="play-layout">
          {langSwitch("lang-switch lang-compact")}
          <div className="screen-bezel">
            <div className="screen-wrap">
              <canvas
                ref={canvasRef}
                width={960}
                height={720}
                aria-label="Playable Bubble Hex game"
                tabIndex={0}
              />
              <video
                key={`scene-${backgroundSrc}`}
                ref={videoRef}
                className="game-scene-source"
                src={backgroundSrc.replace("/backgrounds/", "/backgrounds/video/").replace(".svg", ".mp4")}
                muted playsInline loop preload="auto" aria-hidden="true"
              />
              <img
                key={backgroundSrc}
                className={`game-background-motion ${motionMode}`}
                src={backgroundSrc === "/backgrounds/vault-cave.svg" ? MENU_BACKGROUND : backgroundSrc}
                alt=""
                aria-hidden="true"
              />
              <div className="game-background-vignette" aria-hidden="true" />
              <div className="scanlines" aria-hidden="true" />
              {gameState === "paused" && <div className="pause-summary" role="note" aria-label="Pause controls">
                <strong>{t.paused}</strong>
                <span>{t.pauseResume}</span>
                <span>← / → {t.music} {volumes.music}/10</span>
                <span>{t.holdJump} ← / → {t.sfx} {volumes.sfx}/10</span>
                <span>{t.bubbleSound(!muted)}</span>
                <span>{t.tapJumpMotion(reducedMotion)}</span>
              </div>}
            </div>
          </div>

          <div className="control-deck">
            <div className="dpad" aria-label="Movement controls">
              <button type="button" aria-label={t.moveLeft} {...bind("left")}>
                <span aria-hidden="true">←</span><small>{t.left}</small>
              </button>
              <button type="button" aria-label={t.moveRight} {...bind("right")}>
                <span aria-hidden="true">→</span><small>{t.right}</small>
              </button>
            </div>

            <div className="mini-controls">
              <button type="button" disabled={["boot", "playing", "hurry", "dying"].includes(gameState)} onClick={startGame}>
                {gameState === "paused" ? t.restart : gameState === "stageClear" ? t.next : t.start}
              </button>
              <button type="button" disabled={!(["title", "characterSelect"].includes(gameState))} onClick={() => tap("consciousness")}>
                {t.enemyLevel}
              </button>
              <button type="button" disabled={!["title", "characterSelect", "records/options", "playing", "hurry", "paused"].includes(gameState)} aria-pressed={gameState === "paused"} onClick={() => tap("pause")}>
                {gameState === "paused" ? t.resume : activePlay ? t.pause : t.archive}
              </button>
              <button
                type="button"
                aria-pressed={!soundOn}
                onClick={() => {
                  const next = soundOn && !needsMusicStart;
                  setMuted(next);
                  engineRef.current?.setMuted(next);
                }}
              >
                {!soundOn ? t.soundOff : needsMusicRetry ? t.enableMusic : needsMusicStart ? t.playMusic : musicState === "loading" ? t.musicLoading : t.soundOn}
              </button>
            </div>

            <div className="action-controls" aria-label="Action controls">
              <button
                className="bubble"
                type="button"
                aria-label={t.blowBubble}
                {...bind("bubble")}
              >
                <span aria-hidden="true">○</span>
                <small>{t.bubble}</small>
              </button>
              <button
                className="jump"
                type="button"
                aria-label={t.jumpLabel}
                {...bind("jump")}
              >
                <span aria-hidden="true">↑</span>
                <small>{t.jump}</small>
              </button>
            </div>
          </div>
        </div>
      </section>

      <footer className="machine-footer">
        <p>
          {running ? t.cabinetOnline : t.warmingTubes} · {t.onePlayer} · {t.localHigh}
        </p>
        <p className="desktop-hint">
          {t.desktopHint}
        </p>
        <p className="mobile-hint">
          {t.mobileHint}
        </p>
      </footer>
    </main>
  );
}
