import { appStore } from "../core/store.ts";
import { IndexedDBRepo } from "./indexeddb-repo.ts";
import type { SessionRecord } from "../core/app-state.ts";

/**
 * Persistence layer — syncs the global store with IndexedDB.
 *
 * Call `initPersistence()` once at app boot. It will:
 *   1. Hydrate the store with saved settings and sessions from IndexedDB.
 *   2. Subscribe to store changes and auto-persist:
 *      - Settings → saved on every change.
 *      - Sessions → a SessionRecord is saved when the phase becomes "summary".
 */

const repo = new IndexedDBRepo();

/** Tracks the current session's ID so we can upsert on repeated summaries. */
let currentSessionId: string | null = null;

/**
 * Load persisted data into the store, then subscribe for future changes.
 * Returns an unsubscribe function (useful for tests or teardown).
 */
export async function initPersistence(): Promise<() => void> {
  // ── 1. Hydrate ────────────────────────────────────────────────────

  const [savedSettings, savedSessions] = await Promise.all([
    repo.getSettings().catch(() => null),
    repo.getAllSessions().catch(() => [] as SessionRecord[]),
  ]);

  if (savedSettings) {
    const prev = appStore.getState().settings;
    // Merge saved settings over defaults so new keys added in future
    // versions still get their default values.
    appStore.setState(
      { settings: { ...prev, ...savedSettings } },
      { source: "Persistence", action: "HYDRATE_SETTINGS" },
    );
  }

  if (savedSessions.length > 0) {
    appStore.setState(
      { sessions: savedSessions },
      { source: "Persistence", action: "HYDRATE_SESSIONS" },
    );
  }

  appStore.setState(
    { hydrated: true },
    { source: "Persistence", action: "HYDRATE_DONE" },
  );

  // ── 2. Subscribe to changes ───────────────────────────────────────

  const cleanups: (() => void)[] = [];

  // Persist settings whenever they change.
  cleanups.push(
    appStore.select(
      (s) => s.settings,
      (settings) => {
        repo
          .saveSettings(settings)
          .catch((err) => console.warn("Failed to persist settings:", err));
      },
    ),
  );

  // When a new session starts, generate an ID for it.
  cleanups.push(
    appStore.select(
      (s) => s.sessionStartedAt,
      (startedAt) => {
        if (startedAt) {
          currentSessionId = crypto.randomUUID();
        } else {
          currentSessionId = null;
        }
      },
    ),
  );

  // When phase transitions to "summary", save the SessionRecord.
  cleanups.push(
    appStore.select(
      (s) => s.phase,
      (phase) => {
        if (phase !== "summary") return;

        const state = appStore.getState();
        if (!state.sessionStartedAt || state.rounds.length === 0) return;

        // Ensure we have an ID for this session.
        if (!currentSessionId) {
          currentSessionId = crypto.randomUUID();
        }

        const record: SessionRecord = {
          id: currentSessionId,
          startedAt: state.sessionStartedAt,
          finishedAt: new Date().toISOString(),
          rounds: [...state.rounds],
          settings: { ...state.settings },
        };

        // Update the store's sessions array (upsert).
        const existing = state.sessions.findIndex((s) => s.id === record.id);
        const updatedSessions =
          existing >= 0
            ? state.sessions.map((s) => (s.id === record.id ? record : s))
            : [record, ...state.sessions];

        appStore.setState(
          { sessions: updatedSessions },
          { source: "Persistence", action: "SAVE_SESSION" },
        );

        // Persist to IndexedDB.
        repo
          .saveSession(record)
          .catch((err) => console.warn("Failed to persist session:", err));
      },
    ),
  );

  return () => {
    for (const cleanup of cleanups) cleanup();
  };
}
