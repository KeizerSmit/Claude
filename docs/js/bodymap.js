// Spiervermoeidheid per spiergroep + gestileerde lichaamskaart (voor- en achterkant).
import { parseYmd, clamp, esc } from './util.js';
import { GROUPS } from './strength.js';

// Halfwaardetijd van herstel (uren) en "volle sessie"-capaciteit per groep.
const RECOVER = { borst: 40, schouders: 32, rug: 44, biceps: 30, triceps: 30, onderarmen: 24, quads: 52, hamstrings: 48, billen: 48, heupen: 36, kuiten: 30, core: 24 };
const CAP = { borst: 3.2, schouders: 2.6, rug: 3.6, biceps: 1.6, triceps: 1.8, onderarmen: 1.2, quads: 4.0, hamstrings: 2.6, billen: 3.0, heupen: 1.6, kuiten: 1.4, core: 1.4 };

/** Vermoeidheid 0..1 per spiergroep op moment `now`, uit krachtsessies (met spierbelasting per groep). */
export function muscleFatigue(sessions, loads, now = Date.now()) {
  const out = {};
  const last = {};
  for (const g of Object.keys(RECOVER)) { out[g] = 0; last[g] = null; }
  for (const s of sessions) {
    if (s.deleted || !s.date) continue;
    const r = loads[s.id];
    if (!r) continue;
    const t = s.activity?.end || (parseYmd(s.date).getTime() + 19 * 3600000);
    const hours = (now - t) / 3600000;
    if (hours < 0 || hours > 24 * 10) continue;
    for (const [g, v] of Object.entries(r.groups || {})) {
      if (!(g in out)) continue;
      out[g] += (v / CAP[g]) * Math.pow(0.5, hours / RECOVER[g]);
      if (!last[g] || t > last[g].t) last[g] = { t, session: s };
    }
  }
  for (const g of Object.keys(out)) out[g] = clamp(out[g], 0, 1);
  return { fatigue: out, last };
}

export function fatigueColor(f) {
  if (f < 0.12) return 'var(--mus-fresh)';
  if (f < 0.4) return 'var(--mus-low)';
  if (f < 0.7) return 'var(--mus-mid)';
  return 'var(--mus-high)';
}

export function fatigueLabel(f) {
  if (f < 0.12) return 'Fris';
  if (f < 0.4) return 'Bijna hersteld';
  if (f < 0.7) return 'Herstellend';
  return 'Vermoeid';
}

// Vormen (viewBox 0 0 120 250). Elke vorm: [groep, svg-element].
const SIL = `
  <circle cx="60" cy="20" r="13"/>
  <rect x="53" y="31" width="14" height="10" rx="4"/>
  <path d="M30 46 Q60 38 90 46 L92 60 Q94 100 84 128 L80 140 Q60 146 40 140 L36 128 Q26 100 28 60 Z"/>
  <path d="M27 52 Q18 56 18 70 L16 118 Q15 132 20 140 L26 140 Q28 128 28 116 L32 72 Z"/>
  <path d="M93 52 Q102 56 102 70 L104 118 Q105 132 100 140 L94 140 Q92 128 92 116 L88 72 Z"/>
  <path d="M40 138 Q60 146 80 138 L80 160 Q78 200 74 240 L64 240 L61 172 L59 172 L56 240 L46 240 Q42 200 40 160 Z"/>`;

const FRONT = [
  ['schouders', '<ellipse cx="33" cy="56" rx="9" ry="8"/><ellipse cx="87" cy="56" rx="9" ry="8"/>'],
  ['borst', '<path d="M42 58 Q51 54 59 58 L59 76 Q50 80 42 74 Z"/><path d="M78 58 Q69 54 61 58 L61 76 Q70 80 78 74 Z"/>'],
  ['biceps', '<ellipse cx="25" cy="82" rx="5.5" ry="12"/><ellipse cx="95" cy="82" rx="5.5" ry="12"/>'],
  ['onderarmen', '<ellipse cx="21" cy="112" rx="4.5" ry="13"/><ellipse cx="99" cy="112" rx="4.5" ry="13"/>'],
  ['core', '<rect x="48" y="82" width="24" height="46" rx="8"/>'],
  ['heupen', '<ellipse cx="54" cy="150" rx="4" ry="9"/><ellipse cx="66" cy="150" rx="4" ry="9"/>'],
  ['quads', '<ellipse cx="48" cy="176" rx="8" ry="24"/><ellipse cx="72" cy="176" rx="8" ry="24"/>'],
  ['kuiten', '<ellipse cx="50" cy="218" rx="5" ry="14"/><ellipse cx="70" cy="218" rx="5" ry="14"/>'],
];
const BACK = [
  ['schouders', '<ellipse cx="33" cy="56" rx="9" ry="8"/><ellipse cx="87" cy="56" rx="9" ry="8"/>'],
  ['rug', '<path d="M44 48 Q60 42 76 48 L80 66 Q76 96 66 112 L54 112 Q44 96 40 66 Z"/><rect x="51" y="112" width="18" height="18" rx="6"/>'],
  ['triceps', '<ellipse cx="25" cy="82" rx="5.5" ry="12"/><ellipse cx="95" cy="82" rx="5.5" ry="12"/>'],
  ['onderarmen', '<ellipse cx="21" cy="112" rx="4.5" ry="13"/><ellipse cx="99" cy="112" rx="4.5" ry="13"/>'],
  ['billen', '<ellipse cx="51" cy="144" rx="10" ry="10"/><ellipse cx="69" cy="144" rx="10" ry="10"/>'],
  ['hamstrings', '<ellipse cx="48" cy="180" rx="8" ry="22"/><ellipse cx="72" cy="180" rx="8" ry="22"/>'],
  ['kuiten', '<ellipse cx="48" cy="218" rx="6.5" ry="15"/><ellipse cx="72" cy="218" rx="6.5" ry="15"/>'],
];

function figure(shapes, fatigue, label) {
  return `<div class="bm-fig"><svg viewBox="0 0 120 250" class="bodymap" aria-label="${label}">
    <g class="bm-sil">${SIL}</g>
    ${shapes.map(([g, el]) => `<g class="bm-m" data-sheet="muscle:${g}" style="fill:${fatigueColor(fatigue[g] || 0)}"><title>${esc(GROUPS[g])}</title>${el}</g>`).join('')}
  </svg><div class="bm-cap">${label}</div></div>`;
}

export function bodyMap(fatigue) {
  return `<div class="bm">${figure(FRONT, fatigue, 'Voorkant')}${figure(BACK, fatigue, 'Achterkant')}</div>`;
}
