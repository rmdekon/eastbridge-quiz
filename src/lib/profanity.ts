/**
 * Lightweight, school-safe profanity + nickname filter.
 * Deliberately conservative: it blocks obvious slurs/insults and PII patterns,
 * not medical or everyday words. No third-party services, nothing leaves the device.
 */
const BLOCKED = [
  'fuck', 'fuk', 'fck', 'shit', 'bitch', 'bastard', 'asshole', 'arse', 'dick', 'pussy',
  'slut', 'whore', 'rape', 'nigg', 'nigga', 'fag', 'retard', 'twat', 'wank', 'cunt',
  'porn', 'sex', 'penis', 'vagina', 'kill', 'kys', 'suicide', 'hate', 'idiot', 'stupid',
  'dumb', 'loser', 'ugly', 'fatty', 'gay', 'damn', 'hell', 'crap',
];

const LEET: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', $: 's', '!': 'i' };

const normalize = (s: string) =>
  s
    .toLowerCase()
    .split('')
    .map((c) => LEET[c] ?? c)
    .join('')
    .replace(/[^a-z]/g, '');

export interface NicknameCheck {
  ok: boolean;
  reason?: string;
  cleaned: string;
}

export const checkNickname = (raw: string): NicknameCheck => {
  const cleaned = raw.replace(/[^\p{L}\p{N} ._'-]/gu, '').replace(/\s+/g, ' ').slice(0, 18).trim();
  if (cleaned.length < 2) return { ok: false, reason: 'Use at least 2 characters.', cleaned };
  if (!/^[\p{L}\p{N}]/u.test(cleaned))
    return { ok: false, reason: 'Start with a letter or number.', cleaned };
  if (/\d{7,}/.test(cleaned)) return { ok: false, reason: 'Please avoid phone numbers.', cleaned };
  if (/@/.test(raw)) return { ok: false, reason: 'No email addresses, please.', cleaned };
  if (/https?:|www\./i.test(raw)) return { ok: false, reason: 'Links are not allowed.', cleaned };
  const norm = normalize(cleaned);
  if (BLOCKED.some((w) => norm.includes(w))) {
    return { ok: false, reason: 'Please pick a friendlier name.', cleaned };
  }
  return { ok: true, cleaned };
};

export const containsProfanity = (s: string): boolean => {
  const norm = normalize(s);
  return BLOCKED.some((w) => norm.includes(w));
};

/** Preset reactions only — there is no free-text chat anywhere in the app. */
export const REACTIONS = ['👏', '🔥', '😮', '😂', '🎉', '💪', '🦅', '✨'] as const;
