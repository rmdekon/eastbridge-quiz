import Papa from 'papaparse';
import JSZip from 'jszip';
import type { Question, QuizSet } from '../types';
import { sanitizeText, uid, isValidUrl, downloadBlob } from './utils';
import { compressImage, type CompressedImage } from './images';

export const TEMPLATE_HEADERS = [
  'question',
  'option_a',
  'option_b',
  'option_c',
  'option_d',
  'correct',
  'time_limit',
  'points',
  'image_url',
  'image_file',
  'image_alt',
  'explanation',
  'topic',
] as const;

export const TEMPLATE_EXAMPLE_ROWS: string[][] = [
  [
    'What is 7 × 8?',
    '54',
    '56',
    '64',
    '48',
    'B',
    '20',
    '1000',
    '',
    '',
    '',
    '7 × 8 = 56. Split it as 7 × 4 = 28, doubled.',
    'Multiplication',
  ],
  [
    'Which shape has exactly 3 sides?',
    'Square',
    'Triangle',
    'Pentagon',
    'Circle',
    'B',
    '15',
    '1000',
    '',
    'triangle.png',
    'A gold triangle with three equal sides',
    'A triangle has three straight sides and three angles.',
    '2D shapes',
  ],
  [
    'Water boils at 100°C at sea level.',
    'True',
    'False',
    '',
    '',
    'A',
    '15',
    '1000',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/9/94/Water_drop_impact_on_a_water-surface_-_2021-02-10_21-10-14.jpg/640px-Water_drop_impact_on_a_water-surface_-_2021-02-10_21-10-14.jpg',
    '',
    'A single water droplet',
    'Yes — at standard atmospheric pressure water boils at 100°C.',
    'States of matter',
  ],
];

export const csvEscape = (value: unknown): string => {
  const s = value == null ? '' : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const buildTemplateCsv = (): string => {
  const lines = [TEMPLATE_HEADERS.join(',')];
  for (const row of TEMPLATE_EXAMPLE_ROWS) lines.push(row.map(csvEscape).join(','));
  // BOM keeps Excel happy with accented French characters.
  return `\uFEFF${lines.join('\r\n')}\r\n`;
};

export const downloadTemplateCsv = () =>
  downloadBlob(new Blob([buildTemplateCsv()], { type: 'text/csv;charset=utf-8' }), 'eastbridge-quiz-template.csv');

export const downloadTemplateXlsx = async () => {
  const XLSX = await import('xlsx');
  const ws = XLSX.utils.aoa_to_sheet([[...TEMPLATE_HEADERS], ...TEMPLATE_EXAMPLE_ROWS]);
  ws['!cols'] = TEMPLATE_HEADERS.map((h) => ({ wch: h === 'question' || h === 'explanation' ? 46 : 16 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Questions');
  const readme = XLSX.utils.aoa_to_sheet([
    ['Eastbridge Quiz Arcade — import template'],
    [''],
    ['correct', 'Use A, B, C, D (or 1-4) to mark the right answer.'],
    ['time_limit', 'Seconds per question, 5–120. Default 20.'],
    ['points', 'Points for a correct answer, 0–10000. Default 1000.'],
    ['image_url', 'A full https:// link to an image.'],
    ['image_file', 'A filename that exists inside the ZIP you upload (e.g. triangle.png).'],
    ['image_alt', 'Describe the image for screen readers (required when an image is set).'],
    [''],
    ['Images are compressed to WebP (max 1280px, 2 MB) on import.'],
  ]);
  readme['!cols'] = [{ wch: 20 }, { wch: 70 }];
  XLSX.utils.book_append_sheet(wb, readme, 'How to use');
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  downloadBlob(
    new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    'eastbridge-quiz-template.xlsx',
  );
};

const stripBom = (s: string) => s.replace(/^\uFEFF/, '');

export interface RawImportRecord {
  rowNumber: number;
  [key: string]: unknown;
}

/** Parse CSV or XLSX into normalised lowercase-keyed records. BOM-safe. */
export const parseSpreadsheet = async (file: File): Promise<RawImportRecord[]> => {
  const name = file.name.toLowerCase();
  if (name.endsWith('.csv') || file.type.includes('csv')) {
    const text = stripBom(await file.text());
    const parsed = Papa.parse<Record<string, unknown>>(text, {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: (h) => stripBom(h).trim().toLowerCase().replace(/\s+/g, '_'),
    });
    return parsed.data.map((r, i) => ({ ...r, rowNumber: i + 2 }));
  }
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    const buf = await file.arrayBuffer();
    const XLSX = await import('xlsx');
    const wb = XLSX.read(buf, { type: 'array' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '', raw: false });
    return rows.map((r, i) => {
      const norm: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(r)) {
        norm[stripBom(k).trim().toLowerCase().replace(/\s+/g, '_')] =
          typeof v === 'string' ? stripBom(v).trim() : v;
      }
      return { ...norm, rowNumber: i + 2 };
    });
  }
  throw new Error('Please upload a .csv or .xlsx file');
};

const CORRECT_LETTERS = ['a', 'b', 'c', 'd'];

export interface ImportRow {
  rowNumber: number;
  text: string;
  options: string[];
  correctIndex: number;
  timeLimit: number;
  points: number;
  imageUrl: string;
  imageFile: string;
  imageAlt: string;
  explanation: string;
  topic: string;
  errors: string[];
  warnings: string[];
  image?: CompressedImage;
  include: boolean;
}

export const isImportRowValid = (r: ImportRow) => r.errors.length === 0;

/** Validate a raw record against the documented schema. */
export const validateRecord = (
  rec: RawImportRecord,
  images: Map<string, CompressedImage>,
  seen: Set<string>,
): ImportRow => {
  const get = (k: string) => sanitizeText(String(rec[k] ?? ''), 1000);
  const text = get('question');
  const rawOptions = [get('option_a'), get('option_b'), get('option_c'), get('option_d')];
  const trimmed = rawOptions.filter((o) => o.length > 0);
  const correctRaw = get('correct').toUpperCase();
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!text) errors.push('Missing question text');
  if (trimmed.length < 2) errors.push('Needs at least 2 answer options');

  let correctIndex = -1;
  if (!correctRaw) {
    errors.push('Missing correct answer');
  } else if (CORRECT_LETTERS.includes(correctRaw.toLowerCase())) {
    correctIndex = CORRECT_LETTERS.indexOf(correctRaw.toLowerCase());
  } else if (/^[1-4]$/.test(correctRaw)) {
    correctIndex = Number(correctRaw) - 1;
  } else {
    // Allow the literal correct answer text as a convenience.
    const idx = rawOptions.findIndex((o) => o.toLowerCase() === correctRaw.toLowerCase());
    if (idx >= 0) {
      correctIndex = idx;
      warnings.push('Matched the correct answer by text');
    }
  }
  if (correctIndex >= 0 && !rawOptions[correctIndex]) {
    errors.push('Correct answer points at an empty option');
  }
  if (correctIndex > trimmed.length - 1 && correctIndex >= 0) {
    errors.push('Correct answer must be one of the filled-in options');
  }

  const timeLimit = Number(get('time_limit') || 20);
  if (!Number.isFinite(timeLimit) || timeLimit < 5 || timeLimit > 120) {
    warnings.push('Time limit defaulted to 20s (must be 5–120)');
  }
  const points = Number(get('points') || 1000);
  if (!Number.isFinite(points) || points < 0 || points > 10000) {
    warnings.push('Points defaulted to 1000 (must be 0–10000)');
  }

  const imageUrl = get('image_url');
  const imageFile = get('image_file');
  let imageAlt = get('image_alt');
  let image: CompressedImage | undefined;

  if (imageUrl) {
    if (!isValidUrl(imageUrl)) errors.push('image_url is not a valid http(s) link');
    if (!imageAlt) warnings.push('Add image_alt so screen readers can describe the picture');
  }
  if (imageFile) {
    const found = images.get(imageFile.toLowerCase());
    if (!found) errors.push(`Image “${imageFile}” was not found in the uploaded files`);
    else image = found;
    if (!imageAlt) imageAlt = `Picture for question ${rec.rowNumber}`;
  }
  if (!imageUrl && !imageFile && imageAlt) warnings.push('Alt text provided without an image');

  const dupeKey = text.trim().toLowerCase();
  if (dupeKey && seen.has(dupeKey)) errors.push('Duplicate question in this file');
  else if (dupeKey) seen.add(dupeKey);

  return {
    rowNumber: Number(rec.rowNumber ?? 0),
    text,
    options: trimmed,
    correctIndex,
    timeLimit: Number.isFinite(timeLimit) && timeLimit >= 5 && timeLimit <= 120 ? Math.round(timeLimit) : 20,
    points: Number.isFinite(points) && points >= 0 && points <= 10000 ? Math.round(points) : 1000,
    imageUrl,
    imageFile,
    imageAlt,
    explanation: get('explanation'),
    topic: get('topic'),
    errors,
    warnings,
    image,
    include: errors.length === 0,
  };
};

export const importRowsToQuestions = (rows: ImportRow[]): Question[] =>
  rows
    .filter((r) => r.include && isImportRowValid(r))
    .map<Question>((r) => ({
      id: uid('q'),
      type: r.options.length === 2 && /^(true|false)$/i.test(r.options[0]) ? 'true_false' : 'multiple_choice',
      text: r.text,
      options: r.options.map((text) => ({ id: uid('o'), text })),
      correctIndex: r.correctIndex,
      timeLimit: r.timeLimit,
      points: r.points,
      imageUrl: r.image?.dataUrl || r.imageUrl,
      imageAlt: r.imageAlt,
      explanation: r.explanation,
      topic: r.topic,
    }));

/* ------------------------------- exporting ------------------------------- */

export const quizToRows = (quiz: QuizSet): Array<Record<string, string | number>> =>
  quiz.questions.map((q) => ({
    question: q.text,
    option_a: q.options[0]?.text ?? '',
    option_b: q.options[1]?.text ?? '',
    option_c: q.options[2]?.text ?? '',
    option_d: q.options[3]?.text ?? '',
    correct: CORRECT_LETTERS[q.correctIndex]?.toUpperCase() ?? 'A',
    time_limit: q.timeLimit,
    points: q.points,
    image_url: q.imageUrl && q.imageUrl.startsWith('data:') ? '' : q.imageUrl ?? '',
    image_file: q.imageUrl && q.imageUrl.startsWith('data:') ? `${q.id}.webp` : '',
    image_alt: q.imageAlt ?? '',
    explanation: q.explanation ?? '',
    topic: q.topic ?? '',
  }));

export const exportQuizCsv = (quiz: QuizSet) => {
  const rows = quizToRows(quiz);
  const csv = `\uFEFF${Papa.unparse(rows, { columns: [...TEMPLATE_HEADERS] })}`;
  downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `${slug(quiz.title)}-export.csv`);
};

export const exportQuizXlsx = async (quiz: QuizSet) => {
  const XLSX = await import('xlsx');
  const rows = quizToRows(quiz);
  const ws = XLSX.utils.json_to_sheet(rows, { header: [...TEMPLATE_HEADERS] });
  ws['!cols'] = TEMPLATE_HEADERS.map((h) => ({ wch: h === 'question' || h === 'explanation' ? 46 : 16 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Questions');
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  downloadBlob(
    new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    `${slug(quiz.title)}-export.xlsx`,
  );
};

export const slug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'quiz';

/** Build a ZIP of all data-URL images in a quiz for re-importing elsewhere. */
export const exportQuizImagesZip = async (quiz: QuizSet, JSZipCtor: typeof JSZip) => {
  const zip = new JSZipCtor();
  for (const q of quiz.questions) {
    if (q.imageUrl?.startsWith('data:')) {
      const base64 = q.imageUrl.split(',')[1];
      zip.file(`${slug(q.text).slice(0, 30)}-${q.id}.webp`, base64, { base64: true });
    }
  }
  const blob = await zip.generateAsync({ type: 'blob' });
  downloadBlob(blob, `${slug(quiz.title)}-images.zip`);
};

export const recompressBlob = compressImage;
