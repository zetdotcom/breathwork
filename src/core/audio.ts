import { appStore } from "./store.ts";
import type { BreathDirection, SessionPhase } from "./app-state.ts";

type Unsubscribe = () => void;

type ToneOptions = {
  frequency: number;
  durationMs: number;
  volume?: number;
  type?: OscillatorType;
};

const DEFAULT_BEEP: ToneOptions = {
  frequency: 880,
  durationMs: 120,
  volume: 0.2,
  type: "sine",
};

const SOFT_PULSE: ToneOptions = {
  frequency: 220,
  durationMs: 80,
  volume: 0.08,
  type: "sine",
};

/**
 * AudioController
 *
 * - Provides lightweight, asset-free audio cues using Web Audio API.
 * - Respect settings.soundEffects (no-op when off).
 * - Cues:
 *   - Phase transitions → soft chime
 *   - Breathing inhale/exhale transitions → soft pulse
 *   - Recovery countdown beeps at 10, 5, 3, 2, 1, 0 seconds
 */
export class AudioController {
  #context: AudioContext | null = null;
  #masterGain: GainNode | null = null;
  #unsubscribers: Unsubscribe[] = [];

  #enabled = true;
  #lastPhase: SessionPhase | null = null;
  #lastDirection: BreathDirection | null = null;
  #lastRecoverySeconds: number | null = null;

  /** Start listening to app store and emit cues. */
  start(): void {
    if (this.#unsubscribers.length > 0) return;

    // Settings toggle
    this.#unsubscribers.push(
      appStore.select(
        (s) => s.settings.soundEffects,
        (enabled) => {
          this.#enabled = enabled;
          if (!enabled) {
            this.#suspend();
          }
        },
      ),
    );

    // Phase transitions
    this.#unsubscribers.push(
      appStore.select(
        (s) => s.phase,
        (phase) => {
          if (phase !== this.#lastPhase) {
            this.#lastPhase = phase;
            if (phase !== "idle") {
              this.#playChime();
            }
          }

          // Reset per-phase trackers
          if (phase !== "recovery") {
            this.#lastRecoverySeconds = null;
          }
        },
      ),
    );

    // Breath direction changes (inhale/exhale)
    this.#unsubscribers.push(
      appStore.select(
        (s) => s.breathDirection,
        (dir) => {
          if (appStore.getState().phase !== "breathing") return;
          if (dir !== this.#lastDirection) {
            this.#lastDirection = dir;
            this.#playPulse();
          }
        },
      ),
    );

    // Recovery countdown beeps (10, 5, 3, 2, 1, 0)
    this.#unsubscribers.push(
      appStore.select(
        (s) => s.recoveryRemainingMs,
        (remainingMs) => {
          if (appStore.getState().phase !== "recovery") return;

          const seconds = Math.ceil(remainingMs / 1000);
          if (seconds === this.#lastRecoverySeconds) return;
          this.#lastRecoverySeconds = seconds;

          if ([10, 5, 3, 2, 1, 0].includes(seconds)) {
            this.#playBeep(
              seconds === 0 ? 660 : 880,
              seconds === 0 ? 200 : 120,
            );
          }
        },
      ),
    );

    // Initialize enabled from current settings
    this.#enabled = appStore.getState().settings.soundEffects;
  }

  /** Stop listening and release audio resources. */
  stop(): void {
    for (const unsub of this.#unsubscribers) unsub();
    this.#unsubscribers = [];
    this.#suspend(true);
  }

  // ── Internal helpers ───────────────────────────────────────────────

  #ensureContext(): boolean {
    if (!this.#enabled) return false;
    if (typeof globalThis === "undefined") return false;

    const Ctor = globalThis.AudioContext ||
      (globalThis as typeof globalThis & {
        webkitAudioContext?: typeof AudioContext;
      })
        .webkitAudioContext;
    if (!Ctor) return false;

    if (!this.#context) {
      this.#context = new Ctor();
      this.#masterGain = this.#context.createGain();
      this.#masterGain.gain.value = 0.6;
      this.#masterGain.connect(this.#context.destination);
    }

    if (this.#context.state === "suspended") {
      // Try resume on user gesture; if it fails, we silently no-op.
      this.#context.resume().catch(() => {});
    }

    return true;
  }

  #suspend(close = false): void {
    if (!this.#context) return;

    if (close) {
      this.#context.close().catch(() => {});
      this.#context = null;
      this.#masterGain = null;
    } else if (this.#context.state === "running") {
      this.#context.suspend().catch(() => {});
    }
  }

  #playTone({
    frequency,
    durationMs,
    volume = 0.15,
    type = "sine",
  }: ToneOptions): void {
    if (!this.#ensureContext() || !this.#context || !this.#masterGain) return;

    const ctx = this.#context;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.value = frequency;

    gain.gain.value = 0;
    gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.01);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + durationMs / 1000);

    osc.connect(gain);
    gain.connect(this.#masterGain);

    osc.start();
    osc.stop(ctx.currentTime + durationMs / 1000 + 0.02);
  }

  #playChime(): void {
    this.#playTone({
      frequency: 520,
      durationMs: 140,
      volume: 0.18,
      type: "sine",
    });
  }

  #playPulse(): void {
    this.#playTone(SOFT_PULSE);
  }

  #playBeep(
    freq = DEFAULT_BEEP.frequency,
    durationMs = DEFAULT_BEEP.durationMs,
  ): void {
    this.#playTone({ ...DEFAULT_BEEP, frequency: freq, durationMs });
  }
}

// Singleton controller
export const audioController = new AudioController();
