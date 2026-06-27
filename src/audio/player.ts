import type { PlaybackEvent } from "./schedule";

export type PlaybackState = "stopped" | "playing" | "paused";

/** Small lead-in before the first scheduled tone, so the AudioContext has settled. */
const SCHEDULE_LEAD_IN_SECONDS = 0.05;

/**
 * Fade in/out applied to every tone's amplitude, so it starts/stops at zero crossing instead
 * of jumping there instantly — an instant jump is what causes an audible "click"/"pop".
 * Clamped to at most half the tone's duration for very short notes.
 */
const FADE_SECONDS = 0.006;

/**
 * Schedules and plays a `PlaybackEvent` sequence via the Web Audio API (oscillator-based,
 * no audio assets). The `AudioContext` is created lazily on the first `play()` call, since
 * browsers require a user gesture to start one.
 */
export class PlaybackController {
  private context: AudioContext | null = null;
  private oscillators: OscillatorNode[] = [];
  private gains: GainNode[] = [];
  private playbackState: PlaybackState = "stopped";

  get state(): PlaybackState {
    return this.playbackState;
  }

  /** Starts playing `schedule` from the beginning. `onFinish` fires once playback completes naturally. */
  play(schedule: readonly PlaybackEvent[], onFinish?: () => void): void {
    this.stop();
    if (schedule.length === 0) {
      return;
    }

    this.context = new AudioContext();
    const startTime = this.context.currentTime + SCHEDULE_LEAD_IN_SECONDS;
    let lastOscillator: OscillatorNode | null = null;
    let latestEnd = 0;

    for (const event of schedule) {
      const eventEnd = event.startTime + event.duration;
      if (event.frequency === null) {
        latestEnd = Math.max(latestEnd, eventEnd);
        continue;
      }

      const noteStart = startTime + event.startTime;
      const noteEnd = startTime + eventEnd;
      const fade = Math.min(FADE_SECONDS, event.duration / 2);

      const gain = this.context.createGain();
      gain.gain.setValueAtTime(0, noteStart);
      gain.gain.linearRampToValueAtTime(1, noteStart + fade);
      gain.gain.setValueAtTime(1, noteEnd - fade);
      gain.gain.linearRampToValueAtTime(0, noteEnd);
      gain.connect(this.context.destination);
      this.gains.push(gain);

      const oscillator = this.context.createOscillator();
      oscillator.type = "sine";
      oscillator.frequency.value = event.frequency;
      oscillator.connect(gain);
      oscillator.start(noteStart);
      oscillator.stop(noteEnd);
      this.oscillators.push(oscillator);

      if (eventEnd >= latestEnd) {
        latestEnd = eventEnd;
        lastOscillator = oscillator;
      }
    }

    this.playbackState = "playing";

    if (!lastOscillator) {
      // Nothing audible was scheduled (rests/unplayable tokens only); nothing to wait for.
      this.playbackState = "stopped";
      onFinish?.();
      return;
    }

    lastOscillator.addEventListener("ended", () => {
      if (this.playbackState === "playing") {
        this.playbackState = "stopped";
        onFinish?.();
      }
    });
  }

  /** Suspends the AudioContext, freezing all scheduled-but-unplayed oscillators in place. */
  pause(): void {
    if (this.playbackState !== "playing" || !this.context) {
      return;
    }
    void this.context.suspend();
    this.playbackState = "paused";
  }

  /** Resumes a paused playback from exactly where it was suspended. */
  resume(): void {
    if (this.playbackState !== "paused" || !this.context) {
      return;
    }
    void this.context.resume();
    this.playbackState = "playing";
  }

  /** Cancels any scheduled-but-unplayed oscillators and tears down the AudioContext, leaving no sound. */
  stop(): void {
    this.oscillators.forEach((oscillator) => {
      try {
        oscillator.stop();
      } catch {
        // Already stopped.
      }
      oscillator.disconnect();
    });
    this.oscillators = [];

    this.gains.forEach((gain) => gain.disconnect());
    this.gains = [];

    if (this.context) {
      void this.context.close();
      this.context = null;
    }

    this.playbackState = "stopped";
  }
}
