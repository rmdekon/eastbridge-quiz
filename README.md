# 🦅 Eastbridge Quiz Arcade

A Blooket/Kahoot/Gimkit/CrowdParty-style learning platform built for **Eastbridge International School, Accra, Ghana** (Years 1–9, 2026/27).

Teachers build quizzes, import them from a spreadsheet, host live games on the classroom projector, set self-paced assignments — and the **arcade is earned**: a correct answer unlocks a 15–180 second three.js minigame break. Wrong answers get a friendly explanation instead.

> **The core rule:** every correct answer buys arcade time. Every wrong answer buys understanding. Arcade bonus points are capped at **+20% of the question's points**, so quiz accuracy always stays dominant in the gradebook.

---

## Contents

- [Quick start](#quick-start)
- [Demo accounts](#demo-accounts)
- [What is in the box](#what-is-in-the-box)
- [Project structure](#project-structure)
- [How live games work](#how-live-games-work)
- [The arcade break (anti-cheat rules)](#the-arcade-break-anti-cheat-rules)
- [CSV / XLSX import](#csv--xlsx-import)
- [Adding a minigame](#adding-a-minigame)
- [Deploy: Vercel + Supabase](#deploy-vercel--supabase)
- [Data model](#data-model)
- [Accessibility & safeguarding](#accessibility--safeguarding)
- [Scripts](#scripts)
- [Design tokens](#design-tokens)

---

## Quick start

```bash
npm install
cp .env.example .env       # leave the Supabase values blank for demo mode
npm run dev                # http://localhost:5173
```

With `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` blank the app runs in **demo mode**: a complete, seeded school — 3 quizzes, classes, learners, submissions, a game report — stored in this browser's `localStorage`. Everything works, including live games across two browser tabs on the same device (`BroadcastChannel`).

```bash
npm run build     # typecheck + production build into dist/
npm run preview   # serve the production build
npm test          # headless render test of every route + an end-to-end live game
```

## Demo accounts

| Role | Sign in with |
| --- | --- |
| **Admin** (ICT lead) | `nana.adjei@eastbridge.edu.gh` / `eastbridge` |
| **Teacher** | `esi.owusu@eastbridge.edu.gh` / `eastbridge` |
| **Learner** | school code `EB-9C-009` + PIN `9216` |
| **Guest** | tap **Join**, any live 6-digit PIN — first name only, no account |

Other seeded learners use PINs `1024 2048 3141 4096 5123 6144 7168 8192 1357 2468 3579`.

**To see a live game:** sign in as the teacher → *Quiz library* → **Host live** → the lobby shows the PIN and a giant QR code. Open `/join` in a second tab (or scan with a phone on the same network), enter the PIN, pick an eagle. Answer correctly to trigger the arcade.

## What is in the box

**Roles** — Admin (ICT head), Teacher, Learner (school code + PIN, no email), Guest (PIN + first name).

**Quiz editor** — title, emoji, cover image, description, subject (13 subject options), year group, tags, visibility (private / shared library), folders, duplicate quiz. Questions: multiple choice (2–4 options) or true/false, per-question time limit and points, explanation and topic, images on the question *and* on each option (upload, drag-drop or URL, alt text required, click to zoom), drag-reorder, duplicate, bulk edit time/points, and *preview as a learner*.

**Import** — `.csv` and `.xlsx` (UTF-8/BOM safe), with a downloadable template and a worked example. Images can come from an `image_url`, or from a `image_file` name matched against an uploaded ZIP or multi-file selection. Images are auto-compressed to WebP ≤1280 px and ≤2 MB in the browser. The preview table validates row by row (missing answers, out-of-range time limits, duplicate options, missing alt text, unresolved image names) and you can import **valid rows only**. Import is undoable, and any quiz can be exported back to CSV/XLSX.

**Game modes** — Classic, Eagle Cash, Trophy Hunt, Cipher Crack, Scholar Swarm, Team Battle, Crowd Party (assembly hall: giant QR, emoji reactions), plus self-paced **Solo practice** and **Assigned tasks**.

**Live host controls** — start, pause/resume, skip question, next, lock lobby, kick player, hide names, shuffle questions/answers, end game. The host screen doubles as the projector board: live standings, answer distribution, Cipher progress, reactions.

**Assessment** — gradebook with academic score, accuracy, correct/total, time taken, best streak, attempts and status, and a **separate arcade bonus column**; per-question analysis (% correct, most-chosen wrong answer, average time, hardest/easiest); a learner × question heatmap; learner profiles with history, topic strengths/weaknesses, trend chart and automatic *Needs support* (<50%) / *Excelling* (90%+) flags; teacher comments; configurable A*–U grade bands; filters by class, year, subject, term and date; class comparison; CSV / XLSX / PDF export. Live games auto-save a post-game report with teaching next steps.

**Assignments** — target a class, a year group or hand-picked learners; attempts 1 / 2 / unlimited; shuffle; arcade configuration (length, allowed games, trigger: every answer / every 2nd / streak of 3); start and due dates; short share code (e.g. `EB-7K2Q9A`). Learners get To do / In progress / Done / Overdue with a countdown and *resume*, late flags, and teachers can extend or reopen.

**Learner experience** — join in three taps, level & XP, Eagle Coins, avatar shop, badges, streak calendar, confetti on correct, gentle encouragement on wrong.

**10 original three.js minigames** — Crew Sabotage, Blaster Arena, Eagle Run, Neon Slope, Sky Hop, Tower Stack, Kart Dash, Hoop Shot, Fruit Slash, Gold Rush. Original low-poly art and characters, the eagle mascot, no gore or realistic weapons.

## Project structure

```
├─ public/
│  ├─ logo.png                 school crest (used throughout)
│  ├─ icon.svg                 maskable app icon
│  ├─ manifest.webmanifest     installable PWA
│  ├─ sw.js                    offline shell + asset cache
│  └─ sample-import.csv        worked spreadsheet example (14 rows)
├─ supabase/schema.sql         tables, RLS policies, RPCs, storage buckets
├─ scripts/
│  ├─ smoke.mjs                renders every route in jsdom as each role
│  └─ live-test.mjs            end-to-end host ↔ player live game test
└─ src/
   ├─ arcade/
   │  ├─ BaseGame.ts           three.js lifecycle superclass (DPR cap, adaptive
   │  │                        quality, pause, bulletproof dispose)
   │  ├─ tokens.ts             one-time arcade passes (signed, single-use)
   │  └─ ArcadeBreak.tsx       instructions → game → results, bonus cap
   ├─ components/              AppShell, ui.tsx (Btn/Card/Modal/…), Avatar,
   │                           ImageInput, StartGameModal
   ├─ data/                    seed demo school, avatars, subjects, game modes,
   │                           sample images (inline SVG — no binary assets)
   ├─ lib/
   │  ├─ backend/              Backend interface + local & Supabase adapters
   │  ├─ csv.ts                parse, validate, template, export, ZIP images
   │  ├─ exports.ts            gradebook CSV/XLSX/PDF, report CSV, analysis
   │  ├─ images.ts             WebP compression, dimension + alt checks
   │  ├─ profanity.ts          nickname filter, preset reaction list
   │  └─ sfx.ts, utils.ts, codes.ts, storage.ts
   ├─ live/                    protocol, scoring, shuffle/present, useHostGame,
   │                           usePlayerGame
   ├─ minigames/               10 games + registry (lazy) + manifests
   ├─ pages/
   │  ├─ Landing, Login, Join, Privacy, NotFound
   │  ├─ teacher/              Dashboard, Library, Editor, Import, Assignments,
   │  │                        Gradebook(+Detail), GameReport, MinigamePreview
   │  ├─ host/HostGame.tsx     lobby → question → reveal → break → podium
   │  ├─ play/LivePlay.tsx     learner live screen
   │  └─ learner/              Home, MyTasks, TaskPlay, AvatarShop
   ├─ store/AppStore.tsx       single data store + auth + toasts
   └─ types.ts                 the shared domain model
```

Every minigame is its own chunk, loaded with `import()` on demand — the quiz UI never ships three.js. No `vite-plugin-singlefile`.

## How live games work

```
host tab                          channel                        player tabs
────────                          ───────                        ───────────
useHostGame(sessionId)  ── snapshot ──────────────────────────▶  usePlayerGame(pin)
   authoritative state                                           renders phase
                        ◀─ hello {ticket} ──────────────────────  join / rejoin
                        ◀─ answer {questionId, optionIndex, ms} ─
   scores, streaks,
   per-question counts
                        ── snapshot (reveal + correctIndex) ───▶  ✓ / ✗ + explanation
                        ── tokens[playerId] ───────────────────▶  arcade pass
```

- The **host tab is the authority** for question order, deadlines and every score. Players are thin clients.
- Transport is a `LiveChannel` from the backend: `BroadcastChannel` + `localStorage` bus in demo mode, Supabase Realtime broadcast in production. Swapping backends changes nothing in the pages.
- Phases: `lobby → question → reveal → break → … → podium`. Deadlines are timestamps, not ticks, so a throttled background tab cannot stretch a question or a break.
- `correctIndex` is never sent during the `question` phase — only at reveal. Question/answer positions are derived from a seeded shuffle (`sessionId:questionId`) so everyone sees the same order without leaking answers.
- Guests are never trusted with a score: they send *which option they chose*, nothing else.

## The arcade break (anti-cheat rules)

1. A player answers correctly → the host issues an **arcade pass** tied to `(player, question)` with a duration and an expiry (`issueArcadeToken` in `arcade/tokens.ts`).
2. The pass is single-use and MAC-signed with a per-session secret. `verifyArcadeToken` runs before the minigame timer starts.
3. Wrong answer or timeout → **no pass**. The learner sees the answer, the explanation and a 5-second “next one!” card, and re-syncs when the break ends.
4. Break length is `min(180, max(15, breakDurationSec))` from the assignment/session settings and the end time is set by the host — the client cannot extend it.
5. Coins from the minigame convert to bonus points, hard-capped at **20% of that question's points** (`bonusPointsFromCoins`). Academic score and arcade bonus are stored and displayed in separate columns.
6. `supabase/schema.sql` ships `claim_arcade_break()`, a server-side RPC that re-validates the stored answer, refuses a second claim per question and returns a server-expiry. Use it (or an Edge Function) in production so a tampered client cannot mint passes.

## CSV / XLSX import

Template columns (downloadable from the import page):

| column | notes |
| --- | --- |
| `question` | required |
| `option_a` … `option_d` | 2–4 required; leave C/D blank for true/false |
| `correct` | `A`–`D` or `1`–`4` (the answer text also works) |
| `time_limit` | seconds, 5–120, default 20 |
| `points` | default 1000 |
| `image_url` | full `https://` link |
| `image_file` | filename inside your uploaded ZIP / file selection |
| `image_alt` | required whenever an image is set |
| `explanation` | shown after a wrong answer |
| `topic` | drives topic-level analytics |

`public/sample-import.csv` is a valid 14-row example (Year 5 maths, Year 7 science, Year 9 ICT security) you can import as-is.

## Adding a minigame

```ts
// 1. src/minigames/PigeonPost.ts
import { BaseGame } from '../arcade/BaseGame';
export default class PigeonPost extends BaseGame {
  protected build() { /* add meshes to this.scene */ }
  protected update(dt: number) { /* per-frame logic; call this.award(coins) */ }
}
```

```ts
// 2. src/minigames/manifests.ts  — add { id: 'pigeon-post', name, emoji, … }
// 3. src/minigames/registry.ts   — add 'pigeon-post': () => import('./PigeonPost')
```

It immediately appears in the arcade picker, the teacher’s allow-list, admin settings and `MinigamePreview`. `BaseGame` handles the renderer (DPR ≤1.5), resize, pause, adaptive quality below 40 FPS, coin conversion and disposal of every geometry, material, texture and GL context. The registry falls back to `Fallback2D` when WebGL is unavailable.

## Deploy: Vercel + Supabase

**1. Supabase**

1. Create a project at [supabase.com](https://supabase.com) (choose an EU or nearest region).
2. SQL editor → paste `supabase/schema.sql` → run. It creates the tables, RLS policies, the `learner_login` / `set_learner_pin` / `game_by_pin` / `claim_arcade_break` RPCs, the private `media` storage bucket and Realtime publications.
3. Authentication → Providers → enable **Email** (staff). Learners do **not** need email accounts.
4. Copy *Project URL* and *anon public key*.

**2. Local**

```bash
cp .env.example .env
# VITE_SUPABASE_URL=https://xxxx.supabase.co
# VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
npm run dev
```

The Supabase adapter is selected automatically when both values are present.

**3. Vercel**

1. Import the repository in Vercel (framework preset: **Vite**, build `npm run build`, output `dist`).
2. Add the two environment variables above (Production + Preview).
3. Deploy. `vercel.json` already handles SPA rewrites, immutable asset caching and the security headers.

**4. First run in production**

Run `supabase/schema.sql` before the first deploy, create staff accounts in Supabase Auth, then insert their `profiles` rows (`role = 'teacher' | 'admin'`). Create classes, add learners with `school_code` + `set_learner_pin(id, '1234')`, and you are live.

## Data model

`profiles` · `classes` · `class_members` · `quizzes` · `questions` · `games` · `game_players` · `arcade_tokens` · `assignments` · `assignment_targets` · `submissions` · `answers` · `minigame_results` · `game_reports` · `org_settings`

- Questions carry `image_url`, `image_alt`, `explanation`, `topic`; quizzes carry `subject`, `year_group`, `tags`, `visibility`, `owner_id`.
- Assignments carry `class_ids`, `start_date`, `attempts` (1 / 2 / unlimited), `due_date` and the `arcade` JSON config.
- Submissions carry `arcade_bonus` separately from `score`/`accuracy`, plus per-question `answers` and `minigame_results`.
- Row-level security: teachers only see their own classes, learners only their own results and assigned quizzes, shared-library quizzes are readable by staff, and `org_settings` writes are admin-only.

## Accessibility & safeguarding

- Mobile-first; interactive targets ≥ 44 px; keyboard operable; visible focus rings; skip-to-content link.
- WCAG-AA contrast, colour-blind-safe palette, adjustable text size, high-contrast mode, sound toggle, **skip minigame**, and `prefers-reduced-motion` respected across framer-motion and every game.
- **No learner chat.** Preset emoji reactions only; nicknames pass a profanity filter; guests give a first name only.
- Minimal child data: first/last name, class, school code, avatar. No email, no birthdate, no address. PINs are stored as bcrypt hashes (`pin_hash`) and never in plain text.
- No ads, no third-party analytics, no trackers. Fonts are the only external request.
- Image uploads are validated for type/size, compressed locally, stored in a private bucket with signed URLs.
- Aligned with Ghana's **Data Protection Act, 2012 (Act 843)**: purpose limitation, minimum collection, parental/school consent handled by the school, and deletion via the admin danger zone.
- School-safe games: no gore, no realistic weapons, no gambling mechanics that cost real coins.

## Scripts

| command | what it does |
| --- | --- |
| `npm run dev` | Vite dev server on `0.0.0.0:5173` |
| `npm run build` | `tsc --noEmit` then `vite build` |
| `npm run preview` | serve `dist/` |
| `npm run typecheck` | types only |
| `npm run smoke` | render all routes for guest/teacher/admin/learner in jsdom |
| `npm run smoke:live` | host + player tabs, answer a question, check reveal & arcade pass |
| `npm test` | both of the above |

## Design tokens

| token | value | use |
| --- | --- | --- |
| `navy-600` | `#1B3A6B` | primary brand, teacher UI |
| `navy-900 / arcade` | `#0B1220` | dark arcade screens |
| `gold-500` | `#C8973A` | rewards, coins, CTAs |
| `teal-500` | `#2A7F8F` | secondary actions, links |
| `sage-400/500` | `#B7CDB3 / #7FA476` | correct answers, calm states |
| `cream-100` | `#FBF8F1` | warm off-white background |

Type: **Fredoka** for display, **Nunito** for body (Google Fonts, self-cacheable, `display=swap`).

---

Built for Eastbridge International School · Accra, Ghana · 2026/27
