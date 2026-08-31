(() => {
  const script = document.currentScript;
  if (!script) return;
  const key = script.getAttribute('data-wova8-key');
  if (!key) return;

  const scriptUrl = new URL(script.src, window.location.href);
  const apiBase = `${scriptUrl.origin}/api/webchat/${encodeURIComponent(key)}`;
  const storageKey = `wova8-chat:${key}:visitor`;
  const legacyStorageKey = `sbyt-chat:${key}:visitor`;
  let visitorToken =
    localStorage.getItem(storageKey) ||
    localStorage.getItem(legacyStorageKey) ||
    '';
  let open = false;
  let pollTimer = null;

  const style = document.createElement('style');
  style.textContent = `
    .wova8-chat-root{position:fixed;right:20px;bottom:20px;z-index:2147483000;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#f8fafc}
    .wova8-chat-launcher{width:56px;height:56px;border:0;border-radius:18px;background:#6d5dfc;color:white;box-shadow:0 18px 50px rgba(0,0,0,.32);font-size:24px;cursor:pointer}
    .wova8-chat-panel{display:none;width:min(360px,calc(100vw - 28px));height:min(560px,calc(100vh - 110px));margin-bottom:12px;border:1px solid rgba(255,255,255,.12);border-radius:22px;background:#0b0d12;box-shadow:0 24px 80px rgba(0,0,0,.45);overflow:hidden}
    .wova8-chat-panel[data-open="true"]{display:flex;flex-direction:column}
    .wova8-chat-head{padding:16px 18px;border-bottom:1px solid rgba(255,255,255,.09);background:linear-gradient(135deg,rgba(109,93,252,.22),rgba(20,184,166,.08))}
    .wova8-chat-title{font-size:14px;font-weight:750}.wova8-chat-sub{margin-top:3px;font-size:11px;color:#94a3b8}
    .wova8-chat-messages{flex:1;overflow:auto;padding:14px;background:#07090d}
    .wova8-chat-row{display:flex;margin:8px 0}.wova8-chat-row[data-sender="customer"]{justify-content:flex-end}
    .wova8-chat-bubble{max-width:82%;padding:9px 11px;border-radius:14px;background:#171a22;font-size:13px;line-height:1.45;white-space:pre-wrap;word-break:break-word}
    .wova8-chat-row[data-sender="customer"] .wova8-chat-bubble{background:#6d5dfc;color:white;border-bottom-right-radius:5px}
    .wova8-chat-row:not([data-sender="customer"]) .wova8-chat-bubble{border-bottom-left-radius:5px}
    .wova8-chat-form{display:flex;gap:8px;padding:12px;border-top:1px solid rgba(255,255,255,.09);background:#0b0d12}
    .wova8-chat-input{min-width:0;flex:1;border:1px solid rgba(255,255,255,.12);border-radius:12px;background:#11141b;color:#f8fafc;padding:10px 11px;outline:none;font-size:13px}
    .wova8-chat-send{border:0;border-radius:12px;background:#6d5dfc;color:white;padding:0 14px;font-weight:700;cursor:pointer}
    .wova8-chat-send:disabled{opacity:.55;cursor:not-allowed}
    @media(max-width:480px){.wova8-chat-root{right:12px;bottom:12px}.wova8-chat-panel{height:calc(100vh - 92px)}}
  `;
  document.head.appendChild(style);

  const root = document.createElement('div');
  root.className = 'wova8-chat-root';
  const panel = document.createElement('div');
  panel.className = 'wova8-chat-panel';
  panel.dataset.open = 'false';
  const head = document.createElement('div');
  head.className = 'wova8-chat-head';
  const title = document.createElement('div');
  title.className = 'wova8-chat-title';
  title.textContent = 'Chat';
  const sub = document.createElement('div');
  sub.className = 'wova8-chat-sub';
  sub.textContent = 'Powered by Wova8';
  head.append(title, sub);

  const messagesEl = document.createElement('div');
  messagesEl.className = 'wova8-chat-messages';
  const form = document.createElement('form');
  form.className = 'wova8-chat-form';
  const input = document.createElement('input');
  input.className = 'wova8-chat-input';
  input.placeholder = 'Type a message…';
  input.maxLength = 4000;
  input.autocomplete = 'off';
  const send = document.createElement('button');
  send.className = 'wova8-chat-send';
  send.type = 'submit';
  send.textContent = 'Send';
  form.append(input, send);
  panel.append(head, messagesEl, form);

  const launcher = document.createElement('button');
  launcher.className = 'wova8-chat-launcher';
  launcher.type = 'button';
  launcher.setAttribute('aria-label', 'Open chat');
  launcher.textContent = '✦';
  root.append(panel, launcher);
  document.body.appendChild(root);

  function appendMessage(sender, text) {
    const row = document.createElement('div');
    row.className = 'wova8-chat-row';
    row.dataset.sender = sender;
    const bubble = document.createElement('div');
    bubble.className = 'wova8-chat-bubble';
    bubble.textContent = text || '';
    row.appendChild(bubble);
    messagesEl.appendChild(row);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  async function loadConfig() {
    try {
      const response = await fetch(apiBase, {
        mode: 'cors',
        cache: 'no-store',
      });
      if (!response.ok) return;
      const payload = await response.json();
      title.textContent = payload.name || 'Chat';
      if (!visitorToken && payload.welcomeMessage)
        appendMessage('agent', payload.welcomeMessage);
    } catch {}
  }

  async function poll() {
    if (!open || !visitorToken) return;
    try {
      const response = await fetch(
        `${apiBase}?visitor=${encodeURIComponent(visitorToken)}`,
        {
          mode: 'cors',
          cache: 'no-store',
        }
      );
      if (!response.ok) return;
      const payload = await response.json();
      if (!Array.isArray(payload.messages)) return;
      messagesEl.replaceChildren();
      for (const message of payload.messages) {
        appendMessage(
          message.sender_type === 'customer' ? 'customer' : 'agent',
          message.content_text || ''
        );
      }
    } catch {}
  }

  launcher.addEventListener('click', () => {
    open = !open;
    panel.dataset.open = String(open);
    launcher.setAttribute('aria-label', open ? 'Close chat' : 'Open chat');
    if (open) {
      void poll();
      pollTimer = window.setInterval(poll, 4000);
      window.setTimeout(() => input.focus(), 50);
    } else if (pollTimer) {
      window.clearInterval(pollTimer);
      pollTimer = null;
    }
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const message = input.value.trim();
    if (!message) return;
    input.value = '';
    appendMessage('customer', message);
    send.disabled = true;
    try {
      const response = await fetch(apiBase, {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          visitorToken: visitorToken || undefined,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Message failed');
      if (payload.visitorToken && !visitorToken) {
        visitorToken = payload.visitorToken;
        localStorage.setItem(storageKey, visitorToken);
      }
      await poll();
    } catch (error) {
      appendMessage(
        'agent',
        error instanceof Error ? error.message : 'Message could not be sent.'
      );
    } finally {
      send.disabled = false;
      input.focus();
    }
  });

  void loadConfig();
})();
