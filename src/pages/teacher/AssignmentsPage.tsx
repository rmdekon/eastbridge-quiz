import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Btn, Card, ConfirmDialog, EmptyState, Field, Modal, ProgressBar, Tabs, Toggle } from '../../components/ui';
import { useApp, useMyClasses } from '../../store/AppStore';
import type { Assignment } from '../../types';
import { countdown, formatDate, toDateInput, uid, copyToClipboard, cx } from '../../lib/utils';
import { generateShortCode } from '../../lib/codes';
import { MINIGAME_MANIFESTS } from '../../minigames/registry';

const blankAssignment = (quizId: string, teacherId: string, classIds: string[]): Assignment => ({
  id: uid('asg'),
  quizId,
  teacherId,
  title: '',
  instructions: '',
  targetType: 'class',
  classIds,
  learnerIds: [],
  startDate: new Date().toISOString(),
  dueDate: new Date(Date.now() + 7 * 86_400_000).toISOString(),
  attempts: 1,
  shuffle: true,
  shuffleAnswers: true,
  showAnswers: true,
  arcade: { enabled: true, durationSec: 60, allowedGames: [], trigger: 'every', skipAllowed: true },
  shortCode: generateShortCode(),
  createdAt: new Date().toISOString(),
});

export const AssignmentsPage: React.FC = () => {
  const { db, user, saveAssignment, deleteAssignment, notify } = useApp();
  const classes = useMyClasses();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [tab, setTab] = useState<'active' | 'past'>('active');
  const [editing, setEditing] = useState<Assignment | null>(() => {
    const quizParam = params.get('quiz');
    if (quizParam) {
      const base = blankAssignment(quizParam, user?.id ?? '', classes[0] ? [classes[0].id] : []);
      const quiz = db.quizzes.find((q) => q.id === quizParam);
      return { ...base, title: quiz ? `${quiz.title} — task` : 'New task' };
    }
    return null;
  });
  const [deleting, setDeleting] = useState<Assignment | null>(null);
  const [reopening, setReopening] = useState<Assignment | null>(null);

  const visible = useMemo(
    () =>
      db.assignments
        .filter((a) => user?.role === 'admin' || a.teacherId === user?.id || a.classIds.some((c) => classes.some((cc) => cc.id === c)))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [db.assignments, user, classes],
  );

  const active = visible.filter((a) => new Date(a.dueDate).getTime() > Date.now() && !a.archived);
  const past = visible.filter((a) => new Date(a.dueDate).getTime() <= Date.now() || a.archived);
  const list = tab === 'active' ? active : past;

  const submit = async (a: Assignment) => {
    if (!a.title.trim()) {
      notify('Give the assignment a title', 'error');
      return;
    }
    if (!a.quizId) {
      notify('Choose a quiz first', 'error');
      return;
    }
    await saveAssignment(a);
    setEditing(null);
  };

  const share = async (a: Assignment) => {
    const url = `${window.location.origin}/tasks/${a.id}`;
    const ok = await copyToClipboard(`${a.title} — ${a.shortCode}\n${url}`);
    notify(ok ? `Copied ${a.shortCode} and link` : `Share code: ${a.shortCode}`, ok ? 'success' : 'info');
  };

  const extend = async (a: Assignment, days: number) => {
    await saveAssignment({
      ...a,
      dueDate: new Date(Math.max(Date.now(), new Date(a.dueDate).getTime()) + days * 86_400_000).toISOString(),
    });
    notify(`Extended by ${days} day${days === 1 ? '' : 's'}`);
  };

  const reopen = async (a: Assignment) => {
    // Reopening clears the attempt cap so everyone can start again; marked submissions stay for comparison.
    await saveAssignment({ ...a, attempts: 999, archived: false, dueDate: new Date(Date.now() + 7 * 86_400_000).toISOString() });
    notify('Task reopened with a fresh 7-day window');
    setReopening(null);
  };

  const submissionStats = (a: Assignment) => {
    const subs = db.submissions.filter((s) => s.assignmentId === a.id);
    const learners = db.profiles.filter(
      (p) =>
        p.role === 'learner' &&
        (a.learnerIds.includes(p.id) || (a.targetType === 'class' && a.classIds.includes(p.classId ?? ''))),
    );
    const done = new Set(subs.map((s) => s.learnerId)).size;
    const avg = subs.length ? Math.round(subs.reduce((x, s) => x + s.accuracy, 0) / subs.length) : 0;
    return { total: Math.max(learners.length, done), done, avg, subs };
  };

  return (
    <div className="page">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-navy-700">Assignments</h1>
          <p className="text-sm text-navy-300 mt-1">Set tasks with arcade breaks, track who has submitted, extend or reopen.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Btn variant="ghost" onClick={() => nav('/teacher/gradebook')}>
            📊 Gradebook
          </Btn>
          <Btn
            variant="gold"
            onClick={() => {
              const first = db.quizzes[0];
              if (!first) {
                notify('Create a quiz first', 'error');
                return;
              }
              setEditing({ ...blankAssignment(first.id, user?.id ?? '', classes[0] ? [classes[0].id] : []), title: `${first.title} — task` });
            }}
          >
            + New assignment
          </Btn>
        </div>
      </div>

      <div className="mt-4">
        <Tabs
          tabs={[
            { id: 'active', label: 'Active', count: active.length },
            { id: 'past', label: 'Past & archived', count: past.length },
          ]}
          value={tab}
          onChange={(v) => setTab(v as typeof tab)}
        />
      </div>

      <div className="mt-4 space-y-3">
        {list.length === 0 && (
          <Card>
            <EmptyState
              emoji="🗂️"
              title={tab === 'active' ? 'No active assignments' : 'Nothing in the archive'}
              body="Assign a quiz to a class, a year group or selected learners."
              action={<Btn onClick={() => setEditing(blankAssignment(db.quizzes[0]?.id ?? '', user?.id ?? '', classes[0] ? [classes[0].id] : []))}>Create assignment</Btn>}
            />
          </Card>
        )}
        {list.map((a) => {
          const quiz = db.quizzes.find((q) => q.id === a.quizId);
          const stats = submissionStats(a);
          const overdue = new Date(a.dueDate).getTime() < Date.now();
          return (
            <Card key={a.id}>
              <div className="flex flex-wrap items-start gap-3">
                <span className="text-3xl" aria-hidden="true">
                  {quiz?.emoji ?? '📘'}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-display text-lg font-bold text-navy-700">{a.title}</h2>
                    <span className={overdue ? 'badge-red' : 'badge-sage'}>{overdue ? 'Closed' : countdown(a.dueDate)}</span>
                    {a.archived && <span className="badge-navy">Archived</span>}
                  </div>
                  <p className="text-xs text-navy-300">
                    {quiz?.title} · due {formatDate(a.dueDate)} ·{' '}
                    {a.targetType === 'class'
                      ? a.classIds.map((id) => db.classes.find((c) => c.id === id)?.name).filter(Boolean).join(', ')
                      : a.targetType === 'year'
                        ? `Year ${a.yearGroup}`
                        : `${a.learnerIds.length} learners`}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-navy-300">
                    <span className="badge-teal">Code {a.shortCode}</span>
                    <span>{a.attempts === 999 ? '∞' : a.attempts} attempt{a.attempts === 1 ? '' : 's'}</span>
                    <span>· {a.arcade.enabled ? `🎮 ${a.arcade.durationSec}s breaks` : 'no arcade'}</span>
                    {a.shuffle && <span>· shuffled</span>}
                  </div>
                  <div className="mt-3 max-w-md">
                    <div className="flex justify-between text-[11px] font-bold text-navy-300">
                      <span>
                        {stats.done} / {stats.total} submitted
                      </span>
                      <span>class avg {stats.avg}%</span>
                    </div>
                    <div className="mt-1">
                      <ProgressBar
                        value={stats.total ? (stats.done / stats.total) * 100 : 0}
                        tone="teal"
                        label="Submission progress"
                      />
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Btn size="sm" variant="ghost" onClick={() => setEditing(a)}>
                    Edit
                  </Btn>
                  <Btn size="sm" variant="ghost" onClick={() => share(a)}>
                    🔗 Share
                  </Btn>
                  <Link to={`/teacher/gradebook/${a.id}`}>
                    <Btn size="sm">Gradebook</Btn>
                  </Link>
                  <details className="relative">
                    <summary className="btn btn-ghost btn-sm list-none">More ▾</summary>
                    <div className="absolute right-0 z-20 mt-1 w-48 rounded-xl border border-navy-100 bg-white p-1 shadow-lift">
                      <button className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-navy-50" onClick={() => extend(a, 3)}>
                        📅 Extend 3 days
                      </button>
                      <button className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-navy-50" onClick={() => extend(a, 7)}>
                        📅 Extend 1 week
                      </button>
                      <button
                        className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-navy-50"
                        onClick={() => {
                          setReopening(a);
                        }}
                      >
                        🔓 Reopen / reset attempts
                      </button>
                      <button
                        className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-navy-50"
                        onClick={async () => {
                          await saveAssignment({ ...a, archived: !a.archived });
                          notify(a.archived ? 'Restored' : 'Archived');
                        }}
                      >
                        🗄️ {a.archived ? 'Restore' : 'Archive'}
                      </button>
                      <button
                        className="w-full rounded-lg px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                        onClick={() => setDeleting(a)}
                      >
                        🗑 Delete
                      </button>
                    </div>
                  </details>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {editing && (
        <AssignmentEditor
          open
          draft={editing}
          onChange={setEditing}
          onClose={() => setEditing(null)}
          onSave={() => editing && submit(editing)}
        />
      )}

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete assignment?"
        body="Submissions stay in the gradebook but the task will disappear for learners."
        destructive
        confirmLabel="Delete"
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          if (deleting) await deleteAssignment(deleting.id);
          setDeleting(null);
        }}
      />

      <ConfirmDialog
        open={Boolean(reopening)}
        title="Reopen this task?"
        body="Learners who ran out of attempts will be able to start again. Existing scores stay for comparison."
        confirmLabel="Reopen"
        onCancel={() => setReopening(null)}
        onConfirm={() => reopening && reopen(reopening)}
      />
    </div>
  );
};

const AssignmentEditor: React.FC<{
  open: boolean;
  draft: Assignment;
  onChange: (a: Assignment) => void;
  onClose: () => void;
  onSave: () => void;
}> = ({ open, draft, onChange, onClose, onSave }) => {
  const { db } = useApp();
  const classes = useMyClasses();
  const learners = db.profiles.filter((p) => p.role === 'learner');
  const set = (p: Partial<Assignment>) => onChange({ ...draft, ...p });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={db.assignments.some((a) => a.id === draft.id) ? 'Edit assignment' : 'New assignment'}
      size="xl"
      footer={
        <>
          <Btn variant="ghost" onClick={onClose}>
            Cancel
          </Btn>
          <Btn onClick={onSave}>Save assignment</Btn>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Quiz" htmlFor="a-quiz" required>
            <select
              id="a-quiz"
              className="input"
              value={draft.quizId}
              onChange={(e) => {
                const quiz = db.quizzes.find((q) => q.id === e.target.value);
                set({ quizId: e.target.value, title: draft.title || (quiz ? `${quiz.title} — task` : '') });
              }}
            >
              {db.quizzes.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.title}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Title" htmlFor="a-title" required>
            <input id="a-title" className="input" value={draft.title} onChange={(e) => set({ title: e.target.value })} />
          </Field>
        </div>

        <Field label="Instructions for learners" htmlFor="a-instr">
          <textarea
            id="a-instr"
            className="input min-h-[70px]"
            value={draft.instructions}
            onChange={(e) => set({ instructions: e.target.value })}
            placeholder="e.g. Work on your own. Use the explanation after each answer."
          />
        </Field>

        <div>
          <span className="label">Who is it for?</span>
          <div className="grid grid-cols-3 gap-2">
            {(['class', 'year', 'learners'] as const).map((t) => (
              <button
                key={t}
                onClick={() => set({ targetType: t })}
                className={cx(
                  'rounded-xl border px-2 py-2 text-sm font-bold',
                  draft.targetType === t ? 'border-navy-600 bg-navy-600 text-white' : 'border-navy-100 bg-white',
                )}
              >
                {t === 'class' ? 'Whole class' : t === 'year' ? 'Year group' : 'Selected learners'}
              </button>
            ))}
          </div>
          <div className="mt-2">
            {draft.targetType === 'class' && (
              <div className="flex flex-wrap gap-2">
                {classes.map((c) => {
                  const on = draft.classIds.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      onClick={() =>
                        set({ classIds: on ? draft.classIds.filter((id) => id !== c.id) : [...draft.classIds, c.id] })
                      }
                      className={cx(
                        'rounded-full border px-3 py-1.5 text-xs font-bold',
                        on ? 'border-teal-500 bg-teal-500 text-white' : 'border-navy-100 bg-white text-navy-500',
                      )}
                    >
                      {c.name}
                    </button>
                  );
                })}
              </div>
            )}
            {draft.targetType === 'year' && (
              <select
                className="input"
                aria-label="Year group"
                value={draft.yearGroup ?? 5}
                onChange={(e) => set({ yearGroup: Number(e.target.value) as Assignment['yearGroup'] })}
              >
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((y) => (
                  <option key={y} value={y}>
                    Year {y}
                  </option>
                ))}
              </select>
            )}
            {draft.targetType === 'learners' && (
              <div className="max-h-40 overflow-y-auto rounded-xl border border-navy-100 p-2">
                {learners.map((l) => {
                  const on = draft.learnerIds.includes(l.id);
                  return (
                    <label key={l.id} className="flex items-center gap-2 py-1 text-sm">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-teal-500"
                        checked={on}
                        onChange={() =>
                          set({ learnerIds: on ? draft.learnerIds.filter((id) => id !== l.id) : [...draft.learnerIds, l.id] })
                        }
                      />
                      {l.firstName} {l.lastName}
                      <span className="text-xs text-navy-300">
                        ({db.classes.find((c) => c.id === l.classId)?.name})
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Start date" htmlFor="a-start">
            <input
              id="a-start"
              type="date"
              className="input"
              value={toDateInput(draft.startDate)}
              onChange={(e) => set({ startDate: new Date(e.target.value).toISOString() })}
            />
          </Field>
          <Field label="Due date" htmlFor="a-due">
            <input
              id="a-due"
              type="date"
              className="input"
              value={toDateInput(draft.dueDate)}
              onChange={(e) => {
                const d = new Date(e.target.value);
                d.setHours(16, 0, 0, 0);
                set({ dueDate: d.toISOString() });
              }}
            />
          </Field>
          <Field label="Attempts" htmlFor="a-attempts">
            <select
              id="a-attempts"
              className="input"
              value={draft.attempts}
              onChange={(e) => set({ attempts: Number(e.target.value) as Assignment['attempts'] })}
            >
              <option value={1}>1 attempt</option>
              <option value={2}>2 attempts</option>
              <option value={999}>Unlimited</option>
            </select>
          </Field>
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          <Toggle label="Shuffle questions" checked={draft.shuffle} onChange={(v) => set({ shuffle: v })} />
          <Toggle label="Shuffle answers" checked={draft.shuffleAnswers} onChange={(v) => set({ shuffleAnswers: v })} />
          <Toggle label="Show answers after submit" checked={draft.showAnswers} onChange={(v) => set({ showAnswers: v })} />
        </div>

        <div className="rounded-2xl border border-navy-100 p-3">
          <Toggle
            label="Arcade breaks"
            description="A correct answer unlocks a minigame break."
            checked={draft.arcade.enabled}
            onChange={(v) => set({ arcade: { ...draft.arcade, enabled: v } })}
          />
          {draft.arcade.enabled && (
            <>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                <Field label="Break length" htmlFor="a-break">
                  <select
                    id="a-break"
                    className="input"
                    value={draft.arcade.durationSec}
                    onChange={(e) => set({ arcade: { ...draft.arcade, durationSec: Number(e.target.value) } })}
                  >
                    {[15, 30, 45, 60, 90, 120, 180].map((s) => (
                      <option key={s} value={s}>
                        {s}s
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Unlock trigger" htmlFor="a-trigger">
                  <select
                    id="a-trigger"
                    className="input"
                    value={draft.arcade.trigger}
                    onChange={(e) => set({ arcade: { ...draft.arcade, trigger: e.target.value as typeof draft.arcade.trigger } })}
                  >
                    <option value="every">Every correct answer</option>
                    <option value="every_2">Every 2nd correct</option>
                    <option value="streak_3">Streak of 3</option>
                  </select>
                </Field>
              </div>
              <div className="mt-2">
                <span className="label">Allowed games</span>
                <div className="flex flex-wrap gap-1.5">
                  {MINIGAME_MANIFESTS.map((g) => {
                    const on = draft.arcade.allowedGames.includes(g.id);
                    return (
                      <button
                        key={g.id}
                        onClick={() =>
                          set({
                            arcade: {
                              ...draft.arcade,
                              allowedGames: on
                                ? draft.arcade.allowedGames.filter((id) => id !== g.id)
                                : [...draft.arcade.allowedGames, g.id],
                            },
                          })
                        }
                        className={cx(
                          'rounded-full border px-2.5 py-1 text-[11px] font-bold',
                          on ? 'border-teal-500 bg-teal-500 text-white' : 'border-navy-100 bg-white text-navy-500',
                        )}
                      >
                        {g.emoji} {g.name}
                      </button>
                    );
                  })}
                </div>
                <p className="hint">Leave all unchecked for “any enabled game”.</p>
              </div>
              <Toggle
                label="Allow learners to skip the break"
                checked={draft.arcade.skipAllowed}
                onChange={(v) => set({ arcade: { ...draft.arcade, skipAllowed: v } })}
              />
            </>
          )}
        </div>
      </div>
    </Modal>
  );
};
