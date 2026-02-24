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
 *            + phase-stepper + "DOUBLE TAP TO SKIP" hint.
 *
 * Handles double-tap detection on the screen body to skip the breathing phase.
 *
 * Ref: `stitch/power_breathing_session/screen.png`
 */

const DOUBLE_TAP_THRESHOLD_MS = 350;

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

    /* ── Bottom area: stepper + hint ── */
    .bottom {
      width: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      padding-bottom: 8px;
    }

    .skip-hint {
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--color-text-muted, #94a3b8);
      opacity: 0.6;
      text-align: center;
    }
  </style>

  <session-header></session-header>

  <div class="body" id="tap-area">
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
  </div>

  <div class="bottom">
    <phase-stepper></phase-stepper>
    <div class="skip-hint">DOUBLE TAP TO SKIP</div>
  </div>
`;

export class BreathingScreen extends HTMLElement {
  #root: ShadowRoot;
  #breathCurrent: HTMLElement | null = null;
  #breathTarget: HTMLElement | null = null;
  #tapArea: HTMLElement | null = null;
  #lastTapTime = 0;
  #cleanups: (() => void)[] = [];

  constructor() {
    super();
    this.#root = this.attachShadow({ mode: "open" });
    this.#root.appendChild(TEMPLATE.content.cloneNode(true));

    this.#breathCurrent = this.#root.getElementById("breath-current");
    this.#breathTarget = this.#root.getElementById("breath-target");
    this.#tapArea = this.#root.getElementById("tap-area");
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

    // Double-tap to skip
    this.#tapArea?.addEventListener("pointerup", this.#handleTap);

    // Set initial state
    const state = appStore.getState();
    this.#updateCurrent(state.currentBreath);
    this.#updateTarget(state.targetBreathCount);
  }

  disconnectedCallback() {
    this.#tapArea?.removeEventListener("pointerup", this.#handleTap);
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

  #handleTap = () => {
    const now = performance.now();
    const delta = now - this.#lastTapTime;
    this.#lastTapTime = now;

    if (delta < DOUBLE_TAP_THRESHOLD_MS && delta > 0) {
      this.#lastTapTime = 0; // Reset so triple-tap doesn't re-trigger
      sessionEngine.skipBreathing();
    }
  };
}

customElements.define("breathing-screen", BreathingScreen);
