/**
 * Reusable segmented control Web Component.
 *
 * A pill-shaped container with radio-button options. The active option
 * gets `--color-primary` background + white text.
 *
 * Usage:
 *   <segmented-control name="speed" value="normal"></segmented-control>
 *
 * Set options programmatically:
 *   el.options = [
 *     { label: "Slow", value: "slow" },
 *     { label: "Normal", value: "normal" },
 *     { label: "Fast", value: "fast" },
 *   ];
 *
 * Listens for `change` CustomEvent with `detail.value`.
 *
 * Ref: stitch/session_settings_variant_1 — Prepare Time, Breathing Speed,
 *      Breath Count controls.
 */

export type SegmentOption = {
  label: string;
  value: string;
};

const TEMPLATE = document.createElement("template");
TEMPLATE.innerHTML = `
  <style>
    :host {
      display: block;
    }

    .container {
      display: flex;
      border-radius: var(--radius-md, 0.75rem);
      background: var(--color-surface-dark, #1e293b);
      padding: 4px;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
      border: 1px solid var(--color-border-dark, #334155);
    }

    label {
      flex: 1;
      cursor: pointer;
      min-width: 0;
    }

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

    .option {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 40px;
      border-radius: calc(var(--radius-md, 0.75rem) - 2px);
      font-size: 14px;
      font-weight: 500;
      font-family: var(--font-family, "Inter", system-ui, sans-serif);
      color: var(--color-text-muted, #94a3b8);
      transition: background 200ms ease, color 200ms ease;
      user-select: none;
      -webkit-tap-highlight-color: transparent;
      padding: 0 4px;
      white-space: nowrap;
    }

    .option:hover {
      color: var(--color-text, #f1f5f9);
    }

    input:checked + .option {
      background: var(--color-primary, #137fec);
      color: #fff;
      font-weight: 600;
    }

    input:focus-visible + .option {
      outline: 2px solid var(--color-primary, #137fec);
      outline-offset: 2px;
    }
  </style>

  <div class="container" role="radiogroup"></div>
`;

export class SegmentedControl extends HTMLElement {
  #root: ShadowRoot;
  #container: HTMLElement;
  #options: SegmentOption[] = [];
  #value = "";
  #name = "";

  static get observedAttributes(): string[] {
    return ["name", "value"];
  }

  constructor() {
    super();
    this.#root = this.attachShadow({ mode: "open" });
    this.#root.appendChild(TEMPLATE.content.cloneNode(true));
    this.#container = this.#root.querySelector(".container") as HTMLElement;
  }

  // ── Public properties ───────────────────────────────────────────

  get options(): SegmentOption[] {
    return this.#options;
  }

  set options(opts: SegmentOption[]) {
    this.#options = opts;
    this.#render();
  }

  get value(): string {
    return this.#value;
  }

  set value(val: string) {
    if (this.#value === val) return;
    this.#value = val;
    this.#syncChecked();
  }

  get name(): string {
    return this.#name;
  }

  set name(val: string) {
    this.#name = val;
  }

  // ── Lifecycle ───────────────────────────────────────────────────

  connectedCallback() {
    this.#container.addEventListener("change", this.#handleChange);

    // Read initial attribute values
    if (this.hasAttribute("name")) {
      this.#name = this.getAttribute("name") ?? "";
    }
    if (this.hasAttribute("value")) {
      this.#value = this.getAttribute("value") ?? "";
    }

    // Set aria-label from name
    if (this.#name) {
      this.#container.setAttribute("aria-label", this.#name);
    }

    // Render if options were set before connection
    if (this.#options.length > 0) {
      this.#render();
    }
  }

  disconnectedCallback() {
    this.#container.removeEventListener("change", this.#handleChange);
  }

  attributeChangedCallback(
    attr: string,
    _old: string | null,
    val: string | null,
  ) {
    if (attr === "name") {
      this.#name = val ?? "";
      this.#container.setAttribute("aria-label", this.#name);
    } else if (attr === "value") {
      this.#value = val ?? "";
      this.#syncChecked();
    }
  }

  // ── Rendering ─────────────────────────────────────────────────

  #render() {
    this.#container.innerHTML = "";

    for (const opt of this.#options) {
      const label = document.createElement("label");

      const input = document.createElement("input");
      input.type = "radio";
      input.name = this.#name;
      input.value = opt.value;
      input.checked = opt.value === this.#value;

      const div = document.createElement("div");
      div.className = "option";
      div.textContent = opt.label;

      label.appendChild(input);
      label.appendChild(div);
      this.#container.appendChild(label);
    }
  }

  /**
   * Sync the checked radio button to match `this.#value`
   * without rebuilding the entire DOM.
   */
  #syncChecked() {
    const inputs = this.#container.querySelectorAll("input[type='radio']");
    for (const input of inputs) {
      const radio = input as HTMLInputElement;
      radio.checked = radio.value === this.#value;
    }
  }

  // ── Event handling ────────────────────────────────────────────

  #handleChange = (e: Event) => {
    const target = e.target as HTMLInputElement;
    if (target.type !== "radio") return;

    this.#value = target.value;

    // Dispatch custom change event for parent components to listen to
    this.dispatchEvent(
      new CustomEvent("change", {
        detail: { value: this.#value, name: this.#name },
        bubbles: true,
        composed: true,
      }),
    );
  };
}

customElements.define("segmented-control", SegmentedControl);
