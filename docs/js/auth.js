// Inloggen met Google (OAuth 2.0, token-flow via redirect: werkt ook als
// homescreen-app op iPhone, waar pop-ups niet betrouwbaar zijn).

export const SCOPES = [
  'openid', 'email', 'profile',
  'https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly',
  'https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly',
  'https://www.googleapis.com/auth/googlehealth.sleep.readonly',
  'https://www.googleapis.com/auth/googlehealth.profile.readonly',
  'https://www.googleapis.com/auth/drive.appdata',
];

const LS = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* */ } },
};

export function getClientId() {
  return (window.PULSE_CONFIG && window.PULSE_CONFIG.clientId) || LS.get('pulse.clientId') || '';
}

export function setClientId(id) { LS.set('pulse.clientId', id.trim()); }

export function redirectUri() {
  return location.origin + location.pathname.replace(/index\.html$/, '');
}

export function getToken() {
  const raw = LS.get('pulse.token');
  if (!raw) return null;
  try {
    const t = JSON.parse(raw);
    if (!t.access_token || Date.now() > t.expires_at - 60000) return null;
    return t;
  } catch { return null; }
}

export function hasEverLoggedIn() { return !!LS.get('pulse.user'); }

export function getUser() {
  try { return JSON.parse(LS.get('pulse.user') || 'null'); } catch { return null; }
}

export function setUser(u) { LS.set('pulse.user', JSON.stringify(u)); }

export function logout() {
  const t = getToken();
  if (t) {
    // Token intrekken (best effort).
    fetch('https://oauth2.googleapis.com/revoke?token=' + encodeURIComponent(t.access_token), { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }).catch(() => {});
  }
  LS.del('pulse.token');
  LS.del('pulse.user');
}

/** Start de Google-login. silent = zonder scherm als je al toestemming gaf. */
export function login({ silent = false, consent = false, returnTo = location.hash } = {}) {
  const clientId = getClientId();
  if (!clientId) throw new Error('Geen Google Client ID ingesteld.');
  const state = Math.random().toString(36).slice(2) + Date.now().toString(36);
  LS.set('pulse.oauthState', JSON.stringify({ state, returnTo, silent, at: Date.now() }));
  const p = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri(),
    response_type: 'token',
    scope: SCOPES.join(' '),
    include_granted_scopes: 'true',
    state,
  });
  const user = getUser();
  if (user?.email) p.set('login_hint', user.email);
  if (silent) p.set('prompt', 'none');
  else if (consent) p.set('prompt', 'consent');
  location.assign('https://accounts.google.com/o/oauth2/v2/auth?' + p.toString());
}

/**
 * Verwerk de terugkeer van Google (#access_token=... in de URL).
 * Geeft {ok, returnTo, error, missingScopes} of null als er niets te verwerken was.
 */
export function handleRedirect() {
  const h = location.hash.replace(/^#/, '');
  if (!/(^|&)(access_token|error)=/.test(h)) return null;
  const p = new URLSearchParams(h);
  let saved = null;
  try { saved = JSON.parse(LS.get('pulse.oauthState') || 'null'); } catch { /* */ }
  LS.del('pulse.oauthState');
  const returnTo = saved?.returnTo && !/access_token|error=/.test(saved.returnTo) ? saved.returnTo : '#/today';
  history.replaceState(null, '', location.pathname + location.search + returnTo);
  if (!saved || p.get('state') !== saved.state) return { ok: false, returnTo, error: 'state_mismatch' };
  if (p.get('error')) return { ok: false, returnTo, error: p.get('error'), silent: saved.silent };
  const token = {
    access_token: p.get('access_token'),
    expires_at: Date.now() + Number(p.get('expires_in') || 3600) * 1000,
    scope: p.get('scope') || '',
  };
  LS.set('pulse.token', JSON.stringify(token));
  const granted = token.scope.split(/\s+/);
  const missingScopes = SCOPES.filter((s) => s.startsWith('https://') && !granted.includes(s));
  return { ok: true, returnTo, missingScopes };
}

/** Bewaakt dat we niet in een redirect-lus raken bij stille login. */
export function canTrySilent() {
  const last = Number(LS.get('pulse.lastSilent') || 0);
  if (Date.now() - last < 5 * 60000) return false;
  LS.set('pulse.lastSilent', String(Date.now()));
  return true;
}
