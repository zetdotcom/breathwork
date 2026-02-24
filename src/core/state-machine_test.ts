import { assertEquals } from "@std/assert";
import { canTransition, nextPhases, transition } from "./state-machine.ts";
import { computeBreathState } from "./breathing-engine.ts";
import {
  formatCentiseconds,
  formatCountdownSeconds,
  formatMMSS,
  formatMMSScs,
} from "../utils/time.ts";
import { clamp, easeInOut, lerp, remap } from "../utils/math.ts";

// ── State Machine ───────────────────────────────────────────────────

Deno.test("canTransition: idle → prepare is valid", () => {
  assertEquals(canTransition("idle", "prepare"), true);
});

Deno.test("canTransition: idle → breathing is invalid", () => {
  assertEquals(canTransition("idle", "breathing"), false);
});

Deno.test("canTransition: idle → retention is invalid", () => {
  assertEquals(canTransition("idle", "retention"), false);
});

Deno.test("canTransition: prepare → breathing is valid", () => {
  assertEquals(canTransition("prepare", "breathing"), true);
});

Deno.test("canTransition: prepare → retention is invalid", () => {
  assertEquals(canTransition("prepare", "retention"), false);
});

Deno.test("canTransition: breathing → retention is valid", () => {
  assertEquals(canTransition("breathing", "retention"), true);
});

Deno.test("canTransition: breathing → recovery is invalid", () => {
  assertEquals(canTransition("breathing", "recovery"), false);
});

Deno.test("canTransition: retention → recovery is valid", () => {
  assertEquals(canTransition("retention", "recovery"), true);
});

Deno.test("canTransition: retention → breathing is invalid", () => {
  assertEquals(canTransition("retention", "breathing"), false);
});

Deno.test("canTransition: recovery → breathing is invalid (must go via round-break)", () => {
  assertEquals(canTransition("recovery", "breathing"), false);
});

Deno.test("canTransition: recovery → round-break is valid", () => {
  assertEquals(canTransition("recovery", "round-break"), true);
});

Deno.test("canTransition: recovery → summary is valid (finish)", () => {
  assertEquals(canTransition("recovery", "summary"), true);
});

Deno.test("canTransition: recovery → idle is invalid", () => {
  assertEquals(canTransition("recovery", "idle"), false);
});

Deno.test("canTransition: round-break → breathing is valid", () => {
  assertEquals(canTransition("round-break", "breathing"), true);
});

Deno.test("canTransition: round-break → summary is valid", () => {
  assertEquals(canTransition("round-break", "summary"), true);
});

Deno.test("canTransition: round-break → idle is invalid", () => {
  assertEquals(canTransition("round-break", "idle"), false);
});

Deno.test("canTransition: summary → idle is valid", () => {
  assertEquals(canTransition("summary", "idle"), true);
});

Deno.test("canTransition: summary → breathing is invalid", () => {
  assertEquals(canTransition("summary", "breathing"), false);
});

Deno.test("transition: returns new phase on valid transition", () => {
  assertEquals(transition("idle", "prepare"), "prepare");
  assertEquals(transition("prepare", "breathing"), "breathing");
  assertEquals(transition("breathing", "retention"), "retention");
  assertEquals(transition("retention", "recovery"), "recovery");
  assertEquals(transition("recovery", "round-break"), "round-break");
  assertEquals(transition("recovery", "summary"), "summary");
  assertEquals(transition("round-break", "breathing"), "breathing");
  assertEquals(transition("round-break", "summary"), "summary");
  assertEquals(transition("summary", "idle"), "idle");
});

Deno.test("transition: returns null on invalid transition", () => {
  assertEquals(transition("idle", "breathing"), null);
  assertEquals(transition("idle", "recovery"), null);
  assertEquals(transition("prepare", "retention"), null);
  assertEquals(transition("breathing", "idle"), null);
  assertEquals(transition("summary", "breathing"), null);
});

Deno.test("nextPhases: idle can go to prepare", () => {
  assertEquals(nextPhases("idle"), ["prepare"]);
});

Deno.test("nextPhases: recovery can go to round-break or summary", () => {
  const phases = nextPhases("recovery");
  assertEquals(phases.includes("round-break"), true);
  assertEquals(phases.includes("summary"), true);
  assertEquals(phases.length, 2);
});

Deno.test("nextPhases: round-break can go to breathing or summary", () => {
  const phases = nextPhases("round-break");
  assertEquals(phases.includes("breathing"), true);
  assertEquals(phases.includes("summary"), true);
  assertEquals(phases.length, 2);
});

Deno.test("nextPhases: summary can go to idle", () => {
  assertEquals(nextPhases("summary"), ["idle"]);
});

// ── Time Utilities ──────────────────────────────────────────────────

Deno.test("formatMMSS: 0ms → 00:00", () => {
  assertEquals(formatMMSS(0), "00:00");
});

Deno.test("formatMMSS: 1000ms → 00:01", () => {
  assertEquals(formatMMSS(1000), "00:01");
});

Deno.test("formatMMSS: 61000ms → 01:01", () => {
  assertEquals(formatMMSS(61000), "01:01");
});

Deno.test("formatMMSS: 102050ms → 01:42", () => {
  assertEquals(formatMMSS(102050), "01:42");
});

Deno.test("formatMMSS: 599999ms → 09:59", () => {
  assertEquals(formatMMSS(599999), "09:59");
});

Deno.test("formatMMSS: negative value floors to 00:00", () => {
  assertEquals(formatMMSS(-500), "00:00");
});

Deno.test("formatCentiseconds: 0ms → 00", () => {
  assertEquals(formatCentiseconds(0), "00");
});

Deno.test("formatCentiseconds: 102050ms → 05", () => {
  assertEquals(formatCentiseconds(102050), "05");
});

Deno.test("formatCentiseconds: 1234ms → 23", () => {
  assertEquals(formatCentiseconds(1234), "23");
});

Deno.test("formatCentiseconds: 999ms → 99", () => {
  assertEquals(formatCentiseconds(999), "99");
});

Deno.test("formatCentiseconds: negative value floors to 00", () => {
  assertEquals(formatCentiseconds(-100), "00");
});

Deno.test("formatMMSScs: 102050ms → 01:42.05", () => {
  assertEquals(formatMMSScs(102050), "01:42.05");
});

Deno.test("formatMMSScs: 0ms → 00:00.00", () => {
  assertEquals(formatMMSScs(0), "00:00.00");
});

Deno.test("formatMMSScs: 5500ms → 00:05.50", () => {
  assertEquals(formatMMSScs(5500), "00:05.50");
});

Deno.test("formatCountdownSeconds: 15000ms → 15", () => {
  assertEquals(formatCountdownSeconds(15000), "15");
});

Deno.test("formatCountdownSeconds: 14999ms → 15 (rounds up)", () => {
  assertEquals(formatCountdownSeconds(14999), "15");
});

Deno.test("formatCountdownSeconds: 14001ms → 15 (rounds up)", () => {
  assertEquals(formatCountdownSeconds(14001), "15");
});

Deno.test("formatCountdownSeconds: 14000ms → 14", () => {
  assertEquals(formatCountdownSeconds(14000), "14");
});

Deno.test("formatCountdownSeconds: 1ms → 1", () => {
  assertEquals(formatCountdownSeconds(1), "1");
});

Deno.test("formatCountdownSeconds: 0ms → 0", () => {
  assertEquals(formatCountdownSeconds(0), "0");
});

Deno.test("formatCountdownSeconds: negative value → 0", () => {
  assertEquals(formatCountdownSeconds(-500), "0");
});

// ── Math Utilities ──────────────────────────────────────────────────

Deno.test("lerp: t=0 returns a", () => {
  assertEquals(lerp(10, 20, 0), 10);
});

Deno.test("lerp: t=1 returns b", () => {
  assertEquals(lerp(10, 20, 1), 20);
});

Deno.test("lerp: t=0.5 returns midpoint", () => {
  assertEquals(lerp(0, 100, 0.5), 50);
});

Deno.test("lerp: works with negative values", () => {
  assertEquals(lerp(-10, 10, 0.5), 0);
});

Deno.test("clamp: value within range returns value", () => {
  assertEquals(clamp(5, 0, 10), 5);
});

Deno.test("clamp: value below min returns min", () => {
  assertEquals(clamp(-1, 0, 10), 0);
});

Deno.test("clamp: value above max returns max", () => {
  assertEquals(clamp(15, 0, 10), 10);
});

Deno.test("clamp: value equals min returns min", () => {
  assertEquals(clamp(0, 0, 10), 0);
});

Deno.test("clamp: value equals max returns max", () => {
  assertEquals(clamp(10, 0, 10), 10);
});

Deno.test("remap: maps 0.5 in [0,1] to 150 in [100,200]", () => {
  assertEquals(remap(0.5, 0, 1, 100, 200), 150);
});

Deno.test("remap: maps 0 in [0,1] to 100 in [100,200]", () => {
  assertEquals(remap(0, 0, 1, 100, 200), 100);
});

Deno.test("remap: maps 1 in [0,1] to 200 in [100,200]", () => {
  assertEquals(remap(1, 0, 1, 100, 200), 200);
});

Deno.test("easeInOut: t=0 returns 0", () => {
  assertEquals(easeInOut(0), 0);
});

Deno.test("easeInOut: t=1 returns 1", () => {
  assertEquals(easeInOut(1), 1);
});

Deno.test("easeInOut: t=0.5 returns 0.5", () => {
  assertEquals(easeInOut(0.5), 0.5);
});

Deno.test("easeInOut: t<0 clamps to 0", () => {
  assertEquals(easeInOut(-0.5), 0);
});

Deno.test("easeInOut: t>1 clamps to 1", () => {
  assertEquals(easeInOut(1.5), 1);
});

Deno.test("easeInOut: values near 0 curve upward slowly", () => {
  const val = easeInOut(0.1);
  // smoothstep: 0.1^2 * (3 - 2*0.1) = 0.01 * 2.8 = 0.028
  assertEquals(Math.abs(val - 0.028) < 0.001, true);
});

Deno.test("easeInOut: values near 1 curve toward 1 slowly", () => {
  const val = easeInOut(0.9);
  // smoothstep: 0.9^2 * (3 - 2*0.9) = 0.81 * 1.2 = 0.972
  assertEquals(Math.abs(val - 0.972) < 0.001, true);
});

// ── computeBreathState (pure breathing logic) ───────────────────────

// Normal speed: half-cycle = 2500ms, full cycle = 5000ms

Deno.test("computeBreathState: at time 0, inhale starts at progress 0", () => {
  const result = computeBreathState(0, "normal", 30);
  assertEquals(result.direction, "inhale");
  assertEquals(result.progress, 0);
  assertEquals(result.currentBreath, 0);
  assertEquals(result.done, false);
});

Deno.test("computeBreathState: halfway through inhale at normal speed", () => {
  // Half-cycle for normal = 2500ms. Halfway through inhale = 1250ms.
  const result = computeBreathState(1250, "normal", 30);
  assertEquals(result.direction, "inhale");
  assertEquals(result.progress, 0.5);
  assertEquals(result.currentBreath, 0);
  assertEquals(result.done, false);
});

Deno.test("computeBreathState: exhale starts after half-cycle", () => {
  // At 2500ms, exhale begins (progress = 0)
  const result = computeBreathState(2500, "normal", 30);
  assertEquals(result.direction, "exhale");
  assertEquals(result.progress, 0);
  assertEquals(result.currentBreath, 0);
  assertEquals(result.done, false);
});

Deno.test("computeBreathState: halfway through exhale at normal speed", () => {
  // Exhale starts at 2500ms, halfway = 3750ms
  const result = computeBreathState(3750, "normal", 30);
  assertEquals(result.direction, "exhale");
  assertEquals(result.progress, 0.5);
  assertEquals(result.currentBreath, 0);
  assertEquals(result.done, false);
});

Deno.test("computeBreathState: after one full cycle, breath count is 1", () => {
  // Full cycle = 5000ms for normal speed
  const result = computeBreathState(5000, "normal", 30);
  assertEquals(result.currentBreath, 1);
  assertEquals(result.direction, "inhale");
  assertEquals(result.progress, 0);
  assertEquals(result.done, false);
});

Deno.test("computeBreathState: after two full cycles, breath count is 2", () => {
  const result = computeBreathState(10000, "normal", 30);
  assertEquals(result.currentBreath, 2);
  assertEquals(result.direction, "inhale");
  assertEquals(result.done, false);
});

Deno.test("computeBreathState: done when breath count reaches target", () => {
  // With target of 3, at 15000ms (3 full cycles of 5000ms each)
  const result = computeBreathState(15000, "normal", 3);
  assertEquals(result.currentBreath, 3);
  assertEquals(result.done, true);
});

Deno.test("computeBreathState: done flag stays true after target", () => {
  // Well past the target
  const result = computeBreathState(100000, "normal", 3);
  assertEquals(result.currentBreath, 3);
  assertEquals(result.done, true);
});

Deno.test("computeBreathState: slow speed has longer half-cycle (4000ms)", () => {
  // Slow: half-cycle = 4000ms
  // At 2000ms, should be midway through inhale
  const result = computeBreathState(2000, "slow", 30);
  assertEquals(result.direction, "inhale");
  assertEquals(result.progress, 0.5);
  assertEquals(result.done, false);
});

Deno.test("computeBreathState: slow speed exhale starts at 4000ms", () => {
  const result = computeBreathState(4000, "slow", 30);
  assertEquals(result.direction, "exhale");
  assertEquals(result.progress, 0);
  assertEquals(result.done, false);
});

Deno.test("computeBreathState: fast speed has shorter half-cycle (1500ms)", () => {
  // Fast: half-cycle = 1500ms
  // At 750ms, should be midway through inhale
  const result = computeBreathState(750, "fast", 30);
  assertEquals(result.direction, "inhale");
  assertEquals(result.progress, 0.5);
  assertEquals(result.done, false);
});

Deno.test("computeBreathState: fast speed exhale starts at 1500ms", () => {
  const result = computeBreathState(1500, "fast", 30);
  assertEquals(result.direction, "exhale");
  assertEquals(result.progress, 0);
  assertEquals(result.done, false);
});

Deno.test("computeBreathState: fast speed full cycle is 3000ms", () => {
  const result = computeBreathState(3000, "fast", 30);
  assertEquals(result.currentBreath, 1);
  assertEquals(result.direction, "inhale");
  assertEquals(result.done, false);
});

Deno.test("computeBreathState: target of 1 completes after one cycle", () => {
  const result = computeBreathState(5000, "normal", 1);
  assertEquals(result.currentBreath, 1);
  assertEquals(result.done, true);
});

Deno.test("computeBreathState: progress stays within 0-1 bounds", () => {
  // Test at many time points to ensure progress never goes out of bounds
  for (let t = 0; t < 20000; t += 137) {
    const result = computeBreathState(t, "normal", 30);
    assertEquals(
      result.progress >= 0 && result.progress <= 1,
      true,
      `progress ${result.progress} out of bounds at t=${t}`,
    );
  }
});

Deno.test("computeBreathState: breath count never exceeds target", () => {
  for (let t = 0; t < 200000; t += 500) {
    const result = computeBreathState(t, "normal", 5);
    assertEquals(
      result.currentBreath <= 5,
      true,
      `currentBreath ${result.currentBreath} exceeded target at t=${t}`,
    );
  }
});

Deno.test("computeBreathState: direction alternates correctly through cycles", () => {
  // Check that within each full cycle, first half is inhale, second half is exhale
  // Normal speed: half-cycle = 2500ms
  const checks = [
    { t: 0, expected: "inhale" },
    { t: 1000, expected: "inhale" },
    { t: 2499, expected: "inhale" },
    { t: 2500, expected: "exhale" },
    { t: 3000, expected: "exhale" },
    { t: 4999, expected: "exhale" },
    { t: 5000, expected: "inhale" }, // second cycle
    { t: 7500, expected: "exhale" }, // second cycle exhale
  ];

  for (const { t, expected } of checks) {
    const result = computeBreathState(t, "normal", 30);
    assertEquals(
      result.direction,
      expected,
      `expected ${expected} at t=${t}, got ${result.direction}`,
    );
  }
});
