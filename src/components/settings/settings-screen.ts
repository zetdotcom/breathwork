import { appStore } from "../../core/store.ts";
import type { Settings, Speed } from "../../core/app-state.ts";
import "../shared/segmented-control.ts";
import "../shared/toggle-switch.ts";
import type { SegmentedControl } from "../shared/segmented-control.ts";
import type { ToggleSwitch } from "../shared/toggle-switch.ts";

/**
 * Full-page settings screen rendered in the Settings tab.
 *
 * Sections (separated by horizontal rules):
 *   1. Prepare Time   — segmented control: 5s | 10s | 15s | 30s
 *   2. Breathing Speed — segmented control: Slow | Normal | Fast
 *   3. Default Breath Count — segmented control: 10 | 20 | 30 | 40 | 50
 *   4. Feedback        — toggle switches for Sound Effects & Haptics
 *
 * On change → updates the global store → settings persist and affect the
 * next session.
 *
 * Ref: stitch/session_settings_variant_1/screen.png
 */

const TEMPLATE = document.createElement("template");
TEMPLATE.innerHTML = `
  <style>
    :host {
      display: flex;
      flex-direction: column;
      min-height: 100%;
      background: var(--color-bg-dark, #101922);
      color: var(--color-text, #f1f5f9);
      font-family: var(--font-family, "Inter", system-ui, sans-serif);
    }

    /* ── Header ── */
    .header {
      display: flex;
      align-items: center;
      padding: 12px 16px;
      border-bottom: 1px solid var(--color-border-dark, #334155);
      position: sticky;
      top: 0;
      background: var(--color-bg-dark, #101922);
      z-index: 10;
    }

    .back-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      border: none;
      border-radius: 50%;
      background: none;
      color: var(--color-text-muted, #94a3b8);
      cursor: pointer;
      transition: background 200ms ease, color 200ms ease;
      -webkit-tap-highlight-color: transparent;
      flex-shrink: 0;
    }

    .back-btn:hover {
      background: var(--color-surface-dark, #1e293b);
      color: var(--color-text, #f1f5f9);
    }

    .back-btn .icon {
      font-family: "Material Symbols Outlined";
      font-size: 24px;
      font-variation-settings: "FILL" 0, "wght" 300, "GRAD" 0, "opsz" 24;
    }

    .header-title {
      flex: 1;
      text-align: center;
      font-size: 18px;
      font-weight: 700;
      letter-spacing: -0.025em;
      /* Offset for the back button width so title is truly centered */
      padding-right: 40px;
    }

    /* ── Content ── */
    .content {
      flex: 1;
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
      padding-bottom: 32px;
    }

    section {
      padding: 24px 20px 0;
    }

    section h3 {
      font-size: 16px;
      font-weight: 700;
      margin: 0 0 12px;
      color: #fff;
    }

    .helper-text {
      margin: 8px 0 0;
      font-size: 12px;
      color: var(--color-text-muted, #94a3b8);
      line-height: 1.5;
    }

    hr {
      border: none;
      border-top: 1px solid var(--color-border-dark, #334155);
      margin: 24px 20px 0;
    }

    /* ── Feedback section ── */
    .feedback-section {
      padding: 24px 20px 0;
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .feedback-section h3 {
      font-size: 16px;
      font-weight: 700;
      margin: 0 0 4px;
      color: #fff;
    }
  </style>

  <div class="header">
    <button class="back-btn" id="back-btn" aria-label="Go back">
      <span class="icon" aria-hidden="true">arrow_back</span>
    </button>
    <h2 class="header-title">Session Settings</h2>
  </div>

  <div class="content">
    <!-- Prepare Time -->
    <section>
      <h3>Prepare Time</h3>
      <segmented-control id="prepare-time" name="prepareTime"></segmented-control>
      <p class="helper-text">Time to relax before the breathing cycle begins.</p>
    </section>

    <hr />

    <!-- Breathing Speed -->
    <section>
      <h3>Breathing Speed</h3>
      <segmented-control id="breathing-speed" name="breathingSpeed"></segmented-control>
      <p class="helper-text">Adjust the rhythm of the inhale and exhale phases.</p>
    </section>

    <hr />

    <!-- Default Breath Count -->
    <section>
      <h3>Default Breath Count</h3>
      <segmented-control id="breath-count" name="breathCount"></segmented-control>
      <p class="helper-text">Total number of breaths per session.</p>
    </section>

    <hr />

    <!-- Feedback -->
    <div class="feedback-section">
      <h3>Feedback</h3>
      <toggle-switch id="sound-effects" name="soundEffects" label="Sound Effects"></toggle-switch>
      <toggle-switch id="haptics" name="haptics" label="Haptics"></toggle-switch>
    </div>
  </div>
`;

export class SettingsScreen extends HTMLElement {
  #root: ShadowRoot;
  #prepareTimeCtrl: SegmentedControl | null = null;
  #breathingSpeedCtrl: SegmentedControl | null = null;
  #breathCountCtrl: SegmentedControl | null = null;
  #soundToggle: ToggleSwitch | null = null;
  #hapticsToggle: ToggleSwitch | null = null;
  #backBtn: HTMLButtonElement | null = null;
  #unsubscribe: (() => void) | null = null;

  constructor() {
    super();
    this.#root = this.attachShadow({ mode: "open" });
    this.#root.appendChild(TEMPLATE.content.cloneNode(true));

    this.#prepareTimeCtrl = this.#root.getElementById("prepare-time") as SegmentedControl | null;
    this.#breathingSpeedCtrl = this.#root.getElementById("breathing-speed") as SegmentedControl | null;
    this.#breathCountCtrl = this.#root.getElementById("breath-count") as SegmentedControl | null;
    this.#soundToggle = this.#root.getElementById("sound-effects") as ToggleSwitch | null;
    this.#hapticsToggle = this.#root.getElementById("haptics") as ToggleSwitch | null;
    this.#backBtn = this.#root.getElementById("back-btn") as HTMLButtonElement | null;
  }

  connectedCallback() {
    const settings = appStore.getState().settings;

    // ── Configure segmented controls with options and current values ──

    if (this.#prepareTimeCtrl) {
      this.#prepareTimeCtrl.options = [
        { label: "5s", value: "5" },
        { label: "10s", value: "10" },
        { label: "15s", value: "15" },
        { label: "30s", value: "30" },
      ];
      this.#prepareTimeCtrl.value = String(settings.prepareSeconds);
    }

    if (this.#breathingSpeedCtrl) {
      this.#breathingSpeedCtrl.options = [
        { label: "Slow", value: "slow" },
        { label: "Normal", value: "normal" },
        { label: "Fast", value: "fast" },
      ];
      this.#breathingSpeedCtrl.value = settings.speed;
    }

    if (this.#breathCountCtrl) {
      this.#breathCountCtrl.options = [
        { label: "10", value: "10" },
        { label: "20", value: "20" },
        { label: "30", value: "30" },
        { label: "40", value: "40" },
        { label: "50", value: "50" },
      ];
      this.#breathCountCtrl.value = String(settings.breathCount);
    }

    // ── Configure toggles ──

    if (this.#soundToggle) {
      this.#soundToggle.checked = settings.soundEffects;
    }

    if (this.#hapticsToggle) {
      this.#hapticsToggle.checked = settings.haptics;
    }

    // ── Listen for changes ──

    this.#prepareTimeCtrl?.addEventListener("change", this.#handlePrepareTimeChange);
    this.#breathingSpeedCtrl?.addEventListener("change", this.#handleSpeedChange);
    this.#breathCountCtrl?.addEventListener("change", this.#handleBreathCountChange);
    this.#soundToggle?.addEventListener("change", this.#handleSoundChange);
    this.#hapticsToggle?.addEventListener("change", this.#handleHapticsChange);

    // Back button navigates to the Breathe tab
    this.#backBtn?.addEventListener("click", this.#handleBack);

    // Subscribe to store to keep controls in sync if settings change externally
    this.#unsubscribe = appStore.select(
      (s) => s.settings,
      (settings) => this.#syncFromStore(settings),
    );
  }

  disconnectedCallback() {
    this.#prepareTimeCtrl?.removeEventListener("change", this.#handlePrepareTimeChange);
    this.#breathingSpeedCtrl?.removeEventListener("change", this.#handleSpeedChange);
    this.#breathCountCtrl?.removeEventListener("change", this.#handleBreathCountChange);
    this.#soundToggle?.removeEventListener("change", this.#handleSoundChange);
    this.#hapticsToggle?.removeEventListener("change", this.#handleHapticsChange);
    this.#backBtn?.removeEventListener("click", this.#handleBack);
    this.#unsubscribe?.();
    this.#unsubscribe = null;
  }

  // ── Store update helper ─────────────────────────────────────────

  #updateSettings(partial: Partial<Settings>): void {
    const prev = appStore.getState().settings;
    appStore.setState(
      { settings: { ...prev, ...partial } },
      { source: "SettingsScreen", action: "UPDATE_SETTINGS" },
    );
  }

  // ── Event handlers ──────────────────────────────────────────────

  #handlePrepareTimeChange = (e: Event) => {
    const value = (e as CustomEvent).detail?.value;
    if (value != null) {
      this.#updateSettings({ prepareSeconds: Number(value) as Settings["prepareSeconds"] });
    }
  };

  #handleSpeedChange = (e: Event) => {
    const value = (e as CustomEvent).detail?.value;
    if (value != null) {
      this.#updateSettings({ speed: value as Speed });
    }
  };

  #handleBreathCountChange = (e: Event) => {
    const value = (e as CustomEvent).detail?.value;
    if (value != null) {
      this.#updateSettings({ breathCount: Number(value) as Settings["breathCount"] });
    }
  };

  #handleSoundChange = (e: Event) => {
    const checked = (e as CustomEvent).detail?.checked;
    if (checked != null) {
      this.#updateSettings({ soundEffects: checked });
    }
  };

  #handleHapticsChange = (e: Event) => {
    const checked = (e as CustomEvent).detail?.checked;
    if (checked != null) {
      this.#updateSettings({ haptics: checked });
    }
  };

  #handleBack = () => {
    appStore.setState(
      { activeTab: "breathe" },
      { source: "SettingsScreen", action: "NAVIGATE_BACK" },
    );
  };

  // ── Sync controls from external store updates ─────────────────

  #syncFromStore(settings: Settings): void {
    if (this.#prepareTimeCtrl) {
      this.#prepareTimeCtrl.value = String(settings.prepareSeconds);
    }
    if (this.#breathingSpeedCtrl) {
      this.#breathingSpeedCtrl.value = settings.speed;
    }
    if (this.#breathCountCtrl) {
      this.#breathCountCtrl.value = String(settings.breathCount);
    }
    if (this.#soundToggle) {
      this.#soundToggle.checked = settings.soundEffects;
    }
    if (this.#hapticsToggle) {
      this.#hapticsToggle.checked = settings.haptics;
    }
  }
}

customElements.define("settings-screen", SettingsScreen);
