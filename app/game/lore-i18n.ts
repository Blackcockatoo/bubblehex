/** Forbidden Expansion M6: ja / hi descriptions for items, ammo and personalities.
 * Keys match cabinet-i18n's loreName (item id, `ammo:<type>`, `p:<personality>`).
 * `{n}` is filled with the first number in the English text so limits stay in one place. */
import type { Lang } from "./i18n";

const JA: Record<string, string> = {
  poison_apple: "ひと口で +500。", widow_cherries: "12秒間、ポップ得点 +50%。", forbidden_perfume: "10秒間、報酬が引き寄せられる。",
  broken_heart: "+1ライフ(最大5)。満タンなら +1000。", serpent_ring: "15秒間、泡が速く長く飛ぶ。", widow_key: "未亡人の部屋への秘密の扉を開く。",
  dead_rose: "4秒間、敵が半分の速さに。", cursed_vinyl: "ジュークボックス用のレコード。逆再生禁止。", black_pearl: "値段がつけられない。+5000。",
  golden_fang: "+750。牙はすべて数えられる。", widow_eye: "6秒間、全ての敵に印をつける。", stolen_minute: "時計に +15秒。",
  deadly_kiss: "3秒間、無敵。", wicked_clover: "20秒間、拡張ドロップが2倍に。", midnight_moth: "この部屋の秘密をささやく。",
  vanity_mirror: "10秒間、泡が鏡写しの分身を撃つ。",
  "ammo:venom": "割ると毒の霧が近くの敵を遅くする。", "ammo:thunder": "割ると最大{n}個の離れた泡へ雷が跳ぶ。",
  "ammo:frost": "獲物を長く捕らえ、割ると周囲の敵を凍らせる。", "ammo:mirror": "背後へ反射した双子を撃つ。",
  "ammo:inferno": "速い弾。割ると周囲を焦がし気絶させる。", "ammo:gravity": "近くの泡を引き寄せ、大きな連鎖に。",
  "ammo:phantom": "横の壁をすり抜けて長く漂う。", "ammo:time": "割ると{n}秒を盗み、全ての敵を遅くする。",
  "ammo:recursive": "割ると2つの追跡泡に分裂(深さ{n})。", "ammo:widow": "広い蜘蛛の巣で捕獲。獲物は長く包まれる。",
  "ammo:klein": "割ると裏返る:ボーナス得点と生まれ変わる泡。",
  "p:coward": "反発:あなたから逃げる。", "p:glutton": "合体:空の泡を飲み込み大きくなる。", "p:lover": "引力:近くの泡へ漂う。",
  "p:parasite": "捕獲泡の横に張り付き連鎖に加わる。", "p:mimic": "変装:近くの特殊泡の弾をまねる。", "p:jester": "予測不能に震える。",
  "p:sleeper": "目覚めるまで静止する。", "p:mother": "分裂:空の泡を最大{n}個生む。", "p:vampire": "空の泡から命を吸い、獲物を長く捕らえる。",
  "p:ouroboros": "生まれた場所を回り続ける。", "p:impostor": "変装:何かを捕らえるまで普通に見える。",
};

const HI: Record<string, string> = {
  poison_apple: "एक कौर। +500।", widow_cherries: "12 से. तक फोड़ने का स्कोर +50%।", forbidden_perfume: "10 से. तक इनाम आपकी ओर खिंचते हैं।",
  broken_heart: "+1 जीवन (अधिकतम 5)। दिल पूरे हों तो +1000।", serpent_ring: "15 से. तक बुलबुले तेज़ और देर तक उड़ते हैं।", widow_key: "विधवा के कक्ष का गुप्त द्वार खोलती है।",
  dead_rose: "4 से. तक दुश्मन आधी गति पर।", cursed_vinyl: "ज्यूकबॉक्स का रिकॉर्ड। उल्टा न बजाएँ।", black_pearl: "अनमोल। +5000।",
  golden_fang: "+750। हर दाँत गिना जाता है।", widow_eye: "6 से. तक हर दुश्मन पर निशान।", stolen_minute: "घड़ी पर +15 सेकंड।",
  deadly_kiss: "3 से. तक अछूत।", wicked_clover: "20 से. तक विस्तार ड्रॉप दोगुने।", midnight_moth: "इस कक्ष का रहस्य फुसफुसाता है।",
  vanity_mirror: "10 से. तक हर बुलबुला दर्पण-प्रतिध्वनि छोड़ता है।",
  "ammo:venom": "फूटने पर विषैला बादल पास के दुश्मनों को धीमा करता है।", "ammo:thunder": "फूटने पर {n} तक दूर के फँसे बुलबुलों में बिजली कूदती है।",
  "ammo:frost": "शिकार को देर तक पकड़ता है; फूटने पर पास के दुश्मन जमते हैं।", "ammo:mirror": "आपके पीछे एक परावर्तित जुड़वाँ छोड़ता है।",
  "ammo:inferno": "तेज़ गोला; फूटने पर पास के दुश्मन झुलसते और रुकते हैं।", "ammo:gravity": "बड़ी चेन के लिए पास के बुलबुले खींचता है।",
  "ammo:phantom": "किनारे की दीवारों से गुज़रकर देर तक तैरता है।", "ammo:time": "फूटने पर {n} से. चुराता है और हर दुश्मन को धीमा करता है।",
  "ammo:recursive": "फूटने पर दो शिकारी बुलबुलों में बँटता है (गहराई {n})।", "ammo:widow": "चौड़ा जाल; शिकार देर तक लिपटा रहता है।",
  "ammo:klein": "फूटने पर अंदर-बाहर: बोनस स्कोर और नया बुलबुला।",
  "p:coward": "दूर भागता है: आपसे कतराता है।", "p:glutton": "विलय: खाली बुलबुले निगलकर बढ़ता है।", "p:lover": "आकर्षण: पास के बुलबुले की ओर बहता है।",
  "p:parasite": "फँसे बुलबुले से चिपककर उसकी चेन में जुड़ता है।", "p:mimic": "भेस: पास के विशेष बुलबुले का गोला अपनाता है।", "p:jester": "अनिश्चित ढंग से काँपता है।",
  "p:sleeper": "जागने तक स्थिर लटका रहता है।", "p:mother": "विभाजन: {n} तक खाली बुलबुले जनता है।", "p:vampire": "खाली बुलबुलों से जीवन चूसकर शिकार को देर तक रखता है।",
  "p:ouroboros": "अपने जन्मस्थान के चारों ओर घूमता है।", "p:impostor": "भेस: कुछ फँसाने तक सामान्य दिखता है।",
};

const TABLE: Partial<Record<Lang, Record<string, string>>> = { ja: JA, hi: HI };
export const LORE_DESCRIPTION_KEYS = Object.keys(JA);

export function loreDesc(lang: unknown, key: string, english: string): string {
  const text = TABLE[lang as Lang]?.[key];
  if (!text) return english;
  const n = english.match(/\d+(?:\.\d+)?/)?.[0] ?? "";
  return text.replace("{n}", n);
}
