# Implementation Plan — breathwork-trainer (Frontend, PWA, Deno)

This document defines a phased implementation plan and a recommended folder structure for the minimal, modern, futuristic, AI‑enabled breathing trainer PWA. It is tailored for Deno + strict TypeScript + Vanilla JS (no Node/NPM), with local‑first persistence via IndexedDB.

**Design reference**: All screen designs live in `assets/stitch/`. Each subfolder contains a `screen.png` (visual) and `code.html` (reference markup). These are the source of truth for visual implementation.

---

## 0) Recommended Folder Structure (Deno + PWA + Web Components)

```
/ (repo root)
├─ .ai/
│  ├─ prd.md
│  ├─ mvp.md
│  ├─ project-context.md
│  ├─ global-store.md
│  └─ implementation-plan.md
├─ assets/
│  ├─ stitch/                    # design reference (Stitch exports)
│  │  ├─ power_breathing_session/
│  │  ├─ retention_hold_timer/
│  │  ├─ session_settings_variant_1/
│  │  ├─ session_settings_variant_2/
│  │  ├─ session_settings_variant_3/
│  │  └─ session_history_analytics/
│  ├─ audio/
│  │  └─ ambient-loop.mp3
│  ├─ icons/
│  │  ├─ icon-192.png
│  │  └─ icon-512.png
│  └─ images/
├─ src/
│  ├─ app/
│  │  ├─ app-root.ts             # top-level shell: mounts router + bottom nav
│  │  ├─ router.ts               # hash-based tab router (required)
│  │  └─ bootstrap.ts            # app init, SW registration, font/icon loading
│  ├─ components/
│  │  ├─ shared/
│  │  │  ├─ bottom-nav.ts        # persistent 3-tab bar (Breathe, Stats, Settings)
│  │  │  ├─ segmented-control.ts # reusable pill/chip selector
│  │  │  ├─ toggle-switch.ts     # on/off toggle
│  │  │  ├─ session-header.ts    # top bar: X close, title + status dot, gear icon
│  │  │  └─ phase-stepper.ts     # BREATHING → RETENTION → RECOVERY indicator
│  │  ├─ session/
│  │  │  ├─ breathing-screen.ts  # breathing phase: circle + counter + progress bar
│  │  │  ├─ breath-circle.ts     # animated SVG circle (LERP + RAF)
│  │  │  ├─ progress-bar.ts      # linear breath progress (12 / 30)
│  │  │  ├─ retention-screen.ts  # retention phase: timer circle + "I Need To Inhale"
│  │  │  ├─ recovery-screen.ts   # recovery phase: 15s countdown
│  │  │  └─ session-summary.ts   # post-session stats + actions
│  │  ├─ settings/
│  │  │  └─ settings-screen.ts   # full-page settings (segmented controls + toggles)
│  │  └─ history/
│  │     ├─ history-screen.ts    # History & Insights tab root
│  │     ├─ consistency-calendar.ts  # monthly calendar with practice-day highlights
│  │     ├─ retention-chart.ts   # line chart for retention trends
│  │     └─ session-card.ts      # single session row (icon, date, rounds, max)
│  ├─ core/
│  │  ├─ app-state.ts            # types for AppState, Session, Settings, Phase
│  │  ├─ store.ts                # global store singleton
│  │  ├─ state-machine.ts        # phase transitions + guards
│  │  ├─ timers.ts               # precise timers / RAF loop
│  │  ├─ breathing-engine.ts     # breath count + inhale/exhale sub-states + LERP
│  │  ├─ audio.ts                # audio cue controller
│  │  └─ haptics.ts              # Vibration API wrapper
│  ├─ data/
│  │  ├─ repository.ts           # SessionRepository interface
│  │  ├─ indexeddb-repo.ts       # IndexedDB implementation
│  │  └─ migrations.ts           # schema/versioning
│  ├─ styles/
│  │  ├─ base.css                # resets, layout scaffolding
│  │  ├─ tokens.css              # design tokens (see §1 below)
│  │  └─ components.css          # shared component styles
│  └─ utils/
│     ├─ dom.ts
│     ├─ time.ts                 # MM:SS.ms formatting helpers
│     ├─ math.ts                 # LERP, clamp, etc.
│     └─ events.ts               # custom event bus / helpers
├─ public/
│  ├─ index.html
│  ├─ manifest.json
│  └─ service-worker.js
├─ deno.json
└─ README.md
```

**Notes**
- Components are grouped by domain (`shared/`, `session/`, `settings/`, `history/`) for clarity.
- The `router.ts` is **required** — the app uses a 3‑tab bottom navigation model.
- Keep PWA assets in `public/`.

---

## 1) Design System & UI Direction

All visual decisions are derived from the Stitch designs.

### Design Tokens (`styles/tokens.css`)

| Token                  | Value                        | Usage                            |
|------------------------|------------------------------|----------------------------------|
| `--color-primary`      | `#137fec`                    | Buttons, active states, accents  |
| `--color-bg-dark`      | `#101922`                    | App background (dark mode)       |
| `--color-surface-dark` | `#1e293b` (slate-800)        | Cards, input backgrounds         |
| `--color-border-dark`  | `#334155` (slate-700)        | Card rings, dividers             |
| `--color-text`         | `#f1f5f9` (slate-100)        | Primary text                     |
| `--color-text-muted`   | `#94a3b8` (slate-400)        | Secondary / helper text          |
| `--font-family`        | `Inter, system-ui, sans-serif` | All text                       |
| `--radius-md`          | `0.75rem`                    | Cards, buttons                   |
| `--radius-full`        | `9999px`                     | Pills, segmented controls        |

### Typography
- Font: **Inter** (weights 400, 500, 600, 700).
- Tight tracking on headings (`letter-spacing: -0.025em`).
- Tabular nums for timers (`font-variant-numeric: tabular-nums`).

### Icons
- **Material Symbols Outlined** loaded via Google Fonts.
- Use `FILL 0, wght 300` for inactive nav; `FILL 1, wght 400` for active nav.

### Visual Effects
- Subtle blue glow on active circles: `box-shadow: 0 0 40px -10px rgba(19, 127, 236, 0.4)`.
- Dark mode by default. No light mode in MVP.
- Minimal motion: circle scale animation via LERP, phase transitions via opacity.

### Screen Hierarchy & Navigation

The app uses a **3‑tab bottom navigation bar**:

| Tab        | Icon (Material Symbol) | Screen                     |
|------------|------------------------|----------------------------|
| **Breathe** | `spa`                 | Home / active session      |
| **Stats**   | `bar_chart`           | History & Insights         |
| **Settings**| `settings`            | Session Settings (full page)|

During an active session, the session screens (breathing, retention, recovery, summary) render as a **full-screen overlay** with their own header (X close + title + gear icon), hiding the bottom nav.

### Screen Map

1. **Breathe Tab (idle)** — Start session button, last session summary.
2. **Breathing Session** *(overlay)* — Breath circle + "IN/INHALE" text + "12 / 30 BREATHS COMPLETED" + progress bar + phase stepper. "DOUBLE TAP TO SKIP" hint. *(Ref: `stitch/power_breathing_session`)*
3. **Retention Hold** *(overlay)* — Large timer circle showing MM:SS.ms elapsed + "Retention Phase" title + guidance text + "I NEED TO INHALE" CTA button + phase stepper. *(Ref: `stitch/retention_hold_timer`)*
4. **Recovery** *(overlay)* — 15s countdown (similar circle layout) + phase stepper.
5. **Session Summary** *(overlay)* — Total time, best retention, round list, Finish / New Round actions.
6. **Stats Tab** — Consistency calendar (monthly) + Retention Trends chart (last 7 days) + Recent Sessions list. *(Ref: `stitch/session_history_analytics`)*
7. **Settings Tab** — Segmented controls for Prepare Time / Speed / Breath Count + toggles for Sound & Haptics. *(Ref: `stitch/session_settings_variant_1`)*

---

## 2) AppState & Settings Types ✅ DONE

### Settings (persisted to IndexedDB / localStorage)

```ts
interface Settings {
  // Session config — segmented controls
  prepareSeconds: 5 | 10 | 15 | 30;       // default: 10
  breathCount: 10 | 20 | 30 | 40 | 50;    // default: 30
  speed: 'slow' | 'normal' | 'fast';       // default: 'normal'

  // Feedback — toggles
  soundEffects: boolean;                    // default: true
  haptics: boolean;                         // default: true
}
```

### Phase Enum

```ts
type SessionPhase =
  | 'idle'
  | 'prepare'      // countdown (prepareSeconds)
  | 'breathing'    // power breathing with inhale/exhale sub-states
  | 'retention'    // breath hold stopwatch
  | 'recovery'     // 15s countdown
  | 'summary';     // post-session
```

### Breathing Sub-State

```ts
type BreathDirection = 'inhale' | 'exhale';
```

### Session Record (persisted)

```ts
interface SessionRecord {
  id: string;
  startedAt: string;           // ISO 8601
  finishedAt: string;
  rounds: RoundRecord[];
  settings: Settings;
}

interface RoundRecord {
  breathCount: number;
  retentionMs: number;         // hold duration in milliseconds
  recoveryMs: number;
}
```

### AppState (runtime)

```ts
interface AppState {
  // Navigation
  activeTab: 'breathe' | 'stats' | 'settings';
  sessionActive: boolean;

  // Session (live)
  phase: SessionPhase;
  breathDirection: BreathDirection;
  currentBreath: number;
  targetBreathCount: number;
  retentionElapsedMs: number;
  recoveryRemainingMs: number;
  currentRound: number;
  rounds: RoundRecord[];

  // Persisted
  settings: Settings;
  sessions: SessionRecord[];
}
```

---

## 3) Phase 0 — Foundation & Architecture ✅ DONE

**Goal**: Deno project, PWA shell, store, router, bottom nav, design tokens.

### Steps
1. ✅ Configure `deno.json` with dev/build tasks and strict TypeScript.
2. ✅ Create `public/index.html`:
   - Load Inter font + Material Symbols Outlined from Google Fonts.
   - Link `styles/tokens.css` and `styles/base.css`.
   - Mount `<app-root>`.
3. ✅ Add `public/manifest.json` + `service-worker.js` scaffold.
4. ✅ Implement design tokens in `styles/tokens.css` (see §1). *(Implemented in `public/styles.css` combining tokens + base)*
5. ✅ Implement global store (`core/store.ts`) and typed `AppState` (`core/app-state.ts`). *(Store class in `core/global-store.ts`, app instance in `core/store.ts`)*
6. ✅ Build `router.ts` — simple hash-based router mapping `#breathe`, `#stats`, `#settings` to tab views.
7. ✅ Build `bottom-nav.ts` — 3 tabs (Breathe / spa, Stats / bar_chart, Settings / settings) with active state styling.
8. ✅ Create `app-root.ts` — mounts bottom nav + routes to placeholder tab views.

### Deliverables
- ✅ App boots, shows 3 working tabs with placeholder content and a styled bottom nav.
- ✅ Store is functional and reactive.

### Acceptance Criteria
- ✅ Tabs switch correctly via bottom nav.
- ✅ Design tokens produce the correct dark theme.
- ✅ Store updates reflect in `app-root`.

---

## 4) Phase 1 — Core Engine (MVP Must‑Haves) ✅ DONE

**Goal**: Complete session loop: Prepare → Breathing → Retention → Recovery → (repeat or Summary).

### Steps

#### 1. ✅ State Machine (`core/state-machine.ts`)
- ✅ Phases: `idle` → `prepare` → `breathing` → `retention` → `recovery` → `breathing` (next round) or `summary`.
- ✅ Guards for valid transitions only.
- ✅ Expose `transition(phase)` and `canTransition(phase)` functions.

#### 2. ✅ Session Header (`shared/session-header.ts`)
- ✅ Left: X (close / abort session).
- ✅ Center: title + green status dot (e.g., "POWER BREATHING").
- ✅ Right: gear icon (quick-access settings or disabled during session).
- Ref: top bar in `stitch/power_breathing_session`.

#### 3. ✅ Phase Stepper (`shared/phase-stepper.ts`)
- ✅ Horizontal indicator: **BREATHING** → **RETENTION** → **RECOVERY**.
- ✅ Active phase gets blue dot + bold label + "Current" badge.
- ✅ Inactive phases are dimmed with connecting lines.
- Ref: bottom of `stitch/power_breathing_session` and `stitch/retention_hold_timer`.

#### 4. ✅ Breathing Screen (`session/breathing-screen.ts`)
- ✅ Assembles: session header + breath circle + counter + progress bar + phase stepper.
- ✅ Shows inhale/exhale direction: large "IN" / "OUT" text + "INHALE" / "EXHALE" label inside circle.
- ✅ Counter: `currentBreath / targetBreathCount` + "BREATHS COMPLETED" label.
- ✅ Linear progress bar below counter.
- ✅ "DOUBLE TAP TO SKIP" hint at bottom.
- Ref: `stitch/power_breathing_session`.

#### 5. ✅ Breath Circle (`session/breath-circle.ts`)
- ✅ SVG circle that animates scale using LERP driven by `requestAnimationFrame`. *(Uses CSS transform scale with easeInOut smoothing)*
- ✅ Expanding = inhale, contracting = exhale.
- ✅ Speed governed by `settings.speed`:
  - Slow: ~4s inhale + 4s exhale.
  - Normal: ~2.5s + 2.5s.
  - Fast: ~1.5s + 1.5s.
- ✅ Subtle concentric ring decorations (outer glow rings visible in design).

#### 6. ✅ Progress Bar (`session/progress-bar.ts`)
- ✅ Thin horizontal bar.
- ✅ Fill width = `currentBreath / targetBreathCount * 100%`.
- ✅ Blue fill (`--color-primary`) on slate-700 track.

#### 7. ✅ Retention Screen (`session/retention-screen.ts`)
- ✅ Large circle displaying **TIME ELAPSED** label + **MM:SS.ms** (e.g., `01:42.05`).
- ✅ Blue glow effect on circle border.
- ✅ Below circle: "Retention Phase" heading + guidance text ("Hold your breath comfortably…").
- ✅ Prominent blue CTA: **"I NEED TO INHALE"** button — ends retention, starts recovery.
- ✅ Phase stepper at bottom with RETENTION active.
- Ref: `stitch/retention_hold_timer`.

#### 8. ✅ Recovery Screen (`session/recovery-screen.ts`)
- ✅ 15s countdown displayed in the same circle layout.
- ✅ Phase stepper with RECOVERY active.
- Audio/haptic cues at 10s, 5s, and 0s (if enabled). *(Audio/haptics deferred to Phase 6)*
- ✅ Auto-transitions to next round's `breathing` phase or to `summary` if user chooses to finish.

#### 9. ✅ Timers (`core/timers.ts`)
- ✅ Prepare: countdown from `prepareSeconds` to 0.
- ✅ Breathing: drives the LERP cycle, counts completed breaths.
- ✅ Retention: stopwatch counting up (millisecond precision, displayed as MM:SS.ms).
- ✅ Recovery: countdown from 15s to 0.

#### 10. ✅ Breathing Engine (`core/breathing-engine.ts`)
- ✅ Manages inhale/exhale sub-state toggling.
- ✅ Increments `currentBreath` at the end of each full cycle (inhale + exhale).
- ✅ Auto-ends breathing phase when `currentBreath === targetBreathCount`.
- ✅ Supports "double tap to skip" — immediately ends breathing phase.

#### 11. ✅ Session Recording
- ✅ Track `rounds[]` with `retentionMs` for each round.
- ✅ Track `startedAt` / `finishedAt`. *(via `sessionStartedAt` in AppState)*
- ✅ Store `settings` snapshot used for the session.

### Deliverables
- ✅ Fully functional breathing loop across all phases.
- ✅ Visual screens matching stitch designs for breathing and retention.

### Acceptance Criteria
- ✅ User can complete at least one full round (breathing → retention → recovery) and reach summary.
- ✅ Timer precision is correct (ms for retention, seconds for prepare/recovery).
- ✅ Phase stepper reflects current phase accurately.
- ✅ "DOUBLE TAP TO SKIP" works during breathing phase.
- ✅ "I NEED TO INHALE" ends retention and starts recovery.

---

## 5) Phase 2 — Settings Screen ✅ DONE

**Goal**: Full-page settings tab with segmented controls and toggles, matching Variant 1 design.

### Steps

#### 1. ✅ Segmented Control (`shared/segmented-control.ts`)
- Reusable Web Component.
- Props: `options` (label + value array), `name`, `selected`.
- Renders a pill-shaped container with radio-button options.
- Active option gets `--color-primary` background + white text.
- Ref: `stitch/session_settings_variant_1` — Prepare Time, Breathing Speed, Breath Count controls.

#### 2. ✅ Toggle Switch (`shared/toggle-switch.ts`)
- Reusable Web Component.
- Props: `checked`, `label`, `name`.
- Styled toggle matching the design (blue when on, slate when off).

#### 3. ✅ Settings Screen (`settings/settings-screen.ts`)
- Full-page view (rendered in Settings tab).
- Header: back arrow (or tab title) + "Session Settings" centered.
- Sections separated by horizontal rules:

  **Prepare Time**
  - Segmented control: `5s` | `10s` *(default)* | `15s` | `30s`
  - Helper text: "Time to relax before the breathing cycle begins."

  **Breathing Speed**
  - Segmented control: `Slow` | `Normal` *(default)* | `Fast`
  - Helper text: "Adjust the rhythm of the inhale and exhale phases."

  **Default Breath Count**
  - Segmented control: `10` | `20` | `30` *(default)* | `40` | `50`
  - Helper text: "Total number of breaths per session."

  **Feedback** *(below a divider)*
  - Sound Effects toggle (default: on)
  - Haptics toggle (default: on)

4. On change → update store → persist settings.

### Deliverables
- Settings tab visually matches `stitch/session_settings_variant_1`.
- All settings are reactive and persisted.

### Acceptance Criteria
- Changing Prepare Time / Speed / Breath Count affects the next session.
- Toggles for Sound Effects and Haptics persist across refreshes.
- Segmented controls show the correct active state.

---

## 6) Phase 3 — Persistence (IndexedDB) ✅ DONE

**Goal**: Local-first session and settings storage.

### Steps
1. ✅ Define `SessionRepository` interface in `data/repository.ts`.
2. ✅ Implement `data/indexeddb-repo.ts`:
   - Object store: `sessions` (keyed by `id`, indexed by `startedAt`).
   - Object store: `settings` (single record keyed by `"user-settings"`).
3. ✅ On session finish (`data/persistence.ts`):
   - Save `SessionRecord` via repository when phase transitions to `"summary"`.
   - Update store's `sessions` array (upsert by session ID).
4. ✅ On settings change (`data/persistence.ts`):
   - Persist `Settings` object via store subscription.
5. ✅ On app load (`app/bootstrap.ts` → `initPersistence()`):
   - Load all sessions and settings into store from IndexedDB.

### Deliverables
- Sessions and settings persist across refreshes and browser restarts.

### Acceptance Criteria
- Closing and reopening the app restores all history and settings.
- New sessions appear in the sessions list immediately.

---

## 7) Phase 4 — Session Summary ✅ DONE

**Goal**: Post-session summary screen with clear stats and actions.

### Steps
1. ✅ Create `session/session-summary.ts`.
2. ✅ Display:
   - ✅ Total session time (formatted).
   - ✅ Number of rounds completed.
   - ✅ Best retention time (max `retentionMs` across rounds).
   - ✅ List of each round's retention duration.
3. ✅ Actions:
   - ✅ **Finish** — save session, return to Breathe tab (idle).
   - ✅ **Start Another Round** — loop back to `breathing` phase.

### Acceptance Criteria
- ✅ Summary data is accurate.
- ✅ "Finish" persists the session and navigates to idle.
- ✅ "Start Another Round" correctly increments round number and resets breathing state.

---

## 8) Phase 5 — History & Insights ✅ DONE

**Goal**: Rich analytics tab matching the stitch design.

Ref: `stitch/session_history_analytics`

### Steps

#### 1. ✅ History Screen (`history/history-screen.ts`)
- ✅ Tab root for Stats.
- ✅ Header: "History & Insights".
- ✅ Assembles: consistency calendar + retention chart + recent sessions list.

#### 2. ✅ Consistency Calendar (`history/consistency-calendar.ts`)
- ✅ Monthly calendar grid (S M T W T F S).
- ✅ Navigation: `< OCT 2023 >` month switcher.
- ✅ Days with completed sessions get a blue filled circle.
- ✅ Today gets an outlined circle / highlight.
- ✅ Days without sessions are plain text.

#### 3. ✅ Retention Chart (`history/retention-chart.ts`)
- ✅ Section heading: "Retention Trends" with a "Last 7 Days" toggle/link.
- ✅ Bar chart plotting best retention time per day (last 7 days).
- ✅ Dotted baseline, minimal axis labels (M T W T F S S).

#### 4. ✅ Session Card (`history/session-card.ts`)
- ✅ Rounded card with:
  - ✅ Left: icon (from Material Symbols, e.g., `timer`, `air`, `self_improvement`).
  - ✅ Center: **Date** (e.g., "Oct 24") + secondary line: "3 Rounds • 2:15 max" (blue for max time).
  - ✅ Right: chevron `>`.

#### 5. ✅ Recent Sessions List
- ✅ Part of `history-screen.ts`.
- ✅ Renders a list of `session-card` components from the last N sessions.
- ✅ "View All History" link at bottom for future pagination.

### Acceptance Criteria
- ✅ Calendar correctly highlights days with sessions.
- ✅ Chart renders retention trends from persisted data.
- ✅ Session cards display accurate round count and best retention.
- ✅ Empty states are handled gracefully (no sessions yet).

---

## 9) Phase 6 — PWA Offline + Audio + Haptics

**Goal**: Offline-first experience, audio cues, and haptic feedback.

### Steps

#### 1. ✅ Service Worker (`public/service-worker.js`)
- ✅ Cache-first strategy for app shell (HTML, CSS, JS, fonts, icons).
- ✅ Cache audio assets for offline playback.
- ✅ Handle fetch failures gracefully.

#### 2. Audio Controller (`core/audio.ts`)
- Load and manage audio cues (phase transition sounds, countdown beeps).
- Play/pause tied to session phases:
  - Breathing phase: subtle ambient or breath rhythm cue.
  - Retention: silence or minimal ambient.
  - Recovery: countdown beeps at 10s, 5s, 3s, 2s, 1s, 0s.
- Respect `settings.soundEffects` toggle.

#### 3. Haptics Controller (`core/haptics.ts`)
- Wrapper around `navigator.vibrate()`.
- Trigger on:
  - Each inhale/exhale transition during breathing.
  - Recovery countdown cues.
  - Phase transitions.
- Respect `settings.haptics` toggle.
- Graceful no-op on unsupported devices.

### Acceptance Criteria
- App works fully offline after first visit.
- Audio cues play at correct moments (when enabled).
- Haptic feedback fires on supported devices (when enabled).
- Toggling Sound/Haptics off in settings immediately stops feedback.

---

## 10) Phase 7 — QA & Polish

**Goal**: Performance, accessibility, and edge-case reliability.

### Steps
1. **Performance**
   - Ensure 60fps circle animation (optimize DOM updates, minimize layout thrash).
   - Profile and reduce unnecessary re-renders in the store → component pipeline.
2. **Accessibility**
   - ARIA labels on all interactive elements.
   - Keyboard navigation for segmented controls, toggles, and buttons.
   - Screen reader announcements for phase transitions.
   - Focus management when session overlay opens/closes.
3. **Edge Cases**
   - App backgrounded during retention → timer continues accurately.
   - Double-tap debouncing to prevent accidental skips.
   - Rapid tab switching during an active session.
   - Browser back button behavior with session overlay.
4. **Visual Polish**
   - Smooth transitions between phases (opacity fade, not jarring swaps).
   - Loading/empty states for history tab.
   - Consistent spacing and alignment per stitch designs.

### Acceptance Criteria
- Smooth UI on mobile (iOS Safari, Android Chrome).
- No broken flows or timer drift.
- Passes basic accessibility audit (axe or Lighthouse).

---

## 11) Optional "AI‑Enabled" Enhancements (Non‑Blocking)

These can be stubbed with local heuristics — no external AI API required for MVP:

- **Pace suggestion**: Auto-suggest speed adjustment based on prior retention times (e.g., if retention is consistently > 2 min, suggest "Fast").
- **Calibration micro-copy**: Show "Calibrating pace…" text in first 2 rounds, then "Pace optimized" in subsequent rounds.
- **Post-session insight**: On summary screen, show a contextual line like "Best hold improved by 12s vs. last session" or "3-day streak! Keep it up."
- **Smart defaults**: After 5+ sessions, pre-fill breath count based on the user's average.

---

## Component ↔ Design Reference Map

| Component                   | Stitch Reference                           |
|-----------------------------|--------------------------------------------|
| `breathing-screen.ts`       | `stitch/power_breathing_session/screen.png` |
| `retention-screen.ts`       | `stitch/retention_hold_timer/screen.png`    |
| `settings-screen.ts`        | `stitch/session_settings_variant_1/screen.png` |
| `history-screen.ts`         | `stitch/session_history_analytics/screen.png` |
| `session-header.ts`         | Top bar in breathing + retention screens    |
| `phase-stepper.ts`          | Bottom indicator in breathing + retention   |
| `segmented-control.ts`      | All settings controls in variant 1          |
| `toggle-switch.ts`          | Feedback toggles in variant 2 (adapted)     |
| `session-card.ts`           | "Recent Sessions" rows in history           |
| `consistency-calendar.ts`   | "Consistency" section in history            |
| `retention-chart.ts`        | "Retention Trends" section in history       |

---

## Final Notes

- Keep code minimal, typed, and dependency-free.
- Prefer Web Components + the provided global store pattern.
- Router is required — the 3-tab model is the app's primary navigation.
- All component styling should reference `tokens.css` for consistency.
- When in doubt about visual details, consult the `screen.png` in the relevant stitch folder.
- Phase terminology: use **Breathing** / **Retention** / **Recovery** (not Breathe / Hold / Recovery) to match designs.