import { appStore } from "../core/store.ts";
import { sessionEngine } from "../core/breathing-engine.ts";
import type { TabId, SessionPhase } from "../core/app-state.ts";
import { syncRouterWithStore } from "./router.ts";
import "../components/shared/bottom-nav.ts";

// Import session screen components so their custom elements are registered.
// Each screen self-registers via customElements.define() on import.
import "../components/session/prepare-screen.ts";
import "../components/session/breathing-screen.ts";
import "../components/session/retention-screen.ts";
import "../components/session/recovery-screen.ts";
import "../components/session/round-break-screen.ts";
import "../components/session/session-summary.ts";

// Import tab screen components
import "../components/settings/settings-screen.ts";
import "../components/history/history-screen.ts";

/**
 * Map of session phases to their corresponding custom element tag names.
 * Only phases that render a full-screen overlay are listed here.
 * "idle" has no overlay — the user sees the normal tab view.
 */
const PHASE_SCREEN_TAG: Partial<Record<SessionPhase, string>> = {
  prepare: "prepare-screen",
  breathing: "breathing-screen",
  retention: "retention-screen",
  recovery: "recovery-screen",
  "round-break": "round-break-screen",
  summary: "session-summary",
};

const TEMPLATE = document.createElement("template");
TEMPLATE.innerHTML = `
  <style>
    :host {
      display: flex;
      flex-direction: column;
      height: 100dvh;
      width: 100%;
      overflow: hidden;
      background: var(--color-bg-dark, #101922);
      color: var(--color-text, #f1f5f9);
      font-family: var(--font-family, "Inter", system-ui, sans-serif);
    }

    /* ── Tab views container ── */
    .tab-views {
      flex: 1;
      position: relative;
      overflow: hidden;
    }

    .tab-view {
      position: absolute;
      inset: 0;
      display: none;
      flex-direction: column;
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
    }

    .tab-view[data-active] {
      display: flex;
    }

    /* ── Session overlay ── */
    .session-overlay {
      position: fixed;
      inset: 0;
      z-index: 200;
      background: var(--color-bg-dark, #101922);
      display: flex;
      flex-direction: column;
      opacity: 0;
      visibility: hidden;
      pointer-events: none;
      transition: opacity 200ms ease;
    }

    .session-overlay[data-active] {
      opacity: 1;
      visibility: visible;
      pointer-events: auto;
    }

    .session-overlay .phase-screen {
      opacity: 0;
      transform: translateY(6px);
      transition: opacity 200ms ease, transform 200ms ease;
      will-change: opacity, transform;
    }

    .session-overlay[data-active] .phase-screen[data-mounted] {
      opacity: 1;
      transform: translateY(0);
    }

    /* ── Breathe tab — idle home screen ── */
    .breathe-home {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24px;
      gap: 32px;
      text-align: center;
    }

    .breathe-home .logo-circle {
      width: min(240px, 60vw);
      aspect-ratio: 1;
      border-radius: 50%;
      border: 2px solid var(--color-border-dark, #334155);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 8px;
      box-shadow: var(--glow-primary, 0 0 40px -10px rgba(19, 127, 236, 0.4));
      position: relative;
    }

    .breathe-home .logo-circle::before {
      content: "";
      position: absolute;
      inset: -16px;
      border-radius: 50%;
      border: 1px solid rgba(19, 127, 236, 0.1);
    }

    .breathe-home .logo-circle .icon {
      font-family: "Material Symbols Outlined";
      font-size: 48px;
      font-variation-settings: "FILL" 0, "wght" 200, "GRAD" 0, "opsz" 48;
      color: var(--color-primary, #137fec);
    }

    .breathe-home .logo-circle .ready-text {
      font-size: 14px;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--color-text-muted, #94a3b8);
    }

    .breathe-home h1 {
      font-size: 28px;
      font-weight: 700;
      letter-spacing: -0.025em;
      margin: 0;
    }

    .breathe-home .subtitle {
      font-size: 15px;
      color: var(--color-text-muted, #94a3b8);
      max-width: 280px;
      line-height: 1.5;
      margin: 0;
    }

    .start-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
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
      box-shadow: 0 4px 20px -4px rgba(19, 127, 236, 0.4);
      transition: background 200ms ease, transform 100ms ease;
      -webkit-tap-highlight-color: transparent;
    }

    .start-btn:hover {
      background: var(--color-primary-hover, #1a8ff8);
    }

    .start-btn:active {
      transform: scale(0.97);
    }

    .start-btn .btn-icon {
      font-family: "Material Symbols Outlined";
      font-size: 22px;
      font-variation-settings: "FILL" 1, "wght" 400, "GRAD" 0, "opsz" 24;
    }

    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }

  </style>

  <!-- Tab views -->
  <div class="tab-views">
    <div class="tab-view" data-tab="breathe">
      <div class="breathe-home">
        <div class="logo-circle">
          <span class="icon" aria-hidden="true">spa</span>
          <span class="ready-text">Ready</span>
        </div>
        <h1>Breathwork Trainer</h1>
        <p class="subtitle">Power breathing to boost your energy and focus.</p>
        <button class="start-btn" id="start-session-btn">
          <span class="btn-icon" aria-hidden="true">play_arrow</span>
          Start Session
        </button>
      </div>
    </div>

    <div class="tab-view" data-tab="stats">
      <history-screen></history-screen>
    </div>

    <div class="tab-view" data-tab="settings">
      <settings-screen></settings-screen>
    </div>
  </div>

  <!-- Bottom navigation -->
  <bottom-nav id="bottom-nav"></bottom-nav>

  <!-- Session overlay — content is dynamically swapped per phase -->
  <div
    class="session-overlay"
    id="session-overlay"
    role="dialog"
    aria-modal="true"
    aria-label="Breathwork session"
    aria-hidden="true"
    tabindex="-1"
  ></div>
  <div
    class="sr-only"
    id="phase-announce"
    aria-live="polite"
    aria-atomic="true"
  ></div>
`;

export class AppRoot extends HTMLElement {
  #root: ShadowRoot;
  #tabViews: Map<TabId, HTMLElement> = new Map();
  #bottomNav: HTMLElement | null = null;
  #sessionOverlay: HTMLElement | null = null;
  #startBtn: HTMLButtonElement | null = null;
  #cleanups: (() => void)[] = [];
  #lastFocused: HTMLElement | null = null;
  #phaseAnnounce: HTMLElement | null = null;

  /** Track which phase screen is currently mounted to avoid redundant swaps. */
  #currentOverlayPhase: SessionPhase | null = null;

  constructor() {
    super();
    this.#root = this.attachShadow({ mode: "open" });
    this.#root.appendChild(TEMPLATE.content.cloneNode(true));

    // Cache element references
    for (const tabId of ["breathe", "stats", "settings"] as TabId[]) {
      const el = this.#root.querySelector(
        `.tab-view[data-tab="${tabId}"]`,
      ) as HTMLElement | null;
      if (el) this.#tabViews.set(tabId, el);
    }

    this.#bottomNav = this.#root.getElementById("bottom-nav");
    this.#sessionOverlay = this.#root.getElementById("session-overlay");
    this.#phaseAnnounce = this.#root.getElementById("phase-announce");
    this.#startBtn = this.#root.getElementById(
      "start-session-btn",
    ) as HTMLButtonElement | null;
  }

  connectedCallback() {
    // Sync router ↔ store
    const unsyncRouter = syncRouterWithStore(appStore);
    this.#cleanups.push(unsyncRouter);

    // React to active tab changes
    const unsubTab = appStore.select(
      (s) => s.activeTab,
      (tab) => this.#showTab(tab),
    );
    this.#cleanups.push(unsubTab);

    // React to session active changes
    const unsubSession = appStore.select(
      (s) => s.sessionActive,
      (active) => this.#toggleSessionOverlay(active),
    );
    this.#cleanups.push(unsubSession);

    // React to phase changes — swap the screen component inside the overlay
    const unsubPhase = appStore.select(
      (s) => s.phase,
      (phase) => this.#renderPhaseScreen(phase),
    );
    this.#cleanups.push(unsubPhase);

    // Start session button
    this.#startBtn?.addEventListener("click", this.#handleStartSession);

    // Render initial state
    const state = appStore.getState();
    this.#showTab(state.activeTab);
    this.#toggleSessionOverlay(state.sessionActive);
    this.#renderPhaseScreen(state.phase);
  }

  disconnectedCallback() {
    this.#startBtn?.removeEventListener("click", this.#handleStartSession);
    for (const cleanup of this.#cleanups) cleanup();
    this.#cleanups = [];
  }

  #showTab(tab: TabId) {
    for (const [id, el] of this.#tabViews) {
      if (id === tab) {
        el.setAttribute("data-active", "");
      } else {
        el.removeAttribute("data-active");
      }
    }
  }

  #toggleSessionOverlay(active: boolean) {
    if (active) {
      this.#lastFocused = document.activeElement as HTMLElement | null;
      this.#sessionOverlay?.setAttribute("data-active", "");
      this.#sessionOverlay?.removeAttribute("aria-hidden");
      this.#bottomNav?.setAttribute("hidden", "");
      this.#setTabViewsAriaHidden(true);
      this.#focusOverlay();
    } else {
      this.#sessionOverlay?.removeAttribute("data-active");
      this.#sessionOverlay?.setAttribute("aria-hidden", "true");
      this.#bottomNav?.removeAttribute("hidden");
      this.#setTabViewsAriaHidden(false);
      // Clear the overlay content when session ends
      this.#clearOverlay();
      this.#lastFocused?.focus?.();
      this.#lastFocused = null;
    }
  }

  /**
   * Swap the session overlay's child to the screen component matching
   * the current phase. Only re-creates the element when the phase changes.
   */
  #renderPhaseScreen(phase: SessionPhase) {
    // Don't swap if we're already showing this phase's screen
    if (phase === this.#currentOverlayPhase) return;

    const tag = PHASE_SCREEN_TAG[phase];

    this.#announcePhase(phase);

    if (!tag) {
      // Phase is "idle" or unknown — clear the overlay
      this.#clearOverlay();
      return;
    }

    // Remove the previous screen and mount the new one
    if (this.#sessionOverlay) {
      this.#sessionOverlay.innerHTML = "";
      const screen = document.createElement(tag);
      screen.classList.add("phase-screen");
      this.#sessionOverlay.appendChild(screen);
      requestAnimationFrame(() => {
        screen.setAttribute("data-mounted", "");
      });
      if (this.#sessionOverlay.hasAttribute("data-active")) {
        this.#focusOverlay();
      }
    }

    this.#currentOverlayPhase = phase;
  }

  #clearOverlay() {
    if (this.#sessionOverlay) {
      this.#sessionOverlay.innerHTML = "";
    }
    this.#currentOverlayPhase = null;
  }

  #announcePhase(phase: SessionPhase) {
    if (!this.#phaseAnnounce) return;
    const label = this.#phaseLabel(phase);
    if (label) {
      this.#phaseAnnounce.textContent = label;
    }
  }

  #phaseLabel(phase: SessionPhase): string {
    const labels: Record<SessionPhase, string> = {
      idle: "Session ended",
      prepare: "Get ready",
      breathing: "Breathing phase",
      retention: "Retention hold",
      recovery: "Recovery breath",
      "round-break": "Next round",
      summary: "Session complete",
    };
    return labels[phase] ?? "Session update";
  }

  #focusOverlay() {
    if (!this.#sessionOverlay) return;
    const screen =
      this.#sessionOverlay.querySelector<HTMLElement>(".phase-screen");
    const focusable =
      this.#findFocusable(screen) ?? this.#findFocusable(this.#sessionOverlay);
    (focusable ?? this.#sessionOverlay).focus?.();
  }

  #findFocusable(root: HTMLElement | null): HTMLElement | null {
    if (!root) return null;
    const searchRoot = (root.shadowRoot ?? root) as ParentNode;
    return searchRoot.querySelector<HTMLElement>(
      "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])",
    );
  }

  #setTabViewsAriaHidden(hidden: boolean) {
    for (const [, el] of this.#tabViews) {
      if (hidden) {
        el.setAttribute("aria-hidden", "true");
      } else {
        el.removeAttribute("aria-hidden");
      }
    }
  }

  /**
   * Start a new session via the SessionEngine.
   * The engine handles all state updates and phase transitions.
   */
  #handleStartSession = () => {
    sessionEngine.startSession();
  };
}

customElements.define("app-root", AppRoot);
