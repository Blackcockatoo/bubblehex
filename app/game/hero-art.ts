import type { HeroId, SkinDefinition } from "./content";

export type HeroArtOptions = { hero:HeroId; skin:SkinDefinition; x:number; y:number; scale:number; time:number };

function heart(c:CanvasRenderingContext2D,x:number,y:number,size:number,color:string){
  c.fillStyle=color;c.beginPath();c.moveTo(x,y+size*.8);c.bezierCurveTo(x-size*1.2,y,x-size*.7,y-size*.8,x,y-size*.25);c.bezierCurveTo(x+size*.7,y-size*.8,x+size*1.2,y,x,y+size*.8);c.fill();
}

export function drawHeroArt(c:CanvasRenderingContext2D,{hero,skin,x,y,scale,time}:HeroArtOptions){
  const accent=skin.accent,secondary=skin.secondary,dark=hero==="vesper"?"#130B18":"#081A3A";
  c.save();c.translate(x,y+Math.sin(time*8)*.7);c.scale(scale,scale);

  c.strokeStyle=accent;c.lineWidth=5;c.lineCap="square";
  c.beginPath();c.moveTo(4,10);c.bezierCurveTo(36,18,39,39,18,44);c.bezierCurveTo(2,53,-6,43,6,35);c.stroke();
  c.fillStyle=dark;c.beginPath();c.ellipse(0,7,15,23,-.08,0,Math.PI*2);c.fill();c.strokeStyle=accent;c.lineWidth=2;c.stroke();
  c.fillStyle=dark;c.beginPath();c.arc(0,-13,15,0,Math.PI*2);c.fill();c.stroke();
  c.fillStyle="#FFD6F1";c.fillRect(-8,-16,5,4);c.fillRect(4,-16,5,4);
  c.fillStyle=secondary;c.fillRect(-6,-15,2,2);c.fillRect(5,-15,2,2);
  c.fillStyle=accent;c.beginPath();c.moveTo(-10,-25);c.lineTo(-5,-38);c.lineTo(0,-25);c.moveTo(5,-25);c.lineTo(11,-37);c.lineTo(13,-22);c.fill();

  if(hero==="jade"){
    c.beginPath();c.moveTo(-13,-16);c.lineTo(-25,-8);c.lineTo(-13,-3);c.moveTo(13,-16);c.lineTo(25,-8);c.lineTo(13,-3);c.fill();
  }else{
    heart(c,21,42,6,accent);
  }

  if(skin.unlock!=="default"){c.strokeStyle=secondary;c.lineWidth=2;c.strokeRect(-10,0,6,6);c.strokeRect(5,10,6,6);c.beginPath();c.moveTo(-12,22);c.lineTo(12,28);c.stroke()}
  c.restore();
}
