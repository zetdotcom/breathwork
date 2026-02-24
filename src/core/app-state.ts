// ── Phase & Direction ────────────────────────────────────────────────

export type SessionPhase =
  | "idle"
  | "prepare"
  | "breathing"
  | "retention"
  | "recovery"
  | "round-break"
  | "summary";

export type BreathDirection = "inhale" | "exhale";

// ── Settings ─────────────────────────────────────────────────────────

export type Speed = "slow" | "normal" | "fast";

export type Settings = {
  prepareSeconds: 5 | 10 | 15 | 30;
  breathCount: 10 | 20 | 30 | 40 | 50;
  speed: Speed;
  soundEffects: boolean;
  haptics: boolean;
};

// ── Session Records (persisted) ──────────────────────────────────────

export type RoundRecord = {
  breathCount: number;
  retentionMs: number;
  recoveryMs: number;
};

export type SessionRecord = {
  id: string;
  startedAt: string; // ISO 8601
  finishedAt: string;
  rounds: RoundRecord[];
  settings: Settings;
};

// ── Navigation ───────────────────────────────────────────────────────

export type TabId = "breathe" | "stats" | "settings";

// ── Runtime AppState ─────────────────────────────────────────────────

export type AppState = {
  // Navigation
  activeTab: TabId;
  sessionActive: boolean;

  // Session (live)
  phase: SessionPhase;
  breathDirection: BreathDirection;
  currentBreath: number;
  targetBreathCount: number;
  prepareRemainingMs: number;
  breathProgress: number; // 0→1 within current half-cycle (inhale or exhale)
  retentionElapsedMs: number;
  recoveryRemainingMs: number;
  roundBreakRemainingMs: number;
  currentRound: number;
  rounds: RoundRecord[];
  sessionStartedAt: string | null; // ISO 8601

  // Persisted
  settings: Settings;
  sessions: SessionRecord[];
};

// ── Defaults ─────────────────────────────────────────────────────────

export const defaultSettings: Settings = {
  prepareSeconds: 10,
  breathCount: 30,
  speed: "normal",
  soundEffects: true,
  haptics: true,
};

export const initialState: AppState = {
  activeTab: "breathe",
  sessionActive: false,

  phase: "idle",
  breathDirection: "inhale",
  currentBreath: 0,
  targetBreathCount: defaultSettings.breathCount,
  prepareRemainingMs: defaultSettings.prepareSeconds * 1000,
  breathProgress: 0,
  retentionElapsedMs: 0,
  recoveryRemainingMs: 15_000,
  roundBreakRemainingMs: 10_000,
  currentRound: 0,
  rounds: [],
  sessionStartedAt: null,

  settings: defaultSettings,
  sessions: [],
};
