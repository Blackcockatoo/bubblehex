export type HeroId = "vesper" | "jade";
export type EnemyId = "love" | "bat" | "eye" | "witch" | "doll" | "skull";
export type WorldId = "velvet-drain" | "heartbreak-hotel" | "jade-garden" | "crimson-chapel" | "black-bubble";
export type CharacterId = HeroId | EnemyId | "widow";

export type CharacterProfile = {
  id: CharacterId;
  name: string;
  epithet: string;
  role: string;
  history: string;
  desire: string;
  need: string;
  fear: string;
  flaw: string;
  secret: string;
  relationships: string[];
  voice: string[];
  silhouette: string;
  materials: string[];
  palette: string[];
  motifs: string[];
  animation: string;
  gameplay: string;
  canonLocks: string[];
};

export type WorldProfile = {
  id: WorldId;
  name: string;
  purpose: string;
  storyBeat: string;
  palette: string[];
  materials: string[];
  motifs: string[];
};

export type StoryFragment = {
  id: string;
  order: number;
  title: string;
  worldId: WorldId;
  text: string;
  truth: string;
};

export type SkinDefinition = {
  id: string;
  heroId: HeroId;
  name: string;
  lore: string;
  accent: string;
  secondary: string;
  bubble: string;
  unlock: "default" | "clear-velvet-drain";
};

export type CodexEntry = {
  id: string;
  category: "profile" | "world" | "fragment" | "skin";
  title: string;
  subtitle: string;
  body: string;
  unlockId: string;
};

export type ArtAsset = {
  id: string;
  src: string;
  width: number;
  height: number;
  smoothing: boolean;
};

export type ArtManifest = Record<string, ArtAsset>;

export const HEROES: HeroId[] = ["vesper", "jade"];
export const ENEMIES: EnemyId[] = ["love", "bat", "eye", "witch", "doll", "skull"];
export const WORLDS: WorldId[] = ["velvet-drain", "heartbreak-hotel", "jade-garden", "crimson-chapel", "black-bubble"];

export const CHARACTER_PROFILES: Record<CharacterId, CharacterProfile> = {
  vesper: {
    id: "vesper", name: "Vesper", epithet: "Crimson Thorn", role: "Elder sister, showrunner, and keeper of the club's stage flame.",
    history: "Vesper built Bubble Hex to give nocturnal outsiders a room that could never turn them away. On opening night she accepted the Widow's patronage rather than admit the club was failing.",
    desire: "Break the contract and force the night to release her sister.", need: "Accept that protection without trust becomes control.",
    fear: "Being abandoned after everyone discovers she cannot hold the show together.", flaw: "She makes decisions for people when she is frightened.",
    secret: "She read the price before signing and convinced herself she could outsmart it.",
    relationships: ["Loves Jade fiercely but mistakes command for care.", "Treats the Widow as a rival impresario while fearing her approval."],
    voice: ["Short theatrical declarations.", "Jokes at danger, apologises without decoration.", "Never calls Jade weak."],
    silhouette: "Angular thorn crown, sharp shoulders, heart charm, and a tightly coiled serpent tail.",
    materials: ["black velvet", "crimson lacquer", "tarnished silver"], palette: ["#C4133D", "#FF2A9D", "#130B18", "#FFD6F1"],
    motifs: ["thorns", "stage sparks", "broken hearts"], animation: "Fast angular anticipations, hard stops, proud upright poses.",
    gameplay: "Her shared bubble magic isolates emotional echoes so they can be released safely.",
    canonLocks: ["Adult serpent-born woman.", "Not cruel; her harm comes from fearful control.", "Never uses a conventional weapon."],
  },
  jade: {
    id: "jade", name: "Jade", epithet: "Glass Tide", role: "Younger sister, illusionist, and secret archivist of Bubble Hex.",
    history: "Jade designed the club's mirrored rooms and stored every promise made inside them. She tore the Widow's contract to protect Vesper, but fled before explaining what she had seen.",
    desire: "Restore the stolen memories and expose the true wording of the bargain.", need: "Stay present when truth creates conflict.",
    fear: "Becoming another elegant manipulator who decides what others deserve to know.", flaw: "She withholds, vanishes, and calls it protection.",
    secret: "She hid the VENOM master key inside the Jade Garden before the club shattered.",
    relationships: ["Misses Vesper's certainty and resents being managed by it.", "Understands the Widow's methods well enough to fear resemblance."],
    voice: ["Precise images and dry observations.", "Pauses before emotional truths.", "Never lies outright."],
    silhouette: "Veil-like fins, glass-fang jewellery, open sleeves, and a long tidal serpent tail.",
    materials: ["stained glass", "jade silk", "pearl silver"], palette: ["#20C98B", "#087CFF", "#081A3A", "#FFD6F1"],
    motifs: ["tides", "mirrors", "mist"], animation: "Flowing follow-through, circular gestures, weightless recoveries.",
    gameplay: "Her version of the sisters' hex reads the memory released by every chain-pop.",
    canonLocks: ["Adult serpent-born woman.", "Her quietness is deliberate, not fragility.", "Never becomes the Widow's willing heir."],
  },
  widow: {
    id: "widow", name: "The Widow", epithet: "Last Patron", role: "Ageless impresario and beneficiary of the broken opening-night vow.",
    history: "The Widow travels between unfinished venues, offering success that never reaches morning. Bubble Hex is her finest engine because its founders still love the person they blame.",
    desire: "Keep the sisters estranged so the Black Bubble can sustain an eternal opening night.", need: "She has rejected any need not expressible as ownership.",
    fear: "A sincere apology freely accepted.", flaw: "She cannot understand love that survives disappointment.",
    secret: "She staged the sisters' final argument by showing each a different final clause.",
    relationships: ["Flatters Vesper's ambition.", "Treats Jade's perception as a threat.", "Regards every guest as an audience and every apology as lost revenue."],
    voice: ["Warm hospitality with predatory precision.", "Never shouts.", "Calls danger a privilege and blame a keepsake."],
    silhouette: "Cracked heart torso, tarnished crown, spider couture, and a veil that suggests too many limbs.",
    materials: ["black lacquer", "cracked porcelain", "old silver"], palette: ["#050509", "#C4133D", "#B8A7A8", "#FF2A9D"],
    motifs: ["contracts", "spider legs", "cracked hearts"], animation: "Unnaturally smooth glides interrupted by single-frame predatory snaps.",
    gameplay: "She arrives when time expires and is expelled when the final bound emotions sustaining her are released.",
    canonLocks: ["Never sympathetic by accident.", "Never physically gory.", "Her power always depends on consent distorted by incomplete truth."],
  },
  love: echoProfile("love", "Heartling", "Gnawing Crush", "A discarded crush taught to patrol in circles.", "toothy heart", "restless bouncing", "Patrols platforms and turns at their edges."),
  bat: echoProfile("bat", "Velvet Bat", "Rumour Wing", "A whispered rumour that learned to hunt attention.", "wide velvet wings", "fluttering feints", "Tracks nearby heroes through the air."),
  eye: echoProfile("eye", "Mourning Eye", "Bottled Tear", "A tear held so long it began watching everyone else cry.", "floating glass eye", "slow lid-like pulses", "Fires aimed blue tears from a fixed hover."),
  witch: echoProfile("witch", "Star Witch", "Failed Ovation", "An abandoned performance still demanding its final applause.", "triangular hat and star body", "sharp stage bows", "Keeps distance and throws neon stars."),
  doll: echoProfile("doll", "Stitch Doll", "Forgotten Guest", "A guest-list name crossed out until it stitched itself a body.", "round stitched head", "wind-up tremors", "Waits, then charges in a straight line."),
  skull: echoProfile("skull", "Thorn Skull", "Broken Vow", "A promise stripped to the stubborn bone of its wording.", "horned skull wrapped in briars", "heavy springing coils", "Pursues quickly and leaps between platforms."),
};

function echoProfile(id: EnemyId, name: string, epithet: string, history: string, silhouette: string, animation: string, gameplay: string): CharacterProfile {
  return {
    id, name, epithet, role: "Emotional echo bound to a chamber of the broken club.", history,
    desire: "Repeat the feeling that formed it.", need: "Be isolated, understood, and released.", fear: "Silence without witness.", flaw: "It can only express one emotion.",
    secret: "It is not a living victim; popping its bubble frees the memory instead of killing it.",
    relationships: ["Serves the Black Bubble involuntarily.", "Recognises both sisters as fragments of the same promise."],
    voice: ["No spoken dialogue.", "Communicates through a unique musical sting and silhouette."], silhouette,
    materials: ["emotional glass", "neon velvet"], palette: ["#FF2A9D", "#087CFF", "#FFD6F1"], motifs: [epithet.toLowerCase()], animation, gameplay,
    canonLocks: ["Never a living person.", "Always readable without colour alone.", "Release is restorative, not lethal."],
  };
}

export const WORLD_PROFILES: Record<WorldId, WorldProfile> = {
  "velvet-drain": { id:"velvet-drain", name:"VELVET DRAIN", purpose:"The club's disposal system, carrying away memories judged too embarrassing to keep.", storyBeat:"The sisters rediscover the dream they shared before blame.", palette:["#050509","#081A3A","#087CFF","#FF2A9D"], materials:["wet velvet","blue pipework","heart glass"], motifs:["drains","letters","pressure gauges"] },
  "heartbreak-hotel": { id:"heartbreak-hotel", name:"HEARTBREAK HOTEL", purpose:"The Widow's welcoming front and archive of flattering half-truths.", storyBeat:"The bargain and its deliberately divided clauses are reconstructed.", palette:["#050509","#FF2A9D","#C4133D"], materials:["mirrored tile","hotel brass","faded carpet"], motifs:["room 13","lifts","teeth in mirrors"] },
  "jade-garden": { id:"jade-garden", name:"JADE GARDEN", purpose:"A living memory vault grown by the sisters' ancestral hex.", storyBeat:"Jade's concealment of the master key becomes confession rather than accusation.", palette:["#06140F","#20C98B","#756CFF"], materials:["poison roses","serpent glass","mist"], motifs:["fang leaves","moon pools","black roses"] },
  "crimson-chapel": { id:"crimson-chapel", name:"CRIMSON CHAPEL", purpose:"The contract foundry where promises are made architectural.", storyBeat:"The sisters see how the Widow made their blame feed the vow.", palette:["#190711","#C4133D","#FFD36F"], materials:["wax","thorn iron","red stained glass"], motifs:["thirteen candles","vow ribbons","serpent windows"] },
  "black-bubble": { id:"black-bubble", name:"THE BLACK BUBBLE", purpose:"The collapsed heart of Bubble Hex, holding the shared vow outside time.", storyBeat:"Truth, apology, and reconciliation collapse the Widow's claim.", palette:["#050509","#756CFF","#C4133D","#20C98B"], materials:["void glass","memory foam","broken neon"], motifs:["event horizons","impossible grids","a heart at dawn"] },
};

const fragmentData: Array<[string, WorldId, string, string, string]> = [
  ["blueprint","velvet-drain","A Room for the Night","The first blueprint shows two signatures beneath one promise: nobody leaves Bubble Hex unseen.","The club was always a shared dream."],
  ["sisters-dream","velvet-drain","Two Keys","Vesper planned the stage. Jade planned the mirrors. Each kept a key shaped like half a fang.","Their opposing gifts were designed to work together."],
  ["widow-invitation","velvet-drain","Compliments of the House","A silver invitation arrived before the doors opened: one perfect night, guaranteed forever.","The Widow approached them before the club failed."],
  ["vesper-signs","heartbreak-hotel","Crimson Signature","Vesper signed because the lights were dying and every guest was already at the door.","Vesper knew there was a price, but not the divided clause."],
  ["jade-tears","heartbreak-hotel","The Torn Clause","Jade saw the words 'until blame is spent' and tore the contract before Vesper could read them.","Jade acted to protect them, then failed to explain."],
  ["memory-split","heartbreak-hotel","Room 108","The tear split the promise, the club, and every shared memory into chambers that blamed one sister at a time.","Their contradictory memories were manufactured."],
  ["venom-inheritance","jade-garden","Five-Letter Fang","VENOM was never a curse. It was the family word for truth held together under pressure.","The collectible letters are an ancestral restoration key."],
  ["jade-key","jade-garden","Buried in Glass","Jade hid the complete key in the garden, afraid Vesper would use it before hearing the whole truth.","Jade's secrecy prolonged the curse even while resisting it."],
  ["staged-fight","crimson-chapel","Two Final Clauses","The Widow showed Vesper a clause naming Jade the betrayer, and Jade a clause naming Vesper the jailer.","The opening-night fight was deliberately staged."],
  ["blame-feeds","crimson-chapel","The Thirteenth Candle","Every accusation relit the contract. Every unspoken apology gave the Widow another night.","Blame—not magic alone—sustains the Black Bubble."],
  ["shared-vow","black-bubble","Inside the Event Horizon","At the centre waits the original promise, still carrying both signatures and neither accusation.","The sisters can reclaim the vow together."],
  ["dawn","black-bubble","Opening at Dawn","The perfect eternal night ends. Bubble Hex opens imperfectly at dawn, with both sisters at the door.","Reconciliation expels the Widow without erasing what happened."],
];

export const STORY_FRAGMENTS: StoryFragment[] = fragmentData.map(([id,worldId,title,text,truth], index)=>({id,worldId,title,text,truth,order:index+1}));

export const SKINS: SkinDefinition[] = [
  { id:"vesper-crimson-thorn", heroId:"vesper", name:"Crimson Thorn", lore:"Vesper's opening-night stage look, sharpened into armour by memory.", accent:"#C4133D", secondary:"#FF2A9D", bubble:"#FF2A9D", unlock:"default" },
  { id:"vesper-velvet-mourning", heroId:"vesper", name:"Velvet Mourning", lore:"A drain-runner echo woven from drowned curtains and silver apologies.", accent:"#756CFF", secondary:"#FF2A9D", bubble:"#9C62FF", unlock:"clear-velvet-drain" },
  { id:"jade-glass-tide", heroId:"jade", name:"Glass Tide", lore:"Jade's original illusionist regalia, made to turn every spotlight into a prism.", accent:"#20C98B", secondary:"#087CFF", bubble:"#20C98B", unlock:"default" },
  { id:"jade-poison-current", heroId:"jade", name:"Poison Current", lore:"A pressure-proof look grown from drainlight, black roses, and electric glass.", accent:"#087CFF", secondary:"#20C98B", bubble:"#087CFF", unlock:"clear-velvet-drain" },
];

export const DEFAULT_SKIN: Record<HeroId,string> = { vesper:"vesper-crimson-thorn", jade:"jade-glass-tide" };

export const ART_MANIFEST: ArtManifest = {
  heroes: { id:"heroes", src:"/game/art/heroes-anchor.png", width:1536, height:1024, smoothing:true },
  roster: { id:"roster", src:"/game/art/roster-anchor.png", width:1536, height:1024, smoothing:true },
  velvetDrain: { id:"velvetDrain", src:"/game/art/velvet-drain-triptych.png", width:2172, height:724, smoothing:true },
  bootLogo: { id:"bootLogo", src:"/game/art/boot-logo.png", width:1672, height:941, smoothing:true },
  // One painted backdrop per remaining chamber/vault; keyed by backgroundId so
  // drawBackground() can look them up directly off the level data.
  "hotel-room-108": { id:"hotel-room-108", src:"/game/art/hotel-room-108.png", width:1200, height:816, smoothing:true },
  "hotel-mirror-teeth": { id:"hotel-mirror-teeth", src:"/game/art/hotel-mirror-teeth.png", width:1200, height:816, smoothing:true },
  "hotel-last-lift": { id:"hotel-last-lift", src:"/game/art/hotel-last-lift.png", width:1200, height:816, smoothing:true },
  "garden-poison-moon": { id:"garden-poison-moon", src:"/game/art/garden-poison-moon.png", width:1200, height:816, smoothing:true },
  "garden-black-roses": { id:"garden-black-roses", src:"/game/art/garden-black-roses.png", width:1200, height:816, smoothing:true },
  "chapel-serpent-glass": { id:"chapel-serpent-glass", src:"/game/art/chapel-serpent-glass.png", width:1200, height:816, smoothing:true },
  "chapel-thirteen-candles": { id:"chapel-thirteen-candles", src:"/game/art/chapel-thirteen-candles.png", width:1200, height:816, smoothing:true },
  "bubble-event-horizon": { id:"bubble-event-horizon", src:"/game/art/bubble-event-horizon.png", width:1200, height:816, smoothing:true },
  "bubble-widow": { id:"bubble-widow", src:"/game/art/bubble-widow.png", width:1200, height:816, smoothing:true },
  "velvet-bonus-vault": { id:"velvet-bonus-vault", src:"/game/art/velvet-bonus-vault.png", width:1200, height:816, smoothing:true },
};

export const CODEX_ENTRIES: CodexEntry[] = [
  ...Object.values(CHARACTER_PROFILES).map(profile=>({id:`profile-${profile.id}`,category:"profile" as const,title:profile.name,subtitle:profile.epithet,body:`${profile.role} ${profile.history}`,unlockId:profile.id})),
  ...Object.values(WORLD_PROFILES).map(world=>({id:`world-${world.id}`,category:"world" as const,title:world.name,subtitle:world.storyBeat,body:world.purpose,unlockId:world.id})),
  ...STORY_FRAGMENTS.map(fragment=>({id:`fragment-${fragment.id}`,category:"fragment" as const,title:`${String(fragment.order).padStart(2,"0")} · ${fragment.title}`,subtitle:WORLD_PROFILES[fragment.worldId].name,body:`${fragment.text} ${fragment.truth}`,unlockId:fragment.id})),
  ...SKINS.map(skin=>({id:`skin-${skin.id}`,category:"skin" as const,title:skin.name,subtitle:CHARACTER_PROFILES[skin.heroId].name,body:skin.lore,unlockId:skin.id})),
];

export function worldIdFromName(name:string):WorldId {
  return (Object.values(WORLD_PROFILES).find(world=>world.name===name)?.id ?? "velvet-drain");
}

export function skinById(id:string):SkinDefinition {
  return SKINS.find(skin=>skin.id===id) ?? SKINS[0];
}
