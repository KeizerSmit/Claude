// Coach: welke training past vandaag, en progressie-tips per oefening.
// Combineert herstel (0–100), spiervermoeidheid per groep, en hoe lang geleden elk schema was.
import { computeLoads, exKey, e1rm } from './strength.js';
import { daysBetween } from './util.js';

/** Welke spiergroepen raakt een schema, en hoe zwaar (genormaliseerd 0..1)? */
export function templateProfile(t, settings) {
  const r = computeLoads([{ id: 'p', date: '2000-01-01', exercises: t.exercises || [] }], settings).p;
  const groups = r?.groups || {};
  const tot = Object.values(groups).reduce((a, b) => a + b, 0) || 1;
  return { groups: Object.fromEntries(Object.entries(groups).map(([g, v]) => [g, v / tot])), load: r?.load || 0 };
}

/**
 * Aanbeveling voor vandaag.
 * ctx: { templates, sessions, fatigue (groep→0..1), recovery (score|null), today, settings, doneToday }
 */
export function recommendTraining(ctx) {
  const { templates, sessions, fatigue, recovery, today, settings, doneToday } = ctx;
  if (doneToday) return { kind: 'done', title: 'Training gedaan', reason: 'Je hebt vandaag al getraind. Herstel nu: eet genoeg eiwit en slaap op tijd.' };
  if (recovery != null && recovery < 34) {
    return { kind: 'rest', title: 'Rust of licht bewegen', reason: `Je herstel is laag (${recovery}%). Kies wandelen, mobiliteit of een rustige fietstocht; zware training kan je herstel verder drukken.` };
  }
  const cands = templates.filter((t) => !t.deleted && t.exercises?.length).map((t) => {
    const prof = templateProfile(t, settings);
    // Frisheid: 1 − gewogen vermoeidheid van de spieren die dit schema raakt.
    const fat = Object.entries(prof.groups).reduce((a, [g, w]) => a + w * (fatigue[g] || 0), 0);
    const last = sessions.filter((s) => !s.deleted && s.date && (s.name || '').trim().toLowerCase() === t.name.trim().toLowerCase()).map((s) => s.date).sort().pop() || null;
    const since = last ? daysBetween(last, today) : 99;
    const score = (1 - fat) * 0.65 + Math.min(since, 7) / 7 * 0.35;
    const topGroups = Object.entries(prof.groups).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([g]) => g);
    return { t, fresh: 1 - fat, since, last, score, topGroups };
  }).sort((a, b) => b.score - a.score);
  if (!cands.length) return null;
  const best = cands[0];
  if (best.fresh < 0.45) {
    return { kind: 'cardio', title: 'Cardio of rust', reason: 'Je spieren zijn nog niet hersteld van je laatste trainingen. Een rustige cardiosessie (zone 2) of rust past beter.', alt: best };
  }
  const intensity = recovery == null ? 'normaal' : recovery >= 67 ? 'zwaar' : 'gecontroleerd';
  return {
    kind: 'template', template: best.t, fresh: best.fresh, since: best.since, intensity,
    title: best.t.name,
    reason: `${best.since >= 99 ? 'Nog niet gedaan' : best.since === 0 ? 'Vandaag' : best.since === 1 ? 'Gisteren voor het laatst' : `${best.since} dagen geleden`} · spieren ${Math.round(best.fresh * 100)}% fris${recovery != null ? ` · herstel ${recovery}%` : ''}`,
    others: cands.slice(1, 3),
  };
}

/**
 * Progressie-tip (dubbele progressie): als je de laatste keer duidelijk boven je doelreps zat,
 * stel een zwaarder gewicht voor; zakten je reps flink, houd dan het gewicht.
 * history: [{date, weight, reps, bw}] oplopend; targetReps: richtgetal uit het schema.
 */
export function progressionTip(history, targetReps) {
  if (!history.length) return null;
  const last = history[history.length - 1];
  if (!last.reps || last.bw && !last.weight) return null;
  const target = targetReps || 8;
  const step = (w) => (w >= 100 ? 5 : w >= 20 ? 2.5 : 1);
  const prev = history.length > 1 ? history[history.length - 2] : null;
  if (last.reps >= target + 2 || (prev && prev.weight === last.weight && prev.reps >= target + 1 && last.reps >= target + 1)) {
    const nw = Math.round((last.weight + step(last.weight)) * 2) / 2;
    return { kind: 'up', weight: nw, text: `Probeer ${String(nw).replace('.', ',')} kg` };
  }
  if (prev && prev.weight === last.weight && last.reps > prev.reps) return { kind: 'reps', text: `Nog 1 rep erbij (${last.reps + 1})` };
  if (prev && last.weight > prev.weight && last.reps < target - 2) return { kind: 'hold', text: 'Houd dit gewicht vast' };
  const best = Math.max(...history.map((h) => e1rm(h.weight || 0, h.reps) || 0));
  if ((e1rm(last.weight, last.reps) || 0) >= best - 0.01 && history.length >= 2) return { kind: 'pr', text: 'Op je record-niveau' };
  return null;
}

export { exKey };
