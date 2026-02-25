import { swUpdateController } from "../../core/sw-update.ts";

const TEMPLATE = document.createElement("template");
TEMPLATE.innerHTML = `
  <style>
    :host {
      position: fixed;
      left: 16px;
      right: 16px;
      bottom: calc(72px + var(--safe-bottom, 0px));
      z-index: 300;
      display: none;
      pointer-events: none;
      font-family: var(--font-family, "Inter", system-ui, sans-serif);
      color: var(--color-text, #f1f5f9);
      max-width: 520px;
      margin: 0 auto;
      transition: transform 200ms ease, opacity 200ms ease;
      transform: translateY(12px);
      opacity: 0;
    }

    :host([data-visible]) {
      display: block;
      pointer-events: auto;
      opacity: 1;
      transform: translateY(0);
    }

    .toast {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 14px 16px;
      border-radius: var(--radius-lg, 1rem);
      background: linear-gradient(
        135deg,
        rgba(19, 127, 236, 0.18),
        rgba(30, 41, 59, 0.9)
      );
      border: 1px solid rgba(19, 127, 236, 0.35);
      box-shadow: var(
        --shadow-lg,
        0 10px 25px -5px rgba(0, 0, 0, 0.35)
      );
      backdrop-filter: blur(8px);
    }

    .title {
      font-size: 14px;
      font-weight: 700;
      letter-spacing: -0.01em;
      margin: 0;
    }

    .subtitle {
      font-size: 12px;
      color: var(--color-text-muted, #94a3b8);
      margin: 0;
      line-height: 1.5;
    }

    .actions {
      display: flex;
      gap: 10px;
      align-items: center;
      flex-wrap: wrap;
    }

    .primary-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      height: 38px;
      padding: 0 14px;
      border-radius: var(--radius-md, 0.75rem);
      background: var(--color-primary, #137fec);
      color: #fff;
      border: none;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      cursor: pointer;
      transition: background 200ms ease, transform 100ms ease;
      -webkit-tap-highlight-color: transparent;
    }

    .primary-btn:hover {
      background: var(--color-primary-hover, #1a8ff8);
    }

    .primary-btn:active {
      transform: scale(0.98);
    }

    .secondary-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      height: 32px;
      padding: 0 12px;
      border-radius: var(--radius-full, 9999px);
      border: 1px solid rgba(148, 163, 184, 0.35);
      background: rgba(148, 163, 184, 0.12);
      color: var(--color-text-muted, #94a3b8);
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      cursor: pointer;
      transition: color 200ms ease, background 200ms ease, border-color 200ms ease;
    }

    .secondary-btn:hover {
      background: rgba(148, 163, 184, 0.2);
      border-color: rgba(148, 163, 184, 0.6);
      color: var(--color-text, #f1f5f9);
    }
  </style>

  <div class="toast" role="status" aria-live="polite" aria-atomic="true">
    <div>
      <p class="title">Update available</p>
      <p class="subtitle">
        A new version is ready. Reload to get the latest features.
      </p>
    </div>
    <div class="actions">
      <button class="primary-btn" id="reload-btn" type="button">
        Reload
      </button>
      <button class="secondary-btn" id="later-btn" type="button">
        Later
      </button>
    </div>
  </div>
`;

export class SwUpdateToast extends HTMLElement {
  #root: ShadowRoot;
  #reloadBtn: HTMLButtonElement | null = null;
  #laterBtn: HTMLButtonElement | null = null;
  #unsubscribe: (() => void) | null = null;
  #dismissed = false;
  #remindTimeoutId: number | null = null;

  constructor() {
    super();
    this.#root = this.attachShadow({ mode: "open" });
    this.#root.appendChild(TEMPLATE.content.cloneNode(true));
    this.#reloadBtn = this.#root.getElementById(
      "reload-btn",
    ) as HTMLButtonElement | null;
    this.#laterBtn = this.#root.getElementById(
      "later-btn",
    ) as HTMLButtonElement | null;
  }

  connectedCallback() {
    this.#reloadBtn?.addEventListener("click", this.#handleReload);
    this.#laterBtn?.addEventListener("click", this.#handleLater);

    this.#unsubscribe = swUpdateController.subscribe((state) => {
      if (state.hasUpdate && !this.#dismissed) {
        this.setAttribute("data-visible", "");
      } else {
        this.removeAttribute("data-visible");
      }
    });
  }

  disconnectedCallback() {
    this.#reloadBtn?.removeEventListener("click", this.#handleReload);
    this.#laterBtn?.removeEventListener("click", this.#handleLater);
    this.#unsubscribe?.();
    this.#unsubscribe = null;
    if (this.#remindTimeoutId !== null) {
      window.clearTimeout(this.#remindTimeoutId);
      this.#remindTimeoutId = null;
    }
  }

  #handleReload = () => {
    swUpdateController.applyUpdate();
  };

  #handleLater = () => {
    this.#dismissed = true;
    this.removeAttribute("data-visible");
    if (this.#remindTimeoutId !== null) {
      window.clearTimeout(this.#remindTimeoutId);
    }
    this.#remindTimeoutId = window.setTimeout(
      () => {
        if (swUpdateController.getState().hasUpdate) {
          this.#dismissed = false;
          this.setAttribute("data-visible", "");
        }
      },
      30 * 60 * 1000,
    );
  };
}

customElements.define("sw-update-toast", SwUpdateToast);
