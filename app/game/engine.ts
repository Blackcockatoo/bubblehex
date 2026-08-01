import { LEVELS, BONUS_LEVEL, ENCORE_LEVELS, type EnemyKind, type EnemyVariant, type Level, type Platform } from "./levels";
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
import { DEFAULT_SETTINGS, migrateSettings, type EncoreMedal, type PersistedSettings } from "./persistence";
import { computeStageBreakdown, isNewCampaignRecord, isNewStageRecord } from "./scoring";
import {
  ENEMY_CONSCIOUSNESS_NAMES, enemyRankForStage, enemyXp, isEliteEnemy, nextHeroMilestone,
  progressAfterXp, stageClearXp, unlockedHeroUpgrades, type EnemyConsciousness,
} from "./progression";
import { blockForPlatform, type PlatformBlockDefinition } from "./blocks";
import { drawHeroArt, type HeroMotion, type HeroPose } from "./hero-art";
import { checkpointLevelAfterClear, createRuntimeCheckpoint, type RuntimeCheckpoint } from "./checkpoints";
import { BASE_CHAIN_RADIUS, CHAIN_GRACE_SECONDS, PULSE_CHAIN_RADIUS, bubbleLifetimeRatio, collectChain, resolveBubbleCollisions } from "./bubble-system";
import {
  activePlatforms, applyChainToEnvironment, bodyIntersectsRect, bubbleLiftAt, closedGates,
  createEnvironmentState, currentAt, environmentSecretReady, gravityScaleAt, pointInRect,
  previewPlatforms, revealMirrors, thornState, tickEnvironment, toggleValve, touchCandle,
  type EnvironmentState,
} from "./environment";
import { normalizeEnemyVariant, variantCue, variantLabel } from "./enemy-grammar";
import { heroRules } from "./hero-rules";
import {
  HOST_ANCHORS, SHARED_VOW_ECHOES, advanceWidowAct, chargeHostAnchor, createWidowBossProgress,
  findVowBridgeAnchor, hostAnchorsComplete, makeWidowPhaseCheckpoint, registerVowChain, splitClauseCopies,
  type WidowAct, type WidowBossPhase, type WidowPhaseCheckpoint,
} from "./widow-boss";

export type Action = "left" | "right" | "jump" | "bubble" | "start" | "pause" | "consciousness" | "mode";
type GameState = "boot" | "title" | "attract" | "characterSelect" | "stageIntro" | "playing" | "hurry" | "dying" | "stageClear" | "paused" | "gameOver" | "victory" | "records/options";
type EnemyState = "normal" | "trapped" | "furious" | "dead";
type BubblePhase = "fired" | "slowing" | "floating" | "occupied" | "warning" | "bound" | "burst";

type Player = {
  x:number;y:number;previousX:number;previousY:number;vx:number;vy:number;w:number;h:number;
  grounded:boolean;facing:1|-1;invuln:number;flying:number;
  maxJumps:number;jumpsRemaining:number;jumpCut:boolean;jumpAge:number;currentPlatformId:number|null;
  runPhase:number;throwTimer:number;landTimer:number;landPower:number;portalCooldown:number;
};
type Enemy = { id:number;x:number;y:number;prevX:number;prevY:number;vx:number;vy:number;w:number;h:number;kind:EnemyKind;variant:EnemyVariant;group?:string;state:EnemyState;timer:number;cooldown:number;homeX:number;homeY:number;weakened:boolean;rank:number;elite:boolean;portalCooldown:number;turns:number;roostAwake:boolean };
type Bubble = { id:number;x:number;y:number;prevX:number;prevY:number;vx:number;vy:number;r:number;age:number;phase:BubblePhase;enemyId?:number;life:number;lifeMax:number;portalCooldown:number;anchored:boolean;boundEcho?:number };
type Reward = { x:number;y:number;vy:number;kind:string;value:number;life:number;letter?:string;risk?:boolean;id?:string };
type Projectile = { x:number;y:number;vx:number;vy:number;life:number;kind:"tear"|"star" };
type Particle = { x:number;y:number;vx:number;vy:number;life:number;color:string;size:number };
type WidowState = { x:number;y:number;prevX:number;prevY:number;vx:number;vy:number;age:number;hp:number;maxHp:number;phase:WidowBossPhase;phaseTimer:number;lungeAngle:number;act:WidowAct;chargedAnchors:number;vowEchoes:number };
type Widow = WidowState | null;
type Cheats = { power:boolean;super:boolean;extra:boolean };
const WIDOW_ENEMY_ID = -1;
type Settings = PersistedSettings;

const FIXED=1/60;
const COLORS={void:"#050509",midnight:"#081A3A",blue:"#087CFF",pink:"#FF2A9D",crimson:"#C4133D",jade:"#20C98B",shine:"#FFD6F1"};
const TOKENS:Record<Action,Token|undefined>={left:"LEFT",right:"RIGHT",jump:"JUMP",bubble:"BUBBLE",start:"START",pause:undefined,consciousness:undefined,mode:undefined};
const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));
const lerp=(a:number,b:number,t:number)=>a+(b-a)*t;
const dist=(a:{x:number;y:number},b:{x:number;y:number})=>Math.hypot(a.x-b.x,a.y-b.y);
const overlaps=(a:{x:number;y:number;w:number;h:number},b:{x:number;y:number;w:number;h:number})=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;

export class BubbleHexEngine {
  private canvas:HTMLCanvasElement; private ctx:CanvasRenderingContext2D; private audio=new AudioManager();
  private frame=0; private last=0; private acc=0; private alive=true; private ready:()=>void;
  private state:GameState="boot"; private stateTime=0; private titleIdle=0; private startGrace=0;
  private held:Record<Action,boolean>={left:false,right:false,jump:false,bubble:false,start:false,pause:false,consciousness:false,mode:false};
  private just=new Set<Action>(); private hero:HeroId="vesper"; private selected:HeroId="vesper";
  private player:Player=this.makePlayer();
  private enemies:Enemy[]=[]; private bubbles:Bubble[]=[]; private rewards:Reward[]=[]; private projectiles:Projectile[]=[]; private particles:Particle[]=[];
  private nextId=1; private levelIndex=0; private level:Level=LEVELS[0]; private levelTime=0; private lives=3; private score=0;
  private comboText=""; private comboLife=0; private message=""; private messageLife=0; private widow:Widow=null; private widowTime=0;
  private venom=new Set<string>(); private cheats:Cheats={power:false,super:false,extra:false}; private cheatReader=new CheatReader();
  private upgrades={speed:false,rapid:false,range:false,velocity:false,shield:false,venom:false,chain:false,crown:false};
  private bubbleEffect:"none"|"anchor"|"pulse"|"echo"|"venom"="none";
  private fireCooldown=0; private stageKills=0; private trappedBeforeFirstPop=0; private firstPop=false; private touchedFloor=false; private bestChain=0;
  private stageTrapScore=0; private stageReleaseScore=0; private stagePickupScore=0; private stageChainBonus=0; private stageRiskScore=0; private damageTaken=0;
  private coyote=0; private jumpBuffer=0;
  private settings:Settings={...DEFAULT_SETTINGS,selectedSkins:{...DEFAULT_SETTINGS.selectedSkins},unlockedSkins:[...DEFAULT_SETTINGS.unlockedSkins],unlockedCodex:[...DEFAULT_SETTINGS.unlockedCodex],fragments:[]}; private musicClock=0;
  private shake=0; private hitStop=0; private attractTime=0; private secretFound=false; private endingText=""; private animTime=0;
  private gamepadPrev={jump:false,bubble:false,start:false,pause:false,mode:false};
  private debug=false; private platformAudit:PlatformAudit[]=[]; private landedThisFrame=false;
  private art=new GameArtAssets(); private archiveIndex=0; private audioReady=false;
  private readonly devTools:boolean=Boolean(import.meta.env?.DEV);
  private inBonus=false; private bonusVisited=false; private stageStartScore=0; private stageDamaged=false; private newRecord=false;
  private runMode:"story"|"encore"="story"; private encoreIndex=0;
  private checkpoint:RuntimeCheckpoint|null=null; private bossCheckpoint:WidowPhaseCheckpoint|null=null;
  private environmentState:EnvironmentState=createEnvironmentState(LEVELS[0]); private runtimePlatforms:Platform[]=LEVELS[0].platforms;
  private valveCooldown=0; private valveContacts=new Set<string>(); private pendingChain:{rootId:number;timer:number}|null=null; private chainBursts:{bubbleId:number;mult:number;chain:number;timer:number}[]=[];
  private echoPops:{x:number;y:number;timer:number}[]=[]; private enemyEchoes:{kind:EnemyKind;x:number;y:number;timer:number}[]=[];
  private briars:{x:number;y:number;w:number;timer:number}[]=[]; private timeFractureClock=0;
  private previousBestScore=0; private previousBestChain=0; private medalsEarned:EncoreMedal[]=[];
  private stageBreakdown={kills:0,trapScore:0,releaseScore:0,pickupScore:0,chainBonus:0,riskScore:0,fullRoomBonus:0,speedBonus:0,lifeBonus:0,noDamageBonus:0,secretBonus:0,total:0};
  private stageXp=0;
  // Fraction of the way from the last completed 60Hz tick to the next one, used to
  // interpolate on-screen positions between ticks so motion stays smooth even when
  // the display refreshes faster or slower than the fixed simulation rate.
  private renderAlpha=0;

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
    return {x:55,y,previousX:55,previousY:y,vx:0,vy:0,w:PLAYER_WIDTH,h:PLAYER_HEIGHT,grounded:true,facing:1,invuln,flying:0,maxJumps:MAX_JUMPS,jumpsRemaining:MAX_JUMPS,jumpCut:false,jumpAge:0,currentPlatformId:platformId,runPhase:0,throwTimer:0,landTimer:0,landPower:0,portalCooldown:0};
  }
  private resetPlayer(invuln=0){
    const floorId=this.runtimePlatforms.reduce((best,platform,index)=>platform.y>this.runtimePlatforms[best].y?index:best,0);
    this.player=this.makePlayer(invuln,this.runtimePlatforms[floorId].y,floorId);
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
      enemyConsciousness:String(this.settings.enemyConsciousness),enemyRank:String(this.threatRank()),
      runMode:this.runMode,checkpointStage:this.checkpoint?String(this.checkpoint.levelIndex+1):"",bubbleEffect:this.bubbleEffect,
      environmentTime:this.environmentState.time.toFixed(2),widowAct:this.widow?.act??"",bestChain:String(this.bestChain),
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
    if(code==="Enter")return"start";if(code==="Escape"||code==="KeyP")return"pause";if(code==="ArrowUp"||code==="KeyW")return"consciousness";if(code==="ArrowDown"||code==="KeyS"||code==="KeyM")return"mode";
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
    this.stateTime+=dt;this.animTime+=dt;this.titleIdle+=this.state==="title"?dt:0;this.messageLife=Math.max(0,this.messageLife-dt);this.comboLife=Math.max(0,this.comboLife-dt);this.shake=Math.max(0,this.shake-dt*18);
    if(this.hitStop>0){this.hitStop-=dt;this.just.clear();return}
    if(this.state==="boot"&&this.stateTime>.55&&this.art.state!=="loading")this.toTitle();
    else if(this.state==="title")this.updateTitle(dt);
    else if(this.state==="characterSelect")this.updateSelect();
    else if(this.state==="stageIntro"&&this.stateTime>1.65)this.setState("playing");
    else if(this.state==="playing")this.updatePlaying(dt,false);
    else if(this.state==="hurry")this.updateHurry(dt);
    else if(this.state==="attract")this.updatePlaying(dt,true);
    else if(this.state==="dying"&&this.stateTime>1.15)this.afterDeath();
    else if(this.state==="stageClear"&&((this.stateTime>.85&&(this.just.has("start")||this.just.has("jump")))||this.stateTime>3.4))this.nextStage();
    else if(this.state==="gameOver"&&(this.just.has("start")||this.just.has("jump")))this.toTitle();
    else if(this.state==="victory"&&(this.just.has("start")||this.just.has("jump")))this.toTitle();
    else if(this.state==="paused")this.updatePause();
    else if(this.state==="records/options")this.updateArchive();
    this.syncAuditData();this.just.clear();
  }
  private updateTitle(dt:number){
    if(this.startGrace>0){this.startGrace-=dt;if(this.startGrace<=0)this.setState("characterSelect")}
    if(this.titleIdle>15)this.beginAttract();
    if(this.just.has("consciousness"))this.cycleEnemyConsciousness();
    if(this.just.has("mode"))this.toggleRunMode();
    if(this.just.has("pause"))this.setState("records/options");
  }
  private updateSelect(){
    if(this.just.has("left")||this.just.has("right")){this.selected=this.selected==="vesper"?"jade":"vesper";this.audio.tone(this.selected==="jade"?520:310)}
    if(this.just.has("bubble")){this.cycleSkin(this.selected);this.audio.reward()}
    if(this.just.has("consciousness"))this.cycleEnemyConsciousness();
    if(this.just.has("mode"))this.toggleRunMode();
    if(this.just.has("start")||this.just.has("jump")){this.hero=this.selected;this.beginRun()}
    if(this.just.has("pause"))this.toTitle();
  }
  private toggleRunMode(){
    if(this.settings.storyClears<=0){this.runMode="story";this.message="ENCORE OPENS AFTER DAWN";this.messageLife=1.5;this.audio.tone(180,.1,"square",-40,.08);return}
    this.runMode=this.runMode==="story"?"encore":"story";this.message=this.runMode==="encore"?"ENCORE CHAMBERS":"STORY CHAMBERS";this.messageLife=1.4;this.audio.reward();
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
    const progress=boss?createWidowBossProgress(this.cheats.super):{act:"split" as const,phase:"chase" as const,hp:0,maxHp:0,chargedAnchors:0,vowEchoes:0};
    return {x,y,prevX:x,prevY:y,vx:0,vy:0,age:0,phaseTimer:0,lungeAngle:0,...progress};
  }
  private updatePlaying(dt:number,demo:boolean){
    if(demo){this.attractTime+=dt;if(this.attractTime>11){this.toTitle();return}this.held.right=this.player.x<720;this.held.left=this.player.x>=720;this.held.bubble=Math.floor(this.attractTime*2)%2===0;if(this.player.grounded&&Math.floor(this.attractTime*1.3)%3===0)this.just.add("jump")}
    this.updateWorld(dt,true,demo);
    if(!demo){this.levelTime-=dt;if(this.levelTime<=0&&!this.widow){this.audio.hurry();this.setState("hurry");return}}
    const bossCleared=this.level.boss?(this.widow?.phase==="defeated"&&this.widow.phaseTimer>1.4):this.enemies.every(e=>e.state==="dead");
    if(bossCleared)this.clearStage(demo);
  }
  private updateWorld(dt:number,allowDamage:boolean,demo:boolean){
    tickEnvironment(this.environmentState,dt);this.runtimePlatforms=activePlatforms(this.level,this.environmentState);
    this.fireCooldown=Math.max(0,this.fireCooldown-dt);this.valveCooldown=Math.max(0,this.valveCooldown-dt);this.player.invuln=Math.max(0,this.player.invuln-dt);this.player.flying=Math.max(0,this.player.flying-dt);this.player.portalCooldown=Math.max(0,this.player.portalCooldown-dt);
    for(const enemy of this.enemies)enemy.portalCooldown=Math.max(0,enemy.portalCooldown-dt);for(const bubble of this.bubbles)bubble.portalCooldown=Math.max(0,bubble.portalCooldown-dt);
    this.musicClock-=dt;if(this.musicClock<=0&&this.state==="playing"){const notes=[110,165,220,147];this.audio.tone(notes[(this.stageKills+Math.floor(this.levelTime))%notes.length],.055,"square",0,.025);this.musicClock=this.widow?.2:.34}
    this.updatePlayer(dt);this.updateBubbles(dt);this.updateEnemies(dt);this.updateProjectiles(dt);this.updateRewards(dt);this.updateParticles(dt);this.updateWidow(dt);this.updateEnvironmentInteractions(dt);this.updateEchoes(dt);
    if(allowDamage&&!demo)this.checkDamage();
  }
  private updatePlayer(dt:number){
    const p=this.player;
    const wasGrounded=p.grounded;
    const speed=this.upgrades.speed?POWER_RUN_SPEED:MAX_RUN_SPEED;
    const dir=(this.held.right?1:0)-(this.held.left?1:0);
    const rules=heroRules(this.hero),launchInfluence=!p.grounded&&p.jumpAge<.28?rules.earlyJumpInfluence:1;
    const acceleration=p.grounded?GROUND_ACCELERATION*rules.groundAcceleration:AIR_ACCELERATION*rules.airAcceleration*launchInfluence;
    const deceleration=p.grounded?GROUND_DECELERATION:AIR_DECELERATION*rules.airDeceleration;

    this.coyote=p.grounded?COYOTE_TIME:Math.max(0,this.coyote-dt);
    if(this.just.has("jump"))this.jumpBuffer=JUMP_BUFFER_TIME;
    else this.jumpBuffer=Math.max(0,this.jumpBuffer-dt);

    if(dir){p.vx+=dir*acceleration*dt;p.facing=dir as 1|-1}
    else p.vx+=(p.vx>0?-1:1)*Math.min(Math.abs(p.vx),deceleration*dt);
    p.vx=clamp(p.vx,-speed,speed);

    if(p.grounded&&Math.abs(p.vx)>26)p.runPhase+=dt*(8+9*Math.abs(p.vx)/speed);
    p.throwTimer=Math.max(0,p.throwTimer-dt);p.landTimer=Math.max(0,p.landTimer-dt);
    if(p.grounded&&dir&&Math.sign(p.vx)===-dir&&Math.abs(p.vx)>140&&Math.random()<.35)this.dust(p.x+p.w/2+p.facing*6,p.y+p.h,1);
    else if(p.grounded&&Math.abs(p.vx)>speed*.85&&Math.random()<.1)this.dust(p.x+p.w/2-p.facing*11,p.y+p.h,1);

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
    if(p.flying>0){p.vy+=(this.held.jump?-440:160)*dt;p.vy=clamp(p.vy,-230,230)}else p.vy+=GRAVITY*gravityScaleAt(this.level,p.x+p.w/2,p.y+p.h/2)*dt;

    p.previousX=p.x;p.previousY=p.y;
    p.x+=p.vx*dt;p.x=clamp(p.x,24,W-24-p.w);p.y+=p.vy*dt;
    p.grounded=false;p.currentPlatformId=null;this.landedThisFrame=false;
    const previousBottom=p.previousY+p.h,currentBottom=p.y+p.h;
    const landing=this.runtimePlatforms
      .map((platform,id)=>({platform,id}))
      .filter(({platform})=>p.vy>=0&&p.x+p.w>platform.x+1&&p.x<platform.x+platform.w-1&&previousBottom<=platform.y+2&&currentBottom>=platform.y)
      .sort((a,b)=>a.platform.y-b.platform.y)[0];
    if(landing){
      const impact=p.vy;
      if(!wasGrounded){p.landTimer=.18;p.landPower=clamp(impact/1500,.2,1);if(impact>520)this.dust(p.x+p.w/2,landing.platform.y,6)}
      p.y=landing.platform.y-p.h;p.vy=0;p.grounded=true;p.jumpsRemaining=p.maxJumps;
      p.jumpCut=false;p.jumpAge=0;p.currentPlatformId=landing.id;this.coyote=COYOTE_TIME;this.landedThisFrame=true;
      if(landing.platform.y>=640)this.touchedFloor=true;
    }else if(wasGrounded){
      // Walking off a scaffold consumes the ground action but preserves one recovery jump.
      p.jumpsRemaining=Math.min(1,p.jumpsRemaining);
    }

    for(const b of this.bubbles){
      if((b.phase==="floating"||b.phase==="bound")&&p.vy>=0&&p.x+p.w>b.x-b.r&&p.x<b.x+b.r&&previousBottom<=b.y&&currentBottom>=b.y-b.r*.3){
        p.y=b.y-b.r-p.h;p.vy=JUMP_VELOCITY*.86;p.grounded=false;p.jumpsRemaining=1;p.jumpCut=false;p.jumpAge=0;
        b.life-=1.5;this.audio.tone(250,.07,"sine",170,.07);
      }
    }
    for(const gate of closedGates(this.level,this.environmentState))if(bodyIntersectsRect(p,gate)){
      if(p.previousX+p.w<=gate.x)p.x=gate.x-p.w-1;else if(p.previousX>=gate.x+gate.w)p.x=gate.x+gate.w+1;
      p.vx=0;
    }
    if(p.y>H+80)this.damagePlayer();
  }
  private fireBubble(){
    const p=this.player,rules=heroRules(this.hero),fast=(this.upgrades.velocity?500:390)*rules.bubbleLaunch,bx=p.x+p.w/2+p.facing*28,by=p.y+20;
    const life=(this.upgrades.range?7.8:5.2)+rules.bubbleLifetime;
    this.bubbles.push({id:this.nextId++,x:bx,y:by,prevX:bx,prevY:by,vx:p.facing*fast,vy:0,r:18,age:0,phase:"fired",life,lifeMax:life,portalCooldown:0,anchored:false});
    p.throwTimer=.3;
    if(!this.settings.reducedMotion)for(let i=0;i<4;i++)this.particles.push({x:bx,y:by,vx:p.facing*(60+Math.random()*90),vy:(Math.random()-.5)*70,life:.18+Math.random()*.15,color:this.skinFor(this.hero).bubble,size:2+Math.random()*2});
    this.fireCooldown=this.upgrades.rapid?.17:.36;this.audio.bubble();
  }
  private updateBubbles(dt:number){
    for(const b of this.bubbles){
      b.age+=dt;b.life-=dt;if(b.phase==="burst")continue;
      if(b.phase==="fired"&&b.age>.18)b.phase="slowing";
      if(b.phase==="slowing"){b.vx*=Math.pow(.08,dt);if(Math.abs(b.vx)<48)b.phase="floating"}
      const current=currentAt(this.level,this.environmentState,b.x,b.y),control=heroRules(this.hero).currentInfluence,lift=bubbleLiftAt(this.level,b.x,b.y);
      if(b.phase==="floating"&&!b.anchored){b.vx+=current.x*85*control*dt;b.vy+=(current.y*130*control+lift)*dt;b.vy=clamp(b.vy,-92,38)}
      if((b.phase==="occupied"||b.phase==="warning"||b.phase==="bound")&&!b.anchored){b.vx+=current.x*45*control*dt;b.vy=-27+Math.sin(b.age*4)*8+lift*.08;if(b.phase!=="bound"&&b.life<b.lifeMax*.22)b.phase="warning"}
      b.prevX=b.x;b.prevY=b.y;b.x+=b.vx*dt;b.y+=b.vy*dt;
      const wall=b.x<b.r+25||b.x>W-b.r-25,ceiling=b.y<94;
      if(wall)b.vx*=-.75;if(ceiling){b.y=94;b.vy=Math.abs(b.vy)*.25}
      const surface=this.runtimePlatforms.some(platform=>b.x>platform.x&&b.x<platform.x+platform.w&&Math.abs((b.y+b.r)-platform.y)<7);
      if(this.bubbleEffect==="anchor"&&(wall||ceiling||surface)){b.anchored=true;b.vx=0;b.vy=0}
      if((b.phase==="fired"||b.phase==="slowing"||b.phase==="floating"))this.tryTrap(b);
      if(b.life<=0){if(b.enemyId)this.releaseEnemy(b);b.phase="burst"}
    }
    resolveBubbleCollisions(this.bubbles);
    for(const b of this.bubbles)if((b.phase==="occupied"||b.phase==="warning"||b.phase==="bound")&&this.playerBubbleHit(b)&&!this.pendingChain)this.popChain(b);
    if(this.pendingChain){this.pendingChain.timer-=dt;if(this.pendingChain.timer<=0)this.resolvePendingChain()}this.updateChainBursts(dt);
    this.bubbles=this.bubbles.filter(b=>b.phase!=="burst"&&b.life>-1);
  }
  private tryTrap(b:Bubble){
    const vowAnchor=this.widow?findVowBridgeAnchor(this.widow,b,this.bubbles):undefined;
    if(vowAnchor){
      b.r=22;const angle=Math.atan2(b.y-vowAnchor.y,b.x-vowAnchor.x),safeAngle=Number.isFinite(angle)?angle:(this.player.facing>0?0:Math.PI),spacing=vowAnchor.r+b.r+2;
      b.x=vowAnchor.x+Math.cos(safeAngle)*spacing;b.y=vowAnchor.y+Math.sin(safeAngle)*spacing;b.prevX=b.x;b.prevY=b.y;b.phase="bound";b.life=12;b.lifeMax=12;b.vx=0;b.vy=0;b.anchored=true;
      this.message="VOW BUBBLE BOUND · BUILD ONE CHAIN";this.messageLife=1.05;this.audio.trap();return;
    }
    if(this.widow&&this.level.boss&&this.widow.phase==="staggered"&&dist(b,this.widow)<b.r+40){
      this.widow.phase="trapped";this.widow.phaseTimer=0;
      b.phase="occupied";b.enemyId=WIDOW_ENEMY_ID;b.life=6;b.lifeMax=6;b.vx*=.1;b.vy=-18;b.r=36;
      this.audio.trap();this.burstParticles(b.x,b.y,COLORS.crimson,14);
      return;
    }
    for(const e of this.enemies){if(e.state!=="normal"&&e.state!=="furious")continue;const cue=variantCue(e.kind,e.variant,e.timer,dist(this.player,e));if(cue==="closed")continue;if(dist(b,e)<b.r+26){e.state="trapped";e.timer=0;e.weakened=this.upgrades.venom;b.phase="occupied";b.enemyId=e.id;const resistance=Math.max(.58,1-(e.rank-1)*.08-(e.elite?.08:0));b.life=(e.weakened?6.4:5.4)*resistance+heroRules(this.hero).bubbleLifetime*.7;b.lifeMax=b.life;b.vx*=.15;b.vy=-24;b.r=25;this.trappedBeforeFirstPop++;const trapValue=35*e.rank*(e.elite?2:1);this.score+=trapValue;this.stageTrapScore+=trapValue;this.audio.trap();this.burstParticles(b.x,b.y,e.weakened?COLORS.jade:COLORS.pink,8);break}}
  }
  private playerBubbleHit(b:Bubble){const p=this.player;return p.x<b.x+b.r&&p.x+p.w>b.x-b.r&&p.y<b.y+b.r&&p.y+p.h>b.y-b.r}
  private popChain(root:Bubble){
    this.pendingChain={rootId:root.id,timer:CHAIN_GRACE_SECONDS};this.comboText="CHAIN READY";this.comboLife=CHAIN_GRACE_SECONDS+.18;
  }
  private resolvePendingChain(){
    const pending=this.pendingChain;if(!pending)return;this.pendingChain=null;
    const activeEffect=this.bubbleEffect;
    const link=activeEffect==="pulse"||(activeEffect==="venom"&&!!this.level.boss)||this.upgrades.chain?PULSE_CHAIN_RADIUS:BASE_CHAIN_RADIUS;
    let ids=collectChain(this.bubbles,pending.rootId,link);
    if(activeEffect==="venom"&&ids.length&&!this.level.boss)ids=this.bubbles.filter(b=>b.phase==="occupied"||b.phase==="warning"||b.phase==="bound").map(b=>b.id);
    const chain=ids.map(id=>this.bubbles.find(b=>b.id===id)).filter((bubble):bubble is Bubble=>!!bubble);
    if(!chain.length)return;
    this.firstPop=true;this.bestChain=Math.max(this.bestChain,chain.length);const mult=[1,2,3,4,6,8,13][Math.min(chain.length-1,6)];
    const kinds=chain.map(b=>this.enemies.find(enemy=>enemy.id===b.enemyId)?.kind).filter((kind):kind is EnemyKind=>!!kind);
    const environmentResult=applyChainToEnvironment(this.level,this.environmentState,chain.length,kinds);
    if(environmentResult.score){this.score+=environmentResult.score;this.stagePickupScore+=environmentResult.score;this.message=environmentResult.message??"MEMORY RESTORED";this.messageLife=1.4;this.audio.secret()}
    if(this.widow?.act==="vow"){
      const echoes=chain.filter(b=>b.phase==="bound").length;
      Object.assign(this.widow,registerVowChain(this.widow,echoes));
      if(echoes>=SHARED_VOW_ECHOES.length)this.hitWidow(true);else if(echoes>0){this.message=`THE VOW NEEDS ${SHARED_VOW_ECHOES.length} ECHOES TOGETHER`;this.messageLife=1.6}
    }
    chain.forEach((b,i)=>this.chainBursts.push({bubbleId:b.id,mult,chain:i+1,timer:i*.055}));
    if(activeEffect==="echo"||this.level.environment?.echoBubbles){const centre=chain.reduce((sum,b)=>({x:sum.x+b.x/chain.length,y:sum.y+b.y/chain.length}),{x:0,y:0});this.echoPops.push({...centre,timer:.42})}
    if(activeEffect!=="none")this.bubbleEffect="none";
    if(chain.length>=6){this.comboText="HEARTBREAK ×6";this.comboLife=1.55;this.hitStop=this.settings.reducedMotion?0:.1;this.shake=this.settings.reducedMotion?0:7}
    else{this.comboText=`CHAIN ×${mult}`;this.comboLife=.8}
  }
  private updateChainBursts(dt:number){
    for(const burst of this.chainBursts)burst.timer-=dt;
    const due=this.chainBursts.filter(burst=>burst.timer<=0);this.chainBursts=this.chainBursts.filter(burst=>burst.timer>0);
    for(const burst of due){const bubble=this.bubbles.find(item=>item.id===burst.bubbleId);if(bubble&&bubble.phase!=="burst")this.resolveBubble(bubble,burst.mult,burst.chain)}
  }
  private resolveBubble(b:Bubble,mult:number,chain:number){
    if(b.enemyId===WIDOW_ENEMY_ID){this.hitWidow();b.phase="burst";b.life=-.1;this.audio.pop(chain);this.burstParticles(b.x,b.y,COLORS.crimson,18);return}
    const enemy=this.enemies.find(e=>e.id===b.enemyId);if(enemy){enemy.state="dead";this.stageKills++;const base=100*enemy.rank*(enemy.elite?2:1),value=base*mult;this.score+=value;this.stageReleaseScore+=value;this.stageChainBonus+=value-base;if(this.state!=="attract")this.gainHeroXp(enemyXp(enemy.kind,enemy.rank,enemy.elite));this.spawnReward(b.x,b.y,chain)}b.phase="burst";b.life=-.1;this.audio.pop(chain);this.burstParticles(b.x,b.y,chain%2?COLORS.pink:COLORS.jade,14);
  }
  private hitWidow(fromVow=false){
    const w=this.widow;if(!w)return;
    if(w.act==="host"&&!hostAnchorsComplete(w))return;
    if(w.act==="vow"&&!fromVow&&w.vowEchoes<SHARED_VOW_ECHOES.length)return;
    this.score+=2500;this.stageReleaseScore+=2500;
    this.shake=this.settings.reducedMotion?0:10;this.hitStop=this.settings.reducedMotion?0:.12;this.audio.bossHit();
    const next=advanceWidowAct(w);Object.assign(w,next);
    if(w.phase==="defeated"){this.beginWidowDefeat();return}
    w.phaseTimer=0;w.x=clamp(w.x,80,W-80);w.y=clamp(w.y,120,H-120);
    if(w.act==="split"){this.message="PHASE TWO · THE SPLIT CLAUSE";this.messageLife=2.2}
    else{this.enemies.forEach(enemy=>enemy.state="dead");this.projectiles=[];this.bubbles=[];this.message="PHASE THREE · THE SHARED VOW";this.messageLife=2.2;this.ensureVowBubbles()}
    this.bossCheckpoint=makeWidowPhaseCheckpoint(w,this.score);
  }
  private beginWidowDefeat(){
    const w=this.widow;if(!w)return;
    w.phase="defeated";w.phaseTimer=0;w.vx=0;w.vy=0;this.score+=6000;this.stageReleaseScore+=6000;
    this.shake=this.settings.reducedMotion?0:14;this.hitStop=this.settings.reducedMotion?0:.22;
    this.burstParticles(w.x,w.y,COLORS.crimson,40);this.burstParticles(w.x,w.y,COLORS.pink,26);
    this.message="THE WIDOW UNRAVELS";this.messageLife=2.4;this.audio.secret();
  }
  private releaseEnemy(b:Bubble){
    if(b.enemyId===WIDOW_ENEMY_ID){if(this.widow){this.widow.phase=this.widow.act==="host"?"host":this.widow.act==="split"?"chase":"vow";this.widow.phaseTimer=0;this.widow.x=b.x;this.widow.y=b.y;this.widow.vx=(this.player.x<b.x?1:-1)*80;this.widow.vy=-40}b.enemyId=undefined;return}
    const e=this.enemies.find(e=>e.id===b.enemyId);if(e){e.state="furious";e.x=b.x-e.w/2;e.y=b.y-e.h/2;e.vx=(this.player.x<e.x?-1:1)*220*(1+(e.rank-1)*.1+(e.elite?.15:0));e.timer=8}b.enemyId=undefined;
  }
  private updateEnemies(dt:number){
    for(const e of this.enemies){if(e.state==="dead"||e.state==="trapped")continue;e.timer+=dt;e.cooldown-=dt;const playerDistance=dist(this.player,e),cue=variantCue(e.kind,e.variant,e.timer,playerDistance);const power=1+(e.rank-1)*.1+(e.elite?.15:0);const rage=(e.state==="furious"?(e.weakened?1.1:1.55):(e.weakened?.75:1))*power;
      if(e.kind==="bat"){
        if(e.variant==="roost"&&!e.roostAwake)e.roostAwake=this.bubbles.some(b=>Math.abs(b.x-e.x)<95&&b.y>e.y);
        if(e.variant==="roost"&&!e.roostAwake){e.vx=0;e.vy=Math.sin(e.timer*2)*4}
        else if(e.variant==="feint"&&cue==="warning"){e.vx*=.88;e.vy*=.88}
        else if(e.variant==="feint"&&cue==="attack"){const falseDive=(e.timer%4.2)<3.05?-1:1;e.vx+=(this.player.x-e.x)*.9*dt*falseDive;e.vy+=(this.player.y-e.y)*.9*dt*falseDive;e.vx=clamp(e.vx,-185*rage,185*rage);e.vy=clamp(e.vy,-145*rage,175*rage)}
        else if(Math.abs(this.player.x-e.x)<330||e.state==="furious"||e.roostAwake){e.vx+=(this.player.x-e.x)*.7*dt;e.vy+=(this.player.y-e.y)*.7*dt;e.vx=clamp(e.vx,-150*rage,150*rage);e.vy=clamp(e.vy,-120*rage,145*rage)}else{e.vx=Math.sin(e.timer*2)*45;e.vy=Math.sin(e.timer*3)*15}
      }
      else if(e.kind==="eye"){
        e.vx=0;e.vy=0;
        if(e.variant==="sweep"&&cue==="attack"&&e.cooldown<=0){const base=-.35;for(let i=0;i<4;i++){const a=base+i*.23;this.projectiles.push({x:e.x+16,y:e.y+15,vx:Math.cos(a)*115*rage,vy:Math.sin(a)*115*rage,life:6,kind:"tear"})}e.cooldown=3.1;this.audio.tone(250,.18,"sawtooth",180,.08)}
        else if(cue!=="closed"&&e.variant!=="sweep"&&e.cooldown<=0){const a=Math.atan2(this.player.y-e.y,this.player.x-e.x);this.projectiles.push({x:e.x+16,y:e.y+15,vx:Math.cos(a)*95*rage,vy:Math.sin(a)*95*rage,life:6,kind:"tear"});e.cooldown=(e.state==="furious"?1.1:2.4)/power}
      }
      else if(e.kind==="witch"){
        const dx=this.player.x-e.x,chorus=(e.variant==="chorus"&&this.enemies.some(other=>other!==e&&other.state!=="dead"&&(other.group&&other.group===e.group||dist(other,e)<170)))?1.25:1;
        e.vx=(Math.abs(dx)<190?-Math.sign(dx):Math.sign(dx))*70*rage;
        if(e.variant==="orbit"&&cue==="warning")e.vx*=.25;
        if((e.variant!=="orbit"||cue==="attack")&&e.cooldown<=0){const a=Math.atan2(this.player.y-e.y,this.player.x-e.x);this.projectiles.push({x:e.x,y:e.y,vx:Math.cos(a)*145*power*chorus,vy:Math.sin(a)*145*power*chorus,life:4,kind:"star"});e.cooldown=(e.state==="furious"?1:2.2)/power;this.audio.tone(e.variant==="chorus"?690:540,.08,"triangle",-80,.055)}
      }
      else if(e.kind==="doll"){
        const charge=e.variant==="charge"?e.timer%3.4>2.55:cue==="attack";
        if(cue==="warning")e.vx*=.75;else e.vx=(this.player.x<e.x?-1:1)*(charge?(e.variant==="windup"?300:260):55)*rage;
        if(e.variant==="frayed"&&e.turns<1&&Math.sign(this.player.x-e.x)!==Math.sign(e.vx)&&Math.abs(this.player.x-e.x)>90){e.vx*=-1;e.turns++}
        e.vy+=1000*dt;
      }
      else if(e.kind==="skull"){
        const target=e.variant==="anchor"?e.homeX:this.player.x;e.vx=(target<e.x?-1:1)*(e.variant==="anchor"?75:145)*rage;e.vy+=900*dt;
        if(e.timer%2.2<dt)e.vy=-350;
        if(e.variant==="briar"&&cue==="attack"&&e.cooldown<=0){this.briars.push({x:e.x-35,y:e.y+e.h-9,w:105,timer:1.4});e.cooldown=2.5;this.audio.tone(120,.16,"square",90,.08)}
      }
      else{
        if(e.variant==="paired"&&e.group){const partner=this.enemies.find(other=>other!==e&&other.group===e.group&&other.state!=="dead");if(partner&&Math.abs(partner.x-e.x)>145)e.vx=Math.sign(partner.x-e.x)*78*rage;else e.vx=(e.vx>=0?1:-1)*70*rage}
        else{const excited=e.variant==="excited"&&this.enemies.some(other=>other.state==="trapped");e.vx=(e.vx>=0?1:-1)*70*rage*(excited?1.42:1)}
        e.vy+=1000*dt;
      }
      const oldX=e.x,oldY=e.y;e.x+=e.vx*dt;e.y+=e.vy*dt;if(e.x<28){e.x=28;e.vx=Math.abs(e.vx)}if(e.x>W-e.w-28){e.x=W-e.w-28;e.vx=-Math.abs(e.vx)}
      if(e.kind!=="bat"&&e.kind!=="eye"&&e.kind!=="witch")for(const plat of this.runtimePlatforms){if(e.x+e.w>plat.x&&e.x<plat.x+plat.w&&oldY+e.h<=plat.y+4&&e.y+e.h>=plat.y&&e.vy>=0){e.y=plat.y-e.h;e.vy=0;if(e.kind==="love"){const edge=e.vx>0?e.x+e.w+7:e.x-7;if(edge<plat.x||edge>plat.x+plat.w)e.vx*=-1}}}
      for(const drain of this.level.environment?.drains??[])if(bodyIntersectsRect(e,drain)){const centre=drain.x+drain.w/2;e.vx+=Math.sign(centre-(e.x+e.w/2))*drain.pull*dt;e.weakened=true}
      e.prevX=oldX;e.prevY=oldY;
      if(e.y>H+50){e.y=e.homeY;e.x=e.homeX;e.vy=0;e.prevX=e.x;e.prevY=e.y;e.cooldown=1}
    }
  }
  private updateProjectiles(dt:number){for(const p of this.projectiles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt}this.projectiles=this.projectiles.filter(p=>p.life>0&&p.x>-20&&p.x<W+20&&p.y>-20&&p.y<H+20)}
  private updateRewards(dt:number){
    for(const r of this.rewards){r.vy+=340*dt;r.y+=r.vy*dt;r.life-=dt;for(const pl of this.runtimePlatforms)if(r.x>pl.x&&r.x<pl.x+pl.w&&r.y>pl.y-8&&r.y<pl.y+12&&r.vy>0){r.y=pl.y-9;r.vy*=-.2}
      if(Math.hypot(this.player.x+17-r.x,this.player.y+24-r.y)<38){this.collectReward(r);r.life=-1}}
    this.rewards=this.rewards.filter(r=>r.life>0);
  }
  private updateParticles(dt:number){for(const p of this.particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=180*dt;p.life-=dt}this.particles=this.particles.filter(p=>p.life>0)}
  private updateEnvironmentInteractions(dt:number){
    const px=this.player.x+this.player.w/2,py=this.player.y+this.player.h/2;
    const revealed=revealMirrors(this.level,this.environmentState,px,py);if(revealed.length){this.message="MIRROR SHOWS THE TRUE STEP";this.messageLife=1.3;this.audio.secret()}
    const contacts=new Set<string>();
    for(const valve of this.level.environment?.valves??[]){
      if(Math.hypot(px-valve.x,py-valve.y)<38){contacts.add(valve.id);if(!this.valveContacts.has(valve.id)&&this.valveCooldown<=0){const mode=toggleValve(this.environmentState,valve);this.valveCooldown=.35;this.message=`VALVE ${mode.toUpperCase()}`;this.messageLife=1.1;this.audio.tone(mode==="normal"?360:220,.12,"square",80,.08)}}
    }
    this.valveContacts=contacts;
    if(touchCandle(this.level,this.environmentState,px,py)){const total=this.level.environment?.candles?.length??0;this.message=`CANDLE ${this.environmentState.candleStep}/${total} SEALED`;this.messageLife=1.1;this.audio.tone(420+this.environmentState.candleStep*80,.1,"sine",90,.08)}
    this.teleportThroughMirrors();
    if(this.widow?.act==="host"&&(this.widow.phase==="host"||this.widow.phase==="entrance")){
      HOST_ANCHORS.forEach((anchor,index)=>{
        if((this.widow!.chargedAnchors&(1<<index))!==0)return;
        const bubble=this.bubbles.find(item=>(item.phase==="occupied"||item.phase==="warning")&&item.enemyId!==WIDOW_ENEMY_ID&&Math.hypot(item.x-anchor.x,item.y-anchor.y)<54);
        if(!bubble)return;
        const enemy=this.enemies.find(item=>item.id===bubble.enemyId);if(enemy)enemy.state="dead";bubble.phase="burst";bubble.life=-.1;
        Object.assign(this.widow!,chargeHostAnchor(this.widow!,index));this.score+=1500;this.stageReleaseScore+=1500;this.message=`${anchor.label} RELEASED`;this.messageLife=1.5;this.audio.bossHit();
        if(hostAnchorsComplete(this.widow!)){this.message="THE HOST CONTRACT OPENS";this.messageLife=2;this.widow!.phase="staggered";this.widow!.phaseTimer=0}
      });
    }
    if(this.widow?.act==="vow"&&this.widow.phase==="vow")this.ensureVowBubbles();
    const fracture=this.level.environment?.timeFracture;
    if(fracture){this.timeFractureClock+=dt;if(this.timeFractureClock>=fracture.interval){this.timeFractureClock=0;for(const enemy of this.enemies.filter(item=>item.state==="normal"||item.state==="furious").slice(0,3))this.enemyEchoes.push({kind:enemy.kind,x:enemy.prevX,y:enemy.prevY,timer:fracture.replayDelay});this.message="TIME FRACTURE · ECHO THEN IMPACT";this.messageLife=1.2;this.audio.tone(180,.18,"sawtooth",220,.08)}}
  }
  private teleportThroughMirrors(){
    const doors=this.level.environment?.mirrorDoors??[];if(!doors.length)return;
    const transfer=(body:{x:number;y:number;w:number;h:number;portalCooldown:number},centreX:number,centreY:number)=>{
      if(body.portalCooldown>0)return;
      const door=doors.find(item=>pointInRect(centreX,centreY,item));if(!door)return;
      const exit=doors.find(item=>item.id===door.pairId);if(!exit)return;
      body.x=clamp(exit.x+exit.w/2-body.w/2,25,W-body.w-25);body.y=clamp(exit.y+exit.h-body.h,90,H-body.h-25);body.portalCooldown=.7;
    };
    transfer(this.player,this.player.x+this.player.w/2,this.player.y+this.player.h/2);if(this.player.portalCooldown>.65)this.player.invuln=Math.max(this.player.invuln,.45);
    for(const enemy of this.enemies)if(enemy.state!=="dead"&&enemy.state!=="trapped")transfer(enemy,enemy.x+enemy.w/2,enemy.y+enemy.h/2);
    for(const bubble of this.bubbles){const proxy={x:bubble.x-bubble.r,y:bubble.y-bubble.r,w:bubble.r*2,h:bubble.r*2,portalCooldown:bubble.portalCooldown};transfer(proxy,bubble.x,bubble.y);if(proxy.portalCooldown!==bubble.portalCooldown){bubble.x=proxy.x+bubble.r;bubble.y=proxy.y+bubble.r;bubble.prevX=bubble.x;bubble.prevY=bubble.y;bubble.portalCooldown=proxy.portalCooldown}}
  }
  private ensureVowBubbles(){
    const existing=new Set(this.bubbles.filter(b=>b.phase==="bound").map(b=>b.boundEcho));
    SHARED_VOW_ECHOES.forEach((position,index)=>{if(existing.has(index))return;this.bubbles.push({id:this.nextId++,x:position.x,y:position.y,prevX:position.x,prevY:position.y,vx:0,vy:0,r:29,age:0,phase:"bound",life:999,lifeMax:999,portalCooldown:0,anchored:true,boundEcho:index})});
  }
  private updateEchoes(dt:number){
    for(const echo of this.echoPops)echo.timer-=dt;for(const echo of this.enemyEchoes)echo.timer-=dt;for(const briar of this.briars)briar.timer-=dt;
    this.echoPops=this.echoPops.filter(echo=>echo.timer>0);this.enemyEchoes=this.enemyEchoes.filter(echo=>echo.timer>0);this.briars=this.briars.filter(briar=>briar.timer>0);
  }
  private updateWidow(dt:number){
    if(!this.widow)return;const w=this.widow;w.prevX=w.x;w.prevY=w.y;w.age+=dt;this.widowTime+=dt;
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
      if(w.phaseTimer>1.8){w.phase="host";w.phaseTimer=0;this.message="PHASE ONE · THE HOST";this.messageLife=2}
      return;
    }
    if(w.act==="host"&&w.phase==="host"){
      w.x=W/2+Math.sin(w.age*.75)*230;w.y=102+Math.sin(w.age*1.4)*12;w.vx=0;w.vy=0;
      if(this.enemies.every(enemy=>enemy.state==="dead")&&!hostAnchorsComplete(w))this.summonHostFormation();
      return;
    }
    if(w.act==="vow"&&w.phase==="vow"){w.x=W/2;w.y=118;w.vx=0;w.vy=0;return}
    if(w.phase==="staggered"){
      w.vx*=Math.pow(.02,dt);w.vy*=Math.pow(.02,dt);w.x+=w.vx*dt;w.y+=w.vy*dt;
      if(w.phaseTimer>2.6){w.phase=w.act==="host"?"host":w.act==="split"?"chase":"vow";w.phaseTimer=0}
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
  private summonHostFormation(){
    const rank=this.threatRank(),spawns=[{x:170,y:489,kind:"love" as const,variant:"paired" as const,group:"host-reserve"},{x:750,y:489,kind:"doll" as const,variant:"windup" as const,group:"host-reserve"}];
    for(const spawn of spawns)this.enemies.push({id:this.nextId++,x:spawn.x,y:spawn.y,prevX:spawn.x,prevY:spawn.y,vx:spawn.kind==="love"?70:0,vy:0,w:34,h:38,kind:spawn.kind,variant:spawn.variant,group:spawn.group,state:"normal",timer:0,cooldown:1.2,homeX:spawn.x,homeY:spawn.y,weakened:false,rank,elite:false,portalCooldown:0,turns:0,roostAwake:true});
    this.message="THE HOST REBINDS TWO ECHOES";this.messageLife=1.5;
  }
  private checkDamage(){
    if(this.player.invuln>0||this.player.flying>0)return;
    const widowDangerous=!!this.widow&&(!this.level.boss||(this.widow.act==="split"&&(this.widow.phase==="chase"||this.widow.phase==="lunge")));
    const thornHit=(this.level.environment?.thorns??[]).some(hazard=>thornState(hazard,this.environmentState.time)==="active"&&bodyIntersectsRect(this.player,hazard));
    const briarHit=this.briars.some(briar=>briar.timer<.9&&bodyIntersectsRect(this.player,{x:briar.x,y:briar.y,w:briar.w,h:12}));
    const fractureHit=this.enemyEchoes.some(echo=>echo.timer<.34&&Math.hypot(this.player.x+17-echo.x,this.player.y+24-echo.y)<35);
    const hit=this.enemies.some(e=>(e.state==="normal"||e.state==="furious")&&overlaps(this.player,e))||this.projectiles.some(p=>p.x>this.player.x&&p.x<this.player.x+this.player.w&&p.y>this.player.y&&p.y<this.player.y+this.player.h)||(widowDangerous&&dist(this.player,this.widow!)<52)||thornHit||briarHit||fractureHit;
    if(hit)this.damagePlayer();
  }
  private damagePlayer(){if(this.player.invuln>0)return;this.stageDamaged=true;this.damageTaken++;if(this.upgrades.shield){this.upgrades.shield=false;this.player.invuln=1.2;this.message="COMPACT SHATTERED";this.messageLife=1;this.audio.pop(2);return}this.audio.hurt();this.lives--;this.setState("dying");this.burstParticles(this.player.x+17,this.player.y+24,COLORS.crimson,22)}
  private afterDeath(){
    if(this.level.boss&&this.bossCheckpoint){this.restoreBossCheckpoint();return}
    if(this.lives<=0&&this.checkpoint){this.restoreCheckpoint();return}
    if(this.lives<=0){this.newRecord=isNewCampaignRecord(this.settings.highScore,this.score);if(this.newRecord)this.audio.recordSting();this.settings.highScore=Math.max(this.settings.highScore,this.score);this.save();this.setState("gameOver")}else{this.resetPlayer(2.2);this.setState("playing")}
  }
  private spawnReward(x:number,y:number,chain:number){
    const kinds=["CHERRY","RING","PERFUME","DRAGON FRUIT","BLACKBERRY","CROWN"],values=[100,250,400,600,800,1300];const tier=Math.min(kinds.length-1,Math.floor((chain-1)/2)+(this.upgrades.crown?1:0));
    const n=this.stageKills;if(n%7===0){const letters=["V","E","N","O","M"];const letter=letters.find(l=>!this.venom.has(l))||letters[n%5];this.rewards.push({x,y,vy:-120,kind:"LETTER",value:1080,life:12,letter})}
    else this.rewards.push({x,y,vy:-110,kind:kinds[tier],value:values[tier],life:10});
    if(n%5===0)this.applyPowerup(n);
  }
  private applyPowerup(n:number){
    const list=["rapid","range","velocity","speed","shield","venom","chain","crown"] as const;const key=list[(n+this.levelIndex)%list.length];this.upgrades[key]=true;
    if(n%5===0){const effects=["anchor","pulse","echo"] as const;this.bubbleEffect=effects[(Math.floor(n/5)+this.levelIndex)%effects.length]}
    this.message=this.bubbleEffect!=="none"?`BUBBLE ${this.bubbleEffect.toUpperCase()}`:({rapid:"LIGHTNING CANDY",range:"HEART RANGE",velocity:"BLUE COMET",speed:"CRIMSON HEELS",shield:"HEART COMPACT",venom:"JADE FANG",chain:"SNAKE CHAIN",crown:"THORN CROWN"})[key];this.messageLife=1.25;this.audio.reward()
  }
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
  private threatRank(){return enemyRankForStage(this.runMode==="encore"?11:this.levelIndex,!!this.level.boss,!!this.level.bonus,this.settings.enemyConsciousness)}
  private cycleEnemyConsciousness(){
    this.settings.enemyConsciousness=((this.settings.enemyConsciousness+1)%ENEMY_CONSCIOUSNESS_NAMES.length) as EnemyConsciousness;
    this.message=`ENEMY CONSCIOUSNESS: ${ENEMY_CONSCIOUSNESS_NAMES[this.settings.enemyConsciousness]}`;this.messageLife=1.4;this.audio.reward();this.save();
  }
  private collectReward(r:Reward){this.score+=r.value;this.stagePickupScore+=r.value;if(r.risk)this.stageRiskScore+=r.value;this.audio.reward();this.burstParticles(r.x,r.y,r.letter?"#FFD36A":COLORS.pink,8);if(r.letter){this.venom.add(r.letter);if(this.venom.size===5){this.lives++;this.score+=10000;this.stagePickupScore+=10000;this.player.flying=6;this.venom.clear();this.bubbleEffect="venom";this.message="VENOM ASCENSION · ONE TRUTH CHAIN";this.messageLife=2.2;this.shake=this.settings.reducedMotion?0:5;this.audio.secret()}}}
  private clearStage(demo:boolean){
    if(demo){this.toTitle();return}
    const secret=this.cheats.extra||(this.level.secret==="trapFirst"&&this.trappedBeforeFirstPop>=this.level.enemies.length)||(this.level.secret==="oneChain"&&this.bestChain>=this.level.enemies.length)||(this.level.secret==="noFloor"&&!this.touchedFloor)||(this.level.secret==="widow13"&&this.widowTime>=13)||environmentSecretReady(this.level,this.environmentState);
    this.secretFound=secret;
    const actionScore=this.stageTrapScore+this.stageReleaseScore+this.stagePickupScore;
    this.stageBreakdown=computeStageBreakdown({kills:actionScore,trapScore:this.stageTrapScore,releaseScore:this.stageReleaseScore,pickupScore:this.stagePickupScore,chainBonus:this.stageChainBonus,riskScore:this.stageRiskScore,largestChain:this.bestChain,enemyCount:this.level.enemies.length,remainingTime:this.levelTime,lives:this.lives,noDamage:!this.stageDamaged,secretFound:secret,bonusRoom:!!this.level.bonus});
    this.score+=this.stageBreakdown.fullRoomBonus+this.stageBreakdown.speedBonus+this.stageBreakdown.lifeBonus+this.stageBreakdown.noDamageBonus+this.stageBreakdown.secretBonus;
    this.gainHeroXp(stageClearXp(this.threatRank(),!this.stageDamaged,!!this.level.boss));
    if(secret){
      if(!this.level.bonus&&!this.settings.fragments.includes(this.level.loreFragmentId)){
        this.settings.fragments.push(this.level.loreFragmentId);this.settings.secrets++;
      }
      this.unlockContent(this.level.loreFragmentId);this.audio.secret();
    }
    this.recordStageResult();
    this.recordEncoreMedals();
    if(this.runMode==="story"&&!this.inBonus&&this.levelIndex===LEVELS.length-1)this.settings.storyClears++;
    if(this.runMode==="story"&&this.levelIndex===2&&!this.inBonus)this.unlockVelvetSkin(this.hero);
    if(this.runMode==="story"&&!this.inBonus){const resumeLevel=checkpointLevelAfterClear(this.levelIndex,LEVELS.length);if(resumeLevel!==null){this.checkpoint=createRuntimeCheckpoint({levelIndex:resumeLevel,hero:this.hero,score:this.score,venom:this.venom,upgrades:this.upgrades,bubbleEffect:this.bubbleEffect});this.message=`CHECKPOINT SAVED · STAGE ${resumeLevel+1}`;this.messageLife=2.2;this.audio.recordSting()}}
    this.save();this.setState("stageClear");
  }
  private recordStageResult(){
    const key=this.level.bonus?"bonus":this.level.loreFragmentId;
    const elapsed=Math.max(0,this.level.time-Math.max(0,this.levelTime));
    this.previousBestScore=this.settings.bestChamberScores[key]??0;this.previousBestChain=this.settings.bestChains[key]??0;
    this.settings.bestChamberScores[key]=Math.max(this.previousBestScore,this.stageBreakdown.total);
    this.settings.bestChains[key]=Math.max(this.previousBestChain,this.bestChain);
    this.newRecord=isNewStageRecord(this.settings.bestStageTimes[key],elapsed);
    if(this.newRecord){this.settings.bestStageTimes[key]=elapsed;this.audio.recordSting()}
  }
  private recordEncoreMedals(){
    this.medalsEarned=[];if(!this.level.encore||!this.level.encoreId||!this.level.medalTargets)return;
    const elapsed=Math.max(0,this.level.time-Math.max(0,this.levelTime)),targets=this.level.medalTargets;
    const earned:EncoreMedal[]=["clear"];
    if(!this.stageDamaged)earned.push("noDamage");
    if(this.stageBreakdown.total>=targets.score)earned.push("targetScore");
    if(this.bestChain>=targets.fullChain)earned.push("fullChain");
    const existing=this.settings.encoreMedals[this.level.encoreId]??[];
    this.medalsEarned=earned.filter(medal=>!existing.includes(medal));
    this.settings.encoreMedals[this.level.encoreId]=[...new Set([...existing,...earned])];
    if(elapsed<=targets.time&&this.stageBreakdown.total<targets.score)this.message="TIME MEDAL ROUTE · SCORE STILL NEEDED";
  }
  private restoreCheckpoint(){
    const checkpoint=this.checkpoint;if(!checkpoint)return;
    this.hero=checkpoint.hero;this.selected=checkpoint.hero;this.score=checkpoint.score;this.lives=3;this.venom=new Set(checkpoint.venom);this.upgrades={...checkpoint.upgrades};this.bubbleEffect=checkpoint.bubbleEffect??"none";
    this.loadLevel(checkpoint.levelIndex);this.message=`CHECKPOINT RESTORED · STAGE ${checkpoint.levelIndex+1} · 3 LIVES`;this.messageLife=2.8;this.audio.secret();this.setState("stageIntro");
  }
  private restoreBossCheckpoint(){
    const checkpoint=this.bossCheckpoint;if(!checkpoint)return;
    const stage=this.levelIndex;this.score=checkpoint.score;this.lives=Math.max(1,this.lives);this.loadLevel(stage);this.score=checkpoint.score;this.stageStartScore=this.score;
    if(!this.widow)return;
    this.widow.act=checkpoint.act;this.widow.hp=checkpoint.hp;this.widow.chargedAnchors=checkpoint.act==="host"?0:3;this.widow.vowEchoes=0;this.widow.phase=checkpoint.act==="host"?"host":checkpoint.act==="split"?"chase":"vow";this.widow.phaseTimer=0;this.bossCheckpoint=checkpoint;
    if(checkpoint.act==="vow"){this.enemies.forEach(enemy=>enemy.state="dead");this.ensureVowBubbles()}
    this.resetPlayer(2.2);this.message=`${checkpoint.act.toUpperCase()} PHASE RESTORED`;this.messageLife=2.2;this.setState("playing");
  }
  private nextStage(){
    if(this.runMode==="encore"){
      if(this.encoreIndex>=ENCORE_LEVELS.length-1){this.endingText="FIVE WORLDS ANSWER THE ENCORE";this.setState("victory")}else{this.encoreIndex++;this.loadEncoreLevel(this.encoreIndex);this.setState("stageIntro")}
      return;
    }
    if(this.inBonus){this.inBonus=false;this.levelIndex++;this.loadLevel(this.levelIndex);this.setState("stageIntro");return}
    if(this.cheats.extra&&!this.bonusVisited&&this.levelIndex===2){this.bonusVisited=true;this.loadBonusLevel();this.setState("stageIntro");return}
    if(this.levelIndex>=LEVELS.length-1){this.endingText=this.cheats.super?"TRUE ENDING — THE HEX DREAMS YOU BACK":"THE NIGHTCLUB OPENS AT DAWN";this.newRecord=isNewCampaignRecord(this.settings.highScore,this.score);if(this.newRecord)this.audio.recordSting();this.settings.highScore=Math.max(this.settings.highScore,this.score);this.save();this.setState("victory")}else{this.levelIndex++;this.loadLevel(this.levelIndex);this.setState("stageIntro")}
  }
  private beginRun(){this.lives=3;this.score=0;this.levelIndex=0;this.encoreIndex=0;this.venom.clear();this.bonusVisited=false;this.checkpoint=null;this.bossCheckpoint=null;this.bubbleEffect="none";this.stageStartScore=0;this.upgrades={speed:this.cheats.power,rapid:this.cheats.power,range:this.cheats.power,velocity:false,shield:false,venom:false,chain:false,crown:false};if(this.runMode==="encore"&&this.settings.storyClears>0)this.loadEncoreLevel(0);else{this.runMode="story";this.loadLevel(0)}this.setState("stageIntro")}
  private restartCurrentStage(){if(this.inBonus)this.loadBonusLevel();else if(this.runMode==="encore")this.loadEncoreLevel(this.encoreIndex);else this.loadLevel(this.levelIndex);this.setState("stageIntro")}
  private loadLevel(i:number){this.levelIndex=i;this.inBonus=false;this.loadLevelData(this.remixLevel(LEVELS[i]))}
  private loadEncoreLevel(i:number){this.encoreIndex=i;this.levelIndex=i;this.inBonus=false;this.loadLevelData(ENCORE_LEVELS[i])}
  private loadBonusLevel(){this.inBonus=true;this.loadLevelData(this.remixLevel(BONUS_LEVEL))}
  private loadLevelData(level:Level){
    this.level=level;this.levelTime=level.time;this.environmentState=createEnvironmentState(level);this.runtimePlatforms=activePlatforms(level,this.environmentState);
    const rank=this.threatRank();
    this.enemies=level.enemies.map((s,index)=>({id:this.nextId++,x:s.x,y:s.y,prevX:s.x,prevY:s.y,vx:s.kind==="love"?70:0,vy:0,w:s.kind==="eye"?38:34,h:s.kind==="bat"?30:38,kind:s.kind,variant:normalizeEnemyVariant(s.kind,s.variant),group:s.group,state:"normal",timer:0,cooldown:1+(index%4)*.2,homeX:s.x,homeY:s.y,weakened:false,rank,elite:isEliteEnemy(this.levelIndex,index,rank),portalCooldown:0,turns:0,roostAwake:s.variant!=="roost"}));
    this.bubbles=[];this.rewards=[];this.projectiles=[];this.particles=[];
    this.widow=level.boss?this.makeWidow(W/2,-60,true):null;this.widowTime=0;
    this.bossCheckpoint=this.widow?makeWidowPhaseCheckpoint(this.widow,this.score):null;
    this.platformAudit=auditLevelReachability(level);this.resetPlayer(1.2);
    this.stageKills=0;this.trappedBeforeFirstPop=0;this.firstPop=false;this.touchedFloor=false;this.bestChain=0;this.secretFound=false;this.stageStartScore=this.score;this.stageDamaged=false;this.damageTaken=0;this.stageXp=0;this.stageTrapScore=0;this.stageReleaseScore=0;this.stagePickupScore=0;this.stageChainBonus=0;this.stageRiskScore=0;this.pendingChain=null;this.chainBursts=[];this.echoPops=[];this.enemyEchoes=[];this.briars=[];this.timeFractureClock=0;this.medalsEarned=[];this.valveContacts.clear();
    for(const pickup of level.environment?.riskPickups??[])this.rewards.push({x:pickup.x,y:pickup.y,vy:0,kind:"MEMORY SHARD",value:pickup.value,life:999,risk:true,id:pickup.id});
    this.applyMasteryUpgrades(true);
    this.unlockContent(level.worldId);for(const enemy of level.enemies)this.unlockContent(enemy.kind);if(level.boss)this.unlockContent("widow");
    this.save();
  }
  private remixLevel(base:Level):Level{if(!this.cheats.super)return base;return{...base,time:Math.max(45,base.time-12),platforms:base.platforms.map((p,i)=>i===0?p:{...p,y:p.y+(i%2?18:-12)}),enemies:[...base.enemies,...base.enemies.slice(0,2).map((e,i)=>({...e,x:clamp(e.x+150+i*90,60,860),kind:i?"skull" as EnemyKind:"witch" as EnemyKind}))]}}
  private beginAttract(){this.attractTime=0;this.hero="jade";this.levelIndex=1;this.loadLevel(1);this.setState("attract")}
  private toTitle(){const resetRun=this.state==="gameOver"||this.state==="victory";if(resetRun){this.cheats={power:false,super:false,extra:false};this.cheatReader.reset()}this.setState("title");this.titleIdle=0;this.startGrace=0;this.attractTime=0;this.held={left:false,right:false,jump:false,bubble:false,start:false,pause:false,consciousness:false,mode:false}}
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
  private pollGamepad(){const g=navigator.getGamepads?.()[0];if(!g)return;this.held.left=(g.axes[0]||0)<-.35;this.held.right=(g.axes[0]||0)>.35;const next={jump:!!g.buttons[0]?.pressed,bubble:!!g.buttons[1]?.pressed,start:!!g.buttons[9]?.pressed,pause:!!g.buttons[8]?.pressed,mode:!!g.buttons[2]?.pressed};for(const key of Object.keys(next) as (keyof typeof next)[]){if(next[key]&&!this.gamepadPrev[key])this.press(key);if(!next[key]&&this.gamepadPrev[key])this.release(key)}this.gamepadPrev=next}
  private dust(x:number,y:number,count:number){
    if(this.settings.reducedMotion)return;
    for(let i=0;i<count;i++){const a=-Math.PI/2+(Math.random()-.5)*1.7,s=20+Math.random()*70;this.particles.push({x:x+(Math.random()-.5)*18,y:y-2,vx:Math.cos(a)*s,vy:Math.sin(a)*s*.4-25,life:.22+Math.random()*.3,color:"#7d90b5",size:2+Math.random()*3})}
  }
  private burstParticles(x:number,y:number,color:string,count:number){const readableCount=Math.min(this.settings.reducedMotion?6:28,count);for(let i=0;i<readableCount;i++){const a=Math.random()*Math.PI*2,s=50+Math.random()*190;this.particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:.35+Math.random()*.55,color,size:2+Math.random()*5})}}
  private load(){
    try{
      const stored=localStorage.getItem("bubble-hex-settings");
      this.settings=migrateSettings(stored?JSON.parse(stored):undefined,matchMedia("(prefers-reduced-motion: reduce)").matches);
    }catch{}
  }
  private save(){try{localStorage.setItem("bubble-hex-settings",JSON.stringify(this.settings))}catch{}}

  private render(){const c=this.ctx;this.renderAlpha=clamp(this.acc/FIXED,0,1);c.save();const s=this.shake&&!this.settings.reducedMotion?(Math.random()-.5)*this.shake:0;c.translate(s,s);c.fillStyle=COLORS.void;c.fillRect(-10,-10,W+20,H+20);
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
    const all=this.cheats.power&&this.cheats.super&&this.cheats.extra;
    this.label(`MODE ${this.runMode.toUpperCase()} ${this.settings.storyClears>0?"· DOWN / MODE":"· ENCORE LOCKED"}`,W/2,555,11,this.runMode==="encore"?"#FFD36A":COLORS.jade,"center");
    this.label(`ENEMY CONSCIOUSNESS ${ENEMY_CONSCIOUSNESS_NAMES[this.settings.enemyConsciousness]} · UP TO CHANGE`,W/2,582,10,this.settings.enemyConsciousness>=4?COLORS.crimson:COLORS.blue,"center");
    this.label(all?"BUBBLE HEX: VENOM EDITION":"PRESS START",W/2,622,all?20:25,all?COLORS.crimson:COLORS.shine,"center");
    if(Math.floor(t*2)%2===0)this.label("ENTER / START",W/2,650,12,COLORS.pink,"center");
    this.label("ONE PLAYER",65,699,12,COLORS.blue);this.label("BLUE $NAKE STUDIO",895,699,12,COLORS.jade,"right");
    const active=[this.cheats.power&&"POWER",this.cheats.super&&"SUPER",this.cheats.extra&&"EXTRA"].filter(Boolean).join(" + ");if(active)this.label(active,W/2,676,12,COLORS.shine,"center");
  }
  private drawSelect(){this.drawStars();this.drawGothicFrame(COLORS.pink);this.label("CHOOSE YOUR HEX",W/2,105,42,COLORS.shine,"center","Georgia");
    this.drawSelectCard(150,155,"vesper",this.selected==="vesper");this.drawSelectCard(510,155,"jade",this.selected==="jade");this.label(`MODE ${this.runMode.toUpperCase()} · DOWN / MODE TO CHANGE`,W/2,612,10,this.runMode==="encore"?"#FFD36A":COLORS.jade,"center");this.label("← HERO →   •   BUBBLE: LOOK   •   UP: ENEMY LEVEL",W/2,642,11,COLORS.blue,"center");this.label(`START / JUMP TO CONFIRM   •   ${ENEMY_CONSCIOUSNESS_NAMES[this.settings.enemyConsciousness]}`,W/2,675,11,COLORS.jade,"center")}
  private drawSelectCard(x:number,y:number,hero:HeroId,on:boolean){
    const c=this.ctx,skin=this.skinFor(hero),col=skin.accent;c.fillStyle="#070817";c.fillRect(x,y,300,420);c.save();c.globalAlpha=.72;
    const portrait=this.art.draw(c,"heroes",hero==="vesper"?0:768,28,768,960,x+12,y+12,276,274);c.restore();
    if(!portrait)this.drawHero(x+150,y+175,hero,2.5,false);
    c.fillStyle="rgba(7,8,23,.82)";c.fillRect(x+8,y+286,284,126);c.strokeStyle=on?COLORS.shine:col;c.lineWidth=on?5:2;c.strokeRect(x,y,300,420);
    if(on){c.shadowBlur=18;c.shadowColor=col;c.strokeRect(x+9,y+9,282,402);c.shadowBlur=0}
    this.label(hero.toUpperCase(),x+150,y+326,30,col,"center","Georgia");this.label(skin.name.toUpperCase(),x+150,y+354,11,COLORS.shine,"center");
    this.label(hero==="vesper"?"FAST START • JUMP BITE • STRONG BUBBLE":"SMOOTH AIR • LONG CONTROL • CURRENT GRIP",x+150,y+379,8,skin.secondary,"center");this.label(on?"BUBBLE: CHANGE LOOK":"BALANCED ROUTE",x+150,y+404,9,on?COLORS.pink:COLORS.blue,"center")
  }
  private drawWorld(){
    const a=this.renderAlpha;
    const bubbles=this.bubbles.map(b=>({...b,x:lerp(b.prevX,b.x,a),y:lerp(b.prevY,b.y,a)}));
    const enemies=this.enemies.map(e=>({...e,x:lerp(e.prevX,e.x,a),y:lerp(e.prevY,e.y,a)}));
    this.drawBackground();this.drawEnvironment(false);this.drawPlatforms();this.drawEnvironment(true);
    this.drawChainPreview(bubbles);for(const r of this.rewards)this.drawReward(r);
    for(const b of bubbles)this.drawBubble(b);
    for(const e of enemies)if(e.state!=="dead"&&e.state!=="trapped"&&e.kind!=="bat"&&e.kind!=="eye")this.drawShadowUnder(e.x+e.w/2,e.y+e.h,17);
    for(const e of enemies)if(e.state!=="dead"&&e.state!=="trapped")this.drawEnemy(e);
    for(const p of this.projectiles)this.drawProjectile(p);
    if(this.widow&&this.widow.phase!=="trapped"){
      if(this.widow.act==="split")for(const copy of splitClauseCopies(this.widow.x,this.widow.y,this.widow.age).filter(copy=>!copy.trueCopy)){this.ctx.save();this.ctx.globalAlpha=.28;this.drawWidow({...this.widow,x:copy.x,y:copy.y});this.ctx.restore()}
      this.drawWidow({...this.widow,x:lerp(this.widow.prevX,this.widow.x,a),y:lerp(this.widow.prevY,this.widow.y,a)});
    }
    const pl=this.player;
    const ix=lerp(pl.previousX,pl.x,a),iy=lerp(pl.previousY,pl.y,a);
    this.drawShadowUnder(ix+pl.w/2,iy+pl.h,21);
    const pose:HeroPose=this.state==="dying"?"hurt":!pl.grounded?(pl.vy<0?"jump":"fall"):Math.abs(pl.vx)>30?"run":"idle";
    const maxSpeed=this.upgrades.speed?POWER_RUN_SPEED:MAX_RUN_SPEED;
    const squash=pl.landTimer>0?(pl.landTimer/.18)*pl.landPower*.55:!pl.grounded?-clamp(Math.abs(pl.vy)/2600,0,.3):0;
    this.drawHero(ix+17,iy+24,this.hero,1,pl.invuln>0&&Math.floor(pl.invuln*10)%2===0,
      {facing:pl.facing,pose,runPhase:pl.runPhase,throwT:clamp(pl.throwTimer/.3,0,1),squash,speed:clamp(Math.abs(pl.vx)/maxSpeed,0,1)});
    for(const p of this.particles){this.ctx.globalAlpha=clamp(p.life*2,0,1);this.ctx.fillStyle=p.color;this.ctx.fillRect(p.x,p.y,p.size,p.size);this.ctx.globalAlpha=1}
    this.drawHud();this.drawProgressionHud();
    if(this.level.boss&&this.widow&&this.widow.phase==="entrance")this.drawBossNameplate();
    if(this.debug)this.drawDebugOverlay();
    if(this.comboLife>0)this.banner(this.comboText,370,COLORS.pink)
  }
  private drawBossNameplate(){const c=this.ctx,w=this.widow;if(!w)return;const t=clamp(w.phaseTimer/1.8,0,1);const alpha=t<.15?t/.15:t>.8?(1-t)/.2:1;c.save();c.globalAlpha=alpha;this.label("THE WIDOW",W/2,150,44,COLORS.crimson,"center","Georgia");this.label("LAST PATRON OF BUBBLE HEX",W/2,180,14,COLORS.pink,"center");c.restore()}
  private drawProgressionHud(){const p=this.heroProgress(),rank=this.threatRank();this.label(`LV ${p.level}`,292,25,11,COLORS.jade);this.label(`RANK ${rank}`,292,48,8,rank>=4?COLORS.crimson:COLORS.blue)}
  private drawBackground(){const c=this.ctx;c.fillStyle=COLORS.void;c.fillRect(0,0,W,H);c.fillStyle=this.level.world==="JADE GARDEN"?"#06140f":"#050817";c.fillRect(18,70,W-36,H-92);c.globalAlpha=.18;c.strokeStyle=this.level.tint;c.lineWidth=2;
    if(this.level.worldId==="velvet-drain"){const sx=[0,724,1448][this.levelIndex]??0;c.save();c.globalAlpha=.58;this.art.draw(c,"velvetDrain",sx,0,724,724,18,70,W-36,H-92);c.restore();c.fillStyle="rgba(2,5,14,.24)";c.fillRect(18,70,W-36,H-92)}
    if(this.level.world==="THE BLACK BUBBLE"){for(let x=40;x<W;x+=55){c.beginPath();c.moveTo(x,75);c.lineTo(W-x/4,H);c.stroke()}for(let y=120;y<H;y+=55){c.beginPath();c.moveTo(20,y);c.lineTo(W-20,y);c.stroke()}c.beginPath();c.arc(W/2,H/2,250,0,Math.PI*2);c.stroke()}
    else{for(let x=45;x<W;x+=90){c.beginPath();c.moveTo(x,80);c.lineTo(x,H);c.stroke()}for(let y=120;y<H;y+=90){c.beginPath();c.moveTo(20,y);c.lineTo(W-20,y);c.stroke()}}
    c.globalAlpha=1;
    const T=this.animTime,rm=this.settings.reducedMotion;
    if(this.level.world==="HEARTBREAK HOTEL"){const flick=rm?1:(Math.sin(T*31)*Math.sin(T*7.3)>.93?.45:1);c.save();c.globalAlpha=flick;this.drawHeart(W/2,260,75,"#19071c");this.label("13",W/2,270,50,"#331033","center");c.restore()}
    if(this.level.world==="CRIMSON CHAPEL"){for(let x=120;x<900;x+=210){c.fillStyle="#190711";c.fillRect(x,110,100,220);c.strokeStyle=COLORS.crimson;c.beginPath();c.arc(x+50,110,50,Math.PI,0);c.stroke()}}
    if(this.level.world==="JADE GARDEN"){for(let x=70;x<940;x+=140){c.strokeStyle="#0d4b36";c.beginPath();c.moveTo(x,H);c.bezierCurveTo(x-80+(rm?0:Math.sin(T*.8+x)*8),470,x+80+(rm?0:Math.sin(T*.6+x)*10),310,x,120);c.stroke()}}
    if(!rm){
      c.save();c.beginPath();c.rect(18,70,W-36,H-92);c.clip();
      if(this.level.worldId==="velvet-drain"){
        c.strokeStyle="rgba(8,124,255,.35)";c.lineWidth=1.5;
        for(let i=0;i<12;i++){const bx=30+((i*83)%(W-60))+Math.sin(T*.9+i)*8,by=H-((T*(26+(i%4)*7)+i*61)%(H-120)),br=2+(i%3)*1.5;c.beginPath();c.arc(bx,by,br,0,Math.PI*2);c.stroke()}
      }else if(this.level.worldId==="jade-garden"){
        c.fillStyle="rgba(32,201,139,.4)";
        for(let i=0;i<10;i++){const py=90+((T*(18+(i%3)*8)+i*97)%(H-160)),px=40+((i*103)%(W-80))+Math.sin(T*1.4+i*2)*22;c.save();c.translate(px,py);c.rotate(T*2+i);c.beginPath();c.ellipse(0,0,4,2,0,0,Math.PI*2);c.fill();c.restore()}
      }else if(this.level.worldId==="crimson-chapel"){
        for(let x=120;x<900;x+=210){const fx=x+50,fl=.7+Math.sin(T*11+x)*.2+Math.sin(T*23+x*3)*.1;
          c.fillStyle=`rgba(196,19,61,${(.22*fl).toFixed(3)})`;c.beginPath();c.arc(fx,100,10+fl*5,0,Math.PI*2);c.fill();
          c.fillStyle=`rgba(255,211,111,${(.55*fl).toFixed(3)})`;c.beginPath();c.ellipse(fx,98,3,6+fl*3,0,0,Math.PI*2);c.fill()}
      }else if(this.level.worldId==="black-bubble"){
        c.strokeStyle="rgba(117,108,255,.4)";c.lineWidth=2;c.setLineDash([14,22]);c.lineDashOffset=-T*30;
        c.beginPath();c.arc(W/2,H/2,250+Math.sin(T*1.8)*8,0,Math.PI*2);c.stroke();c.setLineDash([]);
        c.strokeStyle="rgba(196,19,61,.25)";c.beginPath();c.arc(W/2,H/2,180+Math.sin(T*1.8+2)*12,0,Math.PI*2);c.stroke();
      }else{
        c.fillStyle="rgba(255,42,157,.28)";
        for(let i=0;i<9;i++){const px=30+((i*107+T*12)%(W-60)),py=100+((i*79)%(H-180))+Math.sin(T+i)*10;c.fillRect(px,py,2,2)}
      }
      c.restore();
    }
  }
  private drawEnvironment(foreground:boolean){
    const c=this.ctx,env=this.level.environment;if(!env)return;c.save();
    if(!foreground){
      for(const zone of env.currents??[]){const mode=zone.valveId?this.environmentState.valveModes[zone.valveId]??"normal":"normal";c.fillStyle="rgba(8,124,255,.08)";c.fillRect(zone.x,zone.y,zone.w,zone.h);c.strokeStyle=mode==="stopped"?"#8794A8":COLORS.blue;c.setLineDash([8,8]);c.strokeRect(zone.x,zone.y,zone.w,zone.h);c.setLineDash([]);const direction=mode==="reversed"?({LEFT:"RIGHT",RIGHT:"LEFT",UP:"DOWN",DOWN:"UP"} as const)[zone.label]:zone.label;this.label(mode==="stopped"?"CURRENT STOPPED":`${direction} CURRENT`,zone.x+zone.w/2,zone.y+24,9,"#A9D8FF","center");for(let x=zone.x+38;x<zone.x+zone.w;x+=74){const y=zone.y+zone.h/2;c.strokeStyle="#56E7FF";c.lineWidth=2;c.beginPath();if(direction==="LEFT"||direction==="RIGHT"){const sign=direction==="RIGHT"?1:-1;c.moveTo(x-sign*10,y);c.lineTo(x+sign*10,y);c.lineTo(x+sign*3,y-6);c.moveTo(x+sign*10,y);c.lineTo(x+sign*3,y+6)}else{const sign=direction==="DOWN"?1:-1;c.moveTo(x,y-sign*10);c.lineTo(x,y+sign*10);c.lineTo(x-6,y+sign*3);c.moveTo(x,y+sign*10);c.lineTo(x+6,y+sign*3)}c.stroke()}}
      for(const pool of env.moonPools??[]){c.fillStyle=pool.bubbleLift<0?"rgba(32,201,139,.13)":"rgba(117,108,255,.14)";c.fillRect(pool.x,pool.y,pool.w,pool.h);c.strokeStyle="#D3FFEF";c.strokeRect(pool.x,pool.y,pool.w,pool.h);this.label(pool.bubbleLift<0?"MOON LIFT ↑":"MOON PRESS ↓",pool.x+pool.w/2,pool.y+25,9,"#D3FFEF","center")}
      for(const zone of env.gravityZones??[]){c.fillStyle=zone.label==="HEAVY"?"rgba(196,19,61,.08)":"rgba(117,108,255,.1)";c.fillRect(zone.x,zone.y,zone.w,zone.h);c.strokeStyle=zone.label==="HEAVY"?COLORS.crimson:COLORS.jade;c.setLineDash([12,8]);c.strokeRect(zone.x,zone.y,zone.w,zone.h);c.setLineDash([]);this.label(`${zone.label} ${zone.label==="HEAVY"?"↓":"↑"}`,zone.x+zone.w/2,zone.y+24,10,c.strokeStyle,"center")}
      for(const platform of previewPlatforms(this.level)){c.globalAlpha=.22;c.strokeStyle=COLORS.shine;c.setLineDash([7,7]);c.strokeRect(platform.x,platform.y,platform.w,platform.h);c.setLineDash([]);c.globalAlpha=1}
      for(const drain of env.drains??[]){c.fillStyle="rgba(0,0,0,.45)";c.fillRect(drain.x,drain.y,drain.w,drain.h);c.strokeStyle="#56E7FF";for(let x=drain.x+8;x<drain.x+drain.w;x+=13){c.beginPath();c.moveTo(x,drain.y+4);c.lineTo(x,drain.y+drain.h-3);c.stroke()}this.label("DRAIN PULL",drain.x+drain.w/2,drain.y-7,9,"#A9D8FF","center")}
      c.restore();return;
    }
    for(const valve of env.valves??[]){const mode=this.environmentState.valveModes[valve.id]??"normal";c.strokeStyle=mode==="normal"?COLORS.blue:COLORS.jade;c.lineWidth=4;c.beginPath();c.arc(valve.x,valve.y,18,0,Math.PI*2);c.stroke();for(let i=0;i<4;i++){const a=i*Math.PI/2+(mode==="reversed"?Math.PI/4:0);c.beginPath();c.moveTo(valve.x+Math.cos(a)*5,valve.y+Math.sin(a)*5);c.lineTo(valve.x+Math.cos(a)*20,valve.y+Math.sin(a)*20);c.stroke()}this.label(`VALVE ${mode==="normal"?"↻":mode==="reversed"?"↺":"■"}`,valve.x,valve.y-27,8,c.strokeStyle,"center")}
    for(const door of env.mirrorDoors??[]){c.fillStyle="rgba(255,42,157,.08)";c.fillRect(door.x,door.y,door.w,door.h);c.strokeStyle=COLORS.pink;c.lineWidth=3;c.strokeRect(door.x,door.y,door.w,door.h);this.label(`MIRROR ${door.preview} →`,door.x+door.w/2,door.y-7,8,COLORS.shine,"center")}
    for(const bloom of env.blooms??[]){const open=this.environmentState.openedBlooms.has(bloom.id);c.strokeStyle=open?COLORS.jade:"#7A4672";c.fillStyle=open?"rgba(32,201,139,.25)":"#09070d";for(let i=0;i<6;i++){const a=i*Math.PI/3;c.beginPath();c.ellipse(bloom.x+Math.cos(a)*10,bloom.y+Math.sin(a)*8,7,3,a,0,Math.PI*2);c.fill();c.stroke()}this.label(open?"OPEN":`CHAIN ${bloom.requiredChain}`,bloom.x,bloom.y-20,8,c.strokeStyle,"center")}
    for(const candle of env.candles??[]){const lit=this.environmentState.litCandles.has(candle.id),next=candle.order===this.environmentState.candleStep+1;c.fillStyle=lit?"#FFD36A":"#4A1522";c.fillRect(candle.x-5,candle.y-18,10,22);c.strokeStyle=next?COLORS.shine:COLORS.crimson;c.strokeRect(candle.x-7,candle.y-20,14,26);this.label(String(candle.order),candle.x,candle.y-27,9,next?"#FFD36A":"#B59AAB","center")}
    for(const gate of closedGates(this.level,this.environmentState)){c.fillStyle="rgba(196,19,61,.18)";c.fillRect(gate.x,gate.y,gate.w,gate.h);c.strokeStyle=COLORS.crimson;c.lineWidth=3;c.strokeRect(gate.x,gate.y,gate.w,gate.h);for(let y=gate.y+12;y<gate.y+gate.h;y+=18){c.beginPath();c.moveTo(gate.x,y);c.lineTo(gate.x+gate.w,y+10);c.stroke()}this.label(gate.requiredKinds.map(kind=>kind.toUpperCase()).join(" + "),gate.x+gate.w/2,gate.y-8,8,"#FFD6F1","center")}
    for(const hazard of env.thorns??[]){const state=thornState(hazard,this.environmentState.time);c.strokeStyle=state==="active"?COLORS.crimson:state==="warning"?"#FFD36A":"#6B5A6A";c.fillStyle=state==="active"?"rgba(196,19,61,.3)":"rgba(0,0,0,.18)";c.fillRect(hazard.x,hazard.y,hazard.w,hazard.h);for(let x=hazard.x;x<hazard.x+hazard.w;x+=12){c.beginPath();c.moveTo(x,hazard.y+hazard.h);c.lineTo(x+6,state==="active"?hazard.y:hazard.y+hazard.h-8);c.lineTo(x+12,hazard.y+hazard.h);c.stroke()}if(state==="warning")this.label("! THORNS !",hazard.x+hazard.w/2,hazard.y-6,8,"#FFD36A","center")}
    for(const briar of this.briars){c.strokeStyle=briar.timer>.9?"#FFD36A":COLORS.crimson;c.lineWidth=3;c.beginPath();c.moveTo(briar.x,briar.y+10);for(let x=briar.x;x<briar.x+briar.w;x+=15){c.lineTo(x+7,briar.timer>.9?briar.y+7:briar.y-8);c.lineTo(x+14,briar.y+10)}c.stroke()}
    for(const echo of this.echoPops){c.strokeStyle=COLORS.jade;c.globalAlpha=clamp(echo.timer/.42,0,1);c.lineWidth=3;c.beginPath();c.arc(echo.x,echo.y,(.42-echo.timer)*170,0,Math.PI*2);c.stroke();c.globalAlpha=1}
    for(const echo of this.enemyEchoes){c.save();c.globalAlpha=echo.timer<.34?.75:.24;c.strokeStyle=echo.timer<.34?COLORS.crimson:COLORS.blue;c.setLineDash(echo.timer<.34?[]:[5,5]);c.strokeRect(echo.x-18,echo.y-20,36,40);this.label(echo.timer<.34?"IMPACT":"REPLAY",echo.x,echo.y-26,8,c.strokeStyle,"center");c.restore()}
    if(this.widow?.act==="host")for(const [index,anchor] of HOST_ANCHORS.entries()){const charged=(this.widow.chargedAnchors&(1<<index))!==0;c.strokeStyle=charged?COLORS.jade:COLORS.crimson;c.lineWidth=4;c.beginPath();c.arc(anchor.x,anchor.y,34,0,Math.PI*2);c.stroke();this.label(charged?"RELEASED":anchor.label,anchor.x,anchor.y-42,8,c.strokeStyle,"center")}
    if(this.widow?.act==="split"){this.label("TRUE CLAUSE · CRACK + BELL",this.widow.x,this.widow.y-70,9,COLORS.jade,"center");c.strokeStyle=COLORS.jade;c.lineWidth=3;c.beginPath();c.moveTo(this.widow.x-12,this.widow.y-25);c.lineTo(this.widow.x+4,this.widow.y-5);c.lineTo(this.widow.x-5,this.widow.y+15);c.stroke()}
    if(this.widow?.act==="vow"){this.drawHero(105,150,"vesper",.75,true);this.drawHero(855,150,"jade",.75,true);this.label("VESPER + JADE · FOUR ECHOES · ONE CHAIN",W/2,128,10,COLORS.shine,"center")}
    c.restore();
  }
  private drawBlockMotif(block:PlatformBlockDefinition,x:number,y:number,w:number,h:number){
    const c=this.ctx,tile=block.tileWidth;c.save();c.strokeStyle=block.edge;c.fillStyle=block.highlight;c.lineWidth=2;c.globalAlpha=.82;
    if(block.motif==="rivets"||block.motif==="brass"||block.motif==="gold"){
      for(let tx=x+tile/2;tx<x+w;tx+=tile){c.beginPath();c.arc(tx,y+11,block.motif==="gold"?3:2,0,Math.PI*2);c.fill();if(block.motif==="brass")c.strokeRect(tx-7,y+7,14,8)}
    }else if(block.motif==="grate"){
      for(let tx=x+7;tx<x+w-3;tx+=10){c.beginPath();c.moveTo(tx,y+7);c.lineTo(tx,y+h-3);c.stroke()}
    }else if(block.motif==="tuft"||block.motif==="heart"){
      for(let tx=x+tile/2;tx<x+w;tx+=tile)this.drawHeart(tx,y+11,block.motif==="heart"?5:3,block.highlight);
    }else if(block.motif==="prism"){
      for(let tx=x+tile/2;tx<x+w;tx+=tile){c.beginPath();c.moveTo(tx,y+5);c.lineTo(tx+7,y+11);c.lineTo(tx,y+h-2);c.lineTo(tx-7,y+11);c.closePath();c.stroke()}
    }else if(block.motif==="vine"){
      c.beginPath();c.moveTo(x+3,y+h-3);for(let tx=x+10;tx<x+w;tx+=20)c.quadraticCurveTo(tx,y+5,tx+10,y+h-3);c.stroke();
    }else if(block.motif==="wax"){
      for(let tx=x+10;tx<x+w;tx+=tile){c.fillRect(tx,y+5,5,7+(tx%3)*2);c.beginPath();c.arc(tx+2.5,y+12+(tx%3)*2,2.5,0,Math.PI*2);c.fill()}
    }else if(block.motif==="thorn"){
      c.beginPath();c.moveTo(x+3,y+h-4);for(let tx=x+12;tx<x+w;tx+=14){c.lineTo(tx,y+7);c.lineTo(tx+7,y+h-4)}c.stroke();
    }else if(block.motif==="void"){
      for(let tx=x+tile;tx<x+w;tx+=tile){c.beginPath();c.moveTo(tx,y+5);c.lineTo(tx-8,y+h-2);c.stroke()}c.globalAlpha=.45;c.strokeRect(x+4,y+7,w-8,7);
    }
    c.restore();
  }
  private drawPlatforms(){
    const c=this.ctx;
    for(const [index,p] of this.runtimePlatforms.entries()){
      const block=blockForPlatform(this.level.worldId,index,p.y>=640,!!this.level.bonus);
      c.save();c.shadowBlur=12;c.shadowColor=this.widow?COLORS.crimson:block.top;c.fillStyle=block.shadow;c.fillRect(p.x-3,p.y+5,p.w+6,p.h+4);c.shadowBlur=0;
      const face=c.createLinearGradient(0,p.y,0,p.y+p.h);face.addColorStop(0,block.base);face.addColorStop(1,block.side);c.fillStyle=face;c.fillRect(p.x,p.y,p.w,p.h);
      c.fillStyle=this.widow?COLORS.crimson:block.top;c.fillRect(p.x,p.y,p.w,7);c.fillStyle=block.edge;c.fillRect(p.x,p.y+7,p.w,2);c.fillStyle=block.side;c.fillRect(p.x,p.y+p.h-3,p.w,3);
      c.strokeStyle=block.highlight;c.globalAlpha=.32;c.lineWidth=1.4;for(let tx=p.x+block.tileWidth;tx<p.x+p.w;tx+=block.tileWidth){c.beginPath();c.moveTo(tx,p.y+8);c.lineTo(tx,p.y+p.h-3);c.stroke()}c.globalAlpha=1;
      this.drawBlockMotif(block,p.x,p.y,p.w,p.h);c.strokeStyle=block.edge;c.lineWidth=2.2;c.strokeRect(p.x,p.y,p.w,p.h);c.restore();
    }
  }
  private drawShadowUnder(cx:number,bottom:number,w:number){const c=this.ctx;const platform=this.runtimePlatforms.find(s=>cx>s.x&&cx<s.x+s.w&&s.y>=bottom-6);if(!platform)return;const distance=platform.y-bottom,scale=clamp(1-distance/260,.22,1);c.save();c.globalAlpha=.16*scale;c.fillStyle="#000";c.beginPath();c.ellipse(cx,platform.y-2,w*scale,5*scale,0,0,Math.PI*2);c.fill();c.restore()}
  private drawHud(){
    const c=this.ctx,skin=this.skinFor(this.hero);c.fillStyle="#02030a";c.fillRect(0,0,W,70);c.strokeStyle=skin.accent;c.lineWidth=2;c.beginPath();c.moveTo(0,68);c.lineTo(W,68);c.stroke();
    this.label(`SCORE ${String(this.score).padStart(7,"0")}`,24,28,17,COLORS.shine);this.label(`HI ${String(Math.max(this.score,this.settings.highScore)).padStart(7,"0")}`,24,53,12,COLORS.blue);
    if(this.checkpoint&&this.runMode==="story")this.label(`CP ${this.checkpoint.levelIndex+1}`,188,53,8,"#FFD36A","center");
    this.drawHero(215,34,this.hero,.55,false);this.label(`× ${this.lives}`,235,40,17,skin.accent);
    const stage=this.level.bonus?"BONUS VAULT":this.runMode==="encore"?`ENCORE ${this.encoreIndex+1}/5`:`STAGE ${this.levelIndex+1}/12`;
    this.label(stage,W/2,23,15,this.level.bonus?"#FFD36A":COLORS.shine,"center");this.label(this.level.world,W/2,45,11,this.level.tint,"center");
    const fx=[this.upgrades.speed&&"SPD",this.upgrades.rapid&&"FIR",this.upgrades.range&&"RNG",this.upgrades.velocity&&"COM",this.upgrades.shield&&"SHD",this.upgrades.venom&&"FNG",this.upgrades.chain&&"CHN",this.upgrades.crown&&"CRN"].filter(Boolean).join(" ");
    const bubbleFx=this.bubbleEffect!=="none"?` · ${this.bubbleEffect.toUpperCase()}`:"";this.label(fx?`FX ${fx}${bubbleFx}`:`FX —${bubbleFx}`,W/2,62,7,fx||bubbleFx?COLORS.jade:"#30445e","center");
    this.label("JUMP",594,25,10,COLORS.blue);for(let i=0;i<2;i++){c.fillStyle=i<this.player.jumpsRemaining?skin.secondary:"#1c2b38";c.fillRect(596+i*16,36,10,10);c.strokeStyle=COLORS.shine;c.strokeRect(596+i*16,36,10,10)}
    this.label("VENOM",685,25,13,COLORS.pink);["V","E","N","O","M"].forEach((l,i)=>this.label(l,682+i*23,51,17,this.venom.has(l)?"#FFD36A":"#3a2541"));this.label(`${Math.max(0,Math.ceil(this.levelTime))}`,922,40,24,this.widow?COLORS.crimson:COLORS.jade,"right");
    if(this.level.boss&&this.widow&&this.widow.phase!=="entrance")this.drawBossHealth(this.widow);if(this.devTools)this.label("DEV · [ ] SKIP LEVEL · F3 DEBUG",6,H-6,9,"#3a4f6e");
  }
  private drawBossHealth(w:WidowState){
    const c=this.ctx,pips=w.maxHp,cx=W/2,y=82,size=16,gap=26,startX=cx-((pips-1)*gap)/2;
    c.save();this.label(`${w.act.toUpperCase()} · THE WIDOW`,cx,74,11,COLORS.pink,"center");
    for(let i=0;i<pips;i++){const x=startX+i*gap,filled=i<w.hp;c.strokeStyle=COLORS.crimson;c.lineWidth=2;c.fillStyle=filled?COLORS.crimson:"rgba(0,0,0,.3)";c.beginPath();
      c.moveTo(x,y-size*.8);c.lineTo(x-size*.7,y-size*.15);c.lineTo(x-size*.7,y+size*.4);c.lineTo(x,y+size*.9);c.lineTo(x+size*.7,y+size*.4);c.lineTo(x+size*.7,y-size*.15);c.closePath();c.fill();c.stroke();}
    if(w.phase==="staggered")this.label(w.act==="vow"?"BOUND ECHOES RELEASED":"VULNERABLE — TRAP HER!",cx,110,11,COLORS.jade,"center");
    else if(w.act==="host")this.label(`CONTRACT ANCHORS ${((w.chargedAnchors&1)?1:0)+((w.chargedAnchors&2)?1:0)}/2`,cx,110,9,COLORS.shine,"center");
    else if(w.act==="vow")this.label(`SHARED ECHOES ${w.vowEchoes}/4`,cx,110,9,COLORS.shine,"center");
    c.restore();
  }
  private drawDebugOverlay(){const c=this.ctx,p=this.player;c.save();c.lineWidth=2;for(const audit of this.platformAudit){const platform=this.level.platforms[audit.id];c.strokeStyle=audit.status==="unreachable"?"#ff405c":audit.status==="double"?"#ffd36a":"#43ffb2";c.strokeRect(platform.x,platform.y,platform.w,platform.h);this.label(`${audit.id}:${audit.status}`,platform.x+3,platform.y-4,9,c.strokeStyle)}c.strokeStyle="#fff";c.strokeRect(p.x,p.y,p.w,p.h);c.fillStyle="#fff";c.fillRect(p.x,p.y+p.h-1,p.w,2);c.fillStyle="rgba(0,0,0,.78)";c.fillRect(16,82,275,104);this.label(`F3 DEBUG  Y ${p.y.toFixed(1)}  VY ${p.vy.toFixed(1)}`,26,104,11,COLORS.shine);this.label(`GROUND ${p.grounded}  PLATFORM ${p.currentPlatformId??"—"}`,26,126,11,p.grounded?COLORS.jade:COLORS.pink);this.label(`JUMPS ${p.jumpsRemaining}/${p.maxJumps}  COYOTE ${this.coyote.toFixed(2)}`,26,148,11,COLORS.blue);this.label(`BUFFER ${this.jumpBuffer.toFixed(2)}  APEX ${TARGET_JUMP_HEIGHT.toFixed(1)}PX`,26,170,11,COLORS.jade);c.restore()}
  private drawChainPreview(bubbles:Bubble[]){
    const c=this.ctx,link=this.bubbleEffect==="venom"&&!this.level.boss?Number.POSITIVE_INFINITY:this.bubbleEffect==="pulse"||(this.bubbleEffect==="venom"&&!!this.level.boss)||this.upgrades.chain?PULSE_CHAIN_RADIUS:BASE_CHAIN_RADIUS,occupied=bubbles.filter(b=>b.phase==="occupied"||b.phase==="warning"||b.phase==="bound");
    c.save();c.strokeStyle=this.pendingChain?"#FFFFFF":COLORS.jade;c.lineWidth=this.pendingChain?4:2;c.setLineDash(this.pendingChain?[]:[5,6]);c.globalAlpha=this.pendingChain?.8:.36;
    for(let i=0;i<occupied.length;i++)for(let j=i+1;j<occupied.length;j++)if(dist(occupied[i],occupied[j])<=link){c.beginPath();c.moveTo(occupied[i].x,occupied[i].y);c.lineTo(occupied[j].x,occupied[j].y);c.stroke()}
    c.restore();
    if(this.pendingChain){const ids=collectChain(occupied,this.pendingChain.rootId,link),root=occupied.find(b=>b.id===this.pendingChain!.rootId);if(root)this.label(`CHAIN ${ids.length} · ×${[1,2,3,4,6,8,13][Math.min(6,Math.max(0,ids.length-1))]}`,root.x,root.y-root.r-18,9,"#FFFFFF","center")}
  }
  private drawBubble(b:Bubble){
    const c=this.ctx,color=this.skinFor(this.hero).bubble;
    const ratio=bubbleLifetimeRatio(b),tension=1-ratio,wob=Math.sin(b.age*(8+tension*16)),wob2=Math.cos(b.age*(6.3+tension*11));
    const stretch=1+clamp(Math.abs(b.vx)/1200,0,.28),r=b.r*(1+wob*(.035+tension*.075));
    const alpha=b.phase==="warning"&&Math.floor(b.age*10)%2===0?.35:.92;
    c.save();
    if(Math.abs(b.vx)>140){c.strokeStyle=color;c.lineWidth=2;for(let i=1;i<=2;i++){c.globalAlpha=.16/i;c.beginPath();c.arc(b.x-b.vx*.018*i,b.y-b.vy*.018*i,r*.9,0,Math.PI*2);c.stroke()}}
    c.globalAlpha=alpha;
    c.fillStyle="rgba(255,42,157,.18)";c.strokeStyle=b.phase==="warning"?COLORS.crimson:color;c.lineWidth=3;c.shadowBlur=12;c.shadowColor=b.phase==="warning"?COLORS.crimson:color;
    c.beginPath();c.ellipse(b.x,b.y,r*stretch*(1+wob2*.03),(r/stretch)*(1-wob2*.03),0,0,Math.PI*2);c.fill();c.stroke();c.shadowBlur=0;
    c.strokeStyle=COLORS.shine;c.lineWidth=2;const sh=b.age*.8;c.beginPath();c.arc(b.x-r*.28,b.y-r*.28,r*.3,Math.PI+sh*.3,Math.PI*1.55+sh*.3);c.stroke();
    c.fillStyle=COLORS.shine;c.globalAlpha=alpha*.8;c.beginPath();c.arc(b.x+r*.34,b.y+r*.22,r*.09,0,Math.PI*2);c.fill();c.globalAlpha=alpha;
    if(b.phase!=="bound"){c.strokeStyle=ratio<.25?COLORS.crimson:COLORS.shine;c.lineWidth=2;c.setLineDash([4,3]);c.beginPath();c.arc(b.x,b.y,r+7,-Math.PI/2,-Math.PI/2+Math.PI*2*ratio);c.stroke();c.setLineDash([])}
    if(b.anchored){c.strokeStyle="#FFD36A";c.lineWidth=3;c.beginPath();c.moveTo(b.x,b.y+r);c.lineTo(b.x,b.y+r+9);c.lineTo(b.x-6,b.y+r+5);c.moveTo(b.x,b.y+r+9);c.lineTo(b.x+6,b.y+r+5);c.stroke()}
    if(b.phase==="bound")this.label(String((b.boundEcho??0)+1),b.x,b.y+7,13,COLORS.shine,"center");
    if(b.enemyId===WIDOW_ENEMY_ID&&this.widow){this.drawWidow({...this.widow,x:b.x,y:b.y})}
    else if(b.enemyId){const e=this.enemies.find(e=>e.id===b.enemyId);if(e)this.drawEnemy({...e,x:b.x-e.w/2,y:b.y-e.h/2},true)}
    c.restore()}
  private drawEnemy(e:Enemy,trapped=false){
    const c=this.ctx,x=e.x+e.w/2,y=e.y+e.h/2,fur=e.state==="furious";
    const t=trapped?this.animTime:e.timer;
    const face:1|-1=Math.abs(e.vx)>4?(e.vx>0?1:-1):(this.player.x+17>x?1:-1);
    c.save();c.translate(x,y);c.scale(BubbleHexEngine.ENEMY_SCALE,BubbleHexEngine.ENEMY_SCALE);
    if(trapped){c.globalAlpha=.85;c.rotate(Math.sin(this.animTime*2.2)*.16)}
    if(fur)c.rotate(Math.sin(t*18)*.12);
    const col=fur?COLORS.crimson:COLORS.pink;
    if(fur&&!trapped){c.save();c.strokeStyle=COLORS.crimson;c.globalAlpha=.25+Math.sin(t*12)*.12;c.lineWidth=3;c.beginPath();c.arc(0,0,25+Math.sin(t*9)*2,0,Math.PI*2);c.stroke();c.restore()}
    if(e.elite){c.strokeStyle="#FFD36A";c.lineWidth=2;c.shadowBlur=12;c.shadowColor="#FFD36A";c.beginPath();c.arc(0,0,27+Math.sin(t*5)*2,0,Math.PI*2);c.stroke();c.shadowBlur=0}
    c.fillStyle=e.elite?"#FFD36A":COLORS.blue;for(let i=0;i<e.rank;i++)c.fillRect(-e.rank*3+i*7,-32,5,3);
    this.drawEnemyVariantCue(e,t,trapped);
    if(e.kind==="love"){
      const beat=1+Math.pow(Math.max(0,Math.sin(t*6)),3)*.12,chomp=(Math.sin(t*7)+1)*1.6;
      c.save();c.rotate(Math.sin(t*11)*.07*Math.min(1,Math.abs(e.vx)/70));c.scale(beat,beat);
      this.drawHeart(0,0,18,col);
      c.fillStyle=COLORS.shine;for(let i=-9;i<=9;i+=6){c.beginPath();c.moveTo(i,3);c.lineTo(i+3,9+chomp);c.lineTo(i+6,3);c.fill()}
      c.fillStyle=COLORS.void;c.fillRect(-9+face*2,-6,4,4);c.fillRect(5+face*2,-6,4,4);
      c.fillStyle=COLORS.shine;c.fillRect(-8+face*2,-5,1.5,1.5);c.fillRect(6+face*2,-5,1.5,1.5);
      c.restore();
    }else if(e.kind==="bat"){
      const flap=Math.sin(t*15);
      c.rotate(clamp(e.vx/420,-.3,.3));
      c.fillStyle="#171028";
      for(const s of [-1,1] as const){c.save();c.scale(s,1);c.translate(4,0);c.rotate(-flap*.55);c.beginPath();c.moveTo(0,0);c.quadraticCurveTo(12,-14,24,-9);c.quadraticCurveTo(17,-1,21,7);c.quadraticCurveTo(10,3,0,9);c.closePath();c.fill();c.restore()}
      c.fillStyle=col;c.beginPath();c.ellipse(0,2+flap*1.5,7,10,0,0,Math.PI*2);c.fill();
      c.beginPath();c.moveTo(-6,-5+flap);c.lineTo(-9,-14+flap);c.lineTo(-1,-8+flap);c.closePath();c.fill();
      c.beginPath();c.moveTo(6,-5+flap);c.lineTo(9,-14+flap);c.lineTo(1,-8+flap);c.closePath();c.fill();
      c.fillStyle=COLORS.shine;c.fillRect(-4+face,-2+flap*1.5,2.5,2.5);c.fillRect(2+face,-2+flap*1.5,2.5,2.5);
      c.beginPath();c.moveTo(-2,6+flap*1.5);c.lineTo(-1,9+flap*1.5);c.lineTo(0,6+flap*1.5);c.closePath();c.fill();
    }else if(e.kind==="eye"){
      const aim=Math.atan2(this.player.y+24-y,this.player.x+17-x);
      const charge=!trapped&&e.state!=="trapped"&&e.cooldown<.5?1-Math.max(0,e.cooldown)/.5:0;
      const cycle=t%4.2,lid=cycle<.22?Math.sin(cycle/.22*Math.PI):charge*.3;
      c.rotate(Math.sin(t*2)*.06);c.scale(1,1-lid*.8);
      if(charge){c.strokeStyle=COLORS.crimson;c.globalAlpha*=.6;c.lineWidth=2;c.beginPath();c.ellipse(0,0,22+charge*4,15+charge*3,0,0,Math.PI*2);c.stroke();c.globalAlpha=trapped?.85:1}
      c.strokeStyle=col;c.lineWidth=5;c.beginPath();c.ellipse(0,0,19,12,0,0,Math.PI*2);c.stroke();
      c.fillStyle="#0d0716";c.beginPath();c.ellipse(0,0,16,9.5,0,0,Math.PI*2);c.fill();
      c.fillStyle=charge>.4?COLORS.crimson:COLORS.blue;c.beginPath();c.arc(Math.cos(aim)*5,Math.sin(aim)*3,7+charge*1.5,0,Math.PI*2);c.fill();
      c.fillStyle=COLORS.shine;c.fillRect(Math.cos(aim)*5-2,Math.sin(aim)*3-3,3,4);
      c.strokeStyle=col;c.lineWidth=2;for(let i=-1;i<=1;i++){c.beginPath();c.moveTo(i*8,-12);c.lineTo(i*10,-17);c.stroke()}
    }else if(e.kind==="witch"){
      const bobW=Math.sin(t*3)*3,charge=!trapped&&e.state!=="trapped"&&e.cooldown<.65?1-Math.max(0,e.cooldown)/.65:0;
      c.translate(0,bobW);
      c.fillStyle="#26102f";c.beginPath();c.moveTo(-20,2);c.lineTo(0,-22);c.lineTo(20,2);c.closePath();c.fill();
      c.beginPath();c.moveTo(-2,-19);c.quadraticCurveTo(4+Math.sin(t*2.6)*4,-34,12,-30);c.quadraticCurveTo(6,-25,4,-20);c.closePath();c.fill();
      c.fillStyle=col;c.beginPath();c.moveTo(-13,0);c.lineTo(13,0);c.lineTo(15,22);
      for(let hx=13;hx>=-15;hx-=5)c.lineTo(hx,22+Math.sin(t*6+hx)*2);
      c.closePath();c.fill();
      c.fillStyle=COLORS.shine;c.fillRect(-7,-9,5,6);c.fillRect(2,-9,5,6);
      c.fillStyle="#26102f";c.fillRect(-6+face,-8,2,3);c.fillRect(3+face,-8,2,3);
      if(charge){c.save();c.translate(face*17,-2);c.rotate(t*9);c.fillStyle=COLORS.pink;c.globalAlpha*=.4+charge*.6;for(let i=0;i<4;i++){c.fillRect(-1.5,-(2+5*charge),3,4+10*charge);c.rotate(Math.PI/4)}c.restore()}
    }else if(e.kind==="doll"){
      const cyc=t%3.4,charging=cyc>2.55,windup=cyc>2.2&&!charging;
      const shiver=windup?Math.sin(t*46)*2:charging?Math.sin(t*28):Math.sin(t*5)*.5;
      c.translate(shiver,0);if(charging)c.rotate(face*.16);
      if(charging&&!trapped){c.strokeStyle="rgba(255,214,241,.4)";c.lineWidth=2;for(let i=0;i<3;i++){const ly=-8+i*8;c.beginPath();c.moveTo(-face*14,ly);c.lineTo(-face*(24+i*4),ly);c.stroke()}}
      c.save();c.translate(-face*13,4);c.rotate(charging?t*12:t*2);c.strokeStyle="#8f8f9f";c.lineWidth=2.5;c.beginPath();c.moveTo(0,-6);c.lineTo(0,6);c.moveTo(-4,-6);c.lineTo(4,-6);c.stroke();c.restore();
      c.fillStyle="#2a1629";c.beginPath();c.arc(0,-8,12,0,Math.PI*2);c.fill();c.fillRect(-12,2,24,21);
      c.strokeStyle=col;c.lineWidth=2;c.beginPath();c.moveTo(-7,-12);c.lineTo(-3,-7);c.moveTo(-3,-12);c.lineTo(-7,-7);c.moveTo(3,-12);c.lineTo(7,-7);c.moveTo(7,-12);c.lineTo(3,-7);c.stroke();
      c.beginPath();c.moveTo(-5,-2);c.lineTo(5,-2);for(let mx=-4;mx<=4;mx+=3){c.moveTo(mx,-3.5);c.lineTo(mx,-.5)}c.stroke();
      c.strokeStyle="rgba(255,214,241,.35)";c.beginPath();c.moveTo(-12,9);c.lineTo(12,13);c.stroke();
    }else{
      const jaw=e.vy<-40?6:2+Math.max(0,Math.sin(t*4))*2;
      const springy=clamp(-e.vy/1400,-.15,.22);
      c.rotate(clamp(e.vx/900,-.15,.15));c.scale(1-springy*.4,1+springy*.6);
      c.fillStyle="#0a0510";c.fillRect(-8,3,16,4+jaw);
      c.fillStyle="#ded8dc";c.beginPath();c.arc(0,-5,16,0,Math.PI*2);c.fill();c.fillRect(-9,5+jaw,18,6);
      c.fillStyle=COLORS.void;c.fillRect(-10,-10,6,7);c.fillRect(4,-10,6,7);c.fillRect(-3,-1,6,4);
      if(fur){c.fillStyle=COLORS.crimson;c.fillRect(-9,-9,4,5);c.fillRect(5,-9,4,5)}
      c.fillStyle="#ded8dc";for(let tx=-8;tx<=5;tx+=4)c.fillRect(tx,3,2.5,3);
      c.strokeStyle=col;c.lineWidth=2.5;c.beginPath();c.moveTo(-13,-14);c.lineTo(-19,-26+Math.sin(t*8)*1.5);c.moveTo(-16,-21);c.lineTo(-20,-19);c.moveTo(13,-14);c.lineTo(19,-26+Math.sin(t*8+1)*1.5);c.moveTo(16,-21);c.lineTo(20,-19);c.stroke();
    }
    c.restore()}
  private drawEnemyVariantCue(e:Enemy,t:number,trapped:boolean){
    const c=this.ctx,cue=variantCue(e.kind,e.variant,t,dist(this.player,e));
    const glyph:Partial<Record<EnemyVariant,string>>={paired:"↔",excited:"!",feint:"⇆",roost:"⌂",sweep:"—",shy:"×",orbit:"✦",chorus:"♫",windup:"⌁",frayed:"//",anchor:"⌖",briar:"^^"};
    const mark=glyph[e.variant];if(mark){c.save();c.font="900 9px monospace";c.textAlign="center";c.textBaseline="middle";c.lineWidth=3;c.strokeStyle="#050509";c.strokeText(mark,0,-38);c.fillStyle="#FFFFFF";c.fillText(mark,0,-38);c.restore()}
    if(!trapped&&(cue==="warning"||cue==="closed")){c.save();c.strokeStyle=cue==="warning"?"#FFD36A":"#FFFFFF";c.lineWidth=2;c.setLineDash(cue==="warning"?[4,3]:[2,3]);c.beginPath();c.arc(0,0,31+Math.sin(t*18)*2,0,Math.PI*2);c.stroke();c.setLineDash([]);c.font="900 7px monospace";c.textAlign="center";c.fillStyle=c.strokeStyle;c.fillText(cue==="closed"?"CLOSED":variantLabel(e.variant).toUpperCase(),0,-46);c.restore()}
  }
  private drawHero(x:number,y:number,hero:HeroId,scale=1,ghost=false,motion:HeroMotion={}){drawHeroArt(this.ctx,{hero,skin:this.skinFor(hero),x,y,scale,time:this.animTime,...motion,ghost})}
  private drawWidow(w:WidowState){
    const c=this.ctx;
    if(w.phase==="telegraph"){
      c.save();c.strokeStyle=COLORS.crimson;c.lineWidth=3;c.setLineDash([10,10]);c.globalAlpha=.5+Math.sin(w.phaseTimer*30)*.3;
      c.beginPath();c.moveTo(w.x,w.y);c.lineTo(w.x+Math.cos(w.lungeAngle)*900,w.y+Math.sin(w.lungeAngle)*900);c.stroke();c.setLineDash([]);c.restore();
    }
    const scale=w.phase==="entrance"?clamp(w.phaseTimer/1.2,.2,1):1;
    const glow=w.phase==="telegraph"?(.6+Math.sin(w.phaseTimer*40)*.4):w.phase==="staggered"?(.5+Math.sin(w.phaseTimer*14)*.5):1;
    const bodyColor=w.phase==="staggered"?COLORS.jade:w.phase==="defeated"?"#3a2230":COLORS.crimson;
    c.save();c.translate(w.x,w.y);
    if(w.phase==="telegraph")c.translate(Math.sin(w.phaseTimer*60)*2.5,0);
    c.scale(scale,scale);c.globalAlpha=w.phase==="defeated"?clamp(1-w.phaseTimer/1.4,0,1):1;
    if(w.phase==="lunge"){c.rotate(clamp(Math.atan2(w.vy,w.vx)*.12,-.3,.3));c.scale(1.14,.9)}
    if(w.phase==="lunge"){c.save();c.globalAlpha*=.35;c.translate(-w.vx*.03,-w.vy*.03);this.drawHeart(0,0,34,"#09080d");c.restore()}
    // skittering spider legs
    const skit=w.phase==="chase"||w.phase==="lunge"?11:w.phase==="telegraph"?2:4;
    c.strokeStyle="#b8a7a8";c.lineWidth=3;
    for(const s of [-1,1] as const)for(let i=0;i<3;i++){
      const step=Math.sin(w.age*skit+i*2.1+(s>0?0:1.2))*(w.phase==="telegraph"?.08:.3);
      const by=-6+i*11;
      c.beginPath();c.moveTo(s*26,by);c.lineTo(s*(44+Math.cos(step)*6),by+10+Math.sin(step)*7);c.lineTo(s*(60+Math.cos(step)*9),by+2+Math.sin(step)*12);c.stroke();
    }
    c.shadowBlur=20*glow;c.shadowColor=w.phase==="staggered"?COLORS.jade:COLORS.pink;this.drawHeart(0,0,38,"#09080d");c.shadowBlur=0;
    c.strokeStyle=bodyColor;c.lineWidth=4;c.beginPath();c.moveTo(-10,-18);c.lineTo(2,-4);c.lineTo(-6,8);c.lineTo(10,23);c.stroke();
    const blinkW=w.age%3.7<.14;
    c.fillStyle=COLORS.shine;if(blinkW){c.fillRect(-18,-6,10,2);c.fillRect(8,-6,10,2)}else{c.fillRect(-18,-8,10,6);c.fillRect(8,-8,10,6);c.fillStyle=bodyColor;c.fillRect(-15,-7,4,4);c.fillRect(11,-7,4,4)}
    // tarnished crown and rippling veil
    c.strokeStyle="#7f6d70";c.lineWidth=4;c.beginPath();c.moveTo(-25,-30);c.lineTo(-14,-52+Math.sin(w.age*3)*1.5);c.lineTo(0,-37);c.lineTo(15,-55+Math.sin(w.age*3+1)*1.5);c.lineTo(27,-28);c.stroke();
    c.strokeStyle="rgba(184,167,168,.4)";c.lineWidth=2;
    for(const s of [-1,1] as const){c.beginPath();c.moveTo(s*20,-24);c.quadraticCurveTo(s*(34+Math.sin(w.age*2.2+s)*4),0,s*(28+Math.sin(w.age*1.8)*5),28);c.stroke()}
    if(w.phase==="staggered")for(let i=0;i<3;i++){const a=w.phaseTimer*4+i*2.09;this.label("★",Math.cos(a)*26,-44+Math.sin(a)*7,12,COLORS.jade,"center")}
    if(w.phase==="defeated"){c.strokeStyle=COLORS.pink;c.lineWidth=2;c.globalAlpha=clamp(1-w.phaseTimer/1.4,0,1)*.7;for(let i=0;i<5;i++){const tx=-30+i*15,rise=w.phaseTimer*(40+i*14);c.beginPath();c.moveTo(tx,10-rise);c.quadraticCurveTo(tx+6,-6-rise,tx,-22-rise);c.stroke()}}
    c.restore();
  }
  private drawProjectile(p:Projectile){
    const c=this.ctx,angle=Math.atan2(p.vy,p.vx),reduced=this.settings.reducedMotion,pulse=reduced?1:1+Math.sin(this.animTime*14)*.12,neon=p.kind==="tear"?"#56E7FF":"#FFD36A",edge=p.kind==="tear"?COLORS.blue:COLORS.pink,tail=22,tx=p.x-Math.cos(angle)*tail,ty=p.y-Math.sin(angle)*tail;
    c.save();c.lineCap="round";c.strokeStyle="rgba(0,0,0,.96)";c.lineWidth=14;c.beginPath();c.moveTo(tx,ty);c.lineTo(p.x,p.y);c.stroke();c.strokeStyle="#FFFFFF";c.lineWidth=8;c.beginPath();c.moveTo(tx,ty);c.lineTo(p.x,p.y);c.stroke();c.strokeStyle=neon;c.lineWidth=4;c.shadowBlur=18;c.shadowColor=neon;c.beginPath();c.moveTo(tx,ty);c.lineTo(p.x,p.y);c.stroke();c.translate(p.x,p.y);c.rotate(angle+(p.kind==="star"&&!reduced?this.animTime*5:0));c.scale(pulse,pulse);c.fillStyle=neon;c.strokeStyle="#050509";c.lineWidth=5;
    if(p.kind==="tear"){c.beginPath();c.moveTo(12,0);c.quadraticCurveTo(-1,-10,-10,0);c.quadraticCurveTo(-1,10,12,0);c.closePath();c.fill();c.stroke();c.strokeStyle=edge;c.lineWidth=3;c.stroke();c.fillStyle="#FFFFFF";c.beginPath();c.arc(3,-2,3,0,Math.PI*2);c.fill()}
    else{c.beginPath();for(let i=0;i<16;i++){const radius=i%2===0?12:5,a=i*Math.PI/8;if(i===0)c.moveTo(Math.cos(a)*radius,Math.sin(a)*radius);else c.lineTo(Math.cos(a)*radius,Math.sin(a)*radius)}c.closePath();c.fill();c.stroke();c.strokeStyle=edge;c.lineWidth=3;c.stroke();c.fillStyle="#FFFFFF";c.beginPath();c.arc(0,0,3.5,0,Math.PI*2);c.fill()}
    c.shadowBlur=0;c.restore()}
  private drawReward(r:Reward){
    const c=this.ctx,T=this.animTime;
    const age=(r.letter?12:10)-r.life,pop=Math.min(1,age/.22);
    c.save();c.translate(r.x,r.y);c.scale(.4+.6*pop,.4+.6*pop);
    if(r.life<2)c.globalAlpha=.4+.5*Math.abs(Math.sin(T*10));
    c.shadowBlur=10;c.shadowColor=r.letter?"#FFD36A":COLORS.pink;
    if(r.letter){
      const spin=Math.cos(T*4+r.x),sx=Math.max(.16,Math.abs(spin));
      c.fillStyle="#33220b";c.strokeStyle="#FFD36A";c.lineWidth=3;c.beginPath();c.ellipse(0,0,17*sx,17,0,0,Math.PI*2);c.fill();c.stroke();
      if(sx>.5){c.save();c.scale(sx,1);this.label(r.letter,0,7,21,"#FFD36A","center");c.restore()}
    }else if(r.kind==="RING"){
      c.strokeStyle="#FFD36A";c.lineWidth=6;c.beginPath();c.arc(0,2,10,0,Math.PI*2);c.stroke();
      c.fillStyle=COLORS.shine;c.beginPath();c.moveTo(0,-14);c.lineTo(5,-8);c.lineTo(0,-3);c.lineTo(-5,-8);c.closePath();c.fill();
    }else if(r.kind==="PERFUME"){
      c.fillStyle=COLORS.jade;c.fillRect(-9,-8,18,20);c.strokeStyle="#B9FFF0";c.lineWidth=2;c.strokeRect(-6,-4,12,12);
      c.fillStyle="#FFD36A";c.fillRect(-5,-15,10,7);
      if(Math.sin(T*3+r.x)>.7){c.globalAlpha*=.7;this.drawHeart(12,-14,4,COLORS.pink)}
    }else if(r.kind==="CHERRY"){
      c.strokeStyle="#2d7a4f";c.lineWidth=2.5;c.beginPath();c.moveTo(-4,3);c.quadraticCurveTo(-2,-10,2,-13);c.moveTo(6,5);c.quadraticCurveTo(6,-6,2,-13);c.stroke();
      c.fillStyle="#2d7a4f";c.beginPath();c.ellipse(6,-13,6,3,-.5,0,Math.PI*2);c.fill();
      c.fillStyle="#FF3B5C";c.beginPath();c.arc(-5,6,7,0,Math.PI*2);c.fill();c.beginPath();c.arc(7,8,7,0,Math.PI*2);c.fill();
      c.fillStyle=COLORS.shine;c.fillRect(-8,2,3,3);c.fillRect(4,4,3,3);
    }else if(r.kind==="DRAGON FRUIT"){
      c.fillStyle=COLORS.pink;c.beginPath();c.ellipse(0,0,10,13,.2,0,Math.PI*2);c.fill();
      c.fillStyle=COLORS.jade;for(let i=0;i<5;i++){const a=i*1.256+.5;c.beginPath();c.moveTo(Math.cos(a)*8,Math.sin(a)*11);c.lineTo(Math.cos(a)*13,Math.sin(a)*16);c.lineTo(Math.cos(a+.5)*7,Math.sin(a+.5)*10);c.closePath();c.fill()}
      c.fillStyle=COLORS.shine;c.fillRect(-3,-7,3,4);
    }else if(r.kind==="BLACKBERRY"){
      c.fillStyle="#7840a8";for(const [bx,by] of [[-5,-4],[5,-4],[0,-8],[-6,4],[6,4],[0,1],[0,9]] as const){c.beginPath();c.arc(bx,by,5,0,Math.PI*2);c.fill()}
      c.fillStyle="#a76fd6";c.beginPath();c.arc(-4,-5,2,0,Math.PI*2);c.fill();c.beginPath();c.arc(1,0,2,0,Math.PI*2);c.fill();
      c.fillStyle="#2d7a4f";c.beginPath();c.moveTo(0,-12);c.lineTo(4,-17);c.lineTo(-3,-15);c.closePath();c.fill();
    }else if(r.kind==="MEMORY SHARD"){
      c.fillStyle="#756CFF";c.strokeStyle="#FFFFFF";c.lineWidth=3;c.beginPath();c.moveTo(0,-15);c.lineTo(11,0);c.lineTo(0,15);c.lineTo(-11,0);c.closePath();c.fill();c.stroke();
      c.strokeStyle="#20C98B";c.beginPath();c.moveTo(0,-10);c.lineTo(0,10);c.moveTo(-6,0);c.lineTo(6,0);c.stroke();c.font="900 7px monospace";c.textAlign="center";c.fillStyle="#FFFFFF";c.fillText("RISK",0,25);
    }else if(r.kind==="CROWN"){
      c.fillStyle="#FFD36A";c.beginPath();c.moveTo(-13,8);c.lineTo(-13,-6);c.lineTo(-6,0);c.lineTo(0,-10);c.lineTo(6,0);c.lineTo(13,-6);c.lineTo(13,8);c.closePath();c.fill();
      c.fillStyle=COLORS.crimson;c.beginPath();c.arc(0,3,2.5,0,Math.PI*2);c.fill();
      c.fillStyle=COLORS.jade;c.beginPath();c.arc(-8,4,2,0,Math.PI*2);c.fill();c.beginPath();c.arc(8,4,2,0,Math.PI*2);c.fill();
    }else{this.drawHeart(0,0,12,COLORS.pink)}
    c.shadowBlur=0;
    const sa=T*3.2+r.x*.1;c.fillStyle="#fff";c.globalAlpha*=.5+.5*Math.sin(T*6+r.x);
    c.beginPath();c.arc(Math.cos(sa)*13,Math.sin(sa*1.3)*9,1.5,0,Math.PI*2);c.fill();
    c.restore()}
  private drawStageIntro(){
    const fragment=STORY_FRAGMENTS.find(item=>item.id===this.level.loreFragmentId),env=this.level.environment;
    const mechanics=[env?.currents?.length&&"CURRENTS",env?.mirrorDoors?.length&&"MIRRORS",env?.vines?.length&&"VINES",env?.candles?.length&&"SEALS",env?.gravityZones?.length&&"GRAVITY",env?.phasePlatforms?.length&&"PHASE"].filter(Boolean).join(" · ");
    this.ctx.fillStyle="rgba(5,5,9,.88)";this.ctx.fillRect(100,210,760,270);
    const stageLabel=this.level.bonus?"ORIGINAL MODE SECRET":this.level.encore?`ENCORE ${this.encoreIndex+1}/5`:`STAGE ${this.levelIndex+1}/12`;
    this.label(stageLabel,W/2,260,18,this.level.tint,"center");this.label(this.level.name.toUpperCase(),W/2,316,34,COLORS.shine,"center","Georgia");this.label(this.level.world,W/2,354,14,COLORS.pink,"center");
    if(mechanics)this.label(`${mechanics} · READ THE MARKS`,W/2,390,10,COLORS.blue,"center");
    if(this.level.encore&&this.level.medalTargets)this.label(`MEDALS · SCORE ${this.level.medalTargets.score} · CHAIN ${this.level.medalTargets.fullChain}`,W/2,424,10,"#FFD36A","center");
    else if(this.level.bonus)this.label("CHAIN THEM ALL BEFORE THE VAULT SEALS",W/2,424,11,COLORS.jade,"center");
    else if(fragment)this.label(`JADE DOOR: ${fragment.title.toUpperCase()}`,W/2,424,11,COLORS.jade,"center");
    this.label("SAFE OPENING · PLAN YOUR FIRST ROUTE",W/2,456,9,"#B9FFF0","center");
  }
  private drawHurry(){this.ctx.fillStyle="rgba(196,19,61,.2)";this.ctx.fillRect(0,70,W,H-70);this.banner("HURRY, DARLING!",300,COLORS.crimson)}
  private drawPause(){this.ctx.fillStyle="rgba(5,5,9,.9)";this.ctx.fillRect(130,135,700,490);this.drawGothicBox(130,135,700,490,COLORS.pink);this.label("PAUSED",W/2,205,42,COLORS.shine,"center","Georgia");this.label("P / PAUSE — RESUME",W/2,270,15,COLORS.jade,"center");this.label("← →  MUSIC VOLUME  "+Math.round(this.settings.musicVolume*10),W/2,312,15,COLORS.blue,"center");this.label("HOLD JUMP + ← →  SFX VOLUME  "+Math.round(this.settings.sfxVolume*10),W/2,340,13,COLORS.blue,"center");this.label(`BUBBLE  SOUND ${this.settings.muted?"OFF":"ON"}`,W/2,378,15,COLORS.pink,"center");this.label(`JUMP (TAP)  REDUCED MOTION ${this.settings.reducedMotion?"ON":"OFF"}`,W/2,418,15,COLORS.pink,"center");this.label("START — RESTART CHAMBER",W/2,458,15,COLORS.crimson,"center");this.label("MOVE A/D OR ARROWS · JUMP SPACE/C · BUBBLE X/Z",W/2,533,12,COLORS.shine,"center");this.label("TOUCH CONTROLS SUPPORT MULTI-TOUCH",W/2,568,12,COLORS.jade,"center")}
  private drawStageClear(){
    const c=this.ctx,fragment=STORY_FRAGMENTS.find(item=>item.id===this.level.loreFragmentId),b=this.stageBreakdown;
    const elapsed=Math.max(0,this.level.time-Math.max(0,this.levelTime));
    c.fillStyle="rgba(5,5,9,.94)";c.fillRect(70,145,820,450);this.drawGothicBox(70,145,820,450,this.level.bonus?"#FFD36A":COLORS.jade);
    this.label(this.level.encore?"ENCORE RESULT":this.level.bonus?"VAULT SEALED":"CHAMBER CLEARED",W/2,190,29,COLORS.shine,"center","Georgia");
    this.label(this.newRecord?`★ NEW TIME ${elapsed.toFixed(1)}s`:`TIME ${elapsed.toFixed(1)}s · BEST ${(this.settings.bestStageTimes[this.level.bonus?"bonus":this.level.loreFragmentId]??elapsed).toFixed(1)}s`,W/2,219,11,this.newRecord?"#FFD36A":COLORS.blue,"center");
    const left:[string,string,string][]=[
      ["BASE SCORE",String(b.kills),COLORS.shine],["TRAPS",String(b.trapScore),COLORS.blue],["RELEASES",String(b.releaseScore),COLORS.pink],["PICKUPS",String(b.pickupScore),COLORS.jade],["FULL-ROOM CHAIN",b.fullRoomBonus?`+${b.fullRoomBonus}`:"—","#FFD36A"],
    ];
    const delta=b.total-this.previousBestScore;
    const right:[string,string,string][]=[
      ["LARGEST CHAIN",`×${this.bestChain}`,COLORS.pink],["TIME BONUS",`+${b.speedBonus}`,COLORS.blue],["SECRET",this.secretFound?"FOUND":"—",this.secretFound?COLORS.jade:"#59687a"],["DAMAGE",String(this.damageTaken),this.damageTaken?COLORS.crimson:COLORS.jade],["PERSONAL BEST",this.previousBestScore?`${delta>=0?"+":""}${delta}`:"FIRST CLEAR",delta>=0?"#FFD36A":"#8794A8"],
    ];
    left.forEach(([label,value,color],index)=>{const y=255+index*31;this.label(label,120,y,10,color);this.label(value,410,y,10,color,"right")});
    right.forEach(([label,value,color],index)=>{const y=255+index*31;this.label(label,510,y,10,color);this.label(value,840,y,10,color,"right")});
    c.strokeStyle="#33435c";c.beginPath();c.moveTo(110,420);c.lineTo(850,420);c.stroke();this.label("CHAMBER TOTAL",120,452,15,COLORS.shine);this.label(`+${b.total}`,840,452,15,COLORS.shine,"right");
    let y=486;
    if(this.level.encore&&this.level.encoreId){const medals=this.settings.encoreMedals[this.level.encoreId]??[];this.label(["clear","noDamage","targetScore","fullChain"].map(medal=>`${medals.includes(medal as EncoreMedal)?"✓":"□"} ${medal.replace(/[A-Z]/g,m=>` ${m}`).toUpperCase()}`).join("  "),W/2,y,8,COLORS.jade,"center");y+=28}
    if(this.secretFound&&fragment){this.label(`JADE DOOR · ${fragment.title.toUpperCase()}`,W/2,y,12,COLORS.jade,"center");y+=23;this.drawWrappedText(fragment.text,W/2,y,680,16,9,COLORS.shine,"center")}
    else if(this.secretFound)this.label(this.level.bonus?"THE VAULT YIELDS ITS GOLD":"CHALLENGE SECRET COMPLETE",W/2,y,12,"#FFD36A","center");
    else this.label(this.level.encore?"MEDALS SAVE AUTOMATICALLY":"THE DOOR REMAINS QUIET",W/2,y,10,"#59687a","center");
  }
  private drawDying(){this.ctx.fillStyle=`rgba(196,19,61,${.2+Math.sin(this.stateTime*18)*.1})`;this.ctx.fillRect(0,70,W,H-70);this.label("HEART BROKEN",W/2,360,38,COLORS.crimson,"center","Georgia")}
  private drawGameOver(){this.drawStars();this.drawGothicFrame(COLORS.crimson);this.label("GAME OVER",W/2,265,80,COLORS.crimson,"center","Georgia");this.drawHeart(W/2,370,45,"#16070d");this.label(`SCORE ${String(this.score).padStart(7,"0")}`,W/2,475,22,COLORS.shine,"center");if(this.newRecord)this.label("★ NEW CAMPAIGN BEST ★",W/2,505,14,"#FFD36A","center");else this.label(`CAMPAIGN BEST ${String(this.settings.highScore).padStart(7,"0")}`,W/2,505,12,COLORS.blue,"center");this.label("PRESS START — THE NIGHT REMEMBERS",W/2,560,16,COLORS.pink,"center")}
  private drawVictory(){this.drawStars();this.drawGothicFrame(this.cheats.super?COLORS.crimson:COLORS.jade);this.drawHero(310,300,this.hero,2.2,false,{pose:"jump"});this.drawHeartBubble(650,300,90);this.label(this.cheats.super?"VENOM EDITION CLEARED":"DAWN SURVIVED",W/2,495,45,this.cheats.super?COLORS.crimson:COLORS.jade,"center","Georgia");this.label(this.endingText,W/2,545,15,COLORS.shine,"center");this.label(`FINAL SCORE ${this.score}`,W/2,590,18,COLORS.pink,"center");if(this.newRecord)this.label("★ NEW CAMPAIGN BEST ★",W/2,615,14,"#FFD36A","center");this.label("PRESS START",W/2,650,15,COLORS.blue,"center")}
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
  private drawStars(){const c=this.ctx;c.save();const rm=this.settings.reducedMotion;for(let i=0;i<58;i++){const x=(i*173)%W,y=(i*97)%H,b=i%3===0?3:1;c.globalAlpha=rm?1:.45+.55*Math.abs(Math.sin(this.animTime*(1.2+(i%5)*.4)+i));c.fillStyle=i%7===0?COLORS.pink:i%5===0?COLORS.jade:COLORS.blue;c.fillRect(x,y,b,b)}c.restore()}
  private drawGothicFrame(color:string){const c=this.ctx;c.strokeStyle=color;c.lineWidth=4;c.strokeRect(14,14,W-28,H-28);c.strokeRect(24,24,W-48,H-48);for(const [x,y,sx,sy] of [[25,25,1,1],[W-25,25,-1,1],[25,H-25,1,-1],[W-25,H-25,-1,-1]]){c.beginPath();c.moveTo(x,y+45*sy);c.lineTo(x,y);c.lineTo(x+45*sx,y);c.stroke();c.strokeRect(x+9*sx-(sx<0?8:0),y+9*sy-(sy<0?8:0),8,8)}}
  private drawGothicBox(x:number,y:number,w:number,h:number,color:string){const c=this.ctx;c.strokeStyle=color;c.lineWidth=3;c.strokeRect(x,y,w,h);c.strokeRect(x+10,y+10,w-20,h-20)}
  private banner(text:string,y:number,color:string){const c=this.ctx;c.save();c.fillStyle="rgba(5,5,9,.88)";c.fillRect(90,y-55,780,88);c.strokeStyle=color;c.lineWidth=3;c.strokeRect(95,y-50,770,78);c.shadowBlur=18;c.shadowColor=color;this.label(text,W/2,y,32,color,"center","Georgia");c.restore()}
  // Scores, stage names, and story text are drawn ~28% larger than their authored
  // size so in-canvas writing reads clearly at arcade-cabinet viewing distance.
  private static readonly TEXT_SCALE=1.28;
  // Enemies render a little larger than their (unchanged) collision box so they
  // read clearly at the bigger cabinet size without touching hitboxes or levels.
  private static readonly ENEMY_SCALE=1.18;
  private drawWrappedText(text:string,x:number,y:number,maxWidth:number,lineHeight:number,size:number,color:string,align:CanvasTextAlign="left"){
    const c=this.ctx,readableSize=Math.max(size*BubbleHexEngine.TEXT_SCALE,17);c.font=`900 ${readableSize}px monospace`;const words=text.split(/\s+/);const lines:string[]=[];let line="";
    for(const word of words){const test=line?`${line} ${word}`:word;if(c.measureText(test).width>maxWidth&&line){lines.push(line);line=word}else line=test}if(line)lines.push(line);
    lines.slice(0,6).forEach((value,index)=>this.label(value,x,y+index*Math.max(lineHeight*BubbleHexEngine.TEXT_SCALE,readableSize+5),readableSize/BubbleHexEngine.TEXT_SCALE,color,align));
  }
  private label(text:string,x:number,y:number,size:number,color:string,align:CanvasTextAlign="left",family="monospace"){
    const c=this.ctx,readableSize=Math.max(size*BubbleHexEngine.TEXT_SCALE,17);c.save();c.textAlign=align;c.textBaseline="alphabetic";c.font=`900 ${readableSize}px ${family}, monospace`;c.lineJoin="round";
    c.strokeStyle="rgba(2,3,10,.94)";c.lineWidth=Math.max(2,Math.min(5,readableSize*.16));c.strokeText(text,x,y);c.fillStyle=color;c.fillText(text,x,y);c.restore();
  }
}
