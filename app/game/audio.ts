import { VOICE_LINES, type VoiceCategory } from "./voice-lines.ts";

export type MusicTrackId = "title" | "stage" | "bonus" | "boss" | "victory"
  | "worldHeartbreakHotel" | "worldJadeGarden" | "worldCrimsonChapel" | "naraBubble";

type MusicSource = { ogg: string; mp3: string; loop: boolean };

export const MUSIC_TRACKS: Record<MusicTrackId, MusicSource> = {
  title: { ogg: "/game/audio/title-jingle.ogg", mp3: "/game/audio/title-jingle.mp3", loop: true },
  stage: { ogg: "/game/audio/stage-theme.ogg", mp3: "/game/audio/stage-theme.mp3", loop: true },
  bonus: { ogg: "/game/audio/bonus-theme.ogg", mp3: "/game/audio/bonus-theme.mp3", loop: true },
  boss: { ogg: "/game/audio/boss-theme.ogg", mp3: "/game/audio/boss-theme.mp3", loop: true },
  victory: { ogg: "/game/audio/victory-fanfare.ogg", mp3: "/game/audio/victory-fanfare.mp3", loop: false },
  // Per-world stage variety (chambers 4-10) — Velvet Drain keeps the original "stage" loop.
  worldHeartbreakHotel: { ogg: "/game/audio/world-heartbreak-hotel.ogg", mp3: "/game/audio/world-heartbreak-hotel.mp3", loop: true },
  worldJadeGarden: { ogg: "/game/audio/world-jade-garden.ogg", mp3: "/game/audio/world-jade-garden.mp3", loop: true },
  worldCrimsonChapel: { ogg: "/game/audio/world-crimson-chapel.ogg", mp3: "/game/audio/world-crimson-chapel.mp3", loop: true },
  // Hidden Easter egg track — see the "nara" cheat code.
  naraBubble: { ogg: "/game/audio/nara-bubble.ogg", mp3: "/game/audio/nara-bubble.mp3", loop: false },
};

/** Pure so it can be unit tested without a real <audio> element. */
export function pickMusicUrl(source: MusicSource, canPlayOgg: boolean): string {
  return canPlayOgg ? source.ogg : source.mp3;
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const LOOP_CROSSFADE = 0.35;
const MAX_SFX_VOICES = 14;
const safePositive = (n: number, fallback: number) => (Number.isFinite(n) && n > 0 ? n : fallback);

/**
 * Web Audio throws synchronously on non-finite automation values or on
 * scheduling calls against a node whose context raced closed. A single
 * glitched SFX/music cue must never crash the render loop, so scheduling
 * always goes through here rather than calling AudioParam methods directly.
 */
function safeParam(run: () => void) {
  try { run(); } catch { /* audio scheduling is best-effort and non-critical */ }
}

/**
 * Single audio engine for BUBBLE HEX: a decoded-buffer music bus with
 * crossfading/looping, and a procedural oscillator SFX bus, sharing one
 * AudioContext, one compressor, and persisted volume/mute state.
 */
export class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;

  private buffers = new Map<MusicTrackId, AudioBuffer>();
  private loadState = new Map<MusicTrackId, "loading" | "ready" | "failed">();
  private currentTrack: MusicTrackId | null = null;
  private currentGain: GainNode | null = null;
  private currentSources: AudioBufferSourceNode[] = [];
  private pendingTimers: ReturnType<typeof setTimeout>[] = [];
  private wasPlayingBeforeHidden = false;
  private sfxVoices = 0;

  private voiceBuffers = new Map<string, AudioBuffer>();
  private voiceLoadState = new Map<string, "loading" | "ready" | "failed">();
  private voiceLastIndex = new Map<VoiceCategory, number>();
  private voiceBusyUntil = 0;

  muted = false;
  musicVolume = 0.5;
  sfxVolume = 0.6;

  constructor() {
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", this.onVisibility);
    }
  }

  private onVisibility = () => {
    if (!this.ctx) return;
    if (document.hidden) {
      this.wasPlayingBeforeHidden = this.ctx.state === "running";
      void this.ctx.suspend();
    } else if (this.wasPlayingBeforeHidden) {
      void this.ctx.resume();
    }
  };

  /** Must be called from a real user gesture handler (browser audio policy). */
  unlock() {
    if (!this.ctx) this.setupGraph();
    if (this.ctx && this.ctx.state !== "running") void this.ctx.resume();
  }

  private setupGraph() {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.musicBus = ctx.createGain();
    this.sfxBus = ctx.createGain();
    this.compressor = ctx.createDynamicsCompressor();
    this.compressor.threshold.value = -18;
    this.compressor.knee.value = 18;
    this.compressor.ratio.value = 6;
    this.compressor.attack.value = 0.003;
    this.compressor.release.value = 0.25;
    this.musicBus.connect(this.master);
    this.sfxBus.connect(this.master);
    this.master.connect(this.compressor);
    this.compressor.connect(ctx.destination);
    this.applyVolumes();
  }

  private applyVolumes() {
    if (!this.ctx || !this.musicBus || !this.sfxBus) return;
    const t = this.ctx.currentTime;
    const m = this.muted ? 0 : this.musicVolume;
    const s = this.muted ? 0 : this.sfxVolume;
    safeParam(() => { this.musicBus!.gain.cancelScheduledValues(t); this.musicBus!.gain.linearRampToValueAtTime(m, t + 0.08); });
    safeParam(() => { this.sfxBus!.gain.cancelScheduledValues(t); this.sfxBus!.gain.linearRampToValueAtTime(s, t + 0.08); });
  }

  setMuted(v: boolean) { this.muted = v; this.applyVolumes(); }
  setMusicVolume(v: number) { this.musicVolume = clamp01(v); this.applyVolumes(); }
  setSfxVolume(v: number) { this.sfxVolume = clamp01(v); this.applyVolumes(); }

  get playingTrack() { return this.currentTrack; }

  preload(id: MusicTrackId) { void this.loadTrack(id); }

  private canPlayOgg(): boolean {
    if (typeof document === "undefined") return false;
    const probe = document.createElement("audio");
    return probe.canPlayType('audio/ogg; codecs="vorbis"') !== "";
  }

  private async loadTrack(id: MusicTrackId): Promise<AudioBuffer | null> {
    const cached = this.buffers.get(id);
    if (cached) return cached;
    if (this.loadState.get(id) === "failed" || !this.ctx) return null;
    this.loadState.set(id, "loading");
    try {
      const url = pickMusicUrl(MUSIC_TRACKS[id], this.canPlayOgg());
      const response = await fetch(url);
      if (!response.ok) throw new Error(`audio ${id} http ${response.status}`);
      const bytes = await response.arrayBuffer();
      const buffer = await this.ctx.decodeAudioData(bytes);
      this.buffers.set(id, buffer);
      this.loadState.set(id, "ready");
      return buffer;
    } catch {
      this.loadState.set(id, "failed");
      return null;
    }
  }

  /** No-ops if `id` is already playing, so pause/resume never restarts a track. */
  async playMusic(id: MusicTrackId, crossfade = 1.1) {
    crossfade = safePositive(crossfade, 1.1);
    if (!this.ctx || !this.musicBus) return;
    if (this.currentTrack === id) return;
    this.currentTrack = id;
    const buffer = await this.loadTrack(id);
    if (!this.ctx || !this.musicBus || this.currentTrack !== id) return;

    const outgoingGain = this.currentGain;
    const outgoingSources = this.currentSources;
    if (!buffer) { this.currentGain = null; this.currentSources = []; this.fadeOutAndStop(outgoingGain, outgoingSources, crossfade); return; }

    const gainNode = this.ctx.createGain();
    safeParam(() => gainNode.gain.setValueAtTime(0, this.ctx!.currentTime));
    gainNode.connect(this.musicBus);
    this.currentGain = gainNode;
    this.currentSources = [];
    this.startLoop(id, buffer, gainNode);
    safeParam(() => gainNode.gain.linearRampToValueAtTime(1, this.ctx!.currentTime + crossfade));
    this.fadeOutAndStop(outgoingGain, outgoingSources, crossfade);
  }

  stopMusic(fade = 0.5) {
    this.fadeOutAndStop(this.currentGain, this.currentSources, fade);
    this.currentTrack = null;
    this.currentGain = null;
    this.currentSources = [];
  }

  private fadeOutAndStop(gain: GainNode | null, sources: AudioBufferSourceNode[], time: number) {
    time = safePositive(time, 0.5);
    if (!gain || !this.ctx) return;
    const t = this.ctx.currentTime;
    safeParam(() => {
      gain.gain.cancelScheduledValues(t);
      gain.gain.setValueAtTime(gain.gain.value, t);
      gain.gain.linearRampToValueAtTime(0, t + time);
    });
    const timer = setTimeout(() => sources.forEach(s => { try { s.stop(); } catch { /* already stopped */ } }), (time + 0.15) * 1000);
    this.pendingTimers.push(timer);
  }

  private startLoop(id: MusicTrackId, buffer: AudioBuffer, gainNode: GainNode) {
    const ctx = this.ctx;
    if (!ctx) return;
    const loop = MUSIC_TRACKS[id].loop;
    const crossfade = Math.min(LOOP_CROSSFADE, buffer.duration * 0.15);

    const scheduleAt = (startAt: number) => {
      if (this.currentGain !== gainNode || !this.ctx) return;
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(gainNode);
      safeParam(() => source.start(startAt));
      this.currentSources.push(source);
      this.currentSources = this.currentSources.slice(-3);
      if (!loop) return;
      const nextStart = startAt + buffer.duration - crossfade;
      const delayMs = Math.max(0, (nextStart - ctx.currentTime - 0.2) * 1000);
      const timer = setTimeout(() => scheduleAt(nextStart), delayMs);
      this.pendingTimers.push(timer);
    };
    scheduleAt(ctx.currentTime + 0.02);
  }

  private async loadVoiceBuffer(url: string): Promise<AudioBuffer | null> {
    const cached = this.voiceBuffers.get(url);
    if (cached) return cached;
    if (this.voiceLoadState.get(url) === "failed" || !this.ctx) return null;
    this.voiceLoadState.set(url, "loading");
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`voice ${url} http ${response.status}`);
      const bytes = await response.arrayBuffer();
      const buffer = await this.ctx.decodeAudioData(bytes);
      this.voiceBuffers.set(url, buffer);
      this.voiceLoadState.set(url, "ready");
      return buffer;
    } catch {
      this.voiceLoadState.set(url, "failed");
      return null;
    }
  }

  /**
   * Spoken voice-line bus: picks a random line from `category` (never repeating
   * the immediately previous pick within that category), routes it through the
   * shared SFX bus so it obeys mute/volume like every other sound, and imposes
   * a global cooldown so barks never overlap or talk over each other.
   */
  async playVoice(category: VoiceCategory) {
    if (this.muted || !this.ctx || !this.sfxBus) return;
    const lines = VOICE_LINES[category];
    if (!lines || lines.length === 0) return;
    const t = this.ctx.currentTime;
    if (t < this.voiceBusyUntil) return;
    const last = this.voiceLastIndex.get(category) ?? -1;
    const index = lines.length === 1 ? 0 : (last + 1 + Math.floor(Math.random() * (lines.length - 1))) % lines.length;
    this.voiceLastIndex.set(category, index);
    const line = lines[index];
    this.voiceBusyUntil = t + 0.35;
    const buffer = await this.loadVoiceBuffer(line.url);
    if (!buffer || !this.ctx || !this.sfxBus) return;
    const now = this.ctx.currentTime;
    const source = this.ctx.createBufferSource();
    const gain = this.ctx.createGain();
    source.buffer = buffer;
    safeParam(() => gain.gain.setValueAtTime(0.9, now));
    source.connect(gain).connect(this.sfxBus);
    safeParam(() => source.start(now));
    this.voiceBusyUntil = now + buffer.duration + 0.3;
  }

  /** Procedural SFX layer — cheap, dependency-free, rate-limited so bubble chains never clip. */
  tone(freq: number, duration = 0.08, type: OscillatorType = "square", slide = 0, gain = 0.12) {
    if (this.muted || !this.ctx || !this.sfxBus) return;
    if (!Number.isFinite(freq) || !Number.isFinite(slide)) return;
    duration = safePositive(duration, 0.08);
    if (this.sfxVoices >= MAX_SFX_VOICES) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    safeParam(() => {
      osc.frequency.setValueAtTime(freq, t);
      osc.frequency.linearRampToValueAtTime(Math.max(30, freq + slide), t + duration);
      g.gain.setValueAtTime(gain, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    });
    osc.connect(g).connect(this.sfxBus);
    this.sfxVoices++;
    osc.onended = () => { this.sfxVoices = Math.max(0, this.sfxVoices - 1); };
    safeParam(() => { osc.start(t); osc.stop(t + duration); });
  }

  bubble() { this.tone(520, 0.09, "sine", 180, 0.1); }
  trap() { this.tone(310, 0.14, "triangle", 260, 0.13); }
  pop(chain = 1) { this.tone(170 + chain * 55, 0.08, "square", 260, 0.13); }
  jump() { this.tone(210, 0.08, "square", 120, 0.08); }
  hurt() { this.tone(170, 0.28, "sawtooth", -120, 0.14); }
  reward() { this.tone(700, 0.12, "triangle", 320, 0.1); }
  secret() { [420, 620, 840].forEach((n, i) => setTimeout(() => this.tone(n, 0.12, "sine", 90, 0.1), i * 70)); }
  hurry() { this.tone(105, 0.5, "sawtooth", -20, 0.16); }
  bossHit() { [880, 660].forEach((n, i) => setTimeout(() => this.tone(n, 0.1, "square", -160, 0.15), i * 60)); }
  bossStagger() { this.tone(140, 0.4, "sawtooth", 260, 0.15); }
  recordSting() { [520, 780, 1040].forEach((n, i) => setTimeout(() => this.tone(n, 0.14, "triangle", 60, 0.11), i * 60)); }

  destroy() {
    if (typeof document !== "undefined") document.removeEventListener("visibilitychange", this.onVisibility);
    this.pendingTimers.forEach(clearTimeout);
    this.pendingTimers = [];
  }
}
