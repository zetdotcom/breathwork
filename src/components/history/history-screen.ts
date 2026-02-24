import { appStore } from "../../core/store.ts";
import type { SessionRecord } from "../../core/app-state.ts";
import "./consistency-calendar.ts";
import "./retention-chart.ts";
import "./session-card.ts";

/**
 * History & Insights screen — the Stats tab root.
 *
 * Assembles three sections vertically:
 *   1. Consistency Calendar (monthly grid with session highlights)
 *   2. Retention Trends Chart (bar chart of last 7 days)
 *   3. Recent Sessions List (session-card components)
 *
 * Handles empty and loading states gracefully: shows a friendly message when
 * no sessions have been recorded yet, and a loading state while data hydrates.
 *
 * Reads session data from the global store and subscribes to changes
 * so the list updates in real time (e.g. after completing a session).
 *
 * Usage:
 *   <history-screen></history-screen>
 */

/** Maximum number of recent sessions to display before "View All". */
const RECENT_LIMIT = 10;

const TEMPLATE = document.createElement("template");
TEMPLATE.innerHTML = `
  <style>
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      width: 100%;
      background: var(--color-bg-dark, #101922);
      color: var(--color-text, #f1f5f9);
      font-family: var(--font-family, "Inter", system-ui, sans-serif);
      overflow: hidden;
    }

    /* ── Header ── */
    .screen-header {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 14px 16px;
      border-bottom: 1px solid var(--color-border-dark, #334155);
      flex-shrink: 0;
      position: sticky;
      top: 0;
      z-index: 10;
      background: rgba(16, 25, 34, 0.95);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
    }

    .screen-header h1 {
      font-size: 18px;
      font-weight: 700;
      letter-spacing: -0.02em;
      margin: 0;
      color: var(--color-text, #f1f5f9);
    }

    /* ── Scrollable body ── */
    .body {
      flex: 1;
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
      padding-bottom: 24px;
    }

    /* ── Sections ── */
    .section {
      padding: 24px 16px 0;
    }

    .section + .section {
      padding-top: 28px;
    }

    /* ── Recent Sessions heading ── */
    .section-title {
      font-size: 22px;
      font-weight: 700;
      letter-spacing: -0.025em;
      color: var(--color-text, #f1f5f9);
      margin: 0 0 16px 0;
    }

    /* ── Session list ── */
    .session-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    /* ── View All link ── */
    .view-all {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px 0 8px;
    }

    .view-all button {
      background: none;
      border: none;
      cursor: pointer;
      font-family: var(--font-family, "Inter", system-ui, sans-serif);
      font-size: 13px;
      font-weight: 500;
      color: var(--color-text-dim, #64748b);
      transition: color 200ms ease;
      -webkit-tap-highlight-color: transparent;
    }

    .view-all button:hover {
      color: var(--color-text, #f1f5f9);
    }

    /* ── Empty state ── */
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 16px;
      padding: 64px 24px;
      text-align: center;
    }

    .empty-icon {
      font-family: "Material Symbols Outlined";
      font-size: 56px;
      font-variation-settings: "FILL" 0, "wght" 200, "GRAD" 0, "opsz" 48;
      color: var(--color-text-dim, #64748b);
      line-height: 1;
    }

    .empty-title {
      font-size: 20px;
      font-weight: 600;
      color: var(--color-text-muted, #94a3b8);
      margin: 0;
    }

    .empty-subtitle {
      font-size: 14px;
      color: var(--color-text-dim, #64748b);
      margin: 0;
      max-width: 260px;
      line-height: 1.5;
    }
  </style>

  <div class="screen-header">
    <h1>History & Insights</h1>
  </div>

  <div class="body" id="body">
    <!-- Populated dynamically -->
  </div>
`;

export class HistoryScreen extends HTMLElement {
  #root: ShadowRoot;
  #bodyEl: HTMLElement | null = null;
  #unsubscribe: (() => void) | null = null;

  /** Track session count so we only re-render when it changes. */
  #renderedSessionCount = -1;

  constructor() {
    super();
    this.#root = this.attachShadow({ mode: "open" });
    this.#root.appendChild(TEMPLATE.content.cloneNode(true));
    this.#bodyEl = this.#root.getElementById("body");
  }

  connectedCallback() {
    // Subscribe to session + hydration changes
    this.#unsubscribe = appStore.select(
      (s) => `${s.hydrated}-${s.sessions.length}`,
      () => this.#render(),
    );

    // Initial render
    this.#render();
  }

  disconnectedCallback() {
    this.#unsubscribe?.();
    this.#unsubscribe = null;
    this.#renderedSessionCount = -1;
  }

  #render() {
    if (!this.#bodyEl) return;

    const sessions: SessionRecord[] = appStore.getState().sessions;

    if (!appStore.getState().hydrated) {
      this.#renderLoading();
      return;
    }

    // Avoid unnecessary full re-renders for the same session count.
    // Sub-components (calendar, chart) have their own store subscriptions.
    if (sessions.length === this.#renderedSessionCount) return;
    this.#renderedSessionCount = sessions.length;

    if (sessions.length === 0) {
      this.#renderEmpty();
      return;
    }

    this.#renderFull(sessions);
  }

  #renderEmpty() {
    if (!this.#bodyEl) return;
    this.#bodyEl.innerHTML = "";

    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.innerHTML = `
      <span class="empty-icon" aria-hidden="true">bar_chart</span>
      <h2 class="empty-title">No Sessions Yet</h2>
      <p class="empty-subtitle">Complete your first breathwork session to see your history and insights here.</p>
    `;
    this.#bodyEl.appendChild(empty);
  }

  #renderLoading() {
    if (!this.#bodyEl) return;
    this.#bodyEl.innerHTML = "";

    const loading = document.createElement("div");
    loading.className = "empty-state";
    loading.innerHTML = `
      <span class="empty-icon" aria-hidden="true">hourglass_empty</span>
      <h2 class="empty-title">Loading History</h2>
      <p class="empty-subtitle">Fetching your sessions…</p>
    `;
    this.#bodyEl.appendChild(loading);
  }

  #renderFull(sessions: SessionRecord[]) {
    if (!this.#bodyEl) return;
    this.#bodyEl.innerHTML = "";

    // 1. Consistency Calendar
    const calSection = document.createElement("div");
    calSection.className = "section";
    const calendar = document.createElement("consistency-calendar");
    calSection.appendChild(calendar);
    this.#bodyEl.appendChild(calSection);

    // 2. Retention Trends Chart
    const chartSection = document.createElement("div");
    chartSection.className = "section";
    const chart = document.createElement("retention-chart");
    chartSection.appendChild(chart);
    this.#bodyEl.appendChild(chartSection);

    // 3. Recent Sessions
    const listSection = document.createElement("div");
    listSection.className = "section";

    const title = document.createElement("h2");
    title.className = "section-title";
    title.textContent = "Recent Sessions";
    listSection.appendChild(title);

    const list = document.createElement("div");
    list.className = "session-list";

    // Sort sessions by startedAt descending (most recent first).
    // The store already orders them this way, but be defensive.
    const sorted = [...sessions].sort(
      (a, b) =>
        new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
    );

    const displaySessions = sorted.slice(0, RECENT_LIMIT);

    for (let i = 0; i < displaySessions.length; i++) {
      const session = displaySessions[i];
      if (!session) continue;

      const card = document.createElement("session-card") as InstanceType<
        typeof import("./session-card.ts").SessionCard
      >;
      card.session = session;
      card.index = i;
      list.appendChild(card);
    }

    listSection.appendChild(list);

    // "View All History" link (placeholder for future pagination)
    if (sorted.length > RECENT_LIMIT) {
      const viewAll = document.createElement("div");
      viewAll.className = "view-all";
      viewAll.innerHTML = `<button>View All History</button>`;
      listSection.appendChild(viewAll);
    }

    this.#bodyEl.appendChild(listSection);
  }
}

customElements.define("history-screen", HistoryScreen);
