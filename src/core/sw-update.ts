type UpdateState = {
  isSupported: boolean;
  isRegistered: boolean;
  hasUpdate: boolean;
  isUpdating: boolean;
  lastCheckedAt: number | null;
};

export type UpdateListener = (state: UpdateState) => void;

type UpdateOptions = {
  /**
   * How often to call registration.update() (ms).
   * Defaults to 1 hour.
   */
  checkIntervalMs?: number;
  /**
   * Trigger a check when the page becomes visible.
   */
  checkOnVisibility?: boolean;
};

const DEFAULT_STATE: UpdateState = {
  isSupported: "serviceWorker" in navigator,
  isRegistered: false,
  hasUpdate: false,
  isUpdating: false,
  lastCheckedAt: null,
};

const DEFAULT_OPTIONS: Required<UpdateOptions> = {
  checkIntervalMs: 60 * 60 * 1000,
  checkOnVisibility: true,
};

export class SwUpdateController {
  #state: UpdateState = { ...DEFAULT_STATE };
  #listeners = new Set<UpdateListener>();
  #registration: ServiceWorkerRegistration | null = null;
  #intervalId: number | null = null;
  #options: Required<UpdateOptions> = { ...DEFAULT_OPTIONS };

  getState(): UpdateState {
    return { ...this.#state };
  }

  subscribe(listener: UpdateListener): () => void {
    this.#listeners.add(listener);
    listener(this.getState());
    return () => {
      this.#listeners.delete(listener);
    };
  }

  /**
   * Start monitoring SW updates for a given registration.
   * Call this after registration succeeds.
   */
  start(
    registration: ServiceWorkerRegistration,
    options?: UpdateOptions,
  ): void {
    if (!this.#state.isSupported) return;

    this.#registration = registration;
    this.#options = { ...DEFAULT_OPTIONS, ...(options ?? {}) };
    this.#update({ isRegistered: true });

    this.#bindRegistration(registration);
    this.#setupPeriodicChecks();

    // If there's already a waiting worker, surface it immediately.
    if (registration.waiting) {
      this.#markUpdateReady();
    }
  }

  /**
   * Manually trigger an update check.
   */
  async checkForUpdates(): Promise<void> {
    if (!this.#registration) return;
    this.#update({ isUpdating: true });
    try {
      await this.#registration.update();
    } catch (error) {
      console.warn("Service worker update check failed:", error);
    } finally {
      this.#update({
        isUpdating: false,
        lastCheckedAt: Date.now(),
      });
    }
  }

  /**
   * Apply the update by telling the waiting SW to activate,
   * then reloading once control changes.
   */
  async applyUpdate(): Promise<void> {
    if (!this.#registration?.waiting) return;

    const waiting = this.#registration.waiting;

    const onControllerChange = () => {
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        onControllerChange,
      );
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener(
      "controllerchange",
      onControllerChange,
    );

    waiting.postMessage({ type: "SKIP_WAITING" });
  }

  #bindRegistration(registration: ServiceWorkerRegistration): void {
    registration.addEventListener("updatefound", () => {
      const newWorker = registration.installing;
      if (!newWorker) return;

      newWorker.addEventListener("statechange", () => {
        if (
          newWorker.state === "installed" &&
          navigator.serviceWorker.controller
        ) {
          this.#markUpdateReady();
        }
      });
    });
  }

  #setupPeriodicChecks(): void {
    if (this.#intervalId) {
      window.clearInterval(this.#intervalId);
      this.#intervalId = null;
    }

    this.#intervalId = window.setInterval(() => {
      this.checkForUpdates();
    }, this.#options.checkIntervalMs);

    if (this.#options.checkOnVisibility) {
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") {
          this.checkForUpdates();
        }
      });
    }
  }

  #markUpdateReady(): void {
    this.#update({ hasUpdate: true });
  }

  #update(partial: Partial<UpdateState>): void {
    const next = { ...this.#state, ...partial };
    const changed = Object.keys(next).some(
      (key) =>
        next[key as keyof UpdateState] !==
        this.#state[key as keyof UpdateState],
    );
    this.#state = next;
    if (changed) {
      for (const listener of this.#listeners) listener(this.getState());
    }
  }
}

export const swUpdateController = new SwUpdateController();
