import { appStore } from "./store.ts";
import type {
  AppState,
  BreathDirection,
  RoundRecord,
  Speed,
} from "./app-state.ts";
import { canTransition } from "./state-machine.ts";
import {
  AnimationLoop,
  createCountdown,
  createStopwatch,
  type TimeSource,
} from "./timers.ts";
import { clamp } from "../utils/math.ts";

// ── Speed → cycle duration mapping ──────────────────────────────────

/** Duration of one half-cycle (inhale OR exhale) in ms, per speed setting. */
const HALF_CYCLE_MS: Record<Speed, number> = {
  slow: 4000,
  normal: 2500,
  fast: 1500,
};

const RECOVERY_DURATION_MS = 15_000;
const ROUND_BREAK_DURATION_MS = 10_000;

// ── Pure computation (testable) ─────────────────────────────────────

/**
 * Given elapsed time within the breathing phase and the speed setting,
 * compute the current breath direction, progress within that half-cycle,
 * and total completed breaths.
 *
 * A "breath" is one full inhale + exhale cycle.
 * - First half of the cycle: inhale (progress 0→1)
 * - Second half: exhale (progress 0→1)
 * - Breath count increments at the end of each full cycle (after exhale).
 *
 * Pure function — no side effects.
 */
export function computeBreathState(
  elapsedMs: number,
  speed: Speed,
  targetBreathCount: number,
): {
  direction: BreathDirection;
  progress: number;
  currentBreath: number;
  done: boolean;
} {
  const halfCycle = HALF_CYCLE_MS[speed];
  const fullCycle = halfCycle * 2;

  // How many full cycles have completed?
  const completedCycles = Math.floor(elapsedMs / fullCycle);
  const currentBreath = Math.min(completedCycles, targetBreathCount);

  // Are we done?
  if (currentBreath >= targetBreathCount) {
    return {
      direction: "exhale",
      progress: 1,
      currentBreath: targetBreathCount,
      done: true,
    };
  }

  // Where are we within the current cycle?
  const posInCycle = elapsedMs % fullCycle;
  const isInhale = posInCycle < halfCycle;

  const direction: BreathDirection = isInhale ? "inhale" : "exhale";
  const posInHalf = isInhale ? posInCycle : posInCycle - halfCycle;
  const progress = clamp(posInHalf / halfCycle, 0, 1);

  return { direction, progress, currentBreath, done: false };
}

// ── SessionEngine ───────────────────────────────────────────────────

/**
 * Orchestrates a full session:
 *   idle → prepare → breathing → retention → recovery → (next round | summary)
 *
 * Owns all timer loops. Updates the global store with phase state.
 * Call `startSession()` to begin, `stopSession()` to abort.
 *
 * Usage:
 *   import { sessionEngine } from "./breathing-engine.ts";
 *   sessionEngine.startSession();
 */
export class SessionEngine {
  /** The currently active timer/loop. Null when idle. */
  #activeLoop: AnimationLoop | null = null;

  /** Timestamp (ms since epoch) when retention phase started. */
  #retentionStartMs = 0;

  /** Injectable time source for testability. */
  #now: TimeSource;

  constructor(now?: TimeSource) {
    this.#now = now ?? (() => performance.now());
  }

  // ── Public API ────────────────────────────────────────────────────

  /** Start a new session from idle. */
  startSession(): void {
    const state = appStore.getState();
    if (state.phase !== "idle") return;

    const settings = state.settings;

    appStore.setState(
      {
        sessionActive: true,
        phase: "prepare",
        currentBreath: 0,
        currentRound: 1,
        rounds: [],
        breathDirection: "inhale",
        breathProgress: 0,
        prepareRemainingMs: settings.prepareSeconds * 1000,
        retentionElapsedMs: 0,
        recoveryRemainingMs: RECOVERY_DURATION_MS,
        roundBreakRemainingMs: ROUND_BREAK_DURATION_MS,
        targetBreathCount: settings.breathCount,
        sessionStartedAt: new Date().toISOString(),
      },
      { source: "SessionEngine", action: "START_SESSION" },
    );

    this.#startPrepare();
  }

  /** Abort the session entirely and return to idle. */
  stopSession(): void {
    this.#stopActiveLoop();

    appStore.setState(
      {
        sessionActive: false,
        phase: "idle",
        breathProgress: 0,
        currentBreath: 0,
        prepareRemainingMs: 0,
        retentionElapsedMs: 0,
        recoveryRemainingMs: RECOVERY_DURATION_MS,
        roundBreakRemainingMs: ROUND_BREAK_DURATION_MS,
        sessionStartedAt: null,
      },
      { source: "SessionEngine", action: "STOP_SESSION" },
    );
  }

  /**
   * Skip the prepare countdown and start breathing immediately.
   * Only works during the prepare phase.
   */
  skipPrepare(): void {
    if (appStore.getState().phase !== "prepare") return;

    appStore.setState(
      { prepareRemainingMs: 0 },
      { source: "SessionEngine", action: "SKIP_PREPARE" },
    );

    this.#startBreathing();
  }

  /**
   * Skip the breathing phase immediately (double-tap to skip).
   * Only works during the breathing phase.
   */
  skipBreathing(): void {
    if (appStore.getState().phase !== "breathing") return;
    this.#endBreathing();
  }

  /**
   * End retention phase ("I Need To Inhale" button).
   * Only works during the retention phase.
   */
  endRetention(): void {
    if (appStore.getState().phase !== "retention") return;
    this.#transitionToRecovery();
  }

  /**
   * Finish the session after the current round's recovery.
   * Transitions to summary instead of starting a new round.
   * Can be called during recovery to end after it completes,
   * or called at any time to flag early exit.
   */
  finishSession(): void {
    const state = appStore.getState();

    if (state.phase === "recovery") {
      // Let recovery finish, then go to summary instead of next round.
      // We signal this by setting a flag — checked in #onRecoveryComplete.
      this.#finishRequested = true;
    } else if (state.phase === "round-break") {
      // During round-break, immediately go to summary.
      this.#stopActiveLoop();
      this.#goToSummary();
    } else if (state.phase === "summary") {
      // Already at summary — transition to idle.
      this.#stopActiveLoop();
      appStore.setState(
        { sessionActive: false, phase: "idle", sessionStartedAt: null },
        { source: "SessionEngine", action: "FINISH_SESSION" },
      );
    } else {
      // For any other phase, immediately go to summary with current data.
      this.#stopActiveLoop();
      this.#goToSummary();
    }
  }

  /** Start another round from the summary screen. */
  startNextRound(): void {
    if (appStore.getState().phase !== "summary") return;
    this.#startBreathing();
  }

  /**
   * Skip the round-break countdown and start the next round immediately.
   * Only works during the round-break phase.
   */
  skipRoundBreak(): void {
    if (appStore.getState().phase !== "round-break") return;
    this.#stopActiveLoop();
    this.#startBreathing();
  }

  // ── Private flag ──────────────────────────────────────────────────

  #finishRequested = false;

  // ── Phase runners ─────────────────────────────────────────────────

  #startPrepare(): void {
    const state = appStore.getState();
    if (!canTransition(state.phase, "prepare") && state.phase !== "prepare") {
      return;
    }

    const durationMs = state.settings.prepareSeconds * 1000;

    this.#stopActiveLoop();
    this.#activeLoop = createCountdown(
      durationMs,
      {
        onTick: (remaining) => {
          appStore.setState(
            { prepareRemainingMs: remaining },
            { source: "SessionEngine", action: "PREPARE_TICK" },
          );
        },
        onComplete: () => {
          this.#startBreathing();
        },
      },
      this.#now,
    );
    this.#activeLoop.start();
  }

  #startBreathing(): void {
    const state = appStore.getState();
    const nextRound =
      state.phase === "summary"
        ? state.currentRound + 1
        : state.phase === "recovery"
          ? state.currentRound + 1
          : state.phase === "round-break"
            ? state.currentRound + 1
            : state.currentRound;

    appStore.setState(
      {
        phase: "breathing",
        breathDirection: "inhale",
        breathProgress: 0,
        currentBreath: 0,
        currentRound: nextRound,
      },
      { source: "SessionEngine", action: "START_BREATHING" },
    );

    const speed = appStore.getState().settings.speed;
    const targetBreathCount = appStore.getState().targetBreathCount;

    this.#stopActiveLoop();
    this.#activeLoop = new AnimationLoop((_dt, elapsed) => {
      const result = computeBreathState(elapsed, speed, targetBreathCount);

      appStore.setState(
        {
          breathDirection: result.direction,
          breathProgress: result.progress,
          currentBreath: result.currentBreath,
        },
        { source: "SessionEngine", action: "BREATHING_TICK" },
      );

      if (result.done) {
        this.#endBreathing();
      }
    }, this.#now);
    this.#activeLoop.start();
  }

  #endBreathing(): void {
    this.#stopActiveLoop();

    appStore.setState(
      {
        phase: "retention",
        breathDirection: "exhale",
        breathProgress: 0,
        retentionElapsedMs: 0,
      },
      { source: "SessionEngine", action: "START_RETENTION" },
    );

    this.#retentionStartMs = this.#now();

    this.#activeLoop = createStopwatch(
      {
        onTick: (elapsed) => {
          appStore.setState(
            { retentionElapsedMs: elapsed },
            { source: "SessionEngine", action: "RETENTION_TICK" },
          );
        },
      },
      this.#now,
    );
    this.#activeLoop.start();
  }

  #transitionToRecovery(): void {
    this.#stopActiveLoop();

    // Capture retention duration for this round
    const state = appStore.getState();
    const retentionMs = state.retentionElapsedMs;

    appStore.setState(
      {
        phase: "recovery",
        recoveryRemainingMs: RECOVERY_DURATION_MS,
      },
      { source: "SessionEngine", action: "START_RECOVERY" },
    );

    // Store the retention time temporarily — will be recorded when recovery completes
    this.#pendingRetentionMs = retentionMs;

    this.#activeLoop = createCountdown(
      RECOVERY_DURATION_MS,
      {
        onTick: (remaining) => {
          appStore.setState(
            { recoveryRemainingMs: remaining },
            { source: "SessionEngine", action: "RECOVERY_TICK" },
          );
        },
        onComplete: () => {
          this.#onRecoveryComplete();
        },
      },
      this.#now,
    );
    this.#activeLoop.start();
  }

  #pendingRetentionMs = 0;

  #onRecoveryComplete(): void {
    this.#stopActiveLoop();

    // Record the completed round
    const state = appStore.getState();
    const round: RoundRecord = {
      breathCount: state.currentBreath,
      retentionMs: this.#pendingRetentionMs,
      recoveryMs: RECOVERY_DURATION_MS,
    };

    const updatedRounds = [...state.rounds, round];
    appStore.setState(
      { rounds: updatedRounds },
      { source: "SessionEngine", action: "RECORD_ROUND" },
    );

    // Decide: summary or round-break (prepare for next round)?
    if (this.#finishRequested) {
      this.#finishRequested = false;
      this.#goToSummary();
    } else {
      // Transition to round-break countdown before next round
      this.#startRoundBreak();
    }
  }

  #startRoundBreak(): void {
    this.#stopActiveLoop();

    appStore.setState(
      {
        phase: "round-break",
        roundBreakRemainingMs: ROUND_BREAK_DURATION_MS,
      },
      { source: "SessionEngine", action: "START_ROUND_BREAK" },
    );

    this.#activeLoop = createCountdown(
      ROUND_BREAK_DURATION_MS,
      {
        onTick: (remaining) => {
          appStore.setState(
            { roundBreakRemainingMs: remaining },
            { source: "SessionEngine", action: "ROUND_BREAK_TICK" },
          );
        },
        onComplete: () => {
          this.#startBreathing();
        },
      },
      this.#now,
    );
    this.#activeLoop.start();
  }

  #goToSummary(): void {
    this.#stopActiveLoop();
    appStore.setState(
      { phase: "summary" },
      { source: "SessionEngine", action: "GO_TO_SUMMARY" },
    );
  }

  // ── Helpers ───────────────────────────────────────────────────────

  #stopActiveLoop(): void {
    if (this.#activeLoop) {
      this.#activeLoop.stop();
      this.#activeLoop = null;
    }
  }
}

// ── Module singleton ────────────────────────────────────────────────

export const sessionEngine = new SessionEngine();
