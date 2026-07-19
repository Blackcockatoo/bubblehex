/* eslint-disable @typescript-eslint/no-explicit-any */
import { checkpointLevelAfterClear, type RuntimeCheckpoint } from "./checkpoints";
import { LEVELS } from "./levels";

const INSTALL_KEY=Symbol.for("bubblehex.runtime-upgrades.v2");
const checkpoints=new WeakMap<object,RuntimeCheckpoint>();

type EngineConstructor={prototype:object};
type AnyEngine=Record<PropertyKey,any>;

function snapshot(engine:AnyEngine,levelIndex:number):RuntimeCheckpoint {
  return {
    levelIndex,
    hero:engine.hero,
    score:Math.max(0,Math.floor(engine.score??0)),
    venom:[...(engine.venom??new Set<string>())],
    upgrades:{...engine.upgrades},
  };
}

function restoreCheckpoint(engine:AnyEngine,checkpoint:RuntimeCheckpoint){
  engine.hero=checkpoint.hero;
  engine.selected=checkpoint.hero;
  engine.score=checkpoint.score;
  engine.lives=3;
  engine.venom=new Set(checkpoint.venom);
  engine.upgrades={...checkpoint.upgrades};
  engine.levelIndex=checkpoint.levelIndex;
  engine.loadLevel(checkpoint.levelIndex);
  engine.message=`CHECKPOINT RESTORED · STAGE ${checkpoint.levelIndex+1} · 3 LIVES`;
  engine.messageLife=3;
  engine.audio?.secret?.();
  engine.setState("stageIntro");
}

function drawHighContrastProjectile(engine:AnyEngine,p:{x:number;y:number;vx:number;vy:number;kind:"tear"|"star"}){
  const c=engine.ctx as CanvasRenderingContext2D;
  const angle=Math.atan2(p.vy,p.vx);
  const reduced=!!engine.settings?.reducedMotion;
  const pulse=reduced?1:1+Math.sin(performance.now()/70)*.12;
  const neon=p.kind==="tear"?"#56E7FF":"#FFD36A";
  const edge=p.kind==="tear"?"#087CFF":"#FF2A9D";
  const tail=22,tx=p.x-Math.cos(angle)*tail,ty=p.y-Math.sin(angle)*tail;

  c.save();
  c.lineCap="round";
  c.strokeStyle="rgba(0,0,0,.96)";
  c.lineWidth=14;
  c.beginPath();c.moveTo(tx,ty);c.lineTo(p.x,p.y);c.stroke();
  c.strokeStyle="#FFFFFF";
  c.globalAlpha=.9;
  c.lineWidth=8;
  c.beginPath();c.moveTo(tx,ty);c.lineTo(p.x,p.y);c.stroke();
  c.strokeStyle=neon;
  c.globalAlpha=1;
  c.lineWidth=4;
  c.shadowBlur=18;
  c.shadowColor=neon;
  c.beginPath();c.moveTo(tx,ty);c.lineTo(p.x,p.y);c.stroke();
  c.translate(p.x,p.y);
  c.rotate(angle+(p.kind==="star"&&!reduced?performance.now()/180:0));
  c.scale(pulse,pulse);
  c.fillStyle=neon;
  c.strokeStyle="rgba(0,0,0,.98)";
  c.lineWidth=5;

  if(p.kind==="tear"){
    c.beginPath();
    c.moveTo(12,0);
    c.quadraticCurveTo(-1,-10,-10,0);
    c.quadraticCurveTo(-1,10,12,0);
    c.closePath();
    c.fill();c.stroke();
    c.strokeStyle=edge;c.lineWidth=3;c.stroke();
    c.strokeStyle="#FFFFFF";c.lineWidth=1.5;c.stroke();
    c.fillStyle="#FFFFFF";c.beginPath();c.arc(3,-2,3,0,Math.PI*2);c.fill();
  }else{
    c.beginPath();
    for(let i=0;i<16;i++){
      const r=i%2===0?12:5,a=i*Math.PI/8;
      if(i===0)c.moveTo(Math.cos(a)*r,Math.sin(a)*r);
      else c.lineTo(Math.cos(a)*r,Math.sin(a)*r);
    }
    c.closePath();
    c.fill();c.stroke();
    c.strokeStyle=edge;c.lineWidth=3;c.stroke();
    c.strokeStyle="#FFFFFF";c.lineWidth=1.5;c.stroke();
    c.fillStyle="#FFFFFF";c.beginPath();c.arc(0,0,3.5,0,Math.PI*2);c.fill();
  }

  c.shadowBlur=0;
  c.restore();
}

export function installBubbleHexRuntimeUpgrades(EngineClass:EngineConstructor){
  const proto=EngineClass.prototype as AnyEngine;
  if(proto[INSTALL_KEY])return;
  Object.defineProperty(proto,INSTALL_KEY,{value:true,configurable:false});

  const originalClearStage=proto.clearStage;
  proto.clearStage=function(this:AnyEngine,demo:boolean){
    originalClearStage.call(this,demo);
    if(demo)return;
    const resumeLevel=checkpointLevelAfterClear(this.levelIndex,LEVELS.length,!!this.inBonus);
    if(resumeLevel===null)return;
    checkpoints.set(this,snapshot(this,resumeLevel));
    this.message=`CHECKPOINT SAVED · STAGE ${resumeLevel+1} · 3 LIVES ON RESTART`;
    this.messageLife=3;
    this.audio?.recordSting?.();
  };

  const originalAfterDeath=proto.afterDeath;
  proto.afterDeath=function(this:AnyEngine){
    const checkpoint=checkpoints.get(this);
    if((this.lives??0)<=0&&checkpoint){restoreCheckpoint(this,checkpoint);return}
    return originalAfterDeath.call(this);
  };

  const originalBeginRun=proto.beginRun;
  proto.beginRun=function(this:AnyEngine){
    checkpoints.delete(this);
    return originalBeginRun.call(this);
  };

  const originalSyncAuditData=proto.syncAuditData;
  proto.syncAuditData=function(this:AnyEngine){
    originalSyncAuditData.call(this);
    const checkpoint=checkpoints.get(this);
    if(this.canvas?.dataset)this.canvas.dataset.checkpointStage=checkpoint?String(checkpoint.levelIndex+1):"";
  };

  const originalDrawHud=proto.drawHud;
  proto.drawHud=function(this:AnyEngine){
    originalDrawHud.call(this);
    const checkpoint=checkpoints.get(this);
    if(checkpoint)this.label(`CP STAGE ${checkpoint.levelIndex+1}`,190,53,9,"#FFD36A","center");
  };

  // Preserve the newest pose-driven hero animation and replace only projectile rendering.
  proto.drawProjectile=function(this:AnyEngine,p:any){drawHighContrastProjectile(this,p)};
}
