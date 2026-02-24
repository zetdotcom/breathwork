/**
 * Time formatting utilities.
 *
 * Pure functions — no side effects, no DOM, no imports.
 * Used by session screens to display timers.
 */

/**
 * Format milliseconds as MM:SS (e.g., 102050 → "01:42").
 */
export function formatMMSS(ms: number): string {
  const totalSeconds = Math.floor(Math.max(0, ms) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/**
 * Format the fractional-seconds part of a millisecond value (e.g., 102050 → "05").
 * Returns a two-digit string representing hundredths of a second.
 */
export function formatCentiseconds(ms: number): string {
  const centiseconds = Math.floor((Math.max(0, ms) % 1000) / 10);
  return String(centiseconds).padStart(2, "0");
}

/**
 * Format milliseconds as MM:SS.cs (e.g., 102050 → "01:42.05").
 * Useful for retention timer display.
 */
export function formatMMSScs(ms: number): string {
  return `${formatMMSS(ms)}.${formatCentiseconds(ms)}`;
}

/**
 * Format seconds as a short display string (e.g., 10 → "10", 5 → "5").
 * Used for prepare-phase countdown.
 */
export function formatCountdownSeconds(ms: number): string {
  return String(Math.ceil(Math.max(0, ms) / 1000));
}

/**
 * Format milliseconds as a short M:SS string (e.g., 135000 → "2:15").
 * Unlike formatMMSS, this omits the leading zero on minutes for compact display.
 * Used in session cards and history views.
 */
export function formatMinSec(ms: number): string {
  const totalSeconds = Math.floor(Math.max(0, ms) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/**
 * Format an ISO 8601 date string as a short locale date (e.g., "Oct 24").
 * Used in session cards and history views.
 */
export function formatShortDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
