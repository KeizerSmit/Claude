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
