import { appStore } from "../../core/store.ts";
import { sessionEngine } from "../../core/breathing-engine.ts";
import "../shared/session-header.ts";
import "../shared/phase-stepper.ts";
import "./breath-circle.ts";
import "./progress-bar.ts";

/**
 * Breathing phase screen.
 *
 * Assembles: session-header + breath-circle + breath counter + progress-bar
 *            + phase-stepper + "Go To Retention Phase" CTA button.
 *
 * Ref: `stitch/power_breathing_session/screen.png`
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
      gap: 24px;
      -webkit-tap-highlight-color: transparent;
    }

    /* ── Circle area ── */
    .circle-wrapper {
      display: flex;
      align-items: center;
      justify-content: center;
      width: min(280px, 65vw);
      height: min(280px, 65vw);
      flex-shrink: 0;
    }

    /* ── Counter ── */
    .counter {
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
    }

    .counter-numbers {
      font-size: 36px;
      font-weight: 700;
      letter-spacing: -0.02em;
      line-height: 1;
      font-variant-numeric: tabular-nums;
    }

    .counter-current {
      color: var(--color-text, #f1f5f9);
    }

    .counter-separator {
      color: var(--color-text-muted, #94a3b8);
      margin: 0 2px;
      font-weight: 400;
    }

    .counter-target {
      color: var(--color-text-muted, #94a3b8);
    }

    .counter-label {
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--color-text-muted, #94a3b8);
    }

    /* ── Progress bar ── */
    .progress-wrapper {
      width: 100%;
      max-width: 320px;
    }

    /* ── CTA button ── */
    .cta-wrapper {
      width: 100%;
      display: flex;
      justify-content: center;
    }

    .skip-btn {
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

    .skip-btn:hover {
      background: var(--color-primary-hover, #1a8ff8);
    }

    .skip-btn:active {
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
    <div class="circle-wrapper">
      <breath-circle></breath-circle>
    </div>

    <div class="counter">
      <div class="counter-numbers">
        <span class="counter-current" id="breath-current">0</span>
        <span class="counter-separator">/</span>
        <span class="counter-target" id="breath-target">30</span>
      </div>
      <div class="counter-label">BREATHS COMPLETED</div>
    </div>

    <div class="progress-wrapper">
      <progress-bar></progress-bar>
    </div>

    <div class="cta-wrapper">
      <button class="skip-btn" id="skip-btn">Go To Retention Phase</button>
    </div>
  </div>

  <div class="bottom">
    <phase-stepper></phase-stepper>
  </div>
`;

export class BreathingScreen extends HTMLElement {
  #root: ShadowRoot;
  #breathCurrent: HTMLElement | null = null;
  #breathTarget: HTMLElement | null = null;
  #skipBtn: HTMLElement | null = null;
  #cleanups: (() => void)[] = [];

  constructor() {
    super();
    this.#root = this.attachShadow({ mode: "open" });
    this.#root.appendChild(TEMPLATE.content.cloneNode(true));

    this.#breathCurrent = this.#root.getElementById("breath-current");
    this.#breathTarget = this.#root.getElementById("breath-target");
    this.#skipBtn = this.#root.getElementById("skip-btn");
  }

  connectedCallback() {
    // Update breath counter display
    const unsubBreath = appStore.select(
      (s) => s.currentBreath,
      (count) => this.#updateCurrent(count),
    );
    this.#cleanups.push(unsubBreath);

    const unsubTarget = appStore.select(
      (s) => s.targetBreathCount,
      (target) => this.#updateTarget(target),
    );
    this.#cleanups.push(unsubTarget);

    // Skip button
    this.#skipBtn?.addEventListener("click", this.#handleSkip);

    // Set initial state
    const state = appStore.getState();
    this.#updateCurrent(state.currentBreath);
    this.#updateTarget(state.targetBreathCount);
  }

  disconnectedCallback() {
    this.#skipBtn?.removeEventListener("click", this.#handleSkip);
    for (const cleanup of this.#cleanups) cleanup();
    this.#cleanups = [];
  }

  #updateCurrent(count: number) {
    if (this.#breathCurrent) {
      this.#breathCurrent.textContent = String(count);
    }
  }

  #updateTarget(target: number) {
    if (this.#breathTarget) {
      this.#breathTarget.textContent = String(target);
    }
  }

  #handleSkip = () => {
    sessionEngine.skipBreathing();
  };
}

customElements.define("breathing-screen", BreathingScreen);
