import { pwaInstallController } from "../../core/pwa-install.ts";
import type { InstallState } from "../../core/pwa-install.ts";

type InstallContext = "home" | "settings";

const TEMPLATE = document.createElement("template");
TEMPLATE.innerHTML = `
  <style>
    :host {
      display: block;
      font-family: var(--font-family, "Inter", system-ui, sans-serif);
      color: var(--color-text, #f1f5f9);
    }

    :host([hidden]) {
      display: none;
    }

    .card {
      display: flex;
      flex-direction: column;
      gap: 14px;
      padding: 16px;
      margin: 16px 20px 0;
      background: linear-gradient(
        135deg,
        rgba(19, 127, 236, 0.12),
        rgba(30, 41, 59, 0.65)
      );
      border: 1px solid rgba(19, 127, 236, 0.25);
      border-radius: var(--radius-lg, 1rem);
      box-shadow: var(--shadow-lg, 0 10px 25px -5px rgba(0, 0, 0, 0.3));
    }

    .header {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .icon {
      width: 40px;
      height: 40px;
      border-radius: 12px;
      background: rgba(19, 127, 236, 0.2);
      display: grid;
      place-items: center;
      flex-shrink: 0;
    }

    .icon span {
      font-family: "Material Symbols Outlined";
      font-size: 22px;
      font-variation-settings: "FILL" 1, "wght" 400, "GRAD" 0, "opsz" 24;
      color: var(--color-primary, #137fec);
    }

    .title {
      font-size: 16px;
      font-weight: 700;
      letter-spacing: -0.02em;
      margin: 0;
    }

    .subtitle {
      font-size: 13px;
      color: var(--color-text-muted, #94a3b8);
      margin: 2px 0 0;
      line-height: 1.5;
    }

    .body {
      font-size: 13px;
      color: var(--color-text-muted, #94a3b8);
      line-height: 1.6;
    }

    .hint {
      font-size: 12px;
      color: var(--color-text-dim, #64748b);
      margin-top: 6px;
    }

    .actions {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }

    .install-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      height: 44px;
      padding: 0 18px;
      border-radius: var(--radius-md, 0.75rem);
      background: var(--color-primary, #137fec);
      color: #fff;
      font-size: 14px;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      cursor: pointer;
      border: none;
      transition: background 200ms ease, transform 100ms ease;
      -webkit-tap-highlight-color: transparent;
    }

    .install-btn:hover {
      background: var(--color-primary-hover, #1a8ff8);
    }

    .install-btn:active {
      transform: scale(0.98);
    }

    .install-btn[disabled] {
      opacity: 0.5;
      cursor: not-allowed;
      transform: none;
    }

    .secondary-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 12px;
      color: var(--color-text-muted, #94a3b8);
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      border-radius: var(--radius-full, 9999px);
      border: 1px solid rgba(148, 163, 184, 0.35);
      background: rgba(148, 163, 184, 0.12);
      transition: color 200ms ease, background 200ms ease, border-color 200ms ease;
      cursor: pointer;
    }

    .secondary-btn:hover {
      background: rgba(148, 163, 184, 0.2);
      border-color: rgba(148, 163, 184, 0.6);
      color: var(--color-text, #f1f5f9);
    }
  </style>

  <div class="card" role="region" aria-label="Install Breathwork Trainer">
    <div class="header">
      <div class="icon" aria-hidden="true">
        <span>download</span>
      </div>
      <div>
        <p class="title">Install Breathwork Trainer</p>
        <p class="subtitle">Add it to your home screen for a native feel.</p>
      </div>
    </div>

    <div class="body">
      Launch faster, keep sessions offline, and get a full-screen experience.
      <div class="hint" id="hint">Tap install to add it in one step.</div>
    </div>

    <div class="actions">
      <button class="install-btn" id="install-btn" type="button">
        Install app
      </button>
      <button class="secondary-btn" id="dismiss-btn" type="button">
        Not now
      </button>
    </div>
  </div>
`;

export class PwaInstallCard extends HTMLElement {
  static get observedAttributes(): string[] {
    return ["context", "can-install"];
  }

  #root: ShadowRoot;
  #installBtn: HTMLButtonElement | null = null;
  #dismissBtn: HTMLButtonElement | null = null;
  #hintEl: HTMLElement | null = null;
  #context: InstallContext = "home";
  #canInstall = false;
  #unsubscribe: (() => void) | null = null;
  #lastState: InstallState | null = null;

  constructor() {
    super();
    this.#root = this.attachShadow({ mode: "open" });
    this.#root.appendChild(TEMPLATE.content.cloneNode(true));
    this.#installBtn = this.#root.getElementById(
      "install-btn",
    ) as HTMLButtonElement | null;
    this.#dismissBtn = this.#root.getElementById(
      "dismiss-btn",
    ) as HTMLButtonElement | null;
    this.#hintEl = this.#root.getElementById("hint");
  }

  connectedCallback(): void {
    this.#installBtn?.addEventListener("click", this.#handleInstall);
    this.#dismissBtn?.addEventListener("click", this.#handleDismiss);
    this.#syncFromAttributes();
    this.#unsubscribe = pwaInstallController.subscribe((state) =>
      this.#syncFromState(state)
    );
    this.#render();
  }

  disconnectedCallback(): void {
    this.#installBtn?.removeEventListener("click", this.#handleInstall);
    this.#dismissBtn?.removeEventListener("click", this.#handleDismiss);
    this.#unsubscribe?.();
    this.#unsubscribe = null;
  }

  attributeChangedCallback(): void {
    this.#syncFromAttributes();
    this.#render();
  }

  set context(value: InstallContext) {
    this.#context = value;
    this.setAttribute("context", value);
  }

  get context(): InstallContext {
    return this.#context;
  }

  set canInstall(value: boolean) {
    this.#canInstall = value;
    this.setAttribute("can-install", value ? "true" : "false");
  }

  get canInstall(): boolean {
    return this.#canInstall;
  }

  #syncFromState(state: InstallState): void {
    this.#lastState = state;
    this.#canInstall = state.canInstall;
    this.setAttribute("can-install", state.canInstall ? "true" : "false");
    this.#applyVisibility();
    this.#render();
  }

  #syncFromAttributes(): void {
    const context = this.getAttribute("context");
    this.#context = context === "settings" ? "settings" : "home";

    const canInstall = this.getAttribute("can-install");
    this.#canInstall = canInstall === "true";
    this.#applyVisibility();
  }

  #applyVisibility(): void {
    if (!this.#lastState) return;
    const shouldShow = !this.#lastState.isInstalled &&
      (this.#context === "settings" || !this.#lastState.dismissedHomePrompt);

    if (shouldShow) {
      this.removeAttribute("hidden");
    } else {
      this.setAttribute("hidden", "");
    }
  }

  #render(): void {
    if (this.#installBtn) {
      this.#installBtn.disabled = !this.#canInstall;
    }

    if (this.#dismissBtn) {
      if (this.#context === "home") {
        this.#dismissBtn.removeAttribute("hidden");
      } else {
        this.#dismissBtn.setAttribute("hidden", "");
      }
    }

    if (this.#hintEl) {
      this.#hintEl.textContent = this.#canInstall
        ? "Tap install to add it in one step."
        : "Tap install to try. If nothing happens, use your browser menu to add it.";
    }
  }

  #handleInstall = () => {
    pwaInstallController.requestInstall();
    this.dispatchEvent(
      new CustomEvent("pwa-install", {
        bubbles: true,
        composed: true,
      }),
    );
  };

  #handleDismiss = () => {
    pwaInstallController.dismissHomePrompt();
    this.dispatchEvent(
      new CustomEvent("pwa-dismiss", {
        bubbles: true,
        composed: true,
      }),
    );
  };
}

customElements.define("pwa-install-card", PwaInstallCard);
