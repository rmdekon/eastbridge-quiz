import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Logo, Btn, Card } from '../components/ui';
import { MINIGAME_MANIFESTS } from '../minigames/registry';
import { demoCredentials } from '../data/seed';
import { useApp } from '../store/AppStore';
import { normalizePin } from '../lib/codes';

export const Landing: React.FC = () => {
  const [pin, setPin] = useState('');
  const nav = useNavigate();
  const { user } = useApp();

  const go = (e: React.FormEvent) => {
    e.preventDefault();
    nav(pin ? `/join?pin=${normalizePin(pin)}` : '/join');
  };

  return (
    <div>
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 -z-10"
          style={{
            background:
              'radial-gradient(900px 460px at 15% 10%, rgba(42,127,143,0.20), transparent 65%), radial-gradient(700px 420px at 90% 0%, rgba(200,151,58,0.22), transparent 60%)',
          }}
        />
        <div className="page grid gap-10 lg:grid-cols-[1.05fr_0.95fr] items-center pt-8 sm:pt-14 pb-10">
          <div>
            <span className="badge-gold mb-4">🏫 Eastbridge International School · Accra · 2026/27</span>
            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.05] text-navy-700 text-balance">
              Learn it. Play it.
              <span className="block text-gold-500">Earn the arcade.</span>
            </h1>
            <p className="mt-4 max-w-xl text-lg text-navy-500">
              Live quizzes and homework tasks for Years 1–9 — with a 60-second 3D arcade break every time you get an
              answer right. Teachers see every score.
            </p>

            <form onSubmit={go} className="mt-7 flex flex-col sm:flex-row gap-3 max-w-lg">
              <label className="sr-only" htmlFor="pin">
                Game PIN
              </label>
              <input
                id="pin"
                value={pin}
                onChange={(e) => setPin(normalizePin(e.target.value))}
                inputMode="numeric"
                placeholder="Enter game PIN"
                aria-label="Game PIN"
                className="input flex-1 text-lg font-bold tracking-[0.3em] placeholder:tracking-normal placeholder:font-normal"
              />
              <Btn type="submit" size="lg" variant="gold">
                Play now →
              </Btn>
            </form>

            <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-navy-300">
              <span>Teachers</span>
              <Link to="/login" className="font-bold text-teal-500 hover:underline">
                sign in to host
              </Link>
              <span className="hidden sm:inline">·</span>
              <Link to="/login?role=learner" className="font-bold text-teal-500 hover:underline">
                learners sign in with a school code
              </Link>
            </div>

            <div className="mt-7 grid grid-cols-3 gap-3 max-w-md">
              {[
                { k: '10', v: '3D minigames' },
                { k: '7', v: 'game modes' },
                { k: '1–9', v: 'year groups' },
              ].map((s) => (
                <div key={s.v} className="rounded-2xl bg-white/80 p-3 text-center shadow-sm">
                  <div className="font-display text-xl font-bold text-navy-700">{s.k}</div>
                  <div className="text-[11px] font-bold uppercase tracking-wide text-navy-300">{s.v}</div>
                </div>
              ))}
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="relative"
          >
            <div
              className="relative rounded-[2rem] p-6 shadow-lift overflow-hidden"
              style={{ background: 'linear-gradient(155deg, #162f57, #0c1526 70%)' }}
            >
              <div className="flex items-center justify-between">
                <Logo size={56} withText light />
                <span className="chip bg-gold-500/20 text-gold-300">Live · Year 9 ICT</span>
              </div>
              <div className="mt-6 rounded-2xl bg-white/8 border border-white/15 p-5">
                <p className="text-xs font-bold uppercase tracking-widest text-gold-300">Question 3 of 8</p>
                <h3 className="mt-2 font-display text-xl font-bold text-white">
                  Which type of malware encrypts your files and demands payment?
                </h3>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {['Adware', 'Ransomware', 'Spyware', 'Rootkit'].map((opt, i) => (
                    <div
                      key={opt}
                      className={`rounded-xl px-3 py-3 text-sm font-bold ${
                        i === 1 ? 'bg-sage-500 text-white' : 'bg-white/10 text-white/80'
                      }`}
                    >
                      <span className="mr-2 opacity-60">{'ABCD'[i]}</span>
                      {opt}
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex items-center gap-3 rounded-xl bg-gold-500/15 border border-gold-500/30 p-3">
                  <span className="text-2xl" aria-hidden="true">🎮</span>
                  <div>
                    <p className="text-sm font-bold text-gold-300">Correct! Arcade break unlocked</p>
                    <p className="text-xs text-white/70">60s in Crew Sabotage · +120 Eagle Coins</p>
                  </div>
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                {['🦅', '🦅', '🦅', '🦅', '🦅'].map((a, i) => (
                  <div
                    key={i}
                    className="h-9 w-9 rounded-xl flex items-center justify-center text-lg"
                    style={{
                      background: [
                        'linear-gradient(145deg,#E0B45C,#C8973A)',
                        'linear-gradient(145deg,#4FA3B2,#2A7F8F)',
                        'linear-gradient(145deg,#2C5490,#1B3A6B)',
                        'linear-gradient(145deg,#C3D8BD,#7FA476)',
                        'linear-gradient(145deg,#F7A072,#D1495B)',
                      ][i],
                    }}
                  >
                    {a}
                  </div>
                ))}
                <div className="ml-auto self-center text-xs font-bold text-white/60">+ 18 more playing</div>
              </div>
            </div>
            <p className="sr-only">
              Preview of a live game question about ransomware with an arcade break unlocked.
            </p>
          </motion.div>
        </div>
      </section>

      <section className="page py-6">
        <h2 className="section-title">The arcade is earned, never given</h2>
        <p className="text-navy-300 mt-1 max-w-2xl">
          A correct answer unlocks a short three.js break. Wrong answers get a clear explanation instead — so the quiz
          always stays the main event.
        </p>
        <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {MINIGAME_MANIFESTS.slice(0, 10).map((g) => (
            <div
              key={g.id}
              className="rounded-2xl border border-navy-100 bg-white/80 p-3 hover:-translate-y-0.5 hover:shadow-soft transition"
            >
              <div
                className="mb-2 flex h-20 items-center justify-center rounded-xl text-3xl"
                style={{ background: `linear-gradient(150deg, ${g.color}33, ${g.color}11)` }}
                aria-hidden="true"
              >
                {g.emoji}
              </div>
              <p className="font-display text-sm font-bold text-navy-700 leading-tight">{g.name}</p>
              <p className="text-[11px] text-navy-300 mt-0.5">{g.tagline}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="page py-10">
        <div className="grid md:grid-cols-3 gap-4">
          {[
            {
              icon: '🧑‍🏫',
              title: 'For teachers',
              body: 'Build or import quizzes, host live games, assign tasks and export assessment data in seconds.',
              cta: 'Open teacher dashboard',
              to: '/login',
            },
            {
              icon: '🦅',
              title: 'For learners',
              body: 'Join in three taps with a PIN, earn Eagle Coins and climb the class leaderboard.',
              cta: 'Join a game',
              to: '/join',
            },
            {
              icon: '🛡️',
              title: 'Safe by design',
              body: 'No chat, no ads, no trackers. Minimal data, preset reactions and school-level access rules.',
              cta: 'Read the privacy notes',
              to: '/privacy',
            },
          ].map((c) => (
            <Card key={c.title} className="flex flex-col">
              <div className="text-3xl" aria-hidden="true">
                {c.icon}
              </div>
              <h3 className="font-display text-lg font-bold text-navy-700 mt-2">{c.title}</h3>
              <p className="text-sm text-navy-300 mt-1 flex-1">{c.body}</p>
              <Link to={c.to} className="mt-4 font-bold text-teal-500 hover:underline text-sm">
                {c.cta} →
              </Link>
            </Card>
          ))}
        </div>

        {!user && (
          <Card className="mt-8 bg-navy-600 text-white border-navy-600">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="font-display text-lg font-bold">Try the demo</h3>
                <p className="text-sm text-white/70 mt-1">
                  Demo password <code className="rounded bg-white/15 px-1.5 py-0.5">eastbridge</code> — teacher{' '}
                  <code className="rounded bg-white/15 px-1.5 py-0.5">{demoCredentials.teacher.email}</code>, learner{' '}
                  <code className="rounded bg-white/15 px-1.5 py-0.5">
                    {demoCredentials.learner.schoolCode} / {demoCredentials.learner.pin}
                  </code>
                </p>
              </div>
              <div className="flex gap-2">
                <Btn variant="gold" onClick={() => nav('/login')}>
                  Staff sign in
                </Btn>
                <Btn variant="ghost" onClick={() => nav('/join')}>
                  Learner join
                </Btn>
              </div>
            </div>
          </Card>
        )}
      </section>

      <footer className="border-t border-navy-100 py-6">
        <div className="page flex flex-wrap items-center justify-between gap-3 text-xs text-navy-300">
          <Logo size={28} />
          <p>© {new Date().getFullYear()} Eastbridge International School · Accra, Ghana · Hallmark of Excellence</p>
          <Link to="/privacy" className="font-bold hover:text-navy-600">
            Privacy & safeguarding
          </Link>
        </div>
      </footer>
    </div>
  );
};
