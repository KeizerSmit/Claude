// Haalt data op uit de Google Health API en zet het om naar compacte dag-objecten.
import { listDataPoints, dailyRollUp, rollUp, getProfile, getUserInfo, AuthError } from './api.js';
import { days as daysStore, kv } from './store.js';
import { ymd, addDays, today, parseYmd, toNum, durSec, pad } from './util.js';
import { setUser } from './auth.js';

const INITIAL_DAYS = 45;

export function dateOf(d) {
  if (!d) return null;
  if (typeof d === 'string') return d.slice(0, 10);
  if (d.year) return `${d.year}-${pad(d.month)}-${pad(d.day)}`;
  if (d.date) return dateOf(d.date);
  return null;
}

const ms = (iso) => (iso ? Date.parse(iso) : null);

function stageType(t) {
  const s = String(t || '').toUpperCase();
  if (s.includes('DEEP')) return 'deep';
  if (s.includes('REM')) return 'rem';
  if (s.includes('LIGHT')) return 'light';
  if (s.includes('AWAKE') || s.includes('WAKE')) return 'awake';
  if (s.includes('RESTLESS')) return 'restless';
  if (s.includes('ASLEEP') || s.includes('SLEEP')) return 'asleep';
  if (s.includes('OUT')) return 'awake';
  return 'light';
}

/** Zet een sleep-datapunt om. */
export function convertSleep(dp) {
  const s = dp.sleep;
  if (!s?.interval) return null;
  const start = ms(s.interval.startTime), end = ms(s.interval.endTime);
  const sum = s.summary || {};
  const stages = (s.stages || []).map((st) => [stageType(st.type), ms(st.startTime), ms(st.endTime)]).filter((x) => x[1] && x[2]).sort((a, b) => a[1] - b[1]);
  const byType = {};
  for (const ss of sum.stagesSummary || []) byType[stageType(ss.type)] = { min: toNum(ss.minutes) || 0, count: toNum(ss.count) || 0 };
  const fromStages = (type) => stages.filter((x) => x[0] === type).reduce((a, x) => a + (x[2] - x[1]) / 60000, 0);
  const minutesOf = (type) => (byType[type] ? byType[type].min : fromStages(type));
  const classic = !stages.some((x) => x[0] === 'deep' || x[0] === 'rem') && !byType.deep && !byType.rem;
  const inBed = toNum(sum.minutesInSleepPeriod) ?? Math.round((end - start) / 60000);
  const awake = toNum(sum.minutesAwake) ?? (minutesOf('awake') + minutesOf('restless'));
  const asleep = toNum(sum.minutesAsleep) ?? Math.max(0, inBed - awake);
  const awakeStages = stages.filter((x) => x[0] === 'awake');
  const awakenings = byType.awake?.count ?? Math.max(0, awakeStages.length - (awakeStages.length && awakeStages[awakeStages.length - 1][2] >= end - 60000 ? 1 : 0));
  return {
    start, end, inBed, asleep, awake,
    deep: classic ? null : minutesOf('deep'),
    rem: classic ? null : minutesOf('rem'),
    light: classic ? (minutesOf('asleep') || asleep) : minutesOf('light'),
    latency: toNum(sum.minutesToFallAsleep),
    awakenings,
    stages,
    classic,
    main: s.metadata?.mainSleep ?? null,
    nap: s.metadata?.nap ?? null,
    endDate: dateOf(s.interval.civilEndTime?.date) || ymd(new Date(end)),
  };
}

export function convertExercise(dp) {
  const e = dp.exercise;
  if (!e?.interval) return null;
  const start = ms(e.interval.startTime), end = ms(e.interval.endTime);
  const m = e.metricsSummary || {};
  const active = durSec(e.activeDuration);
  return {
    id: dp.name || `${start}`,
    name: e.displayName || prettyType(e.exerciseType),
    type: e.exerciseType || '',
    start, end,
    duration: active ? active / 60 : (end - start) / 60000,
    avgHr: toNum(m.averageHeartRateBeatsPerMinute),
    calories: toNum(m.caloriesKcal),
    azm: toNum(m.activeZoneMinutes),
    distanceKm: m.distanceMillimeters ? m.distanceMillimeters / 1e6 : null,
    steps: toNum(m.steps),
    date: dateOf(e.interval.civilStartTime?.date) || ymd(new Date(start)),
  };
}

function prettyType(t) {
  if (!t) return 'Activiteit';
  const map = { WALKING: 'Wandelen', RUNNING: 'Hardlopen', BIKING: 'Fietsen', CYCLING: 'Fietsen', WEIGHTLIFTING: 'Krachttraining', STRENGTH_TRAINING: 'Krachttraining', SWIMMING: 'Zwemmen', YOGA: 'Yoga', HIKING: 'Wandeltocht', ELLIPTICAL: 'Crosstrainer', WORKOUT: 'Workout', HIIT: 'HIIT' };
  const k = String(t).toUpperCase().replace(/^EXERCISE_TYPE_/, '');
  return map[k] || k.charAt(0) + k.slice(1).toLowerCase().replace(/_/g, ' ');
}

/** Hartslag-rollup (per minuut) naar array per minuut sinds lokale middernacht. */
export function convertHr(points, dayStartMs) {
  const arr = new Array(1500).fill(0);
  let max = 0, n = 0;
  for (const p of points) {
    const t = ms(p.startTime);
    const v = p.heartRate?.beatsPerMinuteAvg;
    if (t == null || v == null) continue;
    const i = Math.floor((t - dayStartMs) / 60000);
    if (i < 0 || i >= arr.length) continue;
    arr[i] = Math.round(v);
    n++;
    const mx = p.heartRate.beatsPerMinuteMax ?? v;
    if (mx > max) max = mx;
  }
  let last = arr.length;
  while (last > 0 && !arr[last - 1]) last--;
  return n ? { hr: arr.slice(0, Math.max(last, 1)), hrMax: Math.round(max), hrCount: n } : { hr: null, hrMax: null, hrCount: 0 };
}

function blankDay(date) {
  return { date, hrStart: parseYmd(date).getTime(), exercises: [], naps: [] };
}

async function pool(items, n, fn) {
  const res = [];
  let i = 0;
  const workers = Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const k = i++; res[k] = await fn(items[k], k); }
  });
  await Promise.all(workers);
  return res;
}

/**
 * Synchroniseer. onProgress(tekst, fractie).
 */
export async function syncAll({ onProgress = () => {}, full = false } = {}) {
  const log = [];
  const t0 = Date.now();
  const lastSync = await kv.get('lastSyncDate');
  const end = today();
  const from = !full && lastSync ? addDays(lastSync, -2) : addDays(end, -(INITIAL_DAYS - 1));
  const toExcl = addDays(end, 1);
  const existing = {};
  for (const d of await daysStore.all()) existing[d.date] = d;
  const dates = [];
  for (let d = from; d <= end; d = addDays(d, 1)) dates.push(d);
  const out = {};
  for (const d of dates) {
    const prev = existing[d] || blankDay(d);
    out[d] = { ...prev, exercises: [], naps: [], hrStart: parseYmd(d).getTime() };
    delete out[d].sleep;
  }

  const step = async (label, fn) => {
    try {
      const r = await fn();
      log.push({ label, ok: true, count: r });
    } catch (e) {
      if (e instanceof AuthError) throw e;
      log.push({ label, ok: false, error: e.message, status: e.status, detail: String(e.body || '').slice(0, 400) });
      console.warn(label, e);
    }
  };

  onProgress('Profiel ophalen…', 0.02);
  await step('Account', async () => {
    const u = await getUserInfo();
    setUser({ name: u.name, email: u.email, picture: u.picture });
    return 1;
  });
  await step('Profiel', async () => {
    const p = await getProfile();
    await kv.set('profile', { age: p.age ?? null });
    return 1;
  });

  const dfilter = (field) => `${field}.date >= "${from}" AND ${field}.date < "${toExcl}"`;
  const daily = [
    ['HRV', 'daily-heart-rate-variability', 'daily_heart_rate_variability', (dp, o) => {
      const v = dp.dailyHeartRateVariability;
      o.hrv = toNum(v.averageHeartRateVariabilityMilliseconds);
      o.hrvDeep = toNum(v.deepSleepRootMeanSquareOfSuccessiveDifferencesMilliseconds);
      o.sleepHr = toNum(v.nonRemHeartRateBeatsPerMinute);
      return v.date;
    }],
    ['Rusthartslag', 'daily-resting-heart-rate', 'daily_resting_heart_rate', (dp, o) => { o.rhr = toNum(dp.dailyRestingHeartRate.beatsPerMinute); return dp.dailyRestingHeartRate.date; }],
    ['Ademhaling', 'daily-respiratory-rate', 'daily_respiratory_rate', (dp, o) => { o.resp = toNum(dp.dailyRespiratoryRate.breathsPerMinute); return dp.dailyRespiratoryRate.date; }],
    ['SpO₂', 'daily-oxygen-saturation', 'daily_oxygen_saturation', (dp, o) => { o.spo2 = toNum(dp.dailyOxygenSaturation.averagePercentage); return dp.dailyOxygenSaturation.date; }],
    ['Huidtemperatuur', 'daily-sleep-temperature-derivations', 'daily_sleep_temperature_derivations', (dp, o) => {
      const v = dp.dailySleepTemperatureDerivations;
      o.tempNight = toNum(v.nightlyTemperatureCelsius);
      o.tempBase = toNum(v.baselineTemperatureCelsius);
      o.tempDev = o.tempNight != null && o.tempBase != null ? o.tempNight - o.tempBase : null;
      return v.date;
    }],
  ];
  let k = 0;
  for (const [label, type, field, apply] of daily) {
    onProgress(`${label}…`, 0.05 + 0.03 * k++);
    await step(label, async () => {
      const pts = await listDataPoints(type, dfilter(field));
      let n = 0;
      for (const dp of pts) {
        const tmp = {};
        const date = dateOf(apply(dp, tmp));
        if (date && out[date]) { Object.assign(out[date], tmp); n++; }
      }
      return n;
    });
  }

  onProgress('Slaap…', 0.22);
  await step('Slaap', async () => {
    const pts = await listDataPoints('sleep', `sleep.interval.civil_end_time >= "${from}" AND sleep.interval.civil_end_time < "${toExcl}"`, 25, 20);
    const per = {};
    for (const dp of pts) {
      const s = convertSleep(dp);
      if (s && out[s.endDate]) (per[s.endDate] ||= []).push(s);
    }
    for (const [date, list] of Object.entries(per)) {
      list.sort((a, b) => (b.main === true) - (a.main === true) || b.asleep - a.asleep);
      const [main, ...rest] = list;
      out[date].sleep = main;
      out[date].naps = rest.filter((n) => n.start !== main.start).map((n) => ({ start: n.start, end: n.end, asleep: n.asleep }));
    }
    return pts.length;
  });

  onProgress('Activiteiten…', 0.28);
  await step('Activiteiten', async () => {
    const pts = await listDataPoints('exercise', `exercise.interval.civil_start_time >= "${from}" AND exercise.interval.civil_start_time < "${toExcl}"`, 25, 20);
    for (const dp of pts) {
      const e = convertExercise(dp);
      if (e && out[e.date]) out[e.date].exercises.push(e);
    }
    for (const d of Object.values(out)) d.exercises.sort((a, b) => a.start - b.start);
    return pts.length;
  });

  onProgress('Stappen…', 0.32);
  await step('Stappen', async () => {
    const pts = await dailyRollUp('steps', from, toExcl);
    for (const p of pts) {
      const date = dateOf(p.civilStartTime?.date);
      if (date && out[date]) out[date].steps = toNum(p.steps?.countSum);
    }
    return pts.length;
  });
  await step('Zoneminuten', async () => {
    const pts = await dailyRollUp('active-zone-minutes', from, toExcl);
    for (const p of pts) {
      const date = dateOf(p.civilStartTime?.date);
      const a = p.activeZoneMinutes;
      if (date && out[date] && a) out[date].azm = { fatBurn: toNum(a.sumInFatBurnHeartZone) || 0, cardio: (toNum(a.sumInCardioHeartZone) || 0) / 2, peak: (toNum(a.sumInPeakHeartZone) || 0) / 2 };
    }
    return pts.length;
  });

  // Hartslag per minuut: alleen dagen die nog geen (complete) data hebben, plus vandaag en gisteren.
  const hrDates = dates.filter((d) => full || !existing[d]?.hr || d >= addDays(end, -1) || !existing[d]?.hrComplete);
  let done = 0;
  let hrOk = 0, hrErr = null;
  await pool(hrDates, 4, async (d) => {
    const startMs = parseYmd(d).getTime();
    const endMs = parseYmd(addDays(d, 1)).getTime();
    try {
      const pts = await rollUp('heart-rate', new Date(startMs).toISOString(), new Date(Math.min(endMs, Date.now() + 60000)).toISOString(), '60s');
      const r = convertHr(pts, startMs);
      out[d].hr = r.hr; out[d].hrMax = r.hrMax; out[d].hrComplete = d < end && r.hrCount > 0;
      hrOk++;
    } catch (e) {
      if (e instanceof AuthError) throw e;
      hrErr = e;
    }
    done++;
    onProgress(`Hartslag ${done}/${hrDates.length}…`, 0.35 + 0.6 * (done / hrDates.length));
  });
  log.push(hrErr ? { label: 'Hartslag', ok: hrOk > 0, count: hrOk, error: hrErr.message, status: hrErr.status, detail: String(hrErr.body || '').slice(0, 400) } : { label: 'Hartslag', ok: true, count: hrOk });

  for (const d of Object.values(out)) d.synced = Date.now();
  await daysStore.putMany(Object.values(out));
  await kv.set('lastSyncDate', end);
  await kv.set('lastSyncAt', Date.now());
  await kv.set('syncLog', { at: Date.now(), ms: Date.now() - t0, from, to: end, log });
  onProgress('Klaar', 1);
  return log;
}
