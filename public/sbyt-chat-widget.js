(() => {
  // Legacy loader retained so existing customer embed snippets keep working
  // during the Wova8 migration. New snippets use wova8-chat-widget.js.
  const legacyScript = document.currentScript;
  if (!legacyScript) return;
  const key = legacyScript.getAttribute('data-sbyt-key');
  if (!key) return;

  const replacement = document.createElement('script');
  replacement.src = new URL(
    '/wova8-chat-widget.js',
    legacyScript.src
  ).toString();
  replacement.setAttribute('data-wova8-key', key);
  replacement.defer = true;
  legacyScript.after(replacement);
})();
