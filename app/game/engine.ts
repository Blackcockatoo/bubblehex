import { LEVELS, BONUS_LEVEL, type EnemyKind, type Level } from "./levels";
import { CheatReader, nextTitleStartGrace, type Token } from "./cheats";
import {
  AIR_ACCELERATION,
  AIR_DECELERATION,
  CANVAS_HEIGHT as H,
  CANVAS_WIDTH as W,
  COYOTE_TIME,
  DOUBLE_JUMP_VELOCITY,
  GRAVITY,
  GROUND_ACCELERATION,
  GROUND_DECELERATION,
  JUMP_BUFFER_TIME,
  JUMP_VELOCITY,
  MAX_FRAME_DELTA,
  MAX_JUMPS,
  MAX_RUN_SPEED,
  PLAYER_HEIGHT,
  PLAYER_WIDTH,
  POWER_RUN_SPEED,
  TARGET_JUMP_HEIGHT,
} from "./physics";
import { auditLevelReachability, type PlatformAudit } from "./reachability";
import { GameArtAssets } from "./assets";
import { AudioManager } from "./audio";
import {
  CHARACTER_PROFILES,
  CODEX_ENTRIES,
  DEFAULT_SKIN,
  SKINS,
  STORY_FRAGMENTS,
  skinById,
  type HeroId,
  type SkinDefinition,
} from "./content";
import { DEFAULT_SETTINGS, migrateSettings, type PersistedSettings } from "./persistence";
import { computeStageBreakdown, isNewCampaignRecord, isNewStageRecord } from "./scoring";
import {
  ENEMY_RANK_NAMES, enemyRankForStage, enemyXp, isEliteEnemy, nextHeroMilestone,
  progressAfterXp, stageClearXp, unlockedHeroUpgrades, xpForLevel,
} from "./progression";

export type Action = "left" | "right" | "jump" | "bubble" | "start" | "pause";
type GameState = "boot" | "title" | "attract" | "characterSelect" | "stageIntro" | "playing" | "hurry" | "dying" | "stageClear" | "paused" | "gameOver" | "victory" | "records/options";
type EnemyState = "normal" | "trapped" | "furious" | "dead";
type BubblePhase = "fired" | "slowing" | "floating" | "occupied" | "warning" | "burst";

type Player = {
  x:number;y:number;previousY:number;vx:number;vy:number;w:number;h:number;
  grounded:boolean;facing:1|-1;invuln:number;flying:number;
  maxJumps:number;jumpsRemaining:number;jumpCut:boolean;jumpAge:number;currentPlatformId:number|null;
};
type Enemy = { id:number;x:number;y:number;vx:number;vy:number;w:number;h:number;kind:EnemyKind;state:EnemyState;timer:number;cooldown:number;homeY:number;weakened:boolean;rank:number;elite:boolean };
type Bubble = { id:number;x:number;y:number;vx:number;vy:number;r:number;age:number;phase:BubblePhase;enemyId?:number;life:number };
type Reward = { x:number;y:number;vy:number;kind:string;value:number;life:number;letter?:string };
type Projectile = { x:number;y:number;vx:number;vy:number;life:number;kind:"tear"|"star" };
type Particle = { x:number;y:number;vx:number;vy:number;life:number;color:string;size:number };
type WidowPhase = "entrance" | "chase" | "telegraph" | "lunge" | "staggered" | "trapped" | "defeated";
type WidowState = { x:number;y:number;vx:number;vy:number;age:number;hp:number;maxHp:number;phase:WidowPhase;phaseTimer:number;lungeAngle:number };
type Widow = WidowState | null;
type Cheats = { power:boolean;super:boolean;extra:boolean };
const WIDOW_ENEMY_ID = -1;
type Settings = PersistedSettings;

const FIXED=1/60;
const COLORS={void:"#050509",midnight:"#081A3A",blue:"#087CFF",pink:"#FF2A9D",crimson:"#C4133D",jade:"#20C98B",shine:"#FFD6F1"};
const TOKENS:Record<Action,Token|undefined>={left:"LEFT",right:"RIGHT",jump:"JUMP",bubble:"BUBBLE",start:"START",pause:undefined};
const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));
const dist=(a:{x:number;y:number},b:{x:number;y:number})=>Math.hypot(a.x-b.x,a.y-b.y);
const overlaps=(a:{x:number;y:number;w:number;h:number},b:{x:number;y:number;w:number;h:number})=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;

export class BubbleHexEngine {
  private canvas:HTMLCanvasElement; private ctx:CanvasRenderingContext2D; private audio=new AudioManager();
  private frame=0; private last=0; private acc=0; private alive=true; private ready:()=>void;
  private state:GameState="boot"; private stateTime=0; private titleIdle=0; private startGrace=0;
  private held:Record<Action,boolean>={left:false,right:false,jump:false,bubble:false,start:false,pause:false};
  private just=new Set<Action>(); private hero:HeroId="vesper"; private selected:HeroId="vesper";
  private player:Player=this.makePlayer();
  private enemies:Enemy[]=[]; private bubbles:Bubble[]=[]; private rewards:Reward[]=[]; private projectiles:Projectile[]=[]; private particles:Particle[]=[];
  private nextId=1; private levelIndex=0; private level:Level=LEVELS[0]; private levelTime=0; private lives=3; private score=0;
  private comboText=""; private comboLife=0; private message=""; private messageLife=0; private widow:Widow=null; private widowTime=0;
  private venom=new Set<string>(); private cheats:Cheats={power:false,super:false,extra:false}; private cheatReader=new CheatReader();
  private upgrades={speed:false,rapid:false,range:false,velocity:false,shield:false,venom:false,chain:false,crown:false};
  private fireCooldown=0; private stageKills=0; private trappedBeforeFirstPop=0; private firstPop=false; private touchedFloor=false; private bestChain=0;
  private coyote=0; private jumpBuffer=0;
  private settings:Settings={...DEFAULT_SETTINGS,selectedSkins:{...DEFAULT_SETTINGS.selectedSkins},unlockedSkins:[...DEFAULT_SETTINGS.unlockedSkins],unlockedCodex:[...DEFAULT_SETTINGS.unlockedCodex],fragments:[]}; private musicClock=0;
  private shake=0; private hitStop=0; private attractTime=0; private secretFound=false; private endingText="";
  private gamepadPrev={jump:false,bubble:false,start:false,pause:false};
  private debug=false; private platformAudit:PlatformAudit[]=[]; private landedThisFrame=false;
  private art=new GameArtAssets(); private archiveIndex=0; private audioReady=false;
  private readonly devTools:boolean=Boolean(import.meta.env?.DEV);
  private inBonus=false; private bonusVisited=false; private stageStartScore=0; private stageDamaged=false; private newRecord=false;
  private stageBreakdown={kills:0,speedBonus:0,lifeBonus:0,noDamageBonus:0,secretBonus:0,total:0};
  private stageXp=0;

  constructor(canvas:HTMLCanvasElement,onReady:()=>void){
    this.canvas=canvas; const ctx=canvas.getContext("2d"); if(!ctx)throw new Error("Canvas unavailable"); this.ctx=ctx;this.ctx.imageSmoothingEnabled=false;this.ready=onReady;
    this.load(); this.audio.muted=this.settings.muted;this.audio.musicVolume=this.settings.musicVolume;this.audio.sfxVolume=this.settings.sfxVolume;void this.art.preload();
    this.onKeyDown=this.onKeyDown.bind(this);this.onKeyUp=this.onKeyUp.bind(this);window.addEventListener("keydown",this.onKeyDown);window.addEventListener("keyup",this.onKeyUp);
  }
  start(){this.ready();this.frame=requestAnimationFrame(this.loop)}
  destroy(){this.alive=false;cancelAnimationFrame(this.frame);window.removeEventListener("keydown",this.onKeyDown);window.removeEventListener("keyup",this.onKeyUp);this.audio.destroy()}
  setMuted(v:boolean){this.settings.muted=v;this.audio.setMuted(v);this.save()}
  private makePlayer(invuln=0,floorY=650,platformId=0):Player{
    const y=floorY-PLAYER_HEIGHT;
    return {x:55,y,previousY:y,vx:0,vy:0,w:PLAYER_WIDTH,h:PLAYER_HEIGHT,grounded:true,facing:1,invuln,flying:0,maxJumps:MAX_JUMPS,jumpsRemaining:MAX_JUMPS,jumpCut:false,jumpAge:0,currentPlatformId:platformId};
  }
  private resetPlayer(invuln=0){
    const floorId=this.level.platforms.reduce((best,platform,index)=>platform.y>this.level.platforms[best].y?index:best,0);
    this.player=this.makePlayer(invuln,this.level.platforms[floorId].y,floorId);
    this.coyote=COYOTE_TIME;this.jumpBuffer=0;
  }
  private syncAuditData(){
    const p=this.player;
    Object.assign(this.canvas.dataset,{
      gameState:this.state,playerY:p.y.toFixed(2),playerVy:p.vy.toFixed(2),grounded:String(p.grounded),
      jumpsRemaining:String(p.jumpsRemaining),coyote:this.coyote.toFixed(3),jumpBuffer:this.jumpBuffer.toFixed(3),
      platform:String(p.currentPlatformId??-1),jumpHeight:TARGET_JUMP_HEIGHT.toFixed(1),
      widowPhase:this.widow?.phase??"",widowHp:String(this.widow?.hp??""),score:String(this.score),lives:String(this.lives),
      widowX:this.widow?.x.toFixed(1)??"",widowY:this.widow?.y.toFixed(1)??"",playerX:p.x.toFixed(1),
      levelName:this.level.name,levelBonus:String(!!this.level.bonus),cheatsExtra:String(this.cheats.extra),enemiesLeft:String(this.enemies.filter(e=>e.state!=="dead").length),
    });
  }
  private onKeyDown(e:KeyboardEvent){
    if(e.code==="F3"||e.code==="Backquote"){if(!this.devTools)return;e.preventDefault();if(!e.repeat)this.debug=!this.debug;return}
    if(this.devTools&&!e.repeat&&(e.code==="BracketLeft"||e.code==="BracketRight")){e.preventDefault();this.devJumpLevel(e.code==="BracketRight"?1:-1);return}
    if(e.repeat)return; const a=this.keyAction(e.code);if(a){e.preventDefault();this.press(a)}
  }
  private devJumpLevel(dir:number){
    const active=this.state==="playing"||this.state==="paused"||this.state==="stageIntro"||this.state==="hurry"||this.state==="stageClear"||this.state==="dying";
    if(!active){this.hero=this.selected;this.lives=3;this.score=0;this.venom.clear();this.upgrades={speed:false,rapid:false,range:false,velocity:false,shield:false,venom:false,chain:false,crown:false}}
    const next=clamp((active?this.levelIndex:0)+dir,0,LEVELS.length-1);
    this.loadLevel(next);this.setState("stageIntro");
  }
  private onKeyUp(e:KeyboardEvent){const a=this.keyAction(e.code);if(a){e.preventDefault();this.release(a)}}
  private keyAction(code:string):Action|undefined{
    if(code==="ArrowLeft"||code==="KeyA")return"left";if(code==="ArrowRight"||code==="KeyD")return"right";
    if(code==="Space"||code==="KeyC")return"jump";if(code==="KeyX"||code==="KeyZ")return"bubble";
    if(code==="Enter")return"start";if(code==="Escape"||code==="KeyP")return"pause";
  }
  press(action:Action){
    const wasUnlocked=this.audioReady;this.audio.unlock();this.audioReady=true;if(!wasUnlocked)this.syncMusic();
    this.held[action]=true;this.just.add(action);
    if(this.state==="attract"){this.toTitle();return}
    if(this.state==="title")this.titleIdle=0;
    if(this.state==="title"&&TOKENS[action])this.recordToken(TOKENS[action]!,action==="start");
    if(this.state==="title"&&action!=="start")this.titleIdle=0;
    if(action==="pause"){
      if(this.state==="playing"||this.state==="hurry")this.setState("paused");
      else if(this.state==="paused")this.setState("playing");
    }
  }
  release(action:Action){this.held[action]=false}
  private loop=(t:number)=>{
    if(!this.alive)return; if(!this.last)this.last=t;const delta=Math.min(MAX_FRAME_DELTA,(t-this.last)/1000);this.last=t;this.acc+=delta;
    while(this.acc>=FIXED){this.update(FIXED);this.acc-=FIXED}this.render();this.frame=requestAnimationFrame(this.loop);
  };
  private setState(s:GameState){this.state=s;this.stateTime=0;this.just.clear();this.syncMusic()}
  private syncMusic(){
    if(!this.audioReady||this.state==="boot")return;
    if(this.state==="gameOver"){this.audio.stopMusic(.5);return}
    if(this.state==="victory"){this.audio.playMusic("victory",1.6);return}
    if(this.state==="title"||this.state==="characterSelect"||this.state==="records/options"||this.state==="attract"){this.audio.playMusic("title");return}
    if(this.state==="dying")return;
    const track=this.level.bonus?"bonus":(this.level.boss||this.level.approach)?"boss":"stage";
    this.audio.playMusic(track);
  }
  private update(dt:number){
    this.pollGamepad();
    this.stateTime+=dt;this.titleIdle+=this.state==="title"?dt:0;this.messageLife=Math.max(0,this.messageLife-dt);this.comboLife=Math.max(0,this.comboLife-dt);this.shake=Math.max(0,this.shake-dt*18);
    if(this.hitStop>0){this.hitStop-=dt;this.just.clear();return}
    if(this.state==="boot"&&this.stateTime>.55&&this.art.state!=="loading")this.toTitle();
    else if(this.state==="title")this.updateTitle(dt);
    else if(this.state==="characterSelect")this.updateSelect();
    else if(this.state==="stageIntro"&&this.stateTime>1.65)this.setState("playing");
    else if(this.state==="playing")this.updatePlaying(dt,false);
    else if(this.state==="hurry")this.updateHurry(dt);
    else if(this.state==="attract")this.updatePlaying(dt,true);
    else if(this.state==="dying"&&this.stateTime>1.15)this.afterDeath();
    else if(this.state==="stageClear"&&this.stateTime>2.35)this.nextStage();
    else if(this.state==="gameOver"&&(this.just.has("start")||this.just.has("jump")))this.toTitle();
    else if(this.state==="victory"&&(this.just.has("start")||this.just.has("jump")))this.toTitle();
    else if(this.state==="paused")this.updatePause();
    else if(this.state==="records/options")this.updateArchive();
    this.syncAuditData();this.just.clear();
  }
  private updateTitle(dt:number){
    if(this.startGrace>0){this.startGrace-=dt;if(this.startGrace<=0)this.setState("characterSelect")}
    if(this.titleIdle>15)this.beginAttract();
    if(this.just.has("left")||this.just.has("right"))this.selected=this.selected==="vesper"?"jade":"vesper";
    if(this.just.has("pause"))this.setState("records/options");
  }
  private updateSelect(){
    if(this.just.has("left")||this.just.has("right")){this.selected=this.selected==="vesper"?"jade":"vesper";this.audio.tone(this.selected==="jade"?520:310)}
    if(this.just.has("bubble")){this.cycleSkin(this.selected);this.audio.reward()}
    if(this.just.has("start")||this.just.has("jump")){this.hero=this.selected;this.beginRun()}
    if(this.just.has("pause"))this.toTitle();
  }
  private updateArchive(){
    const entries=this.archiveEntries();
    if(this.just.has("left"))this.archiveIndex=(this.archiveIndex-1+entries.length)%entries.length;
    if(this.just.has("right")||this.just.has("jump")||this.just.has("bubble"))this.archiveIndex=(this.archiveIndex+1)%entries.length;
    if(this.just.has("pause")||this.just.has("start"))this.toTitle();
  }
  private updatePause(){
    const sfxMode=this.held.jump;
    if(this.just.has("left")){
      if(sfxMode){this.settings.sfxVolume=clamp(this.settings.sfxVolume-.1,0,1);this.audio.setSfxVolume(this.settings.sfxVolume)}
      else{this.settings.musicVolume=clamp(this.settings.musicVolume-.1,0,1);this.audio.setMusicVolume(this.settings.musicVolume)}
      this.save();
    }
    if(this.just.has("right")){
      if(sfxMode){this.settings.sfxVolume=clamp(this.settings.sfxVolume+.1,0,1);this.audio.setSfxVolume(this.settings.sfxVolume)}
      else{this.settings.musicVolume=clamp(this.settings.musicVolume+.1,0,1);this.audio.setMusicVolume(this.settings.musicVolume)}
      this.audio.reward();this.save();
    }
    if(this.just.has("bubble")){this.settings.muted=!this.settings.muted;this.audio.setMuted(this.settings.muted);this.save()}
    if(this.just.has("jump")){this.settings.reducedMotion=!this.settings.reducedMotion;this.save()}
    if(this.just.has("start"))this.restartCurrentStage();
  }
  private updateHurry(dt:number){
    if(this.stateTime>.85&&!this.widow){this.widow=this.makeWidow(W-90,120,false);this.widowTime=0}
    if(this.stateTime>1.45)this.setState("playing");
    this.updateWorld(dt,false,false);
  }
  private makeWidow(x:number,y:number,boss:boolean):WidowState{
    const hp=boss?(this.cheats.super?4:3):0;
    return {x,y,vx:0,vy:0,age:0,hp,maxHp:hp,phase:boss?"entrance":"chase",phaseTimer:0,lungeAngle:0};
  }
  private updatePlaying(dt:number,demo:boolean){
    if(demo){this.attractTime+=dt;if(this.attractTime>11){this.toTitle();return}this.held.right=this.player.x<720;this.held.left=this.player.x>=720;this.held.bubble=Math.floor(this.attractTime*2)%2===0;if(this.player.grounded&&Math.floor(this.attractTime*1.3)%3===0)this.just.add("jump")}
    this.updateWorld(dt,true,demo);
    if(!demo){this.levelTime-=dt;if(this.levelTime<=0&&!this.widow){this.audio.hurry();this.setState("hurry");return}}
    const bossCleared=this.level.boss?(this.widow?.phase==="defeated"&&this.widow.phaseTimer>1.4):this.enemies.every(e=>e.state==="dead");
    if(bossCleared)this.clearStage(demo);
  }
  private updateWorld(dt:number,allowDamage:boolean,demo:boolean){
    this.fireCooldown=Math.max(0,this.fireCooldown-dt);this.player.invuln=Math.max(0,this.player.invuln-dt);this.player.flying=Math.max(0,this.player.flying-dt);
    this.musicClock-=dt;if(this.musicClock<=0&&this.state==="playing"){const notes=[110,165,220,147];this.audio.tone(notes[(this.stageKills+Math.floor(this.levelTime))%notes.length],.055,"square",0,.025);this.musicClock=this.widow?.2:.34}
    this.updatePlayer(dt);this.updateBubbles(dt);this.updateEnemies(dt);this.updateProjectiles(dt);this.updateRewards(dt);this.updateParticles(dt);this.updateWidow(dt);
    if(allowDamage&&!demo)this.checkDamage();
  }
  private updatePlayer(dt:number){
    const p=this.player;
    const wasGrounded=p.grounded;
    const speed=this.upgrades.speed?POWER_RUN_SPEED:MAX_RUN_SPEED;
    const dir=(this.held.right?1:0)-(this.held.left?1:0);
    const acceleration=p.grounded?GROUND_ACCELERATION:AIR_ACCELERATION;
    const deceleration=p.grounded?GROUND_DECELERATION:AIR_DECELERATION;

    this.coyote=p.grounded?COYOTE_TIME:Math.max(0,this.coyote-dt);
    if(this.just.has("jump"))this.jumpBuffer=JUMP_BUFFER_TIME;
    else this.jumpBuffer=Math.max(0,this.jumpBuffer-dt);

    if(dir){p.vx+=dir*acceleration*dt;p.facing=dir as 1|-1}
    else p.vx+=(p.vx>0?-1:1)*Math.min(Math.abs(p.vx),deceleration*dt);
    p.vx=clamp(p.vx,-speed,speed);

    const canGroundJump=p.grounded||this.coyote>0;
    if(this.jumpBuffer>0&&p.flying<=0){
      if(canGroundJump){
        p.vy=JUMP_VELOCITY;p.grounded=false;p.jumpsRemaining=1;p.jumpCut=false;p.jumpAge=0;
        this.coyote=0;this.jumpBuffer=0;this.audio.jump();
      }else if(p.jumpsRemaining>0){
        p.vy=DOUBLE_JUMP_VELOCITY;p.jumpsRemaining=0;p.jumpCut=false;p.jumpAge=0;
        this.jumpBuffer=0;this.audio.tone(420,.11,"triangle",260,.1);
        this.burstParticles(p.x+p.w/2,p.y+p.h,COLORS.jade,12);
      }
    }

    p.jumpAge+=dt;
    if(!this.held.jump&&p.vy<0&&!p.jumpCut&&p.jumpAge>=.07){p.vy*=.55;p.jumpCut=true}
    if((this.held.bubble||this.just.has("bubble"))&&this.fireCooldown<=0)this.fireBubble();
    if(p.flying>0){p.vy+=(this.held.jump?-440:160)*dt;p.vy=clamp(p.vy,-230,230)}else p.vy+=GRAVITY*dt;

    p.previousY=p.y;
    p.x+=p.vx*dt;p.x=clamp(p.x,24,W-24-p.w);p.y+=p.vy*dt;
    p.grounded=false;p.currentPlatformId=null;this.landedThisFrame=false;
    const previousBottom=p.previousY+p.h,currentBottom=p.y+p.h;
    const landing=this.level.platforms
      .map((platform,id)=>({platform,id}))
      .filter(({platform})=>p.vy>=0&&p.x+p.w>platform.x+1&&p.x<platform.x+platform.w-1&&previousBottom<=platform.y+2&&currentBottom>=platform.y)
      .sort((a,b)=>a.platform.y-b.platform.y)[0];
    if(landing){
      p.y=landing.platform.y-p.h;p.vy=0;p.grounded=true;p.jumpsRemaining=p.maxJumps;
      p.jumpCut=false;p.jumpAge=0;p.currentPlatformId=landing.id;this.coyote=COYOTE_TIME;this.landedThisFrame=true;
      if(landing.platform.y>=640)this.touchedFloor=true;
    }else if(wasGrounded){
      // Walking off a scaffold consumes the ground action but preserves one recovery jump.
      p.jumpsRemaining=Math.min(1,p.jumpsRemaining);
    }

    for(const b of this.bubbles){
      if(b.phase==="floating"&&p.vy>=0&&p.x+p.w>b.x-b.r&&p.x<b.x+b.r&&previousBottom<=b.y&&currentBottom>=b.y-b.r*.3){
        p.y=b.y-b.r-p.h;p.vy=JUMP_VELOCITY*.86;p.grounded=false;p.jumpsRemaining=1;p.jumpCut=false;p.jumpAge=0;
        b.life-=1.5;this.audio.tone(250,.07,"sine",170,.07);
      }
    }
    if(p.y>H+80)this.damagePlayer();
  }
  private fireBubble(){
    const p=this.player,fast=this.upgrades.velocity?500:390;this.bubbles.push({id:this.nextId++,x:p.x+p.w/2+p.facing*28,y:p.y+20,vx:p.facing*fast,vy:0,r:18,age:0,phase:"fired",life:this.upgrades.range?7.8:5.2});
    this.fireCooldown=this.upgrades.rapid?.17:.36;this.audio.bubble();
  }
  private updateBubbles(dt:number){
    for(const b of this.bubbles){
      b.age+=dt;b.life-=dt;if(b.phase==="burst")continue;
      if(b.phase==="fired"&&b.age>.18)b.phase="slowing";
      if(b.phase==="slowing"){b.vx*=Math.pow(.08,dt);if(Math.abs(b.vx)<48)b.phase="floating"}
      if(b.phase==="floating"){b.vx+=this.level.current.x*85*dt;b.vy+=this.level.current.y*130*dt;b.vy=clamp(b.vy,-70,-16)}
      if(b.phase==="occupied"||b.phase==="warning"){b.vx+=this.level.current.x*45*dt;b.vy=-27+Math.sin(b.age*4)*8;if(b.life<1.2)b.phase="warning"}
      b.x+=b.vx*dt;b.y+=b.vy*dt;if(b.x<b.r+25||b.x>W-b.r-25)b.vx*=-.75;if(b.y<94){b.y=94;b.vy=Math.abs(b.vy)*.25}
      if((b.phase==="fired"||b.phase==="slowing"||b.phase==="floating"))this.tryTrap(b);
      if((b.phase==="occupied"||b.phase==="warning")&&this.playerBubbleHit(b))this.popChain(b);
      if(b.life<=0){if(b.enemyId)this.releaseEnemy(b);b.phase="burst"}
    }
    this.bubbles=this.bubbles.filter(b=>b.phase!=="burst"&&b.life>-1);
  }
  private tryTrap(b:Bubble){
    if(this.widow&&this.level.boss&&this.widow.phase==="staggered"&&dist(b,this.widow)<b.r+40){
      this.widow.phase="trapped";this.widow.phaseTimer=0;
      b.phase="occupied";b.enemyId=WIDOW_ENEMY_ID;b.life=6;b.vx*=.1;b.vy=-18;b.r=36;
      this.audio.trap();this.burstParticles(b.x,b.y,COLORS.crimson,14);
      return;
    }
    for(const e of this.enemies){if(e.state!=="normal"&&e.state!=="furious")continue;if(dist(b,e)<b.r+26){e.state="trapped";e.timer=0;e.weakened=this.upgrades.venom;b.phase="occupied";b.enemyId=e.id;const resistance=Math.max(.58,1-(e.rank-1)*.08-(e.elite?.08:0));b.life=(e.weakened?6.4:5.4)*resistance;b.vx*=.15;b.vy=-24;b.r=25;this.trappedBeforeFirstPop++;this.audio.trap();this.burstParticles(b.x,b.y,e.weakened?COLORS.jade:COLORS.pink,8);break}}
  }
  private playerBubbleHit(b:Bubble){const p=this.player;return p.x<b.x+b.r&&p.x+p.w>b.x-b.r&&p.y<b.y+b.r&&p.y+p.h>b.y-b.r}
  private popChain(root:Bubble){
    const open=[root],seen=new Set<number>(),chain:Bubble[]=[];const link=this.upgrades.chain?105:82;
    while(open.length){const b=open.shift()!;if(seen.has(b.id))continue;seen.add(b.id);chain.push(b);for(const n of this.bubbles)if((n.phase==="occupied"||n.phase==="warning")&&!seen.has(n.id)&&dist(b,n)<link)open.push(n)}
    this.firstPop=true;this.bestChain=Math.max(this.bestChain,chain.length);const mult=[1,2,3,4,6,8,13][Math.min(chain.length-1,6)];
    chain.forEach((b,i)=>setTimeout(()=>{if(!this.alive)return;this.resolveBubble(b,mult,i+1)},i*55));
    if(chain.length>=6){this.comboText="HEARTBREAK ×6";this.comboLife=1.55;this.hitStop=this.settings.reducedMotion?0:.1;this.shake=this.settings.reducedMotion?0:7}
    else{this.comboText=`CHAIN ×${mult}`;this.comboLife=.8}
  }
  private resolveBubble(b:Bubble,mult:number,chain:number){
    if(b.enemyId===WIDOW_ENEMY_ID){this.hitWidow();b.phase="burst";b.life=-.1;this.audio.pop(chain);this.burstParticles(b.x,b.y,COLORS.crimson,18);return}
    const enemy=this.enemies.find(e=>e.id===b.enemyId);if(enemy){enemy.state="dead";this.stageKills++;this.score+=100*mult*enemy.rank*(enemy.elite?2:1);if(this.state!=="attract")this.gainHeroXp(enemyXp(enemy.kind,enemy.rank,enemy.elite));this.spawnReward(b.x,b.y,chain)}b.phase="burst";b.life=-.1;this.audio.pop(chain);this.burstParticles(b.x,b.y,chain%2?COLORS.pink:COLORS.jade,14);
  }
  private hitWidow(){
    const w=this.widow;if(!w)return;
    w.hp=Math.max(0,w.hp-1);this.score+=2500;
    this.shake=this.settings.reducedMotion?0:10;this.hitStop=this.settings.reducedMotion?0:.12;this.audio.bossHit();
    if(w.hp<=0){this.beginWidowDefeat();return}
    w.phase="chase";w.phaseTimer=0;w.x=clamp(w.x,80,W-80);w.y=clamp(w.y,120,H-120);
    this.message="THE WIDOW STAGGERS";this.messageLife=1.3;
  }
  private beginWidowDefeat(){
    const w=this.widow;if(!w)return;
    w.phase="defeated";w.phaseTimer=0;w.vx=0;w.vy=0;this.score+=6000;
    this.shake=this.settings.reducedMotion?0:14;this.hitStop=this.settings.reducedMotion?0:.22;
    this.burstParticles(w.x,w.y,COLORS.crimson,40);this.burstParticles(w.x,w.y,COLORS.pink,26);
    this.message="THE WIDOW UNRAVELS";this.messageLife=2.4;this.audio.secret();
  }
  private releaseEnemy(b:Bubble){
    if(b.enemyId===WIDOW_ENEMY_ID){if(this.widow){this.widow.phase="chase";this.widow.phaseTimer=0;this.widow.x=b.x;this.widow.y=b.y;this.widow.vx=(this.player.x<b.x?1:-1)*80;this.widow.vy=-40}b.enemyId=undefined;return}
    const e=this.enemies.find(e=>e.id===b.enemyId);if(e){e.state="furious";e.x=b.x-e.w/2;e.y=b.y-e.h/2;e.vx=(this.player.x<e.x?-1:1)*220*(1+(e.rank-1)*.1+(e.elite?.15:0));e.timer=8}b.enemyId=undefined;
  }
  private updateEnemies(dt:number){
    for(const e of this.enemies){if(e.state==="dead"||e.state==="trapped")continue;e.timer+=dt;e.cooldown-=dt;const power=1+(e.rank-1)*.1+(e.elite?.15:0);const rage=(e.state==="furious"?(e.weakened?1.1:1.55):(e.weakened?.75:1))*power;
      if(e.kind==="bat"){if(Math.abs(this.player.x-e.x)<330||e.state==="furious"){e.vx+=(this.player.x-e.x)*.7*dt;e.vy+=(this.player.y-e.y)*.7*dt;e.vx=clamp(e.vx,-150*rage,150*rage);e.vy=clamp(e.vy,-120*rage,145*rage)}else{e.vx=Math.sin(e.timer*2)*45;e.vy=Math.sin(e.timer*3)*15}}
      else if(e.kind==="eye"){e.vx=0;e.vy=0;if(e.cooldown<=0){const a=Math.atan2(this.player.y-e.y,this.player.x-e.x);this.projectiles.push({x:e.x+16,y:e.y+15,vx:Math.cos(a)*95*rage,vy:Math.sin(a)*95*rage,life:6,kind:"tear"});e.cooldown=(e.state==="furious"?1.1:2.4)/power}}
      else if(e.kind==="witch"){const dx=this.player.x-e.x;e.vx=(Math.abs(dx)<190?-Math.sign(dx):Math.sign(dx))*70*rage;if(e.cooldown<=0){const a=Math.atan2(this.player.y-e.y,this.player.x-e.x);this.projectiles.push({x:e.x,y:e.y,vx:Math.cos(a)*145*power,vy:Math.sin(a)*145*power,life:4,kind:"star"});e.cooldown=(e.state==="furious"?1:2)/power}}
      else if(e.kind==="doll"){const charge=e.timer%3.4>2.55;e.vx=(this.player.x<e.x?-1:1)*(charge?250:55)*rage;e.vy+=1000*dt}
      else if(e.kind==="skull"){e.vx=(this.player.x<e.x?-1:1)*145*rage;e.vy+=900*dt;if(e.timer%2.2<dt)e.vy=-350}
      else{e.vx=(e.vx>=0?1:-1)*70*rage;e.vy+=1000*dt}
      const oldY=e.y;e.x+=e.vx*dt;e.y+=e.vy*dt;if(e.x<28){e.x=28;e.vx=Math.abs(e.vx)}if(e.x>W-e.w-28){e.x=W-e.w-28;e.vx=-Math.abs(e.vx)}
      if(e.kind!=="bat"&&e.kind!=="eye")for(const plat of this.level.platforms){if(e.x+e.w>plat.x&&e.x<plat.x+plat.w&&oldY+e.h<=plat.y+4&&e.y+e.h>=plat.y&&e.vy>=0){e.y=plat.y-e.h;e.vy=0;if(e.kind==="love"){const edge=e.vx>0?e.x+e.w+7:e.x-7;if(edge<plat.x||edge>plat.x+plat.w)e.vx*=-1}}}
      if(e.y>H+50){e.y=100;e.x=100+Math.random()*700;e.vy=0}
    }
  }
  private updateProjectiles(dt:number){for(const p of this.projectiles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt}this.projectiles=this.projectiles.filter(p=>p.life>0&&p.x>-20&&p.x<W+20&&p.y>-20&&p.y<H+20)}
  private updateRewards(dt:number){
    for(const r of this.rewards){r.vy+=340*dt;r.y+=r.vy*dt;r.life-=dt;for(const pl of this.level.platforms)if(r.x>pl.x&&r.x<pl.x+pl.w&&r.y>pl.y-8&&r.y<pl.y+12&&r.vy>0){r.y=pl.y-9;r.vy*=-.2}
      if(Math.hypot(this.player.x+17-r.x,this.player.y+24-r.y)<38){this.collectReward(r);r.life=-1}}
    this.rewards=this.rewards.filter(r=>r.life>0);
  }
  private updateParticles(dt:number){for(const p of this.particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=180*dt;p.life-=dt}this.particles=this.particles.filter(p=>p.life>0)}
  private updateWidow(dt:number){
    if(!this.widow)return;const w=this.widow;w.age+=dt;this.widowTime+=dt;
    if(!this.level.boss){
      const a=Math.atan2(this.player.y-w.y,this.player.x-w.x);
      w.vx+=Math.cos(a)*(this.cheats.super?110:85)*dt;w.vy+=Math.sin(a)*(this.cheats.super?110:85)*dt;
      const s=115;w.vx=clamp(w.vx,-s,s);w.vy=clamp(w.vy,-s,s);w.x+=w.vx*dt;w.y+=w.vy*dt;
      return;
    }
    this.updateBossWidow(dt,w);
  }
  private updateBossWidow(dt:number,w:WidowState){
    w.phaseTimer+=dt;
    const superMode=this.cheats.super;
    if(w.phase==="trapped"){
      const host=this.bubbles.find(hb=>hb.enemyId===WIDOW_ENEMY_ID&&(hb.phase==="occupied"||hb.phase==="warning"));
      if(host){w.x=host.x;w.y=host.y-6}else{w.phase="chase";w.phaseTimer=0}
      return;
    }
    if(w.phase==="defeated")return;
    if(w.phase==="entrance"){
      w.y=Math.min(95,w.y+90*dt);
      if(w.phaseTimer>1.8){w.phase="chase";w.phaseTimer=0}
      return;
    }
    if(w.phase==="staggered"){
      w.vx*=Math.pow(.02,dt);w.vy*=Math.pow(.02,dt);w.x+=w.vx*dt;w.y+=w.vy*dt;
      if(w.phaseTimer>2.6){w.phase="chase";w.phaseTimer=0}
      return;
    }
    if(w.phase==="chase"){
      const a=Math.atan2(this.player.y-w.y,this.player.x-w.x);
      const accel=superMode?150:110;
      w.vx+=Math.cos(a)*accel*dt;w.vy+=Math.sin(a)*accel*dt;
      const s=superMode?210:165;w.vx=clamp(w.vx,-s,s);w.vy=clamp(w.vy,-s,s);
      w.x+=w.vx*dt;w.y+=w.vy*dt;w.x=clamp(w.x,60,W-60);w.y=clamp(w.y,110,H-90);
      const chaseDuration=Math.max(1.1,2.3-(w.maxHp-w.hp)*.35);
      if(w.phaseTimer>chaseDuration){w.phase="telegraph";w.phaseTimer=0;w.lungeAngle=Math.atan2(this.player.y-w.y,this.player.x-w.x);w.vx=0;w.vy=0;this.audio.bossStagger()}
      return;
    }
    if(w.phase==="telegraph"){
      if(w.phaseTimer>.55){w.phase="lunge";w.phaseTimer=0;const speed=superMode?620:520;w.vx=Math.cos(w.lungeAngle)*speed;w.vy=Math.sin(w.lungeAngle)*speed}
      return;
    }
    if(w.phase==="lunge"){
      w.x+=w.vx*dt;w.y+=w.vy*dt;
      const outOfBounds=w.x<40||w.x>W-40||w.y<100||w.y>H-60;
      if(w.phaseTimer>.5||outOfBounds){
        w.x=clamp(w.x,60,W-60);w.y=clamp(w.y,110,H-90);
        w.phase="staggered";w.phaseTimer=0;w.vx=0;w.vy=0;
        this.message="THE CONTRACT SLIPS";this.messageLife=1.1;
      }
    }
  }
  private checkDamage(){
    if(this.player.invuln>0||this.player.flying>0)return;
    const widowDangerous=!!this.widow&&(!this.level.boss||this.widow.phase==="chase"||this.widow.phase==="lunge");
    const hit=this.enemies.some(e=>(e.state==="normal"||e.state==="furious")&&overlaps(this.player,e))||this.projectiles.some(p=>p.x>this.player.x&&p.x<this.player.x+this.player.w&&p.y>this.player.y&&p.y<this.player.y+this.player.h)||(widowDangerous&&dist(this.player,this.widow!)<52);
    if(hit)this.damagePlayer();
  }
  private damagePlayer(){if(this.player.invuln>0)return;this.stageDamaged=true;if(this.upgrades.shield){this.upgrades.shield=false;this.player.invuln=1.2;this.message="COMPACT SHATTERED";this.messageLife=1;this.audio.pop(2);return}this.audio.hurt();this.lives--;this.setState("dying");this.burstParticles(this.player.x+17,this.player.y+24,COLORS.crimson,22)}
  private afterDeath(){if(this.lives<=0){this.newRecord=isNewCampaignRecord(this.settings.highScore,this.score);if(this.newRecord)this.audio.recordSting();this.settings.highScore=Math.max(this.settings.highScore,this.score);this.save();this.setState("gameOver")}else{this.resetPlayer(2.2);this.setState("playing")}}
  private spawnReward(x:number,y:number,chain:number){
    const kinds=["CHERRY","RING","PERFUME","DRAGON FRUIT","BLACKBERRY","CROWN"],values=[100,250,400,600,800,1300];const tier=Math.min(kinds.length-1,Math.floor((chain-1)/2)+(this.upgrades.crown?1:0));
    const n=this.stageKills;if(n%7===0){const letters=["V","E","N","O","M"];const letter=letters.find(l=>!this.venom.has(l))||letters[n%5];this.rewards.push({x,y,vy:-120,kind:"LETTER",value:1080,life:12,letter})}
    else this.rewards.push({x,y,vy:-110,kind:kinds[tier],value:values[tier],life:10});
    if(n%5===0)this.applyPowerup(n);
  }
  private applyPowerup(n:number){const list=["rapid","range","velocity","speed","shield","venom","chain","crown"] as const;const key=list[(n+this.levelIndex)%list.length];this.upgrades[key]=true;this.message=({rapid:"LIGHTNING CANDY",range:"HEART RANGE",velocity:"BLUE COMET",speed:"CRIMSON HEELS",shield:"HEART COMPACT",venom:"JADE FANG",chain:"SNAKE CHAIN",crown:"THORN CROWN"})[key];this.messageLife=1.25;this.audio.reward()}
  private heroProgress(){return this.settings.heroProgress[this.hero]}
  private gainHeroXp(amount:number){
    const before=this.heroProgress();
    const after=progressAfterXp(before,amount);
    this.settings.heroProgress[this.hero]=after;this.stageXp+=Math.max(0,Math.floor(amount));
    if(after.level>before.level){
      this.applyMasteryUpgrades(false);
      const perk=nextHeroMilestone(this.hero,after.level-1);
      this.message=`LEVEL ${after.level} - ${perk?.level===after.level?perk.name.toUpperCase():"MASTERY RISES"}`;
      this.messageLife=2.4;
      this.audio.secret();
    }
  }
  private applyMasteryUpgrades(refreshShield=false){
    const progress=this.heroProgress();
    for(const key of unlockedHeroUpgrades(this.hero,progress.level))if(key!=="shield"||refreshShield||!this.upgrades.shield)this.upgrades[key]=true;
  }
  private threatRank(){return enemyRankForStage(this.levelIndex,!!this.level.boss,!!this.level.bonus)}
  private collectReward(r:Reward){this.score+=r.value;this.audio.reward();this.burstParticles(r.x,r.y,r.letter?"#FFD36A":COLORS.pink,8);if(r.letter){this.venom.add(r.letter);if(this.venom.size===5){this.lives++;this.score+=10000;this.player.flying=6;this.venom.clear();this.message="VENOM ASCENSION +1 LIFE";this.messageLife=2.2;this.shake=this.settings.reducedMotion?0:5;this.audio.secret()}}}
  private clearStage(demo:boolean){
    if(demo){this.toTitle();return}
    const secret=this.cheats.extra||(this.level.secret==="trapFirst"&&this.trappedBeforeFirstPop>=this.level.enemies.length)||(this.level.secret==="oneChain"&&this.bestChain>=this.level.enemies.length)||(this.level.secret==="noFloor"&&!this.touchedFloor)||(this.level.secret==="widow13"&&this.widowTime>=13);
    this.secretFound=secret;
    this.stageBreakdown=computeStageBreakdown({kills:this.score-this.stageStartScore,remainingTime:this.levelTime,lives:this.lives,noDamage:!this.stageDamaged,secretFound:secret,bonusRoom:!!this.level.bonus});
    this.score+=this.stageBreakdown.speedBonus+this.stageBreakdown.lifeBonus+this.stageBreakdown.noDamageBonus+this.stageBreakdown.secretBonus;
    this.gainHeroXp(stageClearXp(this.threatRank(),!this.stageDamaged,!!this.level.boss));
    if(secret){
      if(!this.level.bonus&&!this.settings.fragments.includes(this.level.loreFragmentId)){
        this.settings.fragments.push(this.level.loreFragmentId);this.settings.secrets++;
      }
      this.unlockContent(this.level.loreFragmentId);this.audio.secret();
    }
    this.recordStageResult();
    if(this.levelIndex===2&&!this.inBonus)this.unlockVelvetSkin(this.hero);
    this.save();this.setState("stageClear");
  }
  private recordStageResult(){
    const key=this.level.bonus?"bonus":this.level.loreFragmentId;
    const elapsed=Math.max(0,this.level.time-Math.max(0,this.levelTime));
    this.newRecord=isNewStageRecord(this.settings.bestStageTimes[key],elapsed);
    if(this.newRecord){this.settings.bestStageTimes[key]=elapsed;this.audio.recordSting()}
  }
  private nextStage(){
    if(this.inBonus){this.inBonus=false;this.levelIndex++;this.loadLevel(this.levelIndex);this.setState("stageIntro");return}
    if(this.cheats.extra&&!this.bonusVisited&&this.levelIndex===2){this.bonusVisited=true;this.loadBonusLevel();this.setState("stageIntro");return}
    if(this.levelIndex>=LEVELS.length-1){this.endingText=this.cheats.super?"TRUE ENDING — THE HEX DREAMS YOU BACK":"THE NIGHTCLUB OPENS AT DAWN";this.newRecord=isNewCampaignRecord(this.settings.highScore,this.score);if(this.newRecord)this.audio.recordSting();this.settings.highScore=Math.max(this.settings.highScore,this.score);this.save();this.setState("victory")}else{this.levelIndex++;this.loadLevel(this.levelIndex);this.setState("stageIntro")}
  }
  private beginRun(){this.lives=3;this.score=0;this.levelIndex=0;this.venom.clear();this.bonusVisited=false;this.stageStartScore=0;this.upgrades={speed:this.cheats.power,rapid:this.cheats.power,range:this.cheats.power,velocity:false,shield:false,venom:false,chain:false,crown:false};this.loadLevel(0);this.setState("stageIntro")}
  private restartCurrentStage(){if(this.inBonus)this.loadBonusLevel();else this.loadLevel(this.levelIndex);this.setState("stageIntro")}
  private loadLevel(i:number){this.levelIndex=i;this.inBonus=false;this.loadLevelData(this.remixLevel(LEVELS[i]))}
  private loadBonusLevel(){this.inBonus=true;this.loadLevelData(this.remixLevel(BONUS_LEVEL))}
  private loadLevelData(level:Level){
    this.level=level;this.levelTime=level.time;
    const rank=this.threatRank();
    this.enemies=level.enemies.map((s,index)=>({id:this.nextId++,x:s.x,y:s.y,vx:s.kind==="love"?70:0,vy:0,w:s.kind==="eye"?38:34,h:s.kind==="bat"?30:38,kind:s.kind,state:"normal",timer:0,cooldown:1+Math.random(),homeY:s.y,weakened:false,rank,elite:isEliteEnemy(this.levelIndex,index,rank)}));
    this.bubbles=[];this.rewards=[];this.projectiles=[];this.particles=[];
    this.widow=level.boss?this.makeWidow(W/2,-60,true):null;this.widowTime=0;
    this.platformAudit=auditLevelReachability(level);this.resetPlayer(1.2);
    this.stageKills=0;this.trappedBeforeFirstPop=0;this.firstPop=false;this.touchedFloor=false;this.bestChain=0;this.secretFound=false;this.stageStartScore=this.score;this.stageDamaged=false;this.stageXp=0;
    this.applyMasteryUpgrades(true);
    this.unlockContent(level.worldId);for(const enemy of level.enemies)this.unlockContent(enemy.kind);if(level.boss)this.unlockContent("widow");
    this.save();
  }
  private remixLevel(base:Level):Level{if(!this.cheats.super)return base;return{...base,time:Math.max(45,base.time-12),platforms:base.platforms.map((p,i)=>i===0?p:{...p,y:p.y+(i%2?18:-12)}),enemies:[...base.enemies,...base.enemies.slice(0,2).map((e,i)=>({...e,x:clamp(e.x+150+i*90,60,860),kind:i?"skull" as EnemyKind:"witch" as EnemyKind}))]}}
  private beginAttract(){this.attractTime=0;this.hero="jade";this.levelIndex=1;this.loadLevel(1);this.setState("attract")}
  private toTitle(){const resetRun=this.state==="gameOver"||this.state==="victory";if(resetRun){this.cheats={power:false,super:false,extra:false};this.cheatReader.reset()}this.setState("title");this.titleIdle=0;this.startGrace=0;this.attractTime=0;this.held={left:false,right:false,jump:false,bubble:false,start:false,pause:false}}
  private recordToken(token:Token,isStartAction:boolean){
    const match=this.cheatReader.feed(token,performance.now(),this.cheats);
    this.startGrace=nextTitleStartGrace(!!match,isStartAction);
    if(!match)return false;this.cheats[match]=true;this.confirmCheat(match);return true;
  }
  private confirmCheat(k:keyof Cheats){this.message=k==="power"?"POWER-UP MODE":k==="super"?"SUPER HEX":"SECRETS OPEN";this.messageLife=1.8;if(k==="super"){this.shake=this.settings.reducedMotion?0:8;this.audio.hurry()}else this.audio.secret();this.save()}
  private skinFor(hero:HeroId):SkinDefinition{return skinById(this.settings.selectedSkins[hero]??DEFAULT_SKIN[hero])}
  private cycleSkin(hero:HeroId){const skins=SKINS.filter(skin=>skin.heroId===hero&&this.settings.unlockedSkins.includes(skin.id));const current=this.settings.selectedSkins[hero];const index=Math.max(0,skins.findIndex(skin=>skin.id===current));this.settings.selectedSkins[hero]=skins[(index+1)%skins.length]?.id??DEFAULT_SKIN[hero];this.save()}
  private unlockVelvetSkin(hero:HeroId){const skin=SKINS.find(item=>item.heroId===hero&&item.unlock==="clear-velvet-drain");if(!skin)return;if(!this.settings.unlockedSkins.includes(skin.id)){this.settings.unlockedSkins.push(skin.id);this.unlockContent(skin.id);this.message=`${skin.name.toUpperCase()} UNLOCKED`;this.messageLife=2}}
  private unlockContent(id:string){if(!this.settings.unlockedCodex.includes(id))this.settings.unlockedCodex.push(id)}
  private archiveEntries(){const entries=CODEX_ENTRIES.filter(entry=>this.settings.unlockedCodex.includes(entry.unlockId));return entries.length?entries:CODEX_ENTRIES.slice(0,2)}
  private pollGamepad(){const g=navigator.getGamepads?.()[0];if(!g)return;this.held.left=(g.axes[0]||0)<-.35;this.held.right=(g.axes[0]||0)>.35;const next={jump:!!g.buttons[0]?.pressed,bubble:!!g.buttons[1]?.pressed,start:!!g.buttons[9]?.pressed,pause:!!g.buttons[8]?.pressed};for(const key of Object.keys(next) as (keyof typeof next)[]){if(next[key]&&!this.gamepadPrev[key])this.press(key);if(!next[key]&&this.gamepadPrev[key])this.release(key)}this.gamepadPrev=next}
  private burstParticles(x:number,y:number,color:string,count:number){for(let i=0;i<count;i++){const a=Math.random()*Math.PI*2,s=50+Math.random()*190;this.particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:.35+Math.random()*.55,color,size:2+Math.random()*5})}}
  private load(){
    try{
      const stored=localStorage.getItem("bubble-hex-settings");
      this.settings=migrateSettings(stored?JSON.parse(stored):undefined,matchMedia("(prefers-reduced-motion: reduce)").matches);
    }catch{}
  }
  private save(){try{localStorage.setItem("bubble-hex-settings",JSON.stringify(this.settings))}catch{}}

  private render(){const c=this.ctx;c.save();const s=this.shake&&!this.settings.reducedMotion?(Math.random()-.5)*this.shake:0;c.translate(s,s);c.fillStyle=COLORS.void;c.fillRect(-10,-10,W+20,H+20);
    if(this.state==="boot")this.drawBoot();else if(this.state==="title")this.drawTitle();else if(this.state==="characterSelect")this.drawSelect();else if(this.state==="records/options")this.drawRecords();else if(this.state==="victory")this.drawVictory();else if(this.state==="gameOver")this.drawGameOver();else{this.drawWorld();if(this.state==="stageIntro")this.drawStageIntro();if(this.state==="hurry")this.drawHurry();if(this.state==="paused")this.drawPause();if(this.state==="stageClear")this.drawStageClear();if(this.state==="dying")this.drawDying();if(this.state==="attract")this.label("ATTRACT MODE — PRESS ANY KEY",W/2,700,15,COLORS.shine,"center")}
    if(this.messageLife>0)this.banner(this.message,110,COLORS.jade);c.restore();
  }
  private drawBoot(){this.label("BLUE $NAKE STUDIO",W/2,306,26,COLORS.blue,"center");this.label("DRESSING THE NIGHT",W/2,350,14,COLORS.jade,"center");this.ctx.strokeStyle="#183860";this.ctx.strokeRect(280,390,400,12);this.ctx.fillStyle=COLORS.pink;this.ctx.fillRect(282,392,396*this.art.progress,8)}
  private drawTitle(){
    const c=this.ctx,t=this.stateTime;c.fillStyle="#03040b";c.fillRect(0,0,W,H);c.save();c.globalAlpha=.42;this.art.draw(c,"heroes",0,0,1536,1024,0,50,W,640);c.restore();c.fillStyle="rgba(3,4,11,.23)";c.fillRect(0,0,W,H);this.drawStars();this.drawGothicFrame(COLORS.blue);
    if(this.cheats.super){c.fillStyle="rgba(0,0,0,.72)";c.fillRect(110,92,740,330);c.strokeStyle=COLORS.crimson;c.lineWidth=8;c.beginPath();c.ellipse(W/2,220,120,58,0,0,Math.PI*2);c.stroke();c.fillStyle=COLORS.pink;c.beginPath();c.arc(W/2,220,28,0,Math.PI*2);c.fill()}
    c.save();c.shadowBlur=18;c.shadowColor=COLORS.crimson;this.label("BUBBLE",W/2,225,104,COLORS.crimson,"center","Georgia");c.restore();
    c.save();c.shadowBlur=20;c.shadowColor=COLORS.jade;this.label("HEX",W/2,332,122,COLORS.jade,"center","Georgia");c.restore();
    this.drawSerpent(220,165,COLORS.crimson,1);this.drawSerpent(735,315,COLORS.jade,-1);
    this.drawHero(245,470,"vesper",1.55,false);this.drawHero(680,470,"jade",1.55,false);this.drawHeartBubble(W/2,475,72);
    if(this.cheats.power)for(let i=0;i<3;i++){const a=t*2+i*Math.PI*2/3;c.strokeStyle=i===0?COLORS.pink:i===1?COLORS.blue:COLORS.jade;c.lineWidth=3;c.beginPath();c.arc(W/2+Math.cos(a)*115,475+Math.sin(a)*70,13,0,Math.PI*2);c.stroke()}
    if(this.cheats.extra){c.strokeStyle=COLORS.jade;c.lineWidth=5;c.beginPath();c.arc(W/2,475,18,Math.PI,0);c.lineTo(W/2+12,515);c.lineTo(W/2-12,515);c.closePath();c.stroke()}
    const all=this.cheats.power&&this.cheats.super&&this.cheats.extra;this.label(all?"BUBBLE HEX: VENOM EDITION":"PRESS START",W/2,610,all?22:27,all?COLORS.crimson:COLORS.shine,"center");
    if(Math.floor(t*2)%2===0)this.label("ENTER / START",W/2,644,14,COLORS.pink,"center");
    this.label("ONE PLAYER",65,680,13,COLORS.blue);this.label("BLUE $NAKE STUDIO",895,680,12,COLORS.jade,"right");
    const active=[this.cheats.power&&"POWER",this.cheats.super&&"SUPER",this.cheats.extra&&"EXTRA"].filter(Boolean).join(" + ");if(active)this.label(active,W/2,675,12,COLORS.shine,"center");
  }
  private drawSelect(){this.drawStars();this.drawGothicFrame(COLORS.pink);this.label("CHOOSE YOUR HEX",W/2,105,42,COLORS.shine,"center","Georgia");
    this.drawSelectCard(150,155,"vesper",this.selected==="vesper");this.drawSelectCard(510,155,"jade",this.selected==="jade");this.label("←  HERO  →   •   BUBBLE: LOOK",W/2,635,16,COLORS.blue,"center");this.label("START / JUMP TO CONFIRM   •   PAUSE TO RETURN",W/2,675,13,COLORS.jade,"center")}
  private drawSelectCard(x:number,y:number,hero:HeroId,on:boolean){
    const c=this.ctx,skin=this.skinFor(hero),col=skin.accent,progress=this.settings.heroProgress[hero],next=nextHeroMilestone(hero,progress.level);c.fillStyle="#070817";c.fillRect(x,y,300,420);c.save();c.globalAlpha=.72;
    const portrait=this.art.draw(c,"heroes",hero==="vesper"?0:768,28,768,960,x+12,y+12,276,274);c.restore();
    if(!portrait)this.drawHero(x+150,y+175,hero,2.5,false);
    c.fillStyle="rgba(7,8,23,.82)";c.fillRect(x+8,y+286,284,126);c.strokeStyle=on?COLORS.shine:col;c.lineWidth=on?5:2;c.strokeRect(x,y,300,420);
    if(on){c.shadowBlur=18;c.shadowColor=col;c.strokeRect(x+9,y+9,282,402);c.shadowBlur=0}
    this.label(hero.toUpperCase(),x+150,y+326,30,col,"center","Georgia");this.label(skin.name.toUpperCase(),x+150,y+354,11,COLORS.shine,"center");
    this.label(hero==="vesper"?"THORN • SPARK • BITE":"MIST • GLASS • TIDE",x+150,y+379,10,skin.secondary,"center");this.label(on?"BUBBLE: CHANGE LOOK":"ALTERNATE",x+150,y+404,10,on?COLORS.pink:COLORS.blue,"center")
  }
  private drawWorld(){this.drawBackground();this.drawPlatforms();for(const r of this.rewards)this.drawReward(r);for(const b of this.bubbles)this.drawBubble(b);for(const e of this.enemies)if(e.state!=="dead"&&e.state!=="trapped")this.drawEnemy(e);for(const p of this.projectiles)this.drawProjectile(p);if(this.widow&&this.widow.phase!=="trapped")this.drawWidow(this.widow);this.drawPlayerShadow();this.drawHero(this.player.x+17,this.player.y+24,this.hero,1,this.player.invuln>0&&Math.floor(this.player.invuln*10)%2===0);for(const p of this.particles){this.ctx.globalAlpha=clamp(p.life*2,0,1);this.ctx.fillStyle=p.color;this.ctx.fillRect(p.x,p.y,p.size,p.size);this.ctx.globalAlpha=1}this.drawHud();this.drawProgressionHud();if(this.level.boss&&this.widow&&this.widow.phase==="entrance")this.drawBossNameplate();if(this.debug)this.drawDebugOverlay();if(this.comboLife>0)this.banner(this.comboText,370,COLORS.pink)}
  private drawBossNameplate(){const c=this.ctx,w=this.widow;if(!w)return;const t=clamp(w.phaseTimer/1.8,0,1);const alpha=t<.15?t/.15:t>.8?(1-t)/.2:1;c.save();c.globalAlpha=alpha;this.label("THE WIDOW",W/2,150,44,COLORS.crimson,"center","Georgia");this.label("LAST PATRON OF BUBBLE HEX",W/2,180,14,COLORS.pink,"center");c.restore()}
  private drawProgressionHud(){const p=this.heroProgress(),rank=this.threatRank();this.label(`LV ${p.level}`,389,25,11,COLORS.jade);this.label(`RANK ${rank} ${ENEMY_RANK_NAMES[rank-1]}`,389,48,8,rank>=4?COLORS.crimson:COLORS.blue)}
  private drawBackground(){const c=this.ctx;c.fillStyle=COLORS.void;c.fillRect(0,0,W,H);c.fillStyle=this.level.world==="JADE GARDEN"?"#06140f":"#050817";c.fillRect(18,70,W-36,H-92);c.globalAlpha=.18;c.strokeStyle=this.level.tint;c.lineWidth=2;
    if(this.level.worldId==="velvet-drain"){const sx=[0,724,1448][this.levelIndex]??0;c.save();c.globalAlpha=.58;this.art.draw(c,"velvetDrain",sx,0,724,724,18,70,W-36,H-92);c.restore();c.fillStyle="rgba(2,5,14,.24)";c.fillRect(18,70,W-36,H-92)}
    if(this.level.world==="THE BLACK BUBBLE"){for(let x=40;x<W;x+=55){c.beginPath();c.moveTo(x,75);c.lineTo(W-x/4,H);c.stroke()}for(let y=120;y<H;y+=55){c.beginPath();c.moveTo(20,y);c.lineTo(W-20,y);c.stroke()}c.beginPath();c.arc(W/2,H/2,250,0,Math.PI*2);c.stroke()}
    else{for(let x=45;x<W;x+=90){c.beginPath();c.moveTo(x,80);c.lineTo(x,H);c.stroke()}for(let y=120;y<H;y+=90){c.beginPath();c.moveTo(20,y);c.lineTo(W-20,y);c.stroke()}}
    c.globalAlpha=1;if(this.level.world==="HEARTBREAK HOTEL"){this.drawHeart(W/2,260,75,"#19071c");this.label("13",W/2,270,50,"#331033","center")}
    if(this.level.world==="CRIMSON CHAPEL"){for(let x=120;x<900;x+=210){c.fillStyle="#190711";c.fillRect(x,110,100,220);c.strokeStyle=COLORS.crimson;c.beginPath();c.arc(x+50,110,50,Math.PI,0);c.stroke()}}
    if(this.level.world==="JADE GARDEN"){for(let x=70;x<940;x+=140){c.strokeStyle="#0d4b36";c.beginPath();c.moveTo(x,H);c.bezierCurveTo(x-80,470,x+80,310,x,120);c.stroke()}}
  }
  private drawPlatforms(){const c=this.ctx;for(const p of this.level.platforms){c.save();c.shadowBlur=8;c.shadowColor=this.widow?COLORS.crimson:this.level.tint;c.fillStyle="#07152d";c.fillRect(p.x,p.y,p.w,p.h);c.shadowBlur=0;c.fillStyle=this.widow?COLORS.crimson:this.level.tint;c.fillRect(p.x,p.y,p.w,4);c.fillStyle="#0d2e5d";for(let x=p.x+8;x<p.x+p.w-4;x+=18){c.fillRect(x,p.y+8,8,4);c.fillStyle="#9bc7ff";c.fillRect(x+2,p.y+9,2,2);c.fillStyle="#0d2e5d"}c.strokeStyle="#173e75";c.lineWidth=2;c.beginPath();c.moveTo(p.x+5,p.y+p.h);c.lineTo(p.x+12,p.y+5);c.moveTo(p.x+p.w-5,p.y+p.h);c.lineTo(p.x+p.w-12,p.y+5);c.stroke();c.restore()}}
  private drawPlayerShadow(){const c=this.ctx,p=this.player;const platform=this.level.platforms.find(s=>p.x+p.w>s.x&&p.x<s.x+s.w&&s.y>=p.y+p.h);if(!platform)return;const distance=platform.y-(p.y+p.h),scale=clamp(1-distance/260,.22,1);c.save();c.globalAlpha=.16*scale;c.fillStyle="#000";c.beginPath();c.ellipse(p.x+p.w/2,platform.y-2,21*scale,5*scale,0,0,Math.PI*2);c.fill();c.restore()}
  private drawHud(){const c=this.ctx,skin=this.skinFor(this.hero);c.fillStyle="#02030a";c.fillRect(0,0,W,70);c.strokeStyle=skin.accent;c.lineWidth=2;c.beginPath();c.moveTo(0,68);c.lineTo(W,68);c.stroke();this.label(`SCORE ${String(this.score).padStart(7,"0")}`,24,28,17,COLORS.shine);this.label(`HI ${String(Math.max(this.score,this.settings.highScore)).padStart(7,"0")}`,24,53,12,COLORS.blue);this.drawHero(315,34,this.hero,.55,false);this.label(`× ${this.lives}`,342,40,17,skin.accent);this.label(this.level.bonus?"BONUS VAULT":`STAGE ${this.levelIndex+1}/12`,W/2,23,15,this.level.bonus?"#FFD36A":COLORS.shine,"center");this.label(this.level.world,W/2,45,11,this.level.tint,"center");const fx=[this.upgrades.speed&&"SPD",this.upgrades.rapid&&"FIR",this.upgrades.range&&"RNG",this.upgrades.velocity&&"COM",this.upgrades.shield&&"SHD",this.upgrades.venom&&"FNG",this.upgrades.chain&&"CHN",this.upgrades.crown&&"CRN"].filter(Boolean).join(" ");this.label(fx?`FX ${fx}`:"FX —",W/2,62,8,fx?COLORS.jade:"#30445e","center");this.label("JUMP",594,25,10,COLORS.blue);for(let i=0;i<2;i++){c.fillStyle=i<this.player.jumpsRemaining?skin.secondary:"#1c2b38";c.fillRect(596+i*16,36,10,10);c.strokeStyle=COLORS.shine;c.strokeRect(596+i*16,36,10,10)}this.label(`VENOM`,685,25,13,COLORS.pink);["V","E","N","O","M"].forEach((l,i)=>this.label(l,682+i*23,51,17,this.venom.has(l)?"#FFD36A":"#3a2541"));this.label(`${Math.max(0,Math.ceil(this.levelTime))}`,922,40,24,this.widow?COLORS.crimson:COLORS.jade,"right");if(this.level.boss&&this.widow&&this.widow.phase!=="entrance")this.drawBossHealth(this.widow);if(this.devTools)this.label("DEV · [ ] SKIP LEVEL · F3 DEBUG",6,H-6,9,"#3a4f6e")}
  private drawBossHealth(w:WidowState){
    const c=this.ctx,pips=w.maxHp,cx=W/2,y=82,size=16,gap=26,startX=cx-((pips-1)*gap)/2;
    c.save();this.label("THE WIDOW",cx,74,11,COLORS.pink,"center");
    for(let i=0;i<pips;i++){const x=startX+i*gap,filled=i<w.hp;c.strokeStyle=COLORS.crimson;c.lineWidth=2;c.fillStyle=filled?COLORS.crimson:"rgba(0,0,0,.3)";c.beginPath();
      c.moveTo(x,y-size*.8);c.lineTo(x-size*.7,y-size*.15);c.lineTo(x-size*.7,y+size*.4);c.lineTo(x,y+size*.9);c.lineTo(x+size*.7,y+size*.4);c.lineTo(x+size*.7,y-size*.15);c.closePath();c.fill();c.stroke();}
    if(w.phase==="staggered")this.label("VULNERABLE — TRAP HER!",cx,110,11,COLORS.jade,"center");
    c.restore();
  }
  private drawDebugOverlay(){const c=this.ctx,p=this.player;c.save();c.lineWidth=2;for(const audit of this.platformAudit){const platform=this.level.platforms[audit.id];c.strokeStyle=audit.status==="unreachable"?"#ff405c":audit.status==="double"?"#ffd36a":"#43ffb2";c.strokeRect(platform.x,platform.y,platform.w,platform.h);this.label(`${audit.id}:${audit.status}`,platform.x+3,platform.y-4,9,c.strokeStyle)}c.strokeStyle="#fff";c.strokeRect(p.x,p.y,p.w,p.h);c.fillStyle="#fff";c.fillRect(p.x,p.y+p.h-1,p.w,2);c.fillStyle="rgba(0,0,0,.78)";c.fillRect(16,82,275,104);this.label(`F3 DEBUG  Y ${p.y.toFixed(1)}  VY ${p.vy.toFixed(1)}`,26,104,11,COLORS.shine);this.label(`GROUND ${p.grounded}  PLATFORM ${p.currentPlatformId??"—"}`,26,126,11,p.grounded?COLORS.jade:COLORS.pink);this.label(`JUMPS ${p.jumpsRemaining}/${p.maxJumps}  COYOTE ${this.coyote.toFixed(2)}`,26,148,11,COLORS.blue);this.label(`BUFFER ${this.jumpBuffer.toFixed(2)}  APEX ${TARGET_JUMP_HEIGHT.toFixed(1)}PX`,26,170,11,COLORS.jade);c.restore()}
  private drawBubble(b:Bubble){const c=this.ctx,pulse=1+Math.sin(b.age*7)*.05,r=b.r*pulse,color=this.skinFor(this.hero).bubble;c.save();c.globalAlpha=b.phase==="warning"&&Math.floor(b.age*10)%2===0?.35:.92;c.fillStyle="rgba(255,42,157,.18)";c.strokeStyle=color;c.lineWidth=3;c.shadowBlur=12;c.shadowColor=color;c.beginPath();c.arc(b.x,b.y,r,0,Math.PI*2);c.fill();c.stroke();c.shadowBlur=0;c.strokeStyle=COLORS.shine;c.lineWidth=2;c.beginPath();c.arc(b.x-r*.28,b.y-r*.28,r*.28,Math.PI,Math.PI*1.55);c.stroke();if(b.enemyId===WIDOW_ENEMY_ID&&this.widow){this.drawWidow({...this.widow,x:b.x,y:b.y})}else if(b.enemyId){const e=this.enemies.find(e=>e.id===b.enemyId);if(e)this.drawEnemy({...e,x:b.x-e.w/2,y:b.y-e.h/2},true)}c.restore()}
  private drawEnemy(e:Enemy,trapped=false){const c=this.ctx,x=e.x+e.w/2,y=e.y+e.h/2,fur=e.state==="furious";c.save();if(trapped)c.globalAlpha=.8;c.translate(x,y);if(fur)c.rotate(Math.sin(e.timer*18)*.12);const col=fur?COLORS.crimson:COLORS.pink;
    if(e.elite){c.strokeStyle="#FFD36A";c.lineWidth=2;c.shadowBlur=12;c.shadowColor="#FFD36A";c.beginPath();c.arc(0,0,27+Math.sin(e.timer*5)*2,0,Math.PI*2);c.stroke();c.shadowBlur=0}c.fillStyle=e.elite?"#FFD36A":COLORS.blue;for(let i=0;i<e.rank;i++)c.fillRect(-e.rank*3+i*7,-32,5,3);
    if(e.kind==="love"){this.drawHeart(0,0,18,col);c.fillStyle=COLORS.shine;for(let i=-9;i<=9;i+=6){c.beginPath();c.moveTo(i,4);c.lineTo(i+3,11);c.lineTo(i+6,4);c.fill()}c.fillStyle=COLORS.void;c.fillRect(-9,-6,4,4);c.fillRect(5,-6,4,4)}
    else if(e.kind==="bat"){c.fillStyle="#171028";c.beginPath();c.moveTo(0,2);c.lineTo(-24,-12);c.lineTo(-16,12);c.lineTo(0,18);c.lineTo(16,12);c.lineTo(24,-12);c.closePath();c.fill();c.fillStyle=col;c.fillRect(-5,-5,10,13);c.fillStyle=COLORS.shine;c.fillRect(-3,-2,2,2);c.fillRect(2,-2,2,2)}
    else if(e.kind==="eye"){c.strokeStyle=col;c.lineWidth=5;c.beginPath();c.ellipse(0,0,19,12,0,0,Math.PI*2);c.stroke();c.fillStyle=COLORS.blue;c.beginPath();c.arc(0,0,8,0,Math.PI*2);c.fill();c.fillStyle=COLORS.shine;c.fillRect(-2,-3,4,6)}
    else if(e.kind==="witch"){c.fillStyle="#26102f";c.beginPath();c.moveTo(0,-22);c.lineTo(-20,2);c.lineTo(20,2);c.closePath();c.fill();c.fillStyle=col;c.fillRect(-13,0,26,24);c.fillStyle=COLORS.shine;c.fillRect(-4,-9,8,8)}
    else if(e.kind==="doll"){c.fillStyle="#2a1629";c.beginPath();c.arc(0,-8,12,0,Math.PI*2);c.fill();c.fillRect(-12,2,24,21);c.strokeStyle=col;c.beginPath();c.moveTo(-8,-10);c.lineTo(8,-4);c.moveTo(-8,-4);c.lineTo(8,-10);c.stroke()}
    else{c.fillStyle="#ded8dc";c.beginPath();c.arc(0,-3,17,0,Math.PI*2);c.fill();c.fillStyle=COLORS.void;c.fillRect(-10,-8,6,7);c.fillRect(4,-8,6,7);c.fillRect(-4,4,8,7);c.strokeStyle=col;c.beginPath();c.moveTo(-15,-13);c.lineTo(-21,-25);c.moveTo(15,-13);c.lineTo(21,-25);c.stroke()}
    c.restore()}
  private drawHero(x:number,y:number,hero:HeroId,scale=1,blink=false){if(blink)return;const c=this.ctx,skin=this.skinFor(hero),col=skin.accent,secondary=skin.secondary,dark=hero==="vesper"?"#130b18":"#081A3A";c.save();c.translate(x,y+Math.sin(this.stateTime*8)*.7);c.scale(scale,scale);c.strokeStyle=col;c.lineWidth=5;c.lineCap="square";c.beginPath();c.moveTo(4,10);c.bezierCurveTo(36,18,39,39,18,44);c.bezierCurveTo(2,53,-6,43,6,35);c.stroke();c.fillStyle=dark;c.beginPath();c.ellipse(0,7,15,23,-.08,0,Math.PI*2);c.fill();c.strokeStyle=col;c.lineWidth=2;c.stroke();c.fillStyle=dark;c.beginPath();c.arc(0,-13,15,0,Math.PI*2);c.fill();c.stroke();c.fillStyle=COLORS.shine;c.fillRect(-8,-16,5,4);c.fillRect(4,-16,5,4);c.fillStyle=secondary;c.fillRect(-6,-15,2,2);c.fillRect(5,-15,2,2);c.fillStyle=col;c.beginPath();c.moveTo(-10,-25);c.lineTo(-5,-38);c.lineTo(0,-25);c.moveTo(5,-25);c.lineTo(11,-37);c.lineTo(13,-22);c.fill();if(hero==="jade"){c.beginPath();c.moveTo(-13,-16);c.lineTo(-25,-8);c.lineTo(-13,-3);c.moveTo(13,-16);c.lineTo(25,-8);c.lineTo(13,-3);c.fill()}else{this.drawHeart(21,42,6,col)}if(skin.unlock!=="default"){c.strokeStyle=secondary;c.lineWidth=2;c.strokeRect(-10,0,6,6);c.strokeRect(5,10,6,6);c.beginPath();c.moveTo(-12,22);c.lineTo(12,28);c.stroke()}c.restore()}
  private drawWidow(w:WidowState){
    const c=this.ctx;
    if(w.phase==="telegraph"){
      c.save();c.strokeStyle=COLORS.crimson;c.lineWidth=3;c.setLineDash([10,10]);c.globalAlpha=.5+Math.sin(w.phaseTimer*30)*.3;
      c.beginPath();c.moveTo(w.x,w.y);c.lineTo(w.x+Math.cos(w.lungeAngle)*900,w.y+Math.sin(w.lungeAngle)*900);c.stroke();c.setLineDash([]);c.restore();
    }
    const scale=w.phase==="entrance"?clamp(w.phaseTimer/1.2,.2,1):1;
    const glow=w.phase==="telegraph"?(.6+Math.sin(w.phaseTimer*40)*.4):w.phase==="staggered"?(.5+Math.sin(w.phaseTimer*14)*.5):1;
    const bodyColor=w.phase==="staggered"?COLORS.jade:w.phase==="defeated"?"#3a2230":COLORS.crimson;
    c.save();c.translate(w.x,w.y);c.scale(scale,scale);c.globalAlpha=w.phase==="defeated"?clamp(1-w.phaseTimer/1.4,0,1):1;
    c.shadowBlur=20*glow;c.shadowColor=w.phase==="staggered"?COLORS.jade:COLORS.pink;this.drawHeart(0,0,38,"#09080d");c.shadowBlur=0;
    c.strokeStyle=bodyColor;c.lineWidth=4;c.beginPath();c.moveTo(-10,-18);c.lineTo(2,-4);c.lineTo(-6,8);c.lineTo(10,23);c.stroke();
    c.fillStyle=COLORS.shine;c.fillRect(-18,-8,10,6);c.fillRect(8,-8,10,6);
    c.strokeStyle="#b8a7a8";c.beginPath();c.moveTo(-35,8);c.lineTo(-58,20);c.lineTo(-66,4);c.moveTo(35,8);c.lineTo(58,20);c.lineTo(66,4);c.stroke();
    c.strokeStyle="#7f6d70";c.beginPath();c.moveTo(-25,-30);c.lineTo(-14,-52);c.lineTo(0,-37);c.lineTo(15,-55);c.lineTo(27,-28);c.stroke();
    if(w.phase==="lunge"){c.globalAlpha=.35;c.translate(-w.vx*.03,-w.vy*.03);this.drawHeart(0,0,34,"#09080d")}
    c.restore();
  }
  private drawProjectile(p:Projectile){const c=this.ctx;c.fillStyle=p.kind==="tear"?COLORS.blue:COLORS.pink;if(p.kind==="tear"){c.beginPath();c.arc(p.x,p.y,6,0,Math.PI*2);c.fill()}else{c.save();c.translate(p.x,p.y);c.rotate(performance.now()/200);for(let i=0;i<4;i++){c.fillRect(-2,-9,4,18);c.rotate(Math.PI/4)}c.restore()}}
  private drawReward(r:Reward){const c=this.ctx;c.save();c.translate(r.x,r.y);c.shadowBlur=10;c.shadowColor=r.letter?"#FFD36A":COLORS.pink;if(r.letter){c.fillStyle="#33220b";c.strokeStyle="#FFD36A";c.lineWidth=3;c.beginPath();c.arc(0,0,17,0,Math.PI*2);c.fill();c.stroke();this.label(r.letter,0,7,21,"#FFD36A","center")}else if(r.kind==="RING"){c.strokeStyle="#FFD36A";c.lineWidth=6;c.beginPath();c.arc(0,0,10,0,Math.PI*2);c.stroke()}else if(r.kind==="PERFUME"){c.fillStyle=COLORS.jade;c.fillRect(-9,-10,18,20);c.fillStyle="#FFD36A";c.fillRect(-5,-16,10,6)}else{this.drawHeart(0,0,12,r.kind==="BLACKBERRY"?"#7840a8":COLORS.pink)}c.shadowBlur=0;c.restore()}
  private drawStageIntro(){const fragment=STORY_FRAGMENTS.find(item=>item.id===this.level.loreFragmentId);this.ctx.fillStyle="rgba(5,5,9,.84)";this.ctx.fillRect(110,225,740,235);this.label(this.level.bonus?"ORIGINAL MODE SECRET":`STAGE ${this.levelIndex+1}`,W/2,280,20,this.level.tint,"center");this.label(this.level.name.toUpperCase(),W/2,338,38,COLORS.shine,"center","Georgia");this.label(this.level.world,W/2,378,15,COLORS.pink,"center");if(this.level.bonus)this.label("CHAIN THEM ALL BEFORE THE VAULT SEALS",W/2,425,12,COLORS.jade,"center");else if(fragment)this.label(`JADE DOOR: ${fragment.title.toUpperCase()}`,W/2,425,12,COLORS.jade,"center")}
  private drawHurry(){this.ctx.fillStyle="rgba(196,19,61,.2)";this.ctx.fillRect(0,70,W,H-70);this.banner("HURRY, DARLING!",300,COLORS.crimson)}
  private drawPause(){this.ctx.fillStyle="rgba(5,5,9,.9)";this.ctx.fillRect(130,135,700,490);this.drawGothicBox(130,135,700,490,COLORS.pink);this.label("PAUSED",W/2,205,42,COLORS.shine,"center","Georgia");this.label("P / PAUSE — RESUME",W/2,270,15,COLORS.jade,"center");this.label("← →  MUSIC VOLUME  "+Math.round(this.settings.musicVolume*10),W/2,312,15,COLORS.blue,"center");this.label("HOLD JUMP + ← →  SFX VOLUME  "+Math.round(this.settings.sfxVolume*10),W/2,340,13,COLORS.blue,"center");this.label(`BUBBLE  SOUND ${this.settings.muted?"OFF":"ON"}`,W/2,378,15,COLORS.pink,"center");this.label(`JUMP (TAP)  REDUCED MOTION ${this.settings.reducedMotion?"ON":"OFF"}`,W/2,418,15,COLORS.pink,"center");this.label("START — RESTART CHAMBER",W/2,458,15,COLORS.crimson,"center");this.label("MOVE A/D OR ARROWS · JUMP SPACE/C · BUBBLE X/Z",W/2,533,12,COLORS.shine,"center");this.label("TOUCH CONTROLS SUPPORT MULTI-TOUCH",W/2,568,12,COLORS.jade,"center")}
  private drawStageClear(){
    const c=this.ctx,fragment=STORY_FRAGMENTS.find(item=>item.id===this.level.loreFragmentId),b=this.stageBreakdown;
    const elapsed=Math.max(0,this.level.time-Math.max(0,this.levelTime));
    c.fillStyle="rgba(5,5,9,.92)";c.fillRect(90,168,780,400);this.drawGothicBox(90,168,780,400,this.level.bonus?"#FFD36A":COLORS.jade);
    this.label(this.level.bonus?"VAULT SEALED":"CHAMBER CLEARED",W/2,215,32,COLORS.shine,"center","Georgia");
    if(this.newRecord)this.label(`★ NEW STAGE-TIME RECORD — ${elapsed.toFixed(1)}s`,W/2,244,13,"#FFD36A","center");
    else this.label(`TIME ${elapsed.toFixed(1)}s  •  BEST ${(this.settings.bestStageTimes[this.level.bonus?"bonus":this.level.loreFragmentId]??elapsed).toFixed(1)}s`,W/2,244,12,COLORS.blue,"center");
    const rows:[string,number,string][]=[
      ["ENEMIES + CHAIN",b.kills,COLORS.pink],
      ["SPEED BONUS",b.speedBonus,COLORS.blue],
      ["LIVES REMAINING",b.lifeBonus,COLORS.jade],
      ["PERFECT (NO DAMAGE)",b.noDamageBonus,"#FFD36A"],
      ["SECRET FOUND",b.secretBonus,COLORS.jade],
    ];
    let y=278;
    for(const [label,value,color] of rows){this.label(label,150,y,12,value>0?color:"#3a4a5e");this.label(value>0?`+${value}`:"—",730,y,12,value>0?color:"#3a4a5e","right");y+=24}
    c.strokeStyle="#26374f";c.lineWidth=1;c.beginPath();c.moveTo(150,y+2);c.lineTo(730,y+2);c.stroke();y+=22;
    this.label("STAGE TOTAL",150,y,16,COLORS.shine);this.label(`+${b.total}`,730,y,16,COLORS.shine,"right");
    y+=26;this.label(`BEST CHAIN ×${this.bestChain}`,W/2,y,11,COLORS.blue,"center");y+=24;
    if(this.secretFound&&fragment){this.label("JADE DOOR OPEN",W/2,y,20,COLORS.jade,"center");y+=28;this.label(fragment.title.toUpperCase(),W/2,y,16,COLORS.shine,"center","Georgia");y+=22;this.drawWrappedText(fragment.text,W/2,y,640,18,11,COLORS.shine,"center")}
    else if(this.secretFound&&this.level.bonus){this.label("THE VAULT YIELDS ITS GOLD",W/2,y,18,"#FFD36A","center")}
    else{this.label(this.level.bonus?"THE VAULT STAYS SHUT — CHAIN THEM ALL NEXT TIME":"THE DOOR REMAINS QUIET",W/2,y,13,"#59687a","center")}
  }
  private drawDying(){this.ctx.fillStyle=`rgba(196,19,61,${.2+Math.sin(this.stateTime*18)*.1})`;this.ctx.fillRect(0,70,W,H-70);this.label("HEART BROKEN",W/2,360,38,COLORS.crimson,"center","Georgia")}
  private drawGameOver(){this.drawStars();this.drawGothicFrame(COLORS.crimson);this.label("GAME OVER",W/2,265,80,COLORS.crimson,"center","Georgia");this.drawHeart(W/2,370,45,"#16070d");this.label(`SCORE ${String(this.score).padStart(7,"0")}`,W/2,475,22,COLORS.shine,"center");if(this.newRecord)this.label("★ NEW CAMPAIGN BEST ★",W/2,505,14,"#FFD36A","center");else this.label(`CAMPAIGN BEST ${String(this.settings.highScore).padStart(7,"0")}`,W/2,505,12,COLORS.blue,"center");this.label("PRESS START — THE NIGHT REMEMBERS",W/2,560,16,COLORS.pink,"center")}
  private drawVictory(){this.drawStars();this.drawGothicFrame(this.cheats.super?COLORS.crimson:COLORS.jade);this.drawHero(310,300,this.hero,2.2,false);this.drawHeartBubble(650,300,90);this.label(this.cheats.super?"VENOM EDITION CLEARED":"DAWN SURVIVED",W/2,495,45,this.cheats.super?COLORS.crimson:COLORS.jade,"center","Georgia");this.label(this.endingText,W/2,545,15,COLORS.shine,"center");this.label(`FINAL SCORE ${this.score}`,W/2,590,18,COLORS.pink,"center");if(this.newRecord)this.label("★ NEW CAMPAIGN BEST ★",W/2,615,14,"#FFD36A","center");this.label("PRESS START",W/2,650,15,COLORS.blue,"center")}
  private drawRecords(){
    const c=this.ctx,entries=this.archiveEntries();this.archiveIndex=((this.archiveIndex%entries.length)+entries.length)%entries.length;const entry=entries[this.archiveIndex];
    this.drawStars();c.save();c.globalAlpha=.16;this.art.draw(c,"roster",0,0,1536,1024,0,0,W,H);c.restore();c.fillStyle="rgba(5,5,9,.76)";c.fillRect(0,0,W,H);this.drawGothicFrame(COLORS.blue);
    this.label("THE NIGHT ARCHIVE",W/2,92,38,COLORS.shine,"center","Georgia");this.label(`${entry.category.toUpperCase()}  ${this.archiveIndex+1}/${entries.length}`,W/2,125,11,COLORS.jade,"center");
    this.drawGothicBox(90,150,780,410,entry.category==="fragment"?COLORS.jade:COLORS.pink);this.label(entry.title.toUpperCase(),W/2,215,30,COLORS.shine,"center","Georgia");this.label(entry.subtitle.toUpperCase(),W/2,248,12,COLORS.pink,"center");
    if(entry.category==="profile"){
      const profile=CHARACTER_PROFILES[entry.unlockId as keyof typeof CHARACTER_PROFILES];this.drawWrappedText(profile.history,W/2,292,650,21,13,COLORS.shine,"center");this.label(`WANTS: ${profile.desire}`,W/2,398,11,COLORS.jade,"center");this.drawWrappedText(`FEAR: ${profile.fear}  •  FLAW: ${profile.flaw}`,W/2,428,660,18,10,COLORS.blue,"center");this.label(profile.gameplay.toUpperCase(),W/2,510,9,COLORS.pink,"center");
    }else this.drawWrappedText(entry.body,W/2,302,650,24,14,COLORS.shine,"center");
    this.label(`HI ${String(this.settings.highScore).padStart(7,"0")}  •  JADE DOORS ${this.settings.fragments.length}/12  •  LOOKS ${this.settings.unlockedSkins.length}/4`,W/2,605,11,COLORS.blue,"center");this.label("← → / JUMP / BUBBLE: TURN PAGE  •  START / PAUSE: RETURN",W/2,655,11,COLORS.shine,"center")
  }
  private drawHeartBubble(x:number,y:number,r:number){const c=this.ctx;c.save();c.fillStyle="rgba(255,42,157,.12)";c.strokeStyle=COLORS.pink;c.lineWidth=5;c.shadowBlur=24;c.shadowColor=COLORS.pink;c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill();c.stroke();c.shadowBlur=0;this.drawHeart(x,y+4,r*.55,"#8c164f");c.restore()}
  private drawHeart(x:number,y:number,s:number,color:string){const c=this.ctx;c.fillStyle=color;c.beginPath();c.moveTo(x,y+s*.8);c.bezierCurveTo(x-s*1.2,y,x-s*.7,y-s*.8,x,y-s*.25);c.bezierCurveTo(x+s*.7,y-s*.8,x+s*1.2,y,x,y+s*.8);c.fill()}
  private drawSerpent(x:number,y:number,color:string,dir:number){const c=this.ctx;c.strokeStyle=color;c.lineWidth=17;c.lineCap="square";c.beginPath();c.moveTo(x,y);c.bezierCurveTo(x+130*dir,y-60,x+170*dir,y+90,x+300*dir,y+20);c.stroke();c.fillStyle=color;c.beginPath();c.moveTo(x+300*dir,y+20);c.lineTo(x+275*dir,y);c.lineTo(x+278*dir,y+42);c.fill()}
  private drawStars(){const c=this.ctx;for(let i=0;i<58;i++){const x=(i*173)%W,y=(i*97)%H,b=i%3===0?3:1;c.fillStyle=i%7===0?COLORS.pink:i%5===0?COLORS.jade:COLORS.blue;c.fillRect(x,y,b,b)}}
  private drawGothicFrame(color:string){const c=this.ctx;c.strokeStyle=color;c.lineWidth=4;c.strokeRect(14,14,W-28,H-28);c.strokeRect(24,24,W-48,H-48);for(const [x,y,sx,sy] of [[25,25,1,1],[W-25,25,-1,1],[25,H-25,1,-1],[W-25,H-25,-1,-1]]){c.beginPath();c.moveTo(x,y+45*sy);c.lineTo(x,y);c.lineTo(x+45*sx,y);c.stroke();c.strokeRect(x+9*sx-(sx<0?8:0),y+9*sy-(sy<0?8:0),8,8)}}
  private drawGothicBox(x:number,y:number,w:number,h:number,color:string){const c=this.ctx;c.strokeStyle=color;c.lineWidth=3;c.strokeRect(x,y,w,h);c.strokeRect(x+10,y+10,w-20,h-20)}
  private banner(text:string,y:number,color:string){const c=this.ctx;c.save();c.fillStyle="rgba(5,5,9,.88)";c.fillRect(90,y-55,780,88);c.strokeStyle=color;c.lineWidth=3;c.strokeRect(95,y-50,770,78);c.shadowBlur=18;c.shadowColor=color;this.label(text,W/2,y,32,color,"center","Georgia");c.restore()}
  private drawWrappedText(text:string,x:number,y:number,maxWidth:number,lineHeight:number,size:number,color:string,align:CanvasTextAlign="left"){
    const c=this.ctx;c.font=`900 ${size}px monospace`;const words=text.split(/\s+/);const lines:string[]=[];let line="";
    for(const word of words){const test=line?`${line} ${word}`:word;if(c.measureText(test).width>maxWidth&&line){lines.push(line);line=word}else line=test}if(line)lines.push(line);
    lines.slice(0,6).forEach((value,index)=>this.label(value,x,y+index*lineHeight,size,color,align));
  }
  private label(text:string,x:number,y:number,size:number,color:string,align:CanvasTextAlign="left",family="monospace"){const c=this.ctx;c.fillStyle=color;c.textAlign=align;c.textBaseline="alphabetic";c.font=`900 ${size}px ${family}, monospace`;c.fillText(text,x,y)}
}
