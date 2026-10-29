import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Btn, Card, Field, Logo, ProgressBar } from '../../components/ui';
import { useApp } from '../../store/AppStore';
import {
  TEMPLATE_HEADERS,
  downloadTemplateCsv,
  downloadTemplateXlsx,
  importRowsToQuestions,
  isImportRowValid,
  parseSpreadsheet,
  validateRecord,
  exportQuizCsv,
  type ImportRow,
} from '../../lib/csv';
import { compressBatch, extractImageZip, imageFilesToMap, type CompressedImage } from '../../lib/images';
import { SUBJECTS, type QuizSet, type Subject, type YearGroup } from '../../types';
import { cx, uid } from '../../lib/utils';

export const ImportPage: React.FC = () => {
  const { user, saveQuiz, deleteQuiz, notify } = useApp();
  const nav = useNavigate();
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState('');
  const [progress, setProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState<Subject>('Maths');
  const [yearGroup, setYearGroup] = useState<YearGroup>(5);
  const [visibility, setVisibility] = useState<'private' | 'shared'>('private');
  const [createdQuiz, setCreatedQuiz] = useState<QuizSet | null>(null);
  const [imageCount, setImageCount] = useState(0);
  const sheetRef = useRef<HTMLInputElement>(null);
  const zipRef = useRef<HTMLInputElement>(null);
  const imagesRef = useRef<HTMLInputElement>(null);
  const imagesMapRef = useRef<Map<string, CompressedImage>>(new Map());

  const total = rows.length;
  const validRows = rows.filter((r) => r.include && isImportRowValid(r));
  const invalidRows = rows.filter((r) => !isImportRowValid(r));

  const handleFiles = async (files: File[]) => {
    const sheet = files.find((f) => /\.(csv|xlsx|xls)$/i.test(f.name));
    const zip = files.find((f) => /\.zip$/i.test(f.name));
    const imgs = files.filter((f) => f.type.startsWith('image/'));
    if (!sheet && !zip && !imgs.length) {
      notify('Add a .csv, .xlsx, image or .zip file', 'error');
      return;
    }
    setBusy(true);
    setCreatedQuiz(null);
    try {
      setStage('Reading spreadsheet…');
      setProgress(10);
      const raw = sheet ? await parseSpreadsheet(sheet) : null;
      if (sheet) {
        const base = sheet.name.replace(/\.(csv|xlsx|xls)$/i, '').replace(/[-_]/g, ' ');
        setTitle((t) => t || base.charAt(0).toUpperCase() + base.slice(1));
      }

      const pending: Array<{ name: string; blob: Blob }> = [];
      if (zip) {
        setStage('Unpacking image bundle…');
        const extracted = await extractImageZip(zip);
        for (const [name, blob] of extracted) {
          if (!pending.some((p) => p.name === name)) pending.push({ name, blob });
        }
      }
      if (imgs.length) {
        for (const [name, blob] of imageFilesToMap(imgs)) pending.push({ name, blob });
      }

      if (pending.length) {
        setStage(`Compressing ${pending.length} images to WebP…`);
        const compressed = await compressBatch(pending, (done, all) => setProgress(10 + Math.round((done / all) * 80)));
        for (const [name, img] of compressed) imagesMapRef.current.set(name, img);
        setImageCount(imagesMapRef.current.size);
      } else {
        setProgress(80);
      }

      if (raw) {
        setStage('Validating rows…');
        const seen = new Set<string>();
        const validated = raw.map((rec) => validateRecord(rec, imagesMapRef.current, seen));
        setRows(validated);
        setProgress(100);
        const bad = validated.filter((v) => v.errors.length).length;
        notify(
          `${validated.length} rows read · ${validated.length - bad} valid${bad ? ` · ${bad} need attention` : ''}`,
          bad ? 'info' : 'success',
        );
      } else if (!rows.length) {
        notify('Images uploaded. Add the CSV or XLSX file to match them up.', 'info');
      }
    } catch (e) {
      notify((e as Error).message || 'Import failed', 'error');
    } finally {
      setBusy(false);
      setStage('');
      setTimeout(() => setProgress(0), 800);
    }
  };

  const toggleRow = (rowNumber: number, include: boolean) =>
    setRows((prev) => prev.map((r) => (r.rowNumber === rowNumber ? { ...r, include } : r)));

  const doImport = async () => {
    if (!validRows.length) {
      notify('No valid rows to import yet', 'error');
      return;
    }
    setBusy(true);
    try {
      const quiz: QuizSet = {
        id: uid('quiz'),
        title: title.trim() || 'Imported quiz',
        emoji: '📥',
        description: `Imported from a spreadsheet on ${new Date().toLocaleDateString('en-GB')}.`,
        subject,
        yearGroup,
        tags: Array.from(new Set(validRows.map((r) => r.topic).filter(Boolean))).slice(0, 8),
        visibility,
        ownerId: user?.id ?? '',
        questions: importRowsToQuestions(validRows),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await saveQuiz(quiz);
      setCreatedQuiz(quiz);
      notify(`Imported ${quiz.questions.length} questions`);
      setRows([]);
      imagesMapRef.current = new Map();
      setImageCount(0);
    } catch (e) {
      notify((e as Error).message || 'Could not save the imported quiz', 'error');
    } finally {
      setBusy(false);
    }
  };

  const undo = async () => {
    if (!createdQuiz) return;
    await deleteQuiz(createdQuiz.id);
    setCreatedQuiz(null);
    notify('Import undone — the quiz was removed');
  };

  return (
    <div className="page">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-navy-700">Import a quiz</h1>
          <p className="text-sm text-navy-300 mt-1">
            CSV or Excel, with optional images in a ZIP. Everything is validated before it lands in your library.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Btn variant="ghost" onClick={downloadTemplateCsv}>
            ⬇️ Template CSV
          </Btn>
          <Btn variant="ghost" onClick={downloadTemplateXlsx}>
            ⬇️ Template XLSX
          </Btn>
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.2fr_1fr]">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            void handleFiles(Array.from(e.dataTransfer.files));
          }}
          className={cx(
            'rounded-3xl border-2 border-dashed p-6 text-center transition',
            dragOver ? 'border-teal-500 bg-teal-100/40' : 'border-navy-100 bg-white/70',
          )}
        >
          <div className="text-5xl" aria-hidden="true">
            📥
          </div>
          <h2 className="font-display text-lg font-bold text-navy-700 mt-2">Drop your files here</h2>
          <p className="text-sm text-navy-300 mt-1">
            A spreadsheet plus any images (ZIP or many files at once). Images become WebP, max 1280px, 2 MB each.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Btn onClick={() => sheetRef.current?.click()}>Choose spreadsheet</Btn>
            <Btn variant="ghost" onClick={() => zipRef.current?.click()}>
              Add image ZIP
            </Btn>
            <Btn variant="ghost" onClick={() => imagesRef.current?.click()}>
              Add images
            </Btn>
          </div>
          <input
            ref={sheetRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFiles([f]);
              e.target.value = '';
            }}
          />
          <input
            ref={zipRef}
            type="file"
            accept=".zip"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFiles([f]);
              e.target.value = '';
            }}
          />
          <input
            ref={imagesRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              if (files.length) void handleFiles(files);
              e.target.value = '';
            }}
          />

          {busy && (
            <div className="mt-4">
              <p className="text-sm font-bold text-navy-600">{stage}</p>
              <div className="mx-auto mt-2 max-w-xs">
                <ProgressBar value={progress} tone="teal" label="Import progress" />
              </div>
            </div>
          )}

          {imageCount > 0 && (
            <p className="mt-3 text-xs font-bold text-sage-500">🖼️ {imageCount} images ready</p>
          )}
        </div>

        <Card>
          <h3 className="font-display font-bold text-navy-700">Quiz details</h3>
          <div className="mt-3 space-y-3">
            <Field label="Quiz title" htmlFor="imp-title">
              <input id="imp-title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Year 6 Geography — Rivers" />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Subject" htmlFor="imp-subject">
                <select id="imp-subject" className="input" value={subject} onChange={(e) => setSubject(e.target.value as Subject)}>
                  {SUBJECTS.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </Field>
              <Field label="Year group" htmlFor="imp-year">
                <select
                  id="imp-year"
                  className="input"
                  value={yearGroup}
                  onChange={(e) => setYearGroup(Number(e.target.value) as YearGroup)}
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((y) => (
                    <option key={y} value={y}>
                      Year {y}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Visibility" htmlFor="imp-vis">
              <select id="imp-vis" className="input" value={visibility} onChange={(e) => setVisibility(e.target.value as 'private' | 'shared')}>
                <option value="private">Private — only me</option>
                <option value="shared">Shared — Eastbridge library</option>
              </select>
            </Field>
            <Btn className="w-full" onClick={doImport} disabled={!validRows.length} loading={busy}>
              Import {validRows.length || ''} valid row{validRows.length === 1 ? '' : 's'}
            </Btn>
            {createdQuiz && (
              <div className="rounded-xl bg-sage-100 p-3 text-sm">
                <p className="font-bold text-sage-500">✅ “{createdQuiz.title}” imported</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Btn size="sm" onClick={() => nav(`/teacher/editor/${createdQuiz.id}`)}>
                    Open quiz
                  </Btn>
                  <Btn size="sm" variant="ghost" onClick={undo}>
                    ↩ Undo import
                  </Btn>
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>

      {rows.length > 0 && (
        <Card className="mt-5" pad={false}>
          <div className="flex flex-wrap items-center justify-between gap-2 p-4 border-b border-navy-50">
            <div>
              <h3 className="font-display font-bold text-navy-700">Preview · {total} rows</h3>
              <p className="text-xs text-navy-300">
                {validRows.length} ready · {invalidRows.length} with errors
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Btn
                size="sm"
                variant="ghost"
                onClick={() =>
                  setRows((prev) =>
                    prev.map((r) => ({ ...r, include: r.include || isImportRowValid(r) })),
                  )
                }
              >
                Include all valid
              </Btn>
              <Btn size="sm" variant="ghost" onClick={() => setRows([])}>
                Clear
              </Btn>
            </div>
          </div>
          <div className="max-h-[460px] overflow-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="w-10">✓</th>
                  <th>Row</th>
                  <th>Question</th>
                  <th>Options</th>
                  <th>Correct</th>
                  <th>Time</th>
                  <th>Points</th>
                  <th>Image</th>
                  <th>Checks</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const ok = isImportRowValid(r);
                  return (
                    <tr key={r.rowNumber} className={ok ? '' : 'bg-red-50/40'}>
                      <td>
                        <input
                          type="checkbox"
                          className="h-5 w-5 accent-teal-500"
                          checked={r.include}
                          disabled={!ok}
                          onChange={(e) => toggleRow(r.rowNumber, e.target.checked)}
                          aria-label={`Include row ${r.rowNumber}`}
                        />
                      </td>
                      <td className="font-bold text-navy-300">{r.rowNumber}</td>
                      <td className="max-w-[260px]">
                        <span className="line-clamp-2 font-semibold">{r.text || <em className="text-red-600">missing</em>}</span>
                        {r.topic && <span className="badge-sage mt-1">{r.topic}</span>}
                      </td>
                      <td className="text-xs text-navy-300">{r.options.length} options</td>
                      <td>
                        {r.correctIndex >= 0 ? (
                          <span className="badge-teal">{'ABCD'[r.correctIndex]}</span>
                        ) : (
                          <span className="badge-red">?</span>
                        )}
                      </td>
                      <td>{r.timeLimit}s</td>
                      <td>{r.points}</td>
                      <td>
                        {r.image ? (
                          <img src={r.image.dataUrl} alt={r.imageAlt} className="h-10 w-14 rounded object-cover" />
                        ) : r.imageUrl ? (
                          <img src={r.imageUrl} alt={r.imageAlt} className="h-10 w-14 rounded object-cover" />
                        ) : (
                          <span className="text-navy-300">—</span>
                        )}
                      </td>
                      <td className="min-w-[190px] text-xs">
                        {r.errors.map((e) => (
                          <p key={e} className="text-red-600 font-semibold">
                            ✕ {e}
                          </p>
                        ))}
                        {r.warnings.map((w) => (
                          <p key={w} className="text-gold-600">
                            ⚠ {w}
                          </p>
                        ))}
                        {ok && !r.warnings.length && <p className="text-sage-500 font-semibold">✓ ready</p>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <h3 className="font-display font-bold text-navy-700">Column reference</h3>
          <div className="mt-2 overflow-x-auto">
            <table className="text-xs w-full">
              <tbody>
                {[
                  ['question', 'Required. The question text.'],
                  ['option_a … option_d', '2–4 answer options. Leave option_c / option_d empty for true/false.'],
                  ['correct', 'A, B, C, D or 1–4. You can also paste the exact answer text.'],
                  ['time_limit', 'Seconds, 5–120 (default 20).'],
                  ['points', '0–10000 (default 1000).'],
                  ['image_url', 'https:// link to an image.'],
                  ['image_file', 'Filename inside your ZIP or multi-upload.'],
                  ['image_alt', 'Screen-reader description (strongly recommended).'],
                  ['explanation', 'Shown after the answer — great for feedback.'],
                  ['topic', 'Used in topic strengths and weaknesses.'],
                ].map(([a, b]) => (
                  <tr key={a} className="border-t border-navy-50">
                    <td className="py-1.5 pr-3 font-mono font-bold text-navy-600 whitespace-nowrap align-top">{a}</td>
                    <td className="py-1.5 text-navy-300">{b}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[11px] text-navy-300">
            Columns accepted: {TEMPLATE_HEADERS.join(', ')}. Excel BOM and UTF-8 accents (é, ɔ, ɛ) are handled.
          </p>
        </Card>

        <Card>
          <h3 className="font-display font-bold text-navy-700">Export instead</h3>
          <p className="mt-1 text-sm text-navy-300">Take any quiz out as CSV for editing in Excel or Google Sheets.</p>
          <ExportPicker onExport={exportQuizCsv} />
          <div className="mt-4 flex items-center gap-3 rounded-2xl bg-navy-50 p-3">
            <Logo size={40} />
            <p className="text-xs text-navy-500">
              Imported images are stored with the quiz (Storage in Supabase, embedded locally in demo mode). Alt text is carried
              across so every picture stays accessible.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
};

const ExportPicker: React.FC<{ onExport: (quiz: QuizSet) => void }> = ({ onExport }) => {
  const { db } = useApp();
  const [id, setId] = useState(db.quizzes[0]?.id ?? '');
  const quiz = db.quizzes.find((q) => q.id === id);
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <select aria-label="Choose a quiz to export" className="input flex-1" value={id} onChange={(e) => setId(e.target.value)}>
        {db.quizzes.map((q) => (
          <option key={q.id} value={q.id}>
            {q.title}
          </option>
        ))}
      </select>
      <Btn
        variant="ghost"
        onClick={() => {
          if (quiz) onExport(quiz);
        }}
      >
        ⬇️ Export
      </Btn>
    </div>
  );
};
