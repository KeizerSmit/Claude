// Kleine hulpfuncties: datums, getallen, DOM.

export const DAY_MS = 86400000;

export function pad(n) { return String(n).padStart(2, '0'); }

/** 'YYYY-MM-DD' in lokale tijd. */
export function ymd(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Lokale middernacht van een 'YYYY-MM-DD'. */
export function parseYmd(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(s, n) {
  const d = parseYmd(s);
  d.setDate(d.getDate() + n);
  return ymd(d);
}

export function daysBetween(a, b) {
  return Math.round((parseYmd(b) - parseYmd(a)) / DAY_MS);
}

export function dateRange(from, to) {
  const out = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

export function today() { return ymd(new Date()); }

const DAYS_NL = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];
const DAYS_SHORT = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'];
const MONTHS_NL = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
const MONTHS_SHORT = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];

export function fmtDayTitle(s) {
  const t = today();
  if (s === t) return 'Vandaag';
  if (s === addDays(t, -1)) return 'Gisteren';
  const d = parseYmd(s);
  return `${cap(DAYS_NL[d.getDay()])} ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

export function fmtDateLong(s) {
  const d = parseYmd(s);
  return `${DAYS_NL[d.getDay()]} ${d.getDate()} ${MONTHS_NL[d.getMonth()]} ${d.getFullYear()}`;
}

export function fmtDateShort(s) {
  const d = parseYmd(s);
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

export function weekdayShort(s) { return DAYS_SHORT[parseYmd(s).getDay()]; }

export function cap(s) { return s ? s[0].toUpperCase() + s.slice(1) : s; }

export function fmtTime(ms) {
  if (ms == null) return '–';
  const d = new Date(ms);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Minuten naar '7u 32m'. */
export function fmtDur(min) {
  if (min == null || isNaN(min)) return '–';
  min = Math.round(min);
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}m`;
  return `${h}u ${pad(m)}m`;
}

/** Minuten naar '7:32'. */
export function fmtHM(min) {
  if (min == null || isNaN(min)) return '–';
  min = Math.round(min);
  return `${Math.floor(min / 60)}:${pad(min % 60)}`;
}

export function num(v, digits = 0) {
  if (v == null || isNaN(v)) return '–';
  return Number(v).toLocaleString('nl-NL', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

export function mean(a) {
  const v = a.filter((x) => x != null && !isNaN(x));
  return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null;
}

export function sd(a) {
  const v = a.filter((x) => x != null && !isNaN(x));
  if (v.length < 2) return null;
  const m = mean(v);
  return Math.sqrt(v.reduce((s, x) => s + (x - m) ** 2, 0) / (v.length - 1));
}

export function median(a) {
  const v = a.filter((x) => x != null && !isNaN(x)).sort((x, y) => x - y);
  if (!v.length) return null;
  const i = Math.floor(v.length / 2);
  return v.length % 2 ? v[i] : (v[i - 1] + v[i]) / 2;
}

/** Standaard normale verdelingsfunctie. */
export function normCdf(z) {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp(-z * z / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
}

/** Protobuf-duur '3600s' of '1.5s' naar seconden. */
export function durSec(s) {
  if (s == null) return null;
  if (typeof s === 'number') return s;
  const m = /^(-?[\d.]+)s$/.exec(s);
  return m ? Number(m[1]) : Number(s) || null;
}

export function toNum(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function $(sel, root = document) { return root.querySelector(sel); }
export function $$(sel, root = document) { return [...root.querySelectorAll(sel)]; }

export function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}
