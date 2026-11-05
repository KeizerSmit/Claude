// Automatische inzichten: wat beïnvloedt jouw herstel? Zonder dagboek — alles komt uit je data.
// Per kenmerk vergelijken we het herstel op de volgende ochtend tussen "ja"- en "nee"-dagen
// (Welch t-toets voor de zekerheid). Correlatie is geen oorzaak; dat zeggen we er ook bij.
import { addDays, mean, sd, parseYmd } from './util.js';
import { typeById } from './activities.js';

const FEATURES = [
  { key: 'hiStrain', label: 'Zware dag (strain ≥ 14)', test: (p) => (p.strain?.score ?? null) == null ? null : p.strain.score >= 14 },
  { key: 'shortSleep', label: 'Minder dan 7 uur geslapen', night: true, test: (p, d) => (d.sleep ? d.sleep.asleep < 420 : null) },
  { key: 'lateBed', label: 'Later naar bed dan normaal (+45 min)', night: true, test: (p, d, ctx) => (d.sleep && ctx.medBed != null ? bedMin(d.sleep.start) > ctx.medBed + 45 : null) },
  { key: 'legs', label: 'Benen getraind', test: (p) => (p.strain ? (p.strain.sessions || []).some((s) => (s.groups?.quads || 0) + (s.groups?.hamstrings || 0) + (s.groups?.billen || 0) > 2) : null) },
  { key: 'gym', label: 'Krachttraining gedaan', test: (p) => (p.strain ? (p.strain.sessions || []).length > 0 : null) },
  { key: 'work', label: '2+ uur geklust / fysiek werk', test: (p) => (p.strain ? (p.strain.manual || []).filter((a) => typeById(a.typeId).cat !== 'sport').reduce((x, a) => x + a.duration, 0) >= 120 : null) },
  { key: 'steps', label: '12.000+ stappen', test: (p) => (p.raw?.steps != null ? p.raw.steps >= 12000 : null) },
  { key: 'weekend', label: 'Weekendnacht (vr/za)', night: true, test: (p) => { const dow = parseYmd(p.date).getDay(); return dow === 5 || dow === 6; } },
];

function bedMin(ms) { const x = new Date(ms); let m = x.getHours() * 60 + x.getMinutes(); if (m < 720) m += 1440; return m; }

function welch(a, b) {
  const sa = sd(a) || 0, sb = sd(b) || 0;
  const se = Math.sqrt((sa * sa) / a.length + (sb * sb) / b.length) || 1;
  return (mean(a) - mean(b)) / se;
}

/** Bereken alle patronen over de laatste `days` dagen. */
export function recoveryPatterns(byDate, end, days = 120) {
  const pairs = [];
  const beds = [];
  for (let i = days; i >= 0; i--) {
    const d = byDate[addDays(end, -i)];
    if (d?.sleep) beds.push(bedMin(d.sleep.start));
  }
  const sorted = [...beds].sort((x, y) => x - y);
  const ctx = { medBed: sorted.length ? sorted[Math.floor(sorted.length / 2)] : null };
  for (let i = days; i >= 0; i--) {
    const date = addDays(end, -i);
    const d = byDate[date];
    const p = byDate[addDays(date, -1)];
    if (!d?.recovery || !p) continue;
    pairs.push({ d, p });
  }
  const res = [];
  for (const f of FEATURES) {
    const yes = [], no = [], hYes = [], hNo = [];
    for (const { d, p } of pairs) {
      const v = f.test(p, d, ctx);
      if (v == null) continue;
      (v ? yes : no).push(d.recovery.score);
      if (d.recovery.hrv) (v ? hYes : hNo).push(d.recovery.hrv);
    }
    const enough = yes.length >= 4 && no.length >= 4;
    const diff = enough ? mean(yes) - mean(no) : null;
    const t = enough ? welch(yes, no) : 0;
    const hrvPct = hYes.length >= 4 && hNo.length >= 4 ? (mean(hYes) / mean(hNo) - 1) * 100 : null;
    res.push({ ...f, nYes: yes.length, nNo: no.length, enough, diff, t, hrvPct, strength: !enough ? 'te weinig data' : Math.abs(t) >= 2.5 ? 'duidelijk' : Math.abs(t) >= 1.5 ? 'waarschijnlijk' : 'onzeker' });
  }
  return { list: res.sort((a, b) => (b.enough - a.enough) || Math.abs(b.diff || 0) - Math.abs(a.diff || 0)), pairs: pairs.length };
}

/** Kleinste-kwadraten (normaalvergelijkingen) met ridge-regularisatie. X: rijen met features, y: doel. */
function ols(X, y, lambda = 1) {
  const k = X[0].length;
  const A = Array.from({ length: k }, () => new Array(k).fill(0));
  const b = new Array(k).fill(0);
  for (let r = 0; r < X.length; r++) for (let i = 0; i < k; i++) { b[i] += X[r][i] * y[r]; for (let j = 0; j < k; j++) A[i][j] += X[r][i] * X[r][j]; }
  for (let i = 1; i < k; i++) A[i][i] += lambda; // intercept niet straffen
  // Gauss-eliminatie
  for (let i = 0; i < k; i++) {
    let p = i; for (let r = i + 1; r < k; r++) if (Math.abs(A[r][i]) > Math.abs(A[p][i])) p = r;
    [A[i], A[p]] = [A[p], A[i]]; [b[i], b[p]] = [b[p], b[i]];
    if (Math.abs(A[i][i]) < 1e-9) return null;
    for (let r = i + 1; r < k; r++) { const f = A[r][i] / A[i][i]; for (let j = i; j < k; j++) A[r][j] -= f * A[i][j]; b[r] -= f * b[i]; }
  }
  const w = new Array(k).fill(0);
  for (let i = k - 1; i >= 0; i--) { let s = b[i]; for (let j = i + 1; j < k; j++) s -= A[i][j] * w[j]; w[i] = s / A[i][i]; }
  return w;
}

/**
 * Persoonlijk voorspelmodel voor het herstel van morgen:
 * herstel(morgen) ≈ a + b·herstel(vandaag) + c·strain(vandaag) + d·slaapuren(komende nacht).
 * Geeft null als er te weinig data is (< 30 paren).
 */
export function recoveryForecastModel(byDate, end, days = 150) {
  const X = [], y = [];
  for (let i = days; i >= 0; i--) {
    const d0 = byDate[addDays(end, -i - 1)], d1 = byDate[addDays(end, -i)];
    if (!d0?.recovery || !d1?.recovery || !d1.sleep || d0.flag === 'sick' || d1.flag === 'sick') continue;
    X.push([1, d0.recovery.score / 10, (d0.strain?.score || 0), d1.sleep.asleep / 60]);
    y.push(d1.recovery.score);
  }
  if (X.length < 30) return null;
  const w = ols(X, y, 2);
  if (!w) return null;
  const pred = X.map((r) => r.reduce((a, v, i) => a + v * w[i], 0));
  const res = y.map((v, i) => v - pred[i]);
  const rse = sd(res) || 15;
  return {
    n: X.length, w, rse,
    perHourSleep: w[3], perStrain: w[2],
    predict(recToday, strainToday, sleepHours) {
      const v = w[0] + w[1] * (recToday / 10) + w[2] * strainToday + w[3] * sleepHours;
      return Math.max(1, Math.min(99, v));
    },
  };
}
