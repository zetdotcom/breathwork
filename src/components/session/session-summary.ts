import { appStore } from "../../core/store.ts";
import { sessionEngine } from "../../core/breathing-engine.ts";
import { formatMMSScs, formatMMSS } from "../../utils/time.ts";
import "../shared/session-header.ts";

/**
 * Session summary screen (minimal MVP version).
 *
 * Displayed after the user finishes a session (phase === "summary").
 * Shows:
 *   - Total session time
 *   - Number of rounds completed
 *   - Best retention time
 *   - Per-round retention list
 *   - "Finish" button (return to idle)
 *   - "Start Another Round" button (loop back to breathing)
 */

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
      user-select: none;
      -webkit-user-select: none;
    }

    .body {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24px 20px 32px;
      gap: 24px;
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
      box-sizing: border-box;
    }

    /* ── Summary icon ── */
    .check-circle {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      border: 3px solid var(--color-primary, #137fec);
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: var(--glow-primary, 0 0 40px -10px rgba(19, 127, 236, 0.4));
      flex-shrink: 0;
    }

    .check-icon {
      font-family: "Material Symbols Outlined";
      font-size: 40px;
      font-variation-settings: "FILL" 1, "wght" 400, "GRAD" 0, "opsz" 48;
      color: var(--color-primary, #137fec);
      line-height: 1;
    }

    /* ── Heading ── */
    .heading {
      text-align: center;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .heading h1 {
      font-size: 26px;
      font-weight: 700;
      letter-spacing: -0.025em;
      margin: 0;
    }

    .heading p {
      font-size: 14px;
      color: var(--color-text-muted, #94a3b8);
      margin: 0;
    }

    /* ── Stats grid ── */
    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(96px, 1fr));
      gap: 12px;
      width: 100%;
      max-width: 360px;
      box-sizing: border-box;
    }

    .stat {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      min-width: 0;
      background: var(--color-surface-dark, #1e293b);
      border: 1px solid var(--color-border-dark, #334155);
      border-radius: var(--radius-md, 0.75rem);
      padding: 16px;
      box-sizing: border-box;
      text-align: center;
    }

    .stat-value {
      font-size: 24px;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      letter-spacing: -0.02em;
      color: var(--color-text, #f1f5f9);
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .stat-label {
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--color-text-muted, #94a3b8);
    }

    /* ── Round list ── */
    .round-list {
      width: 100%;
      max-width: 320px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .round-list-title {
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--color-text-muted, #94a3b8);
      margin-bottom: 4px;
    }

    .round-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 10px 14px;
      background: var(--color-surface-dark, #1e293b);
      border: 1px solid var(--color-border-dark, #334155);
      border-radius: var(--radius-sm, 0.5rem);
      box-sizing: border-box;
      overflow: hidden;
    }

    .round-label {
      font-size: 14px;
      font-weight: 500;
      color: var(--color-text, #f1f5f9);
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .round-time {
      font-size: 14px;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
      color: var(--color-primary, #137fec);
      flex-shrink: 0;
      white-space: nowrap;
    }

    /* ── Action buttons ── */
    .actions {
      width: 100%;
      max-width: 320px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      flex-shrink: 0;
    }

    .btn {
      width: 100%;
      height: 52px;
      border: none;
      border-radius: var(--radius-md, 0.75rem);
      font-size: 15px;
      font-weight: 700;
      font-family: var(--font-family, "Inter", system-ui, sans-serif);
      letter-spacing: 0.04em;
      text-transform: uppercase;
      cursor: pointer;
      transition: background 200ms ease, transform 100ms ease;
      -webkit-tap-highlight-color: transparent;
    }

    .btn:active {
      transform: scale(0.97);
    }

    .btn-primary {
      background: var(--color-primary, #137fec);
      color: #fff;
      box-shadow: 0 4px 20px -4px rgba(19, 127, 236, 0.35);
    }

    .btn-primary:hover {
      background: var(--color-primary-hover, #1a8ff8);
    }

    .btn-secondary {
      background: transparent;
      color: var(--color-text-muted, #94a3b8);
      border: 1px solid var(--color-border-dark, #334155);
    }

    .btn-secondary:hover {
      background: rgba(255, 255, 255, 0.04);
      color: var(--color-text, #f1f5f9);
    }
  </style>

  <session-header></session-header>

  <div class="body">
    <div class="check-circle">
      <span class="check-icon" aria-hidden="true">check</span>
    </div>

    <div class="heading">
      <h1>Session Complete</h1>
      <p id="heading-subtitle">Well done!</p>
    </div>

    <div class="stats">
      <div class="stat">
        <span class="stat-value" id="stat-time">00:00</span>
        <span class="stat-label">Total Time</span>
      </div>
      <div class="stat">
        <span class="stat-value" id="stat-rounds">0</span>
        <span class="stat-label">Rounds</span>
      </div>
      <div class="stat">
        <span class="stat-value" id="stat-best">00:00.00</span>
        <span class="stat-label">Best Hold</span>
      </div>
    </div>

    <div class="round-list" id="round-list">
      <div class="round-list-title">Round Details</div>
    </div>

    <div class="actions">
      <button class="btn btn-secondary" id="another-round-btn">Start Another Round</button>
      <button class="btn btn-primary" id="finish-btn">Finish</button>
    </div>
  </div>
`;

export class SessionSummary extends HTMLElement {
  #root: ShadowRoot;
  #statTime: HTMLElement | null = null;
  #statRounds: HTMLElement | null = null;
  #statBest: HTMLElement | null = null;
  #roundList: HTMLElement | null = null;
  #finishBtn: HTMLButtonElement | null = null;
  #anotherRoundBtn: HTMLButtonElement | null = null;

  constructor() {
    super();
    this.#root = this.attachShadow({ mode: "open" });
    this.#root.appendChild(TEMPLATE.content.cloneNode(true));

    this.#statTime = this.#root.getElementById("stat-time");
    this.#statRounds = this.#root.getElementById("stat-rounds");
    this.#statBest = this.#root.getElementById("stat-best");
    this.#roundList = this.#root.getElementById("round-list");
    this.#finishBtn = this.#root.getElementById(
      "finish-btn",
    ) as HTMLButtonElement | null;
    this.#anotherRoundBtn = this.#root.getElementById(
      "another-round-btn",
    ) as HTMLButtonElement | null;
  }

  connectedCallback() {
    this.#finishBtn?.addEventListener("click", this.#handleFinish);
    this.#anotherRoundBtn?.addEventListener("click", this.#handleAnotherRound);

    this.#renderStats();
  }

  disconnectedCallback() {
    this.#finishBtn?.removeEventListener("click", this.#handleFinish);
    this.#anotherRoundBtn?.removeEventListener(
      "click",
      this.#handleAnotherRound,
    );
  }

  #renderStats() {
    const state = appStore.getState();
    const rounds = state.rounds;

    // Total session time
    if (this.#statTime && state.sessionStartedAt) {
      const startMs = new Date(state.sessionStartedAt).getTime();
      const totalMs = Date.now() - startMs;
      this.#statTime.textContent = formatMMSS(totalMs);
    }

    // Rounds count
    if (this.#statRounds) {
      this.#statRounds.textContent = String(rounds.length);
    }

    // Best retention
    const bestMs = rounds.reduce((max, r) => Math.max(max, r.retentionMs), 0);
    if (this.#statBest) {
      this.#statBest.textContent = formatMMSScs(bestMs);
    }

    // Round details list
    if (this.#roundList) {
      // Keep the title, clear the rest
      const title = this.#roundList.querySelector(".round-list-title");
      this.#roundList.innerHTML = "";
      if (title) this.#roundList.appendChild(title);

      if (rounds.length === 0) {
        const empty = document.createElement("div");
        empty.className = "round-row";
        empty.innerHTML = `<span class="round-label">No rounds completed</span>`;
        this.#roundList.appendChild(empty);
      } else {
        for (let i = 0; i < rounds.length; i++) {
          const round = rounds[i];
          if (!round) continue;
          const row = document.createElement("div");
          row.className = "round-row";
          row.innerHTML = `
            <span class="round-label">Round ${i + 1}</span>
            <span class="round-time">${formatMMSScs(round.retentionMs)}</span>
          `;
          this.#roundList.appendChild(row);
        }
      }
    }
  }

  #handleFinish = () => {
    sessionEngine.finishSession();
  };

  #handleAnotherRound = () => {
    sessionEngine.startNextRound();
  };
}

customElements.define("session-summary", SessionSummary);
