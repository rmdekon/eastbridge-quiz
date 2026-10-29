/* Headless smoke test: renders every route in jsdom as guest, teacher, learner
   and admin, and reports React/console errors.
   Usage: node scripts/smoke.mjs   (no dev server needed) */
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
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
define('matchMedia', () => ({
  matches: false,
  addEventListener() {},
  removeEventListener() {},
  addListener() {},
  removeListener() {},
}));
define('requestAnimationFrame', (cb) => setTimeout(() => cb(performance.now()), 16));
define('cancelAnimationFrame', (id) => clearTimeout(id));
define('IntersectionObserver', class { observe() {} unobserve() {} disconnect() {} });
define('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
define('scrollTo', () => {});
dom.window.scrollTo = () => {};
g.HTMLCanvasElement.prototype.getContext = () => null;

const errors = [];
const origError = console.error;
console.error = (...args) => {
  const first = String(args[0] ?? '');
  if (first.includes('Not implemented')) return;
  errors.push(first.slice(0, 400));
  origError(...args);
};

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });

const render = async ({ React, createRoot, MemoryRouter, App, AppProvider }, route) => {
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
  await new Promise((r) => setTimeout(r, 400));
  const text = (host.textContent || '').replace(/\s+/g, ' ').trim();
  const headings = [...host.querySelectorAll('h1, h2')].map((h) => h.textContent?.trim()).filter(Boolean);
  root.unmount();
  host.remove();
  return { text, headings };
};

try {
  const React = (await import('react')).default;
  const { createRoot } = await import('react-dom/client');
  const { MemoryRouter } = await import('react-router-dom');
  const { App } = await server.ssrLoadModule('/src/App.tsx');
  const { AppProvider } = await server.ssrLoadModule('/src/store/AppStore.tsx');
  const { createSeedDB } = await server.ssrLoadModule('/src/data/seed.ts');
  const seed = createSeedDB();
  const env = { React, createRoot, MemoryRouter, App, AppProvider };

  const who = (id) => seed.profiles.find((p) => p.id === id);
  const teacher = who('p_teacher_esi');
  const admin = who('p_admin');
  const learner = seed.profiles.find((p) => p.role === 'learner' && p.classId === seed.classes[0]?.id) ?? seed.profiles.find((p) => p.role === 'learner');

  const login = (profile) => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('ebqa:session:user', JSON.stringify(profile));
  };

  const cases = [
    ['guest', null, ['/', '/join', '/login', '/privacy', '/nope']],
    ['teacher', teacher, ['/teacher', '/teacher/library', '/teacher/import', '/teacher/assignments', '/teacher/gradebook', '/teacher/minigames']],
    ['admin', admin, ['/admin', '/teacher', '/teacher/gradebook']],
    ['learner', learner, ['/home', '/tasks', '/shop', '/practice/quiz_y9_ict']],
  ];

  for (const [label, profile, routes] of cases) {
    if (profile) login(profile);
    else {
      localStorage.clear();
      sessionStorage.clear();
    }
    console.log(`\n── ${label}${profile ? ` (${profile.firstName})` : ''} ──`);
    for (const route of routes) {
      const { text, headings } = await render(env, route);
      console.log(`${route.padEnd(26)} ${String(text.length).padStart(5)}c  ${headings.slice(0, 2).join(' | ') || text.slice(0, 60)}`);
    }
  }

  // Game report + gradebook detail need a seed assignment/report id.
  login(teacher);
  const assignment = seed.assignments[0];
  const report = seed.reports[0];
  for (const route of [`/teacher/gradebook/${assignment.id}`, `/teacher/report/${report.id}`]) {
    const { text, headings } = await render(env, route);
    console.log(`${route.padEnd(26)} ${String(text.length).padStart(5)}c  ${headings.slice(0, 2).join(' | ') || text.slice(0, 60)}`);
  }
  // Learner task screen
  login(learner);
  {
    const { text, headings } = await render(env, `/tasks/${assignment.id}`);
    console.log(`${`/tasks/${assignment.id}`.padEnd(26)} ${String(text.length).padStart(5)}c  ${headings.slice(0, 2).join(' | ') || text.slice(0, 60)}`);
  }
} finally {
  await server.close();
}

console.log('\nconsole.error count:', errors.length);
for (const e of errors.slice(0, 15)) console.log(' -', e);
if (errors.length) process.exitCode = 1;
