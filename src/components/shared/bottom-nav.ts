import { appStore } from "../../core/store.ts";
import type { TabId } from "../../core/app-state.ts";
import { navigateTo } from "../../app/router.ts";

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: "breathe", label: "Breathe", icon: "spa" },
  { id: "stats", label: "Stats", icon: "bar_chart" },
  { id: "settings", label: "Settings", icon: "settings" },
];

const TEMPLATE = document.createElement("template");
TEMPLATE.innerHTML = `
  <style>
    :host {
      display: block;
      width: 100%;
      background: var(--color-bg-dark, #101922);
      border-top: 1px solid var(--color-border-dark, #334155);
      padding-bottom: var(--safe-bottom, 0px);
      z-index: 100;
    }

    :host([hidden]) {
      display: none !important;
    }

    nav {
      display: flex;
      align-items: stretch;
      justify-content: space-around;
      max-width: 480px;
      margin: 0 auto;
      height: 56px;
    }

    button {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 2px;
      background: none;
      border: none;
      padding: 6px 0;
      cursor: pointer;
      color: var(--color-text-muted, #94a3b8);
      transition: color 200ms ease;
      -webkit-tap-highlight-color: transparent;
      position: relative;
      font-family: var(--font-family, system-ui, sans-serif);
    }

    button:active {
      opacity: 0.7;
    }

    button[aria-selected="true"] {
      color: var(--color-primary, #137fec);
    }

    .icon {
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
      /* Inactive: FILL 0, wght 300 */
      font-variation-settings: "FILL" 0, "wght" 300, "GRAD" 0, "opsz" 24;
      transition: font-variation-settings 200ms ease;
    }

    button[aria-selected="true"] .icon {
      /* Active: FILL 1, wght 400 */
      font-variation-settings: "FILL" 1, "wght" 400, "GRAD" 0, "opsz" 24;
    }

    .label {
      font-size: 10px;
      font-weight: 500;
      letter-spacing: 0.02em;
      text-transform: uppercase;
      line-height: 1;
    }
  </style>

  <nav role="tablist" aria-label="Main navigation">
    ${TABS.map(
      (tab) => `
      <button
        role="tab"
        data-tab="${tab.id}"
        aria-selected="false"
        aria-label="${tab.label}"
      >
        <span class="icon" aria-hidden="true">${tab.icon}</span>
        <span class="label">${tab.label}</span>
      </button>
    `,
    ).join("")}
  </nav>
`;

export class BottomNav extends HTMLElement {
  #root: ShadowRoot;
  #buttons: Map<TabId, HTMLButtonElement> = new Map();
  #activeTab: TabId = "breathe";
  #unsubscribe: (() => void) | null = null;

  constructor() {
    super();
    this.#root = this.attachShadow({ mode: "open" });
    this.#root.appendChild(TEMPLATE.content.cloneNode(true));

    // Cache button references
    for (const tab of TABS) {
      const btn = this.#root.querySelector(
        `button[data-tab="${tab.id}"]`,
      ) as HTMLButtonElement | null;
      if (btn) {
        this.#buttons.set(tab.id, btn);
      }
    }
  }

  connectedCallback() {
    // Listen for clicks on tabs
    this.#root
      .querySelector("nav")
      ?.addEventListener("click", this.#handleClick);

    // Subscribe to store for active tab changes
    this.#unsubscribe = appStore.select(
      (s) => s.activeTab,
      (tab) => this.#setActive(tab),
    );

    // Set initial state
    this.#setActive(appStore.getState().activeTab);
  }

  disconnectedCallback() {
    this.#root
      .querySelector("nav")
      ?.removeEventListener("click", this.#handleClick);
    this.#unsubscribe?.();
    this.#unsubscribe = null;
  }

  #handleClick = (e: Event) => {
    const btn = (e.target as HTMLElement).closest(
      "button[data-tab]",
    ) as HTMLButtonElement | null;
    if (!btn) return;

    const tab = btn.dataset["tab"] as TabId | undefined;
    if (!tab) return;

    navigateTo(tab);
  };

  #setActive(tab: TabId) {
    if (this.#activeTab === tab) {
      // Still update visuals in case this is the first render
      this.#updateVisuals(tab);
      return;
    }
    this.#activeTab = tab;
    this.#updateVisuals(tab);
  }

  #updateVisuals(tab: TabId) {
    for (const [id, btn] of this.#buttons) {
      const isActive = id === tab;
      btn.setAttribute("aria-selected", String(isActive));
    }
  }
}

customElements.define("bottom-nav", BottomNav);
