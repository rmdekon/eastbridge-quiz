import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Btn, Card, Field, Logo } from '../components/ui';
import { useApp } from '../store/AppStore';
import { demoCredentials } from '../data/seed';
import { normalizeCode, normalizePin } from '../lib/codes';

export const Login: React.FC = () => {
  const [params] = useSearchParams();
  const [tab, setTab] = useState<'staff' | 'learner'>(params.get('role') === 'learner' ? 'learner' : 'staff');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { loginStaff, loginLearner, notify } = useApp();
  const nav = useNavigate();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (tab === 'staff') {
        const p = await loginStaff(email, password);
        notify(`Welcome back, ${p.firstName}`);
        nav(p.role === 'admin' ? '/admin' : '/teacher');
      } else {
        const p = await loginLearner(code, pin);
        notify(`Welcome, ${p.firstName}!`);
        nav('/home');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page-tight py-8">
      <div className="mx-auto max-w-md">
        <div className="text-center mb-6">
          <div className="flex justify-center">
            <Logo size={72} />
          </div>
          <h1 className="font-display text-2xl font-bold text-navy-700 mt-3">Sign in to Eastbridge Quiz Arcade</h1>
          <p className="text-sm text-navy-300 mt-1">Staff use a school email. Learners use a school-issued code.</p>
        </div>

        <Card>
          <div className="mb-5 grid grid-cols-2 gap-1 rounded-2xl bg-navy-50 p-1">
            {(['staff', 'learner'] as const).map((t) => (
              <button
                key={t}
                onClick={() => {
                  setTab(t);
                  setError('');
                }}
                className={`rounded-xl py-2.5 text-sm font-bold transition ${
                  tab === t ? 'bg-white text-navy-700 shadow-sm' : 'text-navy-500'
                }`}
                aria-pressed={tab === t}
              >
                {t === 'staff' ? '🧑‍🏫 Staff' : '🦅 Learner'}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="space-y-4">
            {tab === 'staff' ? (
              <>
                <Field label="School email" htmlFor="email" required>
                  <input
                    id="email"
                    type="email"
                    autoComplete="username"
                    className="input"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="firstname.lastname@eastbridge.edu.gh"
                    required
                  />
                </Field>
                <Field label="Password" htmlFor="password" required>
                  <input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    className="input"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                  />
                </Field>
              </>
            ) : (
              <>
                <Field
                  label="School code"
                  htmlFor="code"
                  hint="On your library card, e.g. EB-9C-009"
                  required
                >
                  <input
                    id="code"
                    className="input font-bold tracking-wider"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    onBlur={() => setCode((c) => (c ? normalizeCode(c) : c))}
                    placeholder="EB-9C-009"
                    autoCapitalize="characters"
                    required
                  />
                </Field>
                <Field label="4-digit PIN" htmlFor="pin" hint="Ask your teacher if you have forgotten it." required>
                  <input
                    id="pin"
                    className="input text-center text-2xl font-bold tracking-[0.5em]"
                    value={pin}
                    onChange={(e) => setPin(normalizePin(e.target.value).slice(0, 4))}
                    inputMode="numeric"
                    placeholder="••••"
                    required
                  />
                </Field>
              </>
            )}

            {error && (
              <div role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                {error}
              </div>
            )}

            <Btn type="submit" className="w-full" size="lg" loading={busy}>
              Sign in
            </Btn>
          </form>

          <div className="mt-5 rounded-2xl bg-cream-100 p-3 text-xs text-navy-500">
            <p className="font-bold text-navy-600 mb-1">Demo accounts</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-lg bg-white px-2.5 py-1.5 font-bold shadow-sm hover:shadow"
                onClick={() => {
                  setTab('staff');
                  setEmail(demoCredentials.admin.email);
                  setPassword(demoCredentials.admin.password);
                }}
              >
                Admin
              </button>
              <button
                type="button"
                className="rounded-lg bg-white px-2.5 py-1.5 font-bold shadow-sm hover:shadow"
                onClick={() => {
                  setTab('staff');
                  setEmail(demoCredentials.teacher.email);
                  setPassword(demoCredentials.teacher.password);
                }}
              >
                Teacher (ICT)
              </button>
              <button
                type="button"
                className="rounded-lg bg-white px-2.5 py-1.5 font-bold shadow-sm hover:shadow"
                onClick={() => {
                  setTab('learner');
                  setCode(demoCredentials.learner.schoolCode);
                  setPin(demoCredentials.learner.pin);
                }}
              >
                Learner
              </button>
            </div>
          </div>
        </Card>

        <div className="mt-4 text-center text-sm">
          <Link to="/join" className="font-bold text-teal-500 hover:underline">
            Joining a live game? Use a PIN instead →
          </Link>
        </div>
      </div>
    </div>
  );
};
