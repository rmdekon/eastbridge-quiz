import React, { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Logo, Btn, Modal, Toggle } from './ui';
import { Avatar } from './Avatar';
import { useApp } from '../store/AppStore';
import { cx, levelFromXp } from '../lib/utils';

type NavItem = { to: string; label: string; icon: string; end?: boolean };

const TEACHER_NAV: NavItem[] = [
  { to: '/teacher', label: 'Dashboard', icon: '🏠', end: true },
  { to: '/teacher/library', label: 'Quiz Library', icon: '📚' },
  { to: '/teacher/assignments', label: 'Assignments', icon: '🗂️' },
  { to: '/teacher/gradebook', label: 'Gradebook', icon: '📊' },
  { to: '/teacher/minigames', label: 'Arcade', icon: '🕹️' },
];

const LEARNER_NAV: NavItem[] = [
  { to: '/home', label: 'Home', icon: '🏠', end: true },
  { to: '/tasks', label: 'My Tasks', icon: '🗂️' },
  { to: '/join', label: 'Join Game', icon: '🎮' },
  { to: '/shop', label: 'Shop', icon: '🛍️' },
];

const ADMIN_NAV: NavItem[] = [{ to: '/admin', label: 'Admin', icon: '🛡️' }];

export const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout, settings, updateSettings, backendMode } = useApp();
  const [menuOpen, setMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const nav = useNavigate();
  const location = useLocation();

  useEffect(() => {
    setMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [location.pathname]);

  const links =
    user?.role === 'teacher'
      ? [...TEACHER_NAV, ...ADMIN_NAV]
      : user?.role === 'admin'
        ? [...TEACHER_NAV, ...ADMIN_NAV]
        : user?.role === 'learner'
          ? LEARNER_NAV
          : [];

  const level = levelFromXp(user?.xp ?? 0);

  // Live games, the join screen and the host board are full-screen: no chrome.
  const immersive =
    location.pathname === '/join' ||
    location.pathname.startsWith('/play/') ||
    location.pathname.startsWith('/host/');

  if (immersive) {
    return (
      <div className="min-h-dvh">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:z-[200] focus:top-2 focus:left-2 focus:bg-white focus:px-4 focus:py-2 focus:rounded-xl focus:font-bold"
        >
          Skip to content
        </a>
        <main id="main">{children}</main>
      </div>
    );
  }

  return (
    <div className="min-h-dvh flex flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:z-[200] focus:top-2 focus:left-2 focus:bg-white focus:px-4 focus:py-2 focus:rounded-xl focus:font-bold"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-40 border-b border-navy-100/70 bg-cream-100/85 backdrop-blur-lg">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8 h-16">
          <Link to={user ? (user.role === 'learner' ? '/home' : '/teacher') : '/'} className="tap-none">
            <Logo size={40} withText />
          </Link>

          {user && (
            <nav aria-label="Main" className="hidden lg:flex items-center gap-1 ml-4">
              {links.map((l) => (
                <NavLink
                  key={l.to}
                  to={l.to}
                  end={l.end}
                  className={({ isActive }) =>
                    cx(
                      'rounded-xl px-3 py-2 text-sm font-bold transition',
                      isActive ? 'bg-navy-600 text-white shadow-sm' : 'text-navy-500 hover:bg-white',
                    )
                  }
                >
                  <span className="mr-1.5" aria-hidden="true">
                    {l.icon}
                  </span>
                  {l.label}
                </NavLink>
              ))}
            </nav>
          )}

          <div className="ml-auto flex items-center gap-2">
            {user?.role === 'learner' && (
              <div className="hidden sm:flex items-center gap-2 rounded-2xl bg-white px-3 py-1.5 shadow-sm">
                <span className="text-sm" aria-hidden="true">
                  🪙
                </span>
                <span className="font-display text-sm font-bold text-navy-700">{user.coins.toLocaleString()}</span>
                <span className="mx-1 h-4 w-px bg-navy-100" />
                <span className="text-xs font-bold text-gold-600">Lv {level}</span>
              </div>
            )}
            <button
              onClick={() => setSettingsOpen(true)}
              className="rounded-xl p-2.5 text-lg hover:bg-white"
              aria-label="Accessibility and sound settings"
              title="Settings"
            >
              ⚙️
            </button>
            {user ? (
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="flex items-center gap-2 rounded-2xl bg-white px-2 py-1.5 shadow-sm hover:shadow"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                aria-label="Account menu"
              >
                <Avatar id={user.avatarId} size={32} />
                <span className="hidden sm:block pr-1 text-sm font-bold text-navy-700">{user.firstName}</span>
              </button>
            ) : (
              <div className="flex gap-2">
                <Btn size="sm" variant="ghost" onClick={() => nav('/join')}>
                  Join
                </Btn>
                <Btn size="sm" onClick={() => nav('/login')}>
                  Sign in
                </Btn>
              </div>
            )}
          </div>
        </div>
      </header>

      <AnimatePresence>
        {menuOpen && user && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="fixed right-3 top-[68px] z-50 w-64 rounded-2xl border border-navy-100 bg-white p-2 shadow-lift"
            role="menu"
          >
            <div className="px-3 py-2">
              <p className="font-display font-bold text-navy-700">
                {user.firstName} {user.lastName}
              </p>
              <p className="text-xs capitalize text-navy-300">
                {user.role} · {backendMode === 'local' ? 'Demo mode' : 'Supabase'}
              </p>
            </div>
            <div className="h-px bg-navy-50 my-1" />
            {user.role === 'learner' && (
              <>
                <Link to="/tasks" className="block rounded-xl px-3 py-2.5 text-sm font-bold text-navy-600 hover:bg-navy-50">
                  🗂️ My tasks
                </Link>
                <Link to="/shop" className="block rounded-xl px-3 py-2.5 text-sm font-bold text-navy-600 hover:bg-navy-50">
                  🛍️ Avatar shop
                </Link>
              </>
            )}
            {(user.role === 'teacher' || user.role === 'admin') && (
              <Link to="/teacher/library" className="block rounded-xl px-3 py-2.5 text-sm font-bold text-navy-600 hover:bg-navy-50">
                📚 Quiz library
              </Link>
            )}
            <button
              onClick={() => setSettingsOpen(true)}
              className="w-full text-left rounded-xl px-3 py-2.5 text-sm font-bold text-navy-600 hover:bg-navy-50"
            >
              ⚙️ Settings
            </button>
            <button
              onClick={() => {
                logout();
                nav('/login');
              }}
              className="w-full text-left rounded-xl px-3 py-2.5 text-sm font-bold text-red-600 hover:bg-red-50"
            >
              ⎋ Sign out
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <main id="main" className="flex-1">
        {children}
      </main>

      {user && (
        <nav
          className="lg:hidden sticky bottom-0 z-40 border-t border-navy-100 bg-white/95 backdrop-blur pb-[env(safe-area-inset-bottom)]"
          aria-label="Mobile"
        >
          <div className="flex">
            {links.slice(0, 4).map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.end}
                className={({ isActive }) =>
                  cx(
                    'flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-bold',
                    isActive ? 'text-navy-700' : 'text-navy-300',
                  )
                }
              >
                <span className="text-lg" aria-hidden="true">
                  {l.icon}
                </span>
                {l.label}
              </NavLink>
            ))}
          </div>
        </nav>
      )}

      <Modal open={settingsOpen} onClose={() => setSettingsOpen(false)} title="Settings & accessibility">
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-4 py-2">
            <span className="text-sm font-bold text-navy-700">Text size</span>
            <div className="flex items-center gap-2">
              {[0.9, 1, 1.15, 1.3].map((s) => (
                <button
                  key={s}
                  onClick={() => updateSettings({ textScale: s })}
                  aria-pressed={settings.textScale === s}
                  className={cx(
                    'h-11 w-11 rounded-xl border font-bold',
                    settings.textScale === s ? 'bg-navy-600 text-white border-navy-600' : 'border-navy-100 text-navy-600',
                  )}
                  style={{ fontSize: 12 + s * 3 }}
                >
                  A
                </button>
              ))}
            </div>
          </div>
          <Toggle label="Sound effects" description="Correct, wrong and timer cues" checked={settings.sound} onChange={(v) => updateSettings({ sound: v })} />
          <Toggle label="Arcade music" description="Soft background loops inside minigames" checked={settings.music} onChange={(v) => updateSettings({ music: v })} />
          <Toggle
            label="Reduce motion"
            description="Turns off confetti, shake and long transitions"
            checked={settings.reducedMotion}
            onChange={(v) => updateSettings({ reducedMotion: v })}
          />
          <Toggle
            label="High contrast"
            description="Stronger outlines and darker text for readability"
            checked={settings.highContrast}
            onChange={(v) => updateSettings({ highContrast: v })}
          />
          <Toggle
            label="Skip arcade breaks"
            description="Learners can move straight to the next question"
            checked={settings.skipMinigames}
            onChange={(v) => updateSettings({ skipMinigames: v })}
          />
          <Toggle
            label="Hide pictures"
            description="Load fewer images on slow connections"
            checked={settings.hideImages}
            onChange={(v) => updateSettings({ hideImages: v })}
          />
        </div>
        <p className="mt-4 text-xs text-navy-300">
          Settings are stored on this device only. No analytics, no trackers — in line with Ghana's Data Protection Act, 2012
          (Act 843).
        </p>
      </Modal>
    </div>
  );
};
