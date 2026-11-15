import { STORAGE_KEY } from '../config.js';

const DEFAULT_SAVE = {
  highestUnlockedLevel: 1,
  bossDefeated: false,
  levels: {},
  settings: {
    soundEnabled: true,
    musicVolume: 0.6,
    effectsVolume: 0.8,
    screenShake: true,
    crtEffect: true,
    unlockAllLevels: false,
  },
};

/**
 * Persists progress and settings in localStorage. Falls back to in-memory
 * state if storage is unavailable (private browsing, kiosk lockdown, etc.).
 */
export class SaveData {
  constructor() {
    this.data = this.load();
  }

  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return structuredClone(DEFAULT_SAVE);
      const parsed = JSON.parse(raw);
      return {
        ...structuredClone(DEFAULT_SAVE),
        ...parsed,
        settings: { ...DEFAULT_SAVE.settings, ...parsed.settings },
      };
    } catch (error) {
      console.warn('AFTERSHOCK: could not read save data, starting fresh.', error);
      return structuredClone(DEFAULT_SAVE);
    }
  }

  persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch (error) {
      console.warn('AFTERSHOCK: could not write save data.', error);
    }
  }

  get settings() {
    return this.data.settings;
  }

  updateSettings(changes) {
    Object.assign(this.data.settings, changes);
    this.persist();
  }

  isLevelUnlocked(levelNumber) {
    return this.data.settings.unlockAllLevels || levelNumber <= this.data.highestUnlockedLevel;
  }

  getLevelRecord(levelNumber) {
    return this.data.levels[levelNumber] ?? null;
  }

  /** Stores a finished run, keeping the best values seen so far. */
  recordLevelResult(levelNumber, result, totalLevels) {
    const previous = this.data.levels[levelNumber];
    this.data.levels[levelNumber] = {
      completed: true,
      bestTime: previous ? Math.min(previous.bestTime, result.time) : result.time,
      bestScore: previous ? Math.max(previous.bestScore, result.score) : result.score,
      shards: previous ? Math.max(previous.shards, result.shards) : result.shards,
      totalShards: result.totalShards,
      rank: bestRank(previous?.rank, result.rank),
    };
    this.data.highestUnlockedLevel = Math.max(
      this.data.highestUnlockedLevel,
      Math.min(levelNumber + 1, totalLevels),
    );
    this.persist();
  }

  recordBossDefeated() {
    this.data.bossDefeated = true;
    this.persist();
  }

  resetProgress() {
    this.data = { ...structuredClone(DEFAULT_SAVE), settings: this.data.settings };
    this.persist();
  }
}

const RANK_ORDER = ['C', 'B', 'A', 'S'];
function bestRank(a, b) {
  if (!a) return b;
  return RANK_ORDER.indexOf(a) >= RANK_ORDER.indexOf(b) ? a : b;
}
