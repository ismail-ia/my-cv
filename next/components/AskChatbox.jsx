'use client';

import { useEffect, useRef, useState } from 'react';
import { useAvatarChat } from '@/hooks/useAvatarChat';
import { profile } from '@/lib/profile';

const EMAIL = profile.email;

// The opening set. After each answer the server proposes three new ones drawn
// from the same CV, so the chips follow the conversation instead of pointing
// back at the start of it.
const OPENING_SUGGESTIONS = [
  'Why keep a growing system monolith?',
  'Tell me about Eve',
  'Are you available?',
];

const INTRO =
  'Ask me about my skills, experience, architecture, AI work, or how I&rsquo;d approach what you&rsquo;re building.';

const esc = (s) =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const numerals = (s) =>
  s.replace(
    /(^|[^\w.@$])(\$?\d[\d,]*(?:\.\d+)?(?:M|K|%)?\+?)(?![\w@])/g,
    (m, pre, n) => `${pre}<span class="num">${n}</span>`,
  );

const linkify = (s) => s.replaceAll(EMAIL, `<a href="mailto:${EMAIL}">${EMAIL}</a>`);

// The agent's output is plain text by instruction, but it is model output all
// the same: escape first, then decorate. Nothing reaches innerHTML unescaped.
const renderHtml = (s) => linkify(numerals(esc(s)));

const CURSOR = '<span class="term-cursor">█</span>';

// The wait is a queue hop plus a model round trip, so it is always long enough
// to be worth showing and never so short that the indicator flashes. After a
// few seconds the label changes: a wait that is merely slow should not look
// like a wait that has died.
const SLOW_AFTER_MS = 7000;

export default function AskChatbox() {
  const { ask, answer, status, suggestions, busy } = useAvatarChat({
    initialSuggestions: OPENING_SUGGESTIONS,
  });

  const [history, setHistory] = useState([]);
  const [pending, setPending] = useState(null);
  const [inputValue, setInputValue] = useState('');

  // The failure text for the alert region. The hook hands the error back from
  // ask() rather than exposing it as state, so the one place that still needs
  // it after the exchange has been committed keeps its own copy.
  const [alertMessage, setAlertMessage] = useState('');

  // Transient feedback for a message that was removed rather than answered.
  // Deleting the line without saying why looks like the app lost the question.
  const [notice, setNotice] = useState('');

  // Which question has been waiting long enough to relabel. Derived state, so
  // nothing has to be reset when the status changes.
  const [slowQuestionId, setSlowQuestionId] = useState(null);

  const logRef = useRef(null);
  const inputRef = useRef(null);
  const nextId = useRef(0);

  const pendingId = pending?.id ?? null;
  const slow = status === 'thinking' && slowQuestionId !== null && slowQuestionId === pendingId;

  // Only armed while nothing has arrived yet; the first delta ends it.
  useEffect(() => {
    if (status !== 'thinking' || pendingId === null) return undefined;

    const timer = setTimeout(() => setSlowQuestionId(pendingId), SLOW_AFTER_MS);

    return () => clearTimeout(timer);
  }, [status, pendingId]);

  // Keep the newest line in view as the answer grows.
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [history, answer, status]);

  const handleSend = async (text) => {
    const trimmed = text.trim();
    if (busy || trimmed.length < 2) return;

    const id = `m-${nextId.current++}`;

    setInputValue('');
    setAlertMessage('');
    setNotice('');
    setPending({ id, question: trimmed });

    // ask() resolves once the answer is complete or has failed, so the exchange
    // is committed right here instead of in an effect watching `busy` - which
    // had to re-derive the outcome from three pieces of state.
    const { text: finalText, error, duplicate, notice: duplicateNotice } = await ask(trimmed);

    // A repeat was never queued, so there is no answer coming and nothing to
    // commit. Drop the optimistically drawn question and say why.
    if (duplicate) {
      setPending(null);
      setNotice(duplicateNotice || 'You already asked that.');
      inputRef.current?.focus();

      return;
    }

    setHistory((prev) => [
      ...prev,
      { id: `${id}-q`, type: 'out', html: esc(trimmed) },
      {
        id: `${id}-a`,
        type: error ? 'err' : 'in',
        html: renderHtml(error ?? finalText),
      },
    ]);

    setPending(null);

    // Put the question back so a failure does not cost the visitor their typing.
    if (error) {
      setInputValue(trimmed);
      // role="alert" fires on the empty -> non-empty transition, which is why
      // it is cleared at the start of every question.
      setAlertMessage(error);
    }

    // Returning focus to the input is what makes this usable keyboard-only:
    // ask, read, ask again without reaching for the mouse.
    inputRef.current?.focus();
  };

  const thinkingLabel = slow ? 'still thinking' : 'thinking';

  const liveAnswer =
    status === 'thinking'
      // aria-hidden: the role="status" region below already announces this, and
      // a screen reader should not also read a decorative ellipsis cycling.
      ? `<span class="term-thinking" aria-hidden="true">${thinkingLabel}<i>.</i><i>.</i><i>.</i></span>`
      : status === 'streaming' ? renderHtml(answer) + CURSOR
        : renderHtml(answer);

  return (
    <section className="section section--tight on-dark" id="ask" style={{ paddingTop: 0, scrollMarginTop: '100px' }}>
      <div className="shell">
        <div className="split">
          <div className="rv">
            <p className="eyebrow">Ask</p>
            <h2 className="t-h1">Don&rsquo;t want to read? Ask the AI.</h2>
            <p className="lead-p" style={{ marginTop: 'var(--s-6)' }}>
              Rather than describe the AI work, here it is. Ask about skills, experience, architecture, the agent design, or how I&rsquo;d approach what you&rsquo;re building.
            </p>
            <p className="chat__note">
              It answers only from my CV, and every number it gives you already appears on this page. Anything outside that, it hands you my email instead of guessing.
            </p>
          </div>

          <div className="rv" style={{ position: 'relative' }}>
            <div className="chat-wrapper">
              <div className="chat" id="chat">
                <div className="chat__top">
                  <img src="/assets/avatar/ismail-bust-256.webp" alt="" width={40} height={40} />
                  <div className="chat__who">
                    <b>Ismail&rsquo;s Clone</b>
                    <span><i className="dot"></i> AI Clone Available</span>
                  </div>
                </div>

                {/*
                  aria-live is off here on purpose. A token stream fires dozens
                  of DOM updates per answer, and a polite live region would read
                  every fragment. The completed answer is announced once, below.
                */}
                <div
                  className="chat__logwrap"
                  id="chatLog"
                  ref={logRef}
                  role="log"
                  aria-live="off"
                  aria-busy={busy}
                  aria-label="Conversation with Ismail's Clone"
                >
                  <ul className="chat__list" id="chatList">
                    <li className="term-msg term-msg--in">
                      <span className="term-prompt">
                        <span className="term-avatar">Ismail@ubuntu</span>:<span className="term-path">~</span>${' '}
                      </span>
                      <span className="term-content" dangerouslySetInnerHTML={{ __html: INTRO }} />
                    </li>

                    {history.map((m) => (
                      <li key={m.id} className={`term-msg term-msg--${m.type}`}>
                        <span className="term-prompt">
                          <span className={m.type === 'out' ? 'term-user' : 'term-avatar'}>
                            {m.type === 'out' ? 'Guest@ubuntu' : 'Ismail@ubuntu'}
                          </span>
                          :<span className="term-path">~</span>${' '}
                        </span>
                        <span className="term-content" dangerouslySetInnerHTML={{ __html: m.html }} />
                      </li>
                    ))}

                    {pending && (
                      <>
                        <li className="term-msg term-msg--out">
                          <span className="term-prompt">
                            <span className="term-user">Guest@ubuntu</span>:<span className="term-path">~</span>${' '}
                          </span>
                          <span className="term-content" dangerouslySetInnerHTML={{ __html: esc(pending.question) }} />
                        </li>
                        <li className={`term-msg term-msg--${status === 'error' ? 'err' : 'in'}`}>
                          <span className="term-prompt">
                            <span className="term-avatar">Ismail@ubuntu</span>:<span className="term-path">~</span>${' '}
                          </span>
                          <span className="term-content" dangerouslySetInnerHTML={{ __html: liveAnswer }} />
                        </li>
                      </>
                    )}
                  </ul>
                </div>

                {notice && (
                  <p className="chat__sys" role="status">{notice}</p>
                )}

                {/* One announcement per answer, not one per token. */}
                <p className="vh" role="status" aria-atomic="true">
                  {status === 'thinking'
                    ? (slow ? 'Still working on your question' : 'Thinking about your question')
                    : !busy && answer ? answer : ''}
                </p>
                <p className="vh" role="alert">{alertMessage}</p>

                {/*
                  A group label rather than a live region: the status region
                  below already announces each answer, and a second polite
                  region competing with it means neither is heard cleanly.
                  Focus is in the input when these swap, so nothing is lost.
                */}
                <div
                  className="chat__chips"
                  id="chatChips"
                  role="group"
                  aria-label="Suggested follow-up questions"
                >
                  {suggestions.map((q) => (
                    <button
                      // Keyed on the text so a replaced chip animates in as a
                      // new element instead of mutating in place.
                      key={q}
                      className="chip-s chip-s--enter"
                      type="button"
                      onClick={() => handleSend(q)}
                      disabled={busy}
                    >
                      {q}
                    </button>
                  ))}
                </div>

                <form
                  className="chat__form"
                  id="chatForm"
                  autoComplete="off"
                  onSubmit={(e) => { e.preventDefault(); handleSend(inputValue); }}
                >
                  <label className="vh" htmlFor="chatInput">Ask Ismail&rsquo;s Clone a question</label>
                  <input
                    id="chatInput"
                    ref={inputRef}
                    name="q"
                    type="text"
                    placeholder={busy ? 'Answering…' : 'Ask a question…'}
                    maxLength={500}
                    required
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    disabled={busy}
                  />
                  <button
                    className="chat__send"
                    id="chatSend"
                    type="submit"
                    aria-label="Send question"
                    disabled={busy || inputValue.trim().length < 2}
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                      <path
                        d="M8 14V3M8 3 3.5 7.5M8 3l4.5 4.5"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        fill="none"
                      />
                    </svg>
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
