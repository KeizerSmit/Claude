// Realistische demodata zodat je de app kunt bekijken zonder koppeling.
import { addDays, today, parseYmd, uid } from './util.js';

function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

function gauss(r) {
  return Math.sqrt(-2 * Math.log(r() + 1e-9)) * Math.cos(2 * Math.PI * r());
}

const UPPER_A = [['Chest press', 80, 8], ['Lat pulldown', 70, 10], ['Shoulder press', 32.5, 8], ['Seated row', 75, 10], ['Pec deck', 65, 12], ['Lateral raise machine', 25, 12], ['Biceps curl machine', 35, 10], ['Triceps pushdown', 32.5, 12]];
const UPPER_B = [['Incline chest press', 70, 9], ['Chest supported row', 80, 9], ['Assisted pull ups', 0, 10, true], ['Cable crossover', 15, 12], ['Rear delt fly', 45, 12], ['Hammer curl', 16, 10], ['Overhead triceps extension', 25, 12]];
const LOWER = [['Leg press', 200, 10], ['Hack squat', 110, 8], ['Leg extension', 75, 12], ['Seated leg curl', 60, 10], ['Hip thrust machine', 120, 10], ['Adductor', 70, 12], ['Calf raise', 90, 15]];

export function generateDemo(n = 60) {
  const r = rng(42);
  const end = today();
  const days = [];
  const sessions = [];
  let fatigue = 0;
  let upperToggle = 0;
  const now = Date.now();
  for (let i = n - 1; i >= 0; i--) {
    const date = addDays(end, -i);
    const dow = parseYmd(date).getDay();
    const mid = parseYmd(date).getTime();
    const isToday = i === 0;
    const weekend = dow === 0 || dow === 6;
    const gym = [1, 2, 4, 5].includes(dow) || (dow === 6 && r() < 0.4);
    const run = dow === 3 || (dow === 0 && r() < 0.5);
    const party = dow === 6 && r() < 0.35;

    // Slaap van de nacht ervoor.
    const bed = mid - (60 + 30 * gauss(r) + (weekend ? 50 : 0) + (party ? 90 : 0)) * 60000; // ~23:00
    const durMin = Math.max(300, 455 + 35 * gauss(r) - (party ? 80 : 0) + (weekend ? 30 : 0));
    const wake = bed + durMin * 60000;
    const stages = [];
    let t = bed;
    const lat = 6 + Math.round(10 * r());
    stages.push(['awake', t, t + lat * 60000]); t += lat * 60000;
    let deep = 0, rem = 0, light = 0, awake = lat, awakenings = 0;
    let cyc = 0;
    while (t < wake - 10 * 60000) {
      const cycleLen = (85 + 15 * r()) * 60000;
      const deepFrac = Math.max(0.02, 0.28 - cyc * 0.07);
      const remFrac = Math.min(0.4, 0.12 + cyc * 0.06);
      const parts = [['light', 0.45], ['deep', deepFrac], ['light', 0.15], ['rem', remFrac]];
      for (const [type, f] of parts) {
        const d = Math.min(cycleLen * f, wake - t);
        if (d <= 0) break;
        stages.push([type, t, t + d]);
        const m = d / 60000;
        if (type === 'deep') deep += m; else if (type === 'rem') rem += m; else light += m;
        t += d;
      }
      if (r() < 0.55 && t < wake - 5 * 60000) { const a = (2 + 4 * r()) * 60000; stages.push(['awake', t, t + a]); awake += a / 60000; awakenings++; t += a; }
      cyc++;
    }
    if (t < wake) { stages.push(['awake', t, wake]); awake += (wake - t) / 60000; }
    const inBed = (wake - bed) / 60000;
    const asleep = inBed - awake;
    const sleep = { start: bed, end: wake, inBed, asleep, awake, deep, rem, light, latency: lat, awakenings, stages, classic: false, main: true };

    // Herstel-signalen.
    const sleepDebt = (465 - asleep) / 60;
    const hrv = Math.max(18, Math.exp(Math.log(58) + 0.13 * gauss(r) - 0.04 * fatigue - 0.05 * sleepDebt - (party ? 0.28 : 0)));
    const rhr = Math.round(52 + 1.6 * gauss(r) + 0.8 * fatigue + (party ? 5 : 0) + 0.6 * sleepDebt);
    const resp = 14.6 + 0.35 * gauss(r) + (party ? 0.5 : 0);
    const tempDev = 0.15 * gauss(r) + (party ? 0.35 : 0);

    // Hartslag per minuut.
    const minutes = isToday ? Math.floor((now - mid) / 60000) : 1440;
    const hr = new Array(Math.max(1, minutes)).fill(0);
    const wakeIdx = Math.floor((wake - mid) / 60000);
    const exercises = [];
    const addEx = (name, type, startMin, dur, hrFn) => {
      if (startMin + dur > minutes) return;
      for (let m = startMin; m < startMin + dur; m++) hr[m] = Math.round(hrFn(m - startMin, dur));
      const vals = hr.slice(startMin, startMin + dur);
      exercises.push({ id: uid(), name, type, start: mid + startMin * 60000, end: mid + (startMin + dur) * 60000, duration: dur, avgHr: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length), calories: Math.round(dur * (type === 'RUNNING' ? 11 : 6)) });
    };
    for (let m = 0; m < minutes; m++) {
      const tm = mid + m * 60000;
      if (tm < wake) hr[m] = Math.round(rhr - 3 + 3 * Math.sin(m / 40) + 2 * r());
      else {
        const hour = m / 60;
        const base = rhr + 11 + 6 * Math.sin((hour - 9) / 3) + 6 * r();
        const walk = (hour > 8 && hour < 8.4) || (hour > 12.5 && hour < 12.8) || (hour > 17.3 && hour < 17.7) ? 30 : 0;
        hr[m] = Math.round(base + walk);
      }
    }
    // Volgende nacht (na 23:15) is slaap.
    for (let m = 23 * 60 + 15; m < minutes; m++) hr[m] = Math.round(rhr - 1 + 2 * r());
    let session = null;
    if (gym) {
      const st = 18 * 60 + Math.round(20 * gauss(r));
      addEx('Krachttraining', 'WEIGHTLIFTING', st, 62, (k) => 98 + 22 * Math.abs(Math.sin(k / 3.2)) + 8 * r());
      const kind = dow === 2 || dow === 5 ? 'lower' : 'upper';
      let tpl, name;
      if (kind === 'lower') { tpl = LOWER; name = 'Lower'; } else { tpl = upperToggle++ % 2 ? UPPER_B : UPPER_A; name = tpl === UPPER_A ? 'Upper 6' : 'Upper 7'; }
      const progress = (n - i) / n;
      const pick = tpl.filter(() => r() > 0.15);
      session = {
        id: uid(), date, name, createdAt: mid + st * 60000, updatedAt: mid + st * 60000,
        exercises: pick.map(([ex, w, reps, bw]) => ({
          name: ex,
          weight: bw ? 0 : Math.round((w * (0.94 + 0.08 * progress) + (r() - 0.5) * w * 0.03) * 2) / 2,
          reps: Math.max(5, Math.round(reps + (r() - 0.5) * 3)),
          bw: !!bw, sets: null, note: '',
        })),
      };
      if (!isToday || minutes > st + 62) sessions.push(session);
      fatigue = Math.min(4, fatigue + 1);
    } else fatigue = Math.max(0, fatigue - 1.2);
    if (run) {
      const st = (weekend ? 10 : 7) * 60 + 15;
      const dur = 35 + Math.round(15 * r());
      addEx('Hardlopen', 'RUNNING', Math.max(st, wakeIdx + 20), dur, (k, d) => Math.min(188, 120 + 45 * Math.min(1, k / 8) + 6 * Math.sin(k / 4) - (k > d - 5 ? 20 : 0)));
      fatigue = Math.min(4, fatigue + 0.6);
    }
    const day = {
      date, hrStart: mid, hr, hrMax: Math.max(...hr), hrComplete: !isToday,
      hrv: Math.round(hrv * 10) / 10, hrvDeep: Math.round(hrv * 1.12 * 10) / 10, rhr, sleepHr: rhr + 2,
      resp: Math.round(resp * 10) / 10, spo2: Math.round((96 + 1.2 * r()) * 10) / 10,
      tempNight: 33.8 + tempDev, tempBase: 33.8, tempDev: Math.round(tempDev * 100) / 100,
      steps: Math.round(7000 + 3500 * r() + (run ? 5000 : 0)),
      sleep: isToday && now < wake ? null : sleep,
      naps: [], exercises, synced: now,
    };
    days.push(day);
  }
  return { days, strength: { sessions, exerciseMap: {}, updatedAt: Date.now() } };
}
