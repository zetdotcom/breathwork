export type InstallState = {
  canInstall: boolean;
  isInstalled: boolean;
  dismissedHomePrompt: boolean;
};

export type InstallStateListener = (state: InstallState) => void;

type BeforeInstallPromptEvent = Event & {
  readonly platforms?: string[];
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform?: string }>;
};

const DISMISS_KEY = "pwa-install-dismissed-home";
const DEFAULT_STATE: InstallState = {
  canInstall: false,
  isInstalled: false,
  dismissedHomePrompt: false,
};

function isStandaloneDisplay(): boolean {
  return (
    window.matchMedia?.("(display-mode: standalone)")?.matches === true ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export class PwaInstallController {
  #state: InstallState = { ...DEFAULT_STATE };
  #listeners = new Set<InstallStateListener>();
  #deferredPrompt: BeforeInstallPromptEvent | null = null;

  constructor() {
    this.#state.dismissedHomePrompt = this.#loadDismissed();
    this.#state.isInstalled = isStandaloneDisplay();
    this.#bindEvents();
  }

  getState(): InstallState {
    return { ...this.#state };
  }

  subscribe(listener: InstallStateListener): () => void {
    this.#listeners.add(listener);
    listener(this.getState());
    return () => {
      this.#listeners.delete(listener);
    };
  }

  requestInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
    if (!this.#deferredPrompt) return Promise.resolve("unavailable");

    const promptEvent = this.#deferredPrompt;
    this.#deferredPrompt = null;
    this.#update({ canInstall: false });

    return promptEvent
      .prompt()
      .then(async () => {
        const choice = await promptEvent.userChoice;
        if (choice.outcome === "accepted") {
          this.#update({ dismissedHomePrompt: true });
          this.#persistDismissed(true);
        } else {
          this.#update({ dismissedHomePrompt: true });
          this.#persistDismissed(true);
        }
        return choice.outcome;
      })
      .catch(() => {
        this.#update({ dismissedHomePrompt: true });
        this.#persistDismissed(true);
        return "dismissed";
      });
  }

  dismissHomePrompt(): void {
    if (this.#state.dismissedHomePrompt) return;
    this.#update({ dismissedHomePrompt: true });
    this.#persistDismissed(true);
  }

  resetHomePromptDismissal(): void {
    this.#update({ dismissedHomePrompt: false });
    this.#persistDismissed(false);
  }

  #bindEvents(): void {
    window.addEventListener("beforeinstallprompt", (event) => {
      event.preventDefault();
      this.#deferredPrompt = event as BeforeInstallPromptEvent;
      this.#update({
        canInstall: !this.#state.isInstalled,
      });
    });

    window.addEventListener("appinstalled", () => {
      this.#deferredPrompt = null;
      this.#update({
        isInstalled: true,
        canInstall: false,
        dismissedHomePrompt: true,
      });
    });

    window.addEventListener("focus", () => {
      const installed = isStandaloneDisplay();
      if (installed !== this.#state.isInstalled) {
        this.#update({
          isInstalled: installed,
          canInstall: installed ? false : this.#state.canInstall,
        });
      }
    });
  }

  #update(partial: Partial<InstallState>): void {
    const next = { ...this.#state, ...partial };
    const changed = Object.keys(next).some(
      (key) =>
        next[key as keyof InstallState] !==
        this.#state[key as keyof InstallState],
    );
    this.#state = next;
    if (changed) {
      for (const listener of this.#listeners) listener(this.getState());
    }
  }

  #loadDismissed(): boolean {
    try {
      const raw = localStorage.getItem(DISMISS_KEY);
      return raw === "true";
    } catch {
      return false;
    }
  }

  #persistDismissed(value: boolean): void {
    try {
      localStorage.setItem(DISMISS_KEY, String(value));
    } catch {
      // Ignore storage errors
    }
  }
}

export const pwaInstallController = new PwaInstallController();
