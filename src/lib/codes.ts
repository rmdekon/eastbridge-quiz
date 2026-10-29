import { uid } from './utils';

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export const randomToken = (len: number, alphabet = ALPHABET): string =>
  Array.from({ length: len }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');

/** Six-digit live-game PIN (never starts with 0). */
export const generatePin = (): string => String(Math.floor(100000 + Math.random() * 900000));

/** Short share code, e.g. EB-7K2Q9A */
export const generateShortCode = (): string => `EB-${randomToken(6)}`;

/** School-issued learner code, e.g. EB-5A-014 */
export const generateSchoolCode = (year: number, section: string, seq: number): string =>
  `EB-${year}${section.toUpperCase()}-${String(seq).padStart(3, '0')}`;

export const generateLearnerPin = (): string => String(Math.floor(1000 + Math.random() * 9000));

/** Deterministic-ish grouping key used by the local store for sync. */
export const localId = (prefix: string) => uid(prefix);

export const normalizeCode = (raw: string): string =>
  raw.trim().toUpperCase().replace(/\s+/g, '').replace(/^EB(?=[0-9A-Z])/, 'EB-');

export const normalizePin = (raw: string): string => raw.replace(/\D/g, '').slice(0, 6);

export const isPinLike = (raw: string): boolean => /^\d{6}$/.test(normalizePin(raw));

/** HMAC-ish signature helper for one-time arcade tokens (demo local mode). */
export const signPayload = async (payload: string, secret: string): Promise<string> => {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
    return Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
      .slice(0, 32);
  }
  // Fallback (non-secure contexts): cheap rolling hash. Documented as demo-only.
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  const full = `${payload}|${secret}`;
  for (let i = 0; i < full.length; i++) {
    const ch = full.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(16, '0').slice(0, 32);
};
