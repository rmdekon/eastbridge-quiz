import { signPayload } from '../lib/codes';

/**
 * One-time arcade tokens.
 *
 * In production the payload is signed by a trusted server (Supabase Edge
 * Function / RPC) after it validates the answer. In local demo mode the host
 * tab plays the role of the server. Tokens are single-use (nonce memory) and
 * time-boxed, so a learner cannot extend a break or farm coins from devtools.
 */
export interface ArcadeToken {
  playerId: string;
  sessionId: string;
  questionId: string;
  gameId: string;
  durationSec: number;
  issuedAt: number;
  expiresAt: number;
  nonce: string;
  sig: string;
}

const used = new Set<string>();

const payloadOf = (t: Omit<ArcadeToken, 'sig'>) =>
  `${t.playerId}|${t.sessionId}|${t.questionId}|${t.gameId}|${t.durationSec}|${t.issuedAt}|${t.expiresAt}|${t.nonce}`;

export const issueArcadeToken = async (
  input: Omit<ArcadeToken, 'sig' | 'issuedAt' | 'expiresAt' | 'nonce'> & { ttlSec?: number },
  secret: string,
): Promise<ArcadeToken> => {
  const now = Date.now();
  const base: Omit<ArcadeToken, 'sig'> = {
    ...input,
    issuedAt: now,
    expiresAt: now + (input.ttlSec ?? 120) * 1000,
    nonce: Math.random().toString(36).slice(2) + now.toString(36),
  };
  const sig = await signPayload(payloadOf(base), secret);
  return { ...base, sig };
};

export const verifyArcadeToken = async (
  token: ArcadeToken | null | undefined,
  secret: string,
): Promise<{ ok: boolean; reason?: string }> => {
  if (!token) return { ok: false, reason: 'No arcade pass was issued for this answer.' };
  if (Date.now() > token.expiresAt) return { ok: false, reason: 'That arcade pass has expired.' };
  const expected = await signPayload(payloadOf(token), secret);
  if (expected !== token.sig) return { ok: false, reason: 'Arcade pass signature was invalid.' };
  if (used.has(token.nonce)) return { ok: false, reason: 'That arcade pass has already been used.' };
  used.add(token.nonce);
  return { ok: true };
};

/** Arcade performance may add at most 20% of the question's points. */
export const bonusPointsFromCoins = (coins: number, questionPoints: number, capRatio = 0.2): number =>
  Math.min(Math.round(questionPoints * capRatio), Math.max(0, Math.round(coins / 4)));

export const coinsFromRawScore = (raw: number): number => Math.round(raw);

export const sessionSecret = (sessionId: string) => `ebqa-${sessionId}-arcade`;
