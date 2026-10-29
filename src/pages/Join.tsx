import React, { useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApp } from '../store/AppStore';
import { normalizePin } from '../lib/codes';
import { cx } from '../lib/utils';
import { Avatar } from '../components/Avatar';
import { Btn } from '../components/ui';
import { AVATARS } from '../data/avatars';
import { checkNickname } from '../lib/profanity';
import { modeById } from '../data/modes';
import { uid } from '../lib/utils';

/** Stored locally so a learner can refresh or re-open the tab without re-typing. */
export interface JoinTicket {
  pin: string;
  playerId: string;
  name: string;
  avatarId: string;
  isGuest: boolean;
  profileId?: string;
  joinedAt: number;
}

const ticketKey = (pin: string) => `ebqa:ticket:${pin}`;

export const writeTicket = (ticket: JoinTicket) => {
  try {
    sessionStorage.setItem(ticketKey(ticket.pin), JSON.stringify(ticket));
  } catch {
    /* private mode — the in-memory ticket still works */
  }
};

export const readTicket = (pin: string): JoinTicket | null => {
  try {
    const raw = sessionStorage.getItem(ticketKey(pin));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as JoinTicket;
    return parsed?.playerId && parsed?.name ? parsed : null;
  } catch {
    return null;
  }
};

export const clearTicket = (pin: string) => {
  try {
    sessionStorage.removeItem(ticketKey(pin));
  } catch {
    /* ignore */
  }
};

/** Guest join: 3 taps — PIN → name/avatar → go. No account required. */
export const Join: React.FC = () => {
  const { db, user, notify } = useApp();
  const nav = useNavigate();
  const [pin, setPin] = useState('');
  const [step, setStep] = useState<'pin' | 'who'>('pin');
  const [name, setName] = useState(user?.role === 'learner' ? user.firstName : '');
  const [avatarId, setAvatarId] = useState(user?.avatarId ?? AVATARS[0].id);
  const [error, setError] = useState('');
  const pinRef = useRef<HTMLInputElement>(null);

  const session = useMemo(
    () => db.sessions.find((s) => s.pin === pin && s.status !== 'ended'),
    [db.sessions, pin],
  );

  const submitPin = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = normalizePin(pin);
    setPin(clean);
    if (clean.length !== 6) {
      setError('Game PINs are 6 digits.');
      return;
    }
    const found = db.sessions.find((s) => s.pin === clean && s.status !== 'ended');
    if (!found) {
      setError("That PIN isn't live. Ask your teacher for the PIN on the board.");
      return;
    }
    if (found.settings.lockLobby) {
      setError('This game has been locked by the teacher. Hang tight!');
      return;
    }
    if (found.status !== 'lobby') {
      setError('That game has already started. Ask your teacher to open a new one.');
      return;
    }
    setError('');
    setStep('who');
    setName((n) => n || (user?.role === 'learner' ? user.firstName : ''));
  };

  const submitWho = (e: React.FormEvent) => {
    e.preventDefault();
    const check = checkNickname(name);
    if (!check.ok) {
      setError(check.reason ?? 'Please pick another name.');
      return;
    }
    const clean = check.cleaned;
    writeTicket({
      pin,
      playerId: uid('player'),
      name: clean,
      avatarId,
      isGuest: user?.role !== 'learner',
      profileId: user?.role === 'learner' ? user.id : undefined,
      joinedAt: Date.now(),
    });
    nav(`/play/${pin}`);
  };

  const quiz = session ? db.quizzes.find((q) => q.id === session.quizId) : undefined;
  const mode = session ? modeById(session.mode) : undefined;

  return (
    <main className="relative isolate flex min-h-screen flex-col items-center justify-center overflow-hidden bg-navy-900 px-4 py-10 text-cream-50">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background:
            'radial-gradient(60% 50% at 50% 0%, rgba(42,127,143,.55), transparent 70%), radial-gradient(50% 40% at 80% 100%, rgba(200,151,58,.35), transparent 70%)',
        }}
      />
      <div className="relative w-full max-w-md">
        <Link to="/" className="mb-6 flex items-center justify-center gap-2 no-underline">
          <img src="/logo.png" alt="" className="h-11 w-11 rounded-xl bg-cream-50/10 p-1" />
          <span className="font-display text-lg font-bold tracking-wide text-cream-50">Eastbridge Quiz Arcade</span>
        </Link>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-md sm:p-8">
          {step === 'pin' ? (
            <form onSubmit={submitPin} className="space-y-5">
              <div className="text-center">
                <h1 className="font-display text-3xl font-bold">Join a game</h1>
                <p className="mt-1 text-sm text-cream-100/70">Type the 6-digit PIN from the board.</p>
              </div>
              <label htmlFor="pin" className="sr-only">
                Game PIN
              </label>
              <input
                id="pin"
                ref={pinRef}
                value={pin}
                onChange={(e) => {
                  setPin(normalizePin(e.target.value).slice(0, 6));
                  setError('');
                }}
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                placeholder="123456"
                aria-describedby={error ? 'pin-error' : undefined}
                className="w-full rounded-2xl border-2 border-white/20 bg-navy-950/60 px-4 py-4 text-center font-display text-4xl font-bold tracking-[0.4em] text-cream-50 outline-none transition placeholder:text-white/20 focus:border-gold-400 focus:ring-4 focus:ring-gold-400/20"
              />
              {error && (
                <p id="pin-error" role="alert" className="rounded-xl bg-red-500/15 px-3 py-2 text-center text-sm text-red-200">
                  {error}
                </p>
              )}
              <Btn type="submit" variant="gold" size="lg" className="w-full" disabled={pin.length !== 6}>
                Enter →
              </Btn>
              <div className="flex items-center justify-between text-xs text-cream-100/60">
                <Link to="/login" className="text-cream-100/80 underline-offset-4 hover:underline">
                  Staff / learner sign in
                </Link>
                <Link to="/privacy" className="hover:underline">
                  Privacy
                </Link>
              </div>
            </form>
          ) : (
            <form onSubmit={submitWho} className="space-y-5">
              <div className="text-center">
                <p className="text-xs font-bold uppercase tracking-widest text-gold-300">
                  {mode?.emoji} {mode?.name ?? 'Live game'}
                  {session?.pin ? ` · ${session.pin}` : ''}
                </p>
                <h1 className="mt-1 font-display text-2xl font-bold">{quiz?.title ?? session?.quizTitle}</h1>
                <p className="mt-1 text-sm text-cream-100/70">What should we call you on the board?</p>
              </div>

              <label htmlFor="nickname" className="sr-only">
                Your first name
              </label>
              <input
                id="nickname"
                value={name}
                onChange={(e) => {
                  setName(e.target.value.slice(0, 18));
                  setError('');
                }}
                autoFocus
                maxLength={18}
                placeholder="First name"
                autoComplete="off"
                aria-describedby={error ? 'name-error' : 'name-hint'}
                className="w-full rounded-2xl border-2 border-white/20 bg-navy-950/60 px-4 py-3 text-center font-display text-2xl font-bold text-cream-50 outline-none focus:border-gold-400 focus:ring-4 focus:ring-gold-400/20"
              />
              <p id="name-hint" className="text-center text-xs text-cream-100/50">
                First name only — no surnames or personal details needed.
              </p>

              <fieldset>
                <legend className="mb-2 text-center text-xs font-bold uppercase tracking-widest text-cream-100/60">
                  Pick your eagle
                </legend>
                <div role="radiogroup" aria-label="Choose an avatar" className="grid grid-cols-4 gap-2">
                  {AVATARS.slice(0, 8).map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      role="radio"
                      aria-checked={avatarId === a.id}
                      aria-label={a.name}
                      onClick={() => setAvatarId(a.id)}
                      className={cx(
                        'flex min-h-[56px] items-center justify-center rounded-2xl border-2 p-1 transition',
                        avatarId === a.id
                          ? 'border-gold-400 bg-gold-400/20 scale-105'
                          : 'border-white/10 bg-white/5 hover:border-white/30',
                      )}
                    >
                      <Avatar id={a.id} size={40} />
                    </button>
                  ))}
                </div>
              </fieldset>

              {error && (
                <p id="name-error" role="alert" className="rounded-xl bg-red-500/15 px-3 py-2 text-center text-sm text-red-200">
                  {error}
                </p>
              )}

              <Btn type="submit" variant="gold" size="lg" className="w-full">
                Let&apos;s play! 🦅
              </Btn>
              <button
                type="button"
                onClick={() => {
                  setStep('pin');
                  setError('');
                  requestAnimationFrame(() => pinRef.current?.focus());
                }}
                className="w-full text-center text-xs text-cream-100/60 hover:text-cream-50"
              >
                ← Use a different PIN
              </button>
            </form>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-cream-100/50">
          No account, no ads, no chat. Just your first name and the quiz.
        </p>
      </div>
    </main>
  );
};
