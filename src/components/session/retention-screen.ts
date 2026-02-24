import { appStore } from "../../core/store.ts";
import { sessionEngine } from "../../core/breathing-engine.ts";
import { formatMMSS, formatCentiseconds } from "../../utils/time.ts";
import "../shared/session-header.ts";
import "../shared/phase-stepper.ts";

/**
 * Retention phase screen.
 *
 * - Large circle displaying "TIME ELAPSED" label + MM:SS.cs timer.
 * - Blue glow effect on circle border.
 * - Below circle: "Retention Phase" heading + guidance text.
 * - Prominent blue CTA: "I NEED TO INHALE" button — ends retention, starts recovery.
 * - Phase stepper at bottom with RETENTION active.
 *
 * Ref: `stitch/retention_hold_timer/screen.png`
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

    /* ── Timer circle ── */
    .circle-area {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    /* Outer glow behind the circle */
    .glow {
      position: absolute;
      width: 150%;
      height: 150%;
      border-radius: 50%;
      background: radial-gradient(
        circle,
        rgba(19, 127, 236, 0.08) 0%,
        transparent 70%
      );
      pointer-events: none;
    }

    .timer-circle {
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
    .timer-circle::before {
      content: "";
      position: absolute;
      inset: 8px;
      border-radius: 50%;
      border: 1px solid rgba(19, 127, 236, 0.15);
      pointer-events: none;
    }

    .elapsed-label {
      font-size: 11px;
      font-weight: 500;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: var(--color-text-muted, #94a3b8);
    }

    .timer-value {
      display: flex;
      align-items: baseline;
      line-height: 1;
    }

    .timer-main {
      font-size: clamp(40px, 12vw, 56px);
      font-weight: 700;
      letter-spacing: -0.03em;
      font-variant-numeric: tabular-nums;
      color: var(--color-text, #f1f5f9);
    }

    .timer-cs {
      font-size: clamp(18px, 5vw, 24px);
      font-weight: 500;
      font-variant-numeric: tabular-nums;
      color: var(--color-text-muted, #94a3b8);
      margin-left: 2px;
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

    /* ── CTA button ── */
    .cta-wrapper {
      width: 100%;
      display: flex;
      justify-content: center;
    }

    .inhale-btn {
      width: 100%;
      max-width: 320px;
      height: 56px;
      background: var(--color-primary, #137fec);
      color: #fff;
      border: none;
      border-radius: var(--radius-md, 0.75rem);
      font-size: 16px;
      font-weight: 700;
      font-family: var(--font-family, "Inter", system-ui, sans-serif);
      letter-spacing: 0.04em;
      text-transform: uppercase;
      cursor: pointer;
      box-shadow: 0 4px 20px -4px rgba(19, 127, 236, 0.35);
      transition: background 200ms ease, transform 100ms ease;
      -webkit-tap-highlight-color: transparent;
    }

    .inhale-btn:hover {
      background: var(--color-primary-hover, #1a8ff8);
    }

    .inhale-btn:active {
      transform: scale(0.97);
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
      <div class="timer-circle">
        <span class="elapsed-label">TIME ELAPSED</span>
        <div class="timer-value">
          <span class="timer-main" id="timer-main">00:00</span>
          <span class="timer-cs" id="timer-cs">.00</span>
        </div>
      </div>
    </div>

    <div class="info">
      <h1>Retention Phase</h1>
      <p>Hold your breath comfortably. Focus on the stillness within.</p>
    </div>

    <div class="cta-wrapper">
      <button class="inhale-btn" id="inhale-btn">I Need To Inhale</button>
    </div>
  </div>

  <div class="bottom">
    <phase-stepper></phase-stepper>
  </div>
`;

export class RetentionScreen extends HTMLElement {
  #root: ShadowRoot;
  #timerMain: HTMLElement | null = null;
  #timerCs: HTMLElement | null = null;
  #inhaleBtn: HTMLButtonElement | null = null;
  #cleanups: (() => void)[] = [];

  constructor() {
    super();
    this.#root = this.attachShadow({ mode: "open" });
    this.#root.appendChild(TEMPLATE.content.cloneNode(true));

    this.#timerMain = this.#root.getElementById("timer-main");
    this.#timerCs = this.#root.getElementById("timer-cs");
    this.#inhaleBtn = this.#root.getElementById("inhale-btn") as HTMLButtonElement | null;
  }

  connectedCallback() {
    // Update timer display from store
    const unsubRetention = appStore.select(
      (s) => s.retentionElapsedMs,
      (elapsed) => this.#updateTimer(elapsed),
    );
    this.#cleanups.push(unsubRetention);

    // "I Need To Inhale" button
    this.#inhaleBtn?.addEventListener("click", this.#handleInhale);

    // Set initial state
    this.#updateTimer(appStore.getState().retentionElapsedMs);
  }

  disconnectedCallback() {
    this.#inhaleBtn?.removeEventListener("click", this.#handleInhale);
    for (const cleanup of this.#cleanups) cleanup();
    this.#cleanups = [];
  }

  #updateTimer(elapsedMs: number) {
    if (this.#timerMain) {
      this.#timerMain.textContent = formatMMSS(elapsedMs);
    }
    if (this.#timerCs) {
      this.#timerCs.textContent = `.${formatCentiseconds(elapsedMs)}`;
    }
  }

  #handleInhale = () => {
    sessionEngine.endRetention();
  };
}

customElements.define("retention-screen", RetentionScreen);
