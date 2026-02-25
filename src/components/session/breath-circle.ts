import { appStore } from "../../core/store.ts";
import { easeInOut } from "../../utils/math.ts";
import type { BreathDirection } from "../../core/app-state.ts";

/**
 * Animated breathing circle.
 *
 * - Expanding = inhale, contracting = exhale.
 * - Scale driven by `breathProgress` (0→1) from the store,
 *   smoothed with an ease-in-out curve.
 * - Concentric ring decorations (outer glow rings) match the design.
 * - Shows "IN" / "OUT" text with "INHALE" / "EXHALE" label inside.
 *
 * Ref: `stitch/power_breathing_session/screen.png`
 */

const MIN_SCALE = 0.3;
const MAX_SCALE = 1.0;

const TEMPLATE = document.createElement("template");
TEMPLATE.innerHTML = `
  <style>
    :host {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      aspect-ratio: 1;
      max-width: min(280px, 65vw);
      position: relative;
    }

    .rings {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    /* Outermost decorative ring */
    .ring-outer {
      position: absolute;
      width: 115%;
      height: 115%;
      border-radius: 50%;
      border: 1px solid rgba(19, 127, 236, 0.06);
    }

    /* Middle decorative ring */
    .ring-mid {
      position: absolute;
      width: 107%;
      height: 107%;
      border-radius: 50%;
      border: 1px solid rgba(19, 127, 236, 0.1);
    }

    /* Main circle container — this is the element that scales */
    .circle {
      position: relative;
      width: 100%;
      height: 100%;
      border-radius: 50%;
      border: 2px solid var(--color-border-dark, #334155);
      background: var(--color-bg-dark, #101922);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 4px;
      box-shadow: var(--glow-primary, 0 0 40px -10px rgba(19, 127, 236, 0.4));
      will-change: transform;
      transition: none;
    }

    /* Inner decorative ring */
    .inner-ring {
      position: absolute;
      inset: 8px;
      border-radius: 50%;
      border: 1px solid rgba(19, 127, 236, 0.15);
      pointer-events: none;
    }

    /* Direction text: "IN" or "OUT" */
    .direction-text {
      font-size: clamp(40px, 10vw, 56px);
      font-weight: 700;
      letter-spacing: -0.02em;
      color: var(--color-text, #f1f5f9);
      line-height: 1;
      text-transform: uppercase;
      user-select: none;
    }

    /* Sub-label: "INHALE" or "EXHALE" */
    .direction-label {
      font-size: clamp(12px, 3vw, 15px);
      font-weight: 600;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--color-primary, #137fec);
      user-select: none;
    }
  </style>

  <div class="rings">
    <div class="ring-outer"></div>
    <div class="ring-mid"></div>
  </div>

  <div class="circle" id="circle">
    <div class="inner-ring"></div>
    <span class="direction-text" id="direction-text">IN</span>
    <span class="direction-label" id="direction-label">INHALE</span>
  </div>
`;

export class BreathCircle extends HTMLElement {
  #root: ShadowRoot;
  #circle: HTMLElement | null = null;
  #directionText: HTMLElement | null = null;
  #directionLabel: HTMLElement | null = null;
  #cleanups: (() => void)[] = [];

  constructor() {
    super();
    this.#root = this.attachShadow({ mode: "open" });
    this.#root.appendChild(TEMPLATE.content.cloneNode(true));

    this.#circle = this.#root.getElementById("circle");
    this.#directionText = this.#root.getElementById("direction-text");
    this.#directionLabel = this.#root.getElementById("direction-label");
  }

  connectedCallback() {
    // Subscribe to breath progress for circle scale
    const unsubProgress = appStore.select(
      (s) => s.breathProgress,
      (progress) =>
        this.#updateScale(progress, appStore.getState().breathDirection),
    );
    this.#cleanups.push(unsubProgress);

    // Subscribe to breath direction for text
    const unsubDirection = appStore.select(
      (s) => s.breathDirection,
      (direction) => this.#updateDirection(direction),
    );
    this.#cleanups.push(unsubDirection);

    // Set initial state
    const state = appStore.getState();
    this.#updateDirection(state.breathDirection);
    this.#updateScale(state.breathProgress, state.breathDirection);
  }

  disconnectedCallback() {
    for (const cleanup of this.#cleanups) cleanup();
    this.#cleanups = [];
  }

  #updateScale(progress: number, direction: BreathDirection) {
    if (!this.#circle) return;

    // Apply ease-in-out for smoother feel
    const eased = easeInOut(progress);

    // Inhale: scale up from MIN to MAX
    // Exhale: scale down from MAX to MIN
    let scale: number;
    if (direction === "inhale") {
      scale = MIN_SCALE + (MAX_SCALE - MIN_SCALE) * eased;
    } else {
      scale = MAX_SCALE - (MAX_SCALE - MIN_SCALE) * eased;
    }

    this.#circle.style.transform = `scale(${scale})`;
  }

  #updateDirection(direction: BreathDirection) {
    if (this.#directionText) {
      this.#directionText.textContent = direction === "inhale" ? "IN" : "OUT";
    }
    if (this.#directionLabel) {
      this.#directionLabel.textContent = direction === "inhale"
        ? "INHALE"
        : "EXHALE";
    }
  }
}

customElements.define("breath-circle", BreathCircle);
