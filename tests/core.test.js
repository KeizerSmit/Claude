import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseNotes, parseSet, matchExercise, computeLoads, mergeDocs } from '../docs/js/strength.js';
import { convertSleep, convertExercise, convertHr, dateOf } from '../docs/js/sync.js';
import { computeAll, strainFromTrimp } from '../docs/js/metrics.js';
import { generateDemo } from '../docs/js/demo.js';

const REF = new Date(2026, 10, 4);

test('parser: koppen en oefeningen', () => {
  const r = parseNotes('Upper 6 - 3/11\nChest press 80 x 8\nLeg press 200kg 10\nCurl 14/12\n\nUpper 7 4 nov\nPull ups bw x 10\nDips bw+10 x 8', REF);
  assert.equal(r.sessions.length, 2);
  assert.equal(r.sessions[0].name, 'Upper 6');
  assert.equal(r.sessions[0].date, '2026-11-03');
  assert.deepEqual(r.sessions[0].exercises.map((e) => [e.weight, e.reps]), [[80, 8], [200, 10], [14, 12]]);
  assert.equal(r.sessions[1].date, '2026-11-04');
  assert.equal(r.sessions[1].exercises[0].bw, true);
  assert.equal(r.sessions[1].exercises[1].weight, 10);
});

test('parser: varianten van gewicht/reps', () => {
  assert.deepEqual([parseSet('8 x 80kg').weight, parseSet('8 x 80kg').reps], [80, 8]);
  assert.deepEqual([parseSet('82,5 x 7').weight, parseSet('82,5 x 7').reps], [82.5, 7]);
  assert.deepEqual([parseSet('10 reps 60kg').weight, parseSet('10 reps 60kg').reps], [60, 10]);
  assert.equal(parseSet('3x10x60').sets, 3);
  assert.equal(parseSet('100 lbs x 5').weight, 45.4);
});

test('oefeningen herkennen', () => {
  const ids = ['Chest press', 'Incline chest press', 'Lat pulldown', 'Seated leg curl', 'Leg extension', 'Rear delt fly', 'Pec deck', 'Hack squat', 'Calf raise op leg press', 'Lateral raise machine', 'Triceps pushdown']
    .map((n) => matchExercise(n).id);
  assert.deepEqual(ids, ['chest-press', 'incline-press', 'lat-pulldown', 'leg-curl', 'leg-extension', 'reverse-fly', 'pec-deck', 'hack-squat', 'calf-raise', 'lateral-raise', 'triceps']);
});

test('spierbelasting en PR', () => {
  const sessions = [
    { id: 'a', date: '2026-11-01', exercises: [{ name: 'Leg press', weight: 200, reps: 10 }] },
    { id: 'b', date: '2026-11-03', exercises: [{ name: 'Leg press', weight: 210, reps: 10 }, { name: 'Biceps curl', weight: 14, reps: 12 }] },
  ];
  const l = computeLoads(sessions, { defaultSets: 3 });
  assert.ok(l.b.exercises[0].isPR);
  assert.ok(l.b.load > l.a.load);
  assert.ok(l.b.groups.quads > l.b.groups.biceps);
});

test('merge: laatste wijziging wint', () => {
  const m = mergeDocs({ sessions: [{ id: 'x', updatedAt: 1, name: 'oud' }] }, { sessions: [{ id: 'x', updatedAt: 2, name: 'nieuw' }, { id: 'y', updatedAt: 1 }] });
  assert.equal(m.sessions.length, 2);
  assert.equal(m.sessions.find((s) => s.id === 'x').name, 'nieuw');
});

test('Google Health API conversies', () => {
  const s = convertSleep({ sleep: {
    interval: { startTime: '2026-11-03T22:30:00Z', endTime: '2026-11-04T06:30:00Z', civilEndTime: { date: { year: 2026, month: 11, day: 4 } } },
    metadata: { mainSleep: true },
    summary: { minutesAsleep: '440', minutesAwake: '40', minutesInSleepPeriod: '480', stagesSummary: [{ type: 'DEEP', minutes: '80', count: '4' }, { type: 'REM', minutes: '100', count: '5' }, { type: 'LIGHT', minutes: '260', count: '20' }, { type: 'AWAKE', minutes: '40', count: '6' }] },
    stages: [{ type: 'LIGHT', startTime: '2026-11-03T22:30:00Z', endTime: '2026-11-03T23:00:00Z' }],
  } });
  assert.equal(s.asleep, 440);
  assert.equal(s.deep, 80);
  assert.equal(s.endDate, '2026-11-04');
  assert.equal(s.awakenings, 6);
  const e = convertExercise({ exercise: { displayName: 'Weights', exerciseType: 'WEIGHTLIFTING', activeDuration: '3600s', interval: { startTime: '2026-11-03T17:00:00Z', endTime: '2026-11-03T18:00:00Z' }, metricsSummary: { averageHeartRateBeatsPerMinute: '112', caloriesKcal: 300 } } });
  assert.equal(e.duration, 60);
  assert.equal(e.avgHr, 112);
  const start = Date.parse('2026-11-03T00:00:00Z');
  const hr = convertHr([{ startTime: '2026-11-03T00:01:00Z', heartRate: { beatsPerMinuteAvg: 55.4, beatsPerMinuteMax: 60 } }], start);
  assert.equal(hr.hr[1], 55);
  assert.equal(hr.hrMax, 60);
  assert.equal(dateOf({ year: 2026, month: 1, day: 5 }), '2026-01-05');
});

test('metrics op demodata binnen realistische grenzen', () => {
  const { days, strength } = generateDemo(45);
  const { byDate } = computeAll(days, strength, { sleepNeed: 450, defaultSets: 3 }, { age: 30 });
  const full = Object.values(byDate).slice(10, -1);
  for (const d of full) {
    assert.ok(d.recovery.score >= 1 && d.recovery.score <= 99);
    assert.ok(d.strain.score >= 0 && d.strain.score < 21);
    assert.ok(d.sleep.perf > 0.4 && d.sleep.perf <= 1);
  }
  const gymDays = full.filter((d) => d.strain.sessions.length);
  assert.ok(gymDays.length > 5);
  assert.ok(Math.abs(strainFromTrimp(110) - 13.27) < 0.05);
});
