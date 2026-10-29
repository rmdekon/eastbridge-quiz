import React, { useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Btn, Card, ConfirmDialog, Field, Modal, Toggle, ZoomableImage, Logo } from '../../components/ui';
import { ImageInput } from '../../components/ImageInput';
import { useApp } from '../../store/AppStore';
import { SUBJECTS, type Question, type QuizSet, type Subject, type YearGroup } from '../../types';
import { uid, sanitizeText, cx, shuffle } from '../../lib/utils';
import { exportQuizCsv, exportQuizXlsx } from '../../lib/csv';
import { compressImage } from '../../lib/images';

const EMOJIS = ['📘', '🔢', '🔬', '🛡️', '🌍', '🎨', '🎵', '💼', '🧮', '🏃', '🗣️', '🧠', '🦅', '🚀', '🌱', '🧪'];

const newQuestion = (): Question => ({
  id: uid('q'),
  type: 'multiple_choice',
  text: '',
  options: [
    { id: uid('o'), text: '' },
    { id: uid('o'), text: '' },
    { id: uid('o'), text: '' },
    { id: uid('o'), text: '' },
  ],
  correctIndex: 0,
  timeLimit: 20,
  points: 1000,
  explanation: '',
  topic: '',
});

export const QuizEditor: React.FC = () => {
  const { quizId } = useParams();
  const { db, user, saveQuiz, deleteQuiz, notify } = useApp();
  const nav = useNavigate();
  const existing = db.quizzes.find((q) => q.id === quizId);

  const [draft, setDraft] = useState<QuizSet>(() =>
    existing
      ? structuredClone(existing)
      : {
          id: uid('quiz'),
          title: 'Untitled quiz',
          emoji: '📘',
          description: '',
          subject: 'Maths',
          yearGroup: 5,
          tags: [],
          visibility: 'private',
          ownerId: user?.id ?? '',
          folder: '',
          questions: [newQuestion()],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
  );
  const [tagDraft, setTagDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [optionImage, setOptionImage] = useState<string | null>(null);
  const [bulkTime, setBulkTime] = useState(20);
  const [bulkPoints, setBulkPoints] = useState(1000);
  const [expanded, setExpanded] = useState<string | null>(draft.questions[0]?.id ?? null);
  const dragIndex = useRef<number | null>(null);
  const coverRef = useRef<HTMLInputElement>(null);

  const patch = (p: Partial<QuizSet>) => setDraft((d) => ({ ...d, ...p }));
  const patchQuestion = (id: string, p: Partial<Question>) =>
    setDraft((d) => ({ ...d, questions: d.questions.map((q) => (q.id === id ? { ...q, ...p } : q)) }));

  const updateOptionMedia = (qid: string, index: number, patch: { imageUrl?: string; imageAlt?: string }) =>
    setDraft((d) => ({
      ...d,
      questions: d.questions.map((q) =>
        q.id === qid
          ? { ...q, options: q.options.map((o, i) => (i === index ? { ...o, ...patch } : o)) }
          : q,
      ),
    }));

  const updateOption = (qid: string, index: number, text: string) =>
    setDraft((d) => ({
      ...d,
      questions: d.questions.map((q) =>
        q.id === qid
          ? { ...q, options: q.options.map((o, i) => (i === index ? { ...o, text } : o)) }
          : q,
      ),
    }));

  const addOption = (qid: string) =>
    setDraft((d) => ({
      ...d,
      questions: d.questions.map((q) =>
        q.id === qid && q.options.length < 4
          ? { ...q, options: [...q.options, { id: uid('o'), text: '' }] }
          : q,
      ),
    }));

  const removeOption = (qid: string, index: number) =>
    setDraft((d) => ({
      ...d,
      questions: d.questions.map((q) => {
        if (q.id !== qid || q.options.length <= 2) return q;
        const options = q.options.filter((_, i) => i !== index);
        const correctIndex = q.correctIndex >= options.length ? options.length - 1 : q.correctIndex;
        return { ...q, options, correctIndex };
      }),
    }));

  const duplicateQuestion = (id: string) =>
    setDraft((d) => {
      const idx = d.questions.findIndex((q) => q.id === id);
      if (idx < 0) return d;
      const copy: Question = {
        ...structuredClone(d.questions[idx]),
        id: uid('q'),
        text: `${d.questions[idx].text} (copy)`,
        options: d.questions[idx].options.map((o) => ({ ...o, id: uid('o') })),
      };
      const questions = [...d.questions];
      questions.splice(idx + 1, 0, copy);
      return { ...d, questions };
    });

  const removeQuestion = (id: string) => {
    if (draft.questions.length <= 1) {
      notify('A quiz needs at least one question', 'error');
      return;
    }
    setDraft((d) => ({ ...d, questions: d.questions.filter((q) => q.id !== id) }));
  };

  const moveQuestion = (from: number, to: number) =>
    setDraft((d) => {
      const questions = [...d.questions];
      const [item] = questions.splice(from, 1);
      questions.splice(to, 0, item);
      return { ...d, questions };
    });

  const validation = useMemo(() => {
    const issues: string[] = [];
    if (!draft.title.trim()) issues.push('Add a quiz title');
    draft.questions.forEach((q, i) => {
      if (!q.text.trim()) issues.push(`Question ${i + 1} has no text`);
      if (q.options.filter((o) => o.text.trim()).length < 2) issues.push(`Question ${i + 1} needs 2+ answers`);
      if (!q.options[q.correctIndex]?.text.trim()) issues.push(`Question ${i + 1} needs a correct answer`);
      if (q.imageUrl && !q.imageAlt?.trim()) issues.push(`Question ${i + 1} image needs alt text`);
      if (q.options.some((o) => o.imageUrl && !o.imageAlt?.trim()))
        issues.push(`Question ${i + 1} has an answer image without alt text`);
    });
    return issues;
  }, [draft]);

  const save = async () => {
    if (validation.length) {
      notify(validation[0], 'error');
      return;
    }
    setSaving(true);
    // Embed remote images locally when they are small enough, so slow networks still work.
    const cleaned: QuizSet = {
      ...draft,
      title: sanitizeText(draft.title, 120),
      description: sanitizeText(draft.description, 600),
      tags: draft.tags.map((t) => sanitizeText(t, 24)).filter(Boolean).slice(0, 8),
      questions: draft.questions.map((q) => ({
        ...q,
        text: sanitizeText(q.text, 500),
        explanation: sanitizeText(q.explanation ?? '', 600),
        topic: sanitizeText(q.topic ?? '', 60),
        options: q.options
          .filter((o) => o.text.trim())
          .map((o) => ({ ...o, text: sanitizeText(o.text, 200) })),
      })),
    };
    await saveQuiz(cleaned);
    setSaving(false);
    nav('/teacher/library');
  };

  const previewQ = draft.questions[Math.min(previewIndex, draft.questions.length - 1)];

  return (
    <div className="page pb-28">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <button onClick={() => nav('/teacher/library')} className="text-sm font-bold text-navy-300 hover:text-navy-600">
            ← Quiz library
          </button>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-navy-700 mt-1">
            {existing ? 'Edit quiz' : 'Create a quiz'}
          </h1>
          <p className="text-sm text-navy-300 mt-1">
            {draft.questions.length} question{draft.questions.length === 1 ? '' : 's'} · ~
            {Math.round(draft.questions.reduce((a, q) => a + q.timeLimit, 0) / 60)} min
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Btn variant="ghost" onClick={() => setPreviewOpen(true)}>
            👁️ Preview
          </Btn>
          <Btn variant="ghost" onClick={() => exportQuizCsv(draft)}>
            ⬇️ CSV
          </Btn>
          <Btn variant="ghost" onClick={() => exportQuizXlsx(draft)}>
            ⬇️ XLSX
          </Btn>
          <Btn onClick={save} loading={saving}>
            Save quiz
          </Btn>
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          <Card>
            <div className="grid gap-4 sm:grid-cols-[auto_1fr]">
              <div>
                <span className="label">Icon</span>
                <div className="grid grid-cols-4 gap-1 max-h-[104px] overflow-y-auto pr-1">
                  {EMOJIS.map((e) => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => patch({ emoji: e })}
                      aria-label={`Use ${e} as quiz icon`}
                      aria-pressed={draft.emoji === e}
                      className={cx(
                        'h-11 w-11 rounded-xl text-xl',
                        draft.emoji === e ? 'bg-gold-100 ring-2 ring-gold-500' : 'bg-navy-50 hover:bg-navy-100',
                      )}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                <Field label="Title" htmlFor="q-title" required>
                  <input
                    id="q-title"
                    className="input font-bold"
                    value={draft.title}
                    onChange={(e) => patch({ title: e.target.value })}
                    placeholder="e.g. Year 5 Maths — Fractions & Shapes"
                  />
                </Field>
                <Field label="Description" htmlFor="q-desc" hint="Shown on the quiz card and in assignments.">
                  <textarea
                    id="q-desc"
                    className="input min-h-[76px]"
                    value={draft.description}
                    onChange={(e) => patch({ description: e.target.value })}
                    maxLength={600}
                    placeholder="What does this quiz cover?"
                  />
                </Field>
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <Field label="Subject" htmlFor="q-subject">
                <select
                  id="q-subject"
                  className="input"
                  value={draft.subject}
                  onChange={(e) => patch({ subject: e.target.value as Subject })}
                >
                  {SUBJECTS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Year group" htmlFor="q-year">
                <select
                  id="q-year"
                  className="input"
                  value={draft.yearGroup}
                  onChange={(e) => patch({ yearGroup: Number(e.target.value) as YearGroup })}
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((y) => (
                    <option key={y} value={y}>
                      Year {y}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Folder" htmlFor="q-folder" hint="Optional grouping">
                <input
                  id="q-folder"
                  className="input"
                  value={draft.folder ?? ''}
                  onChange={(e) => patch({ folder: e.target.value })}
                  placeholder="e.g. Numeracy set A"
                />
              </Field>
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field label="Topic tags" htmlFor="q-tags" hint="Press Enter to add (max 8).">
                <div className="flex flex-wrap gap-1.5 rounded-xl border border-navy-100 bg-white p-2 min-h-[44px]">
                  {draft.tags.map((t) => (
                    <span key={t} className="badge-teal">
                      {t}
                      <button
                        type="button"
                        aria-label={`Remove tag ${t}`}
                        onClick={() => patch({ tags: draft.tags.filter((x) => x !== t) })}
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                  <input
                    id="q-tags"
                    value={tagDraft}
                    onChange={(e) => setTagDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && tagDraft.trim()) {
                        e.preventDefault();
                        patch({ tags: [...new Set([...draft.tags, tagDraft.trim()])].slice(0, 8) });
                        setTagDraft('');
                      }
                    }}
                    className="flex-1 min-w-[90px] border-0 bg-transparent px-1 text-sm outline-none"
                    placeholder="add tag…"
                  />
                </div>
              </Field>
              <div>
                <span className="label">Visibility</span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => patch({ visibility: 'private' })}
                    className={cx(
                      'rounded-xl border px-3 py-2.5 text-left text-sm font-bold',
                      draft.visibility === 'private' ? 'border-navy-600 bg-navy-50 text-navy-700' : 'border-navy-100',
                    )}
                  >
                    🔒 Private
                    <span className="block text-[10px] font-normal text-navy-300">Only you</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => patch({ visibility: 'shared' })}
                    className={cx(
                      'rounded-xl border px-3 py-2.5 text-left text-sm font-bold',
                      draft.visibility === 'shared' ? 'border-teal-500 bg-teal-100/50 text-teal-700' : 'border-navy-100',
                    )}
                  >
                    🏫 Shared
                    <span className="block text-[10px] font-normal text-navy-300">Eastbridge library</span>
                  </button>
                </div>
              </div>
            </div>
          </Card>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="section-title">Questions</h2>
            <div className="flex flex-wrap gap-2">
              <Btn
                size="sm"
                variant="ghost"
                onClick={() =>
                  setDraft((d) => ({ ...d, questions: shuffle(d.questions) }))
                }
              >
                🔀 Shuffle
              </Btn>
              <Btn size="sm" variant="ghost" onClick={() => setBulkOpen(true)}>
                ⚙️ Bulk edit
              </Btn>
              <Btn
                size="sm"
                variant="gold"
                onClick={() => {
                  const q = newQuestion();
                  setDraft((d) => ({ ...d, questions: [...d.questions, q] }));
                  setExpanded(q.id);
                }}
              >
                + Add question
              </Btn>
            </div>
          </div>

          <div className="space-y-3">
            {draft.questions.map((q, i) => {
              const open = expanded === q.id;
              return (
                <Card key={q.id} pad={false} className="overflow-hidden">
                  <div
                    className="flex items-center gap-2 p-3"
                    draggable
                    onDragStart={() => (dragIndex.current = i)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => {
                      if (dragIndex.current !== null && dragIndex.current !== i) moveQuestion(dragIndex.current, i);
                      dragIndex.current = null;
                    }}
                  >
                    <span className="cursor-grab text-navy-300 select-none" aria-hidden="true" title="Drag to reorder">
                      ⠿
                    </span>
                    <button
                      onClick={() => setExpanded(open ? null : q.id)}
                      className="flex-1 text-left min-w-0"
                      aria-expanded={open}
                    >
                      <span className="flex items-center gap-2">
                        <span className="badge-navy">Q{i + 1}</span>
                        <span className="truncate font-bold text-navy-700">
                          {q.text || <span className="text-navy-300">Untitled question</span>}
                        </span>
                      </span>
                      <span className="mt-0.5 flex flex-wrap gap-2 text-[11px] text-navy-300">
                        <span>{q.timeLimit}s</span>
                        <span>{q.points} pts</span>
                        <span>{q.options.filter((o) => o.text).length} options</span>
                        {q.topic && <span>· {q.topic}</span>}
                        {q.imageUrl && <span>· 📷</span>}
                      </span>
                    </button>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        onClick={() => duplicateQuestion(q.id)}
                        className="h-10 w-10 rounded-lg hover:bg-navy-50"
                        aria-label={`Duplicate question ${i + 1}`}
                        title="Duplicate"
                      >
                        ⧉
                      </button>
                      <button
                        onClick={() => removeQuestion(q.id)}
                        className="h-10 w-10 rounded-lg text-red-600 hover:bg-red-50"
                        aria-label={`Delete question ${i + 1}`}
                        title="Delete"
                      >
                        🗑
                      </button>
                      <button
                        onClick={() => setExpanded(open ? null : q.id)}
                        className="h-10 w-10 rounded-lg hover:bg-navy-50"
                        aria-label={open ? 'Collapse question' : 'Expand question'}
                      >
                        {open ? '▲' : '▼'}
                      </button>
                    </div>
                  </div>

                  {open && (
                    <div className="border-t border-navy-50 p-4 space-y-4">
                      <div className="grid gap-3 sm:grid-cols-[1fr_150px]">
                        <Field label="Question" htmlFor={`qt-${q.id}`} required>
                          <textarea
                            id={`qt-${q.id}`}
                            className="input min-h-[70px]"
                            value={q.text}
                            onChange={(e) => patchQuestion(q.id, { text: e.target.value })}
                            placeholder="Type the question…"
                          />
                        </Field>
                        <Field label="Type" htmlFor={`qtype-${q.id}`}>
                          <select
                            id={`qtype-${q.id}`}
                            className="input"
                            value={q.type}
                            onChange={(e) => {
                              const type = e.target.value as Question['type'];
                              if (type === 'true_false') {
                                patchQuestion(q.id, {
                                  type,
                                  options: [
                                    { id: uid('o'), text: 'True' },
                                    { id: uid('o'), text: 'False' },
                                  ],
                                  correctIndex: Math.min(q.correctIndex, 1),
                                });
                              } else {
                                patchQuestion(q.id, { type });
                              }
                            }}
                          >
                            <option value="multiple_choice">Multiple choice</option>
                            <option value="true_false">True / False</option>
                          </select>
                        </Field>
                      </div>

                      <div>
                        <span className="label">Answer options · tap the circle to mark the correct one</span>
                        <div className="space-y-2">
                          {q.options.map((o, oi) => (
                            <div key={o.id} className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => patchQuestion(q.id, { correctIndex: oi })}
                                aria-label={`Mark option ${oi + 1} as correct`}
                                aria-pressed={q.correctIndex === oi}
                                className={cx(
                                  'flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold',
                                  q.correctIndex === oi
                                    ? 'border-sage-500 bg-sage-500 text-white'
                                    : 'border-navy-100 text-navy-300 hover:border-navy-300',
                                )}
                              >
                                {q.correctIndex === oi ? '✓' : 'ABCD'[oi]}
                              </button>
                              <input
                                className="input"
                                value={o.text}
                                onChange={(e) => updateOption(q.id, oi, e.target.value)}
                                placeholder={`Option ${'ABCD'[oi]}`}
                                aria-label={`Option ${'ABCD'[oi]}`}
                                disabled={q.type === 'true_false'}
                              />
                              <button
                                type="button"
                                onClick={() => setOptionImage((cur) => (cur === o.id ? null : o.id))}
                                aria-label={`${o.imageUrl ? 'Edit' : 'Add'} image for option ${'ABCD'[oi]}`}
                                aria-expanded={optionImage === o.id}
                                title="Add an image to this answer"
                                className={cx(
                                  'h-11 w-11 shrink-0 rounded-lg text-base',
                                  o.imageUrl ? 'bg-teal-50 text-teal-600' : 'text-navy-300 hover:bg-navy-50',
                                )}
                              >
                                🖼️
                              </button>
                              {q.type === 'multiple_choice' && q.options.length > 2 && (
                                <button
                                  type="button"
                                  onClick={() => removeOption(q.id, oi)}
                                  className="h-11 w-11 shrink-0 rounded-lg text-red-500 hover:bg-red-50"
                                  aria-label={`Remove option ${'ABCD'[oi]}`}
                                >
                                  ✕
                                </button>
                              )}
                              {(optionImage === o.id || o.imageUrl) && (
                                <div className="ml-13 rounded-xl border border-navy-100 bg-white p-3">
                                  <ImageInput
                                    compact
                                    label={`Option ${'ABCD'[oi]} image`}
                                    imageUrl={o.imageUrl}
                                    imageAlt={o.imageAlt}
                                    onChange={(patch) => updateOptionMedia(q.id, oi, patch)}
                                  />
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                        {q.type === 'multiple_choice' && q.options.length < 4 && (
                          <Btn size="sm" variant="ghost" className="mt-2" onClick={() => addOption(q.id)}>
                            + Add option
                          </Btn>
                        )}
                      </div>

                      <div className="grid gap-3 sm:grid-cols-3">
                        <Field label="Time limit (s)" htmlFor={`time-${q.id}`}>
                          <input
                            id={`time-${q.id}`}
                            type="number"
                            min={5}
                            max={120}
                            className="input"
                            value={q.timeLimit}
                            onChange={(e) =>
                              patchQuestion(q.id, { timeLimit: Math.max(5, Math.min(120, Number(e.target.value) || 20)) })
                            }
                          />
                        </Field>
                        <Field label="Points" htmlFor={`pts-${q.id}`}>
                          <input
                            id={`pts-${q.id}`}
                            type="number"
                            min={0}
                            max={10000}
                            step={100}
                            className="input"
                            value={q.points}
                            onChange={(e) =>
                              patchQuestion(q.id, { points: Math.max(0, Math.min(10000, Number(e.target.value) || 0)) })
                            }
                          />
                        </Field>
                        <Field label="Topic" htmlFor={`topic-${q.id}`} hint="Used in strengths analysis">
                          <input
                            id={`topic-${q.id}`}
                            className="input"
                            value={q.topic ?? ''}
                            onChange={(e) => patchQuestion(q.id, { topic: e.target.value })}
                            placeholder="e.g. Fractions"
                          />
                        </Field>
                      </div>

                      <ImageInput
                        imageUrl={q.imageUrl}
                        imageAlt={q.imageAlt}
                        onChange={(p) => patchQuestion(q.id, p)}
                      />

                      <Field
                        label="Explanation"
                        htmlFor={`exp-${q.id}`}
                        hint="Shown after every answer — this is where the learning happens."
                      >
                        <textarea
                          id={`exp-${q.id}`}
                          className="input min-h-[64px]"
                          value={q.explanation ?? ''}
                          onChange={(e) => patchQuestion(q.id, { explanation: e.target.value })}
                          placeholder="Explain why the answer is right…"
                        />
                      </Field>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20 self-start">
          <Card>
            <span className="label">Cover image</span>
            {draft.coverImage ? (
              <div className="relative">
                <img src={draft.coverImage} alt="Quiz cover" className="w-full rounded-xl object-cover max-h-36" />
                <button
                  onClick={() => patch({ coverImage: '' })}
                  className="absolute right-2 top-2 rounded-lg bg-white/90 px-2 py-1 text-xs font-bold text-red-600"
                >
                  Remove
                </button>
              </div>
            ) : (
              <button
                onClick={() => coverRef.current?.click()}
                className="w-full rounded-xl border-2 border-dashed border-navy-100 py-6 text-sm font-bold text-navy-300 hover:border-teal-500"
              >
                + Upload cover
              </button>
            )}
            <input
              ref={coverRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                const c = await compressImage(f, f.name);
                patch({ coverImage: c.dataUrl });
              }}
            />
          </Card>

          <Card>
            <h3 className="font-display font-bold text-navy-700">Readiness</h3>
            {validation.length === 0 ? (
              <p className="mt-2 text-sm font-bold text-sage-500">✅ Ready to save and host</p>
            ) : (
              <ul className="mt-2 space-y-1 text-sm text-red-600">
                {validation.slice(0, 6).map((v) => (
                  <li key={v}>• {v}</li>
                ))}
              </ul>
            )}
            <div className="mt-4 space-y-2 border-t border-navy-50 pt-3 text-sm">
              <div className="flex justify-between">
                <span className="text-navy-300">Total time</span>
                <span className="font-bold">{Math.round(draft.questions.reduce((a, q) => a + q.timeLimit, 0) / 60)} min</span>
              </div>
              <div className="flex justify-between">
                <span className="text-navy-300">Max score</span>
                <span className="font-bold">{draft.questions.reduce((a, q) => a + q.points, 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-navy-300">Questions with images</span>
                <span className="font-bold">{draft.questions.filter((q) => q.imageUrl).length}</span>
              </div>
            </div>
          </Card>

          <Card className="bg-navy-600 text-white border-navy-600">
            <h3 className="font-display font-bold">Import instead?</h3>
            <p className="mt-1 text-sm text-white/70">
              Bring a whole quiz from CSV or Excel, with images in a ZIP.
            </p>
            <Btn variant="gold" className="mt-3 w-full" onClick={() => nav('/teacher/import')}>
              Go to importer
            </Btn>
          </Card>

          {existing && (
            <Btn variant="danger" className="w-full" onClick={() => setDeleteOpen(true)}>
              Delete this quiz
            </Btn>
          )}
        </aside>
      </div>

      {/* Preview */}
      <Modal open={previewOpen} onClose={() => setPreviewOpen(false)} title="Preview as a learner" size="lg">
        {previewQ ? (
          <div>
            <div className="flex items-center justify-between text-xs font-bold text-navy-300">
              <span>
                Question {Math.min(previewIndex + 1, draft.questions.length)} of {draft.questions.length}
              </span>
              <span>
                {previewQ.points} pts · {previewQ.timeLimit}s
              </span>
            </div>
            <p className="mt-2 font-display text-lg font-bold text-navy-700">{previewQ.text || 'Untitled question'}</p>
            {previewQ.imageUrl && (
              <ZoomableImage
                src={previewQ.imageUrl}
                alt={previewQ.imageAlt}
                className="mt-3 max-h-56 w-full"
              />
            )}
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {previewQ.options.map((o, i) => (
                <button
                  key={o.id}
                  onClick={() => notify(i === previewQ.correctIndex ? 'Correct! 🎉' : 'Not quite — the explanation appears here.', i === previewQ.correctIndex ? 'success' : 'info')}
                  className={cx(
                    'rounded-xl border-2 px-4 py-3 text-left font-bold transition hover:-translate-y-0.5',
                    i === previewQ.correctIndex ? 'border-sage-300 bg-sage-100/40' : 'border-navy-100 bg-white',
                  )}
                >
                  <span className="mr-2 text-navy-300">{'ABCD'[i]}</span>
                  {o.imageUrl && (
                    <img
                      src={o.imageUrl}
                      alt={o.imageAlt || ''}
                      className="mb-2 max-h-28 w-full rounded-lg object-cover"
                      loading="lazy"
                    />
                  )}
                  {o.text || '—'}
                </button>
              ))}
            </div>
            {previewQ.explanation && (
              <div className="mt-4 rounded-xl bg-teal-100/60 p-3 text-sm text-teal-700">
                <span className="font-bold">Explanation: </span>
                {previewQ.explanation}
              </div>
            )}
            <div className="mt-4 flex items-center justify-between">
              <Btn
                variant="ghost"
                size="sm"
                onClick={() => setPreviewIndex((i) => Math.max(0, i - 1))}
                disabled={previewIndex === 0}
              >
                ← Previous
              </Btn>
              <Btn
                variant="ghost"
                size="sm"
                onClick={() => setPreviewIndex((i) => Math.min(draft.questions.length - 1, i + 1))}
                disabled={previewIndex >= draft.questions.length - 1}
              >
                Next →
              </Btn>
            </div>
            <p className="mt-3 text-center text-xs text-navy-300">
              In a real game, a correct answer unlocks the arcade break.
            </p>
          </div>
        ) : (
          <p className="text-sm text-navy-300">Add a question first.</p>
        )}
      </Modal>

      <Modal open={bulkOpen} onClose={() => setBulkOpen(false)} title="Bulk edit all questions">
        <div className="space-y-4">
          <Field label="Time limit (seconds)" htmlFor="bulk-time">
            <input
              id="bulk-time"
              type="number"
              min={5}
              max={120}
              className="input"
              value={bulkTime}
              onChange={(e) => setBulkTime(Number(e.target.value))}
            />
          </Field>
          <Field label="Points per question" htmlFor="bulk-points">
            <input
              id="bulk-points"
              type="number"
              min={0}
              max={10000}
              step={100}
              className="input"
              value={bulkPoints}
              onChange={(e) => setBulkPoints(Number(e.target.value))}
            />
          </Field>
          <Btn
            className="w-full"
            onClick={() => {
              setDraft((d) => ({
                ...d,
                questions: d.questions.map((q) => ({ ...q, timeLimit: bulkTime, points: bulkPoints })),
              }));
              setBulkOpen(false);
              notify('Applied to all questions');
            }}
          >
            Apply to all {draft.questions.length} questions
          </Btn>
        </div>
      </Modal>

      <ConfirmDialog
        open={deleteOpen}
        title="Delete this quiz?"
        body="This removes the quiz from the library. Past game reports and submissions stay in the gradebook."
        confirmLabel="Delete quiz"
        destructive
        onCancel={() => setDeleteOpen(false)}
        onConfirm={async () => {
          if (existing) {
            await deleteQuiz(existing.id);
          }
          setDeleteOpen(false);
          nav('/teacher/library');
        }}
      />

      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-navy-100 bg-cream-100/95 p-3 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-3xl items-center gap-2">
          <Logo size={32} />
          <span className="text-xs text-navy-300 flex-1">{validation.length ? `${validation.length} checks to fix` : 'Ready to save'}</span>
          <Btn onClick={save} loading={saving}>
            Save quiz
          </Btn>
        </div>
      </div>
    </div>
  );
};
