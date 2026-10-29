/**
 * Eastbridge Quiz Arcade — shared domain types.
 * Mirrors supabase/schema.sql. Keep camelCase here; the Supabase adapter
 * converts to/from snake_case columns automatically.
 */

export type Role = 'admin' | 'teacher' | 'learner';

export const SUBJECTS = [
  'Maths',
  'English',
  'Science',
  'ICT',
  'French',
  'Geography',
  'History',
  'Art',
  'Music',
  'Business',
  'Accounting',
  'Global Perspectives',
  'P.E.',
] as const;
export type Subject = (typeof SUBJECTS)[number];

export const YEAR_GROUPS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;
export type YearGroup = (typeof YEAR_GROUPS)[number];

export type AvatarId = string;

export interface Profile {
  id: string;
  role: Role;
  firstName: string;
  lastName: string;
  email?: string;
  /** School-issued learner code, e.g. EB-7A-014 */
  schoolCode?: string;
  /** Demo/hashed 4-digit PIN for learners. Never store raw PINs in production. */
  pin?: string;
  classId?: string;
  avatarId: AvatarId;
  hatId?: AvatarId;
  trailId?: AvatarId;
  coins: number;
  xp: number;
  ownedItems: string[];
  badges: string[];
  active: boolean;
  createdAt: string;
}

export interface ClassRoom {
  id: string;
  name: string;
  yearGroup: YearGroup;
  teacherIds: string[];
  code: string;
  createdAt: string;
}

export interface QuestionOption {
  id: string;
  text: string;
  imageUrl?: string;
  imageAlt?: string;
}

export type QuestionType = 'multiple_choice' | 'true_false';

export interface Question {
  id: string;
  type: QuestionType;
  text: string;
  options: QuestionOption[];
  correctIndex: number;
  timeLimit: number;
  points: number;
  imageUrl?: string;
  imageAlt?: string;
  explanation?: string;
  topic?: string;
}

export type Visibility = 'private' | 'shared';

export interface QuizSet {
  id: string;
  title: string;
  emoji: string;
  coverImage?: string;
  description: string;
  subject: Subject;
  yearGroup: YearGroup;
  tags: string[];
  visibility: Visibility;
  ownerId: string;
  folder?: string;
  questions: Question[];
  createdAt: string;
  updatedAt: string;
}

/* ------------------------------- games ---------------------------------- */

export type GameModeId =
  | 'classic'
  | 'eagle_cash'
  | 'trophy_hunt'
  | 'cipher_crack'
  | 'scholar_swarm'
  | 'team_battle'
  | 'crowd_party';

export interface GameModeMeta {
  id: GameModeId;
  name: string;
  emoji: string;
  blurb: string;
  minigameBreaks: boolean;
  teamBased?: boolean;
}

export interface GameSettings {
  shuffleQuestions: boolean;
  shuffleAnswers: boolean;
  hideNames: boolean;
  lockLobby: boolean;
  arcadeEnabled: boolean;
  breakDurationSec: number;
  allowedGames: string[];
  trigger: ArcadeTrigger;
  teamCount: number;
}

export type SessionStatus = 'lobby' | 'live' | 'reveal' | 'break' | 'podium' | 'ended';
export type SessionPhase = 'lobby' | 'question' | 'reveal' | 'break' | 'podium';

export interface GameSession {
  id: string;
  pin: string;
  quizId: string;
  quizTitle: string;
  hostId: string;
  mode: GameModeId;
  status: SessionStatus;
  settings: GameSettings;
  questionOrder: string[];
  currentIndex: number;
  phaseStartedAt: number;
  createdAt: string;
  endedAt?: string;
  reportId?: string;
}

export interface PlayerAnswer {
  questionId: string;
  optionIndex: number;
  correct: boolean;
  ms: number;
  points: number;
  arcadeBonus: number;
}

export interface GamePlayer {
  id: string;
  sessionId: string;
  name: string;
  avatarId: string;
  team?: number;
  isGuest: boolean;
  profileId?: string;
  score: number;
  coins: number;
  streak: number;
  bestStreak: number;
  correct: number;
  total: number;
  answers: PlayerAnswer[];
  connected: boolean;
  kicked?: boolean;
  powerUps?: string[];
}

export interface GameReport {
  id: string;
  sessionId: string;
  quizId: string;
  hostId: string;
  mode: GameModeId;
  title: string;
  endedAt: string;
  players: GamePlayer[];
  questionStats: QuestionStat[];
}

/* ----------------------------- assignments ------------------------------ */

export type ArcadeTrigger = 'every' | 'every_2' | 'streak_3';

export interface ArcadeSettings {
  enabled: boolean;
  durationSec: number;
  allowedGames: string[];
  trigger: ArcadeTrigger;
  skipAllowed: boolean;
}

export interface Assignment {
  id: string;
  quizId: string;
  teacherId: string;
  title: string;
  instructions: string;
  targetType: 'class' | 'year' | 'learners';
  classIds: string[];
  yearGroup?: YearGroup;
  learnerIds: string[];
  startDate: string;
  dueDate: string;
  attempts: 1 | 2 | 999;
  timeLimitMin?: number;
  shuffle: boolean;
  shuffleAnswers: boolean;
  showAnswers: boolean;
  arcade: ArcadeSettings;
  shortCode: string;
  createdAt: string;
  archived?: boolean;
}

export type SubmissionStatus = 'todo' | 'in_progress' | 'done' | 'overdue';

export interface MinigameResult {
  gameId: string;
  score: number;
  coins: number;
  durationMs: number;
  playedAt: string;
}

export interface SubmissionAnswer {
  questionId: string;
  optionIndex: number | null;
  correct: boolean;
  ms: number;
  points: number;
}

export interface AssignmentSubmission {
  id: string;
  assignmentId: string;
  learnerId: string;
  quizId: string;
  attempt: number;
  score: number;
  accuracy: number;
  correct: number;
  total: number;
  bestStreak: number;
  totalTimeMs: number;
  answers: SubmissionAnswer[];
  arcadeBonus: number;
  minigameResults: MinigameResult[];
  status: SubmissionStatus;
  late: boolean;
  submittedAt?: string;
  startedAt: string;
  teacherComment?: string;
  reopened?: boolean;
}

/* ------------------------------- analytics ------------------------------ */

export interface GradeBand {
  grade: string;
  min: number;
}

export const DEFAULT_GRADE_BANDS: GradeBand[] = [
  { grade: 'A*', min: 90 },
  { grade: 'A', min: 80 },
  { grade: 'B', min: 70 },
  { grade: 'C', min: 60 },
  { grade: 'D', min: 50 },
  { grade: 'E', min: 40 },
  { grade: 'F', min: 30 },
  { grade: 'U', min: 0 },
];

export interface QuestionStat {
  questionId: string;
  text: string;
  correctPct: number;
  attempts: number;
  avgMs: number;
  mostChosenWrong?: { text: string; count: number };
}

/* -------------------------------- minigames ----------------------------- */

export interface MiniGameContext {
  durationSec: number;
  difficulty: 1 | 2 | 3; // 1 = Y1-3, 2 = Y4-6, 3 = Y7-9
  input: 'keyboard' | 'touch' | 'mouse';
  reducedMotion: boolean;
  muted: boolean;
  onScore: (coins: number, raw?: number) => void;
  onFinish: (result: { coins: number; rawScore: number }) => void;
  onReady?: () => void;
  onProgress?: (pct: number) => void;
  isPaused: () => boolean;
}

export interface MiniGameManifest {
  id: string;
  name: string;
  tagline: string;
  emoji: string;
  color: string;
  minYear: number;
  maxYear: number;
  controls: string;
  thumbnail: string;
}

export interface MiniGame extends MiniGameManifest {
  mount(container: HTMLElement, ctx: MiniGameContext): void;
  start(): void;
  pause(paused: boolean): void;
  dispose(): void;
}
