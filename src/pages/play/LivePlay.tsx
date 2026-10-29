import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { usePlayerGame } from '../../live/usePlayerGame';
import { ArcadeBreak, type ArcadeResult } from '../../arcade/ArcadeBreak';
import { sessionSecret } from '../../arcade/tokens';
import { Avatar } from '../../components/Avatar';
import { Btn, CountdownRing, Logo, ZoomableImage } from '../../components/ui';
import { REACTIONS } from '../../lib/profanity';
import { cx, haptic } from '../../lib/utils';
import { sfx } from '../../lib/sfx';
import { useApp } from '../../store/AppStore';
import { modeById } from '../../data/modes';

export const LivePlay: React.FC = () => {
  const { pin = '' } = useParams();
  const nav = useNavigate();
  const { user, settings, rewardLearner, notify } = useApp();
  const game = usePlayerGame(pin);
  const [breakDone, setBreakDone] = useState(false);
  const [lastBonus, setLastBonus] = useState<number | null>(null);
  const [showArcade, setShowArcade] = useState(false);

  const wire = game.wire;
  const question = wire?.question;

  useEffect(() => {
    if (wire?.phase === 'break' && game.myToken) setShowArcade(true);
    if (wire?.phase === 'reveal' || wire?.phase === 'question') {
      setShowArcade(false);
      setBreakDone(false);
    }
  }, [wire?.phase, game.myToken]);

  useEffect(() => {
    if (game.isCorrect === true) {
      sfx.correct();
      haptic(20);
    } else if (game.isCorrect === false) {
      sfx.wrong();
    }
  }, [game.isCorrect]);

  const me = game.me;
  const myRank = useMemo(() => {
    if (!wire || !me) return 0;
    return [...wire.players].sort((a, b) => b.score - a.score).findIndex((p) => p.id === me.id) + 1;
  }, [wire, me]);

  if (game.denied) {
    return (
      <div className="page-tight py-16 text-center">
        <div className="text-5xl">🔒</div>
        <h1 className="font-display text-2xl font-bold text-navy-700 mt-3">Can&apos;t join this game</h1>
        <p className="text-navy-300 mt-2">{game.denied}</p>
        <div className="mt-5 flex justify-center gap-2">
          <Link to={`/join?pin=${pin}`}>
            <Btn variant="gold">Try again</Btn>
          </Link>
          <Link to="/home">
            <Btn variant="ghost">Back home</Btn>
          </Link>
        </div>
      </div>
    );
  }

  if (game.kicked) {
    return (
      <div className="page-tight py-16 text-center">
        <div className="text-5xl">👋</div>
        <h1 className="font-display text-2xl font-bold text-navy-700 mt-3">The host removed you from the game</h1>
        <p className="text-navy-300 mt-2">Speak to your teacher if this was a mistake.</p>
        <Link to="/join" className="inline-block mt-5">
          <Btn>Join another game</Btn>
        </Link>
      </div>
    );
  }

  if (!wire) {
    return (
      <div className="arcade-shell grid min-h-dvh place-items-center">
        <div className="text-center">
          <Logo size={72} />
          <p className="mt-4 font-display text-xl font-bold text-white">Connecting to game {pin}…</p>
          <p className="mt-1 text-sm text-white/50">Keep this tab open — you&apos;ll drop in automatically.</p>
          <div className="mt-4 flex justify-center gap-2">
            <button
              onClick={() => nav(`/join?pin=${pin}`)}
              className="rounded-xl bg-white/10 px-4 py-2.5 text-sm font-bold text-white"
            >
              Re-enter details
            </button>
          </div>
        </div>
      </div>
    );
  }

  const mode = modeById(wire.mode);
  const arcadeEndsAt = wire.breakEndsAt - game.serverOffset;

  const handleArcadeComplete = (result: ArcadeResult) => {
    setLastBonus(result.bonusPoints);
    game.sendBonus(result.coins, result.gameId, result.durationMs);
    setBreakDone(true);
    setShowArcade(false);
    if (user?.role === 'learner' && result.coins > 0) {
      void rewardLearner(user.id, result.coins, Math.round(result.coins / 2));
    }
    notify(`Arcade: +${result.bonusPoints} bonus points`, 'success');
  };

  /* ------------------------------- arcade break --------------------------- */
  if (showArcade && game.myToken) {
    return (
      <div className="min-h-dvh">
        <ArcadeBreak
          durationSec={game.myToken.durationSec}
          yearGroup={wire.yearGroup ?? 5}
          allowedGames={wire.allowedGames}
          disabledGames={[]}
          skipAllowed
          token={game.myToken}
          secret={sessionSecret(wire.sessionId)}
          questionPoints={question?.points ?? 1000}
          muted={!settings.sound}
          title={`${mode.name} · Q${wire.index + 1}`}
          onComplete={handleArcadeComplete}
          onSkip={() => {
            setShowArcade(false);
            setBreakDone(true);
          }}
        />
      </div>
    );
  }

  /* ---------------------------------- podium ------------------------------ */
  if (wire.phase === 'podium') {
    return (
      <div className="arcade-shell min-h-dvh px-4 py-10 text-center">
        <div className="text-6xl">🏆</div>
        <h1 className="mt-2 font-display text-3xl font-bold text-white">Game over!</h1>
        <p className="mt-1 text-white/60">{wire.quizTitle}</p>
        <div className="mx-auto mt-6 max-w-sm glass p-5">
          <Avatar id={me?.avatarId} size={64} ring />
          <p className="mt-2 font-display text-xl font-bold text-white">{me?.name}</p>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="font-display text-2xl font-bold text-gold-300">#{myRank || '—'}</p>
              <p className="text-[10px] uppercase text-white/50">Rank</p>
            </div>
            <div>
              <p className="font-display text-2xl font-bold text-white">{me?.score.toLocaleString() ?? 0}</p>
              <p className="text-[10px] uppercase text-white/50">Points</p>
            </div>
            <div>
              <p className="font-display text-2xl font-bold text-teal-300">{me?.correct ?? 0}</p>
              <p className="text-[10px] uppercase text-white/50">Correct</p>
            </div>
          </div>
          <p className="mt-3 text-sm text-white/60">🪙 {me?.coins ?? 0} Eagle Coins earned</p>
        </div>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Link to={user ? '/home' : '/'}>
            <Btn variant="gold">{user ? 'Back to my home' : 'Back to start'}</Btn>
          </Link>
          <Link to="/join">
            <Btn variant="ghost">Join another game</Btn>
          </Link>
        </div>
      </div>
    );
  }

  /* ---------------------------------- lobby ------------------------------- */
  if (wire.phase === 'lobby') {
    return (
      <div className="arcade-shell grid min-h-dvh place-items-center px-4 text-center">
        <div>
          <div className="flex justify-center">
            <Avatar id={me?.avatarId} size={84} ring />
          </div>
          <h1 className="mt-4 font-display text-2xl font-bold text-white">You&apos;re in, {me?.name}!</h1>
          <p className="mt-1 text-white/60">Waiting for your teacher to start · PIN {wire.pin}</p>
          <div className="mx-auto mt-5 max-w-sm glass p-4">
            <p className="text-sm font-bold text-white">{wire.quizTitle}</p>
            <p className="mt-1 text-xs text-white/60">
              {mode.emoji} {mode.name} · {wire.total} questions
              {wire.settings.arcadeEnabled ? ` · ${wire.settings.breakDurationSec}s arcade breaks` : ''}
            </p>
            <p className="mt-3 text-xs text-gold-300">Answer correctly to unlock a minigame break.</p>
          </div>
          <div className="mx-auto mt-4 flex max-w-sm flex-wrap justify-center gap-1.5">
            {wire.players.slice(0, 12).map((p, i) => (
              <div key={p.id} className="flex items-center gap-1 rounded-full bg-white/10 px-2 py-1">
                <Avatar id={p.avatarId} size={20} />
                <span className="max-w-[80px] truncate text-[11px] text-white/80">{wire.hideNames ? `Eagle ${i + 1}` : p.name}</span>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-white/40">{wire.players.length} player(s) ready</p>
        </div>
      </div>
    );
  }

  /* --------------------------------- question ----------------------------- */
  const answered = game.answerLocked;
  const showResult = wire.phase === 'reveal';
  const correctIndex = wire.correctIndex;
  const breakEarned = Boolean(game.myToken);

  return (
    <div className="arcade-shell min-h-dvh pb-24">
      <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
        <Logo size={30} />
        <span className="text-xs font-bold text-white/60">
          Q{wire.index + 1}/{wire.total}
        </span>
        {wire.players.length > 1 && <span className="chip bg-white/10 text-[10px] text-white/70">#{myRank}</span>}
        <div className="ml-auto flex items-center gap-2">
          <span className="rounded-lg bg-gold-500/15 px-2 py-1 text-xs font-bold text-gold-300">
            {me?.score.toLocaleString() ?? 0}
          </span>
          {me && me.streak >= 2 && <span className="text-xs text-gold-300">🔥{me.streak}</span>}
          {wire.phase === 'question' && (
            <CountdownRing remaining={game.remainingMs / 1000} total={question?.timeLimit ?? 20} size={44} />
          )}
        </div>
      </div>

      <div className="mx-auto max-w-xl px-4 py-4">
        {wire.phase === 'break' && breakEarned ? (
          <div className="text-center">
            <div className="text-5xl">🎮</div>
            <h2 className="mt-2 font-display text-xl font-bold text-white">Arcade break unlocked!</h2>
            <p className="mt-1 text-sm text-white/60">
              {breakDone ? 'Waiting for the rest of the class…' : 'Tap below to play.'}
            </p>
            {!breakDone && (
              <Btn variant="gold" className="mt-4" onClick={() => setShowArcade(true)}>
                Enter the arcade
              </Btn>
            )}
            {breakDone && (
              <p className="mt-3 text-xs text-gold-300">
                {lastBonus ? `+${lastBonus} bonus points added to your score.` : 'Nice break!'}
              </p>
            )}
          </div>
        ) : wire.phase === 'break' ? (
          <div className="text-center">
            <div className="text-4xl">📖</div>
            <h2 className="mt-2 font-display text-lg font-bold text-white">Review card</h2>
            <p className="mt-1 text-sm text-white/60">Correct players are in the arcade — use this moment to read why.</p>
            <div className="mt-4 rounded-2xl border border-white/15 bg-white/5 p-4 text-left">
              <p className="text-xs font-bold uppercase text-gold-300">Correct answer</p>
              <p className="mt-1 font-semibold text-white">
                {correctIndex !== undefined ? question?.options[correctIndex]?.text : '—'}
              </p>
              {question?.imageUrl && (
                <ZoomableImage src={question.imageUrl} alt={question.imageAlt} className="mt-3 w-full" />
              )}
              <p className="mt-2 text-sm text-white/60">{wire.explanation ?? 'No explanation was added for this question.'}</p>
            </div>
            <p className="mt-3 text-xs text-white/40">You&apos;ll re-join the next question automatically.</p>
          </div>
        ) : (
          <>
            <p className="text-xs font-bold uppercase tracking-wider text-gold-300">
              {question?.topic ?? 'Question'}
            </p>
            <h1 className="mt-1 font-display text-xl sm:text-2xl font-bold leading-snug text-white">{question?.text}</h1>
            {question?.imageUrl && (
              <ZoomableImage src={question.imageUrl} alt={question.imageAlt} className="mt-3 w-full bg-white/5" />
            )}

            <div className="mt-4 grid gap-2">
              {question?.options.map((o, i) => {
                const isMine = game.myAnswer === i;
                const isRight = showResult && correctIndex === i;
                const isWrong = showResult && isMine && correctIndex !== i;
                return (
                  <button
                    key={o.id}
                    disabled={answered || wire.phase !== 'question'}
                    onClick={() => {
                      game.chooseAnswer(i);
                      sfx.click();
                      haptic(12);
                    }}
                    className={cx(
                      'flex items-center gap-3 rounded-2xl border-2 px-4 py-4 text-left font-bold transition min-h-[60px]',
                      isRight && 'border-sage-500 bg-sage-500/25 text-white',
                      isWrong && 'border-red-500 bg-red-500/20 text-white',
                      !showResult && (isMine ? 'border-gold-500 bg-gold-500/20 text-white' : 'border-white/15 bg-white/10 text-white'),
                      showResult && !isRight && !isWrong && 'border-white/10 bg-white/5 text-white/50',
                    )}
                  >
                    <span
                      className={cx(
                        'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm',
                        isRight ? 'bg-sage-500 text-white' : isWrong ? 'bg-red-500 text-white' : 'bg-white/15 text-white/80',
                      )}
                    >
                      {'ABCD'[i]}
                    </span>
                    <span className="flex-1">
                      {o.imageUrl && (
                        <ZoomableImage
                          src={o.imageUrl}
                          alt={o.imageAlt || ''}
                          className="mb-2 max-h-32 w-full rounded-xl object-cover"
                        />
                      )}
                      {o.text}
                    </span>
                    {isRight && <span aria-label="correct">✓</span>}
                    {isWrong && <span aria-label="incorrect">✕</span>}
                  </button>
                );
              })}
            </div>

            {answered && wire.phase === 'question' && (
              <p className="mt-3 text-center text-sm text-white/50">Answer locked in — waiting for the reveal…</p>
            )}

            <AnimatePresence>
              {showResult && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className={cx(
                    'mt-4 rounded-2xl p-4',
                    game.isCorrect ? 'bg-sage-500/20 border border-sage-500/40' : 'bg-red-500/15 border border-red-500/30',
                  )}
                >
                  <p className="font-display text-lg font-bold text-white">
                    {game.isCorrect ? '🎉 Correct!' : game.myAnswer === null ? '⏱ Time’s up' : 'Not quite — here’s why'}
                  </p>
                  <p className="mt-1 text-sm text-white/75">
                    {wire.explanation || `The correct answer is ${correctIndex !== undefined ? question?.options[correctIndex]?.text : 'shown above'}.`}
                  </p>
                  {game.isCorrect && breakEarned ? (
                    <p className="mt-2 text-sm font-bold text-gold-300">
                      🎮 Arcade pass unlocked — {wire.settings.breakDurationSec}s
                    </p>
                  ) : (
                    <p className="mt-2 text-sm text-white/50">Arcade passes only unlock on a correct answer. Next one!</p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </div>

      {/* reactions */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-white/10 bg-arcade-800/90 p-2 backdrop-blur">
        <div className="mx-auto flex max-w-xl items-center justify-between gap-1">
          {REACTIONS.map((r) => (
            <button
              key={r}
              onClick={() => {
                if (!game.sendReaction(r)) notify('Easy — one reaction every second', 'info');
              }}
              className="flex h-11 flex-1 items-center justify-center rounded-xl text-xl hover:bg-white/10"
              aria-label={`React with ${r}`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
