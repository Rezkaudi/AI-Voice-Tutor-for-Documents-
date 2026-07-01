const BASE_GAIN = 0.11; // peak loudness (0.0–1.0); raise for a stronger tone
const FADE_SECONDS = 0.35;

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
  private nodes: AudioScheduledSourceNode[] = [];
  private active = false;
  private enabled = true;

  setEnabled(value: boolean): void {
    this.enabled = value;
    if (!value) this.stop();
  }

  start(): void {
    if (!this.enabled || this.active) return;

    const Ctor = resolveAudioContext();
    if (!Ctor) return;

    this.ctx ??= new Ctor();
    const ctx = this.ctx;
    // The call already began from a user gesture, so resuming is permitted.
    void ctx.resume().catch(() => { });

    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, ctx.currentTime);
    master.gain.exponentialRampToValueAtTime(BASE_GAIN, ctx.currentTime + FADE_SECONDS);
    master.connect(ctx.destination);

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(700, ctx.currentTime);
    filter.Q.setValueAtTime(0.6, ctx.currentTime);
    filter.connect(master);

    // Breathing LFO on the master gain.
    const lfo = ctx.createOscillator();
    lfo.frequency.setValueAtTime(0.5, ctx.currentTime);
    const lfoDepth = ctx.createGain();
    lfoDepth.gain.setValueAtTime(BASE_GAIN * 0.55, ctx.currentTime);
    lfo.connect(lfoDepth);
    lfoDepth.connect(master.gain);
    lfo.start();

    // Soft chord: A3 (220 Hz) + C#4 (277.18 Hz).
    for (const freq of [220, 277.18]) {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      const voiceGain = ctx.createGain();
      voiceGain.gain.setValueAtTime(0.5, ctx.currentTime);
      osc.connect(voiceGain);
      voiceGain.connect(filter);
      osc.start();
      this.nodes.push(osc);
    }

    this.nodes.push(lfo);
    this.master = master;
    this.active = true;
  }

  stop(): void {
    if (!this.active || !this.ctx || !this.master) {
      this.active = false;
      return;
    }
    const ctx = this.ctx;
    const master = this.master;
    const nodes = this.nodes;
    this.active = false;
    this.master = null;
    this.nodes = [];

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
}

export const thinkingSound = new ThinkingSound();
