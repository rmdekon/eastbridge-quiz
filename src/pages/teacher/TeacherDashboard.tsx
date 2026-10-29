import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Btn, Card, EmptyState, ProgressBar, SectionHeader, Stat, Tabs } from '../../components/ui';
import { Avatar } from '../../components/Avatar';
import { StartGameModal } from '../../components/StartGameModal';
import { useApp, useMyClasses, useMyQuizzes } from '../../store/AppStore';
import { formatDate, gradeFromPct, percent } from '../../lib/utils';
import type { QuizSet } from '../../types';
import { modeById } from '../../data/modes';

export const TeacherDashboard: React.FC = () => {
  const { db, user } = useApp();
  const classes = useMyClasses();
  const quizzes = useMyQuizzes();
  const nav = useNavigate();
  const [hosting, setHosting] = useState<QuizSet | null>(null);
  const [tab, setTab] = useState<'overview' | 'classes' | 'reports'>('overview');

  const learners = useMemo(
    () => db.profiles.filter((p) => p.role === 'learner' && classes.some((c) => c.id === p.classId)),
    [db.profiles, classes],
  );

  const myAssignments = useMemo(
    () => db.assignments.filter((a) => a.teacherId === user?.id || user?.role === 'admin'),
    [db.assignments, user],
  );

  const mySubs = useMemo(
    () => db.submissions.filter((s) => myAssignments.some((a) => a.id === s.assignmentId)),
    [db.submissions, myAssignments],
  );

  const avg = mySubs.length ? Math.round(mySubs.reduce((a, s) => a + s.accuracy, 0) / mySubs.length) : 0;
  const needsSupport = mySubs.filter((s) => s.accuracy < 50).length;
  const excelling = mySubs.filter((s) => s.accuracy >= 90).length;

  const recentReports = useMemo(
    () => [...db.reports].sort((a, b) => b.endedAt.localeCompare(a.endedAt)).slice(0, 4),
    [db.reports],
  );

  const classStats = classes.map((c) => {
    const classLearners = db.profiles.filter((p) => p.classId === c.id);
    const ids = new Set(classLearners.map((l) => l.id));
    const subs = mySubs.filter((s) => ids.has(s.learnerId));
    const classAvg = subs.length ? Math.round(subs.reduce((a, s) => a + s.accuracy, 0) / subs.length) : 0;
    const done = subs.filter((s) => s.status === 'done').length;
    return { c, learners: classLearners.length, avg: classAvg, done, total: subs.length };
  });

  const greeting = new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="page">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-gold-600">{db.settings.academicYear} · {db.settings.term}</p>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-navy-700">
            {greeting}, {user?.firstName}
          </h1>
          <p className="text-sm text-navy-300 mt-1">
            {classes.length} class{classes.length === 1 ? '' : 'es'} · {learners.length} learners · {myAssignments.length} assignments
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Btn variant="ghost" onClick={() => nav('/teacher/import')}>
            📥 Import
          </Btn>
          <Btn variant="ghost" onClick={() => nav('/teacher/editor/new')}>
            ✏️ New quiz
          </Btn>
          <Btn variant="gold" onClick={() => setHosting(quizzes[0] ?? null)} disabled={!quizzes.length}>
            ▶ Host a game
          </Btn>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Avg accuracy" value={`${avg}%`} hint={`${mySubs.length} submissions`} tone="teal" icon="🎯" />
        <Stat label="Needs support" value={needsSupport} hint="Below 50% — flagged automatically" tone="red" icon="🤝" />
        <Stat label="Excelling" value={excelling} hint="90% and above" tone="sage" icon="🌟" />
        <Stat label="Live games run" value={db.reports.length} hint="Post-game reports saved" tone="gold" icon="🕹️" />
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-4">
          <Card>
            <SectionHeader
              title="Quick start"
              subtitle="Everything a teacher needs in two taps."
              action={
                <Tabs
                  tabs={[
                    { id: 'overview', label: 'Overview' },
                    { id: 'classes', label: 'Classes' },
                    { id: 'reports', label: 'Reports', count: db.reports.length },
                  ]}
                  value={tab}
                  onChange={(v) => setTab(v as typeof tab)}
                />
              }
            />
            {tab === 'overview' && (
              <div className="grid gap-2 sm:grid-cols-2">
                {[
                  { icon: '📚', title: 'Quiz library', body: 'Browse, remix and duplicate quizzes', to: '/teacher/library' },
                  { icon: '🗂️', title: 'Assignments', body: 'Set homework with arcade breaks', to: '/teacher/assignments' },
                  { icon: '📊', title: 'Gradebook', body: 'Scores, heatmaps and exports', to: '/teacher/gradebook' },
                  { icon: '🕹️', title: 'Try minigames', body: 'Preview all 10 arcade breaks', to: '/teacher/minigames' },
                ].map((a) => (
                  <Link
                    key={a.title}
                    to={a.to}
                    className="flex items-start gap-3 rounded-2xl border border-navy-100 bg-white p-3 transition hover:-translate-y-0.5 hover:shadow-soft"
                  >
                    <span className="text-2xl" aria-hidden="true">
                      {a.icon}
                    </span>
                    <span>
                      <span className="block font-display font-bold text-navy-700">{a.title}</span>
                      <span className="block text-xs text-navy-300">{a.body}</span>
                    </span>
                  </Link>
                ))}
              </div>
            )}

            {tab === 'classes' && (
              <div className="space-y-3">
                {classStats.length === 0 && <EmptyState emoji="🏫" title="No classes yet" body="Ask the ICT office to add your classes." />}
                {classStats.map(({ c, learners: n, avg: cAvg, done, total }) => (
                  <div key={c.id} className="rounded-2xl border border-navy-100 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-display font-bold text-navy-700">{c.name}</p>
                        <p className="text-xs text-navy-300">
                          Year {c.yearGroup} · {n} learners · code {c.code}
                        </p>
                      </div>
                      <span className={cAvg >= 70 ? 'badge-sage' : cAvg >= 50 ? 'badge-gold' : 'badge-red'}>
                        avg {cAvg}%
                      </span>
                    </div>
                    <div className="mt-2">
                      <ProgressBar value={cAvg} tone={cAvg >= 70 ? 'sage' : cAvg >= 50 ? 'gold' : 'red'} label={`${c.name} average`} />
                    </div>
                    <p className="mt-1 text-[11px] text-navy-300">
                      {total === 0 ? 'No submissions yet' : `${done} of ${total} submissions marked done`}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {tab === 'reports' && (
              <div className="space-y-2">
                {recentReports.length === 0 ? (
                  <EmptyState emoji="🎮" title="No live games yet" body="Host a game and the report will appear here automatically." />
                ) : (
                  recentReports.map((r) => {
                    const top = [...r.players].sort((a, b) => b.score - a.score)[0];
                    return (
                      <Link
                        key={r.id}
                        to={`/teacher/report/${r.id}`}
                        className="flex items-center gap-3 rounded-2xl border border-navy-100 p-3 hover:bg-cream-50"
                      >
                        <span className="text-2xl" aria-hidden="true">
                          {modeById(r.mode).emoji}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-bold text-navy-700">{r.title}</span>
                          <span className="block text-xs text-navy-300">
                            {formatDate(r.endedAt)} · {r.players.length} players · winner {top?.name ?? '—'}
                          </span>
                        </span>
                        <span className="text-navy-300">→</span>
                      </Link>
                    );
                  })
                )}
              </div>
            )}
          </Card>

          <Card>
            <SectionHeader
              title="Recent quizzes"
              subtitle="Pick one to host or edit."
              action={
                <Link to="/teacher/library" className="text-sm font-bold text-teal-500 hover:underline">
                  View all →
                </Link>
              }
            />
            <div className="space-y-2">
              {quizzes.slice(0, 4).map((q) => (
                <div key={q.id} className="flex items-center gap-3 rounded-2xl border border-navy-100 p-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-navy-50 text-xl" aria-hidden="true">
                    {q.emoji}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold text-navy-700">{q.title}</p>
                    <p className="text-xs text-navy-300">
                      {q.subject} · Year {q.yearGroup} · {q.questions.length} questions
                    </p>
                  </div>
                  <Btn size="sm" variant="gold" onClick={() => setHosting(q)}>
                    Host
                  </Btn>
                  <Btn size="sm" variant="ghost" onClick={() => nav(`/teacher/editor/${q.id}`)}>
                    Edit
                  </Btn>
                </div>
              ))}
              {quizzes.length === 0 && <EmptyState emoji="📚" title="No quizzes yet" body="Create your first quiz or import one." />}
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <SectionHeader title="Learner snapshot" subtitle="Who needs a nudge this week." />
            <div className="space-y-2">
              {learners.slice(0, 6).map((l) => {
                const subs = mySubs.filter((s) => s.learnerId === l.id);
                const acc = subs.length ? Math.round(subs.reduce((a, s) => a + s.accuracy, 0) / subs.length) : null;
                const grade = acc === null ? '—' : gradeFromPct(acc, db.settings.gradeBands);
                return (
                  <div key={l.id} className="flex items-center gap-2">
                    <Avatar id={l.avatarId} size={34} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-navy-700">
                        {l.firstName} {l.lastName}
                      </p>
                      <p className="text-[11px] text-navy-300">
                        {db.classes.find((c) => c.id === l.classId)?.name ?? '—'} · Lv {Math.floor(Math.sqrt(l.xp / 45)) + 1}
                      </p>
                    </div>
                    {acc !== null && (
                      <span
                        className={
                          acc >= 90 ? 'badge-sage' : acc < 50 ? 'badge-red' : 'badge-navy'
                        }
                      >
                        {grade} · {acc}%
                      </span>
                    )}
                  </div>
                );
              })}
              {learners.length === 0 && <EmptyState emoji="🦅" title="No learners in your classes yet" />}
            </div>
          </Card>

          <Card className="bg-navy-600 text-white border-navy-600">
            <h3 className="font-display text-lg font-bold">Assembly idea</h3>
            <p className="mt-1 text-sm text-white/70">
              Crowd Party mode shows a giant QR code so the whole hall can join from phones — with preset reactions only.
            </p>
            <Btn variant="gold" className="mt-3 w-full" onClick={() => nav('/teacher/library')}>
              Start a Crowd Party
            </Btn>
          </Card>

          <Card>
            <h3 className="font-display font-bold text-navy-700">Arcade policy</h3>
            <p className="mt-1 text-xs text-navy-300">
              Arcade bonuses are capped at 20% of a question&apos;s points and shown separately from academic scores, so
              accuracy always leads the gradebook.
            </p>
            <div className="mt-3 flex items-center justify-between text-xs">
              <span className="font-bold text-navy-500">Games enabled</span>
              <Link to="/teacher/minigames" className="font-bold text-teal-500 hover:underline">
                Manage →
              </Link>
            </div>
            <p className="mt-1 text-sm font-bold text-navy-700">
              {10 - db.settings.minigamesDisabled.length} of 10
            </p>
          </Card>
        </div>
      </div>

      <StartGameModal quiz={hosting} open={Boolean(hosting)} onClose={() => setHosting(null)} />
    </div>
  );
};
