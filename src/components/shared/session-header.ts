import { appStore } from "../../core/store.ts";
import { sessionEngine } from "../../core/breathing-engine.ts";

/**
 * Session header bar shown at the top of session overlay screens.
 *
 * Layout: [X close] — [● POWER BREATHING] — [⚙ settings]
 *
 * - X button: aborts the session (returns to idle)
 * - Center: title with green status dot
 * - Gear icon: placeholder for quick-access settings (disabled during MVP)
 *
 * Ref: top bar in `stitch/power_breathing_session/screen.png`
 */

const TEMPLATE = document.createElement("template");
TEMPLATE.innerHTML = `
  <style>
    :host {
      display: block;
      width: 100%;
      padding: 12px 16px 8px;
      padding-top: calc(12px + var(--safe-top, 0px));
      background: var(--color-bg-dark, #101922);
      z-index: 10;
    }

    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      max-width: 480px;
      margin: 0 auto;
      height: 40px;
    }

    button {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: none;
      border: none;
      cursor: pointer;
      color: var(--color-text, #f1f5f9);
      transition: background 200ms ease;
      -webkit-tap-highlight-color: transparent;
      font-family: "Material Symbols Outlined";
      font-size: 24px;
      line-height: 1;
      font-weight: normal;
      font-style: normal;
      letter-spacing: normal;
      text-transform: none;
      white-space: nowrap;
      word-wrap: normal;
      direction: ltr;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      text-rendering: optimizeLegibility;
      font-feature-settings: "liga";
      font-variation-settings: "FILL" 0, "wght" 300, "GRAD" 0, "opsz" 24;
    }

    button:hover {
      background: rgba(255, 255, 255, 0.06);
    }

    button:active {
      opacity: 0.7;
    }

    .title-group {
      display: flex;
      align-items: center;
      gap: 8px;
      background: var(--color-surface-dark, #1e293b);
      border: 1px solid var(--color-border-dark, #334155);
      border-radius: var(--radius-full, 9999px);
      padding: 6px 16px;
    }

    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--color-success, #22c55e);
      flex-shrink: 0;
    }

    .title-text {
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--color-text, #f1f5f9);
      white-space: nowrap;
    }

    .gear-btn {
      opacity: 0.4;
      pointer-events: none;
    }
  </style>

  <header>
    <button id="close-btn" aria-label="Close session">close</button>

    <div class="title-group">
      <span class="status-dot" aria-hidden="true"></span>
      <span class="title-text" id="title-text">POWER BREATHING</span>
    </div>

    <button class="gear-btn" id="gear-btn" aria-label="Settings" tabindex="-1">settings</button>
  </header>
`;

export class SessionHeader extends HTMLElement {
  #root: ShadowRoot;
  #closeBtn: HTMLButtonElement | null = null;
  #titleText: HTMLElement | null = null;
  #unsubscribe: (() => void) | null = null;

  constructor() {
    super();
    this.#root = this.attachShadow({ mode: "open" });
    this.#root.appendChild(TEMPLATE.content.cloneNode(true));

    this.#closeBtn = this.#root.getElementById("close-btn") as HTMLButtonElement | null;
    this.#titleText = this.#root.getElementById("title-text");
  }

  connectedCallback() {
    this.#closeBtn?.addEventListener("click", this.#handleClose);

    // Update title based on current phase
    this.#unsubscribe = appStore.select(
      (s) => s.phase,
      (phase) => this.#updateTitle(phase),
    );
    this.#updateTitle(appStore.getState().phase);
  }

  disconnectedCallback() {
    this.#closeBtn?.removeEventListener("click", this.#handleClose);
    this.#unsubscribe?.();
    this.#unsubscribe = null;
  }

  #handleClose = () => {
    sessionEngine.stopSession();
  };

  #updateTitle(phase: string) {
    if (!this.#titleText) return;

    const titles: Record<string, string> = {
      prepare: "GET READY",
      breathing: "POWER BREATHING",
      retention: "BREATH HOLD",
      recovery: "RECOVERY",
      summary: "SESSION COMPLETE",
    };

    this.#titleText.textContent = titles[phase] ?? "POWER BREATHING";
  }
}

customElements.define("session-header", SessionHeader);
