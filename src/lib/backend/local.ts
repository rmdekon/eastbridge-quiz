import { createSeedDB } from '../../data/seed';
import type { Profile } from '../../types';
import { normalizeCode, normalizePin } from '../codes';
import { storage } from '../storage';
import { uid } from '../utils';
import type { Backend, DB, LiveChannel, LiveEvent, OrgSettings, TableName } from './types';

const DB_KEY = 'db:v1';
const TABLE_KEYS: TableName[] = [
  'profiles',
  'classes',
  'quizzes',
  'sessions',
  'players',
  'assignments',
  'submissions',
  'reports',
];

/**
 * Local-first backend: full domain model persisted in localStorage.
 * Mirrors the Supabase API 1:1 so the app behaves identically without
 * credentials — used for demos, offline mode and automated checks.
 */
export class LocalBackend implements Backend {
  readonly mode = 'local' as const;
  private cache: DB | null = null;
  private channelId = uid('client');

  private read(): DB {
    if (this.cache) return this.cache;
    const stored = storage.get<DB | null>(DB_KEY, null);
    if (stored && Array.isArray(stored.profiles) && stored.profiles.length) {
      this.cache = { ...stored };
    } else {
      this.cache = createSeedDB();
      storage.set(DB_KEY, this.cache);
    }
    return this.cache;
  }

  private write(db: DB) {
    this.cache = db;
    try {
      storage.set(DB_KEY, db);
    } catch (e) {
      // Quota hit: drop the heaviest embedded images rather than losing progress.
      console.warn('Local storage full — trimming embedded images', e);
      const slim: DB = {
        ...db,
        quizzes: db.quizzes.map((q) => ({
          ...q,
          questions: q.questions.map((qq) => ({
            ...qq,
            imageUrl: qq.imageUrl?.startsWith('data:') ? '' : qq.imageUrl,
          })),
        })),
      };
      this.cache = slim;
      storage.set(DB_KEY, slim);
    }
  }

  async loadAll(): Promise<DB> {
    return structuredClone(this.read());
  }

  async save<T extends { id: string }>(table: TableName, row: T): Promise<void> {
    const db = this.read();
    const list = db[table] as unknown as Array<{ id: string }>;
    const idx = list.findIndex((r) => r.id === row.id);
    if (idx >= 0) list[idx] = row;
    else list.push(row);
    this.write({ ...db });
  }

  async saveMany<T extends { id: string }>(table: TableName, rows: T[]): Promise<void> {
    const db = this.read();
    const list = db[table] as unknown as Array<{ id: string }>;
    for (const row of rows) {
      const idx = list.findIndex((r) => r.id === row.id);
      if (idx >= 0) list[idx] = row;
      else list.push(row);
    }
    this.write({ ...db });
  }

  async remove(table: TableName, id: string): Promise<void> {
    const db = this.read();
    (db[table] as unknown as Array<{ id: string }>) = (db[table] as unknown as Array<{ id: string }>).filter(
      (r) => r.id !== id,
    );
    this.write({ ...db });
  }

  async saveSettings(settings: OrgSettings): Promise<void> {
    const db = this.read();
    this.write({ ...db, settings });
  }

  private async delay(ms = 180) {
    await new Promise((r) => setTimeout(r, ms));
  }

  async signInStaff(email: string, password: string): Promise<Profile> {
    await this.delay(260);
    const db = this.read();
    const emailNorm = email.trim().toLowerCase();
    const profile = db.profiles.find(
      (p) => (p.role === 'teacher' || p.role === 'admin') && p.email?.toLowerCase() === emailNorm,
    );
    if (!profile) throw new Error('No staff account found for that email');
    if (!profile.active) throw new Error('This account has been deactivated. Contact the ICT office.');
    const expected = password.trim();
    // Demo credential check only. Supabase Auth handles real password hashing.
    if (!expected || expected !== 'eastbridge') throw new Error('Incorrect password');
    return profile;
  }

  async signInLearner(schoolCode: string, pin: string): Promise<Profile> {
    await this.delay(260);
    const db = this.read();
    const code = normalizeCode(schoolCode);
    const cleanPin = normalizePin(pin);
    const profile = db.profiles.find(
      (p) => p.role === 'learner' && normalizeCode(p.schoolCode ?? '') === code,
    );
    if (!profile) throw new Error('That school code was not found. Ask your teacher.');
    if (!profile.active) throw new Error('This learner account is inactive. See the ICT office.');
    if (profile.pin !== cleanPin) throw new Error('That PIN does not match. Try 4 digits.');
    return profile;
  }

  async saveImage(dataUrl: string, name: string): Promise<string> {
    // Embedded data URL keeps the demo fully offline; Supabase uses Storage + signed URLs.
    void name;
    return dataUrl;
  }

  channel(topic: string): LiveChannel {
    const bc =
      typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(`ebqa:${topic}`) : null;
    const handlers = new Set<(e: LiveEvent) => void>();
    const onStorage = (ev: StorageEvent) => {
      if (ev.key !== `ebqa:bus:${topic}` || !ev.newValue) return;
      try {
        const msg = JSON.parse(ev.newValue) as LiveEvent;
        if (msg.from === this.channelId) return;
        handlers.forEach((h) => h(msg));
      } catch {
        /* ignore */
      }
    };
    if (typeof window !== 'undefined') window.addEventListener('storage', onStorage);
    if (bc) bc.onmessage = (ev) => handlers.forEach((h) => h(ev.data as LiveEvent));

    return {
      name: topic,
      selfId: this.channelId,
      send: (event, payload) => {
        const msg: LiveEvent = { event, payload, from: this.channelId, at: Date.now() };
        bc?.postMessage(msg);
        // sessionStorage-free cross-tab bus for browsers without BroadcastChannel
        try {
          localStorage.setItem(`ebqa:bus:${topic}`, JSON.stringify(msg));
          setTimeout(() => {
            try {
              const cur = localStorage.getItem(`ebqa:bus:${topic}`);
              if (cur && JSON.parse(cur).at === msg.at) localStorage.removeItem(`ebqa:bus:${topic}`);
            } catch {
              /* noop */
            }
          }, 800);
        } catch {
          /* noop */
        }
      },
      on: (handler) => {
        handlers.add(handler);
        return () => handlers.delete(handler);
      },
      close: () => {
        handlers.clear();
        bc?.close();
        if (typeof window !== 'undefined') window.removeEventListener('storage', onStorage);
      },
    };
  }

  async resetDemo(): Promise<void> {
    const fresh = createSeedDB();
    this.cache = fresh;
    storage.set(DB_KEY, fresh);
  }
}

export const tableKeys = TABLE_KEYS;
