import type { HeroId, SkinDefinition } from "./content";

export type HeroArtOptions = { hero:HeroId; skin:SkinDefinition; x:number; y:number; scale:number; time:number };

function heart(c:CanvasRenderingContext2D,x:number,y:number,size:number,color:string){
  c.fillStyle=color;c.beginPath();c.moveTo(x,y+size*.8);c.bezierCurveTo(x-size*1.2,y,x-size*.7,y-size*.8,x,y-size*.25);c.bezierCurveTo(x+size*.7,y-size*.8,x+size*1.2,y,x,y+size*.8);c.fill();
}

export function drawHeroArt(c:CanvasRenderingContext2D,{hero,skin,x,y,scale,time}:HeroArtOptions){
  const accent=skin.accent,secondary=skin.secondary,dark=hero==="vesper"?"#130B18":"#081A3A",outline="#03040A";
  c.save();c.translate(x,y+Math.sin(time*8)*.8);c.scale(scale,scale);c.lineJoin="round";c.lineCap="round";

  c.strokeStyle=outline;c.lineWidth=23;c.beginPath();c.moveTo(4,14);c.bezierCurveTo(39,18,43,43,20,49);c.bezierCurveTo(-2,56,-14,45,4,35);c.stroke();
  c.strokeStyle=accent;c.lineWidth=16;c.stroke();c.strokeStyle=skin.bubble;c.globalAlpha=.72;c.lineWidth=4;c.beginPath();c.moveTo(8,18);c.bezierCurveTo(32,22,34,39,18,43);c.stroke();c.globalAlpha=1;
  c.fillStyle=secondary;c.beginPath();c.moveTo(23,45);c.lineTo(38,39);c.lineTo(30,52);c.closePath();c.fill();

  c.fillStyle=outline;c.beginPath();c.moveTo(-20,-2);c.lineTo(-11,-16);c.lineTo(0,-10);c.lineTo(12,-17);c.lineTo(21,0);c.lineTo(13,25);c.lineTo(-13,25);c.closePath();c.fill();
  c.fillStyle=dark;c.beginPath();c.moveTo(-16,0);c.lineTo(-9,-12);c.lineTo(0,-7);c.lineTo(10,-13);c.lineTo(17,1);c.lineTo(11,23);c.lineTo(-11,23);c.closePath();c.fill();
  c.strokeStyle=accent;c.lineWidth=3;c.stroke();c.fillStyle=secondary;c.beginPath();c.moveTo(-13,1);c.lineTo(0,8);c.lineTo(13,0);c.lineTo(8,16);c.lineTo(-8,16);c.closePath();c.fill();
  c.strokeStyle="#FFD6F1";c.globalAlpha=.65;c.lineWidth=2;c.beginPath();c.moveTo(-8,18);c.lineTo(8,18);c.stroke();c.globalAlpha=1;

  c.strokeStyle=outline;c.lineWidth=8;c.beginPath();c.moveTo(-13,4);c.lineTo(-23,15);c.moveTo(13,4);c.lineTo(23,15);c.stroke();
  c.strokeStyle=accent;c.lineWidth=4;c.stroke();c.fillStyle="#FFD6F1";c.fillRect(-26,13,6,5);c.fillRect(20,13,6,5);

  c.fillStyle=outline;c.beginPath();c.arc(0,-20,19,0,Math.PI*2);c.fill();c.fillStyle=dark;c.beginPath();c.arc(0,-20,16,0,Math.PI*2);c.fill();c.strokeStyle=accent;c.lineWidth=3;c.stroke();
  c.fillStyle=accent;c.beginPath();c.moveTo(-15,-25);c.quadraticCurveTo(-7,-42,0,-34);c.quadraticCurveTo(9,-43,16,-24);c.lineTo(10,-31);c.lineTo(5,-26);c.lineTo(0,-34);c.lineTo(-5,-26);c.lineTo(-11,-31);c.closePath();c.fill();
  c.fillStyle="#FFD6F1";c.fillRect(-10,-22,7,6);c.fillRect(3,-22,7,6);c.fillStyle=secondary;c.fillRect(-7,-20,3,3);c.fillRect(4,-20,3,3);
  c.strokeStyle=outline;c.lineWidth=2;c.beginPath();c.moveTo(-11,-25);c.lineTo(-3,-24);c.moveTo(3,-24);c.lineTo(11,-25);c.stroke();c.fillStyle="#FF72BC";c.fillRect(-2,-12,4,2);

  if(hero==="jade"){
    c.fillStyle=secondary;c.strokeStyle=outline;c.lineWidth=2;c.beginPath();c.moveTo(-14,-24);c.lineTo(-29,-13);c.lineTo(-16,-7);c.closePath();c.fill();c.stroke();c.beginPath();c.moveTo(14,-24);c.lineTo(29,-13);c.lineTo(16,-7);c.closePath();c.fill();c.stroke();
    c.strokeStyle="#B9FFF0";c.lineWidth=2;c.beginPath();c.moveTo(-22,-14);c.lineTo(-16,-18);c.moveTo(22,-14);c.lineTo(16,-18);c.stroke();
  }else{
    heart(c,18,25,7,"#FFD6F1");heart(c,18,25,4,secondary);c.strokeStyle=secondary;c.lineWidth=2;c.beginPath();c.moveTo(-14,-5);c.lineTo(-24,0);c.lineTo(-17,6);c.moveTo(14,-5);c.lineTo(24,0);c.lineTo(17,6);c.stroke();
  }

  if(skin.unlock!=="default"){c.strokeStyle="#FFD36A";c.lineWidth=2;c.strokeRect(-9,1,5,5);c.strokeRect(5,10,5,5);c.beginPath();c.moveTo(-11,21);c.lineTo(11,26);c.stroke()}
  c.restore();
}
