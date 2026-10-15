/**
 * Web Audio synth for the live-session experience.
 *
 * Ported from the MIT-licensed `quizz` project
 * (https://github.com/Lawndlwd/quizz) and adapted for TXDXSAT: the per-theme
 * "flavors" were removed (TXDXSAT ships a single visual identity) but the
 * synthesis recipes — chimes, buzzer, drumroll, fanfare — are unchanged. Fase 3
 * adds procedural background music (lobby / question) and a volume control.
 *
 * Everything is generated at runtime; no audio assets are bundled, which keeps
 * the 2 vCPU / 4 GB target box small and avoids any licensing question.
 */

export type SoundName =
  | "tick"
  | "blip"
  | "correct"
  | "wrong"
  | "drumroll"
  | "fanfare"
  | "heartbeat"
  | "submit"
  | "join";

export type MusicKind = "lobby" | "question";

const MUTE_KEY = "txdxsat:live:muted";
const VOLUME_KEY = "txdxsat:live:volume";
const BASE_GAIN = 0.22;

class SoundManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private muted = false;
  private volume = 0.85;
  private loops = new Map<SoundName, AudioBufferSourceNode>();
  private musicSrc: AudioBufferSourceNode | null = null;
  // private musicGain: GainNode | null = null; // removed to reduce type noise if unused
  private musicKind: MusicKind | null = null;
  private pendingMusic: MusicKind | null = null;
  private resumeBound = false;

  constructor() {
    if (typeof window !== "undefined") {
      this.muted = localStorage.getItem(MUTE_KEY) === "1";
      const stored = Number(localStorage.getItem(VOLUME_KEY));
      if (Number.isFinite(stored) && stored > 0) this.volume = Math.min(1, Math.max(0.05, stored));
    }
  }

  private ensureCtx(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = BASE_GAIN * this.volume;
      this.master.connect(this.ctx.destination);
      // Autoplay policy: resume on the first user gesture, once. Any music that
      // was requested before the gesture is started here.
      if (!this.resumeBound) {
        this.resumeBound = true;
        const resume = () => {
          void this.ctx?.resume();
          if (this.pendingMusic) {
            const kind = this.pendingMusic;
            this.pendingMusic = null;
            this.startMusic(kind);
          }
        };
        window.addEventListener("pointerdown", resume, { once: true });
        window.addEventListener("keydown", resume, { once: true });
      }
    }
    return this.ctx;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (typeof window !== "undefined") {
      if (muted) localStorage.setItem(MUTE_KEY, "1");
      else localStorage.removeItem(MUTE_KEY);
    }
    if (muted) {
      this.stop();
      this.stopMusic();
    }
  }

  isMuted(): boolean {
    return this.muted;
  }

  /** Master volume 0.05..1 (applies to effects and music). */
  setVolume(volume: number): void {
    this.volume = Math.min(1, Math.max(0.05, volume));
    if (typeof window !== "undefined") localStorage.setItem(VOLUME_KEY, String(this.volume));
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(BASE_GAIN * this.volume, this.ctx.currentTime, 0.05);
    }
  }

  getVolume(): number {
    return this.volume;
  }

  play(name: SoundName): void {
    if (this.muted) return;
    const ctx = this.ensureCtx();
    if (!ctx || !this.master) return;
    void ctx.resume();
    if (ctx.state === "suspended") return; // drop, don't queue

    switch (name) {
      case "tick":
        this.blip(1100, 0.04, "square", 0.5);
        break;
      case "blip":
        this.sweep(660, 880, 0.09, "triangle");
        break;
      case "submit":
        this.sweep(520, 1040, 0.14, "sine");
        break;
      case "join":
        this.blip(880, 0.07, "triangle", 0.7);
        this.blip(1320, 0.09, "sine", 0.4);
        break;
      case "correct":
        this.correctChime();
        break;
      case "wrong":
        this.wrongBuzzer();
        break;
      case "heartbeat":
        this.heartbeat();
        break;
      case "drumroll":
        this.drumroll();
        break;
      case "fanfare":
        this.fanfare();
        break;
    }
  }

  stop(name?: SoundName): void {
    if (name) {
      const node = this.loops.get(name);
      if (node) {
        try {
          node.stop();
        } catch {
          /* already stopped */
        }
        this.loops.delete(name);
      }
      return;
    }
    for (const node of this.loops.values()) {
      try {
        node.stop();
      } catch {
        /* already stopped */
      }
    }
    this.loops.clear();
  }

  // --- Background music ----------------------------------------------------

  /** Start (and loop) procedural background music. Safe before first gesture. */
  startMusic(kind: MusicKind): void {
    if (this.muted) return;
    const ctx = this.ensureCtx();
    if (!ctx || !this.master) return;
    void ctx.resume();
    if (ctx.state === "suspended") {
      // Browser will not allow audio yet: remember and start on first gesture.
      this.pendingMusic = kind;
      return;
    }
    if (this.musicKind === kind && this.musicSrc) return;

    this.stopMusic();
    const buffer = this.buildMusic(kind);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(kind === "lobby" ? 0.6 : 0.5, ctx.currentTime + 1.2);
    src.connect(gain).connect(this.master);
    src.start();

    this.musicSrc = src;
    this.musicKind = kind;
  }

  stopMusic(): void {
    this.pendingMusic = null;
    if (this.musicSrc) {
      try {
        this.musicSrc.stop();
      } catch {
        /* already stopped */
      }
    }
    this.musicSrc = null;
    this.musicKind = null;
  }

  currentMusic(): MusicKind | null {
    return this.musicKind;
  }

  /**
   * Render a looping bed of notes into an AudioBuffer. Cheaper and more flexible
   * than bundling audio files, and it respects the "no Kahoot audio" rule.
   */
  private buildMusic(kind: MusicKind): AudioBuffer {
    const ctx = this.ctx as AudioContext;
    const sampleRate = ctx.sampleRate;
    const seconds = kind === "lobby" ? 6 : 4;
    const length = Math.floor(sampleRate * seconds);
    const buffer = ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);

    // Note tables (Hz). Lobby = warm major arpeggio; question = tense minor pulse.
    const melody =
      kind === "lobby"
        ? [261.63, 329.63, 392.0, 523.25, 392.0, 329.63]
        : [220.0, 261.63, 293.66, 261.63];
    const bass = kind === "lobby" ? [130.81, 196.0] : [110.0, 110.0];
    const noteDur = seconds / (melody.length * (kind === "lobby" ? 2 : 2));
    const bassDur = seconds / bass.length;

    for (let i = 0; i < length; i += 1) {
      const t = i / sampleRate;
      const noteIndex = Math.floor(t / noteDur) % melody.length;
      const noteT = (t % noteDur) / noteDur;
      const freq = melody[noteIndex] ?? 261.63;
      // Soft attack, smooth decay inside each note.
      const env = Math.min(1, noteT / 0.08) * Math.max(0, 1 - noteT) ** 1.4;
      const lead = Math.sin(2 * Math.PI * freq * t) * 0.22 * env;
      const shimmer = Math.sin(2 * Math.PI * freq * 2 * t) * 0.05 * env;

      const bassIndex = Math.floor(t / bassDur) % bass.length;
      const bassT = (t % bassDur) / bassDur;
      const bassEnv = Math.min(1, bassT / 0.15) * Math.max(0, 1 - bassT) ** 2;
      const low = Math.sin(2 * Math.PI * (bass[bassIndex] ?? 110) * t) * 0.16 * bassEnv;

      data[i] = lead + shimmer + low;
    }
    return buffer;
  }

  // --- Synth primitives ----------------------------------------------------

  private tone(freq: number, dur: number, osc: OscillatorType, startAt: number, gain = 1): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = osc;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0, startAt);
    g.gain.linearRampToValueAtTime(gain, startAt + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, startAt + dur);
    o.connect(g).connect(master);
    o.start(startAt);
    o.stop(startAt + dur + 0.02);
  }

  private blip(freq: number, dur: number, osc: OscillatorType, gain = 1): void {
    if (!this.ctx) return;
    this.tone(freq, dur, osc, this.ctx.currentTime, gain);
  }

  private sweep(from: number, to: number, dur: number, osc: OscillatorType): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = osc;
    const t = ctx.currentTime;
    o.frequency.setValueAtTime(from, t);
    o.frequency.linearRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.8, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private pad(freq: number, dur: number, startAt: number, gain: number): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = freq;
    g.gain.setValueAtTime(0, startAt);
    g.gain.linearRampToValueAtTime(gain, startAt + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, startAt + dur);
    o.connect(g).connect(master);
    o.start(startAt);
    o.stop(startAt + dur + 0.02);
  }

  /** Bright rising 3-note chime with a shimmer layer — "you got it". */
  private correctChime(): void {
    if (!this.ctx) return;
    const base = this.ctx.currentTime;
    const notes = [523.25, 659.25, 987.77]; // C5 · E5 · B5
    notes.forEach((f, i) => {
      const at = base + i * 0.1;
      this.tone(f, 0.3, "triangle", at, 0.6);
      this.tone(f * 2, 0.22, "sine", at, 0.18);
    });
    this.pad(523.25, 0.55, base, 0.22);
    this.pad(659.25, 0.55, base, 0.18);
  }

  /** Game-show "wrong" buzzer: detuned low sawtooths in two blasts. */
  private wrongBuzzer(): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 900;
    lp.connect(master);

    const blast = (startAt: number, dur: number) => {
      for (const detune of [0, 18, -18]) {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = "sawtooth";
        o.frequency.value = 150;
        o.detune.value = detune;
        g.gain.setValueAtTime(0, startAt);
        g.gain.linearRampToValueAtTime(0.5, startAt + 0.02);
        g.gain.setValueAtTime(0.5, startAt + dur - 0.05);
        g.gain.exponentialRampToValueAtTime(0.0001, startAt + dur);
        o.connect(g).connect(lp);
        o.start(startAt);
        o.stop(startAt + dur + 0.02);
      }
    };
    const t = ctx.currentTime;
    blast(t, 0.22);
    blast(t + 0.28, 0.34);
  }

  private heartbeat(): void {
    if (!this.ctx) return;
    const base = this.ctx.currentTime;
    this.tone(55, 0.09, "sine", base, 1);
    this.tone(55, 0.09, "sine", base + 0.18, 0.8);
  }

  private fanfare(): void {
    if (!this.ctx) return;
    const base = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) => {
      this.tone(f, 0.16, "triangle", base + i * 0.12, 0.8);
    });
    this.noiseBurst(base + notes.length * 0.12, 0.4, 4000);
  }

  private noiseBurst(startAt: number, dur: number, hp: number): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;
    const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.sin(i * 12.9898) * 43758.5453) % 1;
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = hp;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.5, startAt);
    g.gain.exponentialRampToValueAtTime(0.0001, startAt + dur);
    src.connect(filter).connect(g).connect(master);
    src.start(startAt);
    src.stop(startAt + dur + 0.02);
  }

  private drumroll(): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;
    this.stop("drumroll");
    const dur = 1;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    const hitEvery = Math.floor(ctx.sampleRate / 24);
    for (let i = 0; i < data.length; i++) {
      const pos = i % hitEvery;
      const env = Math.max(0, 1 - pos / (hitEvery * 0.5));
      const noise = ((Math.sin(i * 12.9898) * 43758.5453) % 1) * 2 - 1;
      data[i] = noise * env * 0.5;
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 2000;
    src.connect(filter).connect(master);
    src.start();
    this.loops.set("drumroll", src);
  }
}

export const sound = new SoundManager();
