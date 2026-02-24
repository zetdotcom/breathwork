import { appStore } from "../../core/store.ts";

/**
 * Linear progress bar showing breath count progress.
 *
 * - Thin horizontal bar.
 * - Fill width = currentBreath / targetBreathCount * 100%.
 * - Blue fill (`--color-primary`) on a slate-700 track.
 *
 * Ref: `stitch/power_breathing_session/screen.png`
 */

const TEMPLATE = document.createElement("template");
TEMPLATE.innerHTML = `
  <style>
    :host {
      display: block;
      width: 100%;
      max-width: 320px;
      margin: 0 auto;
    }

    .track {
      width: 100%;
      height: 4px;
      border-radius: 2px;
      background: var(--color-border-dark, #334155);
      overflow: hidden;
    }

    .fill {
      height: 100%;
      border-radius: 2px;
      background: var(--color-primary, #137fec);
      width: 0%;
      transition: width 200ms ease-out;
      will-change: width;
    }
  </style>

  <div class="track">
    <div class="fill" id="fill"></div>
  </div>
`;

export class ProgressBar extends HTMLElement {
  #root: ShadowRoot;
  #fill: HTMLElement | null = null;
  #cleanups: (() => void)[] = [];

  constructor() {
    super();
    this.#root = this.attachShadow({ mode: "open" });
    this.#root.appendChild(TEMPLATE.content.cloneNode(true));

    this.#fill = this.#root.getElementById("fill");
  }

  connectedCallback() {
    const unsubBreath = appStore.select(
      (s) => s.currentBreath,
      () => this.#update(),
    );
    this.#cleanups.push(unsubBreath);

    const unsubTarget = appStore.select(
      (s) => s.targetBreathCount,
      () => this.#update(),
    );
    this.#cleanups.push(unsubTarget);

    // Set initial state
    this.#update();
  }

  disconnectedCallback() {
    for (const cleanup of this.#cleanups) cleanup();
    this.#cleanups = [];
  }

  #update() {
    if (!this.#fill) return;

    const state = appStore.getState();
    const target = state.targetBreathCount;
    const current = state.currentBreath;
    const pct = target > 0 ? Math.min((current / target) * 100, 100) : 0;

    this.#fill.style.width = `${pct}%`;
  }
}

customElements.define("progress-bar", ProgressBar);
