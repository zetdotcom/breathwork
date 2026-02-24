import type { SessionPhase } from "./app-state.ts";

/**
 * State machine for session phase transitions.
 *
 * Pure functions only — no side effects, no store dependency.
 * This makes the transition logic trivially testable.
 *
 * Valid transitions:
 *   idle → prepare
 *   prepare → breathing
 *   breathing → retention
 *   retention → recovery
 *   recovery → breathing (next round)
 *   recovery → summary (user chose to finish)
 *   summary → idle
 *
 * Any transition not listed here is invalid and will be rejected.
 */

const VALID_TRANSITIONS: Record<SessionPhase, readonly SessionPhase[]> = {
  idle: ["prepare"],
  prepare: ["breathing"],
  breathing: ["retention"],
  retention: ["recovery"],
  recovery: ["breathing", "summary"],
  summary: ["idle"],
} as const;

/**
 * Check whether transitioning from `from` to `to` is allowed.
 */
export function canTransition(from: SessionPhase, to: SessionPhase): boolean {
  const allowed = VALID_TRANSITIONS[from];
  return allowed.includes(to);
}

/**
 * Attempt a phase transition. Returns the new phase if valid,
 * or `null` if the transition is not allowed.
 *
 * This keeps the caller in control — no exceptions, no side effects.
 */
export function transition(
  from: SessionPhase,
  to: SessionPhase,
): SessionPhase | null {
  return canTransition(from, to) ? to : null;
}

/**
 * Return the list of phases reachable from the given phase.
 * Useful for UI elements that need to know what's next.
 */
export function nextPhases(from: SessionPhase): readonly SessionPhase[] {
  return VALID_TRANSITIONS[from];
}
