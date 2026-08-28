/* KeySuite V3.9.4.4.1 — login / quotation-history stability hotfix.
   Quotation history must NEVER block entry to KeySuite.
   The legacy secure-history loader is preserved, but it runs in the background.
*/
(() => {
'use strict';
if (window.top !== window.self || window.__KEYSUITE_V39441_LOGIN_STABILITY__) return;
window.__KEYSUITE_V39441_LOGIN_STABILITY__ = true;

const VERSION = '3.9.4.4.1';
const RPC_TIMEOUT_MS = 10000;
const HISTORY_RPC = 'keysuite_list_quotations_v236';
let installed = false;
let backgroundPromise = null;
let attempt = 0;

function historyNotice() {
  return document.getElementById('quotationHistoryNotice');
}

function setNotice(text, kind = 'info', withRetry = false) {
  const node = historyNotice();
  if (!node) return;
  node.className = text ? `auth-message show ${kind === 'info' ? 'info' : ''}`.trim() : 'auth-message';
  if (!text) {
    node.textContent = '';
    return;
  }
  if (!withRetry) {
    node.textContent = text;
    return;
  }
  node.textContent = '';
  const span = document.createElement('span');
  span.textContent = text + ' ';
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'btn secondary';
  button.textContent = 'Retry';
  button.style.marginLeft = '8px';
  button.addEventListener('click', () => startBackgroundLoad(true));
  node.append(span, button);
}

function timeoutResult(label) {
  return new Promise(resolve => setTimeout(() => resolve({
    data: null,
    error: { message: `${label} timed out after ${Math.round(RPC_TIMEOUT_MS / 1000)} seconds.`, code: 'KEYSUITE_TIMEOUT' }
  }), RPC_TIMEOUT_MS));
}

function installQuotationRpcTimeout() {
  const client = window.KeySuiteAuth?.getClient?.();
  if (!client || typeof client.rpc !== 'function' || client.__keysuiteV39441RpcTimeout) return client;
  const originalRpc = client.rpc.bind(client);
  client.rpc = function patchedRpc(name, args, options) {
    const result = originalRpc(name, args, options);
    if (String(name) !== HISTORY_RPC) return result;
    // The quotation-history list is awaited directly by app.js. Returning a Promise
    // here is safe and prevents an unreachable backend from leaving history loading forever.
    return Promise.race([Promise.resolve(result), timeoutResult('Quotation history')]);
  };
  Object.defineProperty(client, '__keysuiteV39441RpcTimeout', { value: true, configurable: true });
  return client;
}

async function startBackgroundLoad(force = false) {
  const store = window.KeySuiteQuotationStore;
  const originalLoad = store?.__v39441OriginalLoad;
  if (!store || typeof originalLoad !== 'function') return [];
  if (backgroundPromise && !force) return backgroundPromise;
  if (backgroundPromise && force) {
    setNotice('Quotation history is still loading in the background. KeySuite remains available.', 'info');
    return backgroundPromise;
  }

  installQuotationRpcTimeout();
  const myAttempt = ++attempt;
  setNotice('Loading secure quotation history in background…', 'info');
  backgroundPromise = (async () => {
    try {
      const rows = await originalLoad();
      if (myAttempt !== attempt) return rows;
      const error = String(store.getError?.() || '').trim();
      if (error) {
        setNotice(`Quotation history is temporarily unavailable: ${error}`, 'error', true);
      } else {
        // app.js normally clears this itself after a successful load.
        const node = historyNotice();
        if (node && /background/i.test(node.textContent || '')) setNotice('');
      }
      window.dispatchEvent(new CustomEvent('KEYSUITE_QUOTATION_HISTORY_BACKGROUND_COMPLETE', {
        detail: { ok: !error, error: error || '', version: VERSION }
      }));
      return rows;
    } catch (error) {
      const message = String(error?.message || error || 'Unable to load quotation history.');
      console.warn('V3.9.4.4.1 quotation history background load:', error);
      setNotice(`Quotation history is temporarily unavailable: ${message}`, 'error', true);
      return [];
    } finally {
      backgroundPromise = null;
    }
  })();
  return backgroundPromise;
}

function install() {
  if (installed) return true;
  const store = window.KeySuiteQuotationStore;
  if (!store || typeof store.load !== 'function') return false;
  if (store.__v39441Patched) {
    installed = true;
    return true;
  }

  const originalLoad = store.load.bind(store);
  Object.defineProperty(store, '__v39441OriginalLoad', { value: originalLoad, configurable: true });
  Object.defineProperty(store, '__v39441Patched', { value: true, configurable: true });

  // auth.js awaits this method during login. Return immediately and start the legacy
  // secure loader later, after the login flow is free to show the application.
  store.load = async function nonBlockingQuotationHistoryLoad() {
    setTimeout(() => startBackgroundLoad(false), 150);
    return [];
  };
  store.loadBackground = () => startBackgroundLoad(true);
  installed = true;
  window.KeySuiteV39441LoginStability = {
    version: VERSION,
    installed: true,
    timeoutMs: RPC_TIMEOUT_MS,
    retry: () => startBackgroundLoad(true)
  };
  window.dispatchEvent(new CustomEvent('KEYSUITE_V39441_LOGIN_STABILITY_READY', {
    detail: window.KeySuiteV39441LoginStability
  }));
  return true;
}

// app.js normally creates KeySuiteQuotationStore before this bootstrap is inserted.
// These are finite fallback attempts only — no recurring polling loop.
if (!install()) {
  [25, 100, 350, 1000, 2500].forEach(delay => setTimeout(() => { if (!installed) install(); }, delay));
}
})();
