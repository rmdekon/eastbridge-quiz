import { useCallback, useEffect, useRef, useState } from 'react';
import { useApp } from '../store/AppStore';
import type { LiveWire, HostEvent } from './protocol';
import { readTicket, type JoinTicket } from '../pages/Join';
import type { ArcadeToken } from '../arcade/tokens';
import { clamp } from '../lib/utils';

export interface PlayerGameApi {
  wire: LiveWire | null;
  ticket: JoinTicket | null;
  me: LiveWire['players'][number] | null;
  connected: boolean;
  denied: string | null;
  kicked: boolean;
  ended: boolean;
  myAnswer: number | null;
  answerLocked: boolean;
  isCorrect: boolean | null;
  remainingMs: number;
  myToken: ArcadeToken | null;
  chooseAnswer: (optionIndex: number) => void;
  sendReaction: (emoji: string) => boolean;
  sendBonus: (coins: number, gameId: string, durationMs: number) => void;
  leave: () => void;
  serverOffset: number;
}

export const usePlayerGame = (pin: string): PlayerGameApi => {
  const { createChannel } = useApp();
  const [wire, setWire] = useState<LiveWire | null>(null);
  const [ticket, setTicket] = useState<JoinTicket | null>(() => readTicket(pin));
  const [connected, setConnected] = useState(false);
  const [denied, setDenied] = useState<string | null>(null);
  const [kicked, setKicked] = useState(false);
  const [ended, setEnded] = useState(false);
  const [myAnswer, setMyAnswer] = useState<number | null>(null);
  const [answerQuestionId, setAnswerQuestionId] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const channelRef = useRef<ReturnType<typeof createChannel> | null>(null);
  const wireRef = useRef<LiveWire | null>(null);
  wireRef.current = wire;
  const reactionRef = useRef(0);

  useEffect(() => {
    const t = readTicket(pin);
    if (!t) {
      setDenied('We could not find your join details for this PIN.');
      return;
    }
    setTicket(t);
    const channel = createChannel(`live:${pin}`);
    channelRef.current = channel;

    const unsub = channel.on((e) => {
      const msg = e as HostEvent;
      if (msg.event === 'snapshot') {
        const w = msg.payload;
        setWire(w);
        setConnected(true);
        setDenied(null);
        const serverNow = w.serverNow ?? Date.now();
        setOffset(serverNow - Date.now());
        if (w.phase === 'podium') {
          // podium shown by the page, not an error
        }
      } else if (msg.event === 'denied') {
        if (!msg.payload.playerId || msg.payload.playerId === t.playerId) setDenied(msg.payload.reason);
      } else if (msg.event === 'kicked') {
        if (msg.payload.playerId === t.playerId) setKicked(true);
      } else if (msg.event === 'ended') {
        setEnded(true);
      }
    });

    const sayHello = () => {
      channel.send('hello', {
        ticket: {
          playerId: t.playerId,
          name: t.name,
          avatarId: t.avatarId,
          isGuest: t.isGuest,
          profileId: t.profileId,
        },
      });
    };
    sayHello();
    const helloInterval = setInterval(sayHello, 2000);

    return () => {
      unsub();
      clearInterval(helloInterval);
      channel.send('bye', { playerId: t.playerId });
      channel.close();
      channelRef.current = null;
    };
  }, [createChannel, pin]);

  // Reset the local answer when a new question arrives
  useEffect(() => {
    const q = wire?.question;
    if (q && q.id !== answerQuestionId && wire?.phase === 'question') {
      setAnswerQuestionId(q.id);
      setMyAnswer(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wire?.question?.id, wire?.phase]);

  const me = wire?.players.find((p) => p.id === ticket?.playerId) ?? null;

  const chooseAnswer = useCallback(
    (optionIndex: number) => {
      const w = wireRef.current;
      if (!w || !ticket || !w.question || w.phase !== 'question' || myAnswer !== null) return;
      const startLocal = w.questionEndsAt - w.question.timeLimit * 1000 - offset;
      const ms = clamp(Date.now() - startLocal, 200, w.question.timeLimit * 1000);
      setMyAnswer(optionIndex);
      channelRef.current?.send('answer', {
        playerId: ticket.playerId,
        questionId: w.question.id,
        optionIndex,
        ms,
      });
    },
    [myAnswer, offset, ticket],
  );

  const sendReaction = useCallback(
    (emoji: string) => {
      if (!ticket) return false;
      const now = Date.now();
      if (now - reactionRef.current < 1200) return false;
      reactionRef.current = now;
      channelRef.current?.send('reaction', { playerId: ticket.playerId, emoji });
      return true;
    },
    [ticket],
  );

  const sendBonus = useCallback(
    (coins: number, gameId: string, durationMs: number) => {
      const w = wireRef.current;
      if (!w || !ticket || !w.question) return;
      channelRef.current?.send('bonus', {
        playerId: ticket.playerId,
        questionId: w.question.id,
        coins,
        gameId,
        durationMs,
      });
    },
    [ticket],
  );

  const leave = useCallback(() => {
    if (ticket) channelRef.current?.send('bye', { playerId: ticket.playerId });
    channelRef.current?.close();
  }, [ticket]);

  const isCorrect =
    myAnswer !== null && wire?.correctIndex !== undefined && wire?.phase !== 'question'
      ? myAnswer === wire.correctIndex
      : null;

  const remainingMs = wire
    ? wire.paused
      ? wire.pausedRemainingMs
      : Math.max(0, wire.questionEndsAt - (Date.now() - offset))
    : 0;

  const myToken =
    wire && ticket && wire.phase === 'break' ? wire.tokens[ticket.playerId] ?? null : null;

  return {
    wire,
    ticket,
    me: me ?? null,
    connected,
    denied,
    kicked,
    ended,
    myAnswer,
    answerLocked: myAnswer !== null,
    isCorrect,
    remainingMs,
    myToken,
    chooseAnswer,
    sendReaction,
    sendBonus,
    leave,
    serverOffset: offset,
  };
};
