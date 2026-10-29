export const cx = (...parts: Array<string | false | null | undefined>) =>
  parts.filter(Boolean).join(' ');

export const uid = (prefix = ''): string => {
  const rnd =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 12)
      : Math.random().toString(36).slice(2, 14);
  return prefix ? `${prefix}_${rnd}` : rnd;
};

export const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

export const rand = (min: number, max: number) => min + Math.random() * (max - min);
export const randInt = (min: number, max: number) => Math.floor(rand(min, max + 1));
export const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

export const shuffle = <T,>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

export const formatMs = (ms: number): string => {
  if (!Number.isFinite(ms) || ms <= 0) return '0s';
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rest = s % 60;
  return rest ? `${m}m ${rest}s` : `${m}m`;
};

export const formatDate = (iso?: string): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

export const formatDateTime = (iso?: string): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${formatDate(iso)} · ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
};

export const toDateInput = (iso?: string): string => (iso ? new Date(iso).toISOString().slice(0, 10) : '');

export const daysUntil = (iso: string): number => {
  const target = new Date(iso).getTime();
  return Math.ceil((target - Date.now()) / 86_400_000);
};

export const countdown = (iso: string): string => {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return 'Overdue';
  const d = Math.floor(diff / 86_400_000);
  const h = Math.floor((diff % 86_400_000) / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  if (d > 0) return `${d}d ${h}h left`;
  if (h > 0) return `${h}h ${m}m left`;
  return `${m}m left`;
};

export const percent = (n: number, total: number): number =>
  total <= 0 ? 0 : Math.round((n / total) * 1000) / 10;

export const plural = (n: number, word: string, suffix = 's') => `${n} ${word}${n === 1 ? '' : suffix}`;

export const initials = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');

/** Safe display of untrusted text — React escapes by default, this strips control chars. */
export const sanitizeText = (s: string, max = 500): string =>
  s.replace(/[\u0000-\u001F\u007F]/g, '').slice(0, max).trim();

export const isValidUrl = (url?: string): boolean => {
  if (!url) return false;
  try {
    const u = new URL(url);
    return u.protocol === 'https:' || u.protocol === 'http:' || url.startsWith('data:image/');
  } catch {
    return false;
  }
};

export const debounce = <A extends unknown[]>(fn: (...a: A) => void, delay = 250) => {
  let t: ReturnType<typeof setTimeout>;
  return (...a: A) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), delay);
  };
};

export const levelFromXp = (xp: number): number => Math.floor(Math.sqrt(Math.max(0, xp) / 45)) + 1;
export const xpForLevel = (level: number): number => Math.pow(level - 1, 2) * 45;

export const yearBand = (year: number): 1 | 2 | 3 => (year <= 3 ? 1 : year <= 6 ? 2 : 3);

export const gradeFromPct = (pct: number, bands: GradeBand[]): string => {
  for (const b of bands) if (pct >= b.min) return b.grade;
  return 'U';
};

export type { GradeBand } from '../types';
import type { GradeBand } from '../types';

export { DEFAULT_GRADE_BANDS } from '../types';

export const isWebGLAvailable = (): boolean => {
  try {
    const canvas = document.createElement('canvas');
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl2') || canvas.getContext('webgl'))
    );
  } catch {
    return false;
  }
};

export const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
};

export const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
};

export const haptic = (ms = 12) => {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* noop */
  }
};
