import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import type { MiniGame, MiniGameContext } from '../types';
import { gamesForYear, getManifest, loadMinigame, pickSurpriseGame } from '../minigames/registry';
import { Fallback2D } from '../minigames/Fallback2D';
import { Btn, Spinner } from '../components/ui';
import { bonusPointsFromCoins, verifyArcadeToken, type ArcadeToken } from './tokens';
import { isWebGLAvailable, prefersReducedMotion } from '../lib/utils';
import { sfx } from '../lib/sfx';

export interface ArcadeResult {
  gameId: string;
  coins: number;
  rawScore: number;
  durationMs: number;
  bonusPoints: number;
}

type Phase = 'pick' | 'instruct' | 'playing' | 'paused' | 'result' | 'blocked';

export interface ArcadeBreakProps {
  durationSec: number;
  yearGroup: number;
  allowedGames: string[];
  disabledGames?: string[];
  skipAllowed?: boolean;
  token?: ArcadeToken | null;
  secret?: string;
  questionPoints?: number;
  muted?: boolean;
  reducedMotion?: boolean;
  allowPicker?: boolean;
  onToggleMute?: () => void;
  onComplete: (result: ArcadeResult) => void;
  onSkip?: () => void;
  /** When provided the break ends at this timestamp (live games sync). */
  endsAt?: number;
  title?: string;
}

export const ArcadeBreak: React.FC<ArcadeBreakProps> = ({
  durationSec,
  yearGroup,
  allowedGames,
  disabledGames = [],
  skipAllowed = true,
  token,
  secret,
  questionPoints = 1000,
  muted = false,
  reducedMotion,
  allowPicker = true,
  onToggleMute,
  onComplete,
  onSkip,
  endsAt,
  title,
}) => {
  const pool = useMemo(() => {
    const allowed = gamesForYear(yearGroup, disabledGames).filter(
      (g) => allowedGames.length === 0 || allowedGames.includes(g.id),
    );
    return allowed.length ? allowed : gamesForYear(yearGroup, disabledGames);
  }, [yearGroup, allowedGames, disabledGames]);

  const [phase, setPhase] = useState<Phase>(allowPicker ? 'pick' : 'instruct');
  const [selected, setSelected] = useState<string>(() =>
    allowPicker ? '' : pool[0]?.id ?? 'eagle-run',
  );
  const [runId, setRunId] = useState(0);
  const [countdown, setCountdown] = useState(5);
  const [remainingMs, setRemainingMs] = useState(durationSec * 1000);
  const [coins, setCoins] = useState(0);
  const [raw, setRaw] = useState(0);
  const [result, setResult] = useState<ArcadeResult | null>(null);
  const [blockedReason, setBlockedReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [mutedLocal, setMutedLocal] = useState(muted);

  const hostRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<MiniGame | null>(null);
  const completedRef = useRef(false);
  const coinsRef = useRef(0);
  const rawRef = useRef(0);
  const pausedRef = useRef(false);
  const startRef = useRef(0);
  const deadlineRef = useRef(0);
  const remainingRef = useRef(durationSec * 1000);
  const loadIdRef = useRef(0);
  const active = phase === 'playing' || phase === 'paused';

  const manifest = getManifest(selected) ?? pool[0];

  /* ------------------------------- token gate ----------------------------- */
  useEffect(() => {
    if (!token && !secret) return; // self-paced preview / teacher preview: no gate
    let alive = true;
    (async () => {
      if (!secret) {
        setBlockedReason('This arcade break is not signed by the game server.');
        setPhase('blocked');
        return;
      }
      const check = await verifyArcadeToken(token, secret);
      if (!alive) return;
      if (!check.ok) {
        setBlockedReason(check.reason ?? 'This arcade pass is not valid.');
        setPhase('blocked');
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* -------------------------------- finish -------------------------------- */
  const finish = useCallback(
    (endedEarly = false) => {
      if (completedRef.current) return;
      completedRef.current = true;
      const durationMs = Math.max(1000, Date.now() - startRef.current);
      const res: ArcadeResult = {
        gameId: selected,
        coins: coinsRef.current,
        rawScore: rawRef.current,
        durationMs: endedEarly ? durationMs : Math.min(durationMs, durationSec * 1000),
        bonusPoints: bonusPointsFromCoins(coinsRef.current, questionPoints),
      };
      setResult(res);
      setPhase('result');
      gameRef.current?.pause(true);
      sfx.coin();
    },
    [durationSec, questionPoints, selected],
  );

  /* ------------------------------ mount game ------------------------------ */
  const beginPlay = useCallback(() => {
    setPhase('playing');
    setRunId((n) => n + 1);
  }, []);

  useEffect(() => {
    if (!runId || !hostRef.current) return;
    const host = hostRef.current;
    const loadId = ++loadIdRef.current;
    let game: MiniGame | null = null;
    completedRef.current = false;
    coinsRef.current = 0;
    rawRef.current = 0;
    setCoins(0);
    setRaw(0);
    setLoading(true);

    const begin = async () => {
      const useFallback = !isWebGLAvailable();
      try {
        if (useFallback) {
          game = new Fallback2D();
        } else {
          game = await loadMinigame(selected);
        }
      } catch (e) {
        console.warn('minigame load failed, using 2D fallback', e);
        game = new Fallback2D();
      }
      if (loadId !== loadIdRef.current || !hostRef.current) {
        game.dispose();
        return;
      }
      const ctx: MiniGameContext = {
        durationSec,
        difficulty: yearGroup <= 3 ? 1 : yearGroup <= 6 ? 2 : 3,
        input: 'ontouchstart' in window ? 'touch' : 'mouse',
        reducedMotion: reducedMotion ?? prefersReducedMotion(),
        muted: mutedLocal,
        onScore: (c, r = 0) => {
          coinsRef.current = c;
          rawRef.current = r;
          setCoins(c);
          setRaw(r);
        },
        onFinish: ({ coins: c, rawScore }) => {
          coinsRef.current = c;
          rawRef.current = rawScore;
          setCoins(c);
          setRaw(rawScore);
          finish(true);
        },
        onProgress: () => {},
        isPaused: () => pausedRef.current,
      };
      game.mount(host, ctx);
      game.start();
      gameRef.current = game;
      startRef.current = Date.now();
      deadlineRef.current = endsAt ?? Date.now() + durationSec * 1000;
      remainingRef.current = Math.max(500, deadlineRef.current - Date.now());
      setRemainingMs(remainingRef.current);
      setLoading(false);
      sfx.breakStart();
    };
    void begin();

    return () => {
      loadIdRef.current++;
      game?.dispose();
      gameRef.current = null;
      pausedRef.current = false;
      if (host) host.innerHTML = '';
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId]);

  /* -------------------------------- timer --------------------------------- */
  useEffect(() => {
    if (phase !== 'playing' && phase !== 'paused') return;
    const tick = () => {
      if (pausedRef.current) return;
      const left = Math.max(0, deadlineRef.current - Date.now());
      remainingRef.current = left;
      setRemainingMs(left);
      if (left <= 0) finish();
    };
    tick();
    const id = setInterval(tick, 150);
    return () => clearInterval(id);
  }, [phase, finish]);

  /* -------------------------------- pause --------------------------------- */
  const togglePause = useCallback(() => {
    if (phase === 'playing') {
      pausedRef.current = true;
      const left = Math.max(500, deadlineRef.current - Date.now());
      remainingRef.current = left;
      gameRef.current?.pause(true);
      setPhase('paused');
    } else if (phase === 'paused') {
      pausedRef.current = false;
      deadlineRef.current = Date.now() + remainingRef.current;
      gameRef.current?.pause(false);
      setPhase('playing');
    }
  }, [phase]);

  /* ----------------------------- instructions ----------------------------- */
  useEffect(() => {
    if (phase !== 'instruct') return;
    setCountdown(5);
    const id = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(id);
          beginPlay();
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [phase, beginPlay]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'p' && active) togglePause();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, togglePause]);

  const choose = (id: string) => {
    setSelected(id);
    setPhase('instruct');
  };

  const surprise = () => {
    const g = pickSurpriseGame(yearGroup, disabledGames);
    const pickId = g && (allowedGames.length === 0 || allowedGames.includes(g.id)) ? g.id : pool[0]?.id;
    if (pickId) choose(pickId);
  };

  const grantCoins = () => {
    if (result) onComplete(result);
  };

  const toggleMute = () => {
    const next = !mutedLocal;
    setMutedLocal(next);
    onToggleMute?.();
  };

  /* --------------------------------- views -------------------------------- */

  return (
    <div className="arcade-shell flex flex-col" style={{ minHeight: 'min(88dvh, 780px)' }}>
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10">
        <span className="text-2xl" aria-hidden="true">
          {manifest?.emoji ?? '🕹️'}
        </span>
        <div className="min-w-0">
          <p className="font-display font-bold text-white leading-tight truncate">
            {title ?? 'Arcade break'}
            {manifest && <span className="text-white/60"> · {manifest.name}</span>}
          </p>
          <p className="text-[11px] text-white/50">{durationSec}s earned by a correct answer</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <div className="rounded-xl bg-gold-500/15 border border-gold-500/30 px-3 py-1.5 font-display text-sm font-bold text-gold-300">
            🪙 {coins}
          </div>
          <button
            onClick={toggleMute}
            aria-label={mutedLocal ? 'Unmute sounds' : 'Mute sounds'}
            className="h-11 w-11 rounded-xl bg-white/10 text-white hover:bg-white/20"
          >
            {mutedLocal ? '🔇' : '🔊'}
          </button>
          {active && (
            <button
              onClick={togglePause}
              aria-label={phase === 'paused' ? 'Resume game' : 'Pause game'}
              className="h-11 w-11 rounded-xl bg-white/10 text-white hover:bg-white/20"
            >
              {phase === 'paused' ? '▶️' : '⏸️'}
            </button>
          )}
        </div>
      </div>

      {/* timer strip */}
      {active && (
        <div className="h-2 w-full bg-white/10">
          <div
            className="h-full bg-gradient-to-r from-teal-400 to-gold-500 transition-[width] duration-150"
            style={{ width: `${Math.max(0, Math.min(100, (remainingMs / (durationSec * 1000)) * 100))}%` }}
          />
        </div>
      )}

      <div className="relative flex-1 min-h-[420px]">
        {/* picker */}
        {phase === 'pick' && (
          <div className="p-4 sm:p-6">
            <h2 className="font-display text-xl font-bold text-white">Pick your arcade break</h2>
            <p className="text-sm text-white/60 mt-1">
              You earned {durationSec} seconds. Only games your teacher enabled are shown.
            </p>
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
              {pool.map((g) => (
                <button
                  key={g.id}
                  onClick={() => choose(g.id)}
                  className="group rounded-2xl border border-white/15 bg-white/5 p-3 text-left transition hover:-translate-y-0.5 hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-gold-300"
                >
                  <div
                    className="flex h-20 items-center justify-center rounded-xl text-4xl"
                    style={{ background: g.thumbnail }}
                    aria-hidden="true"
                  >
                    {g.emoji}
                  </div>
                  <p className="mt-2 font-display text-sm font-bold text-white">{g.name}</p>
                  <p className="text-[11px] text-white/50 leading-snug">{g.tagline}</p>
                </button>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Btn variant="gold" onClick={surprise}>
                🎲 Surprise me
              </Btn>
              {skipAllowed && onSkip && (
                <Btn variant="ghost" onClick={onSkip}>
                  Skip break →
                </Btn>
              )}
            </div>
          </div>
        )}

        {/* instructions */}
        {phase === 'instruct' && manifest && (
          <div className="flex h-full min-h-[420px] flex-col items-center justify-center gap-4 p-6 text-center">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex h-24 w-24 items-center justify-center rounded-3xl text-6xl"
              style={{ background: manifest.thumbnail }}
              aria-hidden="true"
            >
              {manifest.emoji}
            </motion.div>
            <h2 className="font-display text-2xl font-bold text-white">{manifest.name}</h2>
            <p className="max-w-md text-white/70">{manifest.tagline}</p>
            <div className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white/80">
              <span className="font-bold text-gold-300">Controls:</span> {manifest.controls}
            </div>
            <div className="flex items-center gap-3 text-white/60 text-sm">
              <span>Starting in</span>
              <span className="font-display text-3xl font-bold text-white" aria-live="polite">
                {countdown}
              </span>
            </div>
            <Btn variant="gold" size="lg" onClick={beginPlay}>
              Start now
            </Btn>
          </div>
        )}

        {/* game host */}
        <div
          ref={hostRef}
          className={`absolute inset-0 ${phase === 'playing' ? '' : 'hidden'}`}
          aria-label={`${manifest?.name ?? 'Minigame'} canvas`}
        />

        {loading && phase === 'playing' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white/80">
            <Spinner size={32} />
            <p className="text-sm">Loading the arcade…</p>
          </div>
        )}

        {phase === 'paused' && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-arcade-900/80 backdrop-blur">
            <p className="font-display text-2xl font-bold text-white">Paused</p>
            <p className="text-sm text-white/60">
              {Math.ceil(remainingMs / 1000)}s left · coins banked so far: {coins}
            </p>
            <div className="flex gap-2">
              <Btn variant="gold" onClick={togglePause}>
                Resume
              </Btn>
              <Btn
                variant="ghost"
                onClick={() => {
                  if (skipAllowed) finish(true);
                  else togglePause();
                }}
              >
                End break
              </Btn>
            </div>
          </div>
        )}

        {phase === 'result' && result && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-arcade-900/85 p-6 text-center backdrop-blur">
            <motion.div
              initial={{ scale: 0.7, rotate: -8 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 16 }}
              className="text-6xl"
              aria-hidden="true"
            >
              🪙
            </motion.div>
            <h2 className="font-display text-2xl font-bold text-white">Break complete!</h2>
            <p className="text-white/70">
              You banked <span className="font-bold text-gold-300">{result.coins} Eagle Coins</span>
            </p>
            <div className="mt-1 rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-sm text-white/80">
              <p>
                Arcade bonus: <span className="font-bold text-teal-300">+{result.bonusPoints} pts</span>{' '}
                <span className="text-white/40">(capped at 20% of the question)</span>
              </p>
              <p className="text-[11px] text-white/40 mt-1">Quiz accuracy still decides your grade.</p>
            </div>
            <Btn variant="gold" size="lg" onClick={grantCoins} className="mt-2">
              Continue quiz →
            </Btn>
          </div>
        )}

        {phase === 'blocked' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
            <div className="text-5xl" aria-hidden="true">
              🔒
            </div>
            <h2 className="font-display text-xl font-bold text-white">Arcade pass not valid</h2>
            <p className="max-w-sm text-sm text-white/70">{blockedReason}</p>
            <p className="text-xs text-white/40">
              Arcade passes are issued only after a verified correct answer, and only once.
            </p>
            {onSkip && (
              <Btn variant="gold" onClick={onSkip}>
                Back to the quiz →
              </Btn>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
