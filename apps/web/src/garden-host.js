/** A separate document keeps the approved game's art/CSS and AAC DOM independent. */
export function openGarden({ columns, url = new URL('./garden.html', location.href), onExit, onReady, onState }) {
  const token = Array.from(crypto.getRandomValues(new Uint32Array(4)), n => n.toString(16)).join('');
  const frame = document.createElement('iframe');
  frame.className = 'garden-frame'; frame.title = '鳥兒花園'; frame.allow = 'autoplay';
  const source = new URL(url); source.hash = new URLSearchParams({token}).toString();
  frame.src = source.href;
  let closed = false, ready = false;
  const send = type => frame.contentWindow?.postMessage({ channel: 'shine-bird-garden', token, type, columns }, '*');
  const exit = reason => {
    if (closed) return;
    closed = true; clearTimeout(timeout);
    window.removeEventListener('message', receive);
    document.removeEventListener('visibilitychange', hidden);
    window.removeEventListener('pagehide', background);
    frame.remove(); onExit?.(reason);
  };
  const receive = event => {
    const message = event.data;
    if (closed || event.source !== frame.contentWindow || message?.channel !== 'shine-bird-garden' || message.token !== token) return;
    if (message.type === 'hello') send('init');
    if (message.type === 'ready') { ready = true; clearTimeout(timeout); onReady?.(message); }
    if (message.type === 'state') onState?.(message);
    if (message.type === 'exit') exit(message.reason);
  };
  const background = () => exit('background');
  const hidden = () => { if (document.hidden) background(); };
  const timeout = setTimeout(() => exit('load-timeout'), 30000);
  window.addEventListener('message', receive);
  window.addEventListener('pagehide', background);
  document.addEventListener('visibilitychange', hidden);
  document.body.append(frame);
  return { activate: () => { if (ready) send('activate'); }, pause: () => send('pause'), exit };
}
