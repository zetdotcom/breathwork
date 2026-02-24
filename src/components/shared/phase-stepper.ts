import { appStore } from "../../core/store.ts";
import type { SessionPhase } from "../../core/app-state.ts";

/**
 * Horizontal phase indicator: BREATHING → RETENTION → RECOVERY.
 *
 * - Active phase: blue dot (with ring) + bold blue label + "Current" badge.
 * - Completed phases: solid small dot + dimmed label.
 * - Future phases: hollow small dot + dimmed label.
 * - Connecting lines between phases.
 *
 * Ref: bottom of `stitch/power_breathing_session/screen.png`
 *      and `stitch/retention_hold_timer/screen.png`
 */

const PHASES = ["breathing", "retention", "recovery"] as const;
type StepPhase = (typeof PHASES)[number];

const _LABELS: Record<StepPhase, string> = {
  breathing: "BREATHING",
  retention: "RETENTION",
  recovery: "RECOVERY",
};

function phaseIndex(phase: SessionPhase): number {
  switch (phase) {
    case "breathing":
      return 0;
    case "retention":
      return 1;
    case "recovery":
      return 2;
    case "round-break":
      return 3; // all steps completed
    default:
      return -1;
  }
}

const TEMPLATE = document.createElement("template");
TEMPLATE.innerHTML = `
  <style>
    :host {
      display: block;
      width: 100%;
      padding: 16px 24px;
    }

    .stepper {
      display: flex;
      align-items: center;
      justify-content: space-between;
      max-width: 400px;
      margin: 0 auto;
    }

    .step {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      position: relative;
      flex-shrink: 0;
    }

    /* "Current" badge above the active dot */
    .badge {
      position: absolute;
      top: -20px;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--color-primary, #137fec);
      background: rgba(19, 127, 236, 0.15);
      padding: 2px 8px;
      border-radius: 4px;
      white-space: nowrap;
      opacity: 0;
      transition: opacity 200ms ease;
    }

    .step[data-state="active"] .badge {
      opacity: 1;
    }

    /* Dot indicators */
    .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--color-border-dark, #334155);
      transition: all 200ms ease;
      box-sizing: border-box;
    }

    .step[data-state="active"] .dot {
      width: 12px;
      height: 12px;
      background: var(--color-primary, #137fec);
      box-shadow: 0 0 0 4px rgba(19, 127, 236, 0.2);
    }

    .step[data-state="completed"] .dot {
      background: var(--color-primary, #137fec);
      opacity: 0.6;
    }

    .step[data-state="future"] .dot {
      background: transparent;
      border: 1.5px solid var(--color-border-dark, #334155);
    }

    /* Labels */
    .label {
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--color-text-muted, #94a3b8);
      transition: color 200ms ease, font-weight 200ms ease;
      white-space: nowrap;
    }

    .step[data-state="active"] .label {
      color: var(--color-primary, #137fec);
      font-weight: 700;
    }

    .step[data-state="completed"] .label {
      color: var(--color-text-muted, #94a3b8);
      opacity: 0.6;
    }

    .step[data-state="future"] .label {
      color: var(--color-text-muted, #94a3b8);
      opacity: 0.4;
    }

    /* Connector lines */
    .connector {
      flex: 1;
      height: 1px;
      background: var(--color-border-dark, #334155);
      margin: 0 8px;
      align-self: center;
      /* Offset upward to align with dot center, accounting for label below */
      margin-bottom: 18px;
    }
  </style>

  <div class="stepper">
    <div class="step" data-phase="breathing" data-state="future">
      <span class="badge">Current</span>
      <span class="dot"></span>
      <span class="label">BREATHING</span>
    </div>

    <div class="connector"></div>

    <div class="step" data-phase="retention" data-state="future">
      <span class="badge">Current</span>
      <span class="dot"></span>
      <span class="label">RETENTION</span>
    </div>

    <div class="connector"></div>

    <div class="step" data-phase="recovery" data-state="future">
      <span class="badge">Current</span>
      <span class="dot"></span>
      <span class="label">RECOVERY</span>
    </div>
  </div>
`;

export class PhaseStepper extends HTMLElement {
  #root: ShadowRoot;
  #steps: Map<StepPhase, HTMLElement> = new Map();
  #unsubscribe: (() => void) | null = null;

  constructor() {
    super();
    this.#root = this.attachShadow({ mode: "open" });
    this.#root.appendChild(TEMPLATE.content.cloneNode(true));

    for (const phase of PHASES) {
      const el = this.#root.querySelector(
        `.step[data-phase="${phase}"]`,
      ) as HTMLElement | null;
      if (el) this.#steps.set(phase, el);
    }
  }

  connectedCallback() {
    this.#unsubscribe = appStore.select(
      (s) => s.phase,
      (phase) => this.#update(phase),
    );
    this.#update(appStore.getState().phase);
  }

  disconnectedCallback() {
    this.#unsubscribe?.();
    this.#unsubscribe = null;
  }

  #update(currentPhase: SessionPhase) {
    const activeIdx = phaseIndex(currentPhase);

    for (const [stepPhase, el] of this.#steps) {
      const stepIdx = phaseIndex(stepPhase);
      let state: "completed" | "active" | "future";

      if (stepIdx < activeIdx) {
        state = "completed";
      } else if (stepIdx === activeIdx) {
        state = "active";
      } else {
        state = "future";
      }

      el.setAttribute("data-state", state);
    }
  }
}

customElements.define("phase-stepper", PhaseStepper);
