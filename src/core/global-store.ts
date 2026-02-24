// global-store.ts
// Deno/TS module singleton + EventTarget

export type UpdateMeta = {
  source?: string; // e.g. 'BreathCircle', 'HistoryLog'
  action?: string; // e.g. 'SET_PHASE', 'ADD_SESSION'
  timestamp?: number;
};

export type StateUpdater<State> =
  | Partial<State>
  | ((prev: State) => State);

export type StoreListener<State> = (
  next: State,
  prev: State,
  meta?: UpdateMeta,
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
      typeof updater === "function"
        ? (updater as (p: State) => State)(prev)
        : { ...prev, ...updater };

    if (Object.is(prev, next)) return;

    this.#state = next;
    const detail = { next, prev, meta };

    this.#events.dispatchEvent(
      new CustomEvent("change", { detail }),
    );
  }

  subscribe(listener: StoreListener<State>): Unsubscribe {
    const handler = (event: Event) => {
      const { next, prev, meta } = (event as CustomEvent).detail;
      listener(next, prev, meta);
    };

    this.#events.addEventListener("change", handler);
    return () => this.#events.removeEventListener("change", handler);
  }

  select<T>(
    selector: (state: State) => T,
    onChange: (value: T, prev: T) => void,
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
