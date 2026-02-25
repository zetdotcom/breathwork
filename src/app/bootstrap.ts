import "./app-root.ts";
import { initPersistence } from "../data/persistence.ts";
import { audioController } from "../core/audio.ts";
import { hapticsController } from "../core/haptics.ts";
import { swUpdateController } from "../core/sw-update.ts";

/**
 * Register the service worker for offline PWA support and update checks.
 */
async function registerServiceWorker(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;

  try {
    const registration =
      await navigator.serviceWorker.register("/service-worker.js");
    console.log("SW registered:", registration.scope);

    swUpdateController.start(registration, {
      checkIntervalMs: 60 * 60 * 1000,
      checkOnVisibility: true,
    });
    swUpdateController.checkForUpdates();
  } catch (error) {
    console.warn("Service worker registration failed:", error);
  }
}

/**
 * Boot the application.
 *
 * The <app-root> element is already present in index.html,
 * so we only need to ensure it exists as a safety fallback,
 * then kick off SW registration.
 */
function boot(): void {
  // Safety fallback — mount <app-root> if somehow missing from HTML
  if (!document.querySelector("app-root")) {
    const root = document.createElement("app-root");
    document.body.appendChild(root);
  }

  // Hydrate store from IndexedDB (settings + session history), then
  // subscribe for future changes so they auto-persist.
  initPersistence().catch((err) => console.warn("Persistence init failed:", err));

  audioController.start();
  hapticsController.start();

  registerServiceWorker();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot, { once: true });
} else {
  boot();
}
