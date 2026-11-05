// SVG-grafieken met aanraak-interactie (schuiven = waarde zien, tikken = doorklikken).
// Elke grafiek registreert een model; interact.js koppelt de gebaren.
import { esc, fmtTime, weekdayShort, fmtDateShort, num } from './util.js';

const REG = new Map();
let seq = 0;

export function resetCharts() { REG.clear(); }
export function getChart(id) { return REG.get(id); }

function register(model) {
  const id = 'c' + (++seq);
  REG.set(id, model);
  return id;
}

function wrap(id, svg, extra = '') {
  return `<div class="chartwrap" data-chart="${id}" ${extra}>${svg}<div class="ch-rule"></div><div class="ch-dot"></div><div class="ch-tip"></div></div>`;
}

const dayLabel = (d, n) => (n <= 7 ? weekdayShort(d) : fmtDateShort(d));

/** Ring met waarde. frac 0..1. */
export function ring({ frac = 0, color = 'var(--accent)', size = 120, stroke = 11, label = '', sub = '', track = 'var(--track)', target = null, glow = false }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const f = Math.max(0, Math.min(1, frac || 0));
  let targetArc = '';
  if (target) {
    const [a, b] = target;
    const R = r - stroke / 2 - 5;
    const C = 2 * Math.PI * R;
    targetArc = `<circle cx="${size / 2}" cy="${size / 2}" r="${R}" fill="none" stroke="${color}" stroke-opacity=".7" stroke-width="3" stroke-linecap="round" stroke-dasharray="${Math.max(0.1, (b - a) * C)} ${C * 2}" stroke-dashoffset="${-a * C}" transform="rotate(-90 ${size / 2} ${size / 2})"/>`;
  }
  return `<svg class="ring" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" aria-hidden="true">
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${track}" stroke-width="${stroke}"/>
    ${f > 0.002 ? `<circle class="ring-val${glow ? ' glow' : ''}" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round"
      stroke-dasharray="${c * f} ${c}" transform="rotate(-90 ${size / 2} ${size / 2})" style="--c:${c};--f:${c * f};color:${color}"/>` : ''}
    ${targetArc}
    <text x="50%" y="${sub ? '49%' : '53%'}" text-anchor="middle" dominant-baseline="middle" class="ring-label" style="font-size:${size * 0.25}px">${esc(label)}</text>
    ${sub ? `<text x="50%" y="70%" text-anchor="middle" class="ring-sub" style="font-size:${size * 0.095}px">${esc(sub)}</text>` : ''}
  </svg>`;
}

/**
 * Staafdiagram per dag. items: [{date, value, color, label, go, tip}]
 */
export function bars(items, { height = 140, max = null, fmt = (v) => v, showValues = true, band = null, labelEvery = 1, unit = '', avgLine = false } = {}) {
  const W = 340, H = height, pt = 18, pb = 22;
  const n = items.length || 1;
  const vals = items.map((i) => i.value).filter((v) => v != null);
  const vmax = max ?? Math.max(1, ...vals) * 1.12;
  const step = W / n;
  const bw = Math.max(2, step * 0.62);
  const y = (v) => pt + (H - pt - pb) * (1 - v / vmax);
  let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">`;
  for (const f of [0.5, 1]) s += `<line x1="0" x2="${W}" y1="${y(vmax * f / 1.12)}" y2="${y(vmax * f / 1.12)}" class="gridline dashed"/>`;
  if (band) s += `<rect x="0" y="${y(band[1])}" width="${W}" height="${y(band[0]) - y(band[1])}" fill="var(--band)"/>`;
  if (avgLine && vals.length) {
    const a = vals.reduce((x, z) => x + z, 0) / vals.length;
    s += `<line x1="0" x2="${W}" y1="${y(a)}" y2="${y(a)}" class="avgline"/>`;
  }
  items.forEach((it, i) => {
    const cx = step * (i + 0.5);
    if (it.value != null) {
      const top = y(it.value);
      s += `<rect class="bar" data-i="${i}" x="${cx - bw / 2}" y="${top}" width="${bw}" height="${Math.max(0, H - pb - top)}" rx="${Math.min(4, bw / 2)}" fill="${it.color || 'var(--accent)'}"/>`;
      if (showValues && n <= 14) s += `<text x="${cx}" y="${top - 5}" text-anchor="middle" class="ct-val">${esc(fmt(it.value))}</text>`;
    } else {
      s += `<rect x="${cx - bw / 2}" y="${H - pb - 2}" width="${bw}" height="2" rx="1" fill="var(--track)"/>`;
    }
    if (i % labelEvery === 0 || i === n - 1) s += `<text x="${cx}" y="${H - 6}" text-anchor="middle" class="ct-lab">${esc(it.label ?? dayLabel(it.date, n))}</text>`;
  });
  s += '</svg>';
  const id = register({
    W, H,
    at(xv) {
      const i = Math.max(0, Math.min(n - 1, Math.floor(xv / step)));
      const it = items[i];
      return { x: step * (i + 0.5), y: it.value != null ? y(it.value) : H - pb, title: it.tip || (it.date ? dayLabel(it.date, 30) : it.label || ''), value: it.value != null ? `${fmt(it.value)}${unit}` : 'geen data', color: it.color, go: it.go, i, bars: true };
    },
  });
  return wrap(id, s);
}

/** Lijn met optionele baseline-band. points: [{date, value, go}] */
export function line(points, { height = 140, color = 'var(--accent)', band = null, fmt = (v) => v, min = null, max = null, labelEvery = null, dots = true, unit = '', area = true } = {}) {
  const W = 340, H = height, pt = 18, pb = 22, pl = 6, pr = 6;
  const vals = points.map((p) => p.value).filter((v) => v != null);
  if (!vals.length) return `<div class="empty-chart">Nog geen data</div>`;
  let lo = min ?? Math.min(...vals, ...(band ? [band[0]] : []));
  let hi = max ?? Math.max(...vals, ...(band ? [band[1]] : []));
  if (hi === lo) { hi += 1; lo -= 1; }
  const padv = (hi - lo) * 0.15;
  if (min == null) lo -= padv;
  if (max == null) hi += padv;
  const n = points.length;
  const x = (i) => pl + (W - pl - pr) * (n === 1 ? 0.5 : i / (n - 1));
  const y = (v) => pt + (H - pt - pb) * (1 - (v - lo) / (hi - lo));
  let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">`;
  if (band) s += `<rect x="0" y="${y(band[1])}" width="${W}" height="${Math.max(1, y(band[0]) - y(band[1]))}" fill="var(--band)" rx="4"/>`;
  // Vloeiende lijn (Catmull-Rom → Bézier) per aaneengesloten segment.
  const segs = [];
  let cur = [];
  points.forEach((p, i) => { if (p.value == null) { if (cur.length) segs.push(cur); cur = []; } else cur.push([x(i), y(p.value)]); });
  if (cur.length) segs.push(cur);
  const smooth = (pts) => {
    if (pts.length < 3) return pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('');
    let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      // Geen 'overshoot': controlepunten blijven tussen de twee punten (monotoon).
      const lo = Math.min(p1[1], p2[1]), hi = Math.max(p1[1], p2[1]);
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, Math.max(lo, Math.min(hi, p1[1] + (p2[1] - p0[1]) / 6))];
      const c2 = [p2[0] - (p3[0] - p1[0]) / 6, Math.max(lo, Math.min(hi, p2[1] - (p3[1] - p1[1]) / 6))];
      d += `C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
    }
    return d;
  };
  const gid = 'g' + (seq + 1) + Math.random().toString(36).slice(2, 5);
  s += `<defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".26"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>`;
  for (const sg of segs) {
    const d = smooth(sg);
    if (area && sg.length > 1) s += `<path d="${d}L${sg[sg.length - 1][0]},${H - pb}L${sg[0][0]},${H - pb}Z" fill="url(#${gid})"/>`;
    s += `<path d="${d}" fill="none" stroke="${color}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>`;
  }
  const every = labelEvery || Math.ceil(n / 6);
  let lastI = -1;
  points.forEach((p, i) => {
    if (p.value != null) lastI = i;
    if (p.value != null && dots && n <= 31) s += `<circle cx="${x(i)}" cy="${y(p.value)}" r="${n <= 14 ? 3 : 2}" fill="${p.color || color}"/>`;
    if ((n - 1 - i) % every === 0) s += `<text x="${Math.min(W - 14, Math.max(14, x(i)))}" y="${H - 6}" text-anchor="middle" class="ct-lab">${esc(p.label ?? dayLabel(p.date, n))}</text>`;
  });
  if (lastI >= 0) {
    const last = points[lastI];
    s += `<circle cx="${x(lastI)}" cy="${y(last.value)}" r="4.5" fill="${color}" stroke="var(--card)" stroke-width="2"/>`;
  }
  s += '</svg>';
  const id = register({
    W, H,
    at(xv) {
      let i = Math.round(((xv - pl) / (W - pl - pr)) * (n - 1));
      i = Math.max(0, Math.min(n - 1, i));
      // dichtstbijzijnde punt met waarde
      let j = i;
      for (let k = 0; k < n; k++) { if (points[i + k]?.value != null) { j = i + k; break; } if (points[i - k]?.value != null) { j = i - k; break; } }
      const p = points[j];
      return { x: x(j), y: p.value != null ? y(p.value) : H - pb, title: p.tip || (p.date ? dayLabel(p.date, 30) : p.label || ''), value: p.value != null ? `${fmt(p.value)}${unit}` : 'geen data', color, go: p.go, i: j };
    },
  });
  return wrap(id, s);
}

/** Hartslag door de dag met zones, slaap en activiteiten. */
export function hrDay(day, { maxHr = 190, height = 170, activities = [], fromMin = 0, toMin = 1440, live = false } = {}) {
  if (!day?.hr?.length) return `<div class="empty-chart">Geen hartslagdata voor deze dag</div>`;
  const W = 340, H = height, pt = 12, pb = 20;
  const span = toMin - fromMin;
  const vals = day.hr.slice(fromMin, toMin).filter(Boolean);
  if (!vals.length) return `<div class="empty-chart">Geen hartslag in deze periode</div>`;
  const lo = Math.max(30, Math.min(...vals) - 6);
  const hi = Math.max(...vals, lo + 40) + 6;
  const x = (i) => (W * (i - fromMin)) / span;
  const y = (v) => pt + (H - pt - pb) * (1 - (v - lo) / (hi - lo));
  let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">`;
  const shade = (a, b, cls) => {
    const i0 = Math.max(fromMin, (a - day.hrStart) / 60000), i1 = Math.min(toMin, (b - day.hrStart) / 60000);
    if (i1 > i0) s += `<rect x="${x(i0)}" y="${pt}" width="${x(i1) - x(i0)}" height="${H - pt - pb}" class="${cls}" rx="3"/>`;
  };
  if (day.sleep) shade(day.sleep.start, day.sleep.end, 'sh-sleep');
  if (day.sleepNext) shade(day.sleepNext.start, day.sleepNext.end, 'sh-sleep');
  for (const a of activities) shade(a.start, a.end, 'sh-act');
  for (const f of [0.6, 0.7, 0.8, 0.9]) {
    const v = maxHr * f;
    if (v > lo && v < hi) s += `<line x1="0" x2="${W}" y1="${y(v)}" y2="${y(v)}" class="gridline dashed"/><text x="${W - 2}" y="${y(v) - 2}" text-anchor="end" class="ct-tiny">${Math.round(f * 100)}%</text>`;
  }
  // Gekleurde lijn per zone via gradient op y.
  const gid = 'hz' + (seq + 1);
  const stopAt = (f) => Math.max(0, Math.min(1, (y(maxHr * f) - pt) / (H - pt - pb)));
  s += `<defs><linearGradient id="${gid}" gradientUnits="userSpaceOnUse" x1="0" y1="${pt}" x2="0" y2="${H - pb}">
    <stop offset="${stopAt(0.9)}" stop-color="var(--z5)"/><stop offset="${stopAt(0.9)}" stop-color="var(--z4)"/>
    <stop offset="${stopAt(0.8)}" stop-color="var(--z4)"/><stop offset="${stopAt(0.8)}" stop-color="var(--z3)"/>
    <stop offset="${stopAt(0.7)}" stop-color="var(--z3)"/><stop offset="${stopAt(0.7)}" stop-color="var(--z2)"/>
    <stop offset="${stopAt(0.6)}" stop-color="var(--z2)"/><stop offset="${stopAt(0.6)}" stop-color="var(--hr)"/>
    <stop offset="1" stop-color="var(--hr)"/></linearGradient></defs>`;
  let d = '';
  let pen = false;
  let lastI = -1;
  for (let i = fromMin; i < Math.min(toMin, day.hr.length); i++) {
    const v = day.hr[i];
    if (!v) { pen = false; continue; }
    d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
    pen = true;
    lastI = i;
  }
  s += `<path d="${d}" fill="none" stroke="url(#${gid})" stroke-width="1.5" vector-effect="non-scaling-stroke" stroke-linejoin="round"/>`;
  if (live && lastI >= 0) s += `<circle cx="${x(lastI)}" cy="${y(day.hr[lastI])}" r="4" fill="var(--hr)" class="pulse-dot"/>`;
  const hours = span <= 180 ? (span <= 60 ? [0, 15, 30, 45, 60] : [0, 30, 60, 90, 120, 150, 180]).map((m) => fromMin + m).filter((m) => m <= toMin) : [0, 360, 720, 1080, 1440].map((m) => m).filter((m) => m >= fromMin && m <= toMin);
  for (const m of hours) s += `<text x="${Math.min(W - 14, Math.max(14, x(m)))}" y="${H - 5}" text-anchor="middle" class="ct-lab">${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}</text>`;
  s += `<text x="2" y="${pt + 9}" class="ct-tiny">${Math.round(hi)}</text><text x="2" y="${H - pb - 3}" class="ct-tiny">${Math.round(lo)}</text>`;
  s += '</svg>';
  const zoneOf = (v) => { const f = v / maxHr; return f >= 0.9 ? 5 : f >= 0.8 ? 4 : f >= 0.7 ? 3 : f >= 0.6 ? 2 : f >= 0.5 ? 1 : 0; };
  const id = register({
    W, H,
    at(xv) {
      let i = Math.round(fromMin + (xv / W) * span);
      i = Math.max(fromMin, Math.min(Math.min(toMin, day.hr.length) - 1, i));
      let j = i;
      for (let k = 0; k < 30; k++) { if (day.hr[i - k]) { j = i - k; break; } if (day.hr[i + k]) { j = i + k; break; } }
      const v = day.hr[j];
      const t = day.hrStart + j * 60000;
      const act = activities.find((a) => t >= a.start && t < a.end);
      const asleep = (day.sleep && t >= day.sleep.start && t < day.sleep.end) || (day.sleepNext && t >= day.sleepNext.start && t < day.sleepNext.end);
      const z = v ? zoneOf(v) : 0;
      return { x: x(j), y: v ? y(v) : H - pb, title: `${fmtTime(t)}${act ? ` · ${act.name}` : asleep ? ' · slaap' : ''}`, value: v ? `${v} bpm${z ? ` · zone ${z}` : ''}` : 'geen meting', color: z ? `var(--z${z})` : 'var(--hr)' };
    },
  });
  return wrap(id, s);
}

/** Hypnogram van slaapfasen. */
export function hypnogram(sleep, { height = 150 } = {}) {
  if (!sleep?.stages?.length) return `<div class="empty-chart">Geen slaapfasen beschikbaar</div>`;
  const W = 340, H = height, pt = 8, pb = 22, pl = 46;
  const rows = sleep.classic ? ['awake', 'restless', 'asleep'] : ['awake', 'rem', 'light', 'deep'];
  const labels = { awake: 'Wakker', rem: 'REM', light: 'Licht', deep: 'Diep', restless: 'Onrustig', asleep: 'Slaap' };
  const colors = { awake: 'var(--st-awake)', rem: 'var(--st-rem)', light: 'var(--st-light)', deep: 'var(--st-deep)', restless: 'var(--st-light)', asleep: 'var(--st-deep)' };
  const t0 = sleep.start, t1 = sleep.end;
  const x = (t) => pl + (W - pl - 4) * ((t - t0) / (t1 - t0));
  const rh = (H - pt - pb) / rows.length;
  let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">`;
  rows.forEach((r, i) => { s += `<text x="0" y="${pt + rh * i + rh / 2 + 4}" class="ct-lab" text-anchor="start">${labels[r]}</text><line x1="${pl}" x2="${W}" y1="${pt + rh * (i + 1)}" y2="${pt + rh * (i + 1)}" class="gridline"/>`; });
  const rowOf = (type) => { let ri = rows.indexOf(type); if (ri < 0) ri = rows.indexOf(sleep.classic ? 'asleep' : 'light'); return ri; };
  for (const [type, a, b] of sleep.stages) {
    const ri = rowOf(type);
    s += `<rect x="${x(Math.max(a, t0))}" y="${pt + rh * ri + 3}" width="${Math.max(0.8, x(Math.min(b, t1)) - x(Math.max(a, t0)))}" height="${rh - 6}" rx="2.5" fill="${colors[type] || colors.light}"/>`;
  }
  s += `<text x="${pl}" y="${H - 5}" class="ct-lab">${fmtTime(t0)}</text><text x="${W - 2}" y="${H - 5}" text-anchor="end" class="ct-lab">${fmtTime(t1)}</text></svg>`;
  const id = register({
    W, H,
    at(xv) {
      const t = t0 + ((Math.max(pl, xv) - pl) / (W - pl - 4)) * (t1 - t0);
      const st = sleep.stages.find(([, a, b]) => t >= a && t < b) || sleep.stages[sleep.stages.length - 1];
      const ri = rowOf(st[0]);
      return { x: x(Math.min(t1, Math.max(t0, t))), y: pt + rh * ri + rh / 2, title: fmtTime(t), value: `${labels[st[0]] || st[0]} · ${Math.round((st[2] - st[1]) / 60000)} min`, color: colors[st[0]] };
    },
  });
  return wrap(id, s);
}

/** Gestapelde horizontale balk. parts: [{value,color,label}] */
export function stackBar(parts, { height = 10 } = {}) {
  const total = parts.reduce((a, p) => a + (p.value || 0), 0) || 1;
  return `<div class="stackbar" style="height:${height}px">${parts.map((p) => `<span style="flex:${(p.value || 0) / total};background:${p.color}" title="${esc(p.label || '')}"></span>`).join('')}</div>`;
}

/** Mini sparkline. */
export function spark(values, { color = 'var(--accent)', w = 80, h = 28, fill = false } = {}) {
  const v = values.filter((x) => x != null);
  if (v.length < 2) return '';
  const lo = Math.min(...v), hi = Math.max(...v);
  const pts = values.map((val, i) => (val == null ? null : [(w * i) / (values.length - 1), h - 3 - (h - 6) * ((val - lo) / (hi - lo || 1))])).filter(Boolean);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('');
  return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" class="spark" preserveAspectRatio="none">${fill ? `<path d="${d}L${pts[pts.length - 1][0]},${h}L${pts[0][0]},${h}Z" fill="${color}" opacity=".15"/>` : ''}<path d="${d}" fill="none" stroke="${color}" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/><circle cx="${pts[pts.length - 1][0]}" cy="${pts[pts.length - 1][1]}" r="2.2" fill="${color}"/></svg>`;
}

/** Live-lijn voor realtime hartslag (laatste N seconden). samples: [{t, bpm}] */
export function liveLine(samples, { height = 150, windowSec = 300, maxHr = 190 } = {}) {
  const W = 340, H = height, pt = 10, pb = 18;
  const now = Date.now();
  const pts = samples.filter((s) => now - s.t <= windowSec * 1000);
  if (pts.length < 2) return `<svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><text x="${W / 2}" y="${H / 2}" text-anchor="middle" class="ct-lab">Wachten op hartslag…</text></svg>`;
  const vals = pts.map((p) => p.bpm);
  const lo = Math.max(30, Math.min(...vals) - 8), hi = Math.max(...vals) + 8;
  const x = (t) => W - ((now - t) / (windowSec * 1000)) * W;
  const y = (v) => pt + (H - pt - pb) * (1 - (v - lo) / (hi - lo));
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.bpm).toFixed(1)}`).join('');
  const last = pts[pts.length - 1];
  let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">`;
  for (const f of [0.6, 0.7, 0.8, 0.9]) { const v = maxHr * f; if (v > lo && v < hi) s += `<line x1="0" x2="${W}" y1="${y(v)}" y2="${y(v)}" class="gridline dashed"/>`; }
  s += `<path d="${d}L${x(last.t)},${H - pb}L${x(pts[0].t)},${H - pb}Z" fill="var(--hr)" opacity=".12"/>`;
  s += `<path d="${d}" fill="none" stroke="var(--hr)" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>`;
  s += `<circle cx="${x(last.t)}" cy="${y(last.bpm)}" r="4.5" fill="var(--hr)" class="pulse-dot"/>`;
  for (const sec of [windowSec, windowSec / 2, 0]) s += `<text x="${Math.max(16, Math.min(W - 16, W - (sec / windowSec) * W))}" y="${H - 4}" text-anchor="middle" class="ct-lab">${sec ? `-${sec >= 60 ? Math.round(sec / 60) + ' min' : sec + ' s'}` : 'nu'}</text>`;
  s += `<text x="2" y="${pt + 8}" class="ct-tiny">${Math.round(hi)}</text><text x="2" y="${H - pb - 3}" class="ct-tiny">${Math.round(lo)}</text>`;
  return s + '</svg>';
}

export { num };

/**
 * Belastingsband (acuut 7 d vs chronisch 28 d), zoals een "duurzaam bereik".
 * pts: [{date, daily, acute, lo, hi}]
 */
export function loadBand(pts, { height = 170, fmt = (v) => Math.round(v) } = {}) {
  const W = 340, H = height, pt = 14, pb = 22;
  const vals = pts.flatMap((p) => [p.daily, p.acute, p.hi]).filter((v) => v != null);
  if (!vals.length) return `<div class="empty-chart">Nog te weinig data</div>`;
  const hi = Math.max(...vals) * 1.08;
  const n = pts.length;
  const x = (i) => (W * (i + 0.5)) / n;
  const y = (v) => pt + (H - pt - pb) * (1 - v / hi);
  const bw = Math.max(2, (W / n) * 0.55);
  let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">`;
  // Band
  const top = pts.map((p, i) => (p.hi != null ? `${x(i).toFixed(1)},${y(p.hi).toFixed(1)}` : null)).filter(Boolean);
  const bot = pts.map((p, i) => (p.lo != null ? `${x(i).toFixed(1)},${y(p.lo).toFixed(1)}` : null)).filter(Boolean).reverse();
  if (top.length > 1) s += `<polygon points="${top.join(' ')} ${bot.join(' ')}" class="band-fill"/>`;
  pts.forEach((p, i) => { if (p.daily) s += `<rect x="${x(i) - bw / 2}" y="${y(p.daily)}" width="${bw}" height="${H - pb - y(p.daily)}" rx="${Math.min(3, bw / 2)}" class="band-bar"/>`; });
  const d = pts.map((p, i) => (p.acute != null ? `${i && pts[i - 1].acute != null ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.acute).toFixed(1)}` : '')).join('');
  s += `<path d="${d}" fill="none" class="band-line" vector-effect="non-scaling-stroke"/>`;
  const last = pts[n - 1];
  if (last.acute != null) s += `<circle cx="${x(n - 1)}" cy="${y(last.acute)}" r="4.5" class="band-dot"/>`;
  const every = Math.ceil(n / 6);
  pts.forEach((p, i) => { if ((n - 1 - i) % every === 0) s += `<text x="${Math.min(W - 14, Math.max(14, x(i)))}" y="${H - 6}" text-anchor="middle" class="ct-lab">${esc(fmtDateShort(p.date))}</text>`; });
  s += '</svg>';
  const id = register({
    W, H,
    at(xv) {
      const i = Math.max(0, Math.min(n - 1, Math.floor((xv / W) * n)));
      const p = pts[i];
      return { x: x(i), y: p.acute != null ? y(p.acute) : H - pb, title: `${fmtDateShort(p.date)} · dag ${fmt(p.daily || 0)}`, value: p.acute != null ? `week-gem. ${fmt(p.acute)} · normaal ${fmt(p.lo)}–${fmt(p.hi)}` : 'geen data', color: 'var(--strain)', go: `#/strain/${p.date}` };
    },
  });
  return wrap(id, s);
}

/** Horizontale waterval: jaren winst (links, groen) / verlies (rechts, rood). rows: [{label, years, lo, hi, sheet}] */
export function waterfall(rows) {
  const max = Math.max(1.5, ...rows.map((r) => Math.abs(r.hi ?? r.years ?? 0)), ...rows.map((r) => Math.abs(r.lo ?? 0)));
  const pct = (v) => 50 + (v / max) * 50;
  return `<div class="wf">${rows.map((r) => {
    if (r.years == null) return `<button class="wf-row" data-sheet="${r.sheet}"><span class="wf-l">${esc(r.label)}</span><span class="wf-track"><span class="wf-mid"></span></span><span class="wf-v muted">geen data</span></button>`;
    const a = pct(Math.min(0, r.years)), b = pct(Math.max(0, r.years));
    const good = r.years < 0;
    return `<button class="wf-row" data-sheet="${r.sheet}"><span class="wf-l">${esc(r.label)}</span><span class="wf-track"><span class="wf-mid"></span>
      <span class="wf-bar ${good ? 'good' : 'bad'}" style="left:${a}%;width:${Math.max(0.8, b - a)}%"></span>
      ${r.lo != null ? `<span class="wf-err" style="left:${pct(r.lo)}%;width:${Math.max(0, pct(r.hi) - pct(r.lo))}%"></span>` : ''}</span>
      <span class="wf-v ${good ? 'up' : r.years > 0.05 ? 'down' : 'muted'}">${r.years > 0 ? '+' : r.years < 0 ? '−' : ''}${Math.abs(r.years).toFixed(1).replace('.', ',')} j</span></button>`;
  }).join('')}<div class="wf-axis"><span>jonger</span><span>ouder</span></div></div>`;
}

/** Horizontale schaal (bijv. tempo −1×…3×). */
export function scale(value, { min = -1, max = 3, ticks = [-1, 0, 1, 2, 3], fmt = (v) => `${v}×`, mark = 1 } = {}) {
  const p = (v) => ((v - min) / (max - min)) * 100;
  return `<div class="scale"><div class="scale-track"><span class="scale-grad"></span><span class="scale-mark" style="left:${p(mark)}%"></span><span class="scale-knob" style="left:${p(Math.max(min, Math.min(max, value)))}%"></span></div>
    <div class="scale-ticks">${ticks.map((t) => `<span style="left:${p(t)}%">${fmt(t)}</span>`).join('')}</div></div>`;
}

/** Klokminuten (18:00 = 1080 … 14:00 = 2280) zodat nachten doorlopen over middernacht. */
export function clockMin(ms) { const d = new Date(ms); let m = d.getHours() * 60 + d.getMinutes(); if (m < 720) m += 1440; return m; }
const clk = (m) => { const v = ((Math.round(m) % 1440) + 1440) % 1440; return `${String(Math.floor(v / 60)).padStart(2, '0')}:${String(v % 60).padStart(2, '0')}`; };

/**
 * Slaapschema: per nacht een balk van bedtijd tot opstaan (tijd loopt naar beneden, zoals Apple Gezondheid).
 * nights: [{date, start, end, go, color}] (start/end in ms; null = geen slaap)
 */
export function sleepRange(nights, { height = 190, labelEvery = 1, target = null } = {}) {
  const W = 340, H = height, pt = 10, pb = 22, pl = 34;
  const n = nights.length || 1;
  const have = nights.filter((x) => x.start && x.end);
  if (!have.length) return `<div class="empty-chart">Nog geen slaapdata</div>`;
  const ss = have.map((x) => clockMin(x.start)), ee = have.map((x) => clockMin(x.end));
  let lo = Math.floor((Math.min(...ss, target ? target[0] : Infinity) - 30) / 60) * 60;
  let hi = Math.ceil((Math.max(...ee, target ? target[1] : -Infinity) + 30) / 60) * 60;
  if (hi - lo < 360) hi = lo + 360;
  const step = (W - pl) / n;
  const bw = Math.max(3, Math.min(16, step * 0.56));
  const y = (m) => pt + (H - pt - pb) * ((m - lo) / (hi - lo));
  let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">`;
  const hStep = hi - lo > 720 ? 240 : 120;
  for (let m = Math.ceil(lo / hStep) * hStep; m <= hi; m += hStep) {
    s += `<line x1="${pl}" x2="${W}" y1="${y(m)}" y2="${y(m)}" class="gridline dashed"/><text x="2" y="${y(m) + 3.5}" class="ct-lab" text-anchor="start">${clk(m)}</text>`;
  }
  if (target) s += `<rect x="${pl}" y="${y(target[0])}" width="${W - pl}" height="${Math.max(1, y(target[1]) - y(target[0]))}" fill="var(--band)" rx="4"/>`;
  nights.forEach((nt, i) => {
    const cx = pl + step * (i + 0.5);
    if (nt.start && nt.end) {
      const a = y(clockMin(nt.start)), b = y(clockMin(nt.end));
      s += `<rect class="bar" data-i="${i}" x="${cx - bw / 2}" y="${a}" width="${bw}" height="${Math.max(2, b - a)}" rx="${Math.min(5, bw / 2)}" fill="${nt.color || 'var(--sleep)'}"/>`;
    }
    if (i % labelEvery === 0 || i === n - 1) s += `<text x="${cx}" y="${H - 6}" text-anchor="middle" class="ct-lab">${esc(dayLabel(nt.date, n))}</text>`;
  });
  s += '</svg>';
  const id = register({
    W, H,
    at(xv) {
      const i = Math.max(0, Math.min(n - 1, Math.floor((xv - pl) / step)));
      const nt = nights[i];
      const ok = nt.start && nt.end;
      return { x: pl + step * (i + 0.5), y: ok ? y(clockMin(nt.start)) : H - pb, title: dayLabel(nt.date, 30), value: ok ? `${clk(clockMin(nt.start))} – ${clk(clockMin(nt.end))}` : 'geen slaap', color: 'var(--sleep)', go: nt.go, i, bars: true };
    },
  });
  return wrap(id, s);
}

/**
 * Maandkalender als heatmap. cells: [{date, color, alpha, label, go}] voor elke dag van de maand.
 * Gewone HTML (tikbaar), geen SVG.
 */
export function calendar(year, month, cellFor, todayStr) {
  const first = new Date(year, month, 1);
  const lead = (first.getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  const pad2 = (v) => String(v).padStart(2, '0');
  let h = '<div class="cal">';
  for (const w of ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo']) h += `<div class="cal-wd">${w}</div>`;
  for (let i = 0; i < lead; i++) h += '<div class="cal-c empty"></div>';
  for (let d = 1; d <= days; d++) {
    const date = `${year}-${pad2(month + 1)}-${pad2(d)}`;
    const c = date > todayStr ? null : cellFor(date);
    const style = c?.color ? `style="--cc:${c.color};--ca:${Math.round((c.alpha ?? 1) * 100)}%"` : '';
    h += `<button class="cal-c${c?.color ? ' on' : ''}${c?.color && (c.alpha ?? 1) < 0.5 ? ' lite' : ''}${date === todayStr ? ' today' : ''}${date > todayStr ? ' future' : ''}" ${style} ${c && date <= todayStr ? `data-go="#/today/${date}"` : 'disabled'}><span>${d}</span>${c?.label != null ? `<small>${esc(c.label)}</small>` : ''}</button>`;
  }
  return h + '</div>';
}
