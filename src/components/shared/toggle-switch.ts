/**
 * Reusable toggle switch Web Component.
 *
 * Attributes:
 *   - `name`    — form field name (reflected)
 *   - `label`   — visible label text
 *   - `checked` — boolean attribute; presence = on
 *
 * Events:
 *   - `change` — CustomEvent<{ name: string; checked: boolean }>
 *
 * Styled to match the app design system:
 *   - Blue track when on (`--color-primary`)
 *   - Slate track when off (`--color-border-dark`)
 *   - White knob with smooth slide transition
 *
 * Ref: `stitch/session_settings_variant_2` — Feedback toggles (adapted)
 */

const TEMPLATE = document.createElement("template");
TEMPLATE.innerHTML = `
  <style>
    :host {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
      user-select: none;
    }

    .label {
      font-size: 14px;
      font-weight: 500;
      color: var(--color-text, #f1f5f9);
      line-height: 1.4;
    }

    /* Hidden native checkbox for accessibility */
    input {
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

    .track {
      position: relative;
      flex-shrink: 0;
      width: 48px;
      height: 28px;
      border-radius: 9999px;
      background: var(--color-border-dark, #334155);
      transition: background 200ms ease;
    }

    :host([checked]) .track {
      background: var(--color-primary, #137fec);
    }

    .knob {
      position: absolute;
      top: 3px;
      left: 3px;
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: #fff;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
      transition: transform 200ms ease;
    }

    :host([checked]) .knob {
      transform: translateX(20px);
    }

    /* Focus ring on the track when checkbox is focused */
    input:focus-visible + .track {
      outline: 2px solid var(--color-primary, #137fec);
      outline-offset: 2px;
    }
  </style>

  <span class="label" id="label-text"></span>
  <input type="checkbox" role="switch" aria-labelledby="label-text" />
  <div class="track">
    <div class="knob"></div>
  </div>
`;

export class ToggleSwitch extends HTMLElement {
  #root: ShadowRoot;
  #checkbox: HTMLInputElement | null = null;
  #labelEl: HTMLElement | null = null;

  static get observedAttributes(): string[] {
    return ["checked", "label", "name"];
  }

  constructor() {
    super();
    this.#root = this.attachShadow({ mode: "open" });
    this.#root.appendChild(TEMPLATE.content.cloneNode(true));

    this.#checkbox = this.#root.querySelector("input");
    this.#labelEl = this.#root.getElementById("label-text");
  }

  connectedCallback() {
    // Sync initial attribute state
    if (this.#checkbox) {
      this.#checkbox.checked = this.hasAttribute("checked");
      this.#checkbox.name = this.getAttribute("name") ?? "";
    }
    if (this.#labelEl) {
      this.#labelEl.textContent = this.getAttribute("label") ?? "";
    }

    // Click on the whole host toggles the switch
    this.addEventListener("click", this.#handleClick);
    // Keyboard support via the hidden checkbox
    this.#checkbox?.addEventListener("change", this.#handleInputChange);
  }

  disconnectedCallback() {
    this.removeEventListener("click", this.#handleClick);
    this.#checkbox?.removeEventListener("change", this.#handleInputChange);
  }

  attributeChangedCallback(
    name: string,
    _oldValue: string | null,
    newValue: string | null,
  ) {
    switch (name) {
      case "checked":
        if (this.#checkbox) {
          this.#checkbox.checked = newValue !== null;
        }
        break;
      case "label":
        if (this.#labelEl) {
          this.#labelEl.textContent = newValue ?? "";
        }
        break;
      case "name":
        if (this.#checkbox) {
          this.#checkbox.name = newValue ?? "";
        }
        break;
    }
  }

  // ── Public property accessors ─────────────────────────────────────

  get checked(): boolean {
    return this.hasAttribute("checked");
  }

  set checked(value: boolean) {
    if (value) {
      this.setAttribute("checked", "");
    } else {
      this.removeAttribute("checked");
    }
  }

  get name(): string {
    return this.getAttribute("name") ?? "";
  }

  set name(value: string) {
    this.setAttribute("name", value);
  }

  get label(): string {
    return this.getAttribute("label") ?? "";
  }

  set label(value: string) {
    this.setAttribute("label", value);
  }

  // ── Event handlers ────────────────────────────────────────────────

  #handleClick = (e: Event) => {
    // Prevent double-firing if the click originated from the checkbox itself
    if ((e.target as HTMLElement)?.tagName === "INPUT") return;

    this.#toggle();
  };

  #handleInputChange = () => {
    // Sync attribute with the checkbox's state
    const isChecked = this.#checkbox?.checked ?? false;
    if (isChecked) {
      this.setAttribute("checked", "");
    } else {
      this.removeAttribute("checked");
    }

    this.#emitChange();
  };

  #toggle(): void {
    const next = !this.checked;
    this.checked = next;

    if (this.#checkbox) {
      this.#checkbox.checked = next;
    }

    this.#emitChange();
  }

  #emitChange(): void {
    this.dispatchEvent(
      new CustomEvent("change", {
        bubbles: true,
        composed: true,
        detail: {
          name: this.name,
          checked: this.checked,
        },
      }),
    );
  }
}

customElements.define("toggle-switch", ToggleSwitch);
