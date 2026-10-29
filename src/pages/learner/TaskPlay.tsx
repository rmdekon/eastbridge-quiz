import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArcadeBreak, type ArcadeResult } from '../../arcade/ArcadeBreak';
import { Btn, Card, CountdownRing, Logo, ProgressBar, ZoomableImage } from '../../components/ui';
import { useApp } from '../../store/AppStore';
import type { Assignment, AssignmentSubmission, MinigameResult, Question, QuizSet, SubmissionAnswer } from '../../types';
import { clamp, countdown, formatMs, shuffle, uid } from '../../lib/utils';
import { storage } from '../../lib/storage';
import { sfx } from '../../lib/sfx';

type Phase = 'intro' | 'question' | 'feedback' | 'arcade' | 'summary';

interface SavedProgress {
  attempt: number;
  index: number;
  answers: SubmissionAnswer[];
  arcadeBonus: number;
  minigameResults: MinigameResult[];
  startedAt: string;
  order: string[];
}

export const TaskPlay: React.FC = () => {
  const { assignmentId, quizId } = useParams();
  const nav = useNavigate();
  const { db, user, settings, saveSubmission, rewardLearner, notify } = useApp();

  const assignment: Assignment | undefined = assignmentId
    ? db.assignments.find((a) => a.id === assignmentId)
    : undefined;
  const practice = !assignment;
  const quiz: QuizSet | undefined = db.quizzes.find((q) => q.id === (assignment?.quizId ?? quizId));

  const attemptsUsed = useMemo(
    () =>
      assignment && user
        ? db.submissions.filter((s) => s.assignmentId === assignment.id && s.learnerId === user.id).length
        : 0,
    [assignment, db.submissions, user],
  );
  const maxAttempts = assignment?.attempts ?? 999;
  const attemptsLeft = maxAttempts === 999 ? Infinity : Math.max(0, maxAttempts - attemptsUsed);
  const dueDate = assignment?.dueDate;
  const overdue = dueDate ? new Date(dueDate).getTime() < Date.now() : false;

  const saveKey = assignment && user ? `task:${assignment.id}:${user.id}` : `practice:${quiz?.id ?? 'x'}`;
  const [saved, setSaved] = useState<SavedProgress | null>(() => storage.get<SavedProgress | null>(saveKey, null));

  const [phase, setPhase] = useState<Phase>('intro');
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<SubmissionAnswer[]>([]);
  const [arcadeBonus, setArcadeBonus] = useState(0);
  const [minigameResults, setMinigameResults] = useState<MinigameResult[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [correct, setCorrect] = useState<boolean | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [startedAt, setStartedAt] = useState(new Date().toISOString());
  const [order, setOrder] = useState<string[]>([]);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [coinEarned, setCoinEarned] = useState(0);
  const [nextIn, setNextIn] = useState(5);
  const [questionShownAt, setQuestionShownAt] = useState(Date.now());
  const [summary, setSummary] = useState<AssignmentSubmission | null>(null);
  const [busy, setBusy] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const questions = useMemo<Question[]>(() => {
    if (!quiz) return [];
    if (order.length) {
      const map = new Map(quiz.questions.map((q) => [q.id, q]));
      return order.map((id) => map.get(id)).filter(Boolean) as Question[];
    }
    return quiz.questions;
  }, [quiz, order]);

  const current = questions[index];
  const total = questions.length;
  const alreadyDone = !practice && attemptsLeft <= 0;

  /* ------------------------------- start game ----------------------------- */
  const begin = (resume = false) => {
    if (!quiz) return;
    if (resume && saved) {
      setIndex(saved.index);
      setAnswers(saved.answers);
      setArcadeBonus(saved.arcadeBonus);
      setMinigameResults(saved.minigameResults);
      setOrder(saved.order);
      setStartedAt(saved.startedAt);
      setQuestionShownAt(Date.now());
      setPhase('question');
      return;
    }
    const list = assignment?.shuffle ? shuffle(quiz.questions) : [...quiz.questions];
    setOrder(list.map((q) => q.id));
    setIndex(0);
    setAnswers([]);
    setArcadeBonus(0);
    setMinigameResults([]);
    setStreak(0);
    setBestStreak(0);
    setCoinEarned(0);
    setStartedAt(new Date().toISOString());
    setQuestionShownAt(Date.now());
    storage.remove(saveKey);
    setSaved(null);
    setPhase('question');
    sfx.start();
  };

  /* -------------------------------- timers -------------------------------- */
  useEffect(() => {
    if (phase !== 'question' || !current) return;
    const limit = current.timeLimit * 1000;
    setTimeLeft(limit);
    setQuestionShownAt(Date.now());
    const started = Date.now();
    timerRef.current = setInterval(() => {
      const left = Math.max(0, limit - (Date.now() - started));
      setTimeLeft(left);
      if (left <= 0) {
        if (timerRef.current) clearInterval(timerRef.current);
        // timeout counts as a wrong answer
        setSelected(null);
        setCorrect(false);
        setPhase('feedback');
        sfx.wrong();
      }
    }, 200);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase === 'question' ? current?.id : 'idle', index]);

  // Feedback countdown for wrong answers
  useEffect(() => {
    if (phase !== 'feedback' || correct !== false) return;
    setNextIn(5);
    const id = setInterval(() => {
      setNextIn((n) => {
        if (n <= 1) {
          clearInterval(id);
          advance();
          return 0;
        }
        return n - 1;
      });
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, correct, index]);

  /* -------------------------------- answer -------------------------------- */
  const answer = (optionIndex: number) => {
    if (phase !== 'question' || !current) return;
    if (timerRef.current) clearInterval(timerRef.current);
    const ms = clamp(Date.now() - questionShownAt, 150, current.timeLimit * 1000);
    const isCorrect = optionIndex === current.correctIndex;
    const speedFactor = 0.6 + 0.4 * (1 - ms / (current.timeLimit * 1000));
    const points = isCorrect ? Math.round(current.points * speedFactor) : 0;
    setSelected(optionIndex);
    setCorrect(isCorrect);
    setAnswers((prev) => [
      ...prev,
      { questionId: current.id, optionIndex, correct: isCorrect, ms, points },
    ]);
    if (isCorrect) {
      sfx.correct();
      setStreak((s) => {
        const next = s + 1;
        setBestStreak((b) => Math.max(b, next));
        return next;
      });
    } else {
      sfx.wrong();
      setStreak(0);
    }
    setPhase('feedback');
  };

  const persistProgress = useCallback(
    (nextIndex: number, nextAnswers: SubmissionAnswer[]) => {
      if (!assignment) return;
      const progress: SavedProgress = {
        attempt: attemptsUsed + 1,
        index: nextIndex,
        answers: nextAnswers,
        arcadeBonus,
        minigameResults,
        startedAt,
        order,
      };
      storage.set(saveKey, progress);
    },
    [arcadeBonus, assignment, attemptsUsed, minigameResults, order, saveKey, startedAt],
  );

  const advance = () => {
    setSelected(null);
    setCorrect(null);
    const nextIndex = index + 1;
    if (nextIndex >= total) {
      void finishSubmission();
      return;
    }
    if (assignment) persistProgress(nextIndex, answers);
    setIndex(nextIndex);
    setPhase('question');
  };

  /* ------------------------------ arcade break ---------------------------- */
  const arcadeEnabled =
    !practice && assignment ? assignment.arcade.enabled && !settings.skipMinigames : !settings.skipMinigames;
  const breakDuration = assignment?.arcade.durationSec ?? 60;
  const trigger = assignment?.arcade.trigger ?? 'every';

  const triggerMet =
    trigger === 'every'
      ? true
      : trigger === 'every_2'
        ? (answers.filter((a) => a.correct).length + (correct ? 1 : 0)) % 2 === 0
        : streak >= 3;

  const earnedBreak = Boolean(correct) && arcadeEnabled && triggerMet;

  const handleArcadeComplete = (result: ArcadeResult) => {
    setArcadeBonus((b) => b + result.bonusPoints);
    setMinigameResults((prev) => [
      ...prev,
      { gameId: result.gameId, score: result.rawScore, coins: result.coins, durationMs: result.durationMs, playedAt: new Date().toISOString() },
    ]);
    setCoinEarned((c) => c + result.coins);
    setPhase('feedback');
    setTimeout(() => advance(), 400);
  };

  /* ------------------------------- submission ----------------------------- */
  const finishSubmission = async () => {
    if (!quiz || !user) return;
    if (busy) return;
    setBusy(true);
    const totalMs = Date.now() - new Date(startedAt).getTime();
    const correctCount = answers.filter((a) => a.correct).length;
    const accuracy = total > 0 ? Math.round((correctCount / total) * 100) : 0;
    const academic = answers.reduce((a, x) => a + x.points, 0);
    const submission: AssignmentSubmission = {
      id: uid('sub'),
      assignmentId: assignment?.id ?? `practice-${quiz.id}`,
      learnerId: user.id,
      quizId: quiz.id,
      attempt: attemptsUsed + 1,
      score: academic,
      accuracy,
      correct: correctCount,
      total,
      bestStreak,
      totalTimeMs: totalMs,
      answers,
      arcadeBonus,
      minigameResults,
      status: overdue ? 'overdue' : 'done',
      late: overdue,
      submittedAt: new Date().toISOString(),
      startedAt,
    };
    setSummary(submission);
    setPhase('summary');
    setBusy(false);
    storage.remove(saveKey);
    setSaved(null);
    sfx.win();
    if (assignment) {
      await saveSubmission(submission);
      notify(overdue ? 'Submitted — flagged as late' : 'Task submitted 🎉');
    }
    if (user.role === 'learner') {
      await rewardLearner(user.id, coinEarned + correctCount * 10, correctCount * 8 + (accuracy === 100 ? 40 : 0));
    }
  };

  /* --------------------------------- renders ------------------------------- */
  if (!quiz) {
    return (
      <div className="page-tight py-16 text-center">
        <div className="text-5xl">📭</div>
        <h1 className="font-display text-2xl font-bold text-navy-700 mt-3">This quiz is not available</h1>
        <p className="text-navy-300 mt-1">Ask your teacher to check the assignment link.</p>
        <Link to="/tasks" className="inline-block mt-4">
          <Btn>Back to my tasks</Btn>
        </Link>
      </div>
    );
  }

  if (phase === 'summary' && summary) {
    const bands = db.settings.gradeBands;
    const grade = bands.find((b) => summary.accuracy >= b.min)?.grade ?? 'U';
    return (
      <div className="page-tight py-8">
        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center">
          <div className="text-6xl">{summary.accuracy >= 80 ? '🎉' : summary.accuracy >= 50 ? '💪' : '🌱'}</div>
          <h1 className="font-display text-3xl font-bold text-navy-700 mt-2">
            {summary.accuracy >= 80 ? 'Brilliant work!' : summary.accuracy >= 50 ? 'Good effort!' : 'Keep going — you’ll get there'}
          </h1>
          <p className="text-navy-300 mt-1">
            {quiz.title} · {practice ? 'Practice run (not scored)' : assignment?.title}
          </p>
        </motion.div>

        <div className="mx-auto mt-5 max-w-xl space-y-3">
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase text-navy-300">Academic score</p>
                <p className="font-display text-3xl font-bold text-navy-700">
                  {summary.accuracy}% <span className="text-base text-navy-300">· grade {grade}</span>
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs font-bold uppercase text-navy-300">Arcade bonus</p>
                <p className="font-display text-3xl font-bold text-gold-500">+{summary.arcadeBonus}</p>
              </div>
            </div>
            <div className="mt-3">
              <ProgressBar value={summary.accuracy} tone={summary.accuracy >= 70 ? 'sage' : summary.accuracy >= 50 ? 'gold' : 'red'} label="Accuracy" />
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center text-sm">
              <div className="rounded-xl bg-navy-50 py-2">
                <p className="font-display text-lg font-bold">{summary.correct}/{summary.total}</p>
                <p className="text-[10px] uppercase text-navy-300">Correct</p>
              </div>
              <div className="rounded-xl bg-navy-50 py-2">
                <p className="font-display text-lg font-bold">{summary.bestStreak}</p>
                <p className="text-[10px] uppercase text-navy-300">Best streak</p>
              </div>
              <div className="rounded-xl bg-navy-50 py-2">
                <p className="font-display text-lg font-bold">{formatMs(summary.totalTimeMs)}</p>
                <p className="text-[10px] uppercase text-navy-300">Time</p>
              </div>
            </div>
            {summary.late && (
              <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-600">
                ⚠ Submitted after the due date — your teacher will see this flagged as late.
              </p>
            )}
            <p className="mt-3 text-xs text-navy-300">
              🪙 {coinEarned + summary.correct * 10} Eagle Coins and {summary.correct * 8 + (summary.accuracy === 100 ? 40 : 0)} XP added to your
              profile. The arcade bonus is kept separate from your academic score.
            </p>
          </Card>

          {summary.minigameResults.length > 0 && (
            <Card>
              <h3 className="font-display font-bold text-navy-700">Arcade breaks played</h3>
              <div className="mt-2 space-y-1">
                {summary.minigameResults.map((m, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-navy-500">{m.gameId.replace('-', ' ')}</span>
                    <span className="font-bold">🪙 {m.coins}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <div className="flex flex-wrap gap-2">
            {practice ? (
              <Btn onClick={() => nav('/home')}>Back to home</Btn>
            ) : (
              <Btn onClick={() => nav('/tasks')}>Back to my tasks</Btn>
            )}
            {!practice && attemptsLeft > 1 && (
              <Btn
                variant="gold"
                onClick={() => {
                  setSummary(null);
                  setPhase('intro');
                  setIndex(0);
                  setAnswers([]);
                  setArcadeBonus(0);
                  setMinigameResults([]);
                  setSelected(null);
                  setCorrect(null);
                }}
              >
                Try again (attempt {attemptsUsed + 2})
              </Btn>
            )}
            <Btn variant="ghost" onClick={() => nav('/home')}>
              Home
            </Btn>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'arcade') {
    return (
      <div className="min-h-dvh">
        <ArcadeBreak
          durationSec={breakDuration}
          yearGroup={quiz.yearGroup}
          allowedGames={assignment?.arcade.allowedGames ?? []}
          disabledGames={db.settings.minigamesDisabled}
          skipAllowed={assignment?.arcade.skipAllowed ?? true}
          questionPoints={current?.points ?? 1000}
          muted={!settings.sound}
          title={`${quiz.title} · Q${index + 1}`}
          onComplete={handleArcadeComplete}
          onSkip={() => setPhase('feedback')}
        />
      </div>
    );
  }

  if (phase === 'intro') {
    return (
      <div className="page-tight py-8">
        <div className="mx-auto max-w-xl">
          <div className="flex items-center gap-3">
            <Logo size={48} />
            <div>
              <p className="text-xs font-bold uppercase text-gold-600">
                {practice ? 'Solo practice' : overdue ? 'Overdue task' : 'Assignment'}
              </p>
              <h1 className="font-display text-2xl font-bold text-navy-700">{assignment?.title ?? quiz.title}</h1>
            </div>
          </div>

          <Card className="mt-4">
            <p className="text-sm text-navy-500">{assignment?.instructions ?? quiz.description}</p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
              <div className="rounded-xl bg-navy-50 p-2 text-center">
                <p className="font-display text-lg font-bold">{quiz.questions.length}</p>
                <p className="text-[10px] uppercase text-navy-300">Questions</p>
              </div>
              <div className="rounded-xl bg-navy-50 p-2 text-center">
                <p className="font-display text-lg font-bold">{practice ? '∞' : attemptsLeft === Infinity ? '∞' : attemptsLeft}</p>
                <p className="text-[10px] uppercase text-navy-300">Attempts left</p>
              </div>
              <div className="rounded-xl bg-navy-50 p-2 text-center">
                <p className="font-display text-lg font-bold">{assignment?.arcade.enabled ?? true ? `${breakDuration}s` : 'Off'}</p>
                <p className="text-[10px] uppercase text-navy-300">Arcade break</p>
              </div>
              <div className="rounded-xl bg-navy-50 p-2 text-center">
                <p className="font-display text-lg font-bold">{dueDate ? countdown(dueDate).split(' ')[0] : '—'}</p>
                <p className="text-[10px] uppercase text-navy-300">Due</p>
              </div>
            </div>

            {overdue && (
              <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-600">
                This task is overdue. You can still submit, but it will be flagged late.
              </p>
            )}
            {saved && !alreadyDone && (
              <div className="mt-3 rounded-xl bg-teal-100/60 p-3">
                <p className="text-sm font-bold text-teal-700">You have an unfinished attempt</p>
                <p className="text-xs text-teal-700/80">
                  Question {Math.min(saved.index + 1, saved.answers.length + 1)} of {quiz.questions.length} · saved{' '}
                  {new Date(saved.startedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                </p>
                <div className="mt-2 flex gap-2">
                  <Btn size="sm" onClick={() => begin(true)}>
                    Resume
                  </Btn>
                  <Btn size="sm" variant="ghost" onClick={() => begin(false)}>
                    Start over
                  </Btn>
                </div>
              </div>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              {alreadyDone ? (
                <p className="rounded-xl bg-gold-100 px-3 py-2 text-sm font-bold text-gold-600">
                  You have used all {maxAttempts} attempt{maxAttempts === 1 ? '' : 's'}. Ask your teacher to reopen this task.
                </p>
              ) : (
                <Btn size="lg" variant="gold" onClick={() => begin(false)} disabled={Boolean(saved) && !alreadyDone}>
                  Start {practice ? 'practice' : 'task'} →
                </Btn>
              )}
              <Link to={assignment ? '/tasks' : '/home'}>
                <Btn variant="ghost">Back</Btn>
              </Link>
            </div>
            {!practice && assignment?.arcade.enabled && (
              <p className="mt-3 text-xs text-navy-300">
                🎮 Arcade break: {breakDuration}s after{' '}
                {assignment.arcade.trigger === 'every'
                  ? 'every correct answer'
                  : assignment.arcade.trigger === 'every_2'
                    ? 'every 2nd correct answer'
                    : 'a streak of 3'}{' '}
                · bonus capped at 20% of the question points.
              </p>
            )}
          </Card>
        </div>
      </div>
    );
  }

  /* --------------------------- question / feedback ------------------------- */
  const answeredCorrectly = correct === true;
  const isFeedback = phase === 'feedback';

  return (
    <div className="min-h-dvh bg-cream-100">
      <div className="sticky top-16 z-20 border-b border-navy-100 bg-cream-100/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-2">
          <Logo size={28} />
          <span className="text-xs font-bold text-navy-300">
            Q{index + 1}/{total}
          </span>
          <div className="flex-1">
            <ProgressBar value={((index + (isFeedback ? 1 : 0)) / total) * 100} tone="teal" label="Quiz progress" />
          </div>
          {!isFeedback && (
            <CountdownRing remaining={timeLeft / 1000} total={current?.timeLimit ?? 20} size={44} />
          )}
          {streak >= 2 && <span className="text-sm font-bold text-gold-600">🔥{streak}</span>}
          <span className="rounded-lg bg-navy-50 px-2 py-1 text-xs font-bold text-navy-600">
            {answers.reduce((a, x) => a + x.points, 0) + arcadeBonus}
          </span>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 py-5">
        <AnimatePresence mode="wait">
          <motion.div
            key={`${index}-${phase}`}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.2 }}
          >
            <p className="text-xs font-bold uppercase tracking-wider text-gold-600">{current?.topic || quiz.subject}</p>
            <h1 className="mt-1 font-display text-xl sm:text-2xl font-bold leading-snug text-navy-700">{current?.text}</h1>
            {current?.imageUrl && (
              <ZoomableImage src={current.imageUrl} alt={current.imageAlt} className="mt-3 w-full bg-white" />
            )}

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {current?.options.map((o, i) => {
                const isSelected = selected === i;
                const isRight = isFeedback && current.correctIndex === i;
                const isWrong = isFeedback && isSelected && current.correctIndex !== i;
                return (
                  <button
                    key={o.id}
                    onClick={() => answer(i)}
                    disabled={isFeedback}
                    className={`flex min-h-[64px] items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left font-bold transition ${
                      isRight
                        ? 'border-sage-500 bg-sage-100'
                        : isWrong
                          ? 'border-red-400 bg-red-50'
                          : isSelected
                            ? 'border-gold-500 bg-gold-100/50'
                            : 'border-navy-100 bg-white hover:-translate-y-0.5 hover:border-teal-400 hover:shadow-soft'
                    }`}
                  >
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm ${
                        isRight ? 'bg-sage-500 text-white' : isWrong ? 'bg-red-500 text-white' : 'bg-navy-50 text-navy-500'
                      }`}
                    >
                      {isRight ? '✓' : isWrong ? '✕' : 'ABCD'[i]}
                    </span>
                    <span className="flex-1">
                      {o.imageUrl && (
                        <img
                          src={o.imageUrl}
                          alt={o.imageAlt || ''}
                          className="mb-2 max-h-32 w-full rounded-xl object-cover"
                          loading="lazy"
                        />
                      )}
                      {o.text}
                    </span>
                  </button>
                );
              })}
            </div>
          </motion.div>
        </AnimatePresence>

        <AnimatePresence>
          {isFeedback && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className={`mt-4 rounded-3xl border p-4 ${
                answeredCorrectly ? 'border-sage-300 bg-sage-100/60' : 'border-gold-300 bg-gold-100/40'
              }`}
            >
              <div className="flex items-start gap-3">
                <span className="text-3xl">{answeredCorrectly ? '🎉' : selected === null ? '⏱' : '💡'}</span>
                <div className="flex-1">
                  <p className="font-display text-lg font-bold text-navy-700">
                    {answeredCorrectly ? 'Correct!' : selected === null ? 'Time ran out' : 'Not quite'}
                  </p>
                  <p className="mt-1 text-sm text-navy-600">
                    {current?.explanation || `The correct answer is “${current?.options[current.correctIndex]?.text}”.`}
                  </p>
                  {!answeredCorrectly && (
                    <p className="mt-2 text-xs font-bold text-navy-300">
                      No arcade break this time — the next one is yours. Moving on in {nextIn}s…
                    </p>
                  )}
                </div>
              </div>

              {answeredCorrectly && earnedBreak && (
                <div className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl bg-navy-600 p-3 text-white">
                  <span className="text-2xl">🎮</span>
                  <div className="flex-1">
                    <p className="font-display font-bold">Arcade break unlocked</p>
                    <p className="text-xs text-white/60">
                      {breakDuration}s · bonus capped at 20% of {current?.points} pts
                    </p>
                  </div>
                  <Btn size="sm" variant="gold" onClick={() => setPhase('arcade')}>
                    Play now
                  </Btn>
                  <button onClick={advance} className="text-xs font-bold text-white/60 underline">
                    Next question →
                  </button>
                </div>
              )}

              {answeredCorrectly && !earnedBreak && (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-navy-300">
                    {arcadeEnabled ? 'Arcade break locked for this one — nice answer anyway.' : 'Arcade breaks are off for this task.'}
                  </p>
                  <Btn size="sm" onClick={advance}>
                    Next question →
                  </Btn>
                </div>
              )}

              {!answeredCorrectly && (
                <div className="mt-3 flex justify-end">
                  <Btn size="sm" variant="ghost" onClick={advance}>
                    Next now ({nextIn}s)
                  </Btn>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <p className="mt-4 text-center text-[11px] text-navy-300">
          {answeredCorrectly && earnedBreak ? 'Skip the break any time — your academic score is already saved.' : 'Tip: read the explanation before moving on.'}
        </p>
      </div>
    </div>
  );
};
