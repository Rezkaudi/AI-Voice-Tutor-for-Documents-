const SOUND_SRC = "/thinking-loop.wav";

const BASE_VOLUME = 1;
const FADE_MS = 90;
const FADE_STEPS = 6;


class ThinkingSound {
  private audio: HTMLAudioElement | null = null;
  private active = false;
  private enabled = true;
  private fadeTimer: number | null = null;

  setEnabled(value: boolean): void {
    this.enabled = value;
    if (!value) this.stop();
  }

  unlock(): void {
    if (!this.enabled) return;
    const audio = this.ensureAudio();
    if (!audio) return;
    audio.muted = true;
    audio
      .play()
      .then(() => {
        audio.pause();
        audio.currentTime = 0;
        audio.muted = false;
      })
      .catch(() => {
        audio.muted = false;
      });
  }

  start(): void {
    if (!this.enabled || this.active) return;
    const audio = this.ensureAudio();
    if (!audio) return;

    this.active = true;
    this.clearFade();
    audio.muted = false;
    audio.volume = BASE_VOLUME;
    audio.currentTime = 0;
    void audio.play().catch(() => {
      this.active = false;
    });
  }

  stop(): void {
    if (!this.active || !this.audio) {
      this.active = false;
      return;
    }
    this.active = false;
    this.fadeOutAndPause(this.audio);
  }

  private ensureAudio(): HTMLAudioElement | null {
    if (typeof Audio === "undefined") return null;
    if (!this.audio) {
      const el = new Audio(SOUND_SRC);
      el.loop = true;
      el.preload = "auto";
      el.volume = BASE_VOLUME;
      this.audio = el;
    }
    return this.audio;
  }

  private fadeOutAndPause(audio: HTMLAudioElement): void {
    this.clearFade();
    const startVolume = audio.volume;
    let step = 0;
    this.fadeTimer = window.setInterval(() => {
      step += 1;
      audio.volume = Math.max(0, startVolume * (1 - step / FADE_STEPS));
      if (step >= FADE_STEPS) {
        this.clearFade();
        audio.pause();
        audio.currentTime = 0;
        audio.volume = BASE_VOLUME;
      }
    }, FADE_MS / FADE_STEPS);
  }

  private clearFade(): void {
    if (this.fadeTimer !== null) {
      window.clearInterval(this.fadeTimer);
      this.fadeTimer = null;
    }
  }
}

export const thinkingSound = new ThinkingSound();
