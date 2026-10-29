import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Btn, Card, EmptyState, ProgressBar, SectionHeader, Stat, Tabs } from '../../components/ui';
import { Avatar } from '../../components/Avatar';
import { useApp, useMyClasses } from '../../store/AppStore';
import { exportClassComparison } from '../../lib/exports';
import { formatDate, gradeFromPct, percent } from '../../lib/utils';
import { SUBJECTS } from '../../types';
import { modeById } from '../../data/modes';

export const GradebookPage: React.FC = () => {
  const { db, user } = useApp();
  const classes = useMyClasses();
  const [tab, setTab] = useState<'assignments' | 'live' | 'learners' | 'compare'>('assignments');
  const [classId, setClassId] = useState('all');
  const [subject, setSubject] = useState('all');
  const [term, setTerm] = useState('all');

  const myAssignments = useMemo(
    () =>
      db.assignments.filter(
        (a) =>
          (user?.role === 'admin' || a.teacherId === user?.id || a.classIds.some((c) => classes.some((cc) => cc.id === c))) &&
          (classId === 'all' || a.classIds.includes(classId)) &&
          (subject === 'all' || db.quizzes.find((q) => q.id === a.quizId)?.subject === subject),
      ),
    [db.assignments, db.quizzes, user, classes, classId, subject],
  );

  const submissions = useMemo(
    () => db.submissions.filter((s) => myAssignments.some((a) => a.id === s.assignmentId)),
    [db.submissions, myAssignments],
  );

  const reports = useMemo(
    () => db.reports.filter((r) => user?.role === 'admin' || r.hostId === user?.id || true),
    [db.reports, user],
  );

  const avg = submissions.length ? Math.round(submissions.reduce((a, s) => a + s.accuracy, 0) / submissions.length) : 0;
  const learns = new Set(submissions.map((s) => s.learnerId)).size;

  const classComparison = classes.map((c) => {
    const ids = new Set(db.profiles.filter((p) => p.classId === c.id).map((p) => p.id));
    const subs = submissions.filter((s) => ids.has(s.learnerId));
    return {
      id: c.id,
      name: c.name,
      avg: subs.length ? Math.round(subs.reduce((a, s) => a + s.accuracy, 0) / subs.length) : 0,
      submissions: subs.length,
    };
  });

  const learners = db.profiles.filter((p) => p.role === 'learner' && classes.some((c) => c.id === p.classId));

  const learnerRows = learners
    .map((l) => {
      const subs = submissions.filter((s) => s.learnerId === l.id);
      const acc = subs.length ? Math.round(subs.reduce((a, s) => a + s.accuracy, 0) / subs.length) : null;
      const arcade = subs.reduce((a, s) => a + s.arcadeBonus, 0);
      const best = subs.length ? Math.max(...subs.map((s) => s.accuracy)) : null;
      return { learner: l, subs, acc, arcade, best };
    })
    .sort((a, b) => (b.acc ?? -1) - (a.acc ?? -1));

  return (
    <div className="page">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-navy-700">Gradebook & analytics</h1>
          <p className="text-sm text-navy-300 mt-1">
            Academic scores and arcade bonuses are always shown separately.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select aria-label="Filter by class" className="input !min-h-[44px] !py-2 text-sm w-auto" value={classId} onChange={(e) => setClassId(e.target.value)}>
            <option value="all">All classes</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select aria-label="Filter by subject" className="input !min-h-[44px] !py-2 text-sm w-auto" value={subject} onChange={(e) => setSubject(e.target.value)}>
            <option value="all">All subjects</option>
            {SUBJECTS.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <select aria-label="Filter by term" className="input !min-h-[44px] !py-2 text-sm w-auto" value={term} onChange={(e) => setTerm(e.target.value)}>
            <option value="all">All dates</option>
            <option value="30">Last 30 days</option>
            <option value="90">This term</option>
          </select>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Average accuracy" value={`${avg}%`} tone="teal" icon="🎯" hint={`${submissions.length} submissions`} />
        <Stat label="Learners assessed" value={learns} tone="navy" icon="🦅" hint={`${classes.length} classes`} />
        <Stat
          label="Needs support"
          value={submissions.filter((s) => s.accuracy < 50).length}
          tone="red"
          icon="🤝"
          hint="Below 50%"
        />
        <Stat
          label="Excelling"
          value={submissions.filter((s) => s.accuracy >= 90).length}
          tone="sage"
          icon="🌟"
          hint="90% and above"
        />
      </div>

      <div className="mt-4">
        <Tabs
          tabs={[
            { id: 'assignments', label: 'Assignments', count: myAssignments.length },
            { id: 'live', label: 'Live games', count: reports.length },
            { id: 'learners', label: 'Learner profiles', count: learners.length },
            { id: 'compare', label: 'Compare classes' },
          ]}
          value={tab}
          onChange={(v) => setTab(v as typeof tab)}
        />
      </div>

      {tab === 'assignments' && (
        <Card className="mt-4" pad={false}>
          {myAssignments.length === 0 ? (
            <EmptyState emoji="📊" title="No assignments to assess yet" body="Create an assignment and learner scores will appear here." />
          ) : (
            <div className="table-wrap border-0">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Assignment</th>
                    <th>Subject</th>
                    <th>Due</th>
                    <th>Submissions</th>
                    <th>Average</th>
                    <th>Needs support</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {myAssignments.map((a) => {
                    const quiz = db.quizzes.find((q) => q.id === a.quizId);
                    const subs = db.submissions.filter((s) => s.assignmentId === a.id);
                    const aAvg = subs.length ? Math.round(subs.reduce((x, s) => x + s.accuracy, 0) / subs.length) : 0;
                    const support = subs.filter((s) => s.accuracy < 50).length;
                    return (
                      <tr key={a.id}>
                        <td className="font-bold">
                          <Link to={`/teacher/gradebook/${a.id}`} className="hover:text-teal-500">
                            {a.title}
                          </Link>
                          <span className="ml-2 badge-navy">{a.shortCode}</span>
                        </td>
                        <td>{quiz?.subject ?? '—'}</td>
                        <td>{formatDate(a.dueDate)}</td>
                        <td>{subs.length}</td>
                        <td className="w-32">
                          <div className="flex items-center gap-2">
                            <span className="font-bold">{aAvg}%</span>
                            <div className="flex-1">
                              <ProgressBar value={aAvg} tone={aAvg >= 70 ? 'sage' : aAvg >= 50 ? 'gold' : 'red'} />
                            </div>
                          </div>
                        </td>
                        <td>{support > 0 ? <span className="badge-red">{support}</span> : <span className="badge-sage">0</span>}</td>
                        <td>
                          <Link to={`/teacher/gradebook/${a.id}`}>
                            <Btn size="sm">Open</Btn>
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {tab === 'live' && (
        <Card className="mt-4" pad={false}>
          {reports.length === 0 ? (
            <EmptyState emoji="🎮" title="No live game reports" body="Every hosted game saves a report with per-question analysis." />
          ) : (
            <div className="table-wrap border-0">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Game</th>
                    <th>Mode</th>
                    <th>Played</th>
                    <th>Players</th>
                    <th>Top score</th>
                    <th>Hardest question</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {reports.map((r) => {
                    const hardest = [...r.questionStats].sort((a, b) => a.correctPct - b.correctPct)[0];
                    const top = [...r.players].sort((a, b) => b.score - a.score)[0];
                    return (
                      <tr key={r.id}>
                        <td className="font-bold">{r.title}</td>
                        <td>
                          {modeById(r.mode).emoji} {modeById(r.mode).name}
                        </td>
                        <td>{formatDate(r.endedAt)}</td>
                        <td>{r.players.length}</td>
                        <td>
                          {top ? `${top.score.toLocaleString()} · ${top.name}` : '—'}
                        </td>
                        <td className="text-xs">{hardest ? `${hardest.correctPct}% · ${hardest.text.slice(0, 40)}…` : '—'}</td>
                        <td>
                          <Link to={`/teacher/report/${r.id}`}>
                            <Btn size="sm" variant="ghost">
                              Report
                            </Btn>
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {tab === 'learners' && (
        <Card className="mt-4" pad={false}>
          <div className="table-wrap border-0">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Learner</th>
                  <th>Class</th>
                  <th>Average</th>
                  <th>Best</th>
                  <th>Submissions</th>
                  <th>Arcade bonus</th>
                  <th>Grade</th>
                  <th>Flags</th>
                </tr>
              </thead>
              <tbody>
                {learnerRows.map(({ learner, subs, acc, arcade, best }) => (
                  <tr key={learner.id}>
                    <td>
                      <span className="inline-flex items-center gap-2">
                        <Avatar id={learner.avatarId} size={28} />
                        <span className="font-bold">
                          {learner.firstName} {learner.lastName}
                        </span>
                      </span>
                    </td>
                    <td>{db.classes.find((c) => c.id === learner.classId)?.name ?? '—'}</td>
                    <td className="font-bold">{acc === null ? '—' : `${acc}%`}</td>
                    <td>{best === null ? '—' : `${best}%`}</td>
                    <td>{subs.length}</td>
                    <td className="text-gold-600 font-bold">+{arcade}</td>
                    <td>{acc === null ? '—' : gradeFromPct(acc, db.settings.gradeBands)}</td>
                    <td>
                      {acc !== null && acc < 50 && <span className="badge-red">Needs support</span>}
                      {acc !== null && acc >= 90 && <span className="badge-sage">Excelling</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === 'compare' && (
        <Card className="mt-4">
          <SectionHeader
            title="Class comparison"
            subtitle="Average accuracy across all filtered assignments."
            action={
              <Btn size="sm" variant="ghost" onClick={() => exportClassComparison(classComparison)}>
                ⬇️ Export XLSX
              </Btn>
            }
          />
          <div className="space-y-3">
            {classComparison.map((c) => (
              <div key={c.id}>
                <div className="flex justify-between text-sm">
                  <span className="font-bold text-navy-700">{c.name}</span>
                  <span className="text-navy-300">
                    {c.avg}% · {c.submissions} submissions
                  </span>
                </div>
                <div className="mt-1">
                  <ProgressBar value={c.avg} tone={c.avg >= 70 ? 'sage' : c.avg >= 50 ? 'gold' : 'red'} label={`${c.name} average`} />
                </div>
              </div>
            ))}
            {classComparison.length === 0 && <EmptyState emoji="🏫" title="No classes to compare yet" />}
          </div>
          <p className="mt-4 text-xs text-navy-300">
            Heatmaps, per-question analysis and PDF exports live inside each assignment&apos;s gradebook.
          </p>
        </Card>
      )}

      <Card className="mt-4 bg-navy-50 border-navy-100">
        <p className="text-xs text-navy-500">
          <strong>How to read this:</strong> “Score %” is academic accuracy only. The arcade bonus column records extra points
          earned in minigames, capped at 20% of each question&apos;s value, so it can never overtake quiz accuracy.
        </p>
      </Card>
    </div>
  );
};
