// World side of the bridge. Same-origin only: posts to the parent with targetOrigin = own origin and accepts
// messages only from the parent window at the same origin that pass the protocol guards.
import { isAppMessage, wrap, type AppMessage, type WorldMessage } from './protocol';

export function createEmbedBridge() {
  const parentWin = window.parent !== window ? window.parent : null;
  const handlers: ((m: AppMessage) => void)[] = [];
  window.addEventListener('message', (ev) => {
    if (!parentWin || ev.source !== parentWin || ev.origin !== location.origin) return;
    if (!isAppMessage(ev.data)) return;
    for (const h of handlers) h(ev.data);
  });
  return {
    send(m: WorldMessage) { parentWin?.postMessage(wrap(m), location.origin); },
    onMessage(h: (m: AppMessage) => void) { handlers.push(h); },
  };
}
