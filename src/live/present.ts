import type { PublicQuestion } from './protocol';
import type { Question } from '../types';

const hash = (s: string): number => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

const mulberry32 = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

/**
 * Present a question exactly as players see it. When answer shuffling is on we
 * use a seeded order derived from session + question, so the host and every
 * player agree on option positions without storing anything extra.
 */
export interface PresentedQuestion {
  publicQuestion: PublicQuestion;
  correctIndex: number;
  order: number[];
}

export const presentQuestion = (
  q: Question,
  sessionId: string,
  shuffleAnswers: boolean,
): PresentedQuestion => {
  const base: PublicQuestion = {
    id: q.id,
    text: q.text,
    imageUrl: q.imageUrl,
    imageAlt: q.imageAlt,
    timeLimit: q.timeLimit,
    points: q.points,
    topic: q.topic,
    type: q.type,
    options: q.options.map((o) => ({ id: o.id, text: o.text, imageUrl: o.imageUrl, imageAlt: o.imageAlt })),
  };
  if (!shuffleAnswers) {
    return { publicQuestion: base, correctIndex: q.correctIndex, order: q.options.map((_, i) => i) };
  }
  const rand = mulberry32(hash(`${sessionId}:${q.id}`));
  const order = q.options.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return {
    publicQuestion: { ...base, options: order.map((i) => base.options[i]) },
    correctIndex: order.indexOf(q.correctIndex),
    order,
  };
};
