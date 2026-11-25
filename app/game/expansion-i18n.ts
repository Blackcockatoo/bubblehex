/**
 * Forbidden Expansion interface copy (EN / 日本語 / हिन्दी).
 * Arcade announcements and item/track lore names stay English across languages,
 * matching the cabinet's rule that lore names are part of the gothic identity.
 */
import type { Lang } from "./i18n";
import type { JukeboxChoice, ThemeId } from "./jukebox";

export type PauseTab = "settings" | "collection" | "jukebox" | "theme";
export const PAUSE_TABS: readonly PauseTab[] = ["settings", "collection", "jukebox", "theme"];

export type ExpansionCopy = {
  tabs: Record<PauseTab, string>;
  tabsLabel: string;
  tabHint: string;
  combo: string;
  time: string;
  boss: string;
  best: string;
  collectionTitle: string;
  undiscovered: string;
  owned: (count: number) => string;
  howToFind: string;
  jukeboxTitle: string;
  nowPlaying: string;
  selected: string;
  locked: (vinyls: number) => string;
  vinylsOwned: (count: number) => string;
  tracks: Record<JukeboxChoice, string>;
  themeTitle: string;
  themeNote: string;
  themes: Record<ThemeId, string>;
  navHint: string;
  applied: string;
  ammoNormal: string;
  ammoButton: (name: string, charges: number) => string;
};

export const EXPANSION_COPY: Record<Lang, ExpansionCopy> = {
  en: {
    tabs: { settings: "SETTINGS", collection: "COLLECTION", jukebox: "JUKEBOX", theme: "THEME" },
    tabsLabel: "Pause menu sections",
    tabHint: "Q / E · SWITCH TAB",
    combo: "COMBO", time: "TIME", boss: "WIDOW", best: "BEST",
    collectionTitle: "THE WIDOW'S COLLECTION",
    undiscovered: "UNDISCOVERED",
    owned: n => `OWNED ×${n}`,
    howToFind: "FIND",
    jukeboxTitle: "CURSED JUKEBOX",
    nowPlaying: "NOW PLAYING",
    selected: "SELECTED",
    locked: n => `LOCKED · ${n} CURSED VINYL${n === 1 ? "" : "S"}`,
    vinylsOwned: n => `CURSED VINYLS ${n}`,
    tracks: { auto: "AUTO · CHAMBER DEFAULT", stage: "NEON HEX", title: "BUBBLE HEX JINGLE", bonus: "DIRTY GOLD VAULT", boss: "THE WIDOW UNVEILED", victory: "DAWN FANFARE" },
    themeTitle: "B$S SPECIAL EDITIONS",
    themeNote: "PREVIEW · PANELS AND ACCENTS ONLY",
    themes: { default: "ORIGINAL SIGNAL", "old-vic": "OLD VIC STATE", "civilian-signal": "CIVILIAN SIGNAL", klein: "KLEIN EDITION", "widow-after-dark": "WIDOW AFTER DARK" },
    navHint: "← → CHOOSE · BUBBLE APPLY",
    applied: "APPLIED",
    ammoNormal: "NORMAL",
    ammoButton: (name: string, charges: number) => `Switch ammo. Now: ${name}${charges ? ` ×${charges}` : ""}. Key V`,
  },
  ja: {
    tabs: { settings: "設定", collection: "コレクション", jukebox: "ジュークボックス", theme: "テーマ" },
    tabsLabel: "ポーズメニュー",
    tabHint: "Q / E · タブ切替",
    combo: "コンボ", time: "タイム", boss: "ウィドウ", best: "ベスト",
    collectionTitle: "ウィドウのコレクション",
    undiscovered: "未発見",
    owned: n => `所持 ×${n}`,
    howToFind: "入手",
    jukeboxTitle: "呪いのジュークボックス",
    nowPlaying: "再生中",
    selected: "選択中",
    locked: n => `ロック · 呪いのレコード ${n}枚`,
    vinylsOwned: n => `呪いのレコード ${n}`,
    tracks: { auto: "自動 · チャンバー標準", stage: "NEON HEX", title: "BUBBLE HEX JINGLE", bonus: "DIRTY GOLD VAULT", boss: "THE WIDOW UNVEILED", victory: "DAWN FANFARE" },
    themeTitle: "B$S スペシャルエディション",
    themeNote: "プレビュー · パネルと色のみ",
    themes: { default: "オリジナル", "old-vic": "OLD VIC STATE", "civilian-signal": "CIVILIAN SIGNAL", klein: "KLEIN EDITION", "widow-after-dark": "WIDOW AFTER DARK" },
    navHint: "← → 選ぶ · バブルで決定",
    applied: "適用中",
    ammoNormal: "ノーマル",
    ammoButton: (name: string, charges: number) => `弾を切替。現在: ${name}${charges ? ` ×${charges}` : ""}。Vキー`,
  },
  hi: {
    tabs: { settings: "सेटिंग्स", collection: "संग्रह", jukebox: "ज्यूकबॉक्स", theme: "थीम" },
    tabsLabel: "पॉज़ मेनू खंड",
    tabHint: "Q / E · टैब बदलें",
    combo: "कॉम्बो", time: "समय", boss: "विडो", best: "सर्वश्रेष्ठ",
    collectionTitle: "विडो का संग्रह",
    undiscovered: "अनदेखा",
    owned: n => `पास में ×${n}`,
    howToFind: "कैसे मिले",
    jukeboxTitle: "शापित ज्यूकबॉक्स",
    nowPlaying: "अभी बज रहा",
    selected: "चुना गया",
    locked: n => `बंद · ${n} शापित रिकॉर्ड`,
    vinylsOwned: n => `शापित रिकॉर्ड ${n}`,
    tracks: { auto: "स्वचालित · कक्ष डिफ़ॉल्ट", stage: "NEON HEX", title: "BUBBLE HEX JINGLE", bonus: "DIRTY GOLD VAULT", boss: "THE WIDOW UNVEILED", victory: "DAWN FANFARE" },
    themeTitle: "B$S विशेष संस्करण",
    themeNote: "पूर्वावलोकन · केवल पैनल और रंग",
    themes: { default: "मूल सिग्नल", "old-vic": "OLD VIC STATE", "civilian-signal": "CIVILIAN SIGNAL", klein: "KLEIN EDITION", "widow-after-dark": "WIDOW AFTER DARK" },
    navHint: "← → चुनें · बबल से लागू",
    applied: "लागू",
    ammoNormal: "सामान्य",
    ammoButton: (name: string, charges: number) => `गोला बदलें। अभी: ${name}${charges ? ` ×${charges}` : ""}। V कुंजी`,
  },
};
