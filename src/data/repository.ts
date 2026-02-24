import type { SessionRecord, Settings } from "../core/app-state.ts";

/**
 * Persistence abstraction for sessions and settings.
 *
 * Implementations may use IndexedDB, localStorage, or an in-memory store
 * (useful for testing). The app code depends only on this interface.
 */
export interface SessionRepository {
  /** Retrieve all saved sessions, ordered by `startedAt` descending. */
  getAllSessions(): Promise<SessionRecord[]>;

  /** Save or update a session record (upsert by `id`). */
  saveSession(record: SessionRecord): Promise<void>;

  /** Delete a session by its `id`. */
  deleteSession(id: string): Promise<void>;

  /** Retrieve persisted settings, or `null` if none saved yet. */
  getSettings(): Promise<Settings | null>;

  /** Persist the full settings object (overwrites previous). */
  saveSettings(settings: Settings): Promise<void>;
}
