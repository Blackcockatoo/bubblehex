/**
 * Cabinet menu translations (English, Japanese, Hindi).
 *
 * Covers the DOM cabinet (status rail, buttons, hints, pause card) and the
 * canvas menu screens (title prompt, hero select, pause, game over). Chamber
 * names, hero names, enemy-consciousness names, archive entries, endings and
 * level cues stay English — they are part of the gothic lore.
 */
export type Lang = "en" | "ja" | "hi";
export const LANGS: readonly Lang[] = ["en", "ja", "hi"];
export const LANG_LABEL: Record<Lang, string> = { en: "EN", ja: "日本語", hi: "हिन्दी" };
export const LANG_STORAGE_KEY = "bubble-hex-lang";

export type CabinetCopy = {
  studio: string;
  chamber: string;
  ritualState: string;
  cabinetSignal: string;
  online: string;
  warming: string;
  states: Record<string, string>;
  score: string;
  left: string;
  right: string;
  moveLeft: string;
  moveRight: string;
  start: string;
  restart: string;
  next: string;
  enemyLevel: string;
  resume: string;
  pause: string;
  archive: string;
  soundOff: string;
  soundOn: string;
  enableMusic: string;
  playMusic: string;
  musicLoading: string;
  bubble: string;
  jump: string;
  blowBubble: string;
  jumpLabel: string;
  cabinetOnline: string;
  warmingTubes: string;
  onePlayer: string;
  localHigh: string;
  desktopHint: string;
  mobileHint: string;
  language: string;
  // instructions
  iSelect: string;
  iPaused: string;
  iClear: string;
  iIntro: string;
  iPlay: string;
  iOver: string;
  iArchive: string;
  iTitle: string;
  // pause card
  paused: string;
  pauseResume: string;
  music: string;
  sfx: string;
  holdJump: string;
  bubbleSound: (on: boolean) => string;
  tapJumpMotion: (on: boolean) => string;
  // canvas
  pressStart: string;
  enterStart: string;
  enemyLevelHint: string;
  chooseHex: string;
  selectHint: string;
  confirm: string;
  cPauseResume: string;
  cMusicVolume: string;
  cSfxVolume: string;
  cBubbleSound: (on: boolean) => string;
  cReducedMotion: (on: boolean) => string;
  cRestartChamber: string;
  cKeys: string;
  cTouch: string;
  gameOver: string;
  newBest: string;
  campaignBest: string;
  nightRemembers: string;
};

export const CABINET_COPY: Record<Lang, CabinetCopy> = {
  en: {
    studio: "BLUE $NAKE STUDIO",
    chamber: "CHAMBER",
    ritualState: "RITUAL STATE",
    cabinetSignal: "CABINET SIGNAL",
    online: "ONLINE",
    warming: "WARMING",
    states: {},
    score: "SCORE",
    left: "LEFT",
    right: "RIGHT",
    moveLeft: "Move left",
    moveRight: "Move right",
    start: "START",
    restart: "RESTART",
    next: "NEXT",
    enemyLevel: "ENEMY LEVEL",
    resume: "RESUME",
    pause: "PAUSE",
    archive: "ARCHIVE",
    soundOff: "SOUND OFF",
    soundOn: "SOUND ON",
    enableMusic: "ENABLE MUSIC",
    playMusic: "PLAY MUSIC",
    musicLoading: "MUSIC LOADING",
    bubble: "BUBBLE",
    jump: "JUMP",
    blowBubble: "Blow bubble",
    jumpLabel: "Jump",
    cabinetOnline: "CABINET ONLINE",
    warmingTubes: "WARMING TUBES",
    onePlayer: "ONE PLAYER",
    localHigh: "LOCAL HIGH SCORE",
    desktopHint: "MOVE A/D OR ←/→ · JUMP SPACE/C · BUBBLE X/Z · ENTER START · P ARCHIVE/PAUSE",
    mobileHint: "MULTI-TOUCH READY · TURN LANDSCAPE FOR A BIGGER CHAMBER",
    language: "Language",
    iSelect: "Choose a hero · Bubble changes look · Jump confirms",
    iPaused: "Paused · Resume with Pause · Start restarts this chamber",
    iClear: "Chamber cleared · Next starts automatically · Start to continue",
    iIntro: "Trap enemies, then touch their bubbles to pop · Jump to begin",
    iPlay: "Hold Bubble to fire · Touch trapped bubbles to pop · Jump twice to climb",
    iOver: "Press Start to play again",
    iArchive: "Arrows browse the archive · Start returns to the title",
    iTitle: "Press Start · Choose your hex",
    paused: "PAUSED",
    pauseResume: "Pause to resume · Start to restart",
    music: "Music",
    sfx: "SFX",
    holdJump: "Hold Jump +",
    bubbleSound: (on) => `Bubble: sound ${on ? "on" : "off"}`,
    tapJumpMotion: (on) => `Tap Jump: reduced motion ${on ? "on" : "off"}`,
    pressStart: "PRESS START",
    enterStart: "ENTER / START",
    enemyLevelHint: "UP / ENEMY LEVEL TO CHANGE",
    chooseHex: "CHOOSE YOUR HEX",
    selectHint: "← HERO →   •   BUBBLE: LOOK   •   UP: ENEMY LEVEL",
    confirm: "START / JUMP TO CONFIRM",
    cPauseResume: "P / PAUSE — RESUME",
    cMusicVolume: "MUSIC VOLUME",
    cSfxVolume: "SFX VOLUME",
    cBubbleSound: (on) => `BUBBLE  SOUND ${on ? "ON" : "OFF"}`,
    cReducedMotion: (on) => `JUMP (TAP)  REDUCED MOTION ${on ? "ON" : "OFF"}`,
    cRestartChamber: "START — RESTART CHAMBER",
    cKeys: "MOVE A/D OR ARROWS · JUMP SPACE/C · BUBBLE X/Z",
    cTouch: "TOUCH CONTROLS SUPPORT MULTI-TOUCH",
    gameOver: "GAME OVER",
    newBest: "★ NEW CAMPAIGN BEST ★",
    campaignBest: "CAMPAIGN BEST",
    nightRemembers: "PRESS START — THE NIGHT REMEMBERS",
  },
  ja: {
    studio: "BLUE $NAKE STUDIO",
    chamber: "チェンバー",
    ritualState: "儀式の状態",
    cabinetSignal: "筐体シグナル",
    online: "オンライン",
    warming: "起動中",
    states: {
      boot: "起動", title: "タイトル", "character select": "キャラ選択", "stage intro": "開幕",
      playing: "プレイ中", hurry: "急げ", dying: "やられた", "stage clear": "クリア", paused: "一時停止",
      "game over": "ゲームオーバー", victory: "勝利", attract: "デモ", "records/options": "記録",
    },
    score: "スコア",
    left: "左",
    right: "右",
    moveLeft: "左へ移動",
    moveRight: "右へ移動",
    start: "スタート",
    restart: "やり直す",
    next: "次へ",
    enemyLevel: "敵のレベル",
    resume: "再開",
    pause: "一時停止",
    archive: "アーカイブ",
    soundOff: "サウンド OFF",
    soundOn: "サウンド ON",
    enableMusic: "音楽をオンに",
    playMusic: "音楽を再生",
    musicLoading: "音楽を読み込み中",
    bubble: "バブル",
    jump: "ジャンプ",
    blowBubble: "バブルを吹く",
    jumpLabel: "ジャンプ",
    cabinetOnline: "筐体オンライン",
    warmingTubes: "起動中",
    onePlayer: "1人プレイ",
    localHigh: "この端末のハイスコア",
    desktopHint: "移動 A/D か ←/→ · ジャンプ SPACE/C · バブル X/Z · ENTER スタート · P アーカイブ/一時停止",
    mobileHint: "マルチタッチ対応 · 横向きにするとチェンバーが大きくなります",
    language: "言語",
    iSelect: "ヒーローを選ぼう · バブルで見た目を変更 · ジャンプで決定",
    iPaused: "一時停止中 · 「一時停止」で再開 · スタートでこのチェンバーをやり直し",
    iClear: "チェンバー突破 · 次は自動で始まります · スタートで続行",
    iIntro: "敵を閉じこめて、バブルに触れて割ろう · ジャンプで開始",
    iPlay: "バブル長押しで発射 · 閉じこめたバブルに触れて割る · 2段ジャンプで登る",
    iOver: "スタートでもう一度",
    iArchive: "矢印でアーカイブを見る · スタートでタイトルへ",
    iTitle: "スタートを押して · ヘックスを選ぼう",
    paused: "一時停止",
    pauseResume: "「一時停止」で再開 · スタートでやり直し",
    music: "音楽",
    sfx: "効果音",
    holdJump: "ジャンプ長押し +",
    bubbleSound: (on) => `バブル: サウンド ${on ? "ON" : "OFF"}`,
    tapJumpMotion: (on) => `ジャンプをタップ: 動きを減らす ${on ? "ON" : "OFF"}`,
    pressStart: "スタートを押してね",
    enterStart: "ENTER / スタート",
    enemyLevelHint: "上 / 敵のレベルで変更",
    chooseHex: "ヘックスを選べ",
    selectHint: "← ヒーロー →   •   バブル: 見た目   •   上: 敵のレベル",
    confirm: "スタート / ジャンプで決定",
    cPauseResume: "P / 一時停止 — 再開",
    cMusicVolume: "音楽の音量",
    cSfxVolume: "効果音の音量",
    cBubbleSound: (on) => `バブル  サウンド ${on ? "ON" : "OFF"}`,
    cReducedMotion: (on) => `ジャンプ(タップ)  動きを減らす ${on ? "ON" : "OFF"}`,
    cRestartChamber: "スタート — チェンバーをやり直す",
    cKeys: "移動 A/D か矢印 · ジャンプ SPACE/C · バブル X/Z",
    cTouch: "タッチ操作はマルチタッチ対応",
    gameOver: "ゲームオーバー",
    newBest: "★ キャンペーン新記録 ★",
    campaignBest: "キャンペーン最高",
    nightRemembers: "スタートを押して — 夜は覚えている",
  },
  hi: {
    studio: "BLUE $NAKE STUDIO",
    chamber: "चैंबर",
    ritualState: "अनुष्ठान की स्थिति",
    cabinetSignal: "कैबिनेट सिग्नल",
    online: "ऑनलाइन",
    warming: "चालू हो रहा है",
    states: {
      boot: "शुरुआत", title: "टाइटल", "character select": "हीरो चुनें", "stage intro": "शुरू",
      playing: "खेल जारी", hurry: "जल्दी", dying: "हार", "stage clear": "पार", paused: "रुका",
      "game over": "गेम ओवर", victory: "जीत", attract: "डेमो", "records/options": "रिकॉर्ड",
    },
    score: "स्कोर",
    left: "बाएँ",
    right: "दाएँ",
    moveLeft: "बाएँ चलें",
    moveRight: "दाएँ चलें",
    start: "शुरू",
    restart: "फिर से",
    next: "अगला",
    enemyLevel: "दुश्मन लेवल",
    resume: "जारी रखें",
    pause: "रोकें",
    archive: "आर्काइव",
    soundOff: "साउंड ऑफ़",
    soundOn: "साउंड ऑन",
    enableMusic: "संगीत चालू करें",
    playMusic: "संगीत चलाएँ",
    musicLoading: "संगीत लोड हो रहा है",
    bubble: "बुलबुला",
    jump: "कूदें",
    blowBubble: "बुलबुला फूँकें",
    jumpLabel: "कूदें",
    cabinetOnline: "कैबिनेट ऑनलाइन",
    warmingTubes: "चालू हो रहा है",
    onePlayer: "एक खिलाड़ी",
    localHigh: "इस डिवाइस का हाई स्कोर",
    desktopHint: "चलें A/D या ←/→ · कूदें SPACE/C · बुलबुला X/Z · ENTER शुरू · P आर्काइव/रोकें",
    mobileHint: "मल्टी-टच तैयार · बड़ा चैंबर देखने के लिए फ़ोन आड़ा करें",
    language: "भाषा",
    iSelect: "हीरो चुनें · बुलबुला से लुक बदलें · कूदें से पक्का करें",
    iPaused: "खेल रुका है · रोकें से जारी रखें · शुरू से यह चैंबर फिर से",
    iClear: "चैंबर पार · अगला अपने-आप शुरू होगा · जारी रखने के लिए शुरू",
    iIntro: "दुश्मनों को बुलबुले में फँसाइए, फिर छूकर फोड़िए · शुरू करने के लिए कूदें",
    iPlay: "फ़ायर के लिए बुलबुला दबाए रखें · फँसे बुलबुले छूकर फोड़ें · चढ़ने के लिए दो बार कूदें",
    iOver: "फिर खेलने के लिए शुरू दबाएँ",
    iArchive: "तीर से आर्काइव देखें · शुरू से टाइटल पर लौटें",
    iTitle: "शुरू दबाएँ · अपना हेक्स चुनें",
    paused: "रुका है",
    pauseResume: "रोकें से जारी रखें · शुरू से फिर से",
    music: "संगीत",
    sfx: "इफ़ेक्ट",
    holdJump: "कूदें दबाए रखें +",
    bubbleSound: (on) => `बुलबुला: साउंड ${on ? "ऑन" : "ऑफ़"}`,
    tapJumpMotion: (on) => `कूदें टैप: कम मोशन ${on ? "ऑन" : "ऑफ़"}`,
    pressStart: "START दबाएँ",
    enterStart: "ENTER / START",
    enemyLevelHint: "ऊपर / दुश्मन लेवल से बदलें",
    chooseHex: "अपना हेक्स चुनें",
    selectHint: "← हीरो →   •   बुलबुला: लुक   •   ऊपर: दुश्मन लेवल",
    confirm: "START / कूदें से पक्का करें",
    cPauseResume: "P / रोकें — जारी रखें",
    cMusicVolume: "संगीत आवाज़",
    cSfxVolume: "इफ़ेक्ट आवाज़",
    cBubbleSound: (on) => `बुलबुला  साउंड ${on ? "ऑन" : "ऑफ़"}`,
    cReducedMotion: (on) => `कूदें (टैप)  कम मोशन ${on ? "ऑन" : "ऑफ़"}`,
    cRestartChamber: "START — चैंबर फिर से",
    cKeys: "चलें A/D या तीर · कूदें SPACE/C · बुलबुला X/Z",
    cTouch: "टच कंट्रोल मल्टी-टच सपोर्ट करते हैं",
    gameOver: "गेम ओवर",
    newBest: "★ नया कैंपेन रिकॉर्ड ★",
    campaignBest: "कैंपेन बेस्ट",
    nightRemembers: "START दबाएँ — रात याद रखती है",
  },
};

function isLang(value: string | null | undefined): value is Lang {
  return value === "en" || value === "ja" || value === "hi";
}

/** ?lang= wins, then the saved choice, then the browser language, then English. */
export function detectLang(
  search = typeof location === "undefined" ? "" : location.search,
  stored: string | null = safeGet(),
  browser: readonly string[] = typeof navigator === "undefined" ? [] : navigator.languages ?? [navigator.language],
): Lang {
  const fromQuery = new URLSearchParams(search).get("lang");
  if (isLang(fromQuery)) return fromQuery;
  if (isLang(stored)) return stored;
  for (const tag of browser) {
    const base = tag?.toLowerCase().split("-")[0];
    if (isLang(base)) return base;
  }
  return "en";
}

function safeGet(): string | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage.getItem(LANG_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function saveLang(lang: Lang) {
  try {
    localStorage.setItem(LANG_STORAGE_KEY, lang);
  } catch {
    // Private mode: the choice lasts for this visit only.
  }
  if (typeof document !== "undefined") document.documentElement.lang = lang;
}

const LANG_EVENT = "bubble-hex-lang";

/** useSyncExternalStore plumbing: English on the server, the detected language in the browser. */
export function subscribeLang(onChange: () => void) {
  window.addEventListener(LANG_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(LANG_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}
export const serverLang = (): Lang => "en";
/** An explicit pick made this visit; wins even when storage refuses to save it. */
let chosen: Lang | null = null;
export const clientLang = (): Lang => chosen ?? detectLang();

export function chooseLang(lang: Lang) {
  chosen = lang;
  saveLang(lang);
  // ?lang= would otherwise keep winning over the new choice.
  const url = new URL(window.location.href);
  if (url.searchParams.has("lang")) {
    url.searchParams.delete("lang");
    window.history.replaceState(null, "", url);
  }
  window.dispatchEvent(new Event(LANG_EVENT));
}
