// Inloggen met Google (OAuth 2.0, token-flow via redirect: werkt ook als
// homescreen-app op iPhone, waar pop-ups niet betrouwbaar zijn).
//
// Let op: de Google Health API weigert tokens waar ook andere (niet-googlehealth)
// scopes in zitten (DISALLOWED_OAUTH_SCOPES). Daarom gebruiken we twee tokens:
//  - 'health': alleen googlehealth.*
//  - 'drive' : je naam/foto + verborgen Drive-map voor de back-up van je krachtlog

export const HEALTH_SCOPES = [
  'https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly',
  'https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly',
  'https://www.googleapis.com/auth/googlehealth.sleep.readonly',
  'https://www.googleapis.com/auth/googlehealth.profile.readonly',
];
export const DRIVE_SCOPES = ['openid', 'email', 'profile', 'https://www.googleapis.com/auth/drive.appdata'];
export const SCOPES = [...HEALTH_SCOPES, ...DRIVE_SCOPES];
const SETS = { health: HEALTH_SCOPES, drive: DRIVE_SCOPES };

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

export function getToken(kind = 'health') {
  const raw = LS.get(`pulse.token.${kind}`);
  if (!raw) return null;
  try {
    const t = JSON.parse(raw);
    if (!t.access_token || Date.now() > t.expires_at - 60000) return null;
    return t;
  } catch { return null; }
}

export function hasEverLoggedIn() { return !!LS.get('pulse.user') || !!LS.get('pulse.loggedIn'); }

export function getUser() {
  try { return JSON.parse(LS.get('pulse.user') || 'null'); } catch { return null; }
}

export function setUser(u) { LS.set('pulse.user', JSON.stringify(u)); }

export function logout() {
  for (const kind of ['health', 'drive']) {
    const t = getToken(kind);
    if (t) fetch('https://oauth2.googleapis.com/revoke?token=' + encodeURIComponent(t.access_token), { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }).catch(() => {});
    LS.del(`pulse.token.${kind}`);
  }
  LS.del('pulse.token');
  LS.del('pulse.user');
  LS.del('pulse.loggedIn');
}

/** Start de Google-login. silent = zonder scherm als je al toestemming gaf. */
export function login({ kind = 'health', silent = false, consent = false, returnTo = location.hash } = {}) {
  const clientId = getClientId();
  if (!clientId) throw new Error('Geen Google Client ID ingesteld.');
  const state = Math.random().toString(36).slice(2) + Date.now().toString(36);
  LS.set('pulse.oauthState', JSON.stringify({ state, returnTo, silent, kind, at: Date.now() }));
  const p = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri(),
    response_type: 'token',
    scope: SETS[kind].join(' '),
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
 * Geeft {ok, kind, returnTo, error, missingScopes} of null als er niets te verwerken was.
 */
export function handleRedirect() {
  const h = location.hash.replace(/^#/, '');
  if (!/(^|&)(access_token|error)=/.test(h)) return null;
  const p = new URLSearchParams(h);
  let saved = null;
  try { saved = JSON.parse(LS.get('pulse.oauthState') || 'null'); } catch { /* */ }
  LS.del('pulse.oauthState');
  const returnTo = saved?.returnTo && !/access_token|error=|welcome|setup/.test(saved.returnTo) ? saved.returnTo : '#/today';
  history.replaceState(null, '', location.pathname + location.search + returnTo);
  const kind = saved?.kind || 'health';
  if (!saved || p.get('state') !== saved.state) return { ok: false, kind, returnTo, error: 'state_mismatch' };
  if (p.get('error')) return { ok: false, kind, returnTo, error: p.get('error'), silent: saved.silent };
  const token = {
    access_token: p.get('access_token'),
    expires_at: Date.now() + Number(p.get('expires_in') || 3600) * 1000,
    scope: p.get('scope') || '',
  };
  LS.set(`pulse.token.${kind}`, JSON.stringify(token));
  LS.set('pulse.loggedIn', '1');
  const granted = token.scope.split(/\s+/);
  const missingScopes = SETS[kind].filter((s) => s.startsWith('https://') && !granted.includes(s));
  return { ok: true, kind, returnTo, missingScopes };
}

/** Bewaakt dat we niet in een redirect-lus raken bij stille login. */
export function canTrySilent(kind = 'health') {
  const key = `pulse.lastSilent.${kind}`;
  const last = Number(LS.get(key) || 0);
  if (Date.now() - last < 5 * 60000) return false;
  LS.set(key, String(Date.now()));
  return true;
}

export function driveDisabled() { return LS.get('pulse.driveOff') === '1'; }
export function setDriveDisabled(v) { if (v) LS.set('pulse.driveOff', '1'); else LS.del('pulse.driveOff'); }
