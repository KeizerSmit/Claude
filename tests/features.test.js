import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeAll } from '../docs/js/metrics.js';
import { generateDemo } from '../docs/js/demo.js';
import { recommendTraining, progressionTip } from '../docs/js/coach.js';
import { recoveryPatterns } from '../docs/js/patterns.js';
import { mergeDocs } from '../docs/js/strength.js';
import { addDays, today } from '../docs/js/util.js';

const SET = { sleepNeed: 450, defaultSets: 2 };

test('ziek-modus: dag telt niet mee in baseline en strain-doel gaat omlaag', () => {
  const { days, strength } = generateDemo(45);
  const sick = addDays(today(), -10);
  // Maak de zieke dag extreem, zodat hij de baseline zichtbaar zou verschuiven.
  const d = days.find((x) => x.date === sick);
  d.hrv = 10; d.rhr = 90; d.sleepHr = 90;
  const base = computeAll(days.map((x) => ({ ...x })), strength, SET, { age: 30 }).byDate;
  const flagged = computeAll(days.map((x) => ({ ...x })), { ...strength, flags: [{ id: `f-${sick}`, date: sick, kind: 'sick', updatedAt: 1 }] }, SET, { age: 30 }).byDate;
  const next = addDays(sick, 1);
  assert.equal(flagged[sick].flag, 'sick');
  assert.deepEqual(flagged[sick].target, [0, 6]);
  assert.ok(flagged[next].recovery.baseline.rhr < base[next].recovery.baseline.rhr, 'zieke dag verhoogt de RHR-baseline niet');
  assert.ok(flagged[next].recovery.baseline.hrv > base[next].recovery.baseline.hrv, 'zieke dag verlaagt de HRV-baseline niet');
});

test('merge: dag-markeringen worden samengevoegd', () => {
  const a = { flags: [{ id: 'f-1', date: '2026-11-01', kind: 'sick', updatedAt: 1 }] };
  const b = { flags: [{ id: 'f-1', date: '2026-11-01', kind: null, deleted: true, updatedAt: 2 }, { id: 'f-2', date: '2026-11-02', kind: 'rest', updatedAt: 1 }] };
  const m = mergeDocs(a, b);
  assert.equal(m.flags.length, 2);
  assert.equal(m.flags.find((f) => f.id === 'f-1').deleted, true);
});

test('coach: ziek/rust/laag herstel/gedaan', () => {
  const base = { templates: [{ id: 't', name: 'Lower', exercises: [{ name: 'Hack squat', weight: 75, reps: 6 }] }], sessions: [], fatigue: {}, today: '2026-11-05', settings: SET };
  assert.equal(recommendTraining({ ...base, recovery: 80, flag: 'sick' }).title, 'Beterschap');
  assert.equal(recommendTraining({ ...base, recovery: 80, flag: 'rest' }).kind, 'rest');
  assert.equal(recommendTraining({ ...base, recovery: 20 }).kind, 'rest');
  assert.equal(recommendTraining({ ...base, recovery: 80, doneToday: true }).kind, 'done');
  const r = recommendTraining({ ...base, recovery: 80 });
  assert.equal(r.kind, 'template');
  assert.equal(r.intensity, 'zwaar');
  // Vermoeide benen → cardio/rust in plaats van Lower.
  assert.equal(recommendTraining({ ...base, recovery: 80, fatigue: { quads: 1, hamstrings: 1, billen: 1, kuiten: 1 } }).kind, 'cardio');
});

test('progressietip: dubbele progressie', () => {
  assert.equal(progressionTip([{ weight: 80, reps: 10 }], 8).kind, 'up');
  assert.equal(progressionTip([{ weight: 80, reps: 10 }], 8).weight, 82.5);
  assert.equal(progressionTip([{ weight: 80, reps: 7 }, { weight: 80, reps: 8 }], 10).kind, 'reps');
  assert.equal(progressionTip([{ weight: 80, reps: 8 }, { weight: 85, reps: 5 }], 8).kind, 'hold');
});

test('patronen: geeft resultaat per kenmerk met richting', () => {
  const { days, strength } = generateDemo(90);
  const { byDate } = computeAll(days, strength, SET, { age: 30 });
  const p = recoveryPatterns(byDate, today(), 90);
  assert.ok(p.pairs > 40);
  const short = p.list.find((x) => x.key === 'shortSleep');
  assert.ok(short.enough);
  assert.ok(short.diff < 0, 'kort slapen geeft in de demo lager herstel');
});

test('RPE-ijking: leert van activiteiten met gemeten hartslag', () => {
  const { days, strength } = generateDemo(30);
  const hrDays = days.filter((d) => d.hr?.length).slice(-8, -2);
  const acts = hrDays.map((d, i) => ({ id: `a${i}`, date: d.date, typeId: 'hardlopen', intensity: 'matig', rpe: 3, duration: 40, start: d.hrStart + 18 * 3600000, updatedAt: 1 }));
  // Zet de hartslag in het venster hoog (≈ 75% HRR) terwijl de RPE laag (3 → 50% verwacht) is.
  for (const a of acts) {
    const d = days.find((x) => x.date === a.date);
    d.hr = [...d.hr];
    const i0 = Math.floor((a.start - d.hrStart) / 60000);
    for (let i = i0; i < i0 + 40 && i < d.hr.length; i++) d.hr[i] = 160;
  }
  const res = computeAll(days, { ...strength, activities: acts }, SET, { age: 30 });
  assert.ok(res.rpeCal.sport.n >= 3);
  assert.ok(res.rpeCal.sport.scale > 1.05, `schaal ${res.rpeCal.sport.scale}`);
});

test('strain-coach: TRIMP ↔ strain is omkeerbaar', async () => {
  const { strainFromTrimp, trimpForStrain, trimpPerMinute } = await import('../docs/js/metrics.js');
  for (const s of [2, 8, 12.5, 17, 20]) assert.ok(Math.abs(strainFromTrimp(trimpForStrain(s)) - s) < 1e-6);
  assert.ok(trimpPerMinute(0.6) > trimpPerMinute(0.4));
  // 30 min zone 2 vanaf 0 geeft een realistische strain (±5–9).
  const s30 = strainFromTrimp(30 * trimpPerMinute(0.62));
  assert.ok(s30 > 5 && s30 < 9, `strain ${s30}`);
});

test('verwachting morgen: meer slaap → hoger voorspeld herstel', async () => {
  const { recoveryForecastModel } = await import('../docs/js/patterns.js');
  const { days, strength } = generateDemo(150);
  const { byDate } = computeAll(days, strength, SET, { age: 30 });
  const fm = recoveryForecastModel(byDate, today());
  assert.ok(fm && fm.n >= 30);
  assert.ok(fm.predict(50, 12, 8) > fm.predict(50, 12, 6));
  for (const v of [fm.predict(99, 0, 12), fm.predict(1, 21, 2)]) assert.ok(v >= 1 && v <= 99);
  assert.equal(recoveryForecastModel({}, today()), null);
});

test('ziek-modus werkt ook op een dag zonder data', () => {
  const { days: all, strength } = generateDemo(20);
  // Sync loopt 3 dagen achter; vandaag als ziek gemarkeerd.
  const days = all.filter((d) => d.date <= addDays(today(), -3));
  const empty = today();
  const { byDate } = computeAll(days, { ...strength, flags: [{ id: 'f', date: empty, kind: 'sick', updatedAt: 1 }] }, SET, { age: 30 });
  assert.equal(byDate[empty]?.flag, 'sick');
  assert.deepEqual(byDate[empty].target, [0, 6]);
});

test('slaapschema: opstaan na 12:00 blijft na de bedtijd', async () => {
  const { sleepSpan } = await import('../docs/js/charts.js');
  const start = new Date(2026, 10, 7, 23, 30).getTime(), end = new Date(2026, 10, 8, 12, 30).getTime();
  const [a, b] = sleepSpan(start, end);
  assert.equal(a, 23 * 60 + 30);
  assert.equal(b - a, 13 * 60);
});
