// Leefstijl-leeftijd (healthspan): transparante risico-leeftijd met onzekerheid.
//
// Per input: gemiddelde over het venster → jaren t.o.v. een referentie, via ln(HR)/0,087
// (Gompertz: sterfterisico verdubbelt grofweg elke 8 jaar). Dosis-responscurves uit:
//  VO2max  Mandsager 2018 / Kokkinos 2022 (≈ −1,5 jaar per MET)
//  Stappen Ding 2025 (7.000 vs 2.000/dag: 47% lager), plateau ~10k (Paluch 2022)
//  MVPA    Arem 2015 / Lee 2022 (inactief +4,3 j; 3–5× richtlijn −1,4 j)
//  Kracht  Momma 2022 (RR 0,85 bij 30–60 min/week)
//  Slaapregelmaat Windred 2024 (meest vs minst regelmatig HR ≈ 0,70)
//  Slaapduur  meta-analyse (<7 u HR 1,14; ≥9 u HR 1,34, afgezwakt)
//  Rusthartslag Zhang 2016 (RR 1,09 per 10 bpm)
// Overlap wordt per domein gecorrigeerd en het totaal gekrompen (0,5–0,7) en begrensd (±12 j).
// Klussen/werk tellen niet als fitheid (fysieke-activiteitsparadox, Holtermann).

import { addDays, mean, sd, clamp } from './util.js';

const lerp = (pts, x) => {
  if (x <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) if (x <= pts[i][0]) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i]; return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0); }
  return pts[pts.length - 1][1];
};

const VO2_REF = { m: [[20, 43], [30, 41], [40, 38.5], [50, 35], [60, 31.5], [70, 28], [80, 25]], v: [[20, 37], [30, 35], [40, 32.5], [50, 29], [60, 26.5], [70, 24], [80, 21.5]] };
export const vo2Ref = (age, sex) => lerp(VO2_REF[sex === 'v' ? 'v' : 'm'], age);

export const INPUTS = {
  vo2: {
    label: 'Cardiofitheid (VO₂max)', short: 'VO₂max', unit: 'ml/kg/min', domain: 'fitheid', rse: 0.08, digits: 0,
    curve: (v, c) => clamp(-1.5 * ((v - vo2Ref(c.age, c.sex)) / 3.5), -7, 7),
    ref: (c) => `${Math.round(vo2Ref(c.age, c.sex))} (gemiddeld voor je leeftijd)`,
    evidence: 'De sterkste voorspeller van levensduur. Mensen met een elite-conditie hadden 80% minder sterfterisico dan de laagste groep (Mandsager 2018, 122.007 mensen); ongeveer 12% minder risico per MET hogere fitheid.',
    lever: 'Twee keer per week 20–30 min echt hijgen (zone 4–5) verhoogt je VO₂max het snelst.',
  },
  rhr: {
    label: 'Rusthartslag', short: 'Rusthartslag', unit: 'bpm', domain: 'fitheid', rse: 0.13, digits: 0,
    curve: (v) => clamp(1.4 * ((v - 60) / 10), -3, 5),
    ref: () => '60 bpm',
    evidence: 'Per 10 slagen hoger: ongeveer 9% meer sterfterisico (Zhang 2016, meta-analyse). Telt deels mee, omdat het overlapt met VO₂max.',
    lever: 'Conditietraining, goed slapen en minder alcohol verlagen je rusthartslag.',
  },
  steps: {
    label: 'Stappen per dag', short: 'Stappen', unit: '/dag', domain: 'activiteit', rse: 0.2, digits: 0,
    curve: (v) => {
      const lnHr = v < 7000 ? 0.635 * ((7000 - v) / 5000) : -0.08 * (Math.min(v - 7000, 5000) / 5000);
      return clamp(lnHr / 0.087, -1.5, 9);
    },
    ref: () => '7.000 per dag',
    evidence: '7.000 tegenover 2.000 stappen per dag: 47% minder sterfterisico (Ding 2025, Lancet Public Health, 57 studies). Boven ±10.000 vlakt het voordeel af.',
    lever: 'Een wandeling van 20 minuten is ±2.000 stappen.',
  },
  mvpa: {
    label: 'Matig/zwaar bewegen', short: 'Beweging', unit: 'min/week', domain: 'activiteit', rse: 0.16, digits: 0,
    curve: (v) => lerp([[0, 4.3], [75, 1.8], [150, 0], [300, -0.8], [450, -1.4], [750, -1.5]], v),
    ref: () => '150 min per week (zwaar telt dubbel)',
    evidence: 'De beweegrichtlijn (150 min matig of 75 min zwaar per week) halen: ±31% minder sterfte; 3–5× de richtlijn: 39% minder (Arem 2015, 661.137 mensen). Klussen telt hier bewust niet mee.',
    lever: 'Elke 10 minuten stevig bewegen telt; zware minuten tellen dubbel.',
  },
  strength: {
    label: 'Krachttraining', short: 'Kracht', unit: 'min/week', domain: 'kracht', rse: 0.26, digits: 0,
    curve: (v) => lerp([[0, 1.9], [30, 0.3], [60, 0], [140, 0], [220, 0.4]], v),
    ref: () => '30–60 min per week',
    evidence: 'Spierversterkende training van 30–60 min per week: 10–20% minder sterfterisico (Momma 2022, meta-analyse). Meer dan ±2,5 uur geeft geen extra voordeel.',
    lever: 'Twee korte krachtsessies per week is al genoeg voor het volle effect.',
  },
  sleepReg: {
    label: 'Slaapregelmaat', short: 'Regelmaat', unit: 'min spreiding', domain: 'slaap', rse: 0.25, digits: 0,
    curve: (v) => lerp([[15, -2.0], [30, -1.0], [45, 0], [70, 1.0], [100, 2.0]], v),
    ref: () => '±45 min spreiding in bed- en wektijd',
    evidence: 'De meest regelmatige slapers hadden ±30% minder sterfterisico dan de minst regelmatige; regelmaat voorspelde beter dan slaapduur (Windred 2024, 60.977 mensen).',
    lever: 'Elke dag binnen een half uur hetzelfde opstaan, ook in het weekend.',
  },
  sleepDur: {
    label: 'Slaapduur', short: 'Slaapduur', unit: 'u', domain: 'slaap', rse: 0.13, digits: 1,
    curve: (v) => lerp([[4.5, 3.4], [5, 3.0], [6, 1.5], [7, 0], [8, 0], [9, 1.7], [10, 3.0]], v),
    ref: () => '7–8 uur',
    evidence: 'Korter dan 7 uur: ±14% meer risico; 9 uur of meer: ±34% (deels omdat zieke mensen langer slapen, daarom afgezwakt).',
    lever: 'Een half uur eerder naar bed is meestal de makkelijkste winst.',
  },
};

const ORDER = ['vo2', 'rhr', 'steps', 'mvpa', 'strength', 'sleepReg', 'sleepDur'];

function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
function gauss(r) { return Math.sqrt(-2 * Math.log(r() + 1e-12)) * Math.cos(2 * Math.PI * r()); }

/** Ruwe inputwaarden over een venster eindigend op `end`. */
export function windowValues(byDate, end, days, ctx) {
  const list = [];
  for (let i = days - 1; i >= 0; i--) { const d = byDate[addDays(end, -i)]; if (d) list.push(d); }
  const real = list.filter((d) => d.raw && !d.raw.empty);
  const steps = mean(real.map((d) => d.raw.steps).filter((v) => v > 300));
  const mv = real.filter((d) => d.strain && (d.raw.hr?.length || d.raw.azm));
  const mvpa = mv.length >= 7 ? mean(mv.map((d) => d.strain.mvpa || 0)) * 7 : null;
  // Krachtminuten: sessies (duur van gekoppelde Fitbit-workout, anders 60 min) of handmatige kracht-logs.
  const spanDays = Math.max(7, Math.min(days, list.length));
  let strMin = 0;
  for (const d of list) {
    const sess = (d.strain?.sessions || []).reduce((a, s) => a + (s.activity?.duration || 60), 0);
    const man = (d.strain?.manual || []).filter((a) => a.typeId === 'kracht').reduce((a, x) => a + x.duration, 0);
    strMin += Math.max(sess, man);
  }
  const strength = list.length >= 7 ? (strMin / spanDays) * 7 : null;
  const sleeps = real.map((d) => d.raw.sleep).filter((s) => s && s.asleep > 120);
  const sleepDur = sleeps.length >= 5 ? mean(sleeps.map((s) => s.asleep)) / 60 : null;
  let sleepReg = null;
  if (sleeps.length >= 7) {
    const tod = (ms) => { const x = new Date(ms); let m = x.getHours() * 60 + x.getMinutes(); if (m < 720) m += 1440; return m; };
    const tow = (ms) => { const x = new Date(ms); return x.getHours() * 60 + x.getMinutes(); };
    sleepReg = ((sd(sleeps.map((s) => tod(s.start))) || 0) + (sd(sleeps.map((s) => tow(s.end))) || 0)) / 2;
  }
  const rhr = mean(real.map((d) => d.raw.rhr ?? d.recovery?.rhr).filter(Boolean));
  let vo2 = mean(real.map((d) => d.raw.vo2max).filter(Boolean));
  let vo2Estimated = false;
  if (!vo2 && rhr && ctx.maxHr) { vo2 = 15.3 * (ctx.maxHr / rhr); vo2Estimated = true; }
  return { steps, mvpa, strength, sleepDur, sleepReg, rhr, vo2, vo2Estimated, nights: sleeps.length, days: real.length };
}

/** Jaren per input + gecombineerd totaal. */
function yearsFor(vals, ctx) {
  const y = {};
  for (const k of ORDER) y[k] = vals[k] != null && !isNaN(vals[k]) ? INPUTS[k].curve(vals[k], ctx) : null;
  return y;
}

function combine(y, shrink, vo2Estimated) {
  const g = (k) => y[k] ?? 0;
  const vo2W = vo2Estimated ? 0.7 : 1;
  const rhrW = vo2Estimated ? 0 : 0.4;
  const cardio = vo2W * g('vo2') + rhrW * g('rhr');
  const [a, b] = Math.abs(g('steps')) >= Math.abs(g('mvpa')) ? [g('steps'), g('mvpa')] : [g('mvpa'), g('steps')];
  const activity = a + 0.5 * b;
  const sleep = g('sleepReg') + 0.5 * g('sleepDur');
  const strength = g('strength');
  return clamp(shrink * (cardio + activity + sleep + strength), -12, 12);
}

/** Effectief gewicht van elke input in het totaal (voor de waterval). */
function weights(y, vo2Estimated) {
  const g = (k) => y[k] ?? 0;
  const bigSteps = Math.abs(g('steps')) >= Math.abs(g('mvpa'));
  return {
    vo2: vo2Estimated ? 0.7 : 1, rhr: vo2Estimated ? 0 : 0.4,
    steps: bigSteps ? 1 : 0.5, mvpa: bigSteps ? 0.5 : 1,
    strength: 1, sleepReg: 1, sleepDur: 0.5,
  };
}

export function computeHealthspan(byDate, end, ctx) {
  const SHRINK = 0.6;
  const age = ctx.age;
  const v180 = windowValues(byDate, end, 180, ctx);
  const v30 = windowValues(byDate, end, 30, ctx);
  const nights30 = v30.nights;
  const ready = !!age && nights30 >= 14;
  const y180 = yearsFor(v180, ctx);
  const y30 = yearsFor(v30, ctx);
  const d180 = combine(y180, SHRINK, v180.vo2Estimated);
  const d30 = combine(y30, SHRINK, v30.vo2Estimated);
  // Monte Carlo voor het interval.
  const r = rng(1234);
  const draws = [];
  for (let i = 0; i < 800; i++) {
    const yy = {};
    for (const k of ORDER) {
      if (y180[k] == null) { yy[k] = null; continue; }
      let v = y180[k] * (1 + INPUTS[k].rse * gauss(r));
      if (k === 'vo2') v += (-1.5 / 3.5) * gauss(r) * (v180.vo2Estimated ? 4 : 2);
      yy[k] = v;
    }
    draws.push(combine(yy, 0.5 + 0.2 * r(), v180.vo2Estimated));
  }
  draws.sort((a, b) => a - b);
  const q = (p) => draws[Math.floor(p * (draws.length - 1))];
  const w = weights(y180, v180.vo2Estimated);
  const inputs = ORDER.map((k) => ({
    key: k, ...INPUTS[k], value: v180[k], value30: v30[k],
    years: y180[k] == null ? null : SHRINK * w[k] * y180[k],
    years30: y30[k] == null ? null : SHRINK * w[k] * y30[k],
    missing: y180[k] == null, estimated: k === 'vo2' && v180.vo2Estimated,
  }));
  // Hefbomen: wat levert een haalbare verbetering op?
  const tryDelta = (key, delta, guard = () => true) => {
    if (v180[key] == null || !guard(v180[key])) return null;
    const vv = { ...v180, [key]: v180[key] + delta };
    return combine(yearsFor(vv, ctx), SHRINK, v180.vo2Estimated) - d180;
  };
  const levers = [
    { key: 'steps', text: '2.000 stappen per dag meer', gain: tryDelta('steps', 2000, (v) => v < 11000) },
    { key: 'mvpa', text: 'Een uur per week extra stevig bewegen', gain: tryDelta('mvpa', 60, (v) => v < 600) },
    { key: 'strength', text: 'Krachttraining naar 60 min per week', gain: tryDelta('strength', 60 - (v180.strength || 0), (v) => v < 55) },
    { key: 'sleepDur', text: 'Een half uur langer slapen', gain: tryDelta('sleepDur', 0.5, (v) => v < 7.5) },
    { key: 'sleepReg', text: 'Regelmatiger slapen (15 min minder spreiding)', gain: tryDelta('sleepReg', -15, (v) => v > 25) },
    { key: 'vo2', text: 'VO₂max 3 punten omhoog', gain: v180.vo2Estimated ? null : tryDelta('vo2', 3) },
  ].filter((l) => l.gain != null && l.gain < -0.05).sort((a, b) => a.gain - b.gain);
  const tempo = clamp(1 + 0.5 * (d30 - d180), -1, 3);
  return {
    ready, age, nights30, days: v180.days, provisional: v180.days < 60,
    delta: d180, lifestyleAge: age ? age + d180 : null,
    lo: age ? age + q(0.1) : null, hi: age ? age + q(0.9) : null,
    tempo, d30, inputs, levers, vo2Estimated: v180.vo2Estimated,
  };
}

/** Weekelijkse historie (puntschatting) voor de trendgrafiek. */
export function healthspanHistory(byDate, end, ctx, weeks = 12) {
  const out = [];
  const d = new Date(end + 'T12:00');
  const back = (d.getDay() + 7) % 7; // laatste zondag
  for (let w = weeks - 1; w >= 0; w--) {
    const e = addDays(end, -back - w * 7);
    const v = windowValues(byDate, e, 180, ctx);
    if (v.nights < 10) { out.push({ date: e, value: null }); continue; }
    out.push({ date: e, value: ctx.age + combine(yearsFor(v, ctx), 0.6, v.vo2Estimated) });
  }
  if (out.length && out[out.length - 1].date !== end) {
    const v = windowValues(byDate, end, 180, ctx);
    if (v.nights >= 10) out.push({ date: end, value: ctx.age + combine(yearsFor(v, ctx), 0.6, v.vo2Estimated) });
  }
  return out;
}
