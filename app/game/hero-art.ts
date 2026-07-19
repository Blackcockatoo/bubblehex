import type { HeroId, SkinDefinition } from "./content";

export type HeroPose = "idle" | "run" | "jump" | "fall" | "throw" | "hurt";
export type HeroMotion = {
  facing?:1|-1;      // 1 = right, -1 = left
  pose?:HeroPose;
  runPhase?:number;  // radians, advanced by ground speed
  throwT?:number;    // 1 just fired → 0 settled
  squash?:number;    // >0 landing squash, <0 airborne stretch
  speed?:number;     // 0..1 of max run speed
  ghost?:boolean;    // invulnerability flicker frame
};
export type HeroArtOptions = { hero:HeroId; skin:SkinDefinition; x:number; y:number; scale:number; time:number } & HeroMotion;

const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));

function heart(c:CanvasRenderingContext2D,x:number,y:number,size:number,color:string){
  c.fillStyle=color;c.beginPath();c.moveTo(x,y+size*.8);c.bezierCurveTo(x-size*1.2,y,x-size*.7,y-size*.8,x,y-size*.25);c.bezierCurveTo(x+size*.7,y-size*.8,x+size*1.2,y,x,y+size*.8);c.fill();
}

function spark(c:CanvasRenderingContext2D,x:number,y:number,r:number,color:string){
  c.fillStyle=color;c.beginPath();c.moveTo(x,y-r);c.quadraticCurveTo(x,y,x+r,y);c.quadraticCurveTo(x,y,x,y+r);c.quadraticCurveTo(x,y,x-r,y);c.quadraticCurveTo(x,y,x,y-r);c.fill();
}

// The sisters are serpent-born: a slithering tail carries them instead of legs.
// Art is authored facing right with the tail trailing behind (-x); the whole rig
// mirrors with `facing` and answers to pose, run phase, squash and throw recoil.
export function drawHeroArt(c:CanvasRenderingContext2D,o:HeroArtOptions){
  const {hero,skin,x,y,scale,time}=o;
  const facing=o.facing??1,pose=o.pose??"idle",run=o.runPhase??0,throwT=clamp(o.throwT??0,0,1),speed=clamp(o.speed??0,0,1);
  const squash=clamp(o.squash??0,-.4,.6);
  const accent=skin.accent,secondary=skin.secondary,glass=skin.bubble;
  const dark=hero==="vesper"?"#130B18":"#081A3A",outline="#03040A",shine="#FFD6F1";
  const air=pose==="jump"||pose==="fall",hurt=pose==="hurt";
  const bob=pose==="run"?-Math.abs(Math.sin(run))*2.6:pose==="idle"?Math.sin(time*2.6)*1.3:0;

  c.save();c.translate(x,y+bob);c.scale(scale,scale);c.scale(facing,1);c.lineJoin="round";c.lineCap="round";
  if(o.ghost)c.globalAlpha*=.35;
  // squash & stretch anchored at the feet line
  c.translate(0,24);c.scale(1+squash*.22,1-squash*.2);c.translate(0,-24);
  const lean=hurt?Math.sin(time*22)*.06:pose==="run"?.1+speed*.1:pose==="jump"?-.09:pose==="fall"?.07:0;
  c.rotate(lean+throwT*.09);

  // ---- tail (drawn behind everything) ----
  const wave=pose==="run"?Math.sin(run):Math.sin(time*2.4);
  let mid:[number,number],tip:[number,number];
  if(pose==="jump"){mid=[-8,20];tip=[-20,30]}
  else if(pose==="fall"){mid=[-14,12];tip=[-26,-2]}
  else if(hurt){mid=[-10,20+Math.sin(time*26)*3];tip=[-22,10+Math.sin(time*31)*5]}
  else if(pose==="run"){mid=[-12,18+wave*4];tip=[-27,12+Math.sin(run+2.1)*7]}
  else{mid=[-11,21];tip=[-23,9+wave*2]}
  c.strokeStyle=outline;c.lineWidth=12;c.beginPath();c.moveTo(4,10);c.bezierCurveTo(-2,20,mid[0],mid[1],tip[0],tip[1]);c.stroke();
  c.strokeStyle=accent;c.lineWidth=7;c.stroke();
  c.strokeStyle=glass;c.globalAlpha*=.6;c.lineWidth=2.5;c.beginPath();c.moveTo(2,12);c.quadraticCurveTo(mid[0],mid[1]-3,tip[0]+3,tip[1]);c.stroke();c.globalAlpha=o.ghost?.35:1;
  c.fillStyle=secondary;c.beginPath();c.moveTo(tip[0]+2,tip[1]);c.lineTo(tip[0]-8,tip[1]-8);c.lineTo(tip[0]-10,tip[1]+6);c.closePath();c.fill();

  // ---- back arm ----
  let bh:[number,number];
  if(throwT>0)bh=[-10-throwT*3,-2];
  else if(pose==="run")bh=[-7+Math.cos(run+Math.PI)*8,3+Math.sin(run+Math.PI)*3];
  else if(pose==="jump")bh=[-13,-15];
  else if(pose==="fall")bh=[-16,-9];
  else if(hurt)bh=[-15,-12+Math.sin(time*24)*2];
  else bh=[-11,4+Math.sin(time*2.6)*.8];
  c.strokeStyle=outline;c.lineWidth=8;c.beginPath();c.moveTo(-7,-6);c.lineTo(bh[0],bh[1]);c.stroke();
  c.strokeStyle=accent;c.lineWidth=4.5;c.stroke();c.fillStyle=shine;c.fillRect(bh[0]-3,bh[1]-2,6,5);

  // ---- torso / dress ----
  c.fillStyle=outline;c.beginPath();c.moveTo(-12,-11);c.lineTo(12,-11);c.lineTo(16,13);c.lineTo(-15,13);c.closePath();c.fill();
  c.fillStyle=dark;c.beginPath();c.moveTo(-9,-9);c.lineTo(9,-9);c.lineTo(13,11);c.lineTo(-12,11);c.closePath();c.fill();
  c.strokeStyle=accent;c.lineWidth=2.5;c.stroke();
  c.fillStyle=secondary;c.beginPath();c.moveTo(-7,-6);c.lineTo(2,-1);c.lineTo(9,-7);c.lineTo(6,8);c.lineTo(-6,8);c.closePath();c.fill();
  c.strokeStyle=shine;c.globalAlpha*=.6;c.lineWidth=2;c.beginPath();c.moveTo(-8,10);c.lineTo(9,10);c.stroke();c.globalAlpha=o.ghost?.35:1;
  if(hero==="vesper"){heart(c,1,3,4.5,shine);heart(c,1,3,2.6,accent)}
  else{c.fillStyle=shine;c.beginPath();c.moveTo(1,-1);c.lineTo(4,4);c.lineTo(-2,4);c.closePath();c.fill()}

  // ---- head ----
  const hx=2,hy=-21;
  c.fillStyle=outline;c.beginPath();c.arc(hx,hy,15,0,Math.PI*2);c.fill();
  c.fillStyle=dark;c.beginPath();c.arc(hx,hy,12.5,0,Math.PI*2);c.fill();c.strokeStyle=accent;c.lineWidth=2.5;c.stroke();

  // hair / crest streams back with speed and in the air
  const drift=-(speed*4+(air?4:0))+Math.sin(time*9)*(pose==="run"?1.5:.6);
  if(hero==="vesper"){
    c.fillStyle=accent;c.beginPath();c.moveTo(hx-11,hy-6);
    c.lineTo(hx-9+drift*.4,hy-18);c.lineTo(hx-4,hy-10);c.lineTo(hx+drift*.7,hy-21);c.lineTo(hx+4,hy-10);c.lineTo(hx+8+drift,hy-17);c.lineTo(hx+10,hy-5);c.closePath();c.fill();
    c.strokeStyle=accent;c.lineWidth=3;c.beginPath();c.moveTo(hx-11,hy-2);c.quadraticCurveTo(hx-18+drift,hy+4+wave,hx-16+drift*1.4,hy+12+wave*2);c.stroke();
  }else{
    c.fillStyle=secondary;c.strokeStyle=outline;c.lineWidth=2;
    c.beginPath();c.moveTo(hx-9,hy-8);c.lineTo(hx-19,hy-2);c.lineTo(hx-9,hy+3);c.closePath();c.fill();c.stroke();
    c.beginPath();c.moveTo(hx+9,hy-8);c.lineTo(hx+17,hy-3);c.lineTo(hx+9,hy+2);c.closePath();c.fill();c.stroke();
    c.strokeStyle=secondary;c.lineWidth=3;
    c.beginPath();c.moveTo(hx-6,hy-11);c.quadraticCurveTo(hx-16+drift,hy-4+wave*1.5,hx-15+drift*1.6,hy+9+wave*2.5);c.stroke();
    c.beginPath();c.moveTo(hx+2,hy-13);c.quadraticCurveTo(hx-8+drift,hy-14+wave,hx-13+drift*1.3,hy-4+wave*2);c.stroke();
    c.strokeStyle="#B9FFF0";c.lineWidth=1.5;c.beginPath();c.moveTo(hx-14,hy-1);c.lineTo(hx-10,hy-4);c.stroke();
  }

  // ---- face ----
  if(hurt){
    c.strokeStyle=shine;c.lineWidth=2;
    for(const ex of[hx-6,hx+4]){c.beginPath();c.moveTo(ex,hy-4);c.lineTo(ex+4,hy);c.moveTo(ex+4,hy-4);c.lineTo(ex,hy);c.stroke()}
    c.beginPath();c.moveTo(hx-4,hy+7);c.quadraticCurveTo(hx-1,hy+5,hx+1,hy+7);c.quadraticCurveTo(hx+3,hy+9,hx+5,hy+7);c.stroke();
  }else{
    const look=pose==="run"||air?2:1;
    c.fillStyle=shine;c.fillRect(hx-7,hy-5,6,7);c.fillRect(hx+3,hy-5,6,7);
    c.fillStyle=secondary;c.fillRect(hx-5+look,hy-3,2.5,3.5);c.fillRect(hx+5+look,hy-3,2.5,3.5);
    c.strokeStyle=outline;c.lineWidth=2;c.beginPath();c.moveTo(hx-8,hy-7);c.lineTo(hx-2,hy-6);c.moveTo(hx+3,hy-6);c.lineTo(hx+9,hy-7);c.stroke();
    c.fillStyle="#FF72BC";c.globalAlpha*=.6;c.fillRect(hx-9,hy+3,3,2);c.fillRect(hx+7,hy+3,3,2);c.globalAlpha=o.ghost?.35:1;
    if(throwT>.3){c.fillStyle=outline;c.beginPath();c.arc(hx+2,hy+6,2.2,0,Math.PI*2);c.fill()}
    else{c.strokeStyle="#FF72BC";c.lineWidth=1.5;c.beginPath();c.moveTo(hx,hy+6);c.quadraticCurveTo(hx+2,hy+7.5,hx+4,hy+6);c.stroke()}
  }

  // ---- front arm (over the head so throws read clearly) ----
  let fh:[number,number];
  if(throwT>0){const ext=Math.sin(throwT*Math.PI*.5);fh=[8+14*ext,-5+2*(1-ext)]}
  else if(pose==="run")fh=[8+Math.cos(run)*9,3+Math.sin(run)*3.5];
  else if(pose==="jump")fh=[14,-17];
  else if(pose==="fall")fh=[17,-9];
  else if(hurt)fh=[16,-12+Math.sin(time*24+2)*2];
  else fh=[11,4+Math.sin(time*2.6+1)*.8];
  c.strokeStyle=outline;c.lineWidth=8;c.beginPath();c.moveTo(7,-6);c.lineTo(fh[0],fh[1]);c.stroke();
  c.strokeStyle=accent;c.lineWidth=4.5;c.stroke();c.fillStyle=shine;c.fillRect(fh[0]-3,fh[1]-2,6,5);
  if(throwT>.45){c.globalAlpha*=.55+throwT*.45;spark(c,fh[0]+6,fh[1]+1,4+throwT*3,glass);spark(c,fh[0]+6,fh[1]+1,2,shine);c.globalAlpha=o.ghost?.35:1}

  // unlockable looks carry gold stitching
  if(skin.unlock!=="default"){c.strokeStyle="#FFD36A";c.lineWidth=1.5;c.strokeRect(-7,0,4,4);c.strokeRect(4,6,4,4);c.beginPath();c.moveTo(-9,12);c.lineTo(10,14);c.stroke()}
  c.restore();
}
