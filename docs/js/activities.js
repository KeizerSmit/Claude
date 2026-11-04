// Activiteiten achteraf loggen: sport, klussen/werk en huishouden/tuin.
// MET-waarden uit het 2024 Adult Compendium of Physical Activities (Herrmann et al. 2024),
// per activiteit drie niveaus (licht / matig / zwaar).
//
// Belasting volgt een vaste rangorde:
//   1. gemeten hartslag (als ≥80% van het venster hartslag heeft) — al in je dag-strain;
//   2. anders: geschat voor de minuten zónder hartslag, uit RPE (hoe zwaar voelde het)
//      en/of MET, omgerekend naar % hartslagreserve en dan Banister-TRIMP.
// Werk en huishouden tellen mee voor belasting en herstel, níet als fitheid (healthspan).

import { uid, clamp } from './util.js';

export const CATS = {
  sport: { label: 'Sport', color: 'var(--strain)', fitness: true },
  werk: { label: 'Klussen & werk', color: 'var(--muscle)', fitness: false },
  huis: { label: 'Huis & tuin', color: 'var(--green)', fitness: false },
};

// [id, naam, categorie, MET licht, matig, zwaar, emoji-vrij icoon-sleutel]
const T = [
  // Klussen & werk
  ['timmeren', 'Timmeren', 'werk', 2.5, 4.3, 7.0, 'hammer'],
  ['timmeren-buiten', 'Timmeren buiten (schuur, overkapping)', 'werk', 4.5, 6.0, 7.0, 'hammer'],
  ['zagen', 'Zagen, schaven, boren', 'werk', 4.0, 6.0, 7.0, 'saw'],
  ['verbouwen', 'Verbouwen / renoveren', 'werk', 2.3, 4.0, 6.0, 'hammer'],
  ['klussen', 'Klussen in huis', 'werk', 2.5, 4.5, 6.0, 'wrench'],
  ['schilderen', 'Schilderen / behangen', 'werk', 2.8, 3.3, 5.0, 'brush'],
  ['dakwerk', 'Dakwerk', 'werk', 4.0, 6.0, 7.0, 'house'],
  ['sjouwen', 'Zware lasten sjouwen', 'werk', 5.0, 8.0, 9.0, 'box'],
  ['verhuizen', 'Verhuizen', 'werk', 4.0, 5.8, 8.0, 'box'],
  ['schutting', 'Schutting / hek bouwen', 'werk', 3.0, 3.8, 5.5, 'hammer'],
  ['bouw', 'Bouwwerk buiten', 'werk', 3.5, 4.0, 6.0, 'house'],
  ['installatie', 'Loodgieter / elektra', 'werk', 2.5, 3.2, 4.0, 'wrench'],
  ['repareren', 'Auto of fiets repareren', 'werk', 2.5, 3.3, 4.5, 'wrench'],
  ['handwerk', 'Handarbeid (algemeen)', 'werk', 3.0, 4.5, 6.0, 'hand'],
  // Huis & tuin
  ['schoonmaken', 'Schoonmaken', 'huis', 2.5, 3.3, 4.0, 'sparkle'],
  ['stofzuigen', 'Stofzuigen / dweilen', 'huis', 2.5, 3.3, 4.0, 'sparkle'],
  ['gras', 'Gras maaien', 'huis', 4.5, 5.0, 5.5, 'leaf'],
  ['tuinieren', 'Tuinieren (algemeen)', 'huis', 3.0, 3.8, 5.0, 'leaf'],
  ['harken', 'Harken / bladeren ruimen', 'huis', 3.5, 4.0, 5.0, 'leaf'],
  ['spitten', 'Spitten / graven', 'huis', 4.0, 5.0, 7.3, 'shovel'],
  ['wieden', 'Wieden / schoffelen', 'huis', 3.8, 4.5, 5.0, 'leaf'],
  ['scheppen', 'Grond / zand scheppen', 'huis', 4.0, 5.0, 6.0, 'shovel'],
  ['sneeuw', 'Sneeuw scheppen', 'huis', 4.5, 5.3, 7.5, 'shovel'],
  ['boodschappen', 'Boodschappen sjouwen', 'huis', 2.5, 3.5, 4.5, 'box'],
  // Sport
  ['kracht', 'Krachttraining', 'sport', 3.5, 5.0, 6.0, 'dumbbell'],
  ['hardlopen', 'Hardlopen', 'sport', 7.0, 9.8, 11.5, 'run'],
  ['wandelen', 'Wandelen', 'sport', 3.0, 3.5, 4.3, 'walk'],
  ['hiken', 'Hiken', 'sport', 5.0, 6.0, 7.8, 'walk'],
  ['fietsen', 'Fietsen', 'sport', 4.0, 6.8, 8.5, 'bike'],
  ['mtb', 'Mountainbiken', 'sport', 6.0, 8.5, 10.0, 'bike'],
  ['zwemmen', 'Zwemmen', 'sport', 5.0, 5.8, 9.8, 'swim'],
  ['roeien', 'Roeien', 'sport', 4.8, 7.0, 11.0, 'row'],
  ['hiit', 'HIIT / bootcamp', 'sport', 6.0, 8.0, 10.0, 'flame'],
  ['circuit', 'Circuittraining', 'sport', 4.3, 5.8, 8.0, 'flame'],
  ['padel', 'Padel', 'sport', 4.5, 5.5, 6.5, 'racket'],
  ['tennis', 'Tennis', 'sport', 5.0, 6.5, 8.0, 'racket'],
  ['badminton', 'Badminton / squash', 'sport', 5.5, 7.0, 9.0, 'racket'],
  ['voetbal', 'Voetbal', 'sport', 6.0, 7.0, 10.0, 'ball'],
  ['basketbal', 'Basketbal', 'sport', 6.0, 6.5, 8.0, 'ball'],
  ['boulderen', 'Boulderen / klimmen', 'sport', 5.8, 7.0, 8.8, 'mountain'],
  ['vechtsport', 'Vechtsport / boksen', 'sport', 5.0, 7.0, 10.3, 'flame'],
  ['dansen', 'Dansen', 'sport', 4.5, 5.5, 7.8, 'music'],
  ['crosstrainer', 'Crosstrainer / stairmaster', 'sport', 4.5, 5.0, 8.8, 'flame'],
  ['skien', 'Skiën / snowboarden', 'sport', 4.3, 5.3, 8.0, 'mountain'],
  ['yoga', 'Yoga', 'sport', 2.3, 3.0, 4.0, 'lotus'],
  ['pilates', 'Pilates', 'sport', 2.5, 3.0, 3.8, 'lotus'],
  ['mobiliteit', 'Stretchen / mobiliteit', 'sport', 2.0, 2.3, 2.8, 'lotus'],
  ['golf', 'Golf', 'sport', 3.5, 4.8, 5.5, 'flag'],
  ['anders', 'Iets anders', 'sport', 3.0, 5.0, 7.0, 'flame'],
];

export const TYPES = T.map(([id, name, cat, l, m, z, icon]) => ({ id, name, cat, met: { licht: l, matig: m, zwaar: z }, icon }));
export const typeById = (id) => TYPES.find((t) => t.id === id) || TYPES[TYPES.length - 1];

export const INTENSITY = { licht: 'Licht', matig: 'Matig', zwaar: 'Zwaar' };

// Borg CR-10, Nederlandse labels.
export const RPE_LABELS = ['Rust', 'Heel erg licht', 'Licht', 'Matig', 'Een beetje zwaar', 'Zwaar', 'Zwaar', 'Erg zwaar', 'Erg zwaar', 'Bijna maximaal', 'Maximaal'];

// sRPE-eenheden → TRIMP-equivalent voor spierbelasting (60 min werk op RPE 6 ≈ +29).
const MUSCLE_K = 0.08;

// Aangenomen RPE → fractie hartslagreserve (volgt de ACSM-indeling; per punt niet gevalideerd).
const RPE_HRR = [0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.75, 0.8, 0.87, 0.93, 0.98];

export function defaultActive(cat) { return cat === 'sport' ? 1 : 0.7; }

export function newActivity(typeId, date) {
  const t = typeById(typeId);
  const now = Date.now();
  const start = new Date(`${date}T${t.cat === 'sport' ? '18:00' : '10:00'}:00`).getTime();
  return { id: uid(), typeId: t.id, date, start, duration: t.cat === 'sport' ? 60 : 120, intensity: 'matig', rpe: null, active: defaultActive(t.cat), note: '', createdAt: now, updatedAt: now };
}

function banister(hrr, female) {
  const h = clamp(hrr, 0, 1.05);
  return female ? h * 0.86 * Math.exp(1.67 * h) : h * 0.64 * Math.exp(1.92 * h);
}

/**
 * Bereken de belasting van een gelogde activiteit.
 * ctx: { rest, max, female, vo2max, kg }
 * day: dag-object met hr[] en hrStart (mag ontbreken).
 */
export function estimateActivity(act, day, ctx) {
  const t = typeById(act.typeId);
  const met = t.met[act.intensity] || t.met.matig;
  const minutes = Math.max(1, act.duration || 0);
  const end = act.start + minutes * 60000;
  // 1. Hoeveel van het venster heeft gemeten hartslag?
  let n = 0, measured = 0, sum = 0, mx = 0;
  if (day?.hr?.length) {
    const i0 = Math.max(0, Math.floor((act.start - day.hrStart) / 60000));
    const i1 = Math.min(day.hr.length, Math.ceil((end - day.hrStart) / 60000));
    for (let i = i0; i < i1; i++) {
      const v = day.hr[i];
      if (!v) continue;
      n++; sum += v; if (v > mx) mx = v;
      const hrr = (v - ctx.rest) / (ctx.max - ctx.rest);
      if (hrr >= 0.2) measured += banister(hrr, ctx.female);
    }
  }
  const coverage = n / minutes;
  // 2. Schatting voor de minuten zonder hartslag.
  const vo2Met = (ctx.vo2max || 42) / 3.5;
  const hrrMet = clamp((met - 1) / (vo2Met - 1), 0.05, 1);
  const hrrRpe = act.rpe != null ? RPE_HRR[clamp(Math.round(act.rpe), 0, 10)] : null;
  const hrr = hrrRpe != null ? 0.6 * hrrRpe + 0.4 * hrrMet : hrrMet;
  const missing = coverage >= 0.8 ? 0 : minutes * (1 - coverage);
  const active = act.active ?? defaultActive(t.cat);
  const estimated = missing * active * banister(hrr, ctx.female);
  const source = coverage >= 0.8 ? 'hr' : coverage > 0.1 ? 'mix' : hrrRpe != null ? 'rpe' : 'met';
  // 3. Spierbelasting bij fysiek werk en kracht (hartslag mist dit): sessie-RPE × actieve minuten, geschaald.
  const muscular = (t.cat !== 'sport' || t.id === 'kracht')
    ? (act.rpe ?? { licht: 3, matig: 4, zwaar: 6 }[act.intensity] ?? 4) * minutes * active * MUSCLE_K
    : 0;
  const kg = ctx.kg || 80;
  const kcal = (met - 1) * kg * (minutes / 60) * active + kg * (minutes / 60);
  return {
    type: t, met, minutes, end, coverage, measured, estimated, muscular, trimp: measured + estimated + muscular, source,
    hrr, active, avgHr: n ? Math.round(sum / n) : null, maxHr: mx || null, kcal: Math.round(kcal),
  };
}

export const SOURCE_LABEL = {
  hr: 'gemeten hartslag',
  mix: 'deels gemeten, rest geschat',
  rpe: 'geschat uit hoe zwaar het voelde',
  met: 'geschat uit activiteit en intensiteit',
};

/** Is tijdstip t binnen een werk/huis-activiteit van deze dag? (voor healthspan: telt niet als fitheid) */
export function nonFitnessWindows(acts) {
  return acts.filter((a) => !a.deleted && typeById(a.typeId).cat !== 'sport').map((a) => [a.start, a.start + a.duration * 60000]);
}
