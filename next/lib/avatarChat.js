import Echo from 'laravel-echo';
import Pusher from 'pusher-js';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '/api';
const WS_PATH = process.env.NEXT_PUBLIC_SOCKUDO_PATH || '/ws';
const APP_KEY = process.env.NEXT_PUBLIC_SOCKUDO_KEY;

/**
 * One Echo connection per tab, created lazily.
 *
 * Sockudo speaks the Pusher protocol, and everything is same-origin: the
 * browser only ever talks to nginx, which proxies /ws to Sockudo and /api to
 * Laravel. That means no CORS, no second hostname to configure per environment,
 * and the socket inherits the page's TLS.
 */
let echo = null;

function connection() {
  if (echo) return echo;

  if (!APP_KEY) {
    throw new Error('NEXT_PUBLIC_SOCKUDO_KEY is not set - the avatar chat cannot connect.');
  }

  const secure = window.location.protocol === 'https:';
  const port = Number(window.location.port) || (secure ? 443 : 80);

  echo = new Echo({
    broadcaster: 'pusher',
    client: new Pusher(APP_KEY, {
      wsHost: window.location.hostname,
      wsPath: WS_PATH,
      wsPort: port,
      wssPort: port,
      forceTLS: secure,
      // 'ws' is the only WebSocket transport pusher-js registers; TLS is chosen
      // by forceTLS, not by the transport name. Passing 'wss' here enables no
      // transport at all, and pusher-js then sits in `connecting` forever
      // without opening a socket or raising an error - which is exactly how it
      // failed over https while working over http.
      // Listing it explicitly still rules out the xhr_streaming / xhr_polling
      // fallbacks: this transport streams tokens, and long-polling would
      // reintroduce the latency the WebSocket exists to avoid.
      enabledTransports: ['ws'],
      // Sockudo is not Pusher's cloud, so there is no cluster to resolve and
      // no stats endpoint to call.
      cluster: 'mt1',
      disableStats: true,
      // The visitor is anonymous and the channel is public; nothing here ever
      // needs /broadcasting/auth.
      authEndpoint: null,
    }),
  });

  return echo;
}

async function postJson(path, body) {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body ?? {}),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(payload.message || `Request failed with ${response.status}`);
    error.status = response.status;
    throw error;
  }

  return payload;
}

/**
 * Opens a chat session and subscribes to its channel.
 *
 * The order matters: the server issues the channel name, we subscribe, and only
 * then is a message allowed to be queued. Reversing it lets the worker publish
 * the opening deltas into a channel nobody has joined yet.
 *
 * @returns {Promise<{chatId: string, send: (text: string) => Promise<void>, close: () => void}>}
 *
 */
export async function openAvatarSession({ onDelta, onDone, onFailed, onSuggestions }) {
  const { chat_id: chatId, channel: channelName, events } = await postJson('/chat/session');

  const channel = connection().channel(channelName);

  // Echo namespaces bare event names under App\Events; a leading dot means
  // "this is the literal broadcast name", which is what broadcastAs() sets.
  channel.listen(`.${events.delta}`, (payload) => onDelta?.(payload.delta ?? ''));
  channel.listen(`.${events.done}`, () => onDone?.());
  channel.listen(`.${events.failed}`, (payload) => onFailed?.(payload.message));

  // Arrives shortly after `done`, on its own, and is entirely optional - the
  // server skips it whenever it cannot produce anything worth showing.
  if (events.suggestions) {
    channel.listen(`.${events.suggestions}`, (payload) => {
      if (Array.isArray(payload.questions) && payload.questions.length > 0) {
        onSuggestions?.(payload.questions);
      }
    });
  }

  await new Promise((resolve) => {
    // subscribed fires immediately if the subscription already succeeded.
    channel.subscribed(resolve);
    setTimeout(resolve, 3000);
  });

  return {
    chatId,
    /** Resolves with the server's envelope, which may report a duplicate. */
    send: (text) => postJson('/chat', { chat_id: chatId, message: text }),
    close: () => connection().leave(channelName),
  };
}
