import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../store/AppStore';
import type { GamePlayer, GameReport, GameSession, Question } from '../types';
import { issueArcadeToken, sessionSecret, type ArcadeToken } from '../arcade/tokens';
import { scoreAnswer, CIPHER_WORD } from './scoring';
import {
  toPublicPlayer,
  type HostEvent,
  type LiveWire,
  type LivePhase,
} from './protocol';
import { shuffle, uid, yearBand } from '../lib/utils';
import { presentQuestion, type PresentedQuestion } from './present';
import { REACTIONS } from '../lib/profanity';

interface AnswerRecord {
  optionIndex: number;
  ms: number;
  correct: boolean;
}

interface HostState {
  phase: LivePhase;
  index: number;
  questionStartedAt: number;
  questionEndsAt: number;
  revealEndsAt: number;
  breakEndsAt: number;
  paused: boolean;
  pausedAt: number;
  players: GamePlayer[];
  logs: Record<string, Record<string, AnswerRecord>>;
  tokens: Record<string, ArcadeToken>;
  events: string[];
  reactions: Array<{ emoji: string; name: string; at: number }>;
}

const REVEAL_MS = 6500;

const emptyState = (): HostState => ({
  phase: 'lobby',
  index: -1,
  questionStartedAt: 0,
  questionEndsAt: 0,
  revealEndsAt: 0,
  breakEndsAt: 0,
  paused: false,
  pausedAt: 0,
  players: [],
  logs: {},
  tokens: {},
  events: [],
  reactions: [],
});

export interface HostGameApi {
  session: GameSession | null;
  quizQuestions: Question[];
  current: Question | null;
  state: HostState;
  wire: LiveWire | null;
  ready: boolean;
  error: string | null;
  remainingMs: number;
  totalRemainingMs: number;
  start: () => void;
  skip: () => void;
  pause: () => void;
  resume: () => void;
  end: () => void;
  kick: (playerId: string) => void;
  setLockLobby: (locked: boolean) => void;
  setHideNames: (hidden: boolean) => void;
  removeReaction: (at: number) => void;
  leaderboard: GamePlayer[];
  answeredCount: number;
  answerCounts: number[];
  correctIndex?: number;
  reportId: string | null;
}

export const useHostGame = (sessionId: string): HostGameApi => {
  const { db, saveSession, savePlayers, saveReport, createChannel } = useApp();
  const initialSession = useMemo(
    () => db.sessions.find((s) => s.id === sessionId) ?? null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sessionId],
  );
  const [session, setSession] = useState<GameSession | null>(initialSession);
  const [state, setState] = useState<HostState>(emptyState);
  const [wire, setWire] = useState<LiveWire | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reportId, setReportId] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const channelRef = useRef<ReturnType<typeof createChannel> | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const secret = sessionSecret(sessionId);
  const endingRef = useRef(false);

  const quiz = useMemo(
    () => (session ? db.quizzes.find((q) => q.id === session.quizId) ?? null : null),
    [db.quizzes, session],
  );

  const questions = useMemo<Question[]>(() => {
    if (!quiz || !session) return [];
    const map = new Map(quiz.questions.map((q) => [q.id, q]));
    const ordered = session.questionOrder.map((id) => map.get(id)).filter(Boolean) as Question[];
    if (ordered.length) return ordered;
    return session.settings.shuffleQuestions ? shuffle(quiz.questions) : quiz.questions;
  }, [quiz, session]);

  const current = state.index >= 0 ? questions[state.index] ?? null : null;

  const presentations = useMemo<Record<string, PresentedQuestion>>(() => {
    const map: Record<string, PresentedQuestion> = {};
    const shuffleAnswers = session?.settings.shuffleAnswers ?? false;
    for (const q of questions) map[q.id] = presentQuestion(q, sessionId, shuffleAnswers);
    return map;
  }, [questions, session?.settings.shuffleAnswers, sessionId]);

  /* -------------------------------- publish -------------------------------- */
  const buildWire = useCallback(
    (s: HostState): LiveWire => {
      const q = s.index >= 0 ? questions[s.index] : null;
      const presented = q ? presentations[q.id] : null;
      const optionCount = presented?.publicQuestion.options.length ?? 4;
      const answerCounts = new Array(optionCount).fill(0);
      if (q) {
        const log = s.logs[q.id] ?? {};
        for (const rec of Object.values(log)) {
          if (rec.optionIndex >= 0 && rec.optionIndex < answerCounts.length) answerCounts[rec.optionIndex]++;
        }
      }
      const totalCorrect = s.players.reduce((sum, p) => sum + p.correct, 0);
      return {
        sessionId,
        pin: sessionRef.current?.pin ?? '',
        quizTitle: sessionRef.current?.quizTitle ?? quiz?.title ?? '',
        mode: sessionRef.current?.mode ?? 'classic',
        settings:
          sessionRef.current?.settings ?? {
            shuffleQuestions: false,
            shuffleAnswers: false,
            hideNames: false,
            lockLobby: false,
            arcadeEnabled: true,
            breakDurationSec: 60,
            allowedGames: [],
            trigger: 'every',
            teamCount: 2,
          },
        phase: s.phase,
        index: s.index,
        total: questions.length,
        question: presented ? presented.publicQuestion : null,
        questionEndsAt: s.questionEndsAt,
        revealEndsAt: s.revealEndsAt,
        breakEndsAt: s.breakEndsAt,
        correctIndex:
          (s.phase === 'reveal' || s.phase === 'break' || s.phase === 'podium') && presented
            ? presented.correctIndex
            : undefined,
        explanation: s.phase === 'reveal' || s.phase === 'break' ? q?.explanation : undefined,
        players: s.players.map(toPublicPlayer),
        answerCounts,
        answeredCount: q ? Object.keys(s.logs[q.id] ?? {}).length : 0,
        paused: s.paused,
        pausedRemainingMs: s.paused ? Math.max(0, s.questionEndsAt - s.pausedAt) : 0,
        hideNames: sessionRef.current?.settings.hideNames ?? false,
        yearGroup: quiz?.yearGroup ?? 5,
        allowedGames: sessionRef.current?.settings.allowedGames ?? [],
        tokens: s.tokens,
        cipherProgress:
          sessionRef.current?.mode === 'cipher_crack' ? Math.min(CIPHER_WORD.length, Math.floor(totalCorrect / 2)) : undefined,
        serverNow: Date.now(),
      };
    },
    [presentations, questions, quiz?.title, sessionId],
  );

  const publish = useCallback(
    (s: HostState) => {
      const w = buildWire(s);
      setWire(w);
      channelRef.current?.send('snapshot', w);
    },
    [buildWire],
  );

  const persistSession = useCallback(
    (patch: Partial<GameSession>) => {
      const cur = sessionRef.current;
      if (!cur) return;
      const next = { ...cur, ...patch };
      sessionRef.current = next;
      setSession(next);
      void saveSession(next);
    },
    [saveSession],
  );

  /* ------------------------------ transitions ------------------------------ */
  const enterQuestion = useCallback(
    (s: HostState, index: number): HostState => {
      if (index >= questions.length) {
        persistSession({ status: 'podium', endedAt: new Date().toISOString() });
        return { ...s, phase: 'podium', index: questions.length, paused: false };
      }
      const q = questions[index];
      const now = Date.now();
      persistSession({ status: 'live', currentIndex: index, phaseStartedAt: now });
      return {
        ...s,
        phase: 'question',
        index,
        questionStartedAt: now,
        questionEndsAt: now + q.timeLimit * 1000,
        revealEndsAt: 0,
        breakEndsAt: 0,
        paused: false,
        pausedAt: 0,
        tokens: {},
      };
    },
    [persistSession, questions],
  );

  const enterReveal = useCallback(
    (s: HostState): HostState => {
      const now = Date.now();
      persistSession({ status: 'reveal', phaseStartedAt: now });
      return { ...s, phase: 'reveal', revealEndsAt: now + REVEAL_MS, paused: false };
    },
    [persistSession],
  );

  const enterBreak = useCallback(
    async (s: HostState): Promise<HostState> => {
      const q = questions[s.index];
      const settings = sessionRef.current?.settings;
      if (!q || !settings?.arcadeEnabled) return enterReveal(s);
      const correctIds = Object.entries(s.logs[q.id] ?? {})
        .filter(([, rec]) => rec.correct)
        .map(([id]) => id);
      const triggerOk =
        settings.trigger === 'every'
          ? correctIds.length > 0
          : settings.trigger === 'every_2'
            ? correctIds.some((id) => {
                const p = s.players.find((pl) => pl.id === id);
                return p ? p.correct % 2 === 0 : false;
              })
            : correctIds.some((id) => {
                const p = s.players.find((pl) => pl.id === id);
                return p ? p.streak >= 3 : false;
              });
      if (!correctIds.length || !triggerOk) return enterReveal(s);
      const now = Date.now();
      const tokens: Record<string, ArcadeToken> = {};
      for (const id of correctIds) {
        tokens[id] = await issueArcadeToken(
          {
            playerId: id,
            sessionId,
            questionId: q.id,
            gameId: 'any',
            durationSec: settings.breakDurationSec,
          },
          secret,
        );
      }
      persistSession({ status: 'break', phaseStartedAt: now });
      return {
        ...s,
        phase: 'break',
        breakEndsAt: now + settings.breakDurationSec * 1000,
        revealEndsAt: now + REVEAL_MS,
        tokens,
      };
    },
    [enterReveal, persistSession, questions, secret, sessionId],
  );

  const advance = useCallback(async () => {
    const s = stateRef.current;
    if (s.phase === 'lobby') {
      const next = enterQuestion(s, 0);
      setState(next);
      publish(next);
      return;
    }
    if (s.phase === 'question') {
      const next = enterReveal(s);
      setState(next);
      publish(next);
      return;
    }
    if (s.phase === 'reveal' || s.phase === 'break') {
      const next = enterQuestion(s, s.index + 1);
      setState(next);
      publish(next);
      void savePlayers(s.players);
      return;
    }
    if (s.phase === 'podium') return;
  }, [enterQuestion, enterReveal, persistSession, publish, savePlayers]);

  /* ------------------------------ final report ----------------------------- */
  const finish = useCallback(async () => {
    if (endingRef.current) return;
    endingRef.current = true;
    const s = stateRef.current;
    const id = uid('report');
    const stats = questions.map((q) => {
      const log = s.logs[q.id] ?? {};
      const entries = Object.entries(log);
      const attempts = entries.length;
      const correctCount = entries.filter(([, r]) => r.correct).length;
      const wrongCounts = new Map<number, number>();
      for (const [, r] of entries) {
        if (!r.correct && r.optionIndex >= 0) wrongCounts.set(r.optionIndex, (wrongCounts.get(r.optionIndex) ?? 0) + 1);
      }
      let mostChosenWrong: { text: string; count: number } | undefined;
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
        avgMs: attempts ? Math.round(entries.reduce((a, [, r]) => a + r.ms, 0) / attempts) : 0,
        mostChosenWrong,
      };
    });

    const report: GameReport = {
      id,
      sessionId,
      quizId: sessionRef.current?.quizId ?? '',
      hostId: sessionRef.current?.hostId ?? '',
      mode: sessionRef.current?.mode ?? 'classic',
      title: `${sessionRef.current?.quizTitle ?? 'Live game'} (live)`,
      endedAt: new Date().toISOString(),
      players: s.players,
      questionStats: stats,
    };
    await saveReport(report);
    await savePlayers(s.players);
    persistSession({ status: 'ended', endedAt: new Date().toISOString(), reportId: id });
    setReportId(id);
    channelRef.current?.send('ended', { sessionId });
    const final: HostState = { ...s, phase: 'podium', paused: false };
    setState(final);
    publish(final);
  }, [persistSession, publish, questions, savePlayers, saveReport, sessionId]);

  /* --------------------------------- start --------------------------------- */
  useEffect(() => {
    if (!session) {
      setError('Game session not found. Open the lobby from the quiz library.');
      return;
    }
    if (!quiz) {
      setError('This quiz was deleted, so the game cannot start.');
      return;
    }
    const channel = createChannel(`live:${session.pin}`);
    channelRef.current = channel;
    const local: HostState = { ...emptyState(), phase: 'lobby' };
    setState(local);

    const onMessage = (e: { event: string; payload: unknown }) => {
      const msg = e as HostEvent;
      if (msg.event === 'hello') {
        const ticket = msg.payload.ticket;
        const s = stateRef.current;
        const exists = s.players.find((p) => p.id === ticket.playerId);
        if (exists) {
          const updated = { ...s, players: s.players.map((p) => (p.id === ticket.playerId ? { ...p, connected: true } : p)) };
          setState(updated);
          publish(updated);
          return;
        }
        const locked = sessionRef.current?.settings.lockLobby && s.phase !== 'lobby';
        if (locked) {
          channel.send('denied', { reason: 'The lobby is locked — this game has already started.', playerId: ticket.playerId });
          return;
        }
        if (s.players.length >= 200) {
          channel.send('denied', { reason: 'This game is full (200 players).', playerId: ticket.playerId });
          return;
        }
        const teamCount = sessionRef.current?.settings.teamCount ?? 2;
        const player: GamePlayer = {
          id: ticket.playerId,
          sessionId,
          name: ticket.name,
          avatarId: ticket.avatarId,
          team: s.players.length % Math.max(2, teamCount),
          isGuest: ticket.isGuest,
          profileId: ticket.profileId,
          score: 0,
          coins: 0,
          streak: 0,
          bestStreak: 0,
          correct: 0,
          total: 0,
          answers: [],
          connected: true,
        };
        const updated = { ...s, players: [...s.players, player] };
        setState(updated);
        publish(updated);
        void savePlayers([player]);
        return;
      }
      if (msg.event === 'answer') {
        const { playerId, questionId, optionIndex, ms } = msg.payload;
        const s = stateRef.current;
        const q = s.index >= 0 ? questions[s.index] : null;
        if (!q || s.phase !== 'question' || q.id !== questionId) return;
        const log = s.logs[q.id] ?? {};
        if (log[playerId]) return;
        const player = s.players.find((p) => p.id === playerId);
        if (!player || player.kicked) return;
        const presented = presentations[q.id];
        const correct = presented ? optionIndex === presented.correctIndex : optionIndex === q.correctIndex;
        const remainingRatio = Math.max(0, Math.min(1, (s.questionEndsAt - Date.now()) / (q.timeLimit * 1000)));
        const result = correct
          ? scoreAnswer({
              question: q,
              remainingRatio,
              streak: player.streak + 1,
              mode: sessionRef.current?.mode ?? 'classic',
              playerCount: s.players.length,
            })
          : { points: 0, coins: 0, event: undefined };
        const updatedPlayers = s.players.map((p) =>
          p.id === playerId
            ? {
                ...p,
                score: p.score + result.points,
                coins: p.coins + result.coins,
                streak: correct ? p.streak + 1 : 0,
                bestStreak: Math.max(p.bestStreak, correct ? p.streak + 1 : p.streak),
                correct: p.correct + (correct ? 1 : 0),
                total: p.total + 1,
                answers: [
                  ...p.answers,
                  {
                    questionId: q.id,
                    optionIndex,
                    correct,
                    ms,
                    points: result.points,
                    arcadeBonus: 0,
                  },
                ],
              }
            : p,
        );
        const updatedLogs = { ...s.logs, [q.id]: { ...log, [playerId]: { optionIndex, ms, correct } } };
        const events = result.event ? [result.event, ...s.events].slice(0, 4) : s.events;
        const updated: HostState = { ...s, players: updatedPlayers, logs: updatedLogs, events };
        setState(updated);
        publish(updated);
        return;
      }
      if (msg.event === 'bonus') {
        const { playerId, questionId, coins, gameId, durationMs } = msg.payload;
        const s = stateRef.current;
        const q = questions.find((qq) => qq.id === questionId);
        if (!q) return;
        const log = s.logs[q.id] ?? {};
        const rec = log[playerId];
        if (!rec || !rec.correct) return;
        if ((rec as AnswerRecord & { bonus?: number }).bonus) return;
        const bonus = Math.min(Math.round(q.points * 0.2), Math.max(0, Math.round(coins / 4)));
        const updatedPlayers = s.players.map((p) =>
          p.id === playerId
            ? {
                ...p,
                score: p.score + bonus,
                coins: p.coins + Math.max(0, Math.round(coins)),
                answers: p.answers.map((a) =>
                  a.questionId === q.id ? { ...a, arcadeBonus: a.arcadeBonus + bonus } : a,
                ),
              }
            : p,
        );
        const updatedLogs = {
          ...s.logs,
          [q.id]: {
            ...log,
            [playerId]: { ...rec, bonus } as AnswerRecord,
          },
        };
        const events = [
          `${updatedPlayers.find((p) => p.id === playerId)?.name ?? 'A player'} earned arcade bonus +${bonus}`,
          ...s.events,
        ].slice(0, 4);
        const updated = { ...s, players: updatedPlayers, logs: updatedLogs, events };
        setState(updated);
        publish(updated);
        void gameId;
        void durationMs;
        return;
      }
      if (msg.event === 'reaction') {
        const { playerId, emoji } = msg.payload;
        if (!(REACTIONS as readonly string[]).includes(emoji)) return;
        const player = stateRef.current.players.find((p) => p.id === playerId);
        if (!player) return;
        const reaction = { emoji, name: player.name, at: Date.now() };
        const updated = {
          ...stateRef.current,
          reactions: [...stateRef.current.reactions.slice(-14), reaction],
        };
        setState(updated);
        channel.send('reaction-broadcast', reaction);
        return;
      }
      if (msg.event === 'bye') {
        const { playerId } = msg.payload;
        const updated = {
          ...stateRef.current,
          players: stateRef.current.players.map((p) => (p.id === playerId ? { ...p, connected: false } : p)),
        };
        setState(updated);
      }
    };

    const unsub = channel.on(onMessage);
    publish(local);

    return () => {
      unsub();
      channel.close();
      channelRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id]);

  /* --------------------------- deadline heartbeat -------------------------- */
  useEffect(() => {
    const id = setInterval(() => {
      setTick((t) => t + 1);
      const s = stateRef.current;
      if (s.paused || endingRef.current) return;
      const now = Date.now();
      if (s.phase === 'question' && now >= s.questionEndsAt) {
        const next = enterReveal(s);
        setState(next);
        publish(next);
      } else if (s.phase === 'reveal' && now >= s.revealEndsAt) {
        if (sessionRef.current?.settings.arcadeEnabled) {
          void enterBreak(s).then((next) => {
            setState(next);
            publish(next);
          });
        } else {
          const next = enterQuestion(s, s.index + 1);
          setState(next);
          publish(next);
        }
      } else if (s.phase === 'break' && now >= s.breakEndsAt) {
        const next = enterQuestion(s, s.index + 1);
        setState(next);
        publish(next);
        void savePlayers(s.players);
      } else if (s.phase === 'podium' && !endingRef.current) {
        void finish();
      }
    }, 300);
    return () => clearInterval(id);
  }, [enterBreak, enterQuestion, enterReveal, finish, publish, savePlayers]);

  /* --------------------------------- actions -------------------------------- */
  const start = useCallback(() => {
    const s = stateRef.current;
    if (s.phase !== 'lobby' || !questions.length) return;
    const next = enterQuestion(s, 0);
    setState(next);
    publish(next);
    void savePlayers(s.players);
  }, [enterQuestion, publish, questions.length, savePlayers]);

  const skip = useCallback(() => void advance(), [advance]);

  const pause = useCallback(() => {
    const s = stateRef.current;
    if (s.paused) return;
    const next = { ...s, paused: true, pausedAt: Date.now() };
    setState(next);
    publish(next);
  }, [publish]);

  const resume = useCallback(() => {
    const s = stateRef.current;
    if (!s.paused) return;
    const delta = Date.now() - s.pausedAt;
    const next = {
      ...s,
      paused: false,
      questionEndsAt: s.questionEndsAt + delta,
      revealEndsAt: s.revealEndsAt + delta,
      breakEndsAt: s.breakEndsAt + delta,
    };
    setState(next);
    publish(next);
  }, [publish]);

  const end = useCallback(() => {
    const s = stateRef.current;
    const next: HostState = { ...s, phase: 'podium' };
    setState(next);
    publish(next);
    void finish();
  }, [finish, publish]);

  const kick = useCallback(
    (playerId: string) => {
      const s = stateRef.current;
      const next = {
        ...s,
        players: s.players.map((p) => (p.id === playerId ? { ...p, kicked: true, connected: false } : p)),
      };
      setState(next);
      publish(next);
      channelRef.current?.send('kicked', { playerId });
    },
    [publish],
  );

  const setLockLobby = useCallback(
    (locked: boolean) => {
      const cur = sessionRef.current;
      if (!cur) return;
      const next = { ...cur, settings: { ...cur.settings, lockLobby: locked } };
      sessionRef.current = next;
      setSession(next);
      void saveSession(next);
      publish(stateRef.current);
    },
    [publish, saveSession],
  );

  const setHideNames = useCallback(
    (hidden: boolean) => {
      const cur = sessionRef.current;
      if (!cur) return;
      const next = { ...cur, settings: { ...cur.settings, hideNames: hidden } };
      sessionRef.current = next;
      setSession(next);
      void saveSession(next);
      publish(stateRef.current);
    },
    [publish, saveSession],
  );

  const removeReaction = useCallback((at: number) => {
    setState((s) => ({ ...s, reactions: s.reactions.filter((r) => r.at !== at) }));
  }, []);

  /* --------------------------------- derived -------------------------------- */
  const now = Date.now();
  const remainingMs = state.paused
    ? Math.max(0, state.questionEndsAt - state.pausedAt)
    : Math.max(0, state.questionEndsAt - now);

  const totalRemainingMs = useMemo(() => {
    if (state.phase === 'lobby') return 0;
    const remainingQs = questions.slice(Math.max(0, state.index + 1));
    const sum = remainingQs.reduce((acc, q) => acc + q.timeLimit * 1000, 0);
    return sum + (state.phase === 'question' ? remainingMs : 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questions, state.phase, state.index, Math.round(remainingMs / 1000)]);

  const leaderboard = useMemo(
    () => [...state.players].filter((p) => !p.kicked).sort((a, b) => b.score - a.score),
    [state.players],
  );

  const answeredCount = current ? Object.keys(state.logs[current.id] ?? {}).length : 0;
  const answerCounts = useMemo(() => {
    if (!current) return [0, 0, 0, 0];
    const count = presentations[current.id]?.publicQuestion.options.length ?? current.options.length;
    const counts = new Array(count).fill(0);
    for (const rec of Object.values(state.logs[current.id] ?? {})) {
      if (rec.optionIndex >= 0 && rec.optionIndex < counts.length) counts[rec.optionIndex]++;
    }
    return counts;
  }, [current, presentations, state.logs]);

  void tick;
  void yearBand;

  const correctIndex =
    current && (state.phase === 'reveal' || state.phase === 'break' || state.phase === 'podium')
      ? presentations[current.id]?.correctIndex
      : undefined;

  return {
    session,
    quizQuestions: questions,
    current,
    state,
    wire,
    ready: Boolean(session && quiz),
    error,
    remainingMs,
    totalRemainingMs,
    start,
    skip,
    pause,
    resume,
    end,
    kick,
    setLockLobby,
    setHideNames,
    removeReaction,
    leaderboard,
    answeredCount,
    answerCounts,
    correctIndex,
    reportId,
  };
};
