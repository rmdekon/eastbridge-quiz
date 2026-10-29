import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { getBackend, isSupabaseConfigured } from '../lib/backend';
import type { DB, LiveChannel, OrgSettings, TableName } from '../lib/backend/types';
import { emptyDB } from '../lib/backend/types';
import { DEFAULT_SETTINGS, storage, type UserSettings } from '../lib/storage';
import { levelFromXp, uid } from '../lib/utils';
import type {
  Assignment,
  AssignmentSubmission,
  ClassRoom,
  GamePlayer,
  GameReport,
  GameSession,
  Profile,
  QuizSet,
} from '../types';

type ToastKind = 'success' | 'error' | 'info';
export interface Toast {
  id: string;
  message: string;
  kind: ToastKind;
}

interface AppContextValue {
  ready: boolean;
  backendMode: 'local' | 'supabase';
  db: DB;
  user: Profile | null;
  settings: UserSettings;
  toasts: Toast[];
  minigamesDisabled: string[];
  notify: (message: string, kind?: ToastKind) => void;
  dismissToast: (id: string) => void;
  updateSettings: (patch: Partial<UserSettings>) => void;
  loginStaff: (email: string, password: string) => Promise<Profile>;
  loginLearner: (schoolCode: string, pin: string) => Promise<Profile>;
  logout: () => void;
  refresh: () => Promise<void>;
  saveQuiz: (quiz: QuizSet) => Promise<void>;
  deleteQuiz: (id: string) => Promise<void>;
  saveAssignment: (a: Assignment) => Promise<void>;
  deleteAssignment: (id: string) => Promise<void>;
  saveSubmission: (s: AssignmentSubmission) => Promise<void>;
  updateSubmission: (id: string, patch: Partial<AssignmentSubmission>) => Promise<void>;
  saveProfile: (p: Profile) => Promise<void>;
  saveClass: (c: ClassRoom) => Promise<void>;
  deleteClass: (id: string) => Promise<void>;
  deleteProfile: (id: string) => Promise<void>;
  saveSession: (s: GameSession) => Promise<void>;
  savePlayers: (players: GamePlayer[]) => Promise<void>;
  saveReport: (r: GameReport) => Promise<void>;
  saveOrgSettings: (s: OrgSettings) => Promise<void>;
  rewardLearner: (learnerId: string, coins: number, xp: number) => Promise<void>;
  resetDemo: () => Promise<void>;
  createChannel: (topic: string) => LiveChannel;
}

const AppContext = createContext<AppContextValue | null>(null);

const USER_KEY = 'session:user';
const SETTINGS_KEY = 'settings:v1';

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const backend = useMemo(() => getBackend(), []);
  const [ready, setReady] = useState(false);
  const [db, setDb] = useState<DB>(emptyDB);
  const [user, setUser] = useState<Profile | null>(() => storage.get<Profile | null>(USER_KEY, null));
  const [settings, setSettings] = useState<UserSettings>(() => ({
    ...DEFAULT_SETTINGS,
    ...storage.get<Partial<UserSettings>>(SETTINGS_KEY, {}),
  }));
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const notify = useCallback((message: string, kind: ToastKind = 'success') => {
    const id = uid('toast');
    setToasts((prev) => [...prev.slice(-3), { id, message, kind }]);
    timers.current[id] = setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
      delete timers.current[id];
    }, 4200);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const refresh = useCallback(async () => {
    try {
      await backend.init?.();
      const next = await backend.loadAll();
      setDb(next);
      setUser((current) => {
        if (!current) return current;
        const fresh = next.profiles.find((p) => p.id === current.id);
        if (fresh && JSON.stringify(fresh) !== JSON.stringify(current)) {
          storage.set(USER_KEY, fresh);
          return fresh;
        }
        return current;
      });
    } catch (e) {
      console.error(e);
      notify((e as Error).message || 'Could not load data', 'error');
    }
  }, [backend, notify]);

  useEffect(() => {
    (async () => {
      await refresh();
      setReady(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!backend.watch) return;
    return backend.watch(() => {
      void refresh();
    });
  }, [backend, refresh]);

  // Persist settings + apply accessibility prefs to the document.
  useEffect(() => {
    storage.set(SETTINGS_KEY, settings);
    const root = document.documentElement;
    root.style.fontSize = `${Math.round(settings.textScale * 100)}%`;
    root.dataset.reducedMotion = String(settings.reducedMotion);
    root.dataset.highContrast = String(settings.highContrast);
    root.classList.toggle('reduce-motion', settings.reducedMotion);
    root.classList.toggle('hc', settings.highContrast);
  }, [settings]);

  const updateSettings = useCallback((patch: Partial<UserSettings>) => {
    setSettings((s) => ({ ...s, ...patch }));
  }, []);

  const persistUser = useCallback((p: Profile | null) => {
    setUser(p);
    if (p) storage.set(USER_KEY, p);
    else storage.remove(USER_KEY);
  }, []);

  const loginStaff = useCallback(
    async (email: string, password: string) => {
      const profile = await backend.signInStaff(email, password);
      persistUser(profile);
      await refresh();
      return profile;
    },
    [backend, persistUser, refresh],
  );

  const loginLearner = useCallback(
    async (schoolCode: string, pin: string) => {
      const profile = await backend.signInLearner(schoolCode, pin);
      persistUser(profile);
      await refresh();
      return profile;
    },
    [backend, persistUser, refresh],
  );

  const logout = useCallback(() => {
    persistUser(null);
  }, [persistUser]);

  /** Generic optimistic writer: updates local state immediately, then persists. */
  const writeRow = useCallback(
    async <T extends { id: string }>(table: TableName, row: T) => {
      setDb((prev) => {
        const list = prev[table] as unknown as T[];
        const idx = list.findIndex((r) => r.id === row.id);
        const nextList = idx >= 0 ? list.map((r) => (r.id === row.id ? row : r)) : [...list, row];
        return { ...prev, [table]: nextList } as DB;
      });
      try {
        await backend.save(table, row);
      } catch (e) {
        notify((e as Error).message || 'Save failed', 'error');
        throw e;
      }
    },
    [backend, notify],
  );

  const removeRow = useCallback(
    async (table: TableName, id: string) => {
      setDb((prev) => {
        const list = prev[table] as unknown as Array<{ id: string }>;
        return { ...prev, [table]: list.filter((r) => r.id !== id) } as DB;
      });
      try {
        await backend.remove(table, id);
      } catch (e) {
        notify((e as Error).message || 'Delete failed', 'error');
      }
    },
    [backend, notify],
  );

  const saveQuiz = useCallback(
    async (quiz: QuizSet) => {
      const stamped = { ...quiz, updatedAt: new Date().toISOString() };
      await writeRow('quizzes', stamped);
      notify('Quiz saved');
    },
    [notify, writeRow],
  );

  const deleteQuiz = useCallback((id: string) => removeRow('quizzes', id), [removeRow]);

  const saveAssignment = useCallback(
    async (a: Assignment) => {
      await writeRow('assignments', a);
      notify('Assignment saved');
    },
    [notify, writeRow],
  );

  const deleteAssignment = useCallback((id: string) => removeRow('assignments', id), [removeRow]);

  const saveSubmission = useCallback(
    async (s: AssignmentSubmission) => {
      await writeRow('submissions', s);
    },
    [writeRow],
  );

  const updateSubmission = useCallback(
    async (id: string, patch: Partial<AssignmentSubmission>) => {
      const current = db.submissions.find((s) => s.id === id);
      if (!current) return;
      await writeRow('submissions', { ...current, ...patch });
    },
    [db.submissions, writeRow],
  );

  const saveProfile = useCallback(
    async (p: Profile) => {
      await writeRow('profiles', p);
      if (user?.id === p.id) persistUser(p);
    },
    [persistUser, user?.id, writeRow],
  );

  const saveClass = useCallback(
    async (c: ClassRoom) => {
      await writeRow('classes', c);
      notify('Class saved');
    },
    [notify, writeRow],
  );

  const deleteClass = useCallback((id: string) => removeRow('classes', id), [removeRow]);
  const deleteProfile = useCallback((id: string) => removeRow('profiles', id), [removeRow]);

  const saveSession = useCallback(
    async (s: GameSession) => {
      await writeRow('sessions', s);
    },
    [writeRow],
  );

  const savePlayers = useCallback(
    async (players: GamePlayer[]) => {
      if (!players.length) return;
      setDb((prev) => {
        const map = new Map(prev.players.map((p) => [p.id, p]));
        for (const p of players) map.set(p.id, p);
        return { ...prev, players: [...map.values()] };
      });
      try {
        await backend.saveMany('players', players);
      } catch (e) {
        console.warn('player sync failed', e);
      }
    },
    [backend],
  );

  const saveReport = useCallback(
    async (r: GameReport) => {
      await writeRow('reports', r);
    },
    [writeRow],
  );

  const saveOrgSettings = useCallback(
    async (s: OrgSettings) => {
      setDb((prev) => ({ ...prev, settings: s }));
      try {
        await backend.saveSettings(s);
        notify('School settings saved');
      } catch (e) {
        notify((e as Error).message || 'Could not save settings', 'error');
      }
    },
    [backend, notify],
  );

  const rewardLearner = useCallback(
    async (learnerId: string, coins: number, xp: number) => {
      const learner = db.profiles.find((p) => p.id === learnerId);
      if (!learner) return;
      const next: Profile = {
        ...learner,
        coins: Math.max(0, learner.coins + coins),
        xp: Math.max(0, learner.xp + xp),
      };
      await writeRow('profiles', next);
      if (user?.id === learnerId) persistUser(next);
    },
    [db.profiles, persistUser, user?.id, writeRow],
  );

  const resetDemo = useCallback(async () => {
    await backend.resetDemo();
    await refresh();
    persistUser(null);
    notify('Demo data restored');
  }, [backend, notify, persistUser, refresh]);

  const createChannel = useCallback((topic: string) => backend.channel(topic), [backend]);

  const value: AppContextValue = {
    ready,
    backendMode: backend.mode,
    db,
    user,
    settings,
    toasts,
    minigamesDisabled: db.settings.minigamesDisabled,
    notify,
    dismissToast,
    updateSettings,
    loginStaff,
    loginLearner,
    logout,
    refresh,
    saveQuiz,
    deleteQuiz,
    saveAssignment,
    deleteAssignment,
    saveSubmission,
    updateSubmission,
    saveProfile,
    saveClass,
    deleteClass,
    deleteProfile,
    saveSession,
    savePlayers,
    saveReport,
    saveOrgSettings,
    rewardLearner,
    resetDemo,
    createChannel,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useApp = (): AppContextValue => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
};

/** Convenience selectors used across dashboards. */
export const useMyQuizzes = () => {
  const { db, user } = useApp();
  return useMemo(() => {
    if (!user) return [];
    if (user.role === 'admin') return db.quizzes;
    return db.quizzes.filter((q) => q.ownerId === user.id || q.visibility === 'shared');
  }, [db.quizzes, user]);
};

export const useMyClasses = () => {
  const { db, user } = useApp();
  return useMemo(() => {
    if (!user) return [];
    if (user.role === 'admin') return db.classes;
    if (user.role === 'teacher') return db.classes.filter((c) => c.teacherIds.includes(user.id));
    return db.classes.filter((c) => c.id === user.classId);
  }, [db.classes, user]);
};

export const useLearnerLevel = (profile: Profile | null) =>
  useMemo(() => {
    const xp = profile?.xp ?? 0;
    const level = levelFromXp(xp);
    return { level, xp };
  }, [profile?.xp]);

export { isSupabaseConfigured };
