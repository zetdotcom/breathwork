import { appStore } from "../../core/store.ts";
import { sessionEngine } from "../../core/breathing-engine.ts";
import { formatCountdownSeconds } from "../../utils/time.ts";
import "../shared/session-header.ts";
import "../shared/phase-stepper.ts";

/**
 * Recovery phase screen.
 *
 * - 15s countdown displayed in a large circle (same layout as retention).
 * - Phase stepper at bottom with RECOVERY active.
 * - "Finish Session" button to end after this round instead of auto-looping.
 * - Auto-transitions to next round's breathing phase when countdown reaches 0
 *   (handled by the engine), or to summary if the user clicked "Finish Session".
 *
 * Ref: similar circle layout to `stitch/retention_hold_timer/screen.png`
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
      padding: 16px 24px;
      gap: 32px;
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
      width: min(260px, 64vw);
      aspect-ratio: 1;
      border-radius: 50%;
      border: 3px solid var(--color-border-dark, #334155);
      background: var(--color-bg-dark, #101922);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 6px;
      box-shadow: var(--glow-primary, 0 0 40px -10px rgba(19, 127, 236, 0.4));
    }

    /* Inner decorative ring */
    .countdown-circle::before {
      content: "";
      position: absolute;
      inset: 8px;
      border-radius: 50%;
      border: 1px solid rgba(19, 127, 236, 0.15);
      pointer-events: none;
    }

    .countdown-label {
      font-size: 11px;
      font-weight: 500;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: var(--color-text-muted, #94a3b8);
    }

    .countdown-value {
      font-size: clamp(48px, 14vw, 72px);
      font-weight: 700;
      letter-spacing: -0.03em;
      font-variant-numeric: tabular-nums;
      color: var(--color-text, #f1f5f9);
      line-height: 1;
    }

    .countdown-unit {
      font-size: 13px;
      font-weight: 500;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--color-text-muted, #94a3b8);
    }

    /* ── Instructional text ── */
    .info {
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
    }

    .info h1 {
      font-size: 26px;
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

    /* ── Finish button ── */
    .actions {
      width: 100%;
      display: flex;
      justify-content: center;
    }

    .finish-btn {
      width: 100%;
      max-width: 320px;
      height: 48px;
      background: transparent;
      color: var(--color-text-muted, #94a3b8);
      border: 1px solid var(--color-border-dark, #334155);
      border-radius: var(--radius-md, 0.75rem);
      font-size: 14px;
      font-weight: 600;
      font-family: var(--font-family, "Inter", system-ui, sans-serif);
      letter-spacing: 0.04em;
      text-transform: uppercase;
      cursor: pointer;
      transition: background 200ms ease, color 200ms ease, border-color 200ms ease;
      -webkit-tap-highlight-color: transparent;
    }

    .finish-btn:hover {
      background: rgba(255, 255, 255, 0.04);
      color: var(--color-text, #f1f5f9);
      border-color: var(--color-text-muted, #94a3b8);
    }

    .finish-btn:active {
      transform: scale(0.97);
    }

    .finish-btn[data-requested] {
      color: var(--color-primary, #137fec);
      border-color: var(--color-primary, #137fec);
      pointer-events: none;
    }

    /* ── Bottom ── */
    .bottom {
      width: 100%;
      padding-bottom: 8px;
    }
  </style>

  <session-header></session-header>

  <div class="body">
    <div class="circle-area">
      <div class="glow"></div>
      <div class="countdown-circle">
        <span class="countdown-label">RECOVERY</span>
        <span class="countdown-value" id="countdown-value">15</span>
        <span class="countdown-unit">seconds</span>
      </div>
    </div>

    <div class="info">
      <h1>Recovery Breath</h1>
      <p>Inhale deeply and hold. Relax and let your body recover.</p>
    </div>

    <div class="actions">
      <button class="finish-btn" id="finish-btn">Finish Session</button>
    </div>
  </div>

  <div class="bottom">
    <phase-stepper></phase-stepper>
  </div>
`;

export class RecoveryScreen extends HTMLElement {
  #root: ShadowRoot;
  #countdownValue: HTMLElement | null = null;
  #finishBtn: HTMLButtonElement | null = null;
  #cleanups: (() => void)[] = [];

  constructor() {
    super();
    this.#root = this.attachShadow({ mode: "open" });
    this.#root.appendChild(TEMPLATE.content.cloneNode(true));

    this.#countdownValue = this.#root.getElementById("countdown-value");
    this.#finishBtn = this.#root.getElementById("finish-btn") as HTMLButtonElement | null;
  }

  connectedCallback() {
    // Update countdown display
    const unsubRecovery = appStore.select(
      (s) => s.recoveryRemainingMs,
      (remaining) => this.#updateCountdown(remaining),
    );
    this.#cleanups.push(unsubRecovery);

    // Finish button
    this.#finishBtn?.addEventListener("click", this.#handleFinish);

    // Set initial state
    this.#updateCountdown(appStore.getState().recoveryRemainingMs);
  }

  disconnectedCallback() {
    this.#finishBtn?.removeEventListener("click", this.#handleFinish);
    for (const cleanup of this.#cleanups) cleanup();
    this.#cleanups = [];
  }

  #updateCountdown(remainingMs: number) {
    if (this.#countdownValue) {
      this.#countdownValue.textContent = formatCountdownSeconds(remainingMs);
    }
  }

  #handleFinish = () => {
    // Signal the engine to go to summary after recovery completes
    sessionEngine.finishSession();

    // Visual feedback that finish was requested
    this.#finishBtn?.setAttribute("data-requested", "");
    if (this.#finishBtn) {
      this.#finishBtn.textContent = "Finishing…";
    }
  };
}

customElements.define("recovery-screen", RecoveryScreen);
