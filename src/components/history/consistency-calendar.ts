import { appStore } from "../../core/store.ts";
import type { SessionRecord } from "../../core/app-state.ts";

/**
 * Consistency Calendar — monthly grid showing which days had sessions.
 *
 * Renders a standard 7-column calendar (S M T W T F S) with:
 *   - Month navigation: `< OCT 2023 >` arrows to switch months.
 *   - Days with completed sessions highlighted with a filled blue circle.
 *   - Today highlighted with an outlined circle.
 *   - Days without sessions shown as plain text.
 *   - Days outside the current month left as empty cells.
 *
 * Reads session data from the global store (`appStore.getState().sessions`).
 * Subscribes to store changes so it updates if sessions are added/removed.
 *
 * Usage:
 *   <consistency-calendar></consistency-calendar>
 */

const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

const MONTH_NAMES = [
  "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
  "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
];

const MONTH_NAMES_FULL = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const TEMPLATE = document.createElement("template");
TEMPLATE.innerHTML = `
  <style>
    :host {
      display: block;
    }

    .section {
      padding: 0;
    }

    /* ── Header row ── */
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 16px;
    }

    .header h2 {
      font-size: 22px;
      font-weight: 700;
      letter-spacing: -0.025em;
      color: var(--color-text, #f1f5f9);
      margin: 0;
    }

    .month-nav {
      display: flex;
      align-items: center;
      gap: 4px;
      background: var(--color-surface-dark, #1e293b);
      border-radius: var(--radius-full, 9999px);
      padding: 4px 10px;
    }

    .month-nav button {
      display: flex;
      align-items: center;
      justify-content: center;
      background: none;
      border: none;
      cursor: pointer;
      color: var(--color-text-muted, #94a3b8);
      padding: 2px;
      border-radius: 50%;
      transition: color 200ms ease;
      -webkit-tap-highlight-color: transparent;
    }

    .month-nav button:hover {
      color: var(--color-primary, #137fec);
    }

    .month-nav button:active {
      opacity: 0.7;
    }

    .month-nav .arrow {
      font-family: "Material Symbols Outlined";
      font-size: 18px;
      font-variation-settings: "FILL" 0, "wght" 400, "GRAD" 0, "opsz" 20;
      line-height: 1;
    }

    .month-label {
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--color-text-muted, #94a3b8);
      user-select: none;
      min-width: 70px;
      text-align: center;
    }

    /* ── Calendar grid container ── */
    .calendar {
      background: var(--color-surface-dark, #1e293b);
      border: 1px solid var(--color-border-dark, #334155);
      border-radius: var(--radius-lg, 1rem);
      padding: 16px;
    }

    /* ── Day-of-week header ── */
    .day-labels {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      margin-bottom: 8px;
    }

    .day-label {
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--color-text-dim, #64748b);
      height: 24px;
    }

    /* ── Day cells ── */
    .days {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 4px 0;
    }

    .day-cell {
      display: flex;
      align-items: center;
      justify-content: center;
      aspect-ratio: 1;
    }

    .day {
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      font-size: 13px;
      font-weight: 400;
      color: var(--color-text-muted, #94a3b8);
      position: relative;
    }

    /* Day with session — filled blue circle */
    .day.has-session {
      background: var(--color-primary, #137fec);
      color: #fff;
      font-weight: 600;
      box-shadow: 0 2px 8px -2px rgba(19, 127, 236, 0.4);
    }

    /* Today — outlined circle (when no session) */
    .day.is-today:not(.has-session) {
      border: 2px solid var(--color-primary, #137fec);
      color: var(--color-primary, #137fec);
      font-weight: 600;
    }

    /* Today with session — keep filled but add stronger glow */
    .day.is-today.has-session {
      box-shadow: 0 0 12px -2px rgba(19, 127, 236, 0.6);
    }

    /* Outside-month or future days — dimmer */
    .day.is-inactive {
      color: var(--color-text-dim, #64748b);
      opacity: 0.4;
    }
  </style>

  <div class="section">
    <div class="header">
      <h2>Consistency</h2>
      <div class="month-nav">
        <button id="prev-month" aria-label="Previous month">
          <span class="arrow" aria-hidden="true">chevron_left</span>
        </button>
        <span class="month-label" id="month-label">OCT 2023</span>
        <button id="next-month" aria-label="Next month">
          <span class="arrow" aria-hidden="true">chevron_right</span>
        </button>
      </div>
    </div>

    <div class="calendar">
      <div class="day-labels" id="day-labels"></div>
      <div class="days" id="days-grid"></div>
    </div>
  </div>
`;

export class ConsistencyCalendar extends HTMLElement {
  #root: ShadowRoot;

  /** The currently displayed month (year, month). */
  #viewYear: number;
  #viewMonth: number; // 0-indexed (0 = January)

  #monthLabel: HTMLElement | null = null;
  #daysGrid: HTMLElement | null = null;
  #dayLabelsEl: HTMLElement | null = null;
  #prevBtn: HTMLButtonElement | null = null;
  #nextBtn: HTMLButtonElement | null = null;

  #unsubscribe: (() => void) | null = null;

  constructor() {
    super();
    this.#root = this.attachShadow({ mode: "open" });
    this.#root.appendChild(TEMPLATE.content.cloneNode(true));

    const now = new Date();
    this.#viewYear = now.getFullYear();
    this.#viewMonth = now.getMonth();

    this.#monthLabel = this.#root.getElementById("month-label");
    this.#daysGrid = this.#root.getElementById("days-grid");
    this.#dayLabelsEl = this.#root.getElementById("day-labels");
    this.#prevBtn = this.#root.getElementById("prev-month") as HTMLButtonElement | null;
    this.#nextBtn = this.#root.getElementById("next-month") as HTMLButtonElement | null;
  }

  connectedCallback() {
    // Render day-of-week headers (static)
    this.#renderDayLabels();

    // Event listeners
    this.#prevBtn?.addEventListener("click", this.#handlePrev);
    this.#nextBtn?.addEventListener("click", this.#handleNext);

    // Subscribe to session changes
    this.#unsubscribe = appStore.select(
      (s) => s.sessions,
      () => this.#renderGrid(),
    );

    // Initial render
    this.#renderGrid();
  }

  disconnectedCallback() {
    this.#prevBtn?.removeEventListener("click", this.#handlePrev);
    this.#nextBtn?.removeEventListener("click", this.#handleNext);
    this.#unsubscribe?.();
    this.#unsubscribe = null;
  }

  // ── Navigation handlers ─────────────────────────────────────────

  #handlePrev = () => {
    this.#viewMonth -= 1;
    if (this.#viewMonth < 0) {
      this.#viewMonth = 11;
      this.#viewYear -= 1;
    }
    this.#renderGrid();
  };

  #handleNext = () => {
    this.#viewMonth += 1;
    if (this.#viewMonth > 11) {
      this.#viewMonth = 0;
      this.#viewYear += 1;
    }
    this.#renderGrid();
  };

  // ── Render helpers ──────────────────────────────────────────────

  #renderDayLabels() {
    if (!this.#dayLabelsEl) return;
    this.#dayLabelsEl.innerHTML = DAY_LABELS.map(
      (d) => `<div class="day-label">${d}</div>`,
    ).join("");
  }

  #renderGrid() {
    if (!this.#daysGrid || !this.#monthLabel) return;

    const year = this.#viewYear;
    const month = this.#viewMonth;

    // Update month label
    this.#monthLabel.textContent = `${MONTH_NAMES[month]} ${year}`;
    this.#monthLabel.setAttribute(
      "aria-label",
      `${MONTH_NAMES_FULL[month]} ${year}`,
    );

    // Build a set of days (YYYY-MM-DD) that have sessions
    const sessionDays = this.#getSessionDays(year, month);

    // Today info
    const now = new Date();
    const todayYear = now.getFullYear();
    const todayMonth = now.getMonth();
    const todayDate = now.getDate();

    // Number of days in this month
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Day of week for the 1st (0 = Sunday)
    const firstDayOfWeek = new Date(year, month, 1).getDay();

    // Build cells
    let html = "";

    // Empty cells for days before the 1st
    for (let i = 0; i < firstDayOfWeek; i++) {
      html += `<div class="day-cell"></div>`;
    }

    // Day cells
    for (let day = 1; day <= daysInMonth; day++) {
      const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const hasSession = sessionDays.has(dateKey);
      const isToday =
        year === todayYear && month === todayMonth && day === todayDate;

      const classes = ["day"];
      if (hasSession) classes.push("has-session");
      if (isToday) classes.push("is-today");

      html += `<div class="day-cell"><div class="${classes.join(" ")}">${day}</div></div>`;
    }

    this.#daysGrid.innerHTML = html;
  }

  /**
   * Build a Set of date keys ("YYYY-MM-DD") for sessions in the given month.
   * Uses the `startedAt` ISO string from each session record.
   */
  #getSessionDays(year: number, month: number): Set<string> {
    const sessions: SessionRecord[] = appStore.getState().sessions;
    const days = new Set<string>();

    for (const session of sessions) {
      const d = new Date(session.startedAt);
      if (d.getFullYear() === year && d.getMonth() === month) {
        const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        days.add(key);
      }
    }

    return days;
  }
}

customElements.define("consistency-calendar", ConsistencyCalendar);
