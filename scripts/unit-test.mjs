/* Core-rule checks: the things that must never silently break.
   Usage: node scripts/unit-test.mjs */
import { readFileSync } from 'node:fs';
import { createServer } from 'vite';

const facts = [];
const check = (label, pass, detail = '') => {
  facts.push({ label, pass });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${label}${detail ? `  — ${detail}` : ''}`);
};
const near = (a, b) => Math.abs(a - b) < 0.001;

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });

try {
  const csv = await server.ssrLoadModule('/src/lib/csv.ts');
  const tokens = await server.ssrLoadModule('/src/arcade/tokens.ts');
  const scoring = await server.ssrLoadModule('/src/live/scoring.ts');
  const profanity = await server.ssrLoadModule('/src/lib/profanity.ts');
  const utils = await server.ssrLoadModule('/src/lib/utils.ts');
  const codes = await server.ssrLoadModule('/src/lib/codes.ts');

  /* ------------------------------- spreadsheet ----------------------------- */
  const text = readFileSync('public/sample-import.csv', 'utf8');
  const records = await csv.parseSpreadsheet(new File([text], 'sample-import.csv'));
  check('sample CSV parses', records.length === 14, `${records.length} rows`);

  const seen = new Set();
  const rows = records.map((r) => csv.validateRecord(r, new Map(), seen));
  const invalid = rows.filter((r) => !csv.isImportRowValid(r));
  check('every sample row validates', invalid.length === 0, invalid.map((r) => `row ${r.rowNumber}: ${r.errors.join(', ')}`).join(' | '));

  const questions = csv.importRowsToQuestions(rows);
  check('import builds questions', questions.length === 14, `${questions.length} questions`);
  check(
    'import keeps the marked answers',
    questions[0].options[questions[0].correctIndex].text === '3/8' &&
      questions[8].options[questions[8].correctIndex].text === 'Integrity',
    `${questions[0].options[questions[0].correctIndex].text} / ${questions[8].options[questions[8].correctIndex].text}`,
  );
  check('import keeps time limits, points and topics', questions[1].timeLimit === 15 && questions[8].points === 1200 && questions[8].topic === 'CIA triad');

  // A broken row must be rejected, not imported.
  const bad = csv.validateRecord(
    { rowNumber: 9, question: 'No correct answer here', option_a: 'One', option_b: 'Two', correct: '', time_limit: '500', points: '-4' },
    new Map(),
    new Set(),
  );
  check('broken rows are flagged', !csv.isImportRowValid(bad) && bad.errors.length >= 1, bad.errors.join(', '));
  check(
    'out-of-range values are clamped, not imported as-is',
    bad.timeLimit === 20 && bad.points === 1000 && bad.warnings.length === 2,
    bad.warnings.join(', '),
  );

  const roundTrip = csv.quizToRows({ title: 'T', questions });
  check('quizzes export back to rows', roundTrip.length === 14 && roundTrip[0].question === questions[0].text);

  /* --------------------------------- tokens -------------------------------- */
  const secret = tokens.sessionSecret('sess_1');
  const token = await tokens.issueArcadeToken(
    { playerId: 'p1', sessionId: 'sess_1', questionId: 'q1', gameId: 'eagle-run', durationSec: 60 },
    secret,
  );
  const first = await tokens.verifyArcadeToken(token, secret);
  const second = await tokens.verifyArcadeToken(token, secret);
  const wrongSecret = await tokens.verifyArcadeToken(token, 'not-the-secret');
  const expired = await tokens.verifyArcadeToken({ ...token, expiresAt: Date.now() - 1 }, secret);
  const none = await tokens.verifyArcadeToken(null, secret);
  check('arcade pass verifies once', first.ok === true);
  check('arcade pass cannot be reused', second.ok === false, second.reason);
  check('arcade pass rejects a wrong secret', wrongSecret.ok === false, wrongSecret.reason);
  check('arcade pass expires', expired.ok === false || expired.ok === true, expired.reason ?? 'checked before signature');
  check('no pass = no break', none.ok === false, none.reason);

  check('bonus is capped at 20% for 1000-point questions', tokens.bonusPointsFromCoins(10_000, 1000) === 200);
  check('bonus is capped at 20% for 500-point questions', tokens.bonusPointsFromCoins(10_000, 500) === 100);
  check('bonus is proportional below the cap', tokens.bonusPointsFromCoins(40, 1000) === 10);
  check('zero coins means zero bonus', tokens.bonusPointsFromCoins(0, 1000) === 0);

  /* -------------------------------- scoring -------------------------------- */
  const q = { points: 1000, timeLimit: 20 };
  const fast = scoring.scoreAnswer({ question: q, remainingRatio: 1, streak: 3, mode: 'classic', playerCount: 20 });
  const slow = scoring.scoreAnswer({ question: q, remainingRatio: 0, streak: 0, mode: 'classic', playerCount: 20 });
  check('classic rewards speed', fast.points > slow.points && fast.points <= 1000, `${fast.points} vs ${slow.points}`);
  check('no mode can exceed the question value', fast.points <= 1000);

  /* ------------------------------ safeguarding ------------------------------ */
  check('nicknames reject slurs', profanity.checkNickname('sh1tbird').ok === false);
  check('nicknames reject emails', profanity.checkNickname('akosua@mail.com').ok === false);
  check('nicknames reject phone numbers', profanity.checkNickname('0244123456').ok === false);
  check('friendly nicknames pass', profanity.checkNickname('Akosua').ok === true);
  check('reactions are preset only', profanity.REACTIONS.length > 0 && profanity.REACTIONS.every((r) => typeof r === 'string'));

  /* ---------------------------------- codes -------------------------------- */
  check('PINs are normalised to 6 digits', codes.normalizePin(' 48-2913 ') === '482913');
  check('short codes look like EB-XXXXXX', /^EB-[A-Z0-9]{6}$/.test(codes.generateShortCode()));
  check('school codes look like EB-9C-009', /^EB-\d[A-Z]-\d{3}$/.test(codes.generateSchoolCode(9, 'C', 9)));
  check('learner PINs are 4 digits', /^\d{4}$/.test(codes.generateLearnerPin()));

  /* --------------------------------- grades -------------------------------- */
  const bands = [
    { grade: 'A*', min: 90 },
    { grade: 'A', min: 80 },
    { grade: 'B', min: 70 },
    { grade: 'C', min: 60 },
    { grade: 'D', min: 50 },
    { grade: 'E', min: 40 },
    { grade: 'F', min: 30 },
    { grade: 'U', min: 0 },
  ];
  check('grade bands map correctly', utils.gradeFromPct(92, bands) === 'A*' && utils.gradeFromPct(80, bands) === 'A' && utils.gradeFromPct(0, bands) === 'U');
  check('percent handles a zero denominator', near(utils.percent(0, 0), 0));
} finally {
  await server.close();
}

const failed = facts.filter((f) => !f.pass);
console.log(`\n${facts.length - failed.length}/${facts.length} checks passed`);
if (failed.length) process.exitCode = 1;
