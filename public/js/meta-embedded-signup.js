const cfg = {
  appId: null,
  configIds: null,
  graphVersion: null,
  runtimeMode: null,
  sandboxCapabilities: null,
  accountId: null,
  buttonId: 'connect-whatsapp',
  statusId: 'connect-whatsapp-status',
};

let sessionResult = null;
let sessionWaiter = null;
let onboardingMode = 'fresh';

async function loadPublicConfig() {
  if (cfg.appId) return;
  const response = await fetch('/api/meta/public-config', {
    headers: { Authorization: `Bearer ${accessToken()}` },
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || 'Could not load Meta configuration.');
  cfg.appId = body.appId;
  cfg.configIds = body.configIds;
  cfg.graphVersion = body.graphVersion;
  cfg.runtimeMode = body.runtimeMode;
  cfg.sandboxCapabilities = body.sandboxCapabilities;
  cfg.accountId = window.wova8Session?.accountId;
}

function status(message, kind = 'info') {
  const node = document.getElementById(cfg.statusId);
  if (node) {
    node.textContent = message;
    node.dataset.kind = kind;
  }
}

function accessToken() {
  const token = window.wova8Session?.accessToken;
  if (!token) throw new Error('Please sign in to Wova8 first.');
  return token;
}

function parseSignupMessage(event) {
  if (!['https://www.facebook.com', 'https://web.facebook.com'].includes(event.origin)) return;
  let data = event.data;
  if (typeof data === 'string') {
    try { data = JSON.parse(data); } catch { return; }
  }
  if (data?.type !== 'WA_EMBEDDED_SIGNUP') return;
  if (data.event === 'CANCEL' || data.event === 'ERROR') {
    sessionWaiter?.reject(new Error(data.data?.error_message || 'WhatsApp onboarding was cancelled.'));
    sessionWaiter = null;
    return;
  }
  const finished = new Set([
    'FINISH',
    'FINISH_ONLY_WABA',
    'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING',
  ]);
  if (!finished.has(data.event)) return;
  const result = {
    wabaId: String(data.data?.waba_id || ''),
    phoneNumberId: String(data.data?.phone_number_id || ''),
    businessId: data.data?.business_id ? String(data.data.business_id) : null,
  };
  if (!/^\d{5,32}$/.test(result.wabaId) || !/^\d{5,32}$/.test(result.phoneNumberId)) {
    sessionWaiter?.reject(new Error('Meta did not return a valid WABA and phone-number ID.'));
  } else {
    sessionResult = result;
    sessionWaiter?.resolve(result);
  }
  sessionWaiter = null;
}

window.addEventListener('message', parseSignupMessage);

function loadFacebookSdk() {
  if (window.FB) return Promise.resolve();
  return new Promise((resolve, reject) => {
    window.fbAsyncInit = () => {
      window.FB.init({ appId: cfg.appId, cookie: true, xfbml: false, version: cfg.graphVersion });
      resolve();
    };
    const script = document.createElement('script');
    script.id = 'facebook-jssdk';
    script.async = true;
    script.defer = true;
    script.crossOrigin = 'anonymous';
    script.src = 'https://connect.facebook.net/en_US/sdk.js';
    script.onerror = () => reject(new Error('Could not load the Meta SDK.'));
    document.head.appendChild(script);
  });
}

function waitForSignupSession(timeoutMs = 120000) {
  if (sessionResult) return Promise.resolve(sessionResult);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      sessionWaiter = null;
      reject(new Error('Timed out waiting for Meta onboarding details.'));
    }, timeoutMs);
    sessionWaiter = {
      resolve: (value) => { clearTimeout(timer); resolve(value); },
      reject: (error) => { clearTimeout(timer); reject(error); },
    };
  });
}

async function createServerState() {
  const response = await fetch('/api/meta/onboarding/session', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken()}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ accountId: cfg.accountId, onboardingMode }),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || 'Could not begin onboarding.');
  return body.state;
}

function facebookLogin(state) {
  const configId = cfg.configIds?.[onboardingMode];
  if (!configId) throw new Error(`Meta configuration is unavailable for ${onboardingMode}.`);
  return new Promise((resolve, reject) => {
    window.FB.login((response) => {
      const code = response?.authResponse?.code;
      if (!code) reject(new Error('Meta did not return an authorization code.'));
      else resolve(code);
    }, {
      config_id: configId,
      response_type: 'code',
      override_default_response_type: true,
      scope: 'whatsapp_business_management,whatsapp_business_messaging',
      state,
      extras: onboardingMode === 'business_app_coexistence'
        ? { setup: {}, featureType: 'whatsapp_business_app_onboarding', sessionInfoVersion: '3' }
        : { setup: {}, sessionInfoVersion: '3' },
    });
  });
}

async function connect() {
  const button = document.getElementById(cfg.buttonId);
  try {
    button.disabled = true;
    sessionResult = null;
    status('Preparing protected onboarding…');
    await loadPublicConfig();
    if (!cfg.appId || !cfg.accountId) throw new Error('Onboarding configuration is incomplete.');
    const state = await createServerState();
    if (cfg.runtimeMode === 'sandbox') {
      status('Verifying the configured Meta Test WABA read-only…');
      const response = await fetch('/api/meta/onboarding/sandbox-complete', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken()}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ state, accountId: cfg.accountId }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Meta sandbox verification failed.');
      status(body.message, 'success');
      window.dispatchEvent(new CustomEvent('wova8:meta-sandbox-verified', { detail: body }));
      return;
    }

    await loadFacebookSdk();
    status('Opening Meta onboarding…');
    const sessionPromise = waitForSignupSession();
    const code = await facebookLogin(state);
    const session = await sessionPromise;
    status('Verifying WhatsApp assets…');
    const response = await fetch('/api/meta/onboarding/complete', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken()}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ code, state, accountId: cfg.accountId, ...session }),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || 'WhatsApp connection failed.');
    status(`Connected ${body.displayPhoneNumber || 'WhatsApp Business'}.`, 'success');
    window.dispatchEvent(new CustomEvent('wova8:whatsapp-connected', { detail: body }));
  } catch (error) {
    status(error.message, 'error');
  } finally {
    button.disabled = false;
  }
}

document.querySelectorAll('[data-onboarding-mode]').forEach((button) => {
  button.addEventListener('click', () => {
    onboardingMode = button.dataset.onboardingMode;
    document.querySelectorAll('[data-onboarding-mode]').forEach((item) => {
      item.setAttribute('aria-pressed', String(item === button));
    });
    document.getElementById('onboarding-mode-title').textContent = button.dataset.title;
    document.getElementById('onboarding-mode-help').textContent = button.dataset.help;
    const capability = cfg.sandboxCapabilities?.[onboardingMode];
    const action = document.getElementById(cfg.buttonId);
    if (action && cfg.runtimeMode === 'sandbox') {
      action.textContent = capability === 'simulated_only'
        ? 'Run safe UI/state simulation'
        : 'Verify Meta Test WABA';
    }
  });
});
document.getElementById('open-whatsapp-onboarding')?.addEventListener('click', () => {
  document.getElementById('whatsapp-onboarding-dialog')?.showModal();
  loadPublicConfig().then(() => {
    const badge = document.getElementById('meta-runtime-badge');
    if (badge) badge.textContent = cfg.runtimeMode === 'sandbox' ? 'Sandbox lock active' : 'Live onboarding';
    const action = document.getElementById(cfg.buttonId);
    if (action && cfg.runtimeMode === 'sandbox') action.textContent = 'Verify Meta Test WABA';
  }).catch((error) => status(error.message, 'error'));
});
document.getElementById('close-whatsapp-onboarding')?.addEventListener('click', () => {
  document.getElementById('whatsapp-onboarding-dialog')?.close();
});
document.getElementById(cfg.buttonId)?.addEventListener('click', connect);
