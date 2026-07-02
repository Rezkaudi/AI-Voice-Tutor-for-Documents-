const BASE_GAIN = 0.9;
const FADE_SECONDS = 0.06;
const PHRASE_SECONDS = 3.32;
const START_OFFSET_SECONDS = 0.08;
const SCHEDULE_INTERVAL_MS = 1000;
const LOOKAHEAD_SECONDS = 3.7;
const BODY_RELEASE_SECONDS = 0.085;
const CLICK_RELEASE_SECONDS = 0.026;
const NOISE_RELEASE_SECONDS = 0.045;

const POP_PATTERN = [
  { at: 0, freq: 975, velocity: 0.22 },
  { at: 0.258, freq: 1375, velocity: 0.74 },
  { at: 0.375, freq: 1375, velocity: 1 },
  { at: 0.503, freq: 2000, velocity: 0.5 }
] as const;

type AudioContextCtor = typeof AudioContext;

function resolveAudioContext(): AudioContextCtor | null {
  if (typeof window === "undefined") return null;
  return (
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext ??
    null
  );
}

class ThinkingSound {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private popBus: AudioNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private loopTimer: number | null = null;
  private nextPhraseAt: number | null = null;
  private nodes: AudioScheduledSourceNode[] = [];
  private active = false;
  private enabled = true;
  private startToken = 0;

  setEnabled(value: boolean): void {
    this.enabled = value;
    if (!value) this.stop();
  }


  unlock(): void {
    if (!this.enabled) return;
    const ctx = this.ensureContext();
    if (ctx && ctx.state !== "running") void ctx.resume().catch(() => { });
  }

  private ensureContext(): AudioContext | null {
    // A closed context can never resume — drop it so a fresh one is built.
    if (this.ctx && this.ctx.state === "closed") {
      this.ctx = null;
      this.noiseBuffer = null;
    }
    if (!this.ctx) {
      const Ctor = resolveAudioContext();
      if (!Ctor) return null;
      this.ctx = new Ctor();
    }
    return this.ctx;
  }

  start(): void {
    if (!this.enabled || this.active) return;

    const ctx = this.ensureContext();
    if (!ctx) return;

    this.active = true;
    const token = ++this.startToken;

    if (ctx.state === "running") {
      this.beginPlayback(token);
    } else {
      ctx.resume()
        .then(() => this.beginPlayback(token))
        .catch(() => {
          // Could not resume (no active gesture yet). Release the guard so a
          // later start() — or an unlock() from the next tap — can retry.
          if (token === this.startToken) this.active = false;
        });
    }
  }

  private beginPlayback(token: number): void {
    // Bail if stop()/a newer start() superseded this attempt while resuming.
    if (!this.active || token !== this.startToken || !this.ctx) return;
    const ctx = this.ctx;

    const now = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, now);
    master.gain.exponentialRampToValueAtTime(BASE_GAIN, now + FADE_SECONDS);
    master.connect(ctx.destination);

    const dry = ctx.createGain();
    dry.gain.setValueAtTime(0.94, now);
    dry.connect(master);

    const delay = ctx.createDelay(0.5);
    delay.delayTime.setValueAtTime(0.12, now);
    const echo = ctx.createGain();
    echo.gain.setValueAtTime(0.34, now);
    const feedback = ctx.createGain();
    feedback.gain.setValueAtTime(0.28, now);
    delay.connect(echo);
    delay.connect(feedback);
    echo.connect(master);
    feedback.connect(delay);

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(4200, now);
    filter.Q.setValueAtTime(0.35, now);
    filter.connect(dry);
    filter.connect(delay);

    this.popBus = filter;
    this.master = master;

    const firstPhraseAt = now + START_OFFSET_SECONDS;
    this.schedulePhrase(firstPhraseAt);
    this.nextPhraseAt = firstPhraseAt + PHRASE_SECONDS;
    this.loopTimer = window.setInterval(() => this.scheduleUpcomingPhrases(), SCHEDULE_INTERVAL_MS);
  }

  stop(): void {
    // Invalidate any in-flight resume() so a pending beginPlayback() bails.
    this.startToken += 1;
    if (!this.active || !this.ctx || !this.master) {
      this.active = false;
      return;
    }
    const ctx = this.ctx;
    const master = this.master;
    const nodes = this.nodes;
    this.active = false;
    this.master = null;
    this.popBus = null;
    this.nodes = [];
    this.nextPhraseAt = null;

    if (this.loopTimer !== null) {
      window.clearInterval(this.loopTimer);
      this.loopTimer = null;
    }

    const stopAt = ctx.currentTime + FADE_SECONDS;
    try {
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setValueAtTime(Math.max(master.gain.value, 0.0001), ctx.currentTime);
      master.gain.exponentialRampToValueAtTime(0.0001, stopAt);
    } catch {
      // ignore scheduling errors
    }
    for (const node of nodes) {
      try {
        node.stop(stopAt);
      } catch {
        // already stopped
      }
    }
    window.setTimeout(() => {
      try {
        master.disconnect();
      } catch {
        // already disconnected
      }
    }, FADE_SECONDS * 1000 + 60);
  }

  private scheduleUpcomingPhrases(): void {
    if (!this.active || !this.ctx || this.nextPhraseAt === null) return;

    const scheduleUntil = this.ctx.currentTime + LOOKAHEAD_SECONDS;
    while (this.nextPhraseAt < scheduleUntil) {
      this.schedulePhrase(this.nextPhraseAt);
      this.nextPhraseAt += PHRASE_SECONDS;
    }
  }

  private schedulePhrase(phraseStart: number): void {
    if (!this.ctx || !this.popBus) return;

    for (const pop of POP_PATTERN) {
      this.schedulePop(phraseStart + pop.at, pop.freq, pop.velocity);
    }
  }

  private schedulePop(startAt: number, frequency: number, velocity: number): void {
    if (!this.ctx || !this.popBus) return;

    const ctx = this.ctx;

    const body = ctx.createOscillator();
    body.type = "sine";
    body.frequency.setValueAtTime(frequency * 1.32, startAt);
    body.frequency.exponentialRampToValueAtTime(frequency * 0.82, startAt + BODY_RELEASE_SECONDS);
    const bodyGain = ctx.createGain();
    bodyGain.gain.setValueAtTime(0.0001, startAt);
    bodyGain.gain.exponentialRampToValueAtTime(0.34 * velocity, startAt + 0.004);
    bodyGain.gain.exponentialRampToValueAtTime(0.0001, startAt + BODY_RELEASE_SECONDS);
    body.connect(bodyGain);
    bodyGain.connect(this.popBus);
    body.start(startAt);
    body.stop(startAt + BODY_RELEASE_SECONDS);
    this.track(body);

    const click = ctx.createOscillator();
    click.type = "triangle";
    click.frequency.setValueAtTime(frequency * 2.2, startAt);
    click.frequency.exponentialRampToValueAtTime(frequency * 1.35, startAt + CLICK_RELEASE_SECONDS);
    const clickGain = ctx.createGain();
    clickGain.gain.setValueAtTime(0.0001, startAt);
    clickGain.gain.exponentialRampToValueAtTime(0.11 * velocity, startAt + 0.002);
    clickGain.gain.exponentialRampToValueAtTime(0.0001, startAt + CLICK_RELEASE_SECONDS);
    click.connect(clickGain);
    clickGain.connect(this.popBus);
    click.start(startAt);
    click.stop(startAt + CLICK_RELEASE_SECONDS);
    this.track(click);

    const noise = ctx.createBufferSource();
    noise.buffer = this.getNoiseBuffer();
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = "bandpass";
    noiseFilter.frequency.setValueAtTime(frequency * 1.6, startAt);
    noiseFilter.Q.setValueAtTime(0.8, startAt);
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.0001, startAt);
    noiseGain.gain.exponentialRampToValueAtTime(0.03 * velocity, startAt + 0.002);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, startAt + NOISE_RELEASE_SECONDS);
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.popBus);
    noise.start(startAt);
    noise.stop(startAt + NOISE_RELEASE_SECONDS);
    this.track(noise);
  }

  private getNoiseBuffer(): AudioBuffer {
    if (!this.ctx) throw new Error("Audio context is not available");
    if (this.noiseBuffer) return this.noiseBuffer;

    const length = Math.max(1, Math.floor(this.ctx.sampleRate * NOISE_RELEASE_SECONDS));
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let seed = 0x1234abcd;

    for (let i = 0; i < data.length; i += 1) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      const white = (seed / 0xffffffff) * 2 - 1;
      data[i] = white * (1 - i / data.length);
    }

    this.noiseBuffer = buffer;
    return buffer;
  }

  private track(node: AudioScheduledSourceNode): void {
    this.nodes.push(node);
    node.onended = () => {
      this.nodes = this.nodes.filter((item) => item !== node);
    };
  }
}

export const thinkingSound = new ThinkingSound();
