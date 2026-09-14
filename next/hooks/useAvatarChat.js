'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { openAvatarSession } from '@/lib/avatarChat';
import { profile } from '@/lib/profile';

const EMAIL = profile.email;

const CONNECT_ERROR = `I couldn't reach my own backend just then. Try again in a moment, or email me at ${EMAIL}.`;
const SEND_ERROR = `That didn't send - the connection dropped. Try again, or email me at ${EMAIL}.`;
const RATE_LIMIT_ERROR = `That's a lot of questions at once. Give it a minute, or email me at ${EMAIL}.`;
const EXPIRED_ERROR = 'That chat session expired. Reload the page and ask again.';

/**
 * A stream that produces nothing for this long is treated as dead. The worker
 * publishes a terminal event on every path it can reach, so silence past this
 * point means the job itself died - and the visitor should not be left with a
 * cursor blinking forever.
 */
const STALL_TIMEOUT_MS = 45000;

/**
 * @typedef {{ text: string, error: string | null, duplicate?: boolean }} AskResult
 */
/**
 * @param {{ initialSuggestions?: string[] }} [options]
 */
export function useAvatarChat({ initialSuggestions = [] } = {}) {
  const [status, setStatus] = useState('idle'); // idle | thinking | streaming | error
  const [answer, setAnswer] = useState('');
  // Refreshed by the server after each answer. Falls back to whatever is
  // already on screen, so a failed or slow refresh is invisible.
  const [suggestions, setSuggestions] = useState(initialSuggestions);

  const sessionRef = useRef(null);
  const stallTimerRef = useRef(null);
  const settleRef = useRef(null);
  // The resolved value has to come from a ref: `answer` state is stale inside
  // the callbacks that finish a stream.
  const answerRef = useRef('');

  const clearStallTimer = useCallback(() => {
    if (stallTimerRef.current) {
      clearTimeout(stallTimerRef.current);
      stallTimerRef.current = null;
    }
  }, []);

  /** Ends the current exchange and hands the outcome back to the caller. */
  const settle = useCallback((nextStatus, error = null) => {
    clearStallTimer();
    setStatus(nextStatus);

    const resolve = settleRef.current;
    settleRef.current = null;
    resolve?.({ text: answerRef.current, error });
  }, [clearStallTimer]);

  const armStallTimer = useCallback(() => {
    clearStallTimer();
    stallTimerRef.current = setTimeout(() => settle('error', SEND_ERROR), STALL_TIMEOUT_MS);
  }, [clearStallTimer, settle]);

  const ensureSession = useCallback(async () => {
    if (sessionRef.current) return sessionRef.current;

    sessionRef.current = await openAvatarSession({
      onDelta: (delta) => {
        armStallTimer();
        answerRef.current += delta;
        setStatus('streaming');
        setAnswer(answerRef.current);
      },
      onDone: () => settle('idle'),
      onFailed: (message) => settle('error', message || SEND_ERROR),
      onSuggestions: (questions) => setSuggestions(questions),
    });

    return sessionRef.current;
  }, [armStallTimer, settle]);

  /**
   * Asks one question and resolves when the answer is complete or has failed.
   * @returns {Promise<AskResult>}
   */
  const ask = useCallback(async (text) => {
    answerRef.current = '';
    setAnswer('');
    setStatus('thinking');
    armStallTimer();

    try {
      const session = await ensureSession();
      const result = await session.send(text);

      // The server recognised this as a repeat and queued nothing, so no
      // terminal event is coming. Settle here or the UI waits for a stream
      // that will never start.
      if (result?.status === 'duplicate') {
        clearStallTimer();
        setStatus('idle');

        return { text: '', error: null, duplicate: true, notice: result.message };
      }
    } catch (e) {
      // A 410 means the session id is no longer known to the server; drop it so
      // the next question opens a fresh one instead of failing forever.
      const hadSession = sessionRef.current !== null;
      if (e.status === 410) sessionRef.current = null;

      const message = e.status === 429 ? RATE_LIMIT_ERROR
        : e.status === 410 ? EXPIRED_ERROR
          : hadSession ? SEND_ERROR : CONNECT_ERROR;

      clearStallTimer();
      setStatus('error');

      return { text: '', error: message };
    }

    return new Promise((resolve) => { settleRef.current = resolve; });
  }, [armStallTimer, clearStallTimer, ensureSession]);

  useEffect(() => () => {
    clearStallTimer();
    sessionRef.current?.close();
    sessionRef.current = null;
  }, [clearStallTimer]);

  return {
    ask,
    answer,
    status,
    suggestions,
    busy: status === 'thinking' || status === 'streaming',
  };
}
