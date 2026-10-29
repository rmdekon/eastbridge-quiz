import type { SupabaseClient } from '@supabase/supabase-js';
import type { Profile, QuizSet } from '../../types';
import { normalizeCode, normalizePin } from '../codes';
import { uid } from '../utils';
import { emptyDB, type Backend, type DB, type LiveChannel, type LiveEvent, type OrgSettings, type TableName } from './types';

const TABLES: Record<TableName, string> = {
  profiles: 'profiles',
  classes: 'classes',
  quizzes: 'quizzes',
  sessions: 'games',
  players: 'game_players',
  assignments: 'assignments',
  submissions: 'submissions',
  reports: 'game_reports',
};

const toSnake = (s: string) => s.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
const toCamel = (s: string) => s.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());

const mapRow = <T>(row: Record<string, unknown>): T => {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) out[toCamel(k)] = v;
  return out as T;
};

const mapToDb = (obj: Record<string, unknown>): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (k === 'questions' || k === 'password' || k === 'answers' || k === 'minigameResults') continue;
    out[toSnake(k)] = v;
  }
  return out;
};

export const supabaseConfig = () => ({
  url: (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() || '',
  key: (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() || '',
});

export const isSupabaseConfigured = () => {
  const { url, key } = supabaseConfig();
  return Boolean(url && key && url.startsWith('http'));
};

let client: SupabaseClient | null = null;

/**
 * The Supabase SDK is ~55 kB gzipped and is not needed in demo mode, so it is
 * imported dynamically. `init()` must resolve before any other backend call —
 * AppStore awaits it while the app shows its loading screen.
 */
export const ensureSupabase = async (): Promise<SupabaseClient> => {
  if (!client) {
    const { url, key } = supabaseConfig();
    const { createClient } = await import('@supabase/supabase-js');
    client = createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } });
  }
  return client;
};

export const getSupabase = (): SupabaseClient => {
  if (!client) throw new Error('Supabase client is not ready yet');
  return client;
};

/**
 * Supabase backend. Same contract as LocalBackend so the UI is untouched.
 * Requires the SQL in supabase/schema.sql to be applied.
 */
export class SupabaseBackend implements Backend {
  readonly mode = 'supabase' as const;
  private get sb(): SupabaseClient {
    return getSupabase();
  }

  async init(): Promise<void> {
    await ensureSupabase();
  }
  private clientId = uid('client');

  async loadAll(): Promise<DB> {
    const db = emptyDB();
    const [profiles, classes, quizzes, questions, sessions, players, assignments, submissions, reports, settings] =
      await Promise.all([
        this.sb.from('profiles').select('*'),
        this.sb.from('classes').select('*'),
        this.sb.from('quizzes').select('*'),
        this.sb.from('questions').select('*').order('position'),
        this.sb.from('games').select('*').order('created_at', { ascending: false }).limit(100),
        this.sb.from('game_players').select('*'),
        this.sb.from('assignments').select('*'),
        this.sb.from('submissions').select('*'),
        this.sb.from('game_reports').select('*').order('ended_at', { ascending: false }).limit(50),
        this.sb.from('org_settings').select('*').limit(1).maybeSingle(),
      ]);
    for (const res of [profiles, classes, quizzes, questions, sessions, players, assignments, submissions, reports]) {
      if (res.error) throw new Error(res.error.message);
    }

    db.profiles = (profiles.data ?? []).map((r) => mapRow<Profile>(r));
    db.classes = (classes.data ?? []).map((r) => mapRow(r)) as DB['classes'];
    const qs = (questions.data ?? []).map((r) => mapRow<Record<string, unknown>>(r));
    db.quizzes = (quizzes.data ?? []).map((r) => {
      const quiz = mapRow<QuizSet>(r);
      quiz.questions = qs
        .filter((q) => q.quizId === quiz.id)
        .map((q) => ({
          ...(q as unknown as QuizSet['questions'][number]),
          options: (q.options as QuizSet['questions'][number]['options']) ?? [],
        }));
      return quiz;
    });
    db.sessions = (sessions.data ?? []).map((r) => mapRow(r)) as DB['sessions'];
    db.players = (players.data ?? []).map((r) => mapRow(r)) as DB['players'];
    db.assignments = (assignments.data ?? []).map((r) => mapRow(r)) as DB['assignments'];
    db.submissions = (submissions.data ?? []).map((r) => mapRow(r)) as DB['submissions'];
    db.reports = (reports.data ?? []).map((r) => mapRow(r)) as DB['reports'];
    if (settings.data) {
      const s = mapRow<Record<string, unknown>>(settings.data);
      db.settings = {
        ...db.settings,
        schoolName: (s.schoolName as string) ?? db.settings.schoolName,
        minigamesDisabled: (s.minigamesDisabled as string[]) ?? [],
        gradeBands: (s.gradeBands as OrgSettings['gradeBands']) ?? db.settings.gradeBands,
        term: (s.term as string) ?? db.settings.term,
        academicYear: (s.academicYear as string) ?? db.settings.academicYear,
      };
    }
    return db;
  }

  async save<T extends { id: string }>(table: TableName, row: T): Promise<void> {
    if (table === 'quizzes') {
      const quiz = row as unknown as QuizSet;
      const { error } = await this.sb.from('quizzes').upsert(mapToDb(quiz as unknown as Record<string, unknown>));
      if (error) throw new Error(error.message);
      const rows = quiz.questions.map((q, i) => ({
        ...mapToDb(q as unknown as Record<string, unknown>),
        id: q.id,
        quiz_id: quiz.id,
        position: i,
      }));
      const del = await this.sb.from('questions').delete().eq('quiz_id', quiz.id);
      if (del.error) throw new Error(del.error.message);
      if (rows.length) {
        const ins = await this.sb.from('questions').insert(rows);
        if (ins.error) throw new Error(ins.error.message);
      }
      return;
    }
    const { error } = await this.sb
      .from(TABLES[table])
      .upsert(mapToDb(row as unknown as Record<string, unknown>));
    if (error) throw new Error(error.message);
  }

  async saveMany<T extends { id: string }>(table: TableName, rows: T[]): Promise<void> {
    if (!rows.length) return;
    for (const r of rows) await this.save(table, r);
  }

  async remove(table: TableName, id: string): Promise<void> {
    if (table === 'quizzes') {
      await this.sb.from('questions').delete().eq('quiz_id', id);
    }
    const { error } = await this.sb.from(TABLES[table]).delete().eq('id', id);
    if (error) throw new Error(error.message);
  }

  async saveSettings(settings: OrgSettings): Promise<void> {
    const { error } = await this.sb
      .from('org_settings')
      .upsert({ id: 'default', ...mapToDb(settings as unknown as Record<string, unknown>) });
    if (error) throw new Error(error.message);
  }

  async signInStaff(email: string, password: string): Promise<Profile> {
    const { data, error } = await this.sb.auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw new Error(error.message);
    const { data: profile, error: pErr } = await this.sb
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single();
    if (pErr || !profile) throw new Error('Signed in, but no staff profile is linked to this account.');
    const mapped = mapRow<Profile>(profile);
    if (mapped.role === 'learner') throw new Error('Learners sign in with a school code, not email.');
    if (!mapped.active) throw new Error('This account has been deactivated.');
    return mapped;
  }

  async signInLearner(schoolCode: string, pin: string): Promise<Profile> {
    const { data, error } = await this.sb.rpc('learner_login', {
      p_school_code: normalizeCode(schoolCode),
      p_pin: normalizePin(pin),
    });
    if (error) throw new Error(error.message);
    if (!data) throw new Error('School code or PIN not recognised.');
    return mapRow<Profile>(data as Record<string, unknown>);
  }

  async saveImage(dataUrl: string, name: string): Promise<string> {
    const blob = await (await fetch(dataUrl)).blob();
    const path = `quiz-images/${new Date().getFullYear()}/${uid()}-${name.replace(/[^\w.-]/g, '_')}`;
    const { error } = await this.sb.storage.from('media').upload(path, blob, {
      contentType: blob.type || 'image/webp',
      upsert: false,
    });
    if (error) throw new Error(error.message);
    const signed = await this.sb.storage.from('media').createSignedUrl(path, 60 * 60 * 24 * 365);
    if (signed.error || !signed.data) throw new Error(signed.error?.message ?? 'Could not sign image URL');
    return signed.data.signedUrl;
  }

  channel(topic: string): LiveChannel {
    const sbChannel = this.sb.channel(`live:${topic}`, { config: { broadcast: { self: false } } });
    const handlers = new Set<(e: LiveEvent) => void>();
    sbChannel
      .on('broadcast', { event: 'msg' }, (msg) => {
        const payload = msg.payload as LiveEvent;
        if (payload?.from === this.clientId) return;
        handlers.forEach((h) => h(payload));
      })
      .subscribe();
    return {
      name: topic,
      selfId: this.clientId,
      send: (event, payload) => {
        void sbChannel.send({
          type: 'broadcast',
          event: 'msg',
          payload: { event, payload, from: this.clientId, at: Date.now() } satisfies LiveEvent,
        });
      },
      on: (handler) => {
        handlers.add(handler);
        return () => handlers.delete(handler);
      },
      close: () => {
        handlers.clear();
        void this.sb.removeChannel(sbChannel);
      },
    };
  }

  async resetDemo(): Promise<void> {
    throw new Error('Reset is only available in local demo mode.');
  }

  watch(onChange: () => void): () => void {
    const ch = this.sb
      .channel('db-changes')
      .on('postgres_changes', { event: '*', schema: 'public' }, () => onChange())
      .subscribe();
    return () => void this.sb.removeChannel(ch);
  }
}
