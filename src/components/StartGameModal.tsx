import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Btn, Field, Modal, Toggle } from './ui';
import { GAME_MODES, TEAM_NAMES } from '../data/modes';
import { MINIGAME_MANIFESTS } from '../minigames/registry';
import { useApp } from '../store/AppStore';
import { generatePin } from '../lib/codes';
import { cx, shuffle, uid } from '../lib/utils';
import type { GameModeId, GameSession, QuizSet } from '../types';

export const StartGameModal: React.FC<{
  quiz: QuizSet | null;
  open: boolean;
  onClose: () => void;
}> = ({ quiz, open, onClose }) => {
  const { db, user, saveSession, notify, minigamesDisabled } = useApp();
  const nav = useNavigate();
  const [mode, setMode] = useState<GameModeId>('classic');
  const [shuffleQuestions, setShuffleQuestions] = useState(true);
  const [shuffleAnswers, setShuffleAnswers] = useState(true);
  const [hideNames, setHideNames] = useState(false);
  const [lockLobby, setLockLobby] = useState(false);
  const [arcadeEnabled, setArcadeEnabled] = useState(true);
  const [breakDuration, setBreakDuration] = useState(60);
  const [trigger, setTrigger] = useState<'every' | 'every_2' | 'streak_3'>('every');
  const [allowedGames, setAllowedGames] = useState<string[]>([]);
  const [teamCount, setTeamCount] = useState(2);
  const [busy, setBusy] = useState(false);

  const start = async () => {
    if (!quiz || !user) return;
    setBusy(true);
    try {
      let pin = generatePin();
      const active = new Set(db.sessions.filter((s) => s.status !== 'ended').map((s) => s.pin));
      let guard = 0;
      while (active.has(pin) && guard++ < 40) pin = generatePin();
      const questionOrder = (shuffleQuestions ? shuffle(quiz.questions) : quiz.questions).map((q) => q.id);
      const session: GameSession = {
        id: uid('sess'),
        pin,
        quizId: quiz.id,
        quizTitle: quiz.title,
        hostId: user.id,
        mode,
        status: 'lobby',
        settings: {
          shuffleQuestions,
          shuffleAnswers,
          hideNames,
          lockLobby,
          arcadeEnabled,
          breakDurationSec: breakDuration,
          allowedGames,
          trigger,
          teamCount,
        },
        questionOrder,
        currentIndex: -1,
        phaseStartedAt: Date.now(),
        createdAt: new Date().toISOString(),
      };
      await saveSession(session);
      onClose();
      nav(`/host/${session.id}`);
    } catch (e) {
      notify((e as Error).message || 'Could not create the game', 'error');
    } finally {
      setBusy(false);
    }
  };

  const availableGames = MINIGAME_MANIFESTS.filter((g) => !minigamesDisabled.includes(g.id) && g.minYear <= (quiz?.yearGroup ?? 9));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={quiz ? `Host “${quiz.title}”` : 'Host a game'}
      size="lg"
      footer={
        <>
          <Btn variant="ghost" onClick={onClose}>
            Cancel
          </Btn>
          <Btn onClick={start} loading={busy}>
            Create game & open lobby
          </Btn>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <span className="label">Game mode</span>
          <div className="grid gap-2 sm:grid-cols-2">
            {GAME_MODES.map((m) => (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                aria-pressed={mode === m.id}
                className={cx(
                  'rounded-2xl border-2 p-3 text-left transition',
                  mode === m.id ? 'border-gold-500 bg-gold-100/40' : 'border-navy-100 bg-white hover:border-navy-300',
                )}
              >
                <span className="flex items-center gap-2 font-display font-bold text-navy-700">
                  <span className="text-xl" aria-hidden="true">
                    {m.emoji}
                  </span>
                  {m.name}
                </span>
                <span className="mt-0.5 block text-[11px] leading-snug text-navy-300">{m.blurb}</span>
              </button>
            ))}
          </div>
        </div>

        {mode === 'team_battle' && (
          <Field label="Number of teams" htmlFor="team-count">
            <div className="flex gap-2">
              {[2, 3, 4].map((n) => (
                <button
                  key={n}
                  onClick={() => setTeamCount(n)}
                  className={cx(
                    'flex-1 rounded-xl border px-3 py-2.5 text-sm font-bold',
                    teamCount === n ? 'border-navy-600 bg-navy-600 text-white' : 'border-navy-100 bg-white',
                  )}
                >
                  {n} teams
                </button>
              ))}
            </div>
          </Field>
        )}

        <div className="rounded-2xl border border-navy-100 p-3">
          <p className="label mb-1">The arcade break</p>
          <Toggle
            label="Enable arcade breaks"
            description="Only correct answers unlock a minigame pass."
            checked={arcadeEnabled}
            onChange={setArcadeEnabled}
          />
          {arcadeEnabled && (
            <>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                <Field label="Break length" htmlFor="break-len">
                  <select
                    id="break-len"
                    className="input"
                    value={breakDuration}
                    onChange={(e) => setBreakDuration(Number(e.target.value))}
                  >
                    {[15, 30, 45, 60, 90, 120, 180].map((s) => (
                      <option key={s} value={s}>
                        {s < 60 ? `${s} seconds` : `${s / 60} minute${s === 60 ? '' : 's'}`}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Unlock trigger" htmlFor="trigger">
                  <select
                    id="trigger"
                    className="input"
                    value={trigger}
                    onChange={(e) => setTrigger(e.target.value as typeof trigger)}
                  >
                    <option value="every">Every correct answer</option>
                    <option value="every_2">Every 2nd correct answer</option>
                    <option value="streak_3">On a streak of 3</option>
                  </select>
                </Field>
              </div>
              <div className="mt-2">
                <span className="label">Allowed games</span>
                <p className="hint mb-2">Leave all unchecked to let learners choose any enabled game.</p>
                <div className="flex flex-wrap gap-1.5">
                  {availableGames.map((g) => {
                    const on = allowedGames.includes(g.id);
                    return (
                      <button
                        key={g.id}
                        onClick={() =>
                          setAllowedGames((prev) => (on ? prev.filter((id) => id !== g.id) : [...prev, g.id]))
                        }
                        aria-pressed={on}
                        className={cx(
                          'rounded-full border px-3 py-1.5 text-xs font-bold transition',
                          on ? 'border-teal-500 bg-teal-500 text-white' : 'border-navy-100 bg-white text-navy-500',
                        )}
                      >
                        {g.emoji} {g.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="rounded-2xl border border-navy-100 p-3">
          <Toggle label="Shuffle questions" checked={shuffleQuestions} onChange={setShuffleQuestions} />
          <Toggle label="Shuffle answer positions" checked={shuffleAnswers} onChange={setShuffleAnswers} />
          <Toggle
            label="Hide learner names on the board"
            description="Shows “Eagle 1…N” instead of names — good for assemblies."
            checked={hideNames}
            onChange={setHideNames}
          />
          <Toggle
            label="Lock lobby after start"
            description="Late joiners will be turned away."
            checked={lockLobby}
            onChange={setLockLobby}
          />
        </div>
        {mode === 'team_battle' && (
          <p className="text-xs text-navy-300">
            Players are spread across {TEAM_NAMES.slice(0, teamCount).join(', ')} automatically.
          </p>
        )}
      </div>
    </Modal>
  );
};
