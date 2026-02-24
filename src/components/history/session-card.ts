import type { SessionRecord } from "../../core/app-state.ts";
import { formatMinSec, formatShortDate } from "../../utils/time.ts";

/**
 * Session card component for the history list.
 *
 * Displays a single session record as a rounded card with:
 *   - Left: rotating Material Symbols icon in a circular badge
 *   - Center: date (e.g. "Oct 24") + "3 Rounds • 2:15 max"
 *   - Right: chevron_right icon
 *
 * Usage:
 *   const card = document.createElement("session-card");
 *   card.session = mySessionRecord;
 *   card.iconName = "timer";       // optional, defaults to rotating set
 */

/** Icons that rotate across session cards for visual variety. */
const SESSION_ICONS = ["timer", "air", "self_improvement", "spa"];

const TEMPLATE = document.createElement("template");
TEMPLATE.innerHTML = `
  <style>
    :host {
      display: block;
    }

    .card {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 16px;
      background: var(--color-surface-dark, #1e293b);
      border: 1px solid var(--color-border-dark, #334155);
      border-radius: var(--radius-lg, 1rem);
      cursor: pointer;
      transition: border-color 200ms ease;
      -webkit-tap-highlight-color: transparent;
    }

    .card:hover {
      border-color: rgba(19, 127, 236, 0.5);
    }

    .card:active {
      opacity: 0.85;
    }

    .left {
      display: flex;
      align-items: center;
      gap: 14px;
      min-width: 0;
    }

    .icon-badge {
      width: 44px;
      height: 44px;
      flex-shrink: 0;
      border-radius: 50%;
      background: var(--color-primary-muted, rgba(19, 127, 236, 0.2));
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 200ms ease, color 200ms ease;
    }

    .card:hover .icon-badge {
      background: var(--color-primary, #137fec);
    }

    .icon-badge .icon {
      font-family: "Material Symbols Outlined";
      font-size: 22px;
      font-variation-settings: "FILL" 0, "wght" 300, "GRAD" 0, "opsz" 24;
      color: var(--color-primary, #137fec);
      line-height: 1;
      transition: color 200ms ease;
    }

    .card:hover .icon-badge .icon {
      color: #fff;
    }

    .info {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }

    .date {
      font-size: 15px;
      font-weight: 600;
      color: var(--color-text, #f1f5f9);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .details {
      font-size: 13px;
      color: var(--color-text-muted, #94a3b8);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .details .max-time {
      color: var(--color-primary, #137fec);
      font-weight: 500;
    }

    .chevron {
      font-family: "Material Symbols Outlined";
      font-size: 20px;
      font-variation-settings: "FILL" 0, "wght" 300, "GRAD" 0, "opsz" 24;
      color: var(--color-text-dim, #64748b);
      flex-shrink: 0;
      line-height: 1;
      transition: color 200ms ease;
    }

    .card:hover .chevron {
      color: var(--color-primary, #137fec);
    }
  </style>

  <div class="card" role="button" tabindex="0" aria-label="View session details">
    <div class="left">
      <div class="icon-badge">
        <span class="icon" id="session-icon" aria-hidden="true">timer</span>
      </div>
      <div class="info">
        <div class="date" id="session-date">—</div>
        <div class="details" id="session-details">—</div>
      </div>
    </div>
    <span class="chevron" aria-hidden="true">chevron_right</span>
  </div>
`;

export class SessionCard extends HTMLElement {
  #root: ShadowRoot;
  #session: SessionRecord | null = null;
  #iconName: string | null = null;
  #iconEl: HTMLElement | null = null;
  #dateEl: HTMLElement | null = null;
  #detailsEl: HTMLElement | null = null;
  #card: HTMLElement | null = null;

  constructor() {
    super();
    this.#root = this.attachShadow({ mode: "open" });
    this.#root.appendChild(TEMPLATE.content.cloneNode(true));

    this.#iconEl = this.#root.getElementById("session-icon");
    this.#dateEl = this.#root.getElementById("session-date");
    this.#detailsEl = this.#root.getElementById("session-details");
    this.#card = this.#root.querySelector(".card");
  }

  connectedCallback() {
    this.#card?.addEventListener("keydown", this.#handleKeydown);
  }

  disconnectedCallback() {
    this.#card?.removeEventListener("keydown", this.#handleKeydown);
  }

  #handleKeydown = (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      this.#card?.click();
    }
  };

  /** The session record to render. Triggers a re-render. */
  set session(record: SessionRecord) {
    this.#session = record;
    this.#render();
  }

  get session(): SessionRecord | null {
    return this.#session;
  }

  /** Override the icon name (from SESSION_ICONS rotation). */
  set iconName(name: string) {
    this.#iconName = name;
    if (this.#iconEl) {
      this.#iconEl.textContent = name;
    }
  }

  /** Numeric index used to pick a rotating icon when no explicit iconName is set. */
  set index(i: number) {
    if (!this.#iconName) {
      const icon = SESSION_ICONS[i % SESSION_ICONS.length] ?? "timer";
      if (this.#iconEl) {
        this.#iconEl.textContent = icon;
      }
    }
  }

  #render() {
    if (!this.#session) return;

    const session = this.#session;
    const dateLabel = formatShortDate(session.startedAt);
    const roundCount = session.rounds.length;
    const bestMs = session.rounds.reduce(
      (max, r) => Math.max(max, r.retentionMs),
      0,
    );
    const roundLabel = roundCount === 1 ? "Round" : "Rounds";
    const bestLabel = formatMinSec(bestMs);

    // Date
    if (this.#dateEl) {
      this.#dateEl.textContent = dateLabel;
    }

    // Details: "3 Rounds • 2:15 max"
    if (this.#detailsEl) {
      this.#detailsEl.innerHTML =
        `${roundCount} ${roundLabel} &bull; <span class="max-time">${bestLabel} max</span>`;
    }

    this.#card?.setAttribute(
      "aria-label",
      `${dateLabel} • ${roundCount} ${roundLabel} • ${bestLabel} max`,
    );
  }
}

customElements.define("session-card", SessionCard);
