// "Deel met Claude": compacte, anonieme samenvatting van de laatste 14 dagen om het model
// te controleren. Bevat geen naam, e-mail, tokens of Client ID.
import { lastDays } from './metrics.js';
import { typeById } from './activities.js';
import { matchExercise } from './strength.js';
import { addDays, today } from './util.js';

const r1 = (v) => (v == null || isNaN(v) ? null : Math.round(v * 10) / 10);
const r0 = (v) => (v == null || isNaN(v) ? null : Math.round(v));
const hm = (ms) => (ms ? new Date(ms).toTimeString().slice(0, 5) : null);

export function buildShare({ computed, strength, settings, profile, syncLog, hrMethod, healthspan, loadPoint, version }) {
  const days = lastDays(computed.byDate, today(), 14).filter((d) => d.raw || d.strain?.sessions?.length || d.strain?.manual?.length);
  const out = {
    app: 'pulse', v: version, generated: new Date().toISOString().slice(0, 16),
    user: { age: settings.age || profile?.age || null, sex: settings.sex, kg: settings.bodyweight, maxHr: computed.maxHr, defaultSets: settings.defaultSets, sleepNeedMin: settings.sleepNeed },
    sync: { hrMethod: hrMethod || null, lastSync: syncLog?.at ? new Date(syncLog.at).toISOString().slice(0, 16) : null, failed: (syncLog?.log || []).filter((l) => !l.ok).map((l) => `${l.label}: ${l.status || ''} ${l.error}`.trim()) },
    load: loadPoint ? { acute: r0(loadPoint.acute), chronic: r0(loadPoint.chronic), ratio: loadPoint.chronic ? r1(loadPoint.acute / loadPoint.chronic) : null } : null,
    healthspan: healthspan ? { age: healthspan.age, lifestyleAge: r1(healthspan.lifestyleAge), range: [r1(healthspan.lo), r1(healthspan.hi)], tempo: r1(healthspan.tempo), nights30: healthspan.nights30, inputs: Object.fromEntries(healthspan.inputs.map((i) => [i.key, { v: r1(i.value), v30: r1(i.value30), years: r1(i.years), est: i.estimated || undefined }])) } : null,
    days: days.map((d) => {
      const raw = d.raw && !d.raw.empty ? d.raw : null;
      const hrN = raw?.hr ? raw.hr.filter(Boolean).length : 0;
      return {
        date: d.date, flag: d.flag || undefined,
        rec: d.recovery ? { score: d.recovery.score, hrv: r1(d.recovery.hrv), rhr: r0(d.recovery.rhr), resp: r1(d.recovery.resp), tempDev: r1(d.recovery.tempDev), z: Object.fromEntries(Object.entries(d.recovery.z).map(([k, v]) => [k, r1(v)])), base: { hrv: r1(d.recovery.baseline.hrv), rhr: r1(d.recovery.baseline.rhr), n: d.recovery.baseline.days }, calibrating: d.recovery.calibrating || undefined } : null,
        sleep: d.sleep ? { in: hm(d.sleep.start), out: hm(d.sleep.end), asleep: r0(d.sleep.asleep), need: r0(d.sleep.need), perf: r1(d.sleep.perf * 100), deep: r0(d.sleep.deep), rem: r0(d.sleep.rem), eff: r1((d.sleep.efficiency || 0) * 100) } : null,
        strain: d.strain ? { score: r1(d.strain.score), target: d.target ? d.target.map(r1) : null, cardioTrimp: r0(d.strain.cardioTrimp), muscTrimp: r0(d.strain.muscularTrimp), manualTrimp: r0(d.strain.estTrimp), mvpa: r0(d.strain.mvpa), zonesMin: d.strain.zones, peakHr: d.strain.peakHr, estimated: d.strain.estimated || undefined } : null,
        hr: raw ? { minutes: hrN, rhrDay: raw.rhr ?? null, max: raw.hrMax ?? null } : null,
        steps: raw?.steps ?? null,
        vo2: raw?.vo2max ?? null,
        strength: (d.strain?.sessions || []).map((s) => ({
          name: s.name, start: hm(s.start), dur: s.duration ?? null, rpe: s.rpe ?? null, load: r1(s.load), muscTrimp: r0(s.muscularTrimp),
          hr: s.hrWindow ? { cov: r1(s.hrWindow.coverage * 100), avg: s.hrWindow.avg, max: s.hrWindow.max, trimp: r0(s.hrWindow.trimp) } : s.activity ? { fitbit: s.activity.name, avg: s.activity.avgHr, max: s.activity.maxHr, trimp: r0(s.activity.trimp) } : null,
          groups: Object.fromEntries(Object.entries(s.groups || {}).map(([g, v]) => [g, r1(v)])),
          ex: (s.exercises || []).map((e) => [e.name, matchExercise(e.name, strength.exerciseMap).id, e.bw ? `BW+${e.weight || 0}` : e.weight, e.reps, e.sets, r1(e.e1rm), r1(e.ri), r1(e.load)]),
        })),
        manual: (d.strain?.manual || []).map((a) => ({ type: typeById(a.typeId).id, start: hm(a.start), dur: a.duration, int: a.intensity, rpe: a.rpe, active: a.active, src: a.est.source, cov: r1(a.est.coverage * 100), measured: r0(a.est.measured), est: r0(a.est.estimated), musc: r0(a.est.muscular) })),
        fitbit: (d.strain?.activities || []).map((a) => ({ type: a.type, name: a.name, start: hm(a.start), dur: r0(a.duration), avgHr: a.avgHr, strain: r1(a.strain), linked: !!(a.linked || a.linkedManual) || undefined })),
      };
    }),
    templates: (strength.templates || []).filter((t) => !t.deleted).map((t) => t.name),
  };
  return JSON.stringify(out);
}

export { addDays };
