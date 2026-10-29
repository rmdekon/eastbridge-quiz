import Papa from 'papaparse';
import type { Assignment, AssignmentSubmission, GameReport, Profile, Question, QuestionStat } from '../types';
import { downloadBlob, formatDate, formatMs, gradeFromPct, percent, type GradeBand } from './utils';
import { slug } from './csv';

export interface GradebookRow {
  learner: string;
  className: string;
  accuracy: number;
  score: number;
  correct: number;
  total: number;
  timeMs: number;
  bestStreak: number;
  attempts: number;
  status: string;
  arcadeBonus: number;
  grade: string;
  late: string;
  comment: string;
}

export const buildGradebookRows = (
  submissions: AssignmentSubmission[],
  profiles: Profile[],
  classes: { id: string; name: string }[],
  bands: GradeBand[],
): GradebookRow[] =>
  submissions.map((s) => {
    const learner = profiles.find((p) => p.id === s.learnerId);
    return {
      learner: learner ? `${learner.firstName} ${learner.lastName}` : 'Unknown learner',
      className: classes.find((c) => c.id === learner?.classId)?.name ?? '—',
      accuracy: s.accuracy,
      score: s.score,
      correct: s.correct,
      total: s.total,
      timeMs: s.totalTimeMs,
      bestStreak: s.bestStreak,
      attempts: s.attempt,
      status: s.status,
      arcadeBonus: s.arcadeBonus,
      grade: gradeFromPct(s.accuracy, bands),
      late: s.late ? 'Yes' : 'No',
      comment: s.teacherComment ?? '',
    };
  });

const csvFromRows = (rows: GradebookRow[]) =>
  Papa.unparse(
    rows.map((r) => ({
      Learner: r.learner,
      Class: r.className,
      'Score %': r.accuracy,
      'Academic points': r.score,
      Correct: r.correct,
      Total: r.total,
      'Time taken': formatMs(r.timeMs),
      'Best streak': r.bestStreak,
      Attempt: r.attempts,
      Status: r.status,
      'Arcade bonus': r.arcadeBonus,
      Grade: r.grade,
      Late: r.late,
      Comment: r.comment,
    })),
  );

export const exportGradebookCsv = (assignment: Assignment, rows: GradebookRow[]) => {
  downloadBlob(
    new Blob([`\uFEFF${csvFromRows(rows)}`], { type: 'text/csv;charset=utf-8' }),
    `gradebook-${slug(assignment.title)}.csv`,
  );
};

export const exportGradebookXlsx = async (assignment: Assignment, rows: GradebookRow[], analysis: QuestionStat[]) => {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  const main = XLSX.utils.json_to_sheet(
    rows.map((r) => ({
      Learner: r.learner,
      Class: r.className,
      'Score %': r.accuracy,
      'Academic points': r.score,
      Correct: r.correct,
      Total: r.total,
      'Time taken (s)': Math.round(r.timeMs / 1000),
      'Best streak': r.bestStreak,
      Attempt: r.attempts,
      Status: r.status,
      'Arcade bonus': r.arcadeBonus,
      Grade: r.grade,
      Late: r.late,
      Comment: r.comment,
    })),
  );
  main['!cols'] = Array.from({ length: 14 }, () => ({ wch: 18 }));
  XLSX.utils.book_append_sheet(wb, main, 'Gradebook');

  const qSheet = XLSX.utils.json_to_sheet(
    analysis.map((a, i) => ({
      Question: i + 1,
      Text: a.text,
      '% correct': a.correctPct,
      Attempts: a.attempts,
      'Avg time (s)': Math.round(a.avgMs / 1000),
      'Most-chosen wrong option': a.mostChosenWrong ? `${a.mostChosenWrong.text} (${a.mostChosenWrong.count})` : '—',
    })),
  );
  qSheet['!cols'] = [{ wch: 10 }, { wch: 52 }, { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 34 }];
  XLSX.utils.book_append_sheet(wb, qSheet, 'Question analysis');

  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  downloadBlob(
    new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    `gradebook-${slug(assignment.title)}.xlsx`,
  );
};

export const exportGradebookPdf = async (
  assignment: Assignment,
  rows: GradebookRow[],
  analysis: QuestionStat[],
  schoolName: string,
) => {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  const doc = new jsPDF({ orientation: 'landscape' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(schoolName, 14, 16);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(`Assignment: ${assignment.title}`, 14, 23);
  doc.text(`Due: ${formatDate(assignment.dueDate)}   Exported: ${new Date().toLocaleString('en-GB')}`, 14, 29);

  autoTable(doc, {
    startY: 34,
    head: [['Learner', 'Class', 'Score %', 'Correct', 'Time', 'Streak', 'Status', 'Arcade bonus', 'Grade', 'Late']],
    body: rows.map((r) => [
      r.learner,
      r.className,
      `${r.accuracy}%`,
      `${r.correct}/${r.total}`,
      formatMs(r.timeMs),
      r.bestStreak,
      r.status,
      `+${r.arcadeBonus}`,
      r.grade,
      r.late,
    ]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [27, 58, 107] },
    alternateRowStyles: { fillColor: [247, 245, 239] },
  });

  if (analysis.length) {
    doc.addPage();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('Question analysis', 14, 16);
    autoTable(doc, {
      startY: 22,
      head: [['#', 'Question', '% correct', 'Attempts', 'Avg time', 'Most-chosen wrong']],
      body: analysis.map((a, i) => [
        i + 1,
        a.text.slice(0, 90),
        `${a.correctPct}%`,
        a.attempts,
        formatMs(a.avgMs),
        a.mostChosenWrong ? `${a.mostChosenWrong.text} (${a.mostChosenWrong.count})` : '—',
      ]),
      styles: { fontSize: 8, cellWidth: 'wrap' },
      headStyles: { fillColor: [42, 127, 143] },
    });
  }

  doc.save(`gradebook-${slug(assignment.title)}.pdf`);
};

export const exportReportCsv = (report: GameReport) => {
  const rows = report.players
    .slice()
    .sort((a, b) => b.score - a.score)
    .map((p, i) => ({
      Rank: i + 1,
      Learner: p.name,
      Score: p.score,
      Coins: p.coins,
      Correct: p.correct,
      Total: p.total,
      'Best streak': p.bestStreak,
      'Guest?': p.isGuest ? 'Yes' : 'No',
    }));
  downloadBlob(
    new Blob([`\uFEFF${Papa.unparse(rows)}`], { type: 'text/csv;charset=utf-8' }),
    `report-${slug(report.title)}.csv`,
  );
};

export const calcQuestionAnalysis = (
  questions: Question[],
  submissions: AssignmentSubmission[],
): QuestionStat[] =>
  questions.map((q) => {
    const answers = submissions.flatMap((s) => s.answers.filter((a) => a.questionId === q.id));
    const attempts = answers.length;
    const correctCount = answers.filter((a) => a.correct).length;
    const wrongCounts = new Map<number, number>();
    for (const a of answers) {
      if (!a.correct && a.optionIndex !== null && a.optionIndex >= 0) {
        wrongCounts.set(a.optionIndex, (wrongCounts.get(a.optionIndex) ?? 0) + 1);
      }
    }
    let mostChosenWrong: QuestionStat['mostChosenWrong'];
    let max = 0;
    for (const [idx, count] of wrongCounts) {
      if (count > max) {
        max = count;
        mostChosenWrong = { text: q.options[idx]?.text ?? `Option ${idx + 1}`, count };
      }
    }
    return {
      questionId: q.id,
      text: q.text,
      correctPct: attempts ? Math.round((correctCount / attempts) * 100) : 0,
      attempts,
      avgMs: attempts ? Math.round(answers.reduce((acc, a) => acc + a.ms, 0) / attempts) : 0,
      mostChosenWrong,
    };
  });

export const exportClassComparison = async (rows: { name: string; avg: number; submissions: number }[]) => {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(
    rows.map((r) => ({ Class: r.name, 'Average accuracy %': r.avg, Submissions: r.submissions })),
  );
  XLSX.utils.book_append_sheet(wb, ws, 'Class comparison');
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  downloadBlob(
    new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    'class-comparison.xlsx',
  );
};

export { percent };
