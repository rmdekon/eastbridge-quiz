import type {
  Assignment,
  AssignmentSubmission,
  ClassRoom,
  GamePlayer,
  GameReport,
  GameSession,
  Profile,
  QuizSet,
  GradeBand,
} from '../../types';

export type TableName =
  | 'profiles'
  | 'classes'
  | 'quizzes'
  | 'sessions'
  | 'players'
  | 'assignments'
  | 'submissions'
  | 'reports';

export interface OrgSettings {
  schoolName: string;
  minigamesDisabled: string[];
  gradeBands: GradeBand[];
  term: string;
  academicYear: string;
}

export interface DB {
  profiles: Profile[];
  classes: ClassRoom[];
  quizzes: QuizSet[];
  sessions: GameSession[];
  players: GamePlayer[];
  assignments: Assignment[];
  submissions: AssignmentSubmission[];
  reports: GameReport[];
  settings: OrgSettings;
}

export interface LiveEvent {
  event: string;
  payload: unknown;
  from: string;
  at: number;
}

export interface LiveChannel {
  readonly name: string;
  readonly selfId: string;
  send(event: string, payload: unknown): void;
  on(handler: (e: LiveEvent) => void): () => void;
  close(): void;
}

export interface Backend {
  readonly mode: 'local' | 'supabase';
  /** Optional async bootstrap (e.g. dynamically importing the Supabase SDK). */
  init?(): Promise<void>;
  loadAll(): Promise<DB>;
  save<T extends { id: string }>(table: TableName, row: T): Promise<void>;
  saveMany<T extends { id: string }>(table: TableName, rows: T[]): Promise<void>;
  remove(table: TableName, id: string): Promise<void>;
  saveSettings(settings: OrgSettings): Promise<void>;
  signInStaff(email: string, password: string): Promise<Profile>;
  signInLearner(schoolCode: string, pin: string): Promise<Profile>;
  saveImage(dataUrl: string, name: string): Promise<string>;
  channel(topic: string): LiveChannel;
  resetDemo(): Promise<void>;
  /** Optional: subscribe to server-side row changes for multi-device freshness. */
  watch?(onChange: () => void): () => void;
}

export const emptyDB = (): DB => ({
  profiles: [],
  classes: [],
  quizzes: [],
  sessions: [],
  players: [],
  assignments: [],
  submissions: [],
  reports: [],
  settings: {
    schoolName: 'Eastbridge International School',
    minigamesDisabled: [],
    gradeBands: [
      { grade: 'A*', min: 90 },
      { grade: 'A', min: 80 },
      { grade: 'B', min: 70 },
      { grade: 'C', min: 60 },
      { grade: 'D', min: 50 },
      { grade: 'E', min: 40 },
      { grade: 'F', min: 30 },
      { grade: 'U', min: 0 },
    ],
    term: 'Term 1',
    academicYear: '2026/27',
  },
});
