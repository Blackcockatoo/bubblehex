import type { EnemyKind, EnemyVariant } from "./levels";

export const ENEMY_VARIANTS:Record<EnemyKind,readonly EnemyVariant[]> = {
  love:["normal","paired","excited"],
  bat:["tracker","feint","roost"],
  eye:["aimed","sweep","shy"],
  witch:["ranged","orbit","chorus"],
  doll:["charge","windup","frayed"],
  skull:["pursuit","anchor","briar"],
};

export const DEFAULT_VARIANT:Record<EnemyKind,EnemyVariant> = {
  love:"normal",bat:"tracker",eye:"aimed",witch:"ranged",doll:"charge",skull:"pursuit",
};

export type VariantCue = "idle" | "warning" | "attack" | "recovery" | "closed";

export function normalizeEnemyVariant(kind:EnemyKind,variant:EnemyVariant|undefined):EnemyVariant {
  return variant&&ENEMY_VARIANTS[kind].includes(variant)?variant:DEFAULT_VARIANT[kind];
}

export function variantCue(kind:EnemyKind,variant:EnemyVariant,timer:number,playerDistance=999):VariantCue {
  const t=Math.max(0,timer);
  if(kind==="bat"&&variant==="roost")return playerDistance<250?"attack":"closed";
  if(kind==="bat"&&variant==="feint"){
    const phase=t%4.2;return phase>2.25&&phase<2.85?"warning":phase>=2.85&&phase<3.35?"attack":"recovery";
  }
  if(kind==="eye"&&variant==="sweep"){
    const phase=t%4;return phase>2.4&&phase<3.05?"warning":phase>=3.05&&phase<3.35?"attack":"idle";
  }
  if(kind==="eye"&&variant==="shy"&&playerDistance<115)return"closed";
  if(kind==="witch"&&variant==="orbit"){
    const phase=t%3.2;return phase>1.7&&phase<2.55?"warning":phase>=2.55&&phase<2.8?"attack":"idle";
  }
  if(kind==="doll"&&(variant==="windup"||variant==="frayed")){
    const phase=t%3.8;return phase>2.25&&phase<3.15?"warning":phase>=3.15&&phase<3.55?"attack":"recovery";
  }
  if(kind==="skull"&&variant==="briar"){
    const phase=t%2.6;return phase>1.8&&phase<2.25?"warning":phase>=2.25?"attack":"idle";
  }
  return"idle";
}

export function variantThreatValue(kind:EnemyKind,variant:EnemyVariant):number {
  const base:Record<EnemyKind,number>={love:1,bat:2,eye:2,witch:3,doll:2,skull:3};
  return base[kind]+(variant===DEFAULT_VARIANT[kind]?0:1);
}

export function variantLabel(variant:EnemyVariant):string {
  return variant.toUpperCase().replace(/([A-Z])([A-Z][a-z])/g,"$1 $2");
}
