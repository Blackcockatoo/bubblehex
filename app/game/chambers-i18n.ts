/** Forbidden Expansion M6 copy: chambers, props, tarot, editions (en / ja / hi). */
import type { Lang } from "./i18n";
import type { ChamberId, PropKind, TarotId } from "./chambers";

export type ChamberCopy = {
  chambers: Record<ChamberId, [name: string, rule: string]>;
  props: Record<PropKind, string>;
  tarot: Record<TarotId, [name: string, effect: string]>;
  keyHeld: string;
  chamberLabel: string;
  discovered: string;
  doorOpen: string;
  doorLocked: string;
  entering: string;
  practice: string;
  enter: string;
  cleared: string;
  chamberUnknown: string;
  route: string;
  coffinHide: string;
  coffinOut: string;
  chandelierFall: string;
  venomOrb: string;
  beatBonus: (n: number) => string;
  veilStep: string;
  widowVariant: string;
  editionLocked: string;
  editionHint: Record<string, string>;
  editionUnlocked: (name: string) => string;
  themeNote: string;
};

const EN: ChamberCopy = {
  chambers: {
    dead_disco: ["The Dead Disco", "Enemies lunge on the beat · pop on the beat for bonus"],
    vanity_room: ["The Vanity Room", "Mirrors reflect shots and cast a twin"],
    drowned_ballroom: ["The Drowned Ballroom", "Currents carry bubbles · you sink slowly"],
    poison_conservatory: ["Poison Conservatory", "Venom spreads · pops cleanse it"],
    klein_chamber: ["The Klein Chamber", "Edges wrap · bubbles fall back up from below"],
    widow_cathedral: ["The Widow's Cathedral", "Stained glass refracts · the Widow veil-steps"],
  },
  props: { jukebox: "Jukebox", chandelier: "Chandelier", stained_glass: "Stained Glass", coffin: "Coffin", mirror: "Enchanted Mirror", serpent_statue: "Serpent Statue", secret_door: "Secret Door", tarot: "Tarot Card" },
  tarot: {
    sun: ["THE SUN", "+10s"], star: ["THE STAR", "+1 LIFE"], magician: ["THE MAGICIAN", "+2 SPECIAL SHOTS"], lovers: ["THE LOVERS", "ENEMIES FROZEN"],
    tower: ["THE TOWER", "ENEMIES HASTEN"], death: ["DEATH", "-6s"], moon: ["THE MOON", "DARKNESS FALLS"],
  },
  keyHeld: "THE WIDOW'S KEY · FIND THE DOOR",
  chamberLabel: "SECRET CHAMBER",
  discovered: "DISCOVERED",
  doorOpen: "THE DOOR REMEMBERS · A CHAMBER WAITS",
  doorLocked: "A KEYHOLE · BRING THE WIDOW'S KEY",
  entering: "ENTERING",
  practice: "PRACTICE · CLEARING RETURNS TO TITLE",
  enter: "ENTER",
  cleared: "CHAMBER CLEARED",
  chamberUnknown: "FOUND BEHIND A SECRET DOOR",
  route: "WIDOW'S KEY → SECRET DOOR",
  coffinHide: "HIDDEN IN THE COFFIN",
  coffinOut: "THE COFFIN EXHALES",
  chandelierFall: "THE CHANDELIER FALLS",
  venomOrb: "+1 VENOM",
  beatBonus: n => `ON THE BEAT +${n}`,
  veilStep: "VEIL-STEP",
  widowVariant: "THE WIDOW · CATHEDRAL VEIL",
  editionLocked: "LOCKED",
  editionHint: {
    "old-vic": "Clear any stage once",
    "civilian-signal": "Earn Chamber Crawler (clear 6 chambers)",
    klein: "Clear The Klein Chamber",
    "widow-after-dark": "Clear The Widow's Cathedral",
  },
  editionUnlocked: name => `EDITION UNLOCKED · ${name}`,
  themeNote: "RESTYLES THE CABINET, HUD AND PLAYFIELD",
};

const JA: ChamberCopy = {
  chambers: {
    dead_disco: ["死者のディスコ", "敵はビートで突進 · ビートで割るとボーナス"],
    vanity_room: ["虚栄の間", "鏡が泡を反射し、双子を生む"],
    drowned_ballroom: ["水没した舞踏室", "水流が泡を運ぶ · ゆっくり沈む"],
    poison_conservatory: ["毒の温室", "毒が広がる · 割ると浄化"],
    klein_chamber: ["クラインの間", "端がつながる · 泡は下から戻る"],
    widow_cathedral: ["未亡人の大聖堂", "ステンドグラスが屈折 · 未亡人はヴェールで跳ぶ"],
  },
  props: { jukebox: "ジュークボックス", chandelier: "シャンデリア", stained_glass: "ステンドグラス", coffin: "棺", mirror: "魔法の鏡", serpent_statue: "蛇の像", secret_door: "秘密の扉", tarot: "タロット" },
  tarot: {
    sun: ["太陽", "+10秒"], star: ["星", "+1ライフ"], magician: ["魔術師", "特殊弾+2"], lovers: ["恋人", "敵が凍る"],
    tower: ["塔", "敵が加速"], death: ["死神", "-6秒"], moon: ["月", "闇が降りる"],
  },
  keyHeld: "未亡人の鍵 · 扉を探せ",
  chamberLabel: "秘密の部屋",
  discovered: "発見済み",
  doorOpen: "扉は覚えている · 部屋が待つ",
  doorLocked: "鍵穴 · 未亡人の鍵が必要",
  entering: "入場",
  practice: "練習 · クリアでタイトルへ",
  enter: "入る",
  cleared: "部屋クリア",
  chamberUnknown: "秘密の扉の向こう",
  route: "未亡人の鍵 → 秘密の扉",
  coffinHide: "棺に隠れた",
  coffinOut: "棺が息を吐く",
  chandelierFall: "シャンデリアが落ちる",
  venomOrb: "毒 +1",
  beatBonus: n => `ビート +${n}`,
  veilStep: "ヴェール跳躍",
  widowVariant: "未亡人 · 大聖堂のヴェール",
  editionLocked: "ロック中",
  editionHint: {
    "old-vic": "どこかのステージを1回クリア",
    "civilian-signal": "実績「部屋巡り」(6部屋クリア)",
    klein: "クラインの間をクリア",
    "widow-after-dark": "未亡人の大聖堂をクリア",
  },
  editionUnlocked: name => `エディション解放 · ${name}`,
  themeNote: "キャビネット・HUD・画面を着せ替え",
};

const HI: ChamberCopy = {
  chambers: {
    dead_disco: ["मृत डिस्को", "दुश्मन ताल पर झपटते हैं · ताल पर फोड़ें, बोनस"],
    vanity_room: ["दर्पण कक्ष", "दर्पण बुलबुले लौटाते हैं और जुड़वाँ बनाते हैं"],
    drowned_ballroom: ["डूबा नृत्यकक्ष", "धाराएँ बुलबुले बहाती हैं · आप धीरे गिरते हैं"],
    poison_conservatory: ["विष उद्यान", "विष फैलता है · फोड़ने से साफ़"],
    klein_chamber: ["क्लाइन कक्ष", "किनारे जुड़े हैं · बुलबुले नीचे से लौटते हैं"],
    widow_cathedral: ["विधवा का गिरजा", "रंगीन काँच मोड़ता है · विधवा पर्दा-कदम लेती है"],
  },
  props: { jukebox: "ज्यूकबॉक्स", chandelier: "झूमर", stained_glass: "रंगीन काँच", coffin: "ताबूत", mirror: "जादुई दर्पण", serpent_statue: "नाग मूर्ति", secret_door: "गुप्त द्वार", tarot: "टैरो कार्ड" },
  tarot: {
    sun: ["सूर्य", "+10 से."], star: ["तारा", "+1 जीवन"], magician: ["जादूगर", "+2 विशेष गोले"], lovers: ["प्रेमी", "दुश्मन जमे"],
    tower: ["मीनार", "दुश्मन तेज़"], death: ["मृत्यु", "-6 से."], moon: ["चंद्रमा", "अंधेरा छाया"],
  },
  keyHeld: "विधवा की चाबी · द्वार खोजें",
  chamberLabel: "गुप्त कक्ष",
  discovered: "खोजा गया",
  doorOpen: "द्वार याद रखता है · कक्ष प्रतीक्षा में",
  doorLocked: "ताला · विधवा की चाबी लाएँ",
  entering: "प्रवेश",
  practice: "अभ्यास · जीतने पर शीर्षक पर",
  enter: "प्रवेश",
  cleared: "कक्ष साफ़",
  chamberUnknown: "गुप्त द्वार के पीछे",
  route: "विधवा की चाबी → गुप्त द्वार",
  coffinHide: "ताबूत में छिपे",
  coffinOut: "ताबूत ने साँस छोड़ी",
  chandelierFall: "झूमर गिरा",
  venomOrb: "+1 विष",
  beatBonus: n => `ताल पर +${n}`,
  veilStep: "पर्दा-कदम",
  widowVariant: "विधवा · गिरजा का पर्दा",
  editionLocked: "बंद",
  editionHint: {
    "old-vic": "कोई भी चरण एक बार जीतें",
    "civilian-signal": "उपलब्धि: कक्ष यात्री (6 कक्ष)",
    klein: "क्लाइन कक्ष जीतें",
    "widow-after-dark": "विधवा का गिरजा जीतें",
  },
  editionUnlocked: name => `संस्करण खुला · ${name}`,
  themeNote: "कैबिनेट, HUD और मैदान का रूप बदलता है",
};

const TABLE: Record<Lang, ChamberCopy> = { en: EN, ja: JA, hi: HI };
export const chamberCopy = (lang: unknown): ChamberCopy => TABLE[(lang as Lang)] ?? EN;
export const CHAMBER_COPY_LANGS = Object.keys(TABLE) as Lang[];
