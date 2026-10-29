/* End-to-end live-game test in jsdom + Node BroadcastChannel.
   Host and player tabs are simulated in the same process.

   Usage: node scripts/live-test.mjs   (no dev server needed) */
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';

const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'http://localhost:5173/',
  pretendToBeVisual: true,
});
const g = globalThis;
const define = (key, value) => Object.defineProperty(g, key, { value, configurable: true, writable: true });
define('window', dom.window);
define('document', dom.window.document);
define('navigator', dom.window.navigator);
define('location', dom.window.location);
define('history', dom.window.history);
define('HTMLElement', dom.window.HTMLElement);
define('HTMLCanvasElement', dom.window.HTMLCanvasElement);
define('Element', dom.window.Element);
define('Node', dom.window.Node);
define('Event', dom.window.Event);
define('CustomEvent', dom.window.CustomEvent);
define('MouseEvent', dom.window.MouseEvent);
define('KeyboardEvent', dom.window.KeyboardEvent);
define('localStorage', dom.window.localStorage);
define('sessionStorage', dom.window.sessionStorage);
define('getComputedStyle', dom.window.getComputedStyle.bind(dom.window));
define('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
define('requestAnimationFrame', (cb) => setTimeout(() => cb(performance.now()), 16));
define('cancelAnimationFrame', (id) => clearTimeout(id));
define('IntersectionObserver', class { observe() {} unobserve() {} disconnect() {} });
define('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
g.HTMLCanvasElement.prototype.getContext = () => null;
dom.window.scrollTo = () => {};

const errors = [];
const origError = console.error;
console.error = (...args) => {
  const first = String(args[0] ?? '');
  if (first.includes('Not implemented')) return;
  errors.push(first.slice(0, 300));
};
console.warn = () => {};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const norm = (el) => (el.textContent || '').replace(/\s+/g, ' ').trim();
const byText = (root, text, tag = 'button') =>
  [...root.querySelectorAll(tag)].find((el) => norm(el).toLowerCase().includes(text.toLowerCase()));
const click = (el) => el?.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
const facts = [];
const check = (label, pass, detail = '') => {
  facts.push({ label, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${label}${detail ? `  — ${detail}` : ''}`);
};

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });

try {
  const React = (await import('react')).default;
  const { createRoot } = await import('react-dom/client');
  const { MemoryRouter } = await import('react-router-dom');
  const { App } = await server.ssrLoadModule('/src/App.tsx');
  const { AppProvider } = await server.ssrLoadModule('/src/store/AppStore.tsx');
  const { createSeedDB } = await server.ssrLoadModule('/src/data/seed.ts');

  const seed = createSeedDB();
  seed.sessions = [];
  const quiz = seed.quizzes.find((q) => q.id === 'quiz_y9_ict');
  quiz.questions.forEach((q) => (q.timeLimit = 6));
  const teacher = seed.profiles.find((p) => p.id === 'p_teacher_esi');
  const pin = '482913';
  const sessionId = 'sess_live_test';
  seed.sessions.push({
    id: sessionId,
    pin,
    quizId: quiz.id,
    quizTitle: quiz.title,
    hostId: teacher.id,
    mode: 'classic',
    status: 'lobby',
    settings: {
      shuffleQuestions: false,
      shuffleAnswers: false,
      hideNames: false,
      lockLobby: false,
      arcadeEnabled: true,
      breakDurationSec: 15,
      allowedGames: [],
      trigger: 'every',
      teamCount: 2,
    },
    questionOrder: quiz.questions.map((q) => q.id),
    currentIndex: -1,
    phaseStartedAt: Date.now(),
    createdAt: new Date().toISOString(),
  });
  localStorage.setItem('ebqa:db:v1', JSON.stringify(seed));
  localStorage.setItem('ebqa:session:user', JSON.stringify(teacher));

  const mount = (route) => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    root.render(
      React.createElement(
        MemoryRouter,
        { initialEntries: [route] },
        React.createElement(AppProvider, null, React.createElement(App, null)),
      ),
    );
    return { host, root };
  };

  /* ------------------------------- host lobby ------------------------------ */
  const hostTab = mount(`/host/${sessionId}`);
  await sleep(900);
  check('host lobby renders', norm(hostTab.host).includes('Start game'), norm(hostTab.host).slice(0, 60));

  /* ------------------------------ player join ------------------------------ */
  sessionStorage.setItem(
    `ebqa:ticket:${pin}`,
    JSON.stringify({
      pin,
      playerId: 'player_test_1',
      name: 'Akosua',
      avatarId: 'eagle-gold',
      isGuest: true,
      joinedAt: Date.now(),
    }),
  );
  const playerTab = mount(`/play/${pin}`);
  await sleep(1200);
  check('player receives lobby snapshot', norm(playerTab.host).toLowerCase().includes('waiting') || norm(playerTab.host).includes(quiz.title), norm(playerTab.host).slice(0, 90));
  check('host sees the joined player', norm(hostTab.host).includes('Akosua'), norm(hostTab.host).slice(0, 120));

  /* -------------------------------- start game ----------------------------- */
  click(byText(hostTab.host, 'Start game'));
  await sleep(1400);
  const questionText = quiz.questions[0].text.slice(0, 24);
  check('host shows question 1', norm(hostTab.host).includes(questionText), norm(hostTab.host).slice(0, 80));
  check('player shows question 1', norm(playerTab.host).includes(questionText), norm(playerTab.host).slice(0, 80));

  /* ------------------------------ player answers ---------------------------- */
  const correctOption = quiz.questions[0].options[quiz.questions[0].correctIndex].text;
  const optionBtn = [...playerTab.host.querySelectorAll('button')].find((b) => norm(b).includes(correctOption));
  check('answer buttons are rendered', Boolean(optionBtn), correctOption);
  click(optionBtn);
  await sleep(1200);
  check('answer was locked in', /locked|answer saved|waiting/i.test(norm(playerTab.host)), norm(playerTab.host).slice(0, 90));
  check('host counts the answer', /1\s*(of|\/)\s*1|answered/i.test(norm(hostTab.host)), norm(hostTab.host).slice(0, 120));

  /* --------------------------- auto reveal at deadline --------------------- */
  await sleep(6500);
  check('reveal shows the correct answer', norm(playerTab.host).includes(correctOption), norm(playerTab.host).slice(0, 110));
  const playerText = norm(playerTab.host);
  check('learner earned an arcade break', /arcade|break|play/i.test(playerText), playerText.slice(0, 110));

  /* ------------------------------ host advances ---------------------------- */
  const nextBtn = byText(hostTab.host, 'Next') ?? byText(hostTab.host, 'Skip');
  check('host has a next/skip control', Boolean(nextBtn), nextBtn ? norm(nextBtn) : 'missing');

  playerTab.root.unmount();
  hostTab.root.unmount();
} finally {
  await server.close();
}

console.log('\nconsole.error count:', errors.length);
for (const e of errors.slice(0, 10)) console.log(' -', e);
const failed = facts.filter((f) => !f.pass).length;
console.log(`\n${facts.length - failed}/${facts.length} checks passed`);
if (failed || errors.length) process.exitCode = 1;
