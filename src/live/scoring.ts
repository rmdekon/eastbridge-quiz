import type { GameModeId, Profile, Question } from '../types';
import { pick, randInt } from '../lib/utils';

export interface ScoreInput {
  question: Question;
  remainingRatio: number; // 0..1 of the time limit left
  streak: number;
  mode: GameModeId;
  playerCount: number;
}

export interface ScoreResult {
  points: number;
  coins: number;
  event?: string;
}

/**
 * Mode-specific scoring. Accuracy (base points) always dominates:
 * no arcade or event bonus can exceed 20% of the question's value.
 */
export const scoreAnswer = ({ question, remainingRatio, streak, mode, playerCount }: ScoreInput): ScoreResult => {
  const base = question.points;
  switch (mode) {
    case 'classic':
      return { points: Math.round(base * (0.55 + 0.45 * remainingRatio)), coins: 10 };
    case 'eagle_cash': {
      const points = Math.round(base * (0.4 + 0.2 * remainingRatio));
      const coins = 18 + Math.round(12 * remainingRatio) + Math.min(20, streak * 4);
      return { points, coins };
    }
    case 'trophy_hunt': {
      let points = Math.round(base * (0.5 + 0.3 * remainingRatio));
      let event: string | undefined;
      const roll = Math.random();
      if (roll < 0.18) {
        points *= 2;
        event = 'Double trophies!';
      } else if (roll < 0.3) {
        event = 'Trophy stolen ×1.5';
        points *= 1.5;
      } else if (roll < 0.4) {
        event = 'Shielded — no steals this round';
      }
      return { points: Math.round(points), coins: randInt(8, 26), event };
    }
    case 'cipher_crack':
      return { points: Math.round(base * (0.6 + 0.4 * remainingRatio)), coins: 12 };
    case 'scholar_swarm': {
      const speedBonus = remainingRatio > 0.6 ? 1.25 : 1;
      return { points: Math.round(base * 0.7 * speedBonus), coins: 15 };
    }
    case 'team_battle':
      return { points: Math.round(base * (0.5 + 0.4 * remainingRatio)), coins: 12 };
    case 'crowd_party':
      return { points: Math.round(base * (0.6 + 0.4 * remainingRatio)), coins: 8 };
    default:
      return { points: base, coins: 10 };
  }
};

export const pickTeam = (index: number, teams: number) => index % Math.max(2, teams);

export const suggestName = (profiles: Profile[], classId?: string): string => {
  const pool = profiles.filter((p) => p.role === 'learner' && (!classId || p.classId === classId));
  if (!pool.length) return 'Eagle ' + randInt(10, 99);
  const p = pick(pool);
  return `${p.firstName} ${p.lastName[0]}.`;
};

/** Cipher Crack: reveal one letter per two correct answers. */
export const CIPHER_WORD = 'EASTBRIDGE';
