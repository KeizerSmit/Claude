// Google Health API (opvolger van de Fitbit Web API) + Google Drive appdata.
import { getToken } from './auth.js';

const HEALTH = 'https://health.googleapis.com/v4/users/me';

export class AuthError extends Error {
  constructor(msg, kind = 'health') { super(msg); this.name = 'AuthError'; this.kind = kind; }
}

export class ApiError extends Error {
  constructor(msg, status, body) { super(msg); this.name = 'ApiError'; this.status = status; this.body = body; }
}

async function request(url, { method = 'GET', body, headers = {}, raw = false } = {}) {
  const kind = /health\.googleapis\.com/.test(url) ? 'health' : 'drive';
  const t = getToken(kind);
  if (!t) throw new AuthError('Niet ingelogd of sessie verlopen.', kind);
  let res;
  try {
    res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${t.access_token}`, ...(body && typeof body === 'object' && !(body instanceof Blob) && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}), ...headers },
    body: body && typeof body === 'object' && !(body instanceof Blob) && !(body instanceof FormData) ? JSON.stringify(body) : body,
    });
  } catch (e) {
    throw new ApiError(`Netwerkfout (${e.message}) bij ${url.replace(/\?.*/, '').replace('https://', '')}`, 0, '');
  }
  if (res.status === 401) throw new AuthError('Sessie verlopen.', kind);
  if (!res.ok) {
    let text = '';
    try { text = await res.text(); } catch { /* */ }
    let msg = `${res.status}`;
    let raw = '';
    try {
      const er = JSON.parse(text).error || {};
      msg = er.message || msg;
      const reasons = (er.details || []).map((d) => d.reason).filter(Boolean);
      raw = [er.status, ...reasons].filter(Boolean).join(' / ') + (er.message ? ` — ${er.message}` : '');
    } catch { raw = text.slice(0, 300); }
    if (/ACCOUNT_NOT_LINKED|FAILED_PRECONDITION/.test(text)) msg = 'Je Google-account heeft nog geen Google Health-profiel. Open de Google Health-app één keer met dit account en probeer opnieuw.';
    else if (res.status === 403 && /SERVICE_DISABLED|has not been used|disabled/i.test(text)) msg = 'Deze Google-koppeling staat nog uit in je Cloud-project (stap 2 van Instellen).';
    else if (res.status === 403 && /DISALLOWED_OAUTH_SCOPES/.test(text)) msg = 'Google weigert de combinatie van toestemmingen. Log opnieuw in.';
    else if (res.status === 403 && /scope|insufficient/i.test(text)) msg = 'Toestemming ontbreekt. Log opnieuw in en vink alles aan (of controleer stap 5 van Instellen).';
    const err = new ApiError(msg, res.status, text);
    err.raw = raw;
    throw err;
  }
  if (raw) return res;
  if (res.status === 204) return null;
  const ct = res.headers.get('content-type') || '';
  return ct.includes('json') ? res.json() : res.text();
}

export const api = { request };

/** Alle datapunten van een type, met paginering. */
export async function listDataPoints(dataType, filter, pageSize = 1000, maxPages = 40) {
  const out = [];
  let pageToken = '';
  for (let i = 0; i < maxPages; i++) {
    const p = new URLSearchParams({ pageSize: String(pageSize) });
    if (filter) p.set('filter', filter);
    if (pageToken) p.set('pageToken', pageToken);
    const r = await request(`${HEALTH}/dataTypes/${dataType}/dataPoints?${p}`);
    out.push(...(r?.dataPoints || []));
    pageToken = r?.nextPageToken;
    if (!pageToken) break;
  }
  return out;
}

export function civilDate(s) {
  const [y, m, d] = s.split('-').map(Number);
  return { year: y, month: m, day: d };
}

/** Dagelijkse rollup (bijv. stappen) over een datumbereik [from, toExcl). */
export async function dailyRollUp(dataType, from, toExcl) {
  const out = [];
  let pageToken;
  for (let i = 0; i < 10; i++) {
    const body = { range: { start: { date: civilDate(from) }, end: { date: civilDate(toExcl) } }, windowSizeDays: 1, pageSize: 1000 };
    if (pageToken) body.pageToken = pageToken;
    const r = await request(`${HEALTH}/dataTypes/${dataType}/dataPoints:dailyRollUp`, { method: 'POST', body });
    out.push(...(r?.rollupDataPoints || []));
    pageToken = r?.nextPageToken;
    if (!pageToken) break;
  }
  return out;
}

/** Rollup over fysieke tijd (bijv. hartslag per minuut). */
export async function rollUp(dataType, startIso, endIso, windowSize = '60s') {
  const out = [];
  let pageToken;
  for (let i = 0; i < 10; i++) {
    const body = { range: { startTime: startIso, endTime: endIso }, windowSize, pageSize: 2000 };
    if (pageToken) body.pageToken = pageToken;
    const r = await request(`${HEALTH}/dataTypes/${dataType}/dataPoints:rollUp`, { method: 'POST', body });
    out.push(...(r?.rollupDataPoints || []));
    pageToken = r?.nextPageToken;
    if (!pageToken) break;
  }
  return out;
}

export function getProfile() { return request(`${HEALTH}/profile`); }

export function getUserInfo() { return request('https://openidconnect.googleapis.com/v1/userinfo'); }

// ---------- Google Drive (verborgen app-map) voor je krachtlog ----------

const DRIVE = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';
const FILE_NAME = 'pulse-strength.json';

async function findFile() {
  const p = new URLSearchParams({ spaces: 'appDataFolder', q: `name='${FILE_NAME}' and trashed=false`, fields: 'files(id,modifiedTime)', pageSize: '10' });
  const r = await request(`${DRIVE}?${p}`);
  return r?.files?.[0] || null;
}

export async function driveLoad() {
  const f = await findFile();
  if (!f) return null;
  const r = await request(`${DRIVE}/${f.id}?alt=media`);
  return typeof r === 'string' ? JSON.parse(r) : r;
}

export async function driveSave(doc) {
  const f = await findFile();
  const content = JSON.stringify(doc);
  if (f) {
    return request(`${UPLOAD}/${f.id}?uploadType=media`, { method: 'PATCH', body: new Blob([content], { type: 'application/json' }), headers: { 'Content-Type': 'application/json' } });
  }
  const boundary = 'pulse' + Date.now();
  const meta = { name: FILE_NAME, parents: ['appDataFolder'], mimeType: 'application/json' };
  const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${content}\r\n--${boundary}--`;
  return request(`${UPLOAD}?uploadType=multipart`, { method: 'POST', body: new Blob([body]), headers: { 'Content-Type': `multipart/related; boundary=${boundary}` } });
}

/** Vraag Google welke scopes het token echt heeft (diagnose). */
export async function tokenInfo() {
  const t = getToken('health');
  if (!t) return null;
  const r = await fetch('https://oauth2.googleapis.com/tokeninfo?access_token=' + encodeURIComponent(t.access_token));
  return r.json();
}

/** Minimale test-aanroep met volledige foutinfo. */
export async function probe() {
  try { const r = await request(`${HEALTH}/identity`); return { ok: true, r }; } catch (e) { return { ok: false, status: e.status, msg: e.message, raw: e.raw || '', body: e.body || '' }; }
}
