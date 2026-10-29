import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Btn, Card, EmptyState, ProgressBar, Tabs } from '../../components/ui';
import { useApp } from '../../store/AppStore';
import { countdown, daysUntil, formatDate, formatDateTime, formatMs } from '../../lib/utils';
import type { Assignment, AssignmentSubmission } from '../../types';

type TaskStatus = 'todo' | 'in_progress' | 'done' | 'overdue';

export const MyTasks: React.FC = () => {
  const { db, user } = useApp();
  const [tab, setTab] = useState<'todo' | 'in_progress' | 'done' | 'overdue'>('todo');

  const myClass = db.classes.find((c) => c.id === user?.classId);

  const assignments = useMemo(() => {
    if (!user) return [];
    return db.assignments.filter((a) => {
      if (a.archived) return false;
      if (a.learnerIds.includes(user.id)) return true;
      if (a.targetType === 'class') return a.classIds.includes(user.classId ?? '');
      if (a.targetType === 'year') return a.yearGroup === myClass?.yearGroup;
      return false;
    });
  }, [db.assignments, user, myClass?.yearGroup]);

  const classify = (a: Assignment): { status: TaskStatus; subs: AssignmentSubmission[] } => {
    const subs = db.submissions.filter((s) => s.assignmentId === a.id && s.learnerId === user?.id);
    const maxed = subs.length >= (a.attempts === 999 ? Infinity : a.attempts);
    const savedProgress = localStorage.getItem(`ebqa:task:${a.id}:${user?.id}`);
    const late = new Date(a.dueDate).getTime() < Date.now();
    if (maxed) return { status: late && subs.some((s) => s.late) ? 'done' : 'done', subs };
    if (late) return { status: 'overdue', subs };
    if (savedProgress) return { status: 'in_progress', subs };
    return { status: 'todo', subs };
  };

  const grouped = {
    todo: assignments.filter((a) => classify(a).status === 'todo'),
    in_progress: assignments.filter((a) => classify(a).status === 'in_progress'),
    done: assignments.filter((a) => classify(a).status === 'done'),
    overdue: assignments.filter((a) => classify(a).status === 'overdue'),
  };

  const list = grouped[tab];

  return (
    <div className="page">
      <div>
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-navy-700">My tasks</h1>
        <p className="text-sm text-navy-300 mt-1">
          {grouped.todo.length} to do · {grouped.in_progress.length} in progress · {grouped.done.length} done
          {grouped.overdue.length > 0 && ` · ${grouped.overdue.length} overdue`}
        </p>
      </div>

      <div className="mt-4">
        <Tabs
          tabs={[
            { id: 'todo', label: 'To do', count: grouped.todo.length },
            { id: 'in_progress', label: 'In progress', count: grouped.in_progress.length },
            { id: 'done', label: 'Done', count: grouped.done.length },
            { id: 'overdue', label: 'Overdue', count: grouped.overdue.length },
          ]}
          value={tab}
          onChange={(v) => setTab(v as typeof tab)}
        />
      </div>

      <div className="mt-4 space-y-3">
        {list.length === 0 && (
          <Card>
            <EmptyState
              emoji={tab === 'done' ? '🏁' : tab === 'overdue' ? '🌤️' : '🦅'}
              title={
                tab === 'done'
                  ? 'Nothing completed yet'
                  : tab === 'overdue'
                    ? 'No overdue tasks — nice'
                    : 'All clear here'
              }
              body={
                tab === 'overdue'
                  ? 'Keep it that way by starting early.'
                  : 'Your teacher will assign tasks here. In the meantime, try some solo practice.'
              }
              action={
                <Link to="/home">
                  <Btn variant="ghost">Back home</Btn>
                </Link>
              }
            />
          </Card>
        )}

        {list.map((a) => {
          const quiz = db.quizzes.find((q) => q.id === a.quizId);
          const { status, subs } = classify(a);
          const best = subs.length ? [...subs].sort((x, y) => y.accuracy - x.accuracy)[0] : null;
          const days = daysUntil(a.dueDate);
          const urgent = days <= 1;
          return (
            <Card key={a.id} className={status === 'overdue' ? 'border-red-200' : ''}>
              <div className="flex flex-wrap items-start gap-3">
                <span className="text-3xl" aria-hidden="true">
                  {quiz?.emoji ?? '📘'}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-display text-lg font-bold text-navy-700">{a.title}</h2>
                    <span
                      className={
                        status === 'done'
                          ? 'badge-sage'
                          : status === 'overdue'
                            ? 'badge-red'
                            : status === 'in_progress'
                              ? 'badge-gold'
                              : 'badge-navy'
                      }
                    >
                      {status === 'in_progress' ? 'In progress' : status === 'done' ? 'Done' : status === 'overdue' ? 'Overdue' : 'To do'}
                    </span>
                    {best?.late && <span className="badge-red">Late</span>}
                  </div>
                  <p className="text-xs text-navy-300 mt-0.5">
                    {quiz?.subject} · Year {quiz?.yearGroup} · {quiz?.questions.length ?? 0} questions ·{' '}
                    {a.attempts === 999 ? 'unlimited attempts' : `${a.attempts} attempt${a.attempts === 1 ? '' : 's'}`}
                  </p>
                  <p className="mt-1 text-sm text-navy-500 line-clamp-2">{a.instructions}</p>

                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                    <span className={urgent && status !== 'done' ? 'font-bold text-red-600' : 'text-navy-300'}>
                      📅 Due {formatDateTime(a.dueDate)}
                    </span>
                    {status !== 'done' && <span className="badge-navy">{countdown(a.dueDate)}</span>}
                    {a.arcade.enabled && <span className="badge-gold">🎮 {a.arcade.durationSec}s breaks</span>}
                    <span className="badge-teal">Short code {a.shortCode}</span>
                  </div>

                  {best && (
                    <div className="mt-3 rounded-xl bg-navy-50 p-2">
                      <div className="flex items-center justify-between text-xs font-bold">
                        <span>
                          Best attempt: {best.accuracy}% ({best.correct}/{best.total})
                        </span>
                        <span className="text-navy-300">
                          {formatDate(best.submittedAt)} · {formatMs(best.totalTimeMs)}
                        </span>
                      </div>
                      <div className="mt-1">
                        <ProgressBar value={best.accuracy} tone={best.accuracy >= 70 ? 'sage' : best.accuracy >= 50 ? 'gold' : 'red'} />
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <Link to={`/tasks/${a.id}`}>
                    <Btn variant={status === 'done' ? 'ghost' : status === 'overdue' ? 'ghost' : 'gold'} className="w-full">
                      {status === 'done' ? 'Review' : status === 'in_progress' ? 'Resume' : 'Open task'}
                    </Btn>
                  </Link>
                  {subs.length > 0 && (
                    <span className="text-center text-[10px] text-navy-300">
                      {subs.length} submission{subs.length === 1 ? '' : 's'}
                    </span>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <Card className="mt-5 bg-navy-50 border-navy-100">
        <p className="text-sm text-navy-500">
          <strong>Late work:</strong> tasks submitted after the due date are flagged for your teacher, who can extend or
          reopen them. If your teacher reopens a task, it moves back to <em>To do</em>.
        </p>
      </Card>
    </div>
  );
};
