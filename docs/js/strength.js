// Kracht: oefeningenbibliotheek, parser voor notities en spierbelasting.
import { ymd, parseYmd, today, uid, clamp } from './util.js';

export const GROUPS = {
  borst: 'Borst', schouders: 'Schouders', rug: 'Rug', biceps: 'Biceps', triceps: 'Triceps',
  onderarmen: 'Onderarmen', quads: 'Quadriceps', hamstrings: 'Hamstrings', billen: 'Billen',
  heupen: 'Heupen', kuiten: 'Kuiten', core: 'Core', overig: 'Overig',
};

export const UPPER = ['borst', 'schouders', 'rug', 'biceps', 'triceps', 'onderarmen'];
export const LOWER = ['quads', 'hamstrings', 'billen', 'heupen', 'kuiten'];

// Volgorde is belangrijk: specifiek vóór algemeen.
// mass = hoe zwaar de oefening het lichaam belast (grote compound > kleine isolatie).
export const LIBRARY = [
  { id: 'incline-press', name: 'Incline press', re: /(incline|schuin)(?!.*curl)/, g: { borst: .55, schouders: .25, triceps: .2 }, mass: 1.0 },
  { id: 'decline-press', name: 'Decline press', re: /decline/, g: { borst: .7, triceps: .3 }, mass: 1.0 },
  { id: 'reverse-fly', name: 'Reverse fly', re: /(reverse|rear|achter).*(fly|pec|delt|butterfly|schouder)|rear ?delt/, g: { schouders: .8, rug: .2 }, mass: 0.4 },
  { id: 'pec-deck', name: 'Pec deck / fly', re: /pec ?deck|butterfly|\bfly(es|s)?\b|flies|cable ?cross|crossover|chest ?fly/, g: { borst: 1 }, mass: 0.6 },
  { id: 'dips', name: 'Dips', re: /\bdips?\b/, g: { triceps: .5, borst: .4, schouders: .1 }, mass: 0.8 },
  { id: 'push-up', name: 'Push-up', re: /push.?ups?|opdruk/, g: { borst: .6, triceps: .25, schouders: .15 }, mass: 0.7 },
  { id: 'shoulder-press', name: 'Shoulder press', re: /shoulder ?press|schouder ?(press|druk)|overhead ?press|milit|\bohp\b|arnold/, g: { schouders: .7, triceps: .3 }, mass: 0.9 },
  { id: 'lateral-raise', name: 'Lateral raise', re: /lateral|lat\.? ?raise|side ?raise|zijwaarts|zij ?raise|y.?raise/, g: { schouders: 1 }, mass: 0.4 },
  { id: 'front-raise', name: 'Front raise', re: /front ?raise/, g: { schouders: 1 }, mass: 0.35 },
  { id: 'upright-row', name: 'Upright row', re: /upright/, g: { schouders: .7, rug: .3 }, mass: 0.5 },
  { id: 'face-pull', name: 'Face pull', re: /face ?pull/, g: { schouders: .6, rug: .4 }, mass: 0.4 },
  { id: 'shrug', name: 'Shrugs', re: /shrug/, g: { rug: 1 }, mass: 0.5 },
  { id: 'chest-press', name: 'Chest press', re: /chest ?press|borst ?(press|druk)|bench|bankdruk|flat ?press|\bchest\b|\bborst\b/, g: { borst: .6, triceps: .25, schouders: .15 }, mass: 1.0 },
  { id: 'lat-pulldown', name: 'Lat pulldown', re: /pull ?down|lat ?pull|lat ?machine|\blats?\b/, g: { rug: .65, biceps: .25, schouders: .1 }, mass: 1.0 },
  { id: 'pull-up', name: 'Pull-up', re: /pull.?ups?|chin.?ups?|optrek/, g: { rug: .65, biceps: .3, core: .05 }, mass: 1.1 },
  { id: 'pullover', name: 'Pullover', re: /pull ?over/, g: { rug: .8, borst: .2 }, mass: 0.6 },
  { id: 'row', name: 'Row', re: /\brows?\b|roei|t.?bar|rowing/, g: { rug: .7, biceps: .2, schouders: .1 }, mass: 1.0 },
  { id: 'back-extension', name: 'Back extension', re: /back ?ext|hyper ?ext|rugstrek|lower ?back/, g: { rug: .4, billen: .3, hamstrings: .3 }, mass: 0.6 },
  { id: 'leg-curl', name: 'Leg curl', re: /leg ?curl|hamstring ?curl|(lying|seated|liggend|zittend|nordic).*curl|beenbuig|ham ?curl/, g: { hamstrings: 1 }, mass: 0.6 },
  { id: 'leg-extension', name: 'Leg extension', re: /leg ?ext|beenstrek|quad ?ext/, g: { quads: 1 }, mass: 0.7 },
  { id: 'wrist-curl', name: 'Wrist curl', re: /wrist|pols|forearm|onderarm/, g: { onderarmen: 1 }, mass: 0.25 },
  { id: 'hammer-curl', name: 'Hammer curl', re: /hammer ?curls?/, g: { biceps: .7, onderarmen: .3 }, mass: 0.4 },
  { id: 'biceps-curl', name: 'Biceps curl', re: /curl|biceps?/, g: { biceps: 1 }, mass: 0.4 },
  { id: 'triceps', name: 'Triceps', re: /tri(ceps?)?\b|pushdown|push ?down|pressdown|skull|french|overhead ?ext|tricep/, g: { triceps: 1 }, mass: 0.45 },
  { id: 'calf-raise', name: 'Calf raise', re: /calf|calves|kuit/, g: { kuiten: 1 }, mass: 0.4 },
  { id: 'leg-press', name: 'Leg press', re: /leg ?press|been ?(pers|press)|legpress/, g: { quads: .55, billen: .3, hamstrings: .15 }, mass: 1.4 },
  { id: 'hack-squat', name: 'Hack squat', re: /hack|pendulum|v.?squat|belt ?squat/, g: { quads: .65, billen: .3, hamstrings: .05 }, mass: 1.4 },
  { id: 'lunge', name: 'Lunge / split squat', re: /lunge|bulgarian|split ?squat|uitval|step.?ups?/, g: { quads: .5, billen: .4, hamstrings: .1 }, mass: 1.2 },
  { id: 'squat', name: 'Squat', re: /squat|kniebuig|hurk/, g: { quads: .5, billen: .3, hamstrings: .1, core: .1 }, mass: 1.6 },
  { id: 'rdl', name: 'Romanian deadlift', re: /\brdl\b|romanian|roemeens|stiff/, g: { hamstrings: .5, billen: .35, rug: .15 }, mass: 1.4 },
  { id: 'deadlift', name: 'Deadlift', re: /dead ?lift|\bdl\b/, g: { hamstrings: .3, billen: .3, rug: .3, quads: .1 }, mass: 1.8 },
  { id: 'hip-thrust', name: 'Hip thrust', re: /hip ?thrust|glute ?bridge|bridge/, g: { billen: .8, hamstrings: .2 }, mass: 1.1 },
  { id: 'abductor', name: 'Abductor', re: /abduct|buitenkant/, g: { heupen: .5, billen: .5 }, mass: 0.5 },
  { id: 'adductor', name: 'Adductor', re: /adduct|binnenkant/, g: { heupen: 1 }, mass: 0.5 },
  { id: 'glute', name: 'Glute machine', re: /glute|kickback|billen/, g: { billen: 1 }, mass: 0.5 },
  { id: 'core', name: 'Core / buik', re: /crunch|\babs?\b|buik|core|plank|leg ?raise|knee ?raise|rotary|torso|oblique|sit.?ups?/, g: { core: 1 }, mass: 0.4 },
  { id: 'press', name: 'Press (borst)', re: /press|druk/, g: { borst: .6, triceps: .25, schouders: .15 }, mass: 1.0 },
];

export const OTHER = { id: 'other', name: 'Overig', g: { overig: 1 }, mass: 0.7 };

export function libById(id) { return LIBRARY.find((l) => l.id === id) || (id === 'other' ? OTHER : null); }

/** Genormaliseerde sleutel voor een oefeningnaam (voor PR's en historie). */
export function exKey(name) {
  return String(name || '').toLowerCase().replace(/[^\p{L}\p{N} ]+/gu, ' ').replace(/\s+/g, ' ').trim();
}

export function matchExercise(name, overrides = {}) {
  const k = exKey(name);
  if (overrides[k]) return libById(overrides[k]) || OTHER;
  for (const l of LIBRARY) if (l.re.test(k)) return l;
  return OTHER;
}

/** Geschatte 1RM (Epley), bodyweight telt mee indien relevant. */
export function e1rm(weight, reps) {
  if (!weight || !reps) return null;
  if (reps === 1) return weight;
  return weight * (1 + Math.min(reps, 30) / 30);
}

// ---------- Parser ----------

const MONTHS = { jan: 1, januari: 1, january: 1, feb: 2, februari: 2, february: 2, mrt: 3, maart: 3, mar: 3, march: 3, apr: 4, april: 4, mei: 5, may: 5, jun: 6, juni: 6, june: 6, jul: 7, juli: 7, july: 7, aug: 8, augustus: 8, august: 8, sep: 9, sept: 9, september: 9, okt: 10, oct: 10, oktober: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12 };
const MONTH_RE = '(jan(?:uari|uary)?|feb(?:ruari|ruary)?|mrt|maart|mar(?:ch)?|apr(?:il)?|mei|may|jun[ie]?|jul[iy]?|aug(?:ustus|ust)?|sept?(?:ember)?|okt(?:ober)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
const SESSION_RE = /\b(upper|lower|push|pull|legs?|benen|full ?body|fullbody|boven(lichaam)?|onder(lichaam)?|armen|arms|chest|back|shoulders|rug|borst|schouders|training|workout|sessie|session|gym|dag|day)\b/i;

function inferYear(m, d, ref = new Date()) {
  const y = ref.getFullYear();
  const cand = new Date(y, m - 1, d);
  const limit = new Date(ref.getTime() + 2 * 86400000);
  return cand > limit ? y - 1 : y;
}

function validDate(y, m, d) {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(y, m - 1, d);
  if (dt.getMonth() !== m - 1) return null;
  return ymd(dt);
}

/** Zoek een datum in een regel. Geeft {date, index, length, strong} of null. */
export function findDate(line, ref = new Date()) {
  const s = line.toLowerCase();
  let m;
  if ((m = /(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s))) {
    const r = validDate(+m[1], +m[2], +m[3]);
    if (r) return { date: r, index: m.index, length: m[0].length, strong: true };
  }
  if ((m = new RegExp(`(\\d{1,2})(?:e|ste|de)?\\s+${MONTH_RE}\\.?(?:\\s+(\\d{4}))?`).exec(s))) {
    const mo = MONTHS[m[2].replace(/\.$/, '')] || MONTHS[m[2].slice(0, 3)];
    const d = +m[1];
    const y = m[3] ? +m[3] : inferYear(mo, d, ref);
    const r = validDate(y, mo, d);
    if (r) return { date: r, index: m.index, length: m[0].length, strong: true };
  }
  if ((m = new RegExp(`${MONTH_RE}\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(\\d{4}))?\\b`).exec(s))) {
    const mo = MONTHS[m[1]] || MONTHS[m[1].slice(0, 3)];
    const d = +m[2];
    const y = m[3] ? +m[3] : inferYear(mo, d, ref);
    const r = validDate(y, mo, d);
    if (r) return { date: r, index: m.index, length: m[0].length, strong: true };
  }
  if ((m = /(?<![\d.,])(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})(?![\d])/.exec(s))) {
    let y = +m[3];
    if (y < 100) y += 2000;
    const r = validDate(y, +m[2], +m[1]);
    if (r) return { date: r, index: m.index, length: m[0].length, strong: true };
  }
  if ((m = /(?<![\d.,])(\d{1,2})[-/](\d{1,2})(?![\d/.-])/.exec(s))) {
    const d = +m[1], mo = +m[2];
    const r = validDate(inferYear(mo, d, ref), mo, d);
    if (r) return { date: r, index: m.index, length: m[0].length, strong: false };
  }
  return null;
}

const NUM = '(\\d+(?:[.,]\\d+)?)';
const UNIT = '(kg|kilo\'?s?|lbs?|lb|pond)';

/** Haal gewicht/reps uit de rest van een regel. */
export function parseSet(rest) {
  let s = ' ' + rest.toLowerCase().replace(/(\d),(\d)/g, '$1.$2') + ' ';
  const toKg = (w, u) => (u && /^lb|pond/.test(u) ? Math.round(w * 0.4536 * 10) / 10 : w);
  const out = [];
  let bw = /\b(bw|body ?weight|lichaamsgewicht|eigen gewicht)\b/.test(s) || /^\s*\+\s*\d/.test(s);
  let sets = null;
  let m;
  // Sets tellen ("2 sets", "1 set/ 2 sets" = 3) en daarna uit de tekst halen.
  const setRe = /(\d+)\s*(?:sets?|series|setjes)\b/g;
  while ((m = setRe.exec(s))) sets = (sets || 0) + Number(m[1]);
  s = s.replace(setRe, ' ');

  const push = (w, r, u) => {
    w = Number(w); r = Number(r);
    if (!(r >= 1 && r <= 60)) return;
    if (!(w >= 0 && w <= 600)) return;
    out.push({ weight: toKg(w, u), reps: Math.round(r) });
  };

  // 1) Expliciet: gewicht met eenheid + reps met woord, ook als lijst ("60kg/45kg 5 reps/7 reps").
  const weights = [];
  const wl = new RegExp(`((?:\\d+(?:\\.\\d+)?\\s*(?:kg|lbs?)?\\s*/\\s*)*\\d+(?:\\.\\d+)?)\\s*${UNIT}`, 'g');
  while ((m = wl.exec(s))) for (const part of m[1].split('/')) weights.push([parseFloat(part), m[2]]);
  const reps = [];
  const rl = /(\d+)\s*(?:reps?|herh\w*\.?|rep\b|keer)/g;
  while ((m = rl.exec(s))) reps.push(Number(m[1]));
  if (weights.length && reps.length) {
    if (weights.length === reps.length) weights.forEach(([w, u], i) => push(w, reps[i], u));
    else push(weights[0][0], reps[0], weights[0][1]);
  }

  let mm;
  if (!out.length) {
    // a x b x c (sets x reps x gewicht of gewicht x sets x reps)
    const triple = new RegExp(`${NUM}\\s*[x×*]\\s*${NUM}\\s*[x×*]\\s*${NUM}\\s*${UNIT}?`, 'g');
    while ((mm = triple.exec(s))) {
      const a = +mm[1], b = +mm[2], c = +mm[3];
      if (c >= a && c >= b) { sets = sets ?? a; push(c, b, mm[4]); } else if (a >= b && a >= c) { sets = sets ?? b; push(a, c, mm[4]); }
    }
  }
  if (!out.length) {
    const rw = new RegExp(`(\\d+)\\s*[x×*]\\s*${NUM}\\s*${UNIT}`, 'g');
    while ((mm = rw.exec(s))) push(mm[2], mm[1], mm[3]);
  }
  if (!out.length) {
    const wr = new RegExp(`${NUM}\\s*${UNIT}?\\s*[x×*]\\s*(\\d+)`, 'g');
    while ((mm = wr.exec(s))) {
      let w = +mm[1], r = +mm[3];
      if (!mm[2] && w <= 20 && r > 25) [w, r] = [r, w];
      push(w, r, mm[2]);
    }
  }
  if (!out.length) {
    const rr = new RegExp(`(\\d+)\\s*(?:reps?|herh\\w*\\.?)\\s*(?:@|op|met|-|,)?\\s*${NUM}\\s*${UNIT}?`, 'g');
    while ((mm = rr.exec(s))) push(mm[2], mm[1], mm[3]);
  }
  if (!out.length) {
    const wu = new RegExp(`${NUM}\\s*${UNIT}\\s*(?:[-–:,/@]|voor|for|keer)?\\s*(\\d+)`, 'g');
    while ((mm = wu.exec(s))) push(mm[1], mm[3], mm[2]);
  }
  if (!out.length) {
    const b = /\b(?:bw|body ?weight)\s*(?:\+\s*(\d+(?:\.\d+)?)\s*(?:kg)?)?\s*[x×*:-]?\s*(\d+)/.exec(s);
    if (b) { bw = true; push(b[1] ? +b[1] : 0, b[2]); }
  }
  if (!out.length) {
    const plain = new RegExp(`(?<![\\d.])${NUM}\\s*(?:[-–/:,]|\\s)\\s*(\\d+)(?![\\d.])`, 'g');
    while ((mm = plain.exec(s))) {
      let w = +mm[1], r = +mm[2];
      if (w <= 20 && r > 25) [w, r] = [r, w];
      push(w, r);
    }
  }
  if (!out.length) {
    const onlyReps = /(\d+)\s*(reps?|herh\w*)/.exec(s);
    if (onlyReps) { bw = true; push(0, onlyReps[1]); }
  }
  if (!out.length) {
    // Alleen sets ("Pull-ups 2 sets"): bodyweight zonder bekende reps.
    if (sets) return { weight: 0, reps: null, bw: true, sets, all: [] };
    return null;
  }
  let best = out[0];
  for (const o of out) if ((e1rm(o.weight || 1, o.reps) || 0) > (e1rm(best.weight || 1, best.reps) || 0)) best = o;
  return { ...best, bw, sets, all: out };
}

/** Haalt opsommings- en afvinktekens weg; done = afgevinkt. */
export function stripMarker(line) {
  const m = /^\s*(?:[-*•·>]\s*)?(\[( |x|X|✓)?\]|☐|☑|☒|✓|✔|✅|○|◦|●|⚪|🔘)?\s*[-–•*·]?\s*/u.exec(line);
  const mark = m[1] || '';
  const done = /x|X|✓|✔|✅|☑|☒|●/.test(mark);
  return { text: line.slice(m[0].length), done, marked: !!mark };
}

/** Splits een regel in naam + set. Naam = tekst vóór het eerste getal / BW. */
export function parseExerciseLine(line) {
  const clean = stripMarker(line).text.replace(/^\d+[.)]\s+/, '').trim();
  const m = /^(.*?[\p{L}][\p{L}\s'’&+/()-]*?)\s*[:\-–=]?\s*(?=(\d|bw\b|body ?weight|\+\s*\d))/iu.exec(clean);
  if (!m) return null;
  const name = m[1].replace(/[\s:\-–=(]+$/, '').trim();
  if (!name || name.length < 2) return null;
  const set = parseSet(clean.slice(m[0].length));
  if (!set) return null;
  const note = (/\(([^)]*)\)/.exec(clean.slice(m[0].length)) || [])[1];
  return { name: titleCase(name), weight: set.weight, reps: set.reps, sets: set.sets, bw: set.bw, note: note || '' };
}

function titleCase(s) {
  s = s.replace(/\s+/g, ' ');
  return s[0].toUpperCase() + s.slice(1);
}

/**
 * Parse vrije notities naar sessies.
 * Ondersteunt koppen als "Upper 6", "Upper 6 – 3/11", "ma 3 nov", "03-11-2026", en
 * oefeningregels als "Chest press 80 x 8", "Leg press 200kg 10", "Curl 14/12".
 */
export function parseNotes(text, ref = new Date()) {
  const lines = String(text || '').split(/\r?\n/);
  const sessions = [];
  const skipped = [];
  let cur = null;
  let pendingDate = null;

  const newSession = (name, date) => {
    cur = { id: uid(), name: name || 'Training', date: date || null, exercises: [] };
    sessions.push(cur);
    return cur;
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const date = findDate(line, ref);
    const ex = parseExerciseLine(date && date.index === 0 ? line.slice(date.length) : line);
    const lib = ex ? matchExercise(ex.name) : null;
    const startsWithDate = date && date.index <= 3;
    const sessionWord = SESSION_RE.test(line);
    const isKnownExercise = !!(ex && lib && lib.id !== 'other');

    const looksHeader = (startsWithDate && !(isKnownExercise && !date.strong))
      || (date && date.strong && !isKnownExercise)
      || (sessionWord && !isKnownExercise && (!ex || /^(upper|lower|push|pull|legs?|benen|full|boven|onder|armen|arms|training|workout|sessie|session|dag|day|gym)\b/i.test(line.replace(/^[^\p{L}]+/u, ''))));

    if (looksHeader) {
      let name = line;
      if (date) name = (line.slice(0, date.index) + ' ' + line.slice(date.index + date.length));
      name = name.replace(/\b(ma|di|wo|do|vr|za|zo|maandag|dinsdag|woensdag|donderdag|vrijdag|zaterdag|zondag|mon|tue|wed|thu|fri|sat|sun)\b\.?/gi, '')
        .replace(/[\s\-–:|,•*#]+$/g, '').replace(/^[\s\-–:|,•*#]+/g, '').replace(/\s+/g, ' ').trim();
      if (cur && cur.exercises.length === 0) {
        if (date) cur.date = date.date;
        if (name) cur.name = cur.name === 'Training' || !cur.name ? name : `${cur.name} ${name}`.trim();
      } else {
        newSession(name || 'Training', date ? date.date : null);
      }
      if (date) pendingDate = date.date;
      continue;
    }
    if (ex) {
      if (!cur) newSession('Training', date ? date.date : pendingDate);
      const mk = stripMarker(raw);
      cur.exercises.push({ name: ex.name, weight: ex.weight, reps: ex.reps, sets: ex.sets || null, bw: ex.bw || false, note: ex.note, done: mk.marked ? mk.done : null });
      continue;
    }
    skipped.push(line);
  }
  const result = sessions.filter((s) => s.exercises.length);
  // Sessies zonder datum: geef ze de datum van de vorige sessie + 1 dag niet; laat leeg zodat de gebruiker kiest.
  return { sessions: result, skipped };
}

// ---------- Spierbelasting ----------

/**
 * Bereken per sessie de spierbelasting. Omdat alleen de topset genoteerd wordt,
 * schatten we het totaal aan zware sets (standaard 3 per oefening).
 * Belasting per oefening = sets × massa × intensiteit × rep-factor.
 */
export function computeLoads(sessions, settings) {
  const defaultSets = settings.defaultSets || 3;
  const bodyweight = settings.bodyweight || 80;
  const overrides = settings.exerciseMap || {};
  const base = settings.baselines || {};
  const sorted = [...sessions].filter((s) => !s.deleted && s.date).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (a.createdAt || 0) - (b.createdAt || 0)));
  const best = {};
  for (const [k, b] of Object.entries(base)) if (b.e1rm) best[k] = b.e1rm;
  const result = {};
  for (const s of sorted) {
    let load = 0;
    const groups = {};
    const hardSets = {};
    const exs = [];
    for (const e of s.exercises || []) {
      const key = exKey(e.name);
      const lib = matchExercise(e.name, overrides);
      const effW = e.bw ? bodyweight + (e.weight || 0) : e.weight;
      const est = e1rm(effW, e.reps);
      const prevBest = best[key] || null;
      const isPR = est != null && (prevBest == null || est > prevBest + 0.01);
      if (est != null) best[key] = Math.max(prevBest || 0, est);
      const ri = est != null && best[key] ? clamp(est / best[key], 0.3, 1) : 0.9;
      const sets = e.sets || base[key]?.sets || defaultSets;
      const repF = clamp(0.75 + (e.reps || 8) * 0.025, 0.8, 1.25);
      const intensity = 0.55 + 0.45 * ri * ri;
      const l = sets * lib.mass * intensity * repF;
      load += l;
      for (const [g, w] of Object.entries(lib.g)) {
        groups[g] = (groups[g] || 0) + l * w;
        hardSets[g] = (hardSets[g] || 0) + sets * w;
      }
      exs.push({ ...e, key, lib: lib.id, libName: lib.name, e1rm: est, ri, load: l, isPR: isPR && prevBest != null, firstTime: prevBest == null, sets });
    }
    result[s.id] = { load, groups, hardSets, exercises: exs };
  }
  return result;
}

/** Spierbelasting omgezet naar TRIMP-equivalent zodat het in de dag-strain past. */
export const MUSCULAR_TO_TRIMP = 3.2;

export function exerciseHistory(sessions, key, settings) {
  const loads = computeLoads(sessions, settings);
  const out = [];
  for (const s of sessions) {
    if (s.deleted || !s.date) continue;
    const r = loads[s.id];
    if (!r) continue;
    for (const e of r.exercises) if (e.key === key) out.push({ date: s.date, session: s.name, sessionId: s.id, ...e });
  }
  return out.sort((a, b) => (a.date < b.date ? -1 : 1));
}

export function allExercises(sessions, settings) {
  const map = {};
  const overrides = settings.exerciseMap || {};
  for (const s of sessions) {
    if (s.deleted) continue;
    for (const e of s.exercises || []) {
      const k = exKey(e.name);
      if (!map[k]) map[k] = { key: k, name: e.name, count: 0, last: null, lib: matchExercise(e.name, overrides) };
      map[k].count++;
      if (!map[k].last || s.date > map[k].last) map[k].last = s.date;
    }
  }
  return Object.values(map).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export function newSession(date = today()) {
  return { id: uid(), date, name: '', exercises: [], createdAt: Date.now(), updatedAt: Date.now() };
}

/** Samenvoegen van twee strength-documenten (lokaal + Drive), laatste wijziging wint. */
export function mergeDocs(a, b) {
  const byId = {};
  for (const s of [...(a?.sessions || []), ...(b?.sessions || [])]) {
    const ex = byId[s.id];
    if (!ex || (s.updatedAt || 0) > (ex.updatedAt || 0)) byId[s.id] = s;
  }
  const ea = a?.exerciseMap || {}, eb = b?.exerciseMap || {};
  const newer = (a?.mapUpdatedAt || 0) >= (b?.mapUpdatedAt || 0);
  const tById = {};
  for (const t of [...(a?.templates || []), ...(b?.templates || [])]) {
    const ex = tById[t.id];
    if (!ex || (t.updatedAt || 0) > (ex.updatedAt || 0)) tById[t.id] = t;
  }
  return {
    sessions: Object.values(byId),
    templates: Object.values(tById),
    exerciseMap: newer ? { ...eb, ...ea } : { ...ea, ...eb },
    mapUpdatedAt: Math.max(a?.mapUpdatedAt || 0, b?.mapUpdatedAt || 0),
    updatedAt: Math.max(a?.updatedAt || 0, b?.updatedAt || 0),
  };
}

export { parseYmd };

// ---------- Schema's (jouw "levende notitie" per trainingsdag) ----------

/** Basiswaarden uit schema's: per oefening de laatst bekende topset uit je notitie. */
export function templateBaselines(doc, bodyweight = 80) {
  const out = {};
  for (const t of doc?.templates || []) {
    if (t.deleted) continue;
    for (const e of t.exercises || []) {
      const k = exKey(e.name);
      const w = e.bw ? bodyweight + (e.weight || 0) : e.weight;
      const est = e.reps ? e1rm(w, e.reps) : null;
      if (!out[k] || (est || 0) > (out[k].e1rm || 0)) out[k] = { ...e, e1rm: est };
    }
  }
  return out;
}

export function activeTemplates(doc) {
  return (doc?.templates || []).filter((t) => !t.deleted).sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name, 'nl', { numeric: true }));
}

export function findTemplate(doc, name) {
  const n = String(name || '').trim().toLowerCase();
  return activeTemplates(doc).find((t) => t.name.trim().toLowerCase() === n) || null;
}

/** Laatste bekende topset van een oefening: eerst uit je trainingen, anders uit je schema. */
export function currentSet(doc, name, settings = {}) {
  const k = exKey(name);
  if (!k) return null;
  let last = null;
  for (const s of doc?.sessions || []) {
    if (s.deleted || !s.date) continue;
    for (const e of s.exercises || []) {
      if (exKey(e.name) === k && (!last || s.date > last.date || (s.date === last.date && (s.updatedAt || 0) > (last.updatedAt || 0)))) last = { ...e, date: s.date, updatedAt: s.updatedAt, sessionId: s.id };
    }
  }
  if (last) return last;
  const b = templateBaselines(doc, settings.bodyweight)[k];
  return b ? { ...b, date: null, fromTemplate: true } : null;
}

export function setText(e) {
  if (!e) return '–';
  const w = Number(e.weight || 0).toLocaleString('nl-NL', { maximumFractionDigits: 2 });
  const wt = e.bw ? (e.weight ? `+${w} kg` : 'BW') : `${w} kg`;
  return `${wt}${e.reps ? ` × ${e.reps}` : ''}${e.sets ? ` · ${e.sets} sets` : ''}`;
}
