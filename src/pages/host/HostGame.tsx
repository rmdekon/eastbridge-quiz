import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import QRCode from 'qrcode';
import { AnimatePresence, motion } from 'framer-motion';
import { useHostGame } from '../../live/useHostGame';
import { useApp } from '../../store/AppStore';
import { Btn, ConfirmDialog, CountdownRing, Logo, Modal, ProgressBar, Spinner, Toggle, ZoomableImage } from '../../components/ui';
import { Avatar } from '../../components/Avatar';
import { GAME_MODES, TEAM_COLORS, TEAM_NAMES, modeById } from '../../data/modes';
import { formatMs, percent } from '../../lib/utils';
import { CIPHER_WORD } from '../../live/scoring';
import { copyToClipboard } from '../../lib/utils';

export const HostGame: React.FC = () => {
  const { sessionId = '' } = useParams();
  const nav = useNavigate();
  const { notify, settings: userSettings } = useApp();
  const host = useHostGame(sessionId);
  const [qr, setQr] = useState('');
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [showPlayers, setShowPlayers] = useState(true);
  const [copied, setCopied] = useState(false);

  const joinUrl = useMemo(() => {
    // VITE_PUBLIC_APP_URL lets a school print/QR a canonical domain even when the
    // host tab is opened through a preview or LAN address.
    const base = ((import.meta.env.VITE_PUBLIC_APP_URL as string | undefined) || window.location.origin).replace(/\/$/, '');
    return `${base}/join?pin=${host.session?.pin ?? ''}`;
  }, [host.session?.pin]);

  useEffect(() => {
    if (!host.session?.pin) return;
    QRCode.toDataURL(joinUrl, {
      width: 320,
      margin: 1,
      color: { dark: '#1B3A6B', light: '#FFFFFF' },
      errorCorrectionLevel: 'M',
    })
      .then(setQr)
      .catch(() => setQr(''));
  }, [joinUrl, host.session?.pin]);

  useEffect(() => {
    if (host.state.phase === 'podium' && host.reportId) {
      // report is saved by the hook; keep the podium on screen
    }
  }, [host.state.phase, host.reportId]);

  if (host.error) {
    return (
      <div className="page-tight py-16 text-center">
        <div className="text-5xl">🦅</div>
        <h1 className="font-display text-2xl font-bold text-navy-700 mt-3">{host.error}</h1>
        <Btn className="mt-4" onClick={() => nav('/teacher/library')}>
          Back to the library
        </Btn>
      </div>
    );
  }

  if (!host.session) {
    return (
      <div className="page-tight py-16 grid place-items-center">
        <Spinner size={30} />
      </div>
    );
  }

  const mode = modeById(host.session.mode);
  const { phase, players } = host.state;
  const total = host.quizQuestions.length;
  const q = host.current;
  const revealed = phase === 'reveal' || phase === 'break';

  const copy = async () => {
    const ok = await copyToClipboard(joinUrl);
    setCopied(ok);
    notify(ok ? 'Join link copied' : 'Could not copy — use the PIN', ok ? 'success' : 'error');
    setTimeout(() => setCopied(false), 2000);
  };

  const teamScores = (() => {
    const counts = new Array(host.session!.settings.teamCount).fill(0);
    for (const p of players) {
      const t = p.team ?? 0;
      if (t < counts.length) counts[t] += p.score;
    }
    return counts;
  })();

  const bubbleNames = host.session.settings.hideNames;

  return (
    <div className="arcade-shell min-h-dvh pb-8">
      {/* top bar */}
      <div className="flex flex-wrap items-center gap-3 border-b border-white/10 px-4 py-3">
        <Logo size={38} withText light />
        <span className="chip bg-gold-500/20 text-gold-300">
          {mode.emoji} {mode.name}
        </span>
        <span className="chip bg-white/10 text-white/70">{host.session.quizTitle}</span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <span className="rounded-xl bg-white/10 px-3 py-2 font-display text-sm font-bold tracking-[0.2em] text-white">
            PIN {host.session.pin}
          </span>
          {phase !== 'lobby' && (
            <>
              <button
                onClick={host.state.paused ? host.resume : host.pause}
                className="rounded-xl bg-white/10 px-3 py-2 text-sm font-bold text-white hover:bg-white/20"
              >
                {host.state.paused ? '▶ Resume' : '⏸ Pause'}
              </button>
              <button
                onClick={host.skip}
                className="rounded-xl bg-white/10 px-3 py-2 text-sm font-bold text-white hover:bg-white/20"
              >
                ⏭ {phase === 'question' ? 'Reveal' : phase === 'reveal' || phase === 'break' ? 'Next question' : 'Skip'}
              </button>
            </>
          )}
          {phase !== 'podium' && (
            <button
              onClick={() => setConfirmEnd(true)}
              className="rounded-xl bg-red-500/20 px-3 py-2 text-sm font-bold text-red-200 hover:bg-red-500/30"
            >
              ⏹ End
            </button>
          )}
        </div>
      </div>

      {/* reactions */}
      <div className="pointer-events-none fixed inset-x-0 bottom-20 z-30 flex justify-center">
        <AnimatePresence>
          {host.state.reactions.slice(-6).map((r) => (
            <motion.div
              key={r.at}
              initial={{ opacity: 0, y: 30, scale: 0.8 }}
              animate={{ opacity: 1, y: -60, scale: 1 }}
              exit={{ opacity: 0, y: -120 }}
              transition={{ duration: 1.8 }}
              className="mx-1 rounded-2xl bg-white/10 px-3 py-2 text-center backdrop-blur"
              onAnimationComplete={() => host.removeReaction(r.at)}
            >
              <div className="text-3xl">{r.emoji}</div>
              <div className="text-[10px] font-bold text-white/70">{bubbleNames ? 'Eagle' : r.name}</div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* LOBBY */}
      {phase === 'lobby' && (
        <div className="mx-auto grid max-w-6xl gap-5 px-4 py-6 lg:grid-cols-[1fr_360px]">
          <div className="glass p-6 text-center">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-gold-300">Join at {window.location.host}/join</p>
            <div className="mt-2 font-display text-6xl sm:text-7xl font-bold tracking-[0.18em] text-white">
              {host.session.pin}
            </div>
            <p className="mt-2 text-white/60">Enter the PIN, pick an eagle and you&apos;re in.</p>

            <div className="mt-5 flex flex-wrap items-center justify-center gap-4">
              {qr && (
                <div className="rounded-2xl bg-white p-2">
                  <img src={qr} alt={`QR code to join game ${host.session.pin}`} width={180} height={180} />
                </div>
              )}
              <div className="text-left text-sm text-white/70">
                <p className="font-bold text-white">Scan with a phone camera</p>
                <p className="mt-1 max-w-[220px] text-xs">
                  Works on school Wi-Fi. No account needed for guests — first name only.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Btn size="sm" variant="ghost" onClick={copy}>
                    {copied ? '✓ Copied' : '🔗 Copy link'}
                  </Btn>
                  <Btn size="sm" variant="ghost" onClick={() => window.open(joinUrl, '_blank', 'noopener')}>
                    Open player tab
                  </Btn>
                </div>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-3 text-left">
              <div className="flex items-center justify-between">
                <h3 className="font-display font-bold text-white">Ready to play · {players.length}</h3>
                <button
                  onClick={() => setShowPlayers((v) => !v)}
                  className="text-xs font-bold text-white/60 hover:text-white"
                >
                  {showPlayers ? 'Hide' : 'Show'} players
                </button>
              </div>
              {showPlayers && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {players.length === 0 && (
                    <p className="text-sm text-white/50">Waiting for the first learner… share the PIN or QR code.</p>
                  )}
                  {players.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center gap-2 rounded-xl bg-white/10 px-2 py-1.5"
                      title={p.name}
                    >
                      <Avatar id={p.avatarId} size={26} />
                      <span className="max-w-[110px] truncate text-sm font-bold text-white">{bubbleNames ? 'Eagle' : p.name}</span>
                      <button
                        onClick={() => host.kick(p.id)}
                        aria-label={`Remove ${p.name}`}
                        className="text-white/40 hover:text-red-300"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Btn variant="gold" size="lg" onClick={host.start} disabled={total === 0}>
                Start game · {total} questions
              </Btn>
              <Link to="/teacher/library">
                <Btn variant="ghost">Cancel</Btn>
              </Link>
            </div>
            {players.length === 0 && (
              <p className="mt-3 text-xs text-gold-300">
                Tip: open the player tab above to test with a guest name — it works side by side on this device.
              </p>
            )}
          </div>

          <div className="space-y-4">
            <div className="glass p-4">
              <h3 className="font-display font-bold text-white">Game settings</h3>
              <div className="mt-2 text-white">
                <Toggle
                  label="Lock lobby"
                  description="No new joins after the start"
                  checked={host.session.settings.lockLobby}
                  onChange={host.setLockLobby}
                />
                <Toggle
                  label="Hide player names"
                  description="Show Eagle 1…N on the leaderboard"
                  checked={host.session.settings.hideNames}
                  onChange={host.setHideNames}
                />
              </div>
              <div className="mt-2 space-y-1 border-t border-white/10 pt-2 text-xs text-white/60">
                <p>Arcade breaks: {host.session.settings.arcadeEnabled ? `${host.session.settings.breakDurationSec}s` : 'off'}</p>
                <p>Trigger: {host.session.settings.trigger.replace('_', ' ')}</p>
                <p>Shuffle questions: {host.session.settings.shuffleQuestions ? 'yes' : 'no'}</p>
              </div>
            </div>
            <div className="glass p-4">
              <h3 className="font-display font-bold text-white">Learners can sign in too</h3>
              <p className="mt-1 text-xs text-white/60">
                Logged-in learners keep their Eagle Coins and XP after the game. Guests play for the leaderboard only.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* QUESTION / REVEAL / BREAK */}
      {(phase === 'question' || phase === 'reveal' || phase === 'break') && q && (
        <div className="mx-auto max-w-6xl px-4 py-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-white/70">
              <span className="chip bg-white/10">
                Question {host.state.index + 1} / {total}
              </span>
              <span className="chip bg-white/10">{q.points} points</span>
              {q.topic && <span className="chip bg-teal-500/20 text-teal-200">{q.topic}</span>}
            </div>
            <div className="flex items-center gap-2">
              {host.state.paused ? (
                <span className="chip bg-gold-500/20 text-gold-200">⏸ Paused</span>
              ) : (
                <CountdownRing
                  remaining={host.remainingMs / 1000}
                  total={q.timeLimit}
                  size={58}
                  label={`${Math.ceil(host.remainingMs / 1000)}`}
                />
              )}
              <span className="chip bg-white/10 text-white/70">
                {host.answeredCount} / {players.filter((p) => !p.kicked).length} answered
              </span>
            </div>
          </div>

          <div className="mt-3 grid gap-4 lg:grid-cols-[1fr_300px]">
            <div className="glass overflow-hidden">
              <div className="p-5">
                <h2 className="font-display text-2xl sm:text-3xl font-bold leading-snug text-white">{q.text}</h2>
                {q.imageUrl && (
                  <div className="mt-3">
                    <ZoomableImage src={q.imageUrl} alt={q.imageAlt} className="max-h-[34vh] w-full bg-white/5" />
                  </div>
                )}
              </div>
              <div className="grid gap-2 border-t border-white/10 p-4 sm:grid-cols-2">
                {q.options.map((o, i) => {
                  const isCorrect = host.correctIndex === i;
                  const count = host.answerCounts[i] ?? 0;
                  const pct = host.answeredCount ? (count / host.answeredCount) * 100 : 0;
                  return (
                    <div
                      key={o.id}
                      className={`relative overflow-hidden rounded-2xl border p-3 ${
                        revealed
                          ? isCorrect
                            ? 'border-sage-500 bg-sage-500/25'
                            : 'border-white/10 bg-white/5 opacity-70'
                          : 'border-white/15 bg-white/10'
                      }`}
                    >
                      <div className="relative z-10 flex items-start gap-2">
                        <span
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${
                            revealed && isCorrect ? 'bg-sage-500 text-white' : 'bg-white/15 text-white/80'
                          }`}
                        >
                          {revealed && isCorrect ? '✓' : 'ABCD'[i]}
                        </span>
                        <span className="min-w-0 flex-1 font-semibold text-white">
                          {o.imageUrl && (
                            <img
                              src={o.imageUrl}
                              alt={o.imageAlt || ''}
                              className="mb-2 max-h-24 w-full rounded-lg object-cover"
                              loading="lazy"
                            />
                          )}
                          {o.text}
                        </span>
                        {revealed && (
                          <span className="ml-auto text-xs font-bold text-white/60">
                            {count}
                          </span>
                        )}
                      </div>
                      {revealed && (
                        <div
                          className="absolute bottom-0 left-0 h-1.5 bg-white/40 transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
              {revealed && (
                <div className="border-t border-white/10 p-4">
                  <p className="text-sm text-white/80">
                    <span className="font-bold text-gold-300">Why: </span>
                    {q.topic ? `${q.topic}. ` : ''}
                    {host.state.phase === 'break'
                      ? 'Correct players are in the arcade now — everyone re-syncs after the break.'
                      : 'Reveal the answer, then unlock the arcade for correct players.'}
                  </p>
                  {host.current?.explanation && (
                    <p className="mt-1 text-sm text-white/60">{host.current.explanation}</p>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div className="glass p-3">
                <h3 className="font-display text-sm font-bold text-white">Leaderboard</h3>
                <div className="mt-2 space-y-1.5">
                  {host.leaderboard.slice(0, 8).map((p, i) => (
                    <div key={p.id} className="flex items-center gap-2">
                      <span className="w-5 text-center text-xs font-bold text-gold-300">{i + 1}</span>
                      <Avatar id={p.avatarId} size={26} />
                      <span className="min-w-0 flex-1 truncate text-sm text-white/90">
                        {bubbleNames ? `Eagle ${i + 1}` : p.name}
                        {p.streak >= 2 && <span className="ml-1 text-xs text-gold-300">🔥{p.streak}</span>}
                      </span>
                      <span className="text-sm font-bold text-white">{p.score.toLocaleString()}</span>
                      <button
                        onClick={() => host.kick(p.id)}
                        className="text-white/20 hover:text-red-300"
                        aria-label={`Remove ${p.name}`}
                        title="Kick player"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  {host.leaderboard.length === 0 && <p className="text-xs text-white/50">No players yet.</p>}
                </div>
              </div>

              {host.session.mode === 'team_battle' && (
                <div className="glass p-3">
                  <h3 className="font-display text-sm font-bold text-white">Teams</h3>
                  <div className="mt-2 space-y-2">
                    {teamScores.map((score, i) => (
                      <div key={i}>
                        <div className="flex justify-between text-xs font-bold text-white/80">
                          <span>{TEAM_NAMES[i]}</span>
                          <span>{score.toLocaleString()}</span>
                        </div>
                        <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/10">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.min(100, (score / Math.max(1, Math.max(...teamScores))) * 100)}%`,
                              background: TEAM_COLORS[i],
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="mt-2 text-[11px] text-white/50">Class co-op: every team point chips away at the boss bar.</p>
                  <div className="mt-1 h-3 w-full overflow-hidden rounded-full border border-white/20 bg-white/5">
                    <div
                      className="h-full bg-gradient-to-r from-teal-400 to-gold-500"
                      style={{
                        width: `${Math.min(100, (teamScores.reduce((a, b) => a + b, 0) / (total * 900 * Math.max(1, players.length) * 0.6)) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              )}

              {host.session.mode === 'cipher_crack' && (
                <div className="glass p-3">
                  <h3 className="font-display text-sm font-bold text-white">Cipher word</h3>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {CIPHER_WORD.split('').map((ch, i) => (
                      <span
                        key={i}
                        className={`flex h-8 w-7 items-center justify-center rounded-lg text-sm font-bold ${
                          i < (host.state.players.reduce((a, p) => a + p.correct, 0) / 2)
                            ? 'bg-gold-500 text-navy-900'
                            : 'bg-white/10 text-white/30'
                        }`}
                      >
                        {i < host.state.players.reduce((a, p) => a + p.correct, 0) / 2 ? ch : '•'}
                      </span>
                    ))}
                  </div>
                  <p className="mt-2 text-[11px] text-white/50">Two correct answers reveal one letter.</p>
                </div>
              )}

              {phase === 'break' && (
                <div className="glass border-gold-500/40 p-3">
                  <h3 className="font-display text-sm font-bold text-gold-300">🎮 Arcade break</h3>
                  <p className="mt-1 text-xs text-white/70">
                    {Object.keys(host.state.tokens).length} player(s) earned a pass · {Math.ceil((host.state.breakEndsAt - Date.now()) / 1000)}s left
                  </p>
                  <p className="mt-2 text-[11px] text-white/50">
                    Everyone else sees the explanation card. The game re-syncs automatically.
                  </p>
                </div>
              )}

              {host.state.events.length > 0 && (
                <div className="glass p-3">
                  <h3 className="font-display text-sm font-bold text-white">Live events</h3>
                  {host.state.events.map((e) => (
                    <p key={e} className="mt-1 text-xs text-gold-200">• {e}</p>
                  ))}
                </div>
              )}
            </div>
          </div>

          {host.state.paused && (
            <div className="fixed inset-0 z-40 grid place-items-center bg-arcade-900/70 backdrop-blur">
              <div className="glass p-6 text-center">
                <p className="font-display text-2xl font-bold text-white">Game paused</p>
                <p className="mt-1 text-sm text-white/60">Timers are frozen on every player&apos;s screen.</p>
                <Btn variant="gold" className="mt-4" onClick={host.resume}>
                  Resume game
                </Btn>
              </div>
            </div>
          )}
        </div>
      )}

      {/* PODIUM */}
      {phase === 'podium' && (
        <div className="mx-auto max-w-4xl px-4 py-8 text-center">
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-white">🏆 Final results</h1>
          <p className="mt-1 text-white/60">{host.session.quizTitle} · {host.session.settings.hideNames ? 'names hidden' : `${players.length} players`}</p>

          <div className="mt-8 flex items-end justify-center gap-3">
            {[1, 0, 2].map((rank) => {
              const p = host.leaderboard[rank];
              if (!p) return <div key={rank} className="w-24" />;
              const heights = ['h-28', 'h-40', 'h-20'];
              const medals = ['🥈', '🥇', '🥉'];
              return (
                <motion.div
                  key={p.id}
                  initial={{ y: 30, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.2 + rank * 0.15 }}
                  className="flex w-28 flex-col items-center"
                >
                  <div className="text-3xl">{medals[rank]}</div>
                  <Avatar id={p.avatarId} size={56} ring />
                  <p className="mt-1 max-w-[110px] truncate text-sm font-bold text-white">
                    {bubbleNames ? `Eagle ${rank + 1}` : p.name}
                  </p>
                  <p className="font-display text-lg font-bold text-gold-300">{p.score.toLocaleString()}</p>
                  <div className={`mt-1 w-full rounded-t-xl bg-white/10 ${heights[rank]}`} />
                </motion.div>
              );
            })}
          </div>

          <div className="mt-6 glass p-4 text-left">
            <h3 className="font-display font-bold text-white">Full leaderboard</h3>
            <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
              {host.leaderboard.map((p, i) => (
                <div key={p.id} className="flex items-center gap-2 rounded-xl bg-white/5 px-2 py-1.5">
                  <span className="w-5 text-center text-xs font-bold text-white/50">{i + 1}</span>
                  <Avatar id={p.avatarId} size={26} />
                  <span className="min-w-0 flex-1 truncate text-sm text-white/90">
                    {bubbleNames ? `Eagle ${i + 1}` : p.name}
                  </span>
                  <span className="text-xs text-white/50">
                    {p.correct}/{p.total}
                  </span>
                  <span className="text-sm font-bold text-white">{p.score.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {host.reportId && (
              <Btn variant="gold" onClick={() => nav(`/teacher/report/${host.reportId}`)}>
                📊 Open post-game report
              </Btn>
            )}
            <Btn variant="ghost" onClick={() => nav('/teacher/gradebook')}>
              Go to gradebook
            </Btn>
            <Btn variant="ghost" onClick={() => nav('/teacher/library')}>
              Back to library
            </Btn>
          </div>
          <p className="mt-4 text-xs text-white/40">
            The report was saved automatically with per-question analysis.
          </p>
        </div>
      )}

      <ConfirmDialog
        open={confirmEnd}
        title="End the game now?"
        body="Scores are saved to a post-game report. Players will see the podium."
        confirmLabel="End game"
        destructive
        onCancel={() => setConfirmEnd(false)}
        onConfirm={() => {
          setConfirmEnd(false);
          host.end();
        }}
      />
    </div>
  );
};
