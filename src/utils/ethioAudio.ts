import { QenetMode } from '../types/ethiohub';

// Authentic Ethiopian Qenet pentatonic frequency intervals (Hz rooted near D4 / C4)
const QENET_SCALES: Record<QenetMode, number[]> = {
  // Tizita Major (1, 2, 3, 5, 6): warm, nostalgic, iconic Addis Ethio-Jazz
  tizita: [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33],
  // Bati Minor (1, b3, 4, 5, b7): soulful, contemplative northern highland mood
  bati: [220.0, 261.63, 293.66, 329.63, 392.0, 440.0, 523.25],
  // Ambassel (1, b2, 4, 5, b6): ancient, meditative Lalibela / sacred heritage
  ambassel: [246.94, 261.63, 329.63, 369.99, 392.0, 493.88, 523.25],
  // Anchihoye (1, b2, 4, b5, 6): lively, rhythmic Gondar / dance cadence
  anchihoye: [261.63, 277.18, 349.23, 369.99, 440.0, 523.25, 554.37],
};

// Melodic step patterns inspired by Krar lyre arpeggios and Washint flute phrasing
const PATTERNS: Record<QenetMode, number[]> = {
  tizita: [0, 2, 4, 3, 2, 4, 5, 4, 2, 1, 0, 3, 4, 2, 1, 0],
  bati: [0, 1, 3, 4, 3, 2, 1, 0, 4, 5, 4, 3, 1, 2, 0, 0],
  ambassel: [0, 2, 3, 4, 3, 2, 1, 0, 2, 4, 5, 4, 3, 1, 0, 0],
  anchihoye: [0, 2, 3, 4, 2, 4, 5, 3, 4, 2, 1, 0, 3, 4, 2, 0],
};

export class EthioSoundscapeEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private intervalId: number | null = null;
  private step = 0;
  private isPlaying = false;
  private volume = 0.45;
  private muted = false;
  private mode: QenetMode = 'tizita';
  private playbackRate = 1;

  private ensureContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return false;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.muted ? 0 : this.volume * 0.22;
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return true;
  }

  public configure(mode: QenetMode, volume: number, muted: boolean, playbackRate: number) {
    const rateChanged = this.playbackRate !== playbackRate;
    this.mode = mode;
    this.volume = volume;
    this.muted = muted;
    this.playbackRate = playbackRate;

    if (this.masterGain && this.ctx) {
      const target = this.muted ? 0 : this.volume * 0.22;
      this.masterGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.08);
    }

    if (this.isPlaying && rateChanged) {
      this.restartLoop();
    }
  }

  public start(mode: QenetMode, volume: number, muted: boolean, playbackRate: number) {
    this.mode = mode;
    this.volume = volume;
    this.muted = muted;
    this.playbackRate = playbackRate;
    if (!this.ensureContext()) return;
    if (this.isPlaying) return;
    this.isPlaying = true;
    this.playStep();
    this.restartLoop();
  }

  private restartLoop() {
    if (this.intervalId !== null) {
      window.clearInterval(this.intervalId);
    }
    const baseMs = this.mode === 'anchihoye' ? 420 : this.mode === 'ambassel' ? 680 : 540;
    const stepMs = Math.max(180, Math.round(baseMs / this.playbackRate));
    this.intervalId = window.setInterval(() => {
      if (this.isPlaying) {
        this.playStep();
      }
    }, stepMs);
  }

  private playStep() {
    if (!this.ctx || !this.masterGain || this.muted || this.volume <= 0) return;

    const now = this.ctx.currentTime;
    const scale = QENET_SCALES[this.mode];
    const pattern = PATTERNS[this.mode];
    const idx = pattern[this.step % pattern.length];
    const freq = scale[idx % scale.length];

    // 1. Krar plucked string voice (warm triangle + gentle filter envelope)
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1400, now);
    filter.frequency.exponentialRampToValueAtTime(340, now + 0.55);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.45, now + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.72);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.75);

    // 2. Soft low Kebero drum pulse / drone on every 4th beat
    if (this.step % 4 === 0) {
      const bassOsc = this.ctx.createOscillator();
      const bassGain = this.ctx.createGain();
      bassOsc.type = 'sine';
      bassOsc.frequency.setValueAtTime(scale[0] / 2, now);
      bassOsc.frequency.exponentialRampToValueAtTime(scale[0] / 2.2, now + 0.35);

      bassGain.gain.setValueAtTime(0.001, now);
      bassGain.gain.linearRampToValueAtTime(0.32, now + 0.02);
      bassGain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

      bassOsc.connect(bassGain);
      bassGain.connect(this.masterGain);
      bassOsc.start(now);
      bassOsc.stop(now + 0.52);
    }

    // 3. Occasional breathy Washint flute overtone on phrase start
    if (this.step % 8 === 0) {
      const flute = this.ctx.createOscillator();
      const fluteGain = this.ctx.createGain();
      flute.type = 'sine';
      flute.frequency.setValueAtTime(scale[(idx + 2) % scale.length] * 2, now);

      fluteGain.gain.setValueAtTime(0.0001, now);
      fluteGain.gain.linearRampToValueAtTime(0.11, now + 0.22);
      fluteGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.15);

      flute.connect(fluteGain);
      fluteGain.connect(this.masterGain);
      flute.start(now);
      flute.stop(now + 1.2);
    }

    this.step += 1;
  }

  public stop() {
    this.isPlaying = false;
    if (this.intervalId !== null) {
      window.clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  public dispose() {
    this.stop();
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
      this.masterGain = null;
    }
  }
}
