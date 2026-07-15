import type { WorldId } from "./content";

export type Platform = { x: number; y: number; w: number; h: number };
export type EnemyKind = "love" | "bat" | "eye" | "witch" | "doll" | "skull";
export type EnemySpawn = { x: number; y: number; kind: EnemyKind };

export type Level = {
  name: string; world: string; platforms: Platform[]; enemies: EnemySpawn[];
  current: { x: number; y: number }; time: number; tint: string;
  worldId: WorldId; backgroundId: string; loreFragmentId: string;
  secret: "noFloor" | "trapFirst" | "oneChain" | "widow13"; boss?: boolean; bonus?: boolean; approach?: boolean;
};

const floor: Platform = { x: 24, y: 650, w: 912, h: 32 };
const p = (x: number, y: number, w: number): Platform => ({ x, y, w, h: 18 });
const e = (x: number, y: number, kind: EnemyKind): EnemySpawn => ({ x, y, kind });

export const LEVELS: Level[] = [
  { name: "The First Sip", world: "VELVET DRAIN", worldId:"velvet-drain", backgroundId:"velvet-first-sip", loreFragmentId:"blueprint", tint: "#087CFF", time: 62,
    platforms: [floor,p(90,528,240),p(480,510,240),p(270,382,260),p(650,300,190)],
    enemies: [e(190,492,"love"),e(555,474,"love"),e(380,346,"love")], current:{x:.05,y:-.3}, secret:"trapFirst" },
  { name: "Chain Letter", world: "VELVET DRAIN", worldId:"velvet-drain", backgroundId:"velvet-chain-letter", loreFragmentId:"sisters-dream", tint: "#087CFF", time: 66,
    platforms:[floor,p(80,555,220),p(370,474,220),p(660,555,220),p(170,330,230),p(560,290,230)],
    enemies:[e(150,519,"love"),e(455,438,"love"),e(745,519,"bat"),e(650,254,"love")],current:{x:-.08,y:-.34},secret:"oneChain" },
  { name:"Blue Pressure",world:"VELVET DRAIN",worldId:"velvet-drain",backgroundId:"velvet-blue-pressure",loreFragmentId:"widow-invitation",tint:"#087CFF",time:70,
    platforms:[floor,p(52,478,210),p(340,570,280),p(700,454,210),p(265,320,430),p(72,210,180)],
    enemies:[e(130,442,"love"),e(440,534,"bat"),e(770,418,"love"),e(490,284,"eye")],current:{x:.12,y:-.26},secret:"noFloor" },
  { name:"Room 108",world:"HEARTBREAK HOTEL",worldId:"heartbreak-hotel",backgroundId:"hotel-room-108",loreFragmentId:"vesper-signs",tint:"#FF2A9D",time:72,
    platforms:[floor,p(70,530,250),p(640,530,250),p(360,410,240),p(90,270,230),p(630,245,230)],
    enemies:[e(160,494,"love"),e(720,494,"doll"),e(440,374,"witch"),e(180,234,"bat")],current:{x:-.04,y:-.31},secret:"trapFirst" },
  { name:"Mirror Teeth",world:"HEARTBREAK HOTEL",worldId:"heartbreak-hotel",backgroundId:"hotel-mirror-teeth",loreFragmentId:"jade-tears",tint:"#FF2A9D",time:74,
    platforms:[floor,p(45,580,190),p(275,500,180),p(505,420,180),p(735,340,180),p(505,230,180),p(205,190,190)],
    enemies:[e(105,544,"doll"),e(330,464,"love"),e(560,384,"eye"),e(790,304,"witch"),e(280,154,"bat")],current:{x:.08,y:-.3},secret:"oneChain" },
  { name:"Last Lift",world:"HEARTBREAK HOTEL",worldId:"heartbreak-hotel",backgroundId:"hotel-last-lift",loreFragmentId:"memory-split",tint:"#FF2A9D",time:76,
    platforms:[floor,p(90,490,220),p(375,560,210),p(650,480,220),p(260,330,420),p(70,205,170),p(720,205,170)],
    enemies:[e(170,454,"doll"),e(455,524,"love"),e(730,444,"witch"),e(350,294,"eye"),e(785,169,"bat")],current:{x:-.1,y:-.28},secret:"widow13" },
  { name:"Poison Moon",world:"JADE GARDEN",worldId:"jade-garden",backgroundId:"garden-poison-moon",loreFragmentId:"venom-inheritance",tint:"#20C98B",time:78,
    platforms:[floor,p(70,545,260),p(630,545,260),p(365,430,230),p(95,295,225),p(640,270,225)],
    enemies:[e(150,509,"love"),e(700,509,"doll"),e(440,394,"witch"),e(175,259,"eye"),e(730,234,"bat")],current:{x:.13,y:-.25},secret:"noFloor" },
  { name:"Black Roses",world:"JADE GARDEN",worldId:"jade-garden",backgroundId:"garden-black-roses",loreFragmentId:"jade-key",tint:"#20C98B",time:78,
    platforms:[floor,p(40,470,170),p(250,560,170),p(460,470,170),p(670,560,240),p(210,300,220),p(560,245,230)],
    enemies:[e(95,434,"doll"),e(305,524,"love"),e(515,434,"witch"),e(735,524,"love"),e(285,264,"bat"),e(650,209,"eye")],current:{x:-.12,y:-.32},secret:"oneChain" },
  { name:"Serpent Glass",world:"CRIMSON CHAPEL",worldId:"crimson-chapel",backgroundId:"chapel-serpent-glass",loreFragmentId:"staged-fight",tint:"#C4133D",time:82,
    platforms:[floor,p(55,550,220),p(370,530,220),p(685,550,220),p(185,370,220),p(555,350,220),p(350,205,260)],
    enemies:[e(130,514,"love"),e(445,494,"doll"),e(750,514,"witch"),e(260,334,"eye"),e(630,314,"bat"),e(440,169,"skull")],current:{x:.03,y:-.36},secret:"trapFirst" },
  { name:"Thirteen Candles",world:"CRIMSON CHAPEL",worldId:"crimson-chapel",backgroundId:"chapel-thirteen-candles",loreFragmentId:"blame-feeds",tint:"#C4133D",time:82,
    platforms:[floor,p(35,440,205),p(280,570,190),p(520,440,190),p(755,570,170),p(120,260,240),p(560,235,270)],
    enemies:[e(100,404,"doll"),e(335,534,"skull"),e(575,404,"witch"),e(800,534,"love"),e(200,224,"eye"),e(650,199,"bat")],current:{x:-.13,y:-.29},secret:"widow13" },
  { name:"Event Horizon",world:"THE BLACK BUBBLE",worldId:"black-bubble",backgroundId:"bubble-event-horizon",loreFragmentId:"shared-vow",tint:"#756CFF",time:86,approach:true,
    platforms:[floor,p(60,550,170),p(275,455,180),p(505,550,180),p(735,445,170),p(570,280,210),p(210,245,210)],
    enemies:[e(115,514,"skull"),e(330,419,"witch"),e(560,514,"doll"),e(785,409,"eye"),e(625,244,"bat"),e(270,209,"love")],current:{x:.18,y:-.22},secret:"noFloor" },
  { name:"The Widow Unveiled",world:"THE BLACK BUBBLE",worldId:"black-bubble",backgroundId:"bubble-widow",loreFragmentId:"dawn",tint:"#C4133D",time:108,boss:true,
    platforms:[floor,p(40,525,220),p(370,560,220),p(700,525,220),p(155,340,220),p(585,340,220),p(350,180,260)],
    enemies:[e(140,489,"skull"),e(455,524,"doll"),e(770,489,"skull"),e(230,304,"witch"),e(660,304,"eye"),e(440,144,"bat")],current:{x:0,y:-.38},secret:"oneChain" },
];

// Hidden vault reached only through Original/Extra Mode — a short score-chase
// detour, not one of the twelve canonical chambers. Six clustered Heartlings
// invite one big bubble chain before the timer runs out.
export const BONUS_LEVEL: Level = {
  name:"The Dirty Gold Vault",world:"VELVET DRAIN",worldId:"velvet-drain",backgroundId:"velvet-bonus-vault",loreFragmentId:"bonus-vault",tint:"#FFD36A",time:34,bonus:true,
  platforms:[floor,p(100,560,210),p(650,560,210),p(375,435,210),p(100,315,210),p(650,315,210)],
  enemies:[e(170,524,"love"),e(720,524,"love"),e(420,399,"love"),e(500,399,"love"),e(170,279,"love"),e(720,279,"love")],
  current:{x:0,y:-.15},secret:"oneChain",
};

