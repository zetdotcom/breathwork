# Global Store (Module Singleton + EventTarget)

This document defines a **native, dependency-free global state** for the app using:
- a **module-level singleton** store, and
- **EventTarget** for subscriptions.

It is intended for **Web Components + TypeScript** projects and is a lightweight alternative to Zustand.

---

## Goals

- **Single source of truth** for app state.
- **Typed** updates and selectors.
- **Minimal API**: `getState`, `setState`, `subscribe`, `select`.
- **No external dependencies** (Deno-friendly).
- **Works with Web Components** lifecycle.

---

## Architecture Overview

1. **Store module** exports a singleton store instance.
2. Internally, it holds a private state object.
3. `EventTarget` emits a change event after updates.
4. Components subscribe/unsubscribe in `connectedCallback`/`disconnectedCallback`.
5. Use **selectors** to reduce re-renders and isolate updates.

---

## Store API (Recommended)

- `getState(): State`
- `setState(updater: StateUpdater, meta?: UpdateMeta): void`
- `subscribe(listener: StoreListener): Unsubscribe`
- `select<T>(selector: (s: State) => T, onChange: (value: T, prev: T) => void): Unsubscribe`

### Types

- `State`: your full app state
- `StateUpdater`: either partial state or `(prev) => next`
- `UpdateMeta`: optional metadata (source, action, timestamp)
- `StoreListener`: `(next, prev, meta) => void`

---

## Implementation (Template)

```/dev/null/global-store.ts#L1-200
// global-store.ts
// Deno/TS module singleton + EventTarget

export type UpdateMeta = {
  source?: string;   // e.g. 'BreathCircle', 'HistoryLog'
  action?: string;   // e.g. 'SET_PHASE', 'ADD_SESSION'
  timestamp?: number;
};

export type StateUpdater<State> =
  | Partial<State>
  | ((prev: State) => State);

export type StoreListener<State> = (
  next: State,
  prev: State,
  meta?: UpdateMeta
) => void;

export type Unsubscribe = () => void;

export class Store<State extends Record<string, unknown>> {
  #state: State;
  #events = new EventTarget();

  constructor(initial: State) {
    this.#state = initial;
  }

  getState(): State {
    return this.#state;
  }

  setState(updater: StateUpdater<State>, meta?: UpdateMeta): void {
    const prev = this.#state;
    const next =
      typeof updater === 'function'
        ? (updater as (p: State) => State)(prev)
        : { ...prev, ...updater };

    if (Object.is(prev, next)) return;

    this.#state = next;
    const detail = { next, prev, meta };

    this.#events.dispatchEvent(
      new CustomEvent('change', { detail })
    );
  }

  subscribe(listener: StoreListener<State>): Unsubscribe {
    const handler = (event: Event) => {
      const { next, prev, meta } = (event as CustomEvent).detail;
      listener(next, prev, meta);
    };

    this.#events.addEventListener('change', handler);
    return () => this.#events.removeEventListener('change', handler);
  }

  select<T>(
    selector: (state: State) => T,
    onChange: (value: T, prev: T) => void
  ): Unsubscribe {
    let prevSelected = selector(this.#state);

    return this.subscribe((nextState) => {
      const nextSelected = selector(nextState);
      if (!Object.is(prevSelected, nextSelected)) {
        const last = prevSelected;
        prevSelected = nextSelected;
        onChange(nextSelected, last);
      }
    });
  }
}
```

---

## Defining Your App State

Define a **single state shape** to keep it consistent.

```/dev/null/app-state.ts#L1-120
export type Phase = 'prepare' | 'breathe' | 'hold' | 'recovery' | 'summary';

export type Settings = {
  prepareSeconds: number;
  breathCount: number;
  speed: 'slow' | 'normal' | 'fast';
};

export type Session = {
  startedAt: string;
  rounds: number[];
  settings: Settings;
};

export type AppState = {
  phase: Phase;
  timerMs: number;
  settings: Settings;
  sessions: Session[];
  isRunning: boolean;
};
```

---

## Create the Singleton Store

```/dev/null/store.ts#L1-80
import { Store } from './global-store.ts';
import type { AppState } from './app-state.ts';

export const initialState: AppState = {
  phase: 'prepare',
  timerMs: 0,
  settings: { prepareSeconds: 10, breathCount: 30, speed: 'normal' },
  sessions: [],
  isRunning: false,
};

export const appStore = new Store<AppState>(initialState);
```

---

## Using the Store in Web Components

### Subscribe on connect, unsubscribe on disconnect

```/dev/null/breath-circle.ts#L1-120
import { appStore } from './store.ts';

class BreathCircle extends HTMLElement {
  #unsub: (() => void) | null = null;

  connectedCallback() {
    // Initial render
    this.render(appStore.getState());

    // Subscribe to store changes
    this.#unsub = appStore.subscribe((next, prev) => {
      if (next.phase !== prev.phase || next.timerMs !== prev.timerMs) {
        this.render(next);
      }
    });
  }

  disconnectedCallback() {
    this.#unsub?.();
    this.#unsub = null;
  }

  render(state) {
    // update DOM based on state
  }
}

customElements.define('breath-circle', BreathCircle);
```

---

## Recommended Update Patterns

### 1) Partial update

```/dev/null/usage.ts#L1-40
appStore.setState({ phase: 'breathe' }, { action: 'SET_PHASE' });
```

### 2) Functional update (safe for derived updates)

```/dev/null/usage.ts#L1-40
appStore.setState((prev) => ({
  ...prev,
  timerMs: prev.timerMs + 1000,
}), { action: 'TICK' });
```

---

## Selectors for Focused Updates

```/dev/null/selector.ts#L1-60
const unsub = appStore.select(
  (s) => s.phase,
  (phase) => {
    // only run when phase changes
    console.log('phase changed:', phase);
  }
);
```

---

## Persistence Integration (Optional)

Use subscriptions to sync to IndexedDB/localStorage.

```/dev/null/persistence.ts#L1-80
appStore.subscribe((next, prev, meta) => {
  if (meta?.action === 'ADD_SESSION') {
    // write to IndexedDB
  }
});
```

---

## Best Practices

- **Immutable updates**: always return new objects/arrays to ensure change detection.
- **Small, focused events**: use `meta.action` to identify transitions.
- **Selectors**: reduce unnecessary DOM updates.
- **Lifecycle-safe**: subscribe in `connectedCallback`, unsubscribe in `disconnectedCallback`.
- **Single store**: avoid multiple stores unless you have strong boundaries.

---

## Troubleshooting

- **No UI update** → ensure you return a **new object** in `setState`.
- **Too many renders** → use `select()` or compare `prev/next`.
- **Memory leaks** → always unsubscribe in `disconnectedCallback`.

---

## Why This Approach?

- Native, portable, and minimal.
- Great for Deno + Web Components.
- Easy to test and reason about.
- A clean “Zustand-like” API without dependencies.