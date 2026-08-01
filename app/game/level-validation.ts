import { STORY_FRAGMENTS, WORLDS } from "./content.ts";
import { CHECKPOINT_INTERVAL, checkpointLevelAfterClear } from "./checkpoints.ts";
import { CANVAS_HEIGHT, CANVAS_WIDTH, PLAYER_HEIGHT, PLAYER_WIDTH } from "./physics.ts";
import { auditLevelReachability } from "./reachability.ts";
import {
  ALL_PLAYABLE_LEVELS,
  BONUS_LEVEL,
  ENCORE_LEVELS,
  LEVELS,
  VALID_BACKGROUND_IDS,
  type EnemyKind,
  type Level,
  type Platform,
} from "./levels.ts";
import { ENEMY_VARIANTS } from "./enemy-grammar.ts";

export type LevelValidationCode =
  | "platform-bounds" | "spawn-bounds" | "spawn-safety" | "spawn-support"
  | "duplicate-geometry" | "unreachable-route" | "secret-invalid" | "world-invalid"
  | "background-invalid" | "lore-invalid" | "flag-invalid" | "timer-invalid"
  | "portal-invalid" | "candle-invalid" | "variant-invalid" | "recovery-invalid";

export type LevelValidationIssue = { level:string; code:LevelValidationCode; detail:string };

const groundKinds=new Set<EnemyKind>(["love","doll","skull"]);
const validSecrets=new Set<Level["secret"]>(["noFloor","trapFirst","oneChain","widow13","mechanicMastery"]);
const enemyHeight=(kind:EnemyKind)=>kind==="bat"?30:38;
const platformInside=(platform:Platform)=>platform.x>=0&&platform.y>=70&&platform.w>0&&platform.h>0&&platform.x+platform.w<=CANVAS_WIDTH&&platform.y+platform.h<=CANVAS_HEIGHT;
const geometryKey=(platform:Platform)=>`${platform.x}:${platform.y}:${platform.w}:${platform.h}`;

function supported(level:Level,x:number,bottom:number):boolean {
  return level.platforms.some(platform=>x>=platform.x-4&&x<=platform.x+platform.w+4&&Math.abs(platform.y-bottom)<=7);
}

export function validateLevel(level:Level):LevelValidationIssue[] {
  const issues:LevelValidationIssue[]=[];
  const add=(code:LevelValidationCode,detail:string)=>issues.push({level:level.name,code,detail});
  level.platforms.forEach((platform,index)=>{if(!platformInside(platform))add("platform-bounds",`platform ${index} is outside the 960x720 playfield`)});
  const seen=new Set<string>();
  level.platforms.forEach((platform,index)=>{const key=geometryKey(platform);if(seen.has(key))add("duplicate-geometry",`platform ${index} exactly overlaps another platform`);seen.add(key)});
  for(let index=0;index<level.platforms.length;index++)for(let other=index+1;other<level.platforms.length;other++){
    const a=level.platforms[index],b=level.platforms[other];
    if(geometryKey(a)===geometryKey(b))continue;
    if(a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y)add("duplicate-geometry",`platforms ${index} and ${other} overlap with invalid solid area`);
  }
  level.enemies.forEach((enemy,index)=>{
    if(enemy.x<24||enemy.x>CANVAS_WIDTH-58||enemy.y<80||enemy.y>CANVAS_HEIGHT-50)add("spawn-bounds",`enemy ${index} is outside playable bounds`);
    if(enemy.variant&&!ENEMY_VARIANTS[enemy.kind].includes(enemy.variant))add("variant-invalid",`${enemy.kind} cannot use ${enemy.variant}`);
    if(groundKinds.has(enemy.kind)&&!supported(level,enemy.x+17,enemy.y+enemyHeight(enemy.kind)))add("spawn-support",`ground enemy ${index} has no authored support`);
  });
  const floor=level.platforms.reduce((best,platform)=>platform.y>best.y?platform:best,level.platforms[0]);
  const spawn={x:55,y:floor.y-PLAYER_HEIGHT,w:PLAYER_WIDTH,h:PLAYER_HEIGHT};
  if(level.enemies.some(enemy=>Math.hypot(enemy.x-(spawn.x+spawn.w/2),enemy.y-(spawn.y+spawn.h/2))<72))add("spawn-safety","an enemy begins inside the safe opening radius");
  const audits=auditLevelReachability(level);
  if(audits.some(audit=>audit.status==="unreachable"))add("unreachable-route",`${audits.filter(audit=>audit.status==="unreachable").length} authored platforms exceed known movement limits`);
  if(!level.platforms.some(platform=>platform.y>=620&&platform.w>=500))add("recovery-invalid","no broad lowest-area recovery path exists");
  if(!WORLDS.includes(level.worldId))add("world-invalid",`unknown world ${level.worldId}`);
  if(!VALID_BACKGROUND_IDS.has(level.backgroundId))add("background-invalid",`unknown background ${level.backgroundId}`);
  if(!level.bonus&&!level.encore&&!STORY_FRAGMENTS.some(fragment=>fragment.id===level.loreFragmentId))add("lore-invalid",`unknown lore fragment ${level.loreFragmentId}`);
  if(level.boss&&level!==LEVELS.at(-1))add("flag-invalid","only the final canonical chamber may be the story boss");
  if(level.bonus&&level!==BONUS_LEVEL)add("flag-invalid","only Dirty Gold Vault may use the bonus flag");
  if(level.encore&&!level.medalTargets)add("flag-invalid","Encore chamber has no medal targets");
  if(!Number.isFinite(level.time)||level.time<20||level.time>140)add("timer-invalid",`timer ${level.time} is outside the supported range`);
  if(!validSecrets.has(level.secret))add("secret-invalid",`unknown secret condition ${String(level.secret)}`);
  if(level.secret==="mechanicMastery"&&!level.encore)add("secret-invalid","mechanic mastery secrets are reserved for optional Encore rooms");
  if(level.secret==="widow13"&&(!level.environment?.ritualTargetSeconds||level.environment.ritualTargetSeconds<13))add("secret-invalid","Widow timing secret has no readable thirteen-second ritual window");
  if(level.secret==="oneChain"&&level.enemies.length<2)add("secret-invalid","full-chain secret requires at least two echoes");
  if(level.secret==="trapFirst"&&level.enemies.length===0)add("secret-invalid","trap-first secret requires at least one echo");
  const doors=level.environment?.mirrorDoors??[];
  for(const door of doors)if(!doors.some(candidate=>candidate.id===door.pairId&&candidate.pairId===door.id))add("portal-invalid",`mirror ${door.id} has no reciprocal previewed exit`);
  const candleOrders=(level.environment?.candles??[]).map(candle=>candle.order).sort((a,b)=>a-b);
  if(candleOrders.some((order,index)=>order!==index+1))add("candle-invalid","candle order must be consecutive and readable from 1");
  return issues;
}

export function validateCampaign():LevelValidationIssue[] {
  const issues=ALL_PLAYABLE_LEVELS.flatMap(validateLevel);
  if(LEVELS.length!==12)issues.push({level:"campaign",code:"flag-invalid",detail:"canonical campaign must contain exactly twelve chambers"});
  if(ENCORE_LEVELS.length!==WORLDS.length)issues.push({level:"campaign",code:"flag-invalid",detail:"one Encore chamber is required per world"});
  for(let index=0;index<LEVELS.length-1;index++){
    const checkpoint=checkpointLevelAfterClear(index,LEVELS.length);
    if(checkpoint!==null&&checkpoint%(CHECKPOINT_INTERVAL)!==0)issues.push({level:LEVELS[index].name,code:"flag-invalid",detail:"checkpoint is incompatible with canonical order"});
  }
  return issues;
}
