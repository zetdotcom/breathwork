import { appStore } from "../../core/store.ts";
import type { SessionRecord } from "../../core/app-state.ts";
import { formatMinSec } from "../../utils/time.ts";

/**
 * Retention Trends chart — bar chart showing best retention per day
 * for the last 7 days.
 *
 * Matches the stitch design: vertical bars with day-of-week labels
 * (M T W T F S S), dotted baseline decorations, and a "Last 7 Days"
 * label in the header. The tallest bar is fully opaque primary color;
 * shorter bars use a translucent primary.
 *
 * Reads session data from the global store and subscribes to changes.
 *
 * Usage:
 *   <retention-chart></retention-chart>
 */

const SHORT_DAYS = ["S", "M", "T", "W", "T", "F", "S"];

const TEMPLATE = document.createElement("template");
TEMPLATE.innerHTML = `
  <style>
    :host {
      display: block;
    }

    /* ── Header row ── */
    .header {
      display: flex;
      align-items: flex-end;
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

    .header .period {
      font-size: 13px;
      font-weight: 600;
      color: var(--color-primary, #137fec);
    }

    /* ── Chart container ── */
    .chart-container {
      background: var(--color-surface-dark, #1e293b);
      border: 1px solid var(--color-border-dark, #334155);
      border-radius: var(--radius-lg, 1rem);
      padding: 24px 20px 16px;
      position: relative;
      overflow: hidden;
    }

    /* Dotted baseline decorations */
    .chart-container::before,
    .chart-container::after {
      content: "";
      position: absolute;
      left: 20px;
      right: 20px;
      border-top: 1px dashed rgba(100, 116, 139, 0.25);
      pointer-events: none;
    }

    .chart-container::before {
      top: 33%;
    }

    .chart-container::after {
      top: 55%;
    }

    /* ── Bar row ── */
    .bars {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      height: 120px;
      gap: 6px;
      position: relative;
      z-index: 1;
    }

    .bar-group {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      flex: 1;
      height: 100%;
    }

    .bar-track {
      width: 100%;
      flex: 1;
      background: rgba(100, 116, 139, 0.12);
      border-radius: 6px 6px 0 0;
      display: flex;
      align-items: flex-end;
      justify-content: center;
      overflow: hidden;
      position: relative;
    }

    .bar-fill {
      width: 100%;
      border-radius: 6px 6px 0 0;
      background: var(--color-primary-muted, rgba(19, 127, 236, 0.2));
      transition: height 400ms ease;
      min-height: 0;
      position: relative;
    }

    .bar-fill.is-max {
      background: var(--color-primary, #137fec);
    }

    .bar-fill.is-max::after {
      /* No tooltip in static render, but style hook for future */
    }

    .bar-fill.is-empty {
      background: transparent;
    }

    .day-label {
      font-size: 10px;
      font-weight: 700;
      color: var(--color-text-dim, #64748b);
      text-transform: uppercase;
      line-height: 1;
      flex-shrink: 0;
    }

    .day-label.is-today {
      color: var(--color-text, #f1f5f9);
    }

    /* ── Tooltip ── */
    .tooltip {
      position: absolute;
      top: -28px;
      left: 50%;
      transform: translateX(-50%);
      background: var(--color-text, #f1f5f9);
      color: var(--color-bg-dark, #101922);
      font-size: 10px;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: var(--radius-full, 9999px);
      white-space: nowrap;
      pointer-events: none;
      opacity: 0;
      transition: opacity 200ms ease;
    }

    .bar-group:hover .tooltip {
      opacity: 1;
    }

    /* ── Empty state ── */
    .empty-state {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 120px;
      color: var(--color-text-dim, #64748b);
      font-size: 14px;
    }
  </style>

  <div class="section">
    <div class="header">
      <h2>Retention Trends</h2>
      <span class="period">Last 7 Days</span>
    </div>
    <div class="chart-container">
      <div class="bars" id="bars"></div>
    </div>
  </div>
`;

export class RetentionChart extends HTMLElement {
  #root: ShadowRoot;
  #barsEl: HTMLElement | null = null;
  #unsubscribe: (() => void) | null = null;

  constructor() {
    super();
    this.#root = this.attachShadow({ mode: "open" });
    this.#root.appendChild(TEMPLATE.content.cloneNode(true));
    this.#barsEl = this.#root.getElementById("bars");
  }

  connectedCallback() {
    // Subscribe to session changes
    this.#unsubscribe = appStore.select(
      (s) => s.sessions,
      () => this.#render(),
    );

    // Initial render
    this.#render();
  }

  disconnectedCallback() {
    this.#unsubscribe?.();
    this.#unsubscribe = null;
  }

  #render() {
    if (!this.#barsEl) return;

    const sessions: SessionRecord[] = appStore.getState().sessions;
    const data = this.#getLast7DaysData(sessions);

    // Find max for scaling
    const maxMs = data.reduce((m, d) => Math.max(m, d.bestRetentionMs), 0);

    if (maxMs === 0) {
      // Empty state — no sessions in the last 7 days
      this.#barsEl.innerHTML = `
        <div class="empty-state" style="width:100%">No sessions in the last 7 days</div>
      `;
      return;
    }

    const today = new Date();
    const todayDow = today.getDay(); // 0=Sun

    let html = "";

    for (let i = 0; i < data.length; i++) {
      const entry = data[i];
      if (!entry) continue;
      const heightPct =
        maxMs > 0 ? Math.round((entry.bestRetentionMs / maxMs) * 100) : 0;
      const isMax = entry.bestRetentionMs === maxMs && maxMs > 0;
      const isEmpty = entry.bestRetentionMs === 0;
      const isToday = entry.dayOfWeek === todayDow;

      const fillClasses = ["bar-fill"];
      if (isMax) fillClasses.push("is-max");
      if (isEmpty) fillClasses.push("is-empty");

      const dayLabelClasses = ["day-label"];
      if (isToday) dayLabelClasses.push("is-today");

      const tooltipHtml =
        entry.bestRetentionMs > 0
          ? `<div class="tooltip">${formatMinSec(entry.bestRetentionMs)}</div>`
          : "";

      html += `
        <div class="bar-group">
          <div class="bar-track">
            <div class="${fillClasses.join(" ")}" style="height: ${isEmpty ? 0 : Math.max(heightPct, 4)}%">
              ${tooltipHtml}
            </div>
          </div>
          <span class="${dayLabelClasses.join(" ")}">${SHORT_DAYS[entry.dayOfWeek] ?? ""}</span>
        </div>
      `;
    }

    this.#barsEl.innerHTML = html;
  }

  /**
   * Compute the best retention time per day for the last 7 days.
   * Returns an array of 7 entries ordered from oldest to newest (left to right).
   */
  #getLast7DaysData(
    sessions: SessionRecord[],
  ): { date: string; dayOfWeek: number; bestRetentionMs: number }[] {
    const result: {
      date: string;
      dayOfWeek: number;
      bestRetentionMs: number;
    }[] = [];

    const now = new Date();

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

      // Find best retention for this day
      let bestMs = 0;
      for (const session of sessions) {
        const sd = new Date(session.startedAt);
        const sessionKey = `${sd.getFullYear()}-${String(sd.getMonth() + 1).padStart(2, "0")}-${String(sd.getDate()).padStart(2, "0")}`;
        if (sessionKey === dateKey) {
          const sessionBest = session.rounds.reduce(
            (max, r) => Math.max(max, r.retentionMs),
            0,
          );
          bestMs = Math.max(bestMs, sessionBest);
        }
      }

      result.push({
        date: dateKey,
        dayOfWeek: d.getDay(),
        bestRetentionMs: bestMs,
      });
    }

    return result;
  }
}

customElements.define("retention-chart", RetentionChart);
