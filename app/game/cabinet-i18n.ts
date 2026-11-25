/**
 * Forbidden Expansion M5 copy (EN / 日本語 / हिन्दी): the Widow's Collection cabinet,
 * achievements, wardrobe, memorabilia, the Widow's remarks, plus the ja/hi lore-name
 * back-fill for items, ammo, personalities and familiars. English stays the fallback
 * for every id, so a missing entry can never blank a label.
 */
import type { Lang } from "./i18n";
import type { CabinetSection, CabinetStatKey } from "./cabinet";

export type CabinetCopy = {
  title: string;
  sections: Record<CabinetSection, string>;
  sectionsShort: Record<CabinetSection, string>;
  collected: (pct: number) => string;
  hint: string;
  close: string;
  open: string;
  openShort: string;
  locked: string;
  unlocked: string;
  equip: string;
  equipped: string;
  unequip: string;
  apply: string;
  applied: string;
  play: string;
  playing: string;
  cleared: string;
  unexplored: string;
  secretFound: string;
  secretHidden: string;
  bestTime: (s: string) => string;
  progress: (have: number, need: number) => string;
  reward: (name: string) => string;
  needVinyls: (n: number) => string;
  ammoTitle: string;
  personalityTitle: string;
  notMet: string;
  achievementToast: string;
  resetTitle: string;
  resetBody: string[];
  resetPress: string;
  resetConfirm: string;
  resetDone: string;
  secretTitle: string;
  secretBody: string;
  secretButton: string;
  remarkBy: string;
  skip: string;
  approves: string;
  none: string;
  stat: Record<CabinetStatKey, (n: number) => string>;
  achievements: Record<string, string>;
  wardrobe: Record<string, string>;
  memorabilia: Record<string, [string, string]>;
  remarks: string[];
};

const EN: CabinetCopy = {
  title: "THE WIDOW'S COLLECTION",
  sections: { items: "ITEMS", familiars: "FAMILIARS", bubbles: "BUBBLES", records: "RECORDS", editions: "EDITIONS", chambers: "CHAMBERS", achievements: "ACHIEVEMENTS", memorabilia: "MEMORABILIA", wardrobe: "WARDROBE", reset: "RESET" },
  sectionsShort: { items: "ITEM", familiars: "PETS", bubbles: "BUBL", records: "REC", editions: "ED", chambers: "ROOM", achievements: "ACHV", memorabilia: "MEMO", wardrobe: "WARD", reset: "RESET" },
  collected: pct => `${pct}% COLLECTED`,
  hint: "← → PICK · JUMP / ↑ / Q E SECTION · BUBBLE USE · ESC CLOSE",
  close: "Close the Widow's Collection",
  open: "Open the Widow's Collection",
  openShort: "✦ COLLECTION",
  locked: "LOCKED", unlocked: "UNLOCKED",
  equip: "BUBBLE · EQUIP", equipped: "EQUIPPED", unequip: "BUBBLE · REMOVE",
  apply: "BUBBLE · APPLY", applied: "APPLIED",
  play: "BUBBLE · SELECT", playing: "SELECTED",
  cleared: "CLEARED", unexplored: "UNEXPLORED",
  secretFound: "SECRET FOUND", secretHidden: "SECRET HIDDEN",
  bestTime: s => `BEST ${s}s`,
  progress: (have, need) => `${have}/${need}`,
  reward: name => `REWARD · ${name}`,
  needVinyls: n => `NEEDS ${n} CURSED VINYL`,
  ammoTitle: "AMMO", personalityTitle: "PERSONALITIES", notMet: "NOT YET MET",
  achievementToast: "ACHIEVEMENT",
  resetTitle: "RESET THE COLLECTION",
  resetBody: [
    "Erases items, familiars, achievements, wardrobe,",
    "discoveries, memorabilia and the living cabinet.",
    "Scores, best times, lore fragments, hero levels",
    "and skins are kept. This cannot be undone.",
  ],
  resetPress: "PRESS BUBBLE TO BEGIN",
  resetConfirm: "PRESS BUBBLE AGAIN TO ERASE · JUMP CANCELS",
  resetDone: "THE COLLECTION IS DUST",
  secretTitle: "THE SECRET DOOR",
  secretBody: "Behind the glass, a door that was never built. It was always open.",
  secretButton: "A glint in the frame",
  remarkBy: "— THE WIDOW",
  skip: "JUMP · SKIP",
  approves: "THE WIDOW APPROVES",
  none: "NONE",
  stat: {
    pops: n => `Pop ${n} trapped bubble${n === 1 ? "" : "s"}`,
    bestChain: n => `Pop a chain of ${n}`,
    chambers: n => `Clear ${n} different chamber${n === 1 ? "" : "s"}`,
    perfects: n => `Clear ${n} chamber${n === 1 ? "" : "s"} without damage`,
    secrets: n => `Find ${n} chamber secret${n === 1 ? "" : "s"}`,
    items: n => `Discover ${n} different items`,
    vinyls: n => `Own ${n} Cursed Vinyl${n === 1 ? "" : "s"}`,
    ammoFired: n => `Fire ${n} special ammo bubble${n === 1 ? "" : "s"}`,
    ammoKinds: n => `Fire ${n} kinds of special ammo`,
    personalities: n => `Meet ${n} bubble personalities`,
    familiars: n => n === 1 ? "Befriend a familiar" : `Befriend ${n} familiars`,
    assists: n => `Receive ${n} familiar assists`,
    naps: () => "Let your familiar fall asleep",
    widowRemarks: n => `Hear the Widow speak ${n} time${n === 1 ? "" : "s"}`,
    titleSecret: () => "Find what hides in the title frame",
    dressed: () => "Wear something from the wardrobe",
    venomSpelled: () => "Spell V·E·N·O·M",
    deaths: () => "Fall once",
    web: () => "Let the spiders finish their web",
  },
  achievements: {
    first_pop: "First Pop", chain_reaction: "Chain Reaction", heartbreaker: "Heartbreaker", opening_night: "Opening Night",
    chamber_crawler: "Chamber Crawler", last_call: "Last Call", untouchable: "Untouchable", flawless_five: "Flawless Five",
    secret_keeper: "Secret Keeper", collector: "Collector", completionist: "Completionist", cursed_ears: "Cursed Ears",
    living_ammo: "Living Ammo", mad_scientist: "Mad Scientist", personality_test: "Personality Test", familiar_face: "Familiar Face",
    menagerie: "Menagerie", helping_paw: "Helping Paw", night_owl: "Night Owl", widows_audience: "The Widow's Audience",
    curiosity: "Curiosity", venom_ascension: "Venom Ascension", dressed_to_hex: "Dressed to Hex",
  },
  wardrobe: { none: "Bare", cat_ears: "Hex Cat Ears", veil: "Mourning Veil", halo: "Static Halo", crown: "Heartbreak Crown", aura_venom: "Venom Aura", aura_crimson: "Crimson Aura", wings: "Velvet Wings" },
  memorabilia: {
    secret_door: ["Secret Door", "It opened the moment you stopped looking for it."],
    tarot: ["Tarot Card", "The Widow left it face down. It is always the Tower."],
    coffin: ["Neon Coffin", "Satin-lined. Your size. Already warm."],
    jukebox: ["Cursed Jukebox", "Plays every record at once, backwards, very quietly."],
    chandelier: ["Chandelier", "Eight crystals, one for every bubble in your longest night."],
    stained_glass: ["Stained Glass", "Each pane is a secret you were not meant to find."],
    serpent_statue: ["Serpent Statue", "Carved from every kind of bubble at once."],
    clock: ["Grandfather Clock", "Stopped when the web was finished. The spiders wound it."],
  },
  remarks: [
    "You pop them so tenderly. They noticed.",
    "Every chamber is a room in my house. Wipe your feet.",
    "The bubbles remember who trapped them.",
    "I counted your lives. I will count them again.",
    "Dawn is a rumour I started.",
    "Your little familiar sleeps in my web at night.",
    "Keep collecting. I am collecting too.",
    "The next room is listening.",
  ],
};

const JA: CabinetCopy = {
  ...EN,
  title: "未亡人のコレクション",
  sections: { items: "アイテム", familiars: "使い魔", bubbles: "バブル", records: "レコード", editions: "エディション", chambers: "部屋", achievements: "実績", memorabilia: "禁断の品", wardrobe: "衣装", reset: "リセット" },
  sectionsShort: { items: "品", familiars: "使魔", bubbles: "泡", records: "盤", editions: "版", chambers: "部屋", achievements: "実績", memorabilia: "禁品", wardrobe: "衣装", reset: "消去" },
  collected: pct => `${pct}% 収集`,
  hint: "← → 選択 · ジャンプ / ↑ / Q E セクション · バブル 決定 · ESC 閉じる",
  close: "未亡人のコレクションを閉じる",
  open: "未亡人のコレクションを開く",
  openShort: "✦ コレクション",
  locked: "未解放", unlocked: "解放済み",
  equip: "バブル · 装備", equipped: "装備中", unequip: "バブル · 外す",
  apply: "バブル · 適用", applied: "適用中",
  play: "バブル · 選択", playing: "選択中",
  cleared: "クリア", unexplored: "未踏",
  secretFound: "秘密発見", secretHidden: "秘密あり",
  bestTime: s => `ベスト ${s}秒`,
  reward: name => `報酬 · ${name}`,
  needVinyls: n => `呪いのレコード ${n}枚が必要`,
  ammoTitle: "弾", personalityTitle: "性格", notMet: "未遭遇",
  achievementToast: "実績解除",
  resetTitle: "コレクションをリセット",
  resetBody: [
    "アイテム、使い魔、実績、衣装、発見、",
    "禁断の品、生きている筐体を消去します。",
    "スコア、ベストタイム、断章、ヒーローレベル、",
    "スキンは残ります。元に戻せません。",
  ],
  resetPress: "バブルで開始",
  resetConfirm: "もう一度バブルで消去 · ジャンプで中止",
  resetDone: "コレクションは塵になった",
  secretTitle: "秘密の扉",
  secretBody: "ガラスの向こうに、建てられなかった扉。最初から開いていた。",
  secretButton: "額縁のきらめき",
  remarkBy: "— 未亡人",
  skip: "ジャンプ · スキップ",
  approves: "未亡人は認めた",
  none: "なし",
  stat: {
    pops: n => `捕らえたバブルを${n}個割る`,
    bestChain: n => `${n}連鎖を決める`,
    chambers: n => `${n}つの部屋をクリア`,
    perfects: n => `ノーダメージで${n}部屋クリア`,
    secrets: n => `部屋の秘密を${n}つ見つける`,
    items: n => `${n}種類のアイテムを発見`,
    vinyls: n => `呪いのレコードを${n}枚所持`,
    ammoFired: n => `特殊弾を${n}発撃つ`,
    ammoKinds: n => `${n}種類の特殊弾を撃つ`,
    personalities: n => `${n}種類の性格に出会う`,
    familiars: n => n === 1 ? "使い魔と仲良くなる" : `使い魔${n}体と仲良くなる`,
    assists: n => `使い魔の助けを${n}回受ける`,
    naps: () => "使い魔を眠らせる",
    widowRemarks: n => `未亡人の声を${n}回聞く`,
    titleSecret: () => "タイトルの額縁に隠れたものを見つける",
    dressed: () => "衣装を身につける",
    venomSpelled: () => "V·E·N·O·M を揃える",
    deaths: () => "一度倒れる",
    web: () => "蜘蛛に巣を完成させる",
  },
  achievements: {
    first_pop: "はじめての一割り", chain_reaction: "連鎖反応", heartbreaker: "ハートブレイカー", opening_night: "初日の夜",
    chamber_crawler: "部屋巡り", last_call: "ラストコール", untouchable: "無傷", flawless_five: "完璧な五夜",
    secret_keeper: "秘密の番人", collector: "収集家", completionist: "完全収集", cursed_ears: "呪われた耳",
    living_ammo: "生きた弾", mad_scientist: "マッドサイエンティスト", personality_test: "性格診断", familiar_face: "見慣れた顔",
    menagerie: "動物園", helping_paw: "助けの手", night_owl: "夜ふかし", widows_audience: "未亡人の謁見",
    curiosity: "好奇心", venom_ascension: "毒の昇天", dressed_to_hex: "呪いの装い",
  },
  wardrobe: { none: "素のまま", cat_ears: "ヘックス猫耳", veil: "喪のヴェール", halo: "静電の光輪", crown: "失恋の王冠", aura_venom: "毒のオーラ", aura_crimson: "深紅のオーラ", wings: "ベルベットの翼" },
  memorabilia: {
    secret_door: ["秘密の扉", "探すのをやめた瞬間に開いた。"],
    tarot: ["タロットカード", "未亡人が伏せて置いた。いつも「塔」だ。"],
    coffin: ["ネオンの棺", "サテン張り。君のサイズ。もう温かい。"],
    jukebox: ["呪いのジュークボックス", "全てのレコードを同時に、逆再生で、静かに鳴らす。"],
    chandelier: ["シャンデリア", "最長の夜の泡ひとつにつき、水晶ひとつ。"],
    stained_glass: ["ステンドグラス", "一枚一枚が、見つけてはいけない秘密。"],
    serpent_statue: ["蛇の像", "あらゆる泡から一度に彫られた。"],
    clock: ["柱時計", "巣が完成した時に止まった。蜘蛛が巻いた。"],
  },
  remarks: [
    "優しく割るのね。泡たちは気づいている。",
    "部屋はすべて私の家。足を拭いて。",
    "泡は誰に捕らえられたか覚えている。",
    "あなたの命を数えた。また数える。",
    "夜明けは私が流した噂。",
    "あなたの使い魔は夜、私の巣で眠る。",
    "集め続けて。私も集めている。",
    "次の部屋が耳を澄ませている。",
  ],
};

const HI: CabinetCopy = {
  ...EN,
  title: "विधवा का संग्रह",
  sections: { items: "वस्तुएँ", familiars: "साथी", bubbles: "बुलबुले", records: "रिकॉर्ड", editions: "संस्करण", chambers: "कक्ष", achievements: "उपलब्धियाँ", memorabilia: "वर्जित स्मृतियाँ", wardrobe: "पोशाक", reset: "रीसेट" },
  sectionsShort: { items: "वस्तु", familiars: "साथी", bubbles: "बुलबुला", records: "रिकॉर्ड", editions: "संस्क.", chambers: "कक्ष", achievements: "उपल.", memorabilia: "स्मृति", wardrobe: "पोशाक", reset: "रीसेट" },
  collected: pct => `${pct}% संग्रहित`,
  hint: "← → चुनें · जंप / ↑ / Q E खंड · बबल उपयोग · ESC बंद",
  close: "विधवा का संग्रह बंद करें",
  open: "विधवा का संग्रह खोलें",
  openShort: "✦ संग्रह",
  locked: "बंद", unlocked: "खुला",
  equip: "बबल · पहनें", equipped: "पहना हुआ", unequip: "बबल · उतारें",
  apply: "बबल · लागू करें", applied: "लागू",
  play: "बबल · चुनें", playing: "चुना हुआ",
  cleared: "पूर्ण", unexplored: "अनदेखा",
  secretFound: "रहस्य मिला", secretHidden: "रहस्य छिपा",
  bestTime: s => `सर्वश्रेष्ठ ${s} से.`,
  reward: name => `इनाम · ${name}`,
  needVinyls: n => `${n} शापित रिकॉर्ड चाहिए`,
  ammoTitle: "गोला-बारूद", personalityTitle: "स्वभाव", notMet: "अभी नहीं मिले",
  achievementToast: "उपलब्धि",
  resetTitle: "संग्रह रीसेट करें",
  resetBody: [
    "वस्तुएँ, साथी, उपलब्धियाँ, पोशाक, खोजें,",
    "स्मृतियाँ और जीवित कैबिनेट मिट जाएँगे।",
    "स्कोर, सर्वश्रेष्ठ समय, कथा-अंश, हीरो स्तर",
    "और स्किन बने रहेंगे। यह वापस नहीं होगा।",
  ],
  resetPress: "शुरू करने के लिए बबल दबाएँ",
  resetConfirm: "मिटाने के लिए फिर बबल · जंप से रद्द",
  resetDone: "संग्रह धूल हो गया",
  secretTitle: "गुप्त द्वार",
  secretBody: "शीशे के पीछे एक द्वार जो कभी बना ही नहीं। वह हमेशा खुला था।",
  secretButton: "फ्रेम में एक चमक",
  remarkBy: "— विधवा",
  skip: "जंप · छोड़ें",
  approves: "विधवा प्रसन्न है",
  none: "कुछ नहीं",
  stat: {
    pops: n => `${n} फँसे बुलबुले फोड़ें`,
    bestChain: n => `${n} की चेन फोड़ें`,
    chambers: n => `${n} अलग कक्ष पूरे करें`,
    perfects: n => `बिना चोट ${n} कक्ष पूरे करें`,
    secrets: n => `${n} कक्ष रहस्य खोजें`,
    items: n => `${n} अलग वस्तुएँ खोजें`,
    vinyls: n => `${n} शापित रिकॉर्ड रखें`,
    ammoFired: n => `${n} विशेष बुलबुले दागें`,
    ammoKinds: n => `${n} तरह के विशेष बुलबुले दागें`,
    personalities: n => `${n} बुलबुला-स्वभाव से मिलें`,
    familiars: n => n === 1 ? "एक साथी से दोस्ती करें" : `${n} साथियों से दोस्ती करें`,
    assists: n => `साथी से ${n} बार मदद पाएँ`,
    naps: () => "अपने साथी को सोने दें",
    widowRemarks: n => `विधवा को ${n} बार बोलते सुनें`,
    titleSecret: () => "शीर्षक फ्रेम में छिपी चीज़ खोजें",
    dressed: () => "पोशाक में से कुछ पहनें",
    venomSpelled: () => "V·E·N·O·M पूरा करें",
    deaths: () => "एक बार गिरें",
    web: () => "मकड़ियों को जाला पूरा करने दें",
  },
  achievements: {
    first_pop: "पहला फोड़", chain_reaction: "चेन रिएक्शन", heartbreaker: "दिल तोड़ने वाला", opening_night: "पहली रात",
    chamber_crawler: "कक्ष यात्री", last_call: "आख़िरी पुकार", untouchable: "अछूता", flawless_five: "बेदाग़ पाँच",
    secret_keeper: "रहस्य रक्षक", collector: "संग्रहकर्ता", completionist: "पूर्ण संग्रह", cursed_ears: "शापित कान",
    living_ammo: "जीवित गोला", mad_scientist: "पागल वैज्ञानिक", personality_test: "स्वभाव परीक्षा", familiar_face: "जाना-पहचाना चेहरा",
    menagerie: "चिड़ियाघर", helping_paw: "मददगार पंजा", night_owl: "रात का उल्लू", widows_audience: "विधवा की सभा",
    curiosity: "जिज्ञासा", venom_ascension: "विष उत्थान", dressed_to_hex: "जादुई सजधज",
  },
  wardrobe: { none: "सादा", cat_ears: "हेक्स बिल्ली कान", veil: "शोक का घूँघट", halo: "स्थिर प्रभामंडल", crown: "टूटे दिल का मुकुट", aura_venom: "विष आभा", aura_crimson: "लाल आभा", wings: "मखमली पंख" },
  memorabilia: {
    secret_door: ["गुप्त द्वार", "जिस पल तुमने ढूँढना छोड़ा, वह खुल गया।"],
    tarot: ["टैरो कार्ड", "विधवा ने इसे उल्टा रखा। हमेशा मीनार ही निकलती है।"],
    coffin: ["नियॉन ताबूत", "साटन की परत। तुम्हारा नाप। पहले से गर्म।"],
    jukebox: ["शापित ज्यूकबॉक्स", "सारे रिकॉर्ड एक साथ, उल्टे, बहुत धीरे बजाता है।"],
    chandelier: ["झाड़फ़ानूस", "तुम्हारी सबसे लंबी रात के हर बुलबुले का एक क्रिस्टल।"],
    stained_glass: ["रंगीन काँच", "हर शीशा एक रहस्य है जो तुम्हें नहीं मिलना था।"],
    serpent_statue: ["नाग प्रतिमा", "हर तरह के बुलबुले से एक साथ तराशी गई।"],
    clock: ["दादाजी घड़ी", "जाला पूरा होते ही रुक गई। मकड़ियों ने चाबी दी।"],
  },
  remarks: [
    "तुम उन्हें कितनी कोमलता से फोड़ते हो। उन्होंने देखा।",
    "हर कक्ष मेरे घर का एक कमरा है। पैर पोंछ लो।",
    "बुलबुले याद रखते हैं कि किसने उन्हें फँसाया।",
    "मैंने तुम्हारी जानें गिनीं। फिर गिनूँगी।",
    "भोर एक अफ़वाह है जो मैंने फैलाई।",
    "तुम्हारा नन्हा साथी रात को मेरे जाले में सोता है।",
    "इकट्ठा करते रहो। मैं भी कर रही हूँ।",
    "अगला कक्ष सुन रहा है।",
  ],
};

export const CABINET_COPY: Record<Lang, CabinetCopy> = { en: EN, ja: JA, hi: HI } as Record<Lang, CabinetCopy>;
export const cabinetCopy = (lang: Lang | string | undefined): CabinetCopy => (CABINET_COPY as Record<string, CabinetCopy>)[lang ?? "en"] ?? EN;

/* ------------------------------------------------ lore-name back-fill (ja / hi) */

type NameTable = Record<string, string>;
const LORE_JA: NameTable = {
  poison_apple: "毒リンゴ", widow_cherries: "未亡人のさくらんぼ", forbidden_perfume: "禁断の香水", broken_heart: "砕けたハート",
  serpent_ring: "蛇の指輪", widow_key: "未亡人の鍵", dead_rose: "枯れたバラ", cursed_vinyl: "呪いのレコード",
  black_pearl: "黒真珠", golden_fang: "黄金の牙", widow_eye: "未亡人の瞳", stolen_minute: "盗まれた一分",
  deadly_kiss: "死の口づけ", wicked_clover: "邪悪なクローバー", midnight_moth: "真夜中の蛾", vanity_mirror: "虚栄の鏡",
  "ammo:venom": "毒バブル", "ammo:thunder": "雷バブル", "ammo:frost": "氷バブル", "ammo:mirror": "鏡バブル",
  "ammo:inferno": "業火バブル", "ammo:gravity": "重力バブル", "ammo:phantom": "幻影バブル", "ammo:time": "時のバブル",
  "ammo:recursive": "再帰バブル", "ammo:widow": "未亡人バブル", "ammo:klein": "クラインバブル",
  "p:coward": "臆病者", "p:glutton": "大食い", "p:lover": "恋人", "p:parasite": "寄生者", "p:mimic": "ものまね",
  "p:jester": "道化", "p:sleeper": "眠り屋", "p:mother": "母", "p:vampire": "吸血鬼", "p:ouroboros": "ウロボロス", "p:impostor": "偽者",
  hex_cat: "ヘックス・キャット", blue_snake: "ブルー・$ネーク", nevermore: "ネヴァーモア", boo: "ブー", velvet: "ヴェルヴェット", vamp: "ヴァンプ",
};
const LORE_HI: NameTable = {
  poison_apple: "ज़हरीला सेब", widow_cherries: "विधवा की चेरी", forbidden_perfume: "वर्जित इत्र", broken_heart: "टूटा दिल",
  serpent_ring: "नाग अंगूठी", widow_key: "विधवा की चाबी", dead_rose: "मुरझाया गुलाब", cursed_vinyl: "शापित रिकॉर्ड",
  black_pearl: "काला मोती", golden_fang: "सुनहरा नुकीला दाँत", widow_eye: "विधवा की आँख", stolen_minute: "चुराया हुआ मिनट",
  deadly_kiss: "घातक चुंबन", wicked_clover: "दुष्ट तिपतिया", midnight_moth: "आधी रात का पतंगा", vanity_mirror: "श्रृंगार दर्पण",
  "ammo:venom": "विष बुलबुला", "ammo:thunder": "वज्र बुलबुला", "ammo:frost": "हिम बुलबुला", "ammo:mirror": "दर्पण बुलबुला",
  "ammo:inferno": "ज्वाला बुलबुला", "ammo:gravity": "गुरुत्व बुलबुला", "ammo:phantom": "प्रेत बुलबुला", "ammo:time": "समय बुलबुला",
  "ammo:recursive": "पुनरावर्ती बुलबुला", "ammo:widow": "विधवा बुलबुला", "ammo:klein": "क्लाइन बुलबुला",
  "p:coward": "डरपोक", "p:glutton": "पेटू", "p:lover": "प्रेमी", "p:parasite": "परजीवी", "p:mimic": "नक़लची",
  "p:jester": "विदूषक", "p:sleeper": "निद्रालु", "p:mother": "माँ", "p:vampire": "वैम्पायर", "p:ouroboros": "उरोबोरोस", "p:impostor": "बहुरूपिया",
  hex_cat: "हेक्स बिल्ली", blue_snake: "ब्लू $नेक", nevermore: "नेवरमोर", boo: "बू", velvet: "वेलवेट", vamp: "वैम्प",
};
const LORE: Record<string, NameTable> = { ja: LORE_JA, hi: LORE_HI };

/** Localised lore name: `key` is an item id, familiar id, "ammo:<type>" or "p:<personality>". */
export function loreName(lang: Lang | string | undefined, key: string, english: string): string {
  return (lang && LORE[lang]?.[key]) || english;
}
