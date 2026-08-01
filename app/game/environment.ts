import type {
  ContractGate,
  Level,
  Platform,
  Rect,
  ThornHazard,
  Valve,
} from "./levels";

export type EnvironmentState = {
  time: number;
  valveModes: Record<string,"normal"|"reversed"|"stopped">;
  revealedPlatforms: Set<string>;
  vineTimers: Map<string,number>;
  openedBlooms: Set<string>;
  candleStep: number;
  litCandles: Set<string>;
  openGates: Set<string>;
  mechanicMastery: boolean;
};

export type ChainEnvironmentResult = {
  score: number;
  opened: string[];
  message?: string;
};

export function createEnvironmentState(level: Level): EnvironmentState {
  const valveModes:EnvironmentState["valveModes"]={};
  for(const valve of level.environment?.valves ?? [])valveModes[valve.id]="normal";
  return {
    time:0,
    valveModes,
    revealedPlatforms:new Set(),
    vineTimers:new Map(),
    openedBlooms:new Set(),
    candleStep:0,
    litCandles:new Set(),
    openGates:new Set(),
    mechanicMastery:false,
  };
}

export function tickEnvironment(state:EnvironmentState,dt:number):void {
  state.time+=dt;
  for(const [id,remaining] of state.vineTimers){
    const next=remaining-dt;
    if(next<=0)state.vineTimers.delete(id);else state.vineTimers.set(id,next);
  }
}

export function pointInRect(x:number,y:number,rect:Rect):boolean {
  return x>=rect.x&&x<=rect.x+rect.w&&y>=rect.y&&y<=rect.y+rect.h;
}

export function bodyIntersectsRect(body:{x:number;y:number;w:number;h:number},rect:Rect):boolean {
  return body.x<rect.x+rect.w&&body.x+body.w>rect.x&&body.y<rect.y+rect.h&&body.y+body.h>rect.y;
}

function oscillation(time:number,period:number,phase=0):number {
  return .5-.5*Math.cos(((time/period+phase)%1)*Math.PI*2);
}

const interpolatePlatform=(a:Platform,b:Platform,t:number):Platform=>({
  x:a.x+(b.x-a.x)*t,
  y:a.y+(b.y-a.y)*t,
  w:a.w+(b.w-a.w)*t,
  h:a.h+(b.h-a.h)*t,
});

export function activePlatforms(level:Level,state:EnvironmentState):Platform[] {
  const platforms=[...level.platforms];
  for(const lift of level.environment?.lifts ?? []){
    const t=oscillation(state.time,lift.period,lift.phase);
    platforms.push({...lift.platform,y:lift.platform.y+(lift.toY-lift.platform.y)*t});
  }
  for(const wax of level.environment?.waxPlatforms ?? []){
    const t=oscillation(state.time,wax.period);
    platforms.push({...wax.platform,y:wax.platform.y+wax.sinkDistance*t});
  }
  for(const phase of level.environment?.phasePlatforms ?? []){
    const t=oscillation(state.time,phase.period,phase.phase);
    // Hold close to each endpoint, then make the transition readable but brief.
    const stepped=t<.35?0:t>.65?1:(t-.35)/.3;
    platforms.push(interpolatePlatform(phase.a,phase.b,stepped));
  }
  for(const reveal of level.environment?.revealPlatforms ?? [])if(state.revealedPlatforms.has(reveal.id))platforms.push(reveal.platform);
  for(const vine of level.environment?.vines ?? [])if(state.vineTimers.has(vine.id))platforms.push(vine.platform);
  return platforms;
}

export function previewPlatforms(level:Level):Platform[] {
  const previews:Platform[]=[];
  for(const phase of level.environment?.phasePlatforms ?? [])previews.push(phase.a,phase.b);
  for(const reveal of level.environment?.revealPlatforms ?? [])previews.push(reveal.platform);
  for(const vine of level.environment?.vines ?? [])previews.push(vine.platform);
  return previews;
}

export function currentAt(level:Level,state:EnvironmentState,x:number,y:number):{x:number;y:number} {
  let result={...level.current};
  for(const zone of level.environment?.currents ?? []){
    if(!pointInRect(x,y,zone))continue;
    const mode=zone.valveId?state.valveModes[zone.valveId]??"normal":"normal";
    if(mode==="stopped")return{x:0,y:0};
    const direction=mode==="reversed"?-1:1;
    result={x:zone.vector.x*direction,y:zone.vector.y*direction};
  }
  return result;
}

export function bubbleLiftAt(level:Level,x:number,y:number):number {
  let lift=0;
  for(const pool of level.environment?.moonPools ?? [])if(pointInRect(x,y,pool))lift+=pool.bubbleLift;
  for(const zone of level.environment?.gravityZones ?? [])if(pointInRect(x,y,zone))lift+=zone.bubbleLift;
  return lift;
}

export function gravityScaleAt(level:Level,x:number,y:number):number {
  for(const zone of level.environment?.gravityZones ?? [])if(pointInRect(x,y,zone))return zone.gravityScale;
  return 1;
}

export function toggleValve(state:EnvironmentState,valve:Valve):"normal"|"reversed"|"stopped" {
  const current=state.valveModes[valve.id]??"normal";
  const next=valve.mode==="reverse"
    ?(current==="normal"?"reversed":"normal")
    :(current==="normal"?"stopped":"normal");
  state.valveModes[valve.id]=next;
  return next;
}

export function revealMirrors(level:Level,state:EnvironmentState,x:number,y:number):string[] {
  const opened:string[]=[];
  for(const reveal of level.environment?.revealPlatforms ?? [])if(!state.revealedPlatforms.has(reveal.id)&&pointInRect(x,y,reveal.mirror)){
    state.revealedPlatforms.add(reveal.id);opened.push(reveal.id);
  }
  return opened;
}

export function touchCandle(level:Level,state:EnvironmentState,x:number,y:number):boolean {
  const candle=(level.environment?.candles ?? []).find(item=>item.order===state.candleStep+1&&Math.hypot(item.x-x,item.y-y)<36);
  if(!candle)return false;
  state.candleStep=candle.order;state.litCandles.add(candle.id);
  const total=level.environment?.candles?.length??0;
  if(total>0&&state.candleStep>=total)state.mechanicMastery=true;
  return true;
}

function gateSatisfied(gate:ContractGate,kinds:readonly string[]):boolean {
  const available=[...kinds];
  return gate.requiredKinds.every(kind=>{
    const index=available.indexOf(kind);
    if(index<0)return false;
    available.splice(index,1);return true;
  });
}

export function applyChainToEnvironment(level:Level,state:EnvironmentState,chainSize:number,kinds:readonly string[]):ChainEnvironmentResult {
  let score=0;const opened:string[]=[];
  for(const vine of level.environment?.vines ?? [])if(chainSize>=vine.requiredChain){
    state.vineTimers.set(vine.id,vine.activeSeconds);opened.push(vine.id);
  }
  for(const bloom of level.environment?.blooms ?? [])if(chainSize>=bloom.requiredChain&&!state.openedBlooms.has(bloom.id)){
    state.openedBlooms.add(bloom.id);score+=bloom.value;opened.push(bloom.id);
  }
  for(const gate of level.environment?.contractGates ?? [])if(!state.openGates.has(gate.id)&&gateSatisfied(gate,kinds)){
    state.openGates.add(gate.id);score+=1200;opened.push(gate.id);
  }
  const blooms=level.environment?.blooms?.length??0;
  const gates=level.environment?.contractGates?.length??0;
  if((!blooms||state.openedBlooms.size>=blooms)&&(!gates||state.openGates.size>=gates)&&(state.candleStep>=Math.max(0,(level.environment?.candles?.length??0)-1)))state.mechanicMastery=true;
  return {score,opened,message:opened.length?`MEMORY MECHANIC ×${opened.length}`:undefined};
}

export function thornState(hazard:ThornHazard,time:number):"idle"|"warning"|"active" {
  const local=((time/hazard.period+(hazard.phase??0))%1)*hazard.period;
  const start=Math.max(0,hazard.period-hazard.warningSeconds-hazard.activeSeconds);
  if(local<start)return"idle";
  if(local<start+hazard.warningSeconds)return"warning";
  return"active";
}

export function closedGates(level:Level,state:EnvironmentState):ContractGate[] {
  return (level.environment?.contractGates??[]).filter(gate=>!state.openGates.has(gate.id));
}

export function environmentSecretReady(level:Level,state:EnvironmentState):boolean {
  if(level.secret!=="mechanicMastery")return false;
  return state.mechanicMastery;
}
