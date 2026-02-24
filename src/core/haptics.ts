import { appStore } from "./store.ts";
import type { BreathDirection, SessionPhase } from "./app-state.ts";

type Unsubscribe = () => void;

/**
 * HapticsController
 *
 * - Wraps navigator.vibrate for subtle feedback.
 * - Respects settings.haptics (no-op when off).
 * - Cues:
 *   - Phase transitions → short pulse
 *   - Breathing inhale/exhale transitions → light pulse
 *   - Recovery countdown at 10, 5, 3, 2, 1, 0 seconds
 * - Graceful no-op on unsupported devices.
 */
export class HapticsController {
  #enabled = true;
  #unsubscribers: Unsubscribe[] = [];

  #lastPhase: SessionPhase | null = null;
  #lastDirection: BreathDirection | null = null;
  #lastRecoverySeconds: number | null = null;

  start(): void {
    if (this.#unsubscribers.length > 0) return;

    // Settings toggle
    this.#unsubscribers.push(
      appStore.select(
        (s) => s.settings.haptics,
        (enabled) => {
          this.#enabled = enabled;
          if (!enabled) {
            this.#cancel();
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
              this.#pulse([30]);
            }
          }

          if (phase !== "recovery") {
            this.#lastRecoverySeconds = null;
          }
        },
      ),
    );

    // Breath direction changes
    this.#unsubscribers.push(
      appStore.select(
        (s) => s.breathDirection,
        (dir) => {
          if (appStore.getState().phase !== "breathing") return;
          if (dir !== this.#lastDirection) {
            this.#lastDirection = dir;
            this.#pulse([20]);
          }
        },
      ),
    );

    // Recovery countdown pulses
    this.#unsubscribers.push(
      appStore.select(
        (s) => s.recoveryRemainingMs,
        (remainingMs) => {
          if (appStore.getState().phase !== "recovery") return;

          const seconds = Math.ceil(remainingMs / 1000);
          if (seconds === this.#lastRecoverySeconds) return;
          this.#lastRecoverySeconds = seconds;

          if ([10, 5, 3, 2, 1, 0].includes(seconds)) {
            this.#pulse(seconds === 0 ? [60, 30, 60] : [40]);
          }
        },
      ),
    );

    // Initialize enabled from current settings
    this.#enabled = appStore.getState().settings.haptics;
  }

  stop(): void {
    for (const unsub of this.#unsubscribers) unsub();
    this.#unsubscribers = [];
    this.#cancel();
  }

  // ── Internal helpers ───────────────────────────────────────────────

  #pulse(pattern: number[]): void {
    if (!this.#enabled) return;
    if (typeof navigator === "undefined") return;
    if (!("vibrate" in navigator)) return;

    try {
      navigator.vibrate(pattern);
    } catch {
      // no-op
    }
  }

  #cancel(): void {
    if (typeof navigator === "undefined") return;
    if (!("vibrate" in navigator)) return;

    try {
      navigator.vibrate(0);
    } catch {
      // no-op
    }
  }
}

// Singleton controller
export const hapticsController = new HapticsController();
