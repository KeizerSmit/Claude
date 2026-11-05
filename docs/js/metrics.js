// WHOOP-achtige interpretatie van Fitbit-data: Recovery, Strain en Sleep.
//
// Strain (0–21): logaritmische schaal van cardiovasculaire belasting (TRIMP op basis van
//   hartslagreserve, minuut voor minuut) plus spierbelasting uit je krachtlog.
// Recovery (0–100%): HRV (zwaarst), rusthartslag, slaapprestatie, ademhaling en
//   huidtemperatuur, telkens ten opzichte van je eigen 30-daagse baseline.
// Sleep: slaapbehoefte = basis + extra door strain van gisteren + slaapschuld − dutjes.

import { mean, sd, clamp, normCdf, addDays, median } from './util.js';
import { computeLoads, MUSCULAR_TO_TRIMP, templateBaselines } from './strength.js';
import { estimateActivity, nonFitnessWindows, typeById, RPE_HRR } from './activities.js';

export const STRAIN_K = 110;

/** Omgekeerde van strainFromTrimp: hoeveel TRIMP is nodig voor een strain-score? */
export function trimpForStrain(s) {
  if (!s || s <= 0) return 0;
  return -STRAIN_K * Math.log(1 - Math.min(s, 20.9) / 21);
}

/** TRIMP per minuut bij een bepaalde %hartslagreserve (Banister). */
export function trimpPerMinute(hrr, female = false) {
  const h = Math.min(Math.max(hrr, 0), 1.05);
  return female ? h * 0.86 * Math.exp(1.67 * h) : h * 0.64 * Math.exp(1.92 * h);
}

export function strainFromTrimp(t) {
  if (!t || t < 0) return 0;
  return 21 * (1 - Math.exp(-t / STRAIN_K));
}

export function trimpFromStrain(s) {
  return -STRAIN_K * Math.log(1 - clamp(s, 0, 20.99) / 21);
}

export function recoveryColor(score) {
  if (score == null) return 'var(--muted)';
  if (score >= 67) return 'var(--green)';
  if (score >= 34) return 'var(--yellow)';
  return 'var(--red)';
}

export function recoveryZone(score) {
  if (score == null) return null;
  return score >= 67 ? 'green' : score >= 34 ? 'yellow' : 'red';
}

export function strainTarget(recovery) {
  if (recovery == null) return null;
  const c = 5 + recovery * 0.12;
  return [clamp(c - 2, 0, 21), clamp(c + 2, 0, 21)];
}

export function strainLabel(s) {
  if (s == null) return '';
  if (s < 10) return 'Licht';
  if (s < 14) return 'Gemiddeld';
  if (s < 18) return 'Zwaar';
  return 'Maximaal';
}

export const ZONES = [
  { id: 1, name: 'Zone 1', lo: 0.5, hi: 0.6, color: 'var(--z1)' },
  { id: 2, name: 'Zone 2', lo: 0.6, hi: 0.7, color: 'var(--z2)' },
  { id: 3, name: 'Zone 3', lo: 0.7, hi: 0.8, color: 'var(--z3)' },
  { id: 4, name: 'Zone 4', lo: 0.8, hi: 0.9, color: 'var(--z4)' },
  { id: 5, name: 'Zone 5', lo: 0.9, hi: 2.0, color: 'var(--z5)' },
];

export function maxHr(settings, profile, days) {
  if (settings.maxHr) return settings.maxHr;
  const age = settings.age || profile?.age || 30;
  const formula = 208 - 0.7 * age;
  let observed = 0;
  for (const d of days) if (d.hrMax && d.hrMax > observed) observed = d.hrMax;
  return Math.round(Math.max(formula, Math.min(observed, 225)));
}

function trimpMinute(hr, rest, max, female) {
  const hrr = (hr - rest) / (max - rest);
  if (hrr < 0.2) return 0;
  return trimpPerMinute(hrr, female);
}

function inSleep(t, day) {
  if (day.sleep && t >= day.sleep.start && t < day.sleep.end) return true;
  if (day.sleepNext && t >= day.sleepNext.start && t < day.sleepNext.end) return true;
  for (const n of day.naps || []) if (t >= n.start && t < n.end) return true;
  return false;
}

/** Strain-berekening voor één dag (zonder kracht). */
function cardio(day, rest, max, female, workWin = []) {
  const zones = [0, 0, 0, 0, 0];
  let trimp = 0;
  let mod = 0, vig = 0;
  let hasHr = false;
  let peak = 0;
  if (day.hr && day.hr.length) {
    for (let i = 0; i < day.hr.length; i++) {
      const hr = day.hr[i];
      if (!hr) continue;
      hasHr = true;
      const t = day.hrStart + i * 60000;
      if (inSleep(t, day)) continue;
      if (hr > peak) peak = hr;
      trimp += trimpMinute(hr, rest, max, female);
      // Matig/zwaar voor healthspan — niet tijdens werk/klussen (dat telt niet als fitheid).
      const hrr = (hr - rest) / (max - rest);
      if (hrr >= 0.4 && !workWin.some(([a, b]) => t >= a && t < b)) { if (hrr >= 0.6) vig++; else mod++; }
      const pct = hr / max;
      for (let z = ZONES.length - 1; z >= 0; z--) if (pct >= ZONES[z].lo) { zones[z]++; break; }
    }
  }
  let estimated = false;
  if (!hasHr) {
    estimated = true;
    const a = day.azm || {};
    trimp = (a.fatBurn || 0) * 0.9 + (a.cardio || 0) * 2.0 + (a.peak || 0) * 3.5 + ((day.steps || 0) / 1000) * 1.2;
    mod = a.fatBurn || 0; vig = (a.cardio || 0) + (a.peak || 0);
  }
  const activities = (day.exercises || []).map((ex) => {
    let t = 0, n = 0, mx = 0;
    if (hasHr) {
      const i0 = Math.max(0, Math.floor((ex.start - day.hrStart) / 60000));
      const i1 = Math.min(day.hr.length, Math.ceil((ex.end - day.hrStart) / 60000));
      for (let i = i0; i < i1; i++) {
        const hr = day.hr[i];
        if (!hr) continue;
        n++; t += trimpMinute(hr, rest, max, female); if (hr > mx) mx = hr;
      }
    }
    if (!n && ex.avgHr) t = (ex.duration || 0) * trimpMinute(ex.avgHr, rest, max, female);
    return { ...ex, trimp: t, strain: strainFromTrimp(t), maxHr: mx || ex.maxHr || null };
  });
  return { trimp, zones, activities, estimated, hasHr, peak, mvpa: mod + 2 * vig, mod, vig };
}

function sleepMetrics(day, prev, settings, history) {
  const s = day.sleep;
  if (!s) return null;
  const base = settings.sleepNeed || 450;
  const prevStrain = prev?.strain?.score ?? null;
  const strainNeed = prevStrain != null ? clamp((prevStrain - 8) * 3, 0, 40) : 0;
  const deficits = history.slice(-3).reverse().map((h) => (h.sleep ? Math.max(0, h.sleep.need - h.sleep.asleep) : 0));
  const debt = clamp(0.3 * (deficits[0] || 0) + 0.15 * (deficits[1] || 0) + 0.05 * (deficits[2] || 0), 0, 60);
  const napMin = (day.naps || []).reduce((a, n) => a + (n.asleep || 0), 0);
  const need = Math.max(240, base + strainNeed + debt - napMin);
  const asleep = s.asleep;
  const perf = clamp(asleep / need, 0, 1);
  const efficiency = s.inBed ? clamp(asleep / s.inBed, 0, 1) : null;

  // Consistentie: hoe constant zijn bed- en wektijden over de laatste 4 nachten?
  const nights = [...history.slice(-3).map((h) => h.raw?.sleep).filter(Boolean), s];
  let consistency = null;
  if (nights.length >= 2) {
    const tod = (ms) => { const d = new Date(ms); let m = d.getHours() * 60 + d.getMinutes(); if (m < 720) m += 1440; return m; };
    const tow = (ms) => { const d = new Date(ms); return d.getHours() * 60 + d.getMinutes(); };
    const beds = nights.map((n) => tod(n.start));
    const wakes = nights.map((n) => tow(n.end));
    const mb = mean(beds), mw = mean(wakes);
    const dev = (mean(beds.map((b) => Math.abs(b - mb))) + mean(wakes.map((w) => Math.abs(w - mw)))) / 2;
    consistency = clamp(Math.round(100 - dev * 1.1), 0, 100);
  }
  const restorative = (s.deep || 0) + (s.rem || 0);
  return {
    need, needParts: { base, strain: strainNeed, debt, nap: -napMin },
    asleep, inBed: s.inBed, awake: s.awake, perf, efficiency, consistency,
    restorative, restorativePct: asleep ? restorative / asleep : null,
    deep: s.deep, rem: s.rem, light: s.light, latency: s.latency, awakenings: s.awakenings,
    start: s.start, end: s.end, stages: s.stages, classic: s.classic,
  };
}

function baselineOf(history, pick, days = 30) {
  // Zieke dagen tellen niet mee: ziekte mag je 'normaal' niet verschuiven.
  const vals = history.filter((h) => h.flag !== 'sick').slice(-days).map((h) => pick(h.raw)).filter((v) => v != null && !isNaN(v) && v > 0);
  return vals;
}

function recoveryMetrics(day, sleep, history) {
  const hrv = day.hrv ?? day.hrvDeep ?? null;
  const rhr = day.sleepHr ?? day.rhr ?? null;
  const resp = day.resp ?? null;
  const hrvVals = baselineOf(history, (d) => d.hrv ?? d.hrvDeep);
  const rhrVals = baselineOf(history, (d) => d.sleepHr ?? d.rhr);
  const respVals = baselineOf(history, (d) => d.resp);
  if (hrv == null && rhr == null) return null;

  const calibrating = hrvVals.length < 4;
  const lnH = hrvVals.map(Math.log);
  const bHrv = calibrating ? null : { mean: Math.exp(mean(lnH)), lnMean: mean(lnH), lnSd: Math.max(sd(lnH) || 0, 0.08), n: hrvVals.length };
  const bRhr = rhrVals.length >= 4 ? { mean: mean(rhrVals), sd: Math.max(sd(rhrVals) || 0, 2) } : null;
  const bResp = respVals.length >= 4 ? { mean: mean(respVals), sd: Math.max(sd(respVals) || 0, 0.4) } : null;

  const z = {};
  const z3 = (v) => clamp(v, -3, 3);
  // Zonder baseline gebruiken we populatiewaarden zodat je toch een indicatie krijgt.
  z.hrv = hrv != null ? z3(bHrv ? (Math.log(hrv) - bHrv.lnMean) / bHrv.lnSd : (Math.log(hrv) - Math.log(45)) / 0.35) : 0;
  z.rhr = rhr != null ? z3(bRhr ? -(rhr - bRhr.mean) / bRhr.sd : -(rhr - 58) / 6) : 0;
  z.sleep = sleep ? z3((sleep.perf - 0.85) / 0.12) : 0;
  z.resp = resp != null && bResp ? z3(Math.min(0, -(resp - bResp.mean) / bResp.sd) + 0.2) : 0;
  const tDev = day.tempDev;
  z.temp = tDev != null ? z3(tDev > 0.3 ? -(tDev - 0.3) / 0.25 : 0) : 0;

  const w = { hrv: 0.5, rhr: 0.2, sleep: 0.2, resp: 0.05, temp: 0.05 };
  if (hrv == null) { w.rhr += 0.3; w.hrv = 0; }
  const composite = w.hrv * z.hrv + w.rhr * z.rhr + w.sleep * z.sleep + w.resp * z.resp + w.temp * z.temp;
  const score = clamp(Math.round(100 * normCdf(0.95 * composite + 0.25)), 1, 99);

  return {
    score, calibrating, z, weights: w, composite,
    hrv, rhr, resp, spo2: day.spo2 ?? null, tempDev: tDev ?? null,
    baseline: {
      hrv: bHrv?.mean ?? (hrvVals.length ? Math.exp(mean(hrvVals.map(Math.log))) : null),
      rhr: bRhr?.mean ?? (rhrVals.length ? mean(rhrVals) : null),
      resp: bResp?.mean ?? (respVals.length ? mean(respVals) : null),
      days: hrvVals.length,
    },
  };
}

/**
 * Bereken alles. days: array van dag-objecten (zie sync.js), strengthDoc: {sessions, exerciseMap}.
 * Geeft {byDate, loads, maxHr}.
 */
export function computeAll(days, strengthDoc, settings, profile) {
  const sorted = [...days].sort((a, b) => (a.date < b.date ? -1 : 1));
  const female = settings.sex === 'v';
  const max = maxHr(settings, profile, sorted);
  const sessions = (strengthDoc?.sessions || []).filter((s) => !s.deleted);
  const loads = computeLoads(sessions, { ...settings, exerciseMap: strengthDoc?.exerciseMap || {}, baselines: templateBaselines(strengthDoc, settings.bodyweight) });
  const sessionsByDate = {};
  for (const s of sessions) if (s.date) (sessionsByDate[s.date] ||= []).push(s);
  const actsByDate = {};
  for (const a of strengthDoc?.activities || []) if (!a.deleted && a.date) (actsByDate[a.date] ||= []).push(a);
  const weights = (strengthDoc?.weights || []).filter((w) => !w.deleted && w.kg).sort((a, b) => (a.date < b.date ? -1 : 1));
  const kgAt = (date) => { let k = settings.bodyweight || 80; for (const w of weights) if (w.date <= date) k = w.kg; return k; };
  let lastVo2 = null;
  const flags = {};
  // RPE-ijking: verhouding gemeten %HRR / verwachte %HRR bij activiteiten met goede hartslagdekking.
  const rpeRatios = { sport: [], werk: [] };
  const rpeScale = () => Object.fromEntries(Object.entries(rpeRatios).map(([k, v]) => [k, v.length >= 3 ? clamp(median(v.slice(-12)), 0.7, 1.3) : 1]));
  for (const f of strengthDoc?.flags || []) if (!f.deleted && f.date) flags[f.date] = f.kind;

  // Zorg dat ook dagen met alleen een krachtlog (zonder Fitbit-data) meetellen.
  const known = new Set(sorted.map((d) => d.date));
  for (const f of strengthDoc?.flags || []) if (!f.deleted && f.date && f.date <= addDays(sorted[sorted.length - 1]?.date || f.date, 1)) actsByDate[f.date] ||= [];
  for (const date of [...Object.keys(sessionsByDate), ...Object.keys(actsByDate)]) if (!known.has(date)) { known.add(date); sorted.push({ date, empty: true }); }
  sorted.sort((a, b) => (a.date < b.date ? -1 : 1));

  const byDate = {};
  const history = [];
  const rhrAll = sorted.map((d) => d.rhr).filter(Boolean);
  const fallbackRest = median(rhrAll) || 60;
  const rawByDate = {};
  for (const d of sorted) rawByDate[d.date] = d;
  for (const day of sorted) {
    const prev = history[history.length - 1];
    const nextRaw = rawByDate[addDays(day.date, 1)];
    if (!day.empty) day.sleepNext = nextRaw?.sleep || null;
    const rest = day.rhr || (prev?.raw?.rhr) || fallbackRest;
    const manualActs = actsByDate[day.date] || [];
    const c = day.empty ? { trimp: 0, zones: [0, 0, 0, 0, 0], activities: [], estimated: true, hasHr: false, mvpa: 0 } : cardio(day, rest, max, female, nonFitnessWindows(manualActs));
    if (day.vo2max) lastVo2 = day.vo2max;
    const ctx = { rest, max, female, vo2max: day.vo2max || lastVo2 || null, kg: kgAt(day.date), rpeScale: rpeScale() };
    const manual = manualActs.map((a) => ({ ...a, est: estimateActivity(a, day.empty ? null : day, ctx) })).sort((a, b) => a.start - b.start);
    for (const a of manual) {
      if (a.rpe == null || a.est.coverage < 0.8 || !a.est.avgHr) continue;
      const obs = (a.est.avgHr - rest) / (max - rest) / Math.max(0.3, a.est.active);
      const exp = RPE_HRR[clamp(Math.round(a.rpe), 0, 10)];
      if (obs > 0 && exp) rpeRatios[a.est.type.cat === 'sport' ? 'sport' : 'werk'].push(obs / exp);
    }
    // Fitbit-sessie die samenvalt met een handmatige log: verbergen (de log is leidend, de hartslag telt al).
    for (const a of c.activities) {
      const m = manual.find((x) => Math.min(a.end, x.est.end) - Math.max(a.start, x.start) > 0.5 * Math.min(a.end - a.start, x.est.end - x.start));
      if (m) { a.linkedManual = m.id; m.fitbit = a; }
    }
    const estTrimp = manual.reduce((x, a) => x + a.est.estimated + a.est.muscular, 0);
    const daySessions = (sessionsByDate[day.date] || []).map((s) => ({ ...s, ...loads[s.id], muscularTrimp: (loads[s.id]?.load || 0) * MUSCULAR_TO_TRIMP }));
    // Koppel krachtsessie aan een Fitbit-activiteit (krachttraining) op dezelfde dag.
    for (const s of daySessions) {
      if (s.start && s.duration) {
        // Expliciete start/duur: hartslag in dat venster + overlappende Fitbit-workout koppelen.
        const end = s.start + s.duration * 60000;
        const ov = c.activities.find((a) => !a.linked && Math.min(a.end, end) - Math.max(a.start, s.start) > 0.5 * Math.min(a.end - a.start, end - s.start));
        let n = 0, sum = 0, mx = 0, tr = 0;
        if (day.hr?.length) {
          const i0 = Math.max(0, Math.floor((s.start - day.hrStart) / 60000));
          const i1 = Math.min(day.hr.length, Math.ceil((end - day.hrStart) / 60000));
          for (let i = i0; i < i1; i++) { const v = day.hr[i]; if (!v) continue; n++; sum += v; if (v > mx) mx = v; tr += trimpMinute(v, rest, max, female); }
        }
        s.hrWindow = { coverage: n / s.duration, avg: n ? Math.round(sum / n) : null, max: mx || null, trimp: tr };
        if (ov) { ov.linked = s.id; s.activity = ov; }
        else s.activity = { id: `sess-${s.id}`, name: s.name || 'Krachttraining', type: 'STRENGTH', start: s.start, end, duration: s.duration, avgHr: s.hrWindow.avg, maxHr: s.hrWindow.max, trimp: tr, strain: strainFromTrimp(tr), fromLog: true };
        continue;
      }
      const act = c.activities.find((a) => !a.linked && /weight|strength|kracht|gym|lift|training|workout/i.test(`${a.type} ${a.name}`));
      if (act) { act.linked = s.id; s.activity = act; }
    }
    const muscular = daySessions.reduce((a, s) => a + s.muscularTrimp, 0);
    const total = c.trimp + muscular + estTrimp;
    const strain = {
      score: strainFromTrimp(total), cardio: strainFromTrimp(c.trimp), cardioTrimp: c.trimp,
      muscularTrimp: muscular, estTrimp, manual, mvpa: c.mvpa || 0, trimp: total, zones: c.zones, activities: c.activities,
      sessions: daySessions, estimated: c.estimated, hasHr: c.hasHr, peakHr: c.peak || null,
    };
    const entry = { date: day.date, raw: day, strain };
    entry.sleep = day.empty ? null : sleepMetrics(day, prev, settings, history);
    entry.recovery = day.empty ? null : recoveryMetrics(day, entry.sleep, history);
    entry.flag = flags[day.date] || null;
    entry.target = entry.flag === 'sick' ? [0, 6] : entry.flag === 'rest' ? [0, 9] : strainTarget(entry.recovery?.score);
    byDate[day.date] = entry;
    if (!day.empty) history.push(entry);
  }
  const rpeCal = Object.fromEntries(Object.entries(rpeRatios).map(([k, v]) => [k, { n: v.length, scale: rpeScale()[k] }]));
  return { byDate, loads, maxHr: max, rpeCal };
}

/** Korte, WHOOP-achtige inzichten in gewone taal. */
export function insights(m) {
  const out = [];
  const r = m?.recovery;
  if (r) {
    const zone = recoveryZone(r.score);
    if (m.flag === 'sick') out.push({ icon: 'info', text: 'Ziek-modus staat aan: deze dag telt niet mee in je persoonlijke baseline. Rust, drink genoeg en sla zware training over.' });
    else if (r.tempDev != null && r.tempDev >= 0.5 && r.rhr && r.baseline.rhr && r.rhr - r.baseline.rhr >= 3) out.push({ icon: 'temp', text: 'Hogere huidtemperatuur én rusthartslag tegelijk: mogelijk word je ziek. Doe het rustig aan; zet zo nodig ziek-modus aan via ＋.' });
    if (r.calibrating) out.push({ icon: 'info', text: `Nog aan het kalibreren: er zijn ${r.baseline.days} van de 4 nachten nodig voor een persoonlijke baseline.` });
    if (zone === 'green') out.push({ icon: 'bolt', text: 'Je lichaam is goed hersteld. Een zware training past vandaag prima.' });
    else if (zone === 'yellow') out.push({ icon: 'gauge', text: 'Gemiddeld hersteld. Train gerust, maar houd het gecontroleerd.' });
    else out.push({ icon: 'bed', text: 'Laag herstel. Kies voor rust, mobiliteit of een lichte sessie.' });
    if (r.hrv && r.baseline.hrv) {
      const p = (r.hrv / r.baseline.hrv - 1) * 100;
      if (Math.abs(p) >= 8) out.push({ icon: p > 0 ? 'up' : 'down', text: `HRV ${Math.round(r.hrv)} ms, ${Math.abs(Math.round(p))}% ${p > 0 ? 'boven' : 'onder'} je baseline.` });
    }
    if (r.rhr && r.baseline.rhr) {
      const d = r.rhr - r.baseline.rhr;
      if (d >= 3) out.push({ icon: 'heart', text: `Rusthartslag ${Math.round(d)} slagen hoger dan normaal. Kan wijzen op vermoeidheid, alcohol, stress of beginnende ziekte.` });
      else if (d <= -3) out.push({ icon: 'heart', text: `Rusthartslag ${Math.round(-d)} slagen lager dan normaal — een goed teken.` });
    }
    if (m.flag !== 'sick' && r.tempDev != null && r.tempDev >= 0.5) out.push({ icon: 'temp', text: `Huidtemperatuur ${r.tempDev.toFixed(1).replace('.', ',')} °C boven je baseline.` });
  }
  const s = m?.sleep;
  if (s) {
    const diff = s.asleep - s.need;
    if (diff < -30) out.push({ icon: 'moon', text: `Je sliep ${Math.round(-diff)} min minder dan je lichaam nodig had.` });
    else if (diff >= 0) out.push({ icon: 'moon', text: 'Je hebt je slaapbehoefte volledig gehaald.' });
  }
  if (m?.target) out.push({ icon: 'target', text: `Optimale strain voor deze dag: ${m.target[0].toFixed(1).replace('.', ',')} – ${m.target[1].toFixed(1).replace('.', ',')}.` });
  return out;
}

/** Aanbevolen bedtijd om morgen je slaapbehoefte te halen. */
export function bedtimeAdvice(m, wakeMin = 7 * 60) {
  if (!m) return null;
  const strainNeed = clamp(((m.strain?.score || 0) - 8) * 3, 0, 40);
  const base = (m.sleep?.needParts?.base) || 450;
  const debt = m.sleep ? Math.max(0, m.sleep.need - m.sleep.asleep) * 0.3 : 0;
  const need = base + strainNeed + debt;
  const eff = m.sleep?.efficiency || 0.9;
  const inBed = need / eff;
  let bed = wakeMin - inBed;
  if (bed < 0) bed += 1440;
  return { need, inBed, bed };
}

export function lastDays(byDate, end, n) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = addDays(end, -i);
    out.push(byDate[d] || { date: d });
  }
  return out;
}
