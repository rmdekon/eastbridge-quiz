import React, { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Avatar } from '../../components/Avatar';
import { Btn, Card, EmptyState, Field, Modal, ProgressBar, SectionHeader, Stat, Tabs } from '../../components/ui';
import { useApp } from '../../store/AppStore';
import { buildGradebookRows, calcQuestionAnalysis, exportGradebookCsv, exportGradebookPdf, exportGradebookXlsx } from '../../lib/exports';
import { formatDate, formatDateTime, formatMs, gradeFromPct } from '../../lib/utils';
import type { AssignmentSubmission } from '../../types';

export const GradebookDetail: React.FC = () => {
  const { assignmentId = '' } = useParams();
  const { db, user, updateSubmission, saveAssignment, notify } = useApp();
  const assignment = db.assignments.find((a) => a.id === assignmentId);
  const quiz = db.quizzes.find((q) => q.id === assignment?.quizId);
  const [tab, setTab] = useState<'scores' | 'questions' | 'heatmap'>('scores');
  const [classFilter, setClassFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [commentFor, setCommentFor] = useState<AssignmentSubmission | null>(null);
  const [commentText, setCommentText] = useState('');
  const [sortKey, setSortKey] = useState<'accuracy' | 'time' | 'name'>('accuracy');

  const submissions = useMemo(() => {
    let list = db.submissions.filter((s) => s.assignmentId === assignmentId);
    if (classFilter !== 'all') {
      const ids = new Set(db.profiles.filter((p) => p.classId === classFilter).map((p) => p.id));
      list = list.filter((s) => ids.has(s.learnerId));
    }
    if (statusFilter !== 'all') list = list.filter((s) => s.status === statusFilter);
    return list.sort((a, b) => {
      if (sortKey === 'time') return a.totalTimeMs - b.totalTimeMs;
      if (sortKey === 'name') {
        const an = db.profiles.find((p) => p.id === a.learnerId)?.firstName ?? '';
        const bn = db.profiles.find((p) => p.id === b.learnerId)?.firstName ?? '';
        return an.localeCompare(bn);
      }
      return b.accuracy - a.accuracy;
    });
  }, [db.submissions, db.profiles, assignmentId, classFilter, statusFilter, sortKey]);

  const allSubs = db.submissions.filter((s) => s.assignmentId === assignmentId);
  const rows = buildGradebookRows(submissions, db.profiles, db.classes, db.settings.gradeBands);
  const analysis = useMemo(() => calcQuestionAnalysis(quiz?.questions ?? [], allSubs), [quiz?.questions, allSubs]);

  if (!assignment || !quiz) {
    return (
      <div className="page-tight py-16 text-center">
        <div className="text-5xl">📊</div>
        <h1 className="font-display text-2xl font-bold text-navy-700 mt-3">Assignment not found</h1>
        <Link to="/teacher/gradebook" className="inline-block mt-4">
          <Btn>Back to gradebook</Btn>
        </Link>
      </div>
    );
  }

  const avg = allSubs.length ? Math.round(allSubs.reduce((a, s) => a + s.accuracy, 0) / allSubs.length) : 0;
  const hardest = [...analysis].sort((a, b) => a.correctPct - b.correctPct)[0];
  const easiest = [...analysis].sort((a, b) => b.correctPct - a.correctPct)[0];
  const lateCount = allSubs.filter((s) => s.late).length;
  const arcadeTotal = allSubs.reduce((a, s) => a + s.arcadeBonus, 0);

  return (
    <div className="page">
      <button onClick={() => history.back()} className="text-sm font-bold text-navy-300 hover:text-navy-600">
        ← Gradebook
      </button>
      <div className="mt-1 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-navy-700">{assignment.title}</h1>
          <p className="text-sm text-navy-300 mt-1">
            {quiz.title} · {quiz.subject} · Year {quiz.yearGroup} · due {formatDate(assignment.dueDate)} · code{' '}
            <span className="font-bold">{assignment.shortCode}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Btn size="sm" variant="ghost" onClick={() => exportGradebookCsv(assignment, rows)}>
            ⬇️ CSV
          </Btn>
          <Btn size="sm" variant="ghost" onClick={() => exportGradebookXlsx(assignment, rows, analysis)}>
            ⬇️ XLSX
          </Btn>
          <Btn size="sm" variant="ghost" onClick={() => exportGradebookPdf(assignment, rows, analysis, db.settings.schoolName)}>
            ⬇️ PDF
          </Btn>
          <Btn
            size="sm"
            variant="ghost"
            onClick={async () => {
              await saveAssignment({
                ...assignment,
                dueDate: new Date(new Date(assignment.dueDate).getTime() + 7 * 86_400_000).toISOString(),
              });
              notify('Due date extended by a week');
            }}
          >
            📅 Extend
          </Btn>
          <Btn
            size="sm"
            onClick={async () => {
              await saveAssignment({ ...assignment, attempts: 999, dueDate: new Date(Date.now() + 7 * 86_400_000).toISOString() });
              notify('Task reopened for another attempt');
            }}
          >
            🔓 Reopen
          </Btn>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Average accuracy" value={`${avg}%`} tone="teal" icon="🎯" hint={`${allSubs.length} submissions`} />
        <Stat label="Late submissions" value={lateCount} tone={lateCount ? 'red' : 'sage'} icon="⏰" hint="Flagged automatically" />
        <Stat label="Arcade bonus awarded" value={`+${arcadeTotal}`} tone="gold" icon="🪙" hint="Kept separate from scores" />
        <Stat
          label="Grade spread"
          value={`${gradeFromPct(avg, db.settings.gradeBands)}`}
          tone="navy"
          icon="🏅"
          hint={`${allSubs.filter((s) => s.late).length} late · ${new Set(allSubs.map((s) => s.learnerId)).size} learners`}
        />
      </div>

      <div className="mt-4">
        <Tabs
          tabs={[
            { id: 'scores', label: 'Scores', count: submissions.length },
            { id: 'questions', label: 'Question analysis', count: analysis.length },
            { id: 'heatmap', label: 'Heatmap' },
          ]}
          value={tab}
          onChange={(v) => setTab(v as typeof tab)}
        />
      </div>

      {tab === 'scores' && (
        <Card className="mt-4" pad={false}>
          <div className="flex flex-wrap items-center gap-2 p-3">
            <select aria-label="Filter class" className="input !min-h-[44px] !py-2 text-sm w-auto" value={classFilter} onChange={(e) => setClassFilter(e.target.value)}>
              <option value="all">All classes</option>
              {db.classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select aria-label="Filter status" className="input !min-h-[44px] !py-2 text-sm w-auto" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">All statuses</option>
              <option value="done">Done</option>
              <option value="overdue">Overdue / late</option>
              <option value="in_progress">In progress</option>
              <option value="todo">Not started</option>
            </select>
            <select aria-label="Sort by" className="input !min-h-[44px] !py-2 text-sm w-auto" value={sortKey} onChange={(e) => setSortKey(e.target.value as typeof sortKey)}>
              <option value="accuracy">Sort: score</option>
              <option value="time">Sort: time taken</option>
              <option value="name">Sort: name</option>
            </select>
            <span className="ml-auto text-xs text-navy-300">{submissions.length} rows</span>
          </div>
          {submissions.length === 0 ? (
            <EmptyState emoji="📝" title="No submissions yet" body="Learners will appear here as soon as they submit." />
          ) : (
            <div className="table-wrap border-0 max-h-[560px] overflow-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Learner</th>
                    <th>Accuracy</th>
                    <th>Correct</th>
                    <th>Time</th>
                    <th>Best streak</th>
                    <th>Attempt</th>
                    <th>Arcade bonus</th>
                    <th>Grade</th>
                    <th>Status</th>
                    <th>Comment</th>
                  </tr>
                </thead>
                <tbody>
                  {submissions.map((s) => {
                    const learner = db.profiles.find((p) => p.id === s.learnerId);
                    return (
                      <tr key={s.id}>
                        <td>
                          <span className="inline-flex items-center gap-2">
                            <Avatar id={learner?.avatarId} size={28} />
                            <span>
                              <span className="block font-bold text-navy-700">
                                {learner?.firstName} {learner?.lastName}
                              </span>
                              <span className="block text-[10px] text-navy-300">
                                {db.classes.find((c) => c.id === learner?.classId)?.name}
                              </span>
                            </span>
                          </span>
                        </td>
                        <td className="w-28">
                          <div className="flex items-center gap-2">
                            <span className="font-bold">{s.accuracy}%</span>
                            <div className="flex-1">
                              <ProgressBar value={s.accuracy} tone={s.accuracy >= 70 ? 'sage' : s.accuracy >= 50 ? 'gold' : 'red'} />
                            </div>
                          </div>
                        </td>
                        <td>
                          {s.correct}/{s.total}
                        </td>
                        <td>{formatMs(s.totalTimeMs)}</td>
                        <td>{s.bestStreak}</td>
                        <td>{s.attempt}</td>
                        <td className="font-bold text-gold-600">+{s.arcadeBonus}</td>
                        <td className="font-bold">{gradeFromPct(s.accuracy, db.settings.gradeBands)}</td>
                        <td>
                          <span
                            className={
                              s.status === 'done' ? 'badge-sage' : s.status === 'overdue' ? 'badge-red' : 'badge-gold'
                            }
                          >
                            {s.status === 'overdue' ? 'Late' : s.status.replace('_', ' ')}
                          </span>
                          {s.accuracy < 50 && <span className="badge-red ml-1">support</span>}
                          {s.accuracy >= 90 && <span className="badge-sage ml-1">excelling</span>}
                        </td>
                        <td>
                          <button
                            className="max-w-[160px] truncate text-left text-xs font-bold text-teal-600 hover:underline"
                            onClick={() => {
                              setCommentFor(s);
                              setCommentText(s.teacherComment ?? '');
                            }}
                          >
                            {s.teacherComment || '+ Add comment'}
                          </button>
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

      {tab === 'questions' && (
        <div className="mt-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Card>
              <p className="text-xs font-bold uppercase text-red-500">Hardest question</p>
              <p className="mt-1 font-bold text-navy-700">{hardest?.text ?? '—'}</p>
              <p className="text-sm text-navy-300">{hardest ? `${hardest.correctPct}% correct · avg ${formatMs(hardest.avgMs)}` : ''}</p>
            </Card>
            <Card>
              <p className="text-xs font-bold uppercase text-sage-500">Easiest question</p>
              <p className="mt-1 font-bold text-navy-700">{easiest?.text ?? '—'}</p>
              <p className="text-sm text-navy-300">{easiest ? `${easiest.correctPct}% correct · avg ${formatMs(easiest.avgMs)}` : ''}</p>
            </Card>
          </div>
          <Card pad={false}>
            <div className="table-wrap border-0">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Question</th>
                    <th>% correct</th>
                    <th>Attempts</th>
                    <th>Avg time</th>
                    <th>Most-chosen wrong answer</th>
                  </tr>
                </thead>
                <tbody>
                  {analysis.map((a, i) => (
                    <tr key={a.questionId}>
                      <td className="font-bold text-navy-300">{i + 1}</td>
                      <td className="max-w-[360px]">{a.text}</td>
                      <td className="w-36">
                        <div className="flex items-center gap-2">
                          <span className="font-bold">{a.correctPct}%</span>
                          <div className="flex-1">
                            <ProgressBar
                              value={a.correctPct}
                              tone={a.correctPct >= 70 ? 'sage' : a.correctPct >= 40 ? 'gold' : 'red'}
                            />
                          </div>
                        </div>
                      </td>
                      <td>{a.attempts}</td>
                      <td>{formatMs(a.avgMs)}</td>
                      <td className="text-xs">
                        {a.mostChosenWrong ? (
                          <span>
                            “{a.mostChosenWrong.text}” <span className="badge-red">{a.mostChosenWrong.count}</span>
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {tab === 'heatmap' && (
        <Card className="mt-4">
          <SectionHeader
            title="Learner × question heatmap"
            subtitle="Green = correct, red = incorrect, grey = not answered. Spot the pattern at a glance."
          />
          <div className="overflow-x-auto">
            <table className="text-xs">
              <thead>
                <tr>
                  <th className="sticky left-0 bg-white px-2 py-1 text-left">Learner</th>
                  {quiz.questions.map((q, i) => (
                    <th key={q.id} className="px-1 py-1 text-center font-bold text-navy-300" title={q.text}>
                      {i + 1}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {allSubs.map((s) => {
                  const learner = db.profiles.find((p) => p.id === s.learnerId);
                  return (
                    <tr key={s.id}>
                      <td className="sticky left-0 bg-white px-2 py-1 font-bold whitespace-nowrap">
                        {learner?.firstName ?? '—'}
                      </td>
                      {quiz.questions.map((q) => {
                        const a = s.answers.find((x) => x.questionId === q.id);
                        const color = !a ? '#e5e7eb' : a.correct ? '#7FA476' : '#e88b8b';
                        return (
                          <td key={q.id} className="p-0.5">
                            <div
                              className="h-7 w-7 rounded"
                              style={{ background: color }}
                              title={`${q.text} — ${a ? (a.correct ? 'correct' : 'incorrect') : 'not answered'}`}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {allSubs.length === 0 && <EmptyState emoji="🗺️" title="No answers to map yet" />}
          </div>
        </Card>
      )}

      <Modal
        open={Boolean(commentFor)}
        onClose={() => setCommentFor(null)}
        title={`Comment for ${db.profiles.find((p) => p.id === commentFor?.learnerId)?.firstName ?? 'learner'}`}
        footer={
          <>
            <Btn variant="ghost" onClick={() => setCommentFor(null)}>
              Cancel
            </Btn>
            <Btn
              onClick={async () => {
                if (commentFor) await updateSubmission(commentFor.id, { teacherComment: commentText });
                setCommentFor(null);
                notify('Comment saved');
              }}
            >
              Save comment
            </Btn>
          </>
        }
      >
        <Field label="Feedback" htmlFor="teacher-comment" hint="Visible to you and in exports. Keep it encouraging.">
          <textarea
            id="teacher-comment"
            className="input min-h-[120px]"
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            maxLength={500}
          />
        </Field>
      </Modal>

      <Card className="mt-4 bg-navy-50 border-navy-100">
        <p className="text-xs text-navy-500">
          Submissions submitted after the due date are marked <strong>Late</strong>. Reopening extends the due date by a week and
          adds an attempt so learners can improve — earlier attempts remain in the learner&apos;s profile.
        </p>
      </Card>
    </div>
  );
};
