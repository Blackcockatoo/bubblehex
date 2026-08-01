export type WidowAct = "host" | "split" | "vow";
export type WidowBossPhase =
  | "entrance"
  | "host"
  | "chase"
  | "telegraph"
  | "lunge"
  | "staggered"
  | "trapped"
  | "vow"
  | "defeated";

export type WidowBossProgress = {
  act: WidowAct;
  phase: WidowBossPhase;
  hp: number;
  maxHp: number;
  chargedAnchors: number;
  vowEchoes: number;
};

export const HOST_ANCHORS = [
  {x:170,y:430,label:"VESPER CLAUSE"},
  {x:790,y:430,label:"JADE CLAUSE"},
] as const;

export const SHARED_VOW_ECHOES = [
  {x:315,y:450},
  {x:400,y:350},
  {x:560,y:350},
  {x:645,y:450},
] as const;

export type VowBubble = {id:number;x:number;y:number;r:number;phase:string};

/**
 * During the Shared Vow, an empty fired bubble that touches a bound echo becomes
 * a stable link. This makes the final release a deliberate placement puzzle
 * without adding a new control or allowing ordinary empty bubbles into chains.
 */
export function findVowBridgeAnchor(
  progress:Pick<WidowBossProgress,"act">,
  bubble:VowBubble,
  bubbles:readonly VowBubble[],
):VowBubble|undefined {
  if(progress.act!=="vow")return undefined;
  return bubbles
    .filter(other=>other.id!==bubble.id&&other.phase==="bound"&&Math.hypot(other.x-bubble.x,other.y-bubble.y)<=other.r+bubble.r+6)
    .sort((a,b)=>Math.hypot(a.x-bubble.x,a.y-bubble.y)-Math.hypot(b.x-bubble.x,b.y-bubble.y))[0];
}

export function createWidowBossProgress(superMode=false):WidowBossProgress {
  void superMode;
  return {act:"host",phase:"entrance",hp:3,maxHp:3,chargedAnchors:0,vowEchoes:0};
}

export function chargeHostAnchor(progress:WidowBossProgress,index:number):WidowBossProgress {
  if(progress.act!=="host"||index<0||index>=HOST_ANCHORS.length)return progress;
  const mask=progress.chargedAnchors|(1<<index);
  return {...progress,chargedAnchors:mask,phase:mask===3?"staggered":"host"};
}

export function hostAnchorsComplete(progress:WidowBossProgress):boolean {
  return (progress.chargedAnchors&3)===3;
}

export function registerVowChain(progress:WidowBossProgress,echoCount:number):WidowBossProgress {
  if(progress.act!=="vow")return progress;
  return {...progress,vowEchoes:Math.max(progress.vowEchoes,echoCount),phase:echoCount>=SHARED_VOW_ECHOES.length?"staggered":"vow"};
}

export function advanceWidowAct(progress:WidowBossProgress):WidowBossProgress {
  if(progress.act==="host")return {...progress,act:"split",phase:"chase",hp:Math.max(2,progress.hp-1),chargedAnchors:3};
  if(progress.act==="split")return {...progress,act:"vow",phase:"vow",hp:1,vowEchoes:0};
  return {...progress,phase:"defeated",hp:0};
}

export function splitClauseCopies(x:number,y:number,time:number):readonly {x:number;y:number;trueCopy:boolean}[] {
  const sway=Math.sin(time*1.7)*34;
  // The centre copy is always true: its contract crack, audio cue and nearby
  // environment response are stable identifiers, so this is never a guess.
  return [
    {x:Math.max(70,960-x),y:Math.min(590,y+55+sway),trueCopy:false},
    {x,y,trueCopy:true},
    {x:Math.min(890,160+x*.55),y:Math.max(120,y-60-sway),trueCopy:false},
  ];
}

export type WidowPhaseCheckpoint = {
  act: WidowAct;
  hp: number;
  score: number;
};

export function makeWidowPhaseCheckpoint(progress:WidowBossProgress,score:number):WidowPhaseCheckpoint {
  return {act:progress.act,hp:progress.hp,score:Math.max(0,Math.floor(score))};
}
