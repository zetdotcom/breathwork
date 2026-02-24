import { appStore } from "../../core/store.ts";
import { sessionEngine } from "../../core/breathing-engine.ts";
import { formatCountdownSeconds } from "../../utils/time.ts";
import "../shared/session-header.ts";

/**
 * Round-break screen.
 *
 * Displayed after recovery completes, giving the user 10 seconds
 * to prepare before the next round starts automatically.
 *
 * - 10s countdown in a large circle.
 * - "Skip" button to start the next round immediately.
 * - "Finish Session" button to go to the summary screen.
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
      padding: 24px;
      gap: 40px;
    }

    /* ── Countdown circle ── */
    .circle-area {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .glow {
      position: absolute;
      width: 150%;
      height: 150%;
      border-radius: 50%;
      background: radial-gradient(
        circle,
        rgba(19, 127, 236, 0.06) 0%,
        transparent 70%
      );
      pointer-events: none;
    }

    .countdown-circle {
      position: relative;
      width: min(240px, 60vw);
      aspect-ratio: 1;
      border-radius: 50%;
      border: 2px solid var(--color-border-dark, #334155);
      background: var(--color-bg-dark, #101922);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 4px;
      box-shadow: var(--glow-primary, 0 0 40px -10px rgba(19, 127, 236, 0.4));
    }

    /* Inner decorative ring */
    .countdown-circle::before {
      content: "";
      position: absolute;
      inset: 8px;
      border-radius: 50%;
      border: 1px solid rgba(19, 127, 236, 0.12);
      pointer-events: none;
    }

    .countdown-value {
      font-size: clamp(56px, 16vw, 80px);
      font-weight: 700;
      letter-spacing: -0.03em;
      font-variant-numeric: tabular-nums;
      color: var(--color-text, #f1f5f9);
      line-height: 1;
    }

    /* ── Instructional text ── */
    .info {
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
    }

    .info h1 {
      font-size: 28px;
      font-weight: 700;
      letter-spacing: -0.025em;
      margin: 0;
      color: var(--color-text, #f1f5f9);
    }

    .info p {
      font-size: 15px;
      line-height: 1.5;
      color: var(--color-text-muted, #94a3b8);
      max-width: 280px;
      margin: 0;
    }

    /* ── Action buttons ── */
    .actions {
      width: 100%;
      max-width: 320px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .btn {
      width: 100%;
      height: 48px;
      border: none;
      border-radius: var(--radius-md, 0.75rem);
      font-size: 14px;
      font-weight: 600;
      font-family: var(--font-family, "Inter", system-ui, sans-serif);
      letter-spacing: 0.04em;
      text-transform: uppercase;
      cursor: pointer;
      transition: background 200ms ease, color 200ms ease, border-color 200ms ease, transform 100ms ease;
      -webkit-tap-highlight-color: transparent;
    }

    .btn:active {
      transform: scale(0.97);
    }

    .skip-btn {
      background: var(--color-primary, #137fec);
      color: #fff;
      box-shadow: 0 4px 20px -4px rgba(19, 127, 236, 0.35);
    }

    .skip-btn:hover {
      background: var(--color-primary-hover, #1a8ff8);
    }

    .finish-btn {
      background: transparent;
      color: var(--color-text-muted, #94a3b8);
      border: 1px solid var(--color-border-dark, #334155);
    }

    .finish-btn:hover {
      background: rgba(255, 255, 255, 0.04);
      color: var(--color-text, #f1f5f9);
      border-color: var(--color-text-muted, #94a3b8);
    }
  </style>

  <session-header></session-header>

  <div class="body">
    <div class="circle-area">
      <div class="glow"></div>
      <div class="countdown-circle">
        <span class="countdown-value" id="countdown-value">10</span>
      </div>
    </div>

    <div class="info">
      <h1>Next Round</h1>
      <p>Get ready for the next round, or tap Skip to begin now.</p>
    </div>

    <div class="actions">
      <button class="btn skip-btn" id="skip-btn">Skip</button>
      <button class="btn finish-btn" id="finish-btn">Finish Session</button>
    </div>
  </div>
`;

export class RoundBreakScreen extends HTMLElement {
  #root: ShadowRoot;
  #countdownValue: HTMLElement | null = null;
  #skipBtn: HTMLButtonElement | null = null;
  #finishBtn: HTMLButtonElement | null = null;
  #unsubscribe: (() => void) | null = null;

  constructor() {
    super();
    this.#root = this.attachShadow({ mode: "open" });
    this.#root.appendChild(TEMPLATE.content.cloneNode(true));

    this.#countdownValue = this.#root.getElementById("countdown-value");
    this.#skipBtn = this.#root.getElementById(
      "skip-btn",
    ) as HTMLButtonElement | null;
    this.#finishBtn = this.#root.getElementById(
      "finish-btn",
    ) as HTMLButtonElement | null;
  }

  connectedCallback() {
    this.#unsubscribe = appStore.select(
      (s) => s.roundBreakRemainingMs,
      (remaining) => this.#updateCountdown(remaining),
    );

    this.#skipBtn?.addEventListener("click", this.#handleSkip);
    this.#finishBtn?.addEventListener("click", this.#handleFinish);

    // Set initial value
    this.#updateCountdown(appStore.getState().roundBreakRemainingMs);
  }

  disconnectedCallback() {
    this.#skipBtn?.removeEventListener("click", this.#handleSkip);
    this.#finishBtn?.removeEventListener("click", this.#handleFinish);
    this.#unsubscribe?.();
    this.#unsubscribe = null;
  }

  #updateCountdown(remainingMs: number) {
    if (this.#countdownValue) {
      this.#countdownValue.textContent = formatCountdownSeconds(remainingMs);
    }
  }

  #handleSkip = () => {
    sessionEngine.skipRoundBreak();
  };

  #handleFinish = () => {
    sessionEngine.finishSession();
  };
}

customElements.define("round-break-screen", RoundBreakScreen);
