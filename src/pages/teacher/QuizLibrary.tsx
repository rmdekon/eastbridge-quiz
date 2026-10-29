import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Btn, Card, ConfirmDialog, EmptyState, Tabs } from '../../components/ui';
import { StartGameModal } from '../../components/StartGameModal';
import { useApp } from '../../store/AppStore';
import { SUBJECTS, type QuizSet } from '../../types';
import { cx, formatDate, shuffle, uid } from '../../lib/utils';
import { exportQuizCsv, exportQuizXlsx } from '../../lib/csv';
import { useDebounced } from '../../hooks/useHooks';

export const QuizLibrary: React.FC = () => {
  const { db, user, deleteQuiz, saveQuiz, notify } = useApp();
  const nav = useNavigate();
  const [tab, setTab] = useState<'all' | 'mine' | 'shared'>('all');
  const [subject, setSubject] = useState('all');
  const [year, setYear] = useState('all');
  const [folder, setFolder] = useState('all');
  const [search, setSearch] = useState('');
  const [hosting, setHosting] = useState<QuizSet | null>(null);
  const [deleting, setDeleting] = useState<QuizSet | null>(null);
  const debounced = useDebounced(search, 200);

  const folders = useMemo(
    () => Array.from(new Set(db.quizzes.map((q) => q.folder).filter(Boolean))) as string[],
    [db.quizzes],
  );

  const filtered = useMemo(() => {
    const term = debounced.trim().toLowerCase();
    return db.quizzes
      .filter((q) => {
        if (tab === 'mine' && q.ownerId !== user?.id) return false;
        if (tab === 'shared' && q.visibility !== 'shared') return false;
        if (subject !== 'all' && q.subject !== subject) return false;
        if (year !== 'all' && q.yearGroup !== Number(year)) return false;
        if (folder !== 'all' && (q.folder ?? '') !== folder) return false;
        if (!term) return true;
        return (
          q.title.toLowerCase().includes(term) ||
          q.description.toLowerCase().includes(term) ||
          q.tags.some((t) => t.toLowerCase().includes(term)) ||
          q.questions.some((qq) => qq.text.toLowerCase().includes(term))
        );
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [db.quizzes, tab, subject, year, folder, debounced, user?.id]);

  const duplicate = async (quiz: QuizSet) => {
    const copy: QuizSet = {
      ...structuredClone(quiz),
      id: uid('quiz'),
      title: `${quiz.title} (copy)`,
      ownerId: user?.id ?? quiz.ownerId,
      visibility: 'private',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      questions: quiz.questions.map((q) => ({
        ...q,
        id: uid('q'),
        options: q.options.map((o) => ({ ...o, id: uid('o') })),
      })),
    };
    await saveQuiz(copy);
    notify('Quiz duplicated');
  };

  return (
    <div className="page">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-navy-700">Quiz library</h1>
          <p className="text-sm text-navy-300 mt-1">
            {db.quizzes.length} quizzes · {db.quizzes.filter((q) => q.visibility === 'shared').length} shared with Eastbridge
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Btn variant="ghost" onClick={() => nav('/teacher/import')}>
            📥 Import CSV / Excel
          </Btn>
          <Btn variant="gold" onClick={() => nav('/teacher/editor/new')}>
            ✏️ New quiz
          </Btn>
        </div>
      </div>

      <Card className="mt-5" pad={false}>
        <div className="p-3 border-b border-navy-50">
          <div className="flex flex-wrap items-center gap-2">
            <Tabs
              tabs={[
                { id: 'all', label: 'All quizzes', count: db.quizzes.length },
                { id: 'mine', label: 'Mine', count: db.quizzes.filter((q) => q.ownerId === user?.id).length },
                { id: 'shared', label: 'Shared', count: db.quizzes.filter((q) => q.visibility === 'shared').length },
              ]}
              value={tab}
              onChange={(v) => setTab(v as typeof tab)}
            />
            <div className="ml-auto flex flex-1 flex-wrap justify-end gap-2">
              <label className="sr-only" htmlFor="search-quizzes">
                Search quizzes
              </label>
              <input
                id="search-quizzes"
                className="input !min-h-[44px] !py-2 text-sm max-w-[240px]"
                placeholder="Search title, tag or question…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <select aria-label="Filter by subject" className="input !min-h-[44px] !py-2 text-sm w-auto" value={subject} onChange={(e) => setSubject(e.target.value)}>
                <option value="all">All subjects</option>
                {SUBJECTS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <select aria-label="Filter by year" className="input !min-h-[44px] !py-2 text-sm w-auto" value={year} onChange={(e) => setYear(e.target.value)}>
                <option value="all">All years</option>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((y) => (
                  <option key={y} value={y}>
                    Year {y}
                  </option>
                ))}
              </select>
              {folders.length > 0 && (
                <select aria-label="Filter by folder" className="input !min-h-[44px] !py-2 text-sm w-auto" value={folder} onChange={(e) => setFolder(e.target.value)}>
                  <option value="all">All folders</option>
                  {folders.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            emoji="📚"
            title="No quizzes match those filters"
            body="Create a new quiz, import a spreadsheet, or clear the filters."
            action={<Btn onClick={() => nav('/teacher/editor/new')}>Create a quiz</Btn>}
          />
        ) : (
          <div className="grid gap-3 p-3 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((quiz) => {
              const isMine = quiz.ownerId === user?.id;
              return (
                <div
                  key={quiz.id}
                  className="group flex flex-col rounded-2xl border border-navy-100 bg-white p-3 transition hover:-translate-y-0.5 hover:shadow-soft"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-2xl"
                      style={{
                        background: quiz.coverImage
                          ? `url(${quiz.coverImage}) center/cover`
                          : 'linear-gradient(145deg,#eef3fa,#d9e3f3)',
                      }}
                      aria-hidden="true"
                    >
                      {!quiz.coverImage && quiz.emoji}
                    </div>
                    <div className="min-w-0 flex-1">
                      <Link
                        to={`/teacher/editor/${quiz.id}`}
                        className="block truncate font-display font-bold text-navy-700 hover:text-teal-500"
                      >
                        {quiz.title}
                      </Link>
                      <p className="text-[11px] text-navy-300">
                        {quiz.subject} · Year {quiz.yearGroup} · {quiz.questions.length} Q
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        <span className={quiz.visibility === 'shared' ? 'badge-teal' : 'badge-navy'}>
                          {quiz.visibility === 'shared' ? '🏫 Shared' : '🔒 Private'}
                        </span>
                        {quiz.folder && <span className="badge-gold">{quiz.folder}</span>}
                        {!isMine && <span className="badge-sage">by {db.profiles.find((p) => p.id === quiz.ownerId)?.firstName ?? 'staff'}</span>}
                      </div>
                    </div>
                  </div>
                  <p className="mt-2 line-clamp-2 text-xs text-navy-300 flex-1">{quiz.description || 'No description yet.'}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <Btn size="sm" variant="gold" onClick={() => setHosting(quiz)}>
                      ▶ Host
                    </Btn>
                    <Btn size="sm" variant="ghost" onClick={() => nav(`/teacher/editor/${quiz.id}`)}>
                      Edit
                    </Btn>
                    <Btn
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setHosting(null);
                        nav(`/teacher/assignments?quiz=${quiz.id}`);
                      }}
                    >
                      Assign
                    </Btn>
                    <details className="relative">
                      <summary className="btn btn-ghost btn-sm list-none">More ▾</summary>
                      <div className="absolute right-0 z-20 mt-1 w-44 rounded-xl border border-navy-100 bg-white p-1 shadow-lift">
                        <button className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-navy-50" onClick={() => duplicate(quiz)}>
                          ⧉ Duplicate
                        </button>
                        <button className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-navy-50" onClick={() => exportQuizCsv(quiz)}>
                          ⬇️ Export CSV
                        </button>
                        <button className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-navy-50" onClick={() => exportQuizXlsx(quiz)}>
                          ⬇️ Export XLSX
                        </button>
                        {isMine && (
                          <button
                            className="w-full rounded-lg px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                            onClick={() => setDeleting(quiz)}
                          >
                            🗑 Delete
                          </button>
                        )}
                      </div>
                    </details>
                  </div>
                  <p className="mt-2 text-[10px] text-navy-300">Updated {formatDate(quiz.updatedAt)}</p>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-navy-300">
        <span className="font-bold">Fast actions:</span>
        <button
          className="rounded-lg bg-white px-2.5 py-1.5 font-bold shadow-sm hover:shadow"
          onClick={async () => {
            const shared = db.quizzes.filter((q) => q.visibility === 'shared');
            if (!shared.length) {
              notify('No shared quizzes yet', 'info');
              return;
            }
            const pick = shuffle(shared)[0];
            const copy = structuredClone(pick);
            copy.id = uid('quiz');
            copy.title = `${pick.title} (remix)`;
            copy.ownerId = user?.id ?? pick.ownerId;
            copy.visibility = 'private';
            await saveQuiz(copy);
          }}
        >
          🎲 Remix a shared quiz
        </button>
        <button className="rounded-lg bg-white px-2.5 py-1.5 font-bold shadow-sm hover:shadow" onClick={() => nav('/teacher/minigames')}>
          🕹️ Try the minigames
        </button>
      </div>

      <StartGameModal quiz={hosting} open={Boolean(hosting)} onClose={() => setHosting(null)} />
      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete quiz?"
        body={`“${deleting?.title}” will be removed. Existing assignments keep their submissions.`}
        destructive
        confirmLabel="Delete"
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          if (deleting) await deleteQuiz(deleting.id);
          setDeleting(null);
        }}
      />
      <div className={cx('mt-6 rounded-2xl bg-navy-50 p-4 text-xs text-navy-500', filtered.length === 0 && 'hidden')}>
        <strong>Tip:</strong> shared quizzes are visible to every teacher in the Eastbridge library. Duplicate one to make it yours
        before editing.
      </div>
    </div>
  );
};
