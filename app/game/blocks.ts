import type { WorldId } from "./content";

export type BlockMotif = "rivets" | "grate" | "brass" | "tuft" | "prism" | "vine" | "wax" | "thorn" | "void" | "heart" | "gold";

export type PlatformBlockDefinition = {
  id:string;
  name:string;
  worldId:WorldId;
  base:string;
  side:string;
  top:string;
  edge:string;
  highlight:string;
  shadow:string;
  tileWidth:number;
  motif:BlockMotif;
};

const block=(definition:PlatformBlockDefinition)=>definition;

export const BLOCK_CATALOG = {
  "drain-pipe":block({id:"drain-pipe",name:"Pressure Pipe",worldId:"velvet-drain",base:"#0A2141",side:"#061326",top:"#1596FF",edge:"#65C7FF",highlight:"#BDE8FF",shadow:"#020814",tileWidth:30,motif:"rivets"}),
  "drain-grate":block({id:"drain-grate",name:"Velvet Grate",worldId:"velvet-drain",base:"#101A34",side:"#070C1D",top:"#087CFF",edge:"#FF2A9D",highlight:"#8EC5FF",shadow:"#02030A",tileWidth:24,motif:"grate"}),
  "hotel-brass":block({id:"hotel-brass",name:"Room Brass",worldId:"heartbreak-hotel",base:"#3A1833",side:"#1B0A1B",top:"#FF2A9D",edge:"#FFD36A",highlight:"#FFE4A3",shadow:"#09030A",tileWidth:34,motif:"brass"}),
  "hotel-tuft":block({id:"hotel-tuft",name:"Heart Tuft",worldId:"heartbreak-hotel",base:"#35112D",side:"#180817",top:"#C4133D",edge:"#FF72BC",highlight:"#FFD6F1",shadow:"#080208",tileWidth:28,motif:"tuft"}),
  "garden-prism":block({id:"garden-prism",name:"Serpent Prism",worldId:"jade-garden",base:"#0A3A32",side:"#041D18",top:"#20C98B",edge:"#87FFD1",highlight:"#D3FFEF",shadow:"#020D0A",tileWidth:32,motif:"prism"}),
  "garden-vine":block({id:"garden-vine",name:"Fang Root",worldId:"jade-garden",base:"#123126",side:"#071710",top:"#20C98B",edge:"#756CFF",highlight:"#9BFFD9",shadow:"#020A07",tileWidth:38,motif:"vine"}),
  "chapel-wax":block({id:"chapel-wax",name:"Votive Wax",worldId:"crimson-chapel",base:"#4A1522",side:"#210811",top:"#C4133D",edge:"#FFD36A",highlight:"#FFE6A8",shadow:"#0C0205",tileWidth:26,motif:"wax"}),
  "chapel-thorn":block({id:"chapel-thorn",name:"Vow Thorn",worldId:"crimson-chapel",base:"#2F111E",side:"#15070D",top:"#FF315F",edge:"#B59AAB",highlight:"#FFD6F1",shadow:"#080207",tileWidth:36,motif:"thorn"}),
  "void-grid":block({id:"void-grid",name:"Event Grid",worldId:"black-bubble",base:"#17142F",side:"#080713",top:"#756CFF",edge:"#20C98B",highlight:"#D8D4FF",shadow:"#020206",tileWidth:30,motif:"void"}),
  "void-heart":block({id:"void-heart",name:"Black Heart",worldId:"black-bubble",base:"#250E26",side:"#0C050E",top:"#C4133D",edge:"#756CFF",highlight:"#FFD6F1",shadow:"#020103",tileWidth:34,motif:"heart"}),
  "vault-gold":block({id:"vault-gold",name:"Dirty Gold",worldId:"velvet-drain",base:"#4A3510",side:"#201606",top:"#FFD36A",edge:"#FFF1B8",highlight:"#FFFFFF",shadow:"#0D0902",tileWidth:28,motif:"gold"}),
} as const;

export type BlockId = keyof typeof BLOCK_CATALOG;

export const WORLD_BLOCKS:Record<WorldId,readonly BlockId[]> = {
  "velvet-drain":["drain-pipe","drain-grate"],
  "heartbreak-hotel":["hotel-brass","hotel-tuft"],
  "jade-garden":["garden-prism","garden-vine"],
  "crimson-chapel":["chapel-wax","chapel-thorn"],
  "black-bubble":["void-grid","void-heart"],
};

export function blockForPlatform(worldId:WorldId,index:number,isFloor=false,bonus=false):PlatformBlockDefinition {
  if(bonus)return BLOCK_CATALOG["vault-gold"];
  const choices=WORLD_BLOCKS[worldId];
  return BLOCK_CATALOG[choices[isFloor?0:Math.abs(index)%choices.length]];
}
