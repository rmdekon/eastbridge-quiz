const PREFIX = 'ebqa:';

export const storage = {
  get<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      if (!raw) return fallback;
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  },
  set<T>(key: string, value: T): void {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch (e) {
      console.warn('storage quota exceeded for', key, e);
    }
  },
  remove(key: string): void {
    try {
      localStorage.removeItem(PREFIX + key);
    } catch {
      /* noop */
    }
  },
  sessionGet<T>(key: string, fallback: T): T {
    try {
      const raw = sessionStorage.getItem(PREFIX + key);
      return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
      return fallback;
    }
  },
  sessionSet<T>(key: string, value: T): void {
    try {
      sessionStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch {
      /* noop */
    }
  },
};

export interface UserSettings {
  textScale: number;
  sound: boolean;
  music: boolean;
  reducedMotion: boolean;
  highContrast: boolean;
  skipMinigames: boolean;
  hideImages: boolean;
}

export const DEFAULT_SETTINGS: UserSettings = {
  textScale: 1,
  sound: true,
  music: true,
  reducedMotion: false,
  highContrast: false,
  skipMinigames: false,
  hideImages: false,
};
