import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Avatar } from '../../components/Avatar';
import { Btn, Card, EmptyState, ProgressBar, SectionHeader } from '../../components/ui';
import { useApp } from '../../store/AppStore';
import { countdown, formatDate, levelFromXp, xpForLevel } from '../../lib/utils';
import { BADGES } from '../../data/avatars';
import type { Assignment } from '../../types';
import { normalizePin } from '../../lib/codes';

export const LearnerHome: React.FC = () => {
  const { db, user, saveProfile, notify } = useApp();
  const nav = useNavigate();
  const [pin, setPin] = useState('');

  if (!user) return null;

  const myClass = db.classes.find((c) => c.id === user.classId);
  const level = levelFromXp(user.xp);
  const nextLevelXp = xpForLevel(level + 1);
  const prevLevelXp = xpForLevel(level);
  const levelPct = Math.min(100, Math.max(0, ((user.xp - prevLevelXp) / Math.max(1, nextLevelXp - prevLevelXp)) * 100));

  const myAssignments = useMemo(
    () =>
      db.assignments.filter((a) => {
        if (a.archived) return false;
        if (a.learnerIds.includes(user.id)) return true;
        if (a.targetType === 'class') return a.classIds.includes(user.classId ?? '');
        if (a.targetType === 'year') return a.yearGroup === myClass?.yearGroup;
        return false;
      }),
    [db.assignments, user, myClass?.yearGroup],
  );

  const mySubs = db.submissions.filter((s) => s.learnerId === user.id);
  const doneIds = new Set(mySubs.map((s) => s.assignmentId));

  const statusOf = (a: Assignment) => {
    const subs = mySubs.filter((s) => s.assignmentId === a.id);
    if (subs.length >= (a.attempts === 999 ? Infinity : a.attempts)) return 'done' as const;
    if (new Date(a.dueDate).getTime() < Date.now()) return 'overdue' as const;
    return 'todo' as const;
  };

  const todo = myAssignments.filter((a) => statusOf(a) === 'todo');
  const overdue = myAssignments.filter((a) => statusOf(a) === 'overdue');

  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const key = d.toISOString().slice(0, 10);
    const played = mySubs.some((s) => (s.submittedAt ?? s.startedAt).slice(0, 10) === key) ||
      db.reports.some((r) => r.players.some((p) => p.profileId === user.id) && r.endedAt.slice(0, 10) === key);
    return { key, label: d.toLocaleDateString('en-GB', { weekday: 'narrow' }), played };
  });

  const practiceQuizzes = db.quizzes
    .filter((q) => q.yearGroup === myClass?.yearGroup)
    .slice(0, 3);

  const classLeaderboard = useMemo(() => {
    const classmates = db.profiles.filter((p) => p.role === 'learner' && p.classId === user.classId);
    return classmates
      .map((p) => {
        const subs = db.submissions.filter((s) => s.learnerId === p.id);
        const acc = subs.length ? Math.round(subs.reduce((a, s) => a + s.accuracy, 0) / subs.length) : 0;
        return { ...p, acc, count: subs.length };
      })
      .sort((a, b) => b.xp - a.xp)
      .slice(0, 5);
  }, [db.profiles, db.submissions, user.classId]);

  const equipHat = async (id: string) => {
    if (!user.ownedItems.includes(id)) {
      notify('Buy this item in the shop first', 'info');
      return;
    }
    await saveProfile({ ...user, hatId: user.hatId === id ? undefined : id });
  };

  return (
    <div className="page">
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-4">
          <Card className="overflow-hidden !p-0">
            <div className="bg-navy-600 p-5 text-white">
              <div className="flex items-center gap-4">
                <Avatar id={user.avatarId} size={72} hat={user.hatId} ring />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold uppercase tracking-wider text-gold-300">
                    {myClass?.name ?? 'Eastbridge'} · Year {myClass?.yearGroup ?? '—'}
                  </p>
                  <h1 className="font-display text-2xl font-bold leading-tight truncate">
                    Hi {user.firstName}!
                  </h1>
                  <div className="mt-1 flex items-center gap-3 text-sm">
                    <span className="rounded-lg bg-white/15 px-2 py-0.5 font-bold">🪙 {user.coins.toLocaleString()}</span>
                    <span className="rounded-lg bg-white/15 px-2 py-0.5 font-bold">Level {level}</span>
                    <span className="rounded-lg bg-white/15 px-2 py-0.5 font-bold">🔥 {mySubs.length} quizzes</span>
                  </div>
                </div>
              </div>
              <div className="mt-4">
                <div className="flex justify-between text-[11px] text-white/60">
                  <span>Level {level}</span>
                  <span>
                    {Math.max(0, nextLevelXp - user.xp)} XP to level {level + 1}
                  </span>
                </div>
                <div className="mt-1 h-2.5 w-full overflow-hidden rounded-full bg-white/15">
                  <div className="h-full rounded-full bg-gold-500 transition-all" style={{ width: `${levelPct}%` }} />
                </div>
              </div>
            </div>

            <div className="p-4">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (pin.length === 6) nav(`/join?pin=${pin}`);
                }}
                className="flex gap-2"
              >
                <label className="sr-only" htmlFor="join-pin">
                  Game PIN
                </label>
                <input
                  id="join-pin"
                  value={pin}
                  onChange={(e) => setPin(normalizePin(e.target.value))}
                  inputMode="numeric"
                  placeholder="Live game PIN"
                  className="input flex-1 text-center text-lg font-bold tracking-[0.3em] placeholder:tracking-normal placeholder:font-normal"
                />
                <Btn type="submit" variant="gold" disabled={pin.length !== 6}>
                  Join
                </Btn>
              </form>
              <div className="mt-2 flex flex-wrap gap-2">
                <Link to="/tasks">
                  <Btn size="sm" variant="ghost">
                    🗂️ My tasks {todo.length ? `(${todo.length})` : ''}
                  </Btn>
                </Link>
                <Link to="/shop">
                  <Btn size="sm" variant="ghost">
                    🛍️ Avatar shop
                  </Btn>
                </Link>
              </div>
            </div>
          </Card>

          <Card>
            <SectionHeader
              title="Due soon"
              subtitle={todo.length ? `${todo.length} task${todo.length === 1 ? '' : 's'} to do · ${overdue.length} overdue` : 'You are all caught up!'}
              action={
                <Link to="/tasks" className="text-sm font-bold text-teal-500 hover:underline">
                  All tasks →
                </Link>
              }
            />
            {todo.length === 0 && overdue.length === 0 ? (
              <EmptyState
                emoji="🎉"
                title="Nothing due right now"
                body="Try a practice quiz below, or join a live game with a PIN."
              />
            ) : (
              <div className="space-y-2">
                {[...overdue, ...todo].slice(0, 4).map((a) => {
                  const quiz = db.quizzes.find((q) => q.id === a.quizId);
                  const isOverdue = statusOf(a) === 'overdue';
                  return (
                    <div
                      key={a.id}
                      className={`flex flex-wrap items-center gap-3 rounded-2xl border p-3 ${
                        isOverdue ? 'border-red-200 bg-red-50/50' : 'border-navy-100'
                      }`}
                    >
                      <span className="text-2xl" aria-hidden="true">
                        {quiz?.emoji ?? '📘'}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-bold text-navy-700">{a.title}</p>
                        <p className="text-xs text-navy-300">
                          {quiz?.subject} · {isOverdue ? 'Overdue' : countdown(a.dueDate)} · {a.attempts === 999 ? '∞' : a.attempts} attempt{a.attempts === 1 ? '' : 's'}
                        </p>
                      </div>
                      <Link to={`/tasks/${a.id}`}>
                        <Btn size="sm" variant={isOverdue ? 'ghost' : 'gold'}>
                          {isOverdue ? 'Submit late' : 'Start'}
                        </Btn>
                      </Link>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          <Card>
            <SectionHeader title="Practise your year group" subtitle="Solo practice — arcade breaks included, no grade attached." />
            <div className="grid gap-2 sm:grid-cols-3">
              {practiceQuizzes.map((q) => (
                <Link
                  key={q.id}
                  to={`/practice/${q.id}`}
                  className="rounded-2xl border border-navy-100 p-3 transition hover:-translate-y-0.5 hover:shadow-soft"
                >
                  <span className="text-2xl" aria-hidden="true">
                    {q.emoji}
                  </span>
                  <p className="mt-1 line-clamp-2 font-display text-sm font-bold text-navy-700">{q.title}</p>
                  <p className="text-[11px] text-navy-300">
                    {q.subject} · {q.questions.length} Q
                  </p>
                </Link>
              ))}
              {practiceQuizzes.length === 0 && (
                <p className="text-sm text-navy-300">No quizzes for your year group yet — check back soon.</p>
              )}
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <SectionHeader title="Streak calendar" subtitle="A little practice every day adds up." />
            <div className="flex justify-between gap-1">
              {week.map((d) => (
                <div key={d.key} className="flex-1 text-center">
                  <div
                    className={`mx-auto flex h-11 w-11 items-center justify-center rounded-xl text-lg ${
                      d.played ? 'bg-gold-500 text-white' : 'bg-navy-50 text-navy-300'
                    }`}
                    title={d.played ? `Played on ${d.key}` : `No activity on ${d.key}`}
                  >
                    {d.played ? '🦅' : '·'}
                  </div>
                  <p className="mt-1 text-[10px] font-bold text-navy-300">{d.label}</p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-navy-300">
              Play at least once a day to grow your streak. Badges unlock automatically.
            </p>
          </Card>

          <Card>
            <SectionHeader title="My badges" subtitle={`${user.badges.length} unlocked`} />
            <div className="flex flex-wrap gap-2">
              {user.badges.length === 0 && <p className="text-sm text-navy-300">No badges yet — a correct answer streak will start you off.</p>}
              {user.badges.map((b) => (
                <div key={b} className="rounded-xl bg-gold-100 px-3 py-2 text-center" title={BADGES[b]?.blurb}>
                  <div className="text-xl">{BADGES[b]?.emoji ?? '🏅'}</div>
                  <div className="text-[10px] font-bold text-gold-600">{b}</div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <SectionHeader title="Class leaderboard" subtitle="By XP and average accuracy" />
            <div className="space-y-2">
              {classLeaderboard.map((p, i) => (
                <div key={p.id} className={`flex items-center gap-2 rounded-xl p-1.5 ${p.id === user.id ? 'bg-gold-100/60' : ''}`}>
                  <span className="w-5 text-center text-xs font-bold text-navy-300">{i + 1}</span>
                  <Avatar id={p.avatarId} size={30} />
                  <span className="min-w-0 flex-1 truncate text-sm font-bold text-navy-700">
                    {p.firstName} {p.id === user.id && '(you)'}
                  </span>
                  <span className="text-xs font-bold text-navy-500">{p.acc}%</span>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <SectionHeader title="Hat locker" subtitle="Tap to wear it" />
            <div className="flex flex-wrap gap-2">
              {['hat-cap', 'hat-grad', 'hat-crown', 'hat-headset'].map((id) => {
                const owned = user.ownedItems.includes(id);
                return (
                  <button
                    key={id}
                    onClick={() => equipHat(id)}
                    className={`rounded-xl border-2 p-2 text-2xl ${
                      user.hatId === id ? 'border-gold-500 bg-gold-100/50' : 'border-navy-100'
                    } ${owned ? '' : 'opacity-40'}`}
                    aria-pressed={user.hatId === id}
                    title={owned ? 'Wear this hat' : 'Locked — buy in the shop'}
                  >
                    {id === 'hat-cap' ? '🧢' : id === 'hat-grad' ? '🎓' : id === 'hat-crown' ? '👑' : '🎧'}
                  </button>
                );
              })}
            </div>
          </Card>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <Card className="bg-teal-500 text-white border-teal-500">
              <h3 className="font-display text-lg font-bold">Keep the streak alive</h3>
              <p className="mt-1 text-sm text-white/80">
                You&apos;ve earned {user.coins.toLocaleString()} Eagle Coins. Spend them on skins, hats and trails in the shop.
              </p>
              <Link to="/shop">
                <Btn variant="gold" className="mt-3 w-full">
                  Open the shop
                </Btn>
              </Link>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
};
