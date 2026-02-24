import type { SessionRecord, Settings } from "../core/app-state.ts";
import type { SessionRepository } from "./repository.ts";

const DB_NAME = "breathwork-trainer";
const DB_VERSION = 1;

const STORE_SESSIONS = "sessions";
const STORE_SETTINGS = "settings";

/** Single key used for the settings record (only one settings object exists). */
const SETTINGS_KEY = "user-settings";

/**
 * Open (or create) the IndexedDB database.
 * Returns a promise that resolves with the database instance.
 */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      // Sessions store — keyed by `id`, indexed by `startedAt` for ordering.
      if (!db.objectStoreNames.contains(STORE_SESSIONS)) {
        const store = db.createObjectStore(STORE_SESSIONS, { keyPath: "id" });
        store.createIndex("startedAt", "startedAt", { unique: false });
      }

      // Settings store — simple key/value (single record).
      if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
        db.createObjectStore(STORE_SETTINGS);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * IndexedDB-backed implementation of `SessionRepository`.
 *
 * Lazily opens the database on first access and reuses the connection.
 * All public methods are async and safe to call at any time.
 */
export class IndexedDBRepo implements SessionRepository {
  #dbPromise: Promise<IDBDatabase> | null = null;

  /** Lazy singleton connection. */
  #getDB(): Promise<IDBDatabase> {
    if (!this.#dbPromise) {
      this.#dbPromise = openDB();
    }
    return this.#dbPromise;
  }

  // ── Sessions ────────────────────────────────────────────────────

  async getAllSessions(): Promise<SessionRecord[]> {
    const db = await this.#getDB();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_SESSIONS, "readonly");
      const store = tx.objectStore(STORE_SESSIONS);
      const index = store.index("startedAt");

      // Iterate in descending order (most recent first).
      const request = index.openCursor(null, "prev");
      const results: SessionRecord[] = [];

      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          results.push(cursor.value as SessionRecord);
          cursor.continue();
        } else {
          resolve(results);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  async saveSession(record: SessionRecord): Promise<void> {
    const db = await this.#getDB();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_SESSIONS, "readwrite");
      const store = tx.objectStore(STORE_SESSIONS);
      store.put(record);

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async deleteSession(id: string): Promise<void> {
    const db = await this.#getDB();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_SESSIONS, "readwrite");
      const store = tx.objectStore(STORE_SESSIONS);
      store.delete(id);

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // ── Settings ────────────────────────────────────────────────────

  async getSettings(): Promise<Settings | null> {
    const db = await this.#getDB();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_SETTINGS, "readonly");
      const store = tx.objectStore(STORE_SETTINGS);
      const request = store.get(SETTINGS_KEY);

      request.onsuccess = () => resolve((request.result as Settings) ?? null);
      request.onerror = () => reject(request.error);
    });
  }

  async saveSettings(settings: Settings): Promise<void> {
    const db = await this.#getDB();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_SETTINGS, "readwrite");
      const store = tx.objectStore(STORE_SETTINGS);
      store.put(settings, SETTINGS_KEY);

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}
