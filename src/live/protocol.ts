import type { ArcadeToken } from '../arcade/tokens';
import type { GameModeId, GamePlayer, GameSettings, Question } from '../types';

export type LivePhase = 'lobby' | 'question' | 'reveal' | 'break' | 'podium';

export type PublicQuestion = Pick<
  Question,
  'id' | 'text' | 'imageUrl' | 'imageAlt' | 'timeLimit' | 'points' | 'topic' | 'type'
> & {
  options: Array<{ id: string; text: string; imageUrl?: string; imageAlt?: string }>;
};

export interface PublicPlayer {
  id: string;
  name: string;
  avatarId: string;
  score: number;
  coins: number;
  streak: number;
  bestStreak: number;
  correct: number;
  total: number;
  team?: number;
  connected: boolean;
  kicked?: boolean;
  isGuest: boolean;
}

export interface LiveWire {
  sessionId: string;
  pin: string;
  quizTitle: string;
  mode: GameModeId;
  settings: GameSettings;
  phase: LivePhase;
  index: number;
  total: number;
  question: PublicQuestion | null;
  questionEndsAt: number;
  revealEndsAt: number;
  breakEndsAt: number;
  correctIndex?: number;
  explanation?: string;
  players: PublicPlayer[];
  answerCounts: number[];
  answeredCount: number;
  paused: boolean;
  pausedRemainingMs: number;
  hideNames: boolean;
  yearGroup: number;
  allowedGames: string[];
  tokens: Record<string, ArcadeToken>;
  cipherProgress?: number;
  serverNow: number;
}

export interface JoinTicketWire {
  playerId: string;
  name: string;
  avatarId: string;
  isGuest: boolean;
  profileId?: string;
}

export type HostEvent =
  | { event: 'hello'; payload: { ticket: JoinTicketWire } }
  | { event: 'answer'; payload: { playerId: string; questionId: string; optionIndex: number; ms: number } }
  | { event: 'reaction'; payload: { playerId: string; emoji: string } }
  | { event: 'bye'; payload: { playerId: string } }
  | { event: 'snapshot'; payload: LiveWire }
  | { event: 'denied'; payload: { reason: string; playerId?: string } }
  | {
      event: 'bonus';
      payload: { playerId: string; questionId: string; coins: number; gameId: string; durationMs: number };
    }
  | { event: 'kicked'; payload: { playerId: string } }
  | { event: 'ended'; payload: { sessionId: string } }
  | { event: 'reaction-broadcast'; payload: { emoji: string; name: string; at: number } }
  | { event: 'ping'; payload: { at: number } };

export const toPublicPlayer = (p: GamePlayer): PublicPlayer => ({
  id: p.id,
  name: p.name,
  avatarId: p.avatarId,
  score: p.score,
  coins: p.coins,
  streak: p.streak,
  bestStreak: p.bestStreak,
  correct: p.correct,
  total: p.total,
  team: p.team,
  connected: p.connected,
  kicked: p.kicked,
  isGuest: p.isGuest,
});

/** Strip the correct answer before broadcasting a question. */
export const toPublicQuestion = (q: Question): PublicQuestion => ({
  id: q.id,
  text: q.text,
  imageUrl: q.imageUrl,
  imageAlt: q.imageAlt,
  timeLimit: q.timeLimit,
  points: q.points,
  topic: q.topic,
  type: q.type,
  options: q.options.map((o) => ({ id: o.id, text: o.text, imageUrl: o.imageUrl, imageAlt: o.imageAlt })),
});
