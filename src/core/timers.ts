/**
 * Timer abstractions built on requestAnimationFrame.
 *
 * Provides two patterns:
 * - AnimationLoop: a RAF loop that calls a tick function with a delta
 * - Countdown / Stopwatch helpers built on AnimationLoop
 *
 * The time source is injectable for testability:
 * - Default: `performance.now()`
 * - Tests: pass a custom `now()` function
 */

export type TickCallback = (dt: number, elapsed: number) => void;

export type TimeSource = () => number;

const defaultTimeSource: TimeSource = () => performance.now();

// ── AnimationLoop ────────────────────────────────────────────────────

/**
 * A thin wrapper around requestAnimationFrame that tracks elapsed time
 * and calls a tick function each frame with (deltaMs, totalElapsedMs).
 *
 * Usage:
 *   const loop = new AnimationLoop((dt, elapsed) => { ... });
 *   loop.start();
 *   loop.stop();
 */
export class AnimationLoop {
  #tick: TickCallback;
  #now: TimeSource;
  #rafId: number | null = null;
  #startTime = 0;
  #lastTime = 0;
  #running = false;

  constructor(tick: TickCallback, now: TimeSource = defaultTimeSource) {
    this.#tick = tick;
    this.#now = now;
  }

  get running(): boolean {
    return this.#running;
  }

  /** Total milliseconds elapsed since start (while running). */
  get elapsed(): number {
    if (!this.#running) return 0;
    return this.#now() - this.#startTime;
  }

  start(): void {
    if (this.#running) return;
    this.#running = true;
    const now = this.#now();
    this.#startTime = now;
    this.#lastTime = now;
    this.#schedule();
  }

  stop(): void {
    this.#running = false;
    if (this.#rafId !== null) {
      cancelAnimationFrame(this.#rafId);
      this.#rafId = null;
    }
  }

  #schedule(): void {
    this.#rafId = requestAnimationFrame(() => this.#frame());
  }

  #frame(): void {
    if (!this.#running) return;

    const now = this.#now();
    const dt = now - this.#lastTime;
    const elapsed = now - this.#startTime;
    this.#lastTime = now;

    this.#tick(dt, elapsed);

    if (this.#running) {
      this.#schedule();
    }
  }
}

// ── Countdown ────────────────────────────────────────────────────────

export type CountdownCallbacks = {
  /** Called every frame with remaining milliseconds. */
  onTick: (remainingMs: number) => void;
  /** Called once when the countdown reaches zero. */
  onComplete: () => void;
};

/**
 * Creates an AnimationLoop that counts down from `durationMs` to 0.
 *
 * Returns the loop instance so the caller can start/stop it.
 */
export function createCountdown(
  durationMs: number,
  callbacks: CountdownCallbacks,
  now?: TimeSource,
): AnimationLoop {
  const loop = new AnimationLoop((_dt, elapsed) => {
    const remaining = Math.max(0, durationMs - elapsed);
    callbacks.onTick(remaining);

    if (remaining <= 0) {
      loop.stop();
      callbacks.onComplete();
    }
  }, now);

  return loop;
}

// ── Stopwatch ────────────────────────────────────────────────────────

export type StopwatchCallbacks = {
  /** Called every frame with elapsed milliseconds. */
  onTick: (elapsedMs: number) => void;
};

/**
 * Creates an AnimationLoop that counts up from 0 indefinitely.
 *
 * Returns the loop instance so the caller can start/stop it.
 * Read `loop.elapsed` after stopping to get the final value.
 */
export function createStopwatch(
  callbacks: StopwatchCallbacks,
  now?: TimeSource,
): AnimationLoop {
  const loop = new AnimationLoop((_dt, elapsed) => {
    callbacks.onTick(elapsed);
  }, now);

  return loop;
}
