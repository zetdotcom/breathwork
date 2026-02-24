import type { AppState, TabId } from "../core/app-state.ts";

export type { TabId };

const VALID_TABS: Set<string> = new Set(["breathe", "stats", "settings"]);

/**
 * Parse the current URL hash into a valid TabId.
 * Falls back to "breathe" for unknown or empty hashes.
 */
export function parseHash(hash: string): TabId {
  const cleaned = hash.replace(/^#\/?/, "");
  return VALID_TABS.has(cleaned) ? (cleaned as TabId) : "breathe";
}

/**
 * Navigate to a tab by updating the URL hash.
 */
export function navigateTo(tab: TabId): void {
  if (!VALID_TABS.has(tab)) return;
  window.location.hash = `#${tab}`;
}

/**
 * Listen for route changes (hashchange) and invoke the callback
 * with the resolved TabId. Also fires immediately for the initial route.
 *
 * Returns an unsubscribe function.
 */
export function onRouteChange(callback: (tab: TabId) => void): () => void {
  const handler = () => {
    callback(parseHash(window.location.hash));
  };

  window.addEventListener("hashchange", handler);

  // Fire immediately for the initial route
  handler();

  return () => {
    window.removeEventListener("hashchange", handler);
  };
}

/**
 * Sync the router with the global store's activeTab.
 * Call this once at boot to keep hash and store in sync.
 */
export function syncRouterWithStore(store: {
  getState: () => AppState;
  setState: (
    updater: Partial<AppState> | ((prev: AppState) => AppState),
    meta?: { source?: string; action?: string },
  ) => void;
  select: <T>(
    selector: (state: AppState) => T,
    onChange: (value: T, prev: T) => void,
  ) => () => void;
}): () => void {
  // Hash → store
  const unsubRoute = onRouteChange((tab) => {
    const current = store.getState().activeTab;
    if (current !== tab) {
      store.setState(
        { activeTab: tab },
        { source: "router", action: "ROUTE_CHANGE" },
      );
    }
  });

  // Store → hash
  const unsubStore = store.select(
    (s) => s.activeTab,
    (tab) => {
      const hashTab = parseHash(window.location.hash);
      if (hashTab !== tab) {
        window.location.hash = `#${tab}`;
      }
    },
  );

  return () => {
    unsubRoute();
    unsubStore();
  };
}
