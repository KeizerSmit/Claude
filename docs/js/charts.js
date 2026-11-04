// Lichtgewicht SVG-grafieken (geen externe libraries).
import { esc, fmtTime, weekdayShort, fmtDateShort } from './util.js';

/** Ring met waarde. frac 0..1. */
export function ring({ frac = 0, color = 'var(--accent)', size = 120, stroke = 11, label = '', sub = '', track = 'var(--track)', target = null }) {
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
    ${f > 0.002 ? `<circle class="ring-val" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round"
      stroke-dasharray="${c * f} ${c}" transform="rotate(-90 ${size / 2} ${size / 2})" style="--c:${c};--f:${c * f}"/>` : ''}
    ${targetArc}
    <text x="50%" y="${sub ? '49%' : '54%'}" text-anchor="middle" dominant-baseline="middle" class="ring-label" style="font-size:${size * 0.25}px">${esc(label)}</text>
    ${sub ? `<text x="50%" y="70%" text-anchor="middle" class="ring-sub" style="font-size:${size * 0.095}px">${esc(sub)}</text>` : ''}
  </svg>`;
}

/**
 * Staafdiagram per dag. items: [{date, value, color}]
 */
export function bars(items, { height = 140, max = null, fmt = (v) => v, showValues = true, band = null, labelEvery = 1 } = {}) {
  const W = 340, H = height, pt = 18, pb = 22;
  const n = items.length || 1;
  const vmax = max ?? Math.max(1, ...items.map((i) => i.value || 0)) * 1.1;
  const bw = (W / n) * 0.62;
  const y = (v) => pt + (H - pt - pb) * (1 - v / vmax);
  let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">`;
  if (band) s += `<rect x="0" y="${y(band[1])}" width="${W}" height="${y(band[0]) - y(band[1])}" fill="var(--band)"/>`;
  items.forEach((it, i) => {
    const cx = (W / n) * (i + 0.5);
    if (it.value != null) {
      const top = y(it.value);
      s += `<rect x="${cx - bw / 2}" y="${top}" width="${bw}" height="${Math.max(0, H - pb - top)}" rx="${Math.min(4, bw / 2)}" fill="${it.color || 'var(--accent)'}"/>`;
      if (showValues && n <= 14) s += `<text x="${cx}" y="${top - 5}" text-anchor="middle" class="ct-val">${esc(fmt(it.value))}</text>`;
    }
    if (i % labelEvery === 0 || i === n - 1) s += `<text x="${cx}" y="${H - 6}" text-anchor="middle" class="ct-lab">${esc(it.label ?? (n <= 7 ? weekdayShort(it.date) : fmtDateShort(it.date).split(' ')[0]))}</text>`;
  });
  return s + '</svg>';
}

/** Lijn met optionele baseline-band. points: [{date, value}] */
export function line(points, { height = 140, color = 'var(--accent)', band = null, fmt = (v) => v, min = null, max = null, labelEvery = null, dots = true } = {}) {
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
  if (band) s += `<rect x="0" y="${y(band[1])}" width="${W}" height="${Math.max(1, y(band[0]) - y(band[1]))}" fill="var(--band)"/>`;
  let d = '';
  let pen = false;
  points.forEach((p, i) => {
    if (p.value == null) { pen = false; return; }
    d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`;
    pen = true;
  });
  // Vlak onder de lijn.
  const firstI = points.findIndex((p) => p.value != null);
  let lastI = -1; points.forEach((p, i) => { if (p.value != null) lastI = i; });
  const gid = 'g' + Math.random().toString(36).slice(2, 7);
  s += `<defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".28"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>`;
  if (firstI >= 0 && !points.slice(firstI, lastI + 1).some((p) => p.value == null)) s += `<path d="${d}L${x(lastI)},${H - pb}L${x(firstI)},${H - pb}Z" fill="url(#${gid})"/>`;
  s += `<path d="${d}" fill="none" stroke="${color}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>`;
  const every = labelEvery || Math.ceil(n / 7);
  points.forEach((p, i) => {
    if (p.value != null && dots && n <= 31) s += `<circle cx="${x(i)}" cy="${y(p.value)}" r="${n <= 14 ? 3 : 2}" fill="${p.color || color}"/>`;
    if ((n - 1 - i) % every === 0) s += `<text x="${x(i)}" y="${H - 6}" text-anchor="middle" class="ct-lab">${esc(n <= 7 ? weekdayShort(p.date) : fmtDateShort(p.date))}</text>`;
  });
  if (vals.length) {
    const last = points[lastI];
    s += `<text x="${Math.min(x(lastI), W - 16)}" y="${y(last.value) - 8}" text-anchor="middle" class="ct-val">${esc(fmt(last.value))}</text>`;
  }
  return s + '</svg>';
}

/** Hartslag door de dag met zones, slaap en activiteiten. */
export function hrDay(day, { maxHr = 190, height = 170, activities = [] } = {}) {
  if (!day?.hr?.length) return `<div class="empty-chart">Geen hartslagdata voor deze dag</div>`;
  const W = 340, H = height, pt = 12, pb = 20;
  const n = 1440;
  const vals = day.hr.filter(Boolean);
  const lo = Math.max(30, Math.min(...vals) - 5);
  const hi = Math.max(...vals, lo + 40) + 5;
  const x = (i) => (W * i) / n;
  const y = (v) => pt + (H - pt - pb) * (1 - (v - lo) / (hi - lo));
  let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">`;
  const shade = (a, b, cls) => {
    const i0 = Math.max(0, (a - day.hrStart) / 60000), i1 = Math.min(n, (b - day.hrStart) / 60000);
    if (i1 > i0) s += `<rect x="${x(i0)}" y="${pt}" width="${x(i1) - x(i0)}" height="${H - pt - pb}" class="${cls}"/>`;
  };
  if (day.sleep) shade(day.sleep.start, day.sleep.end, 'sh-sleep');
  if (day.sleepNext) shade(day.sleepNext.start, day.sleepNext.end, 'sh-sleep');
  for (const a of activities) shade(a.start, a.end, 'sh-act');
  // Zonelijnen
  for (const f of [0.6, 0.7, 0.8, 0.9]) {
    const v = maxHr * f;
    if (v > lo && v < hi) s += `<line x1="0" x2="${W}" y1="${y(v)}" y2="${y(v)}" class="gridline"/><text x="${W - 2}" y="${y(v) - 2}" text-anchor="end" class="ct-tiny">${Math.round(f * 100)}%</text>`;
  }
  // Segmenten gekleurd per zone
  let d = '';
  let pen = false;
  for (let i = 0; i < day.hr.length; i++) {
    const v = day.hr[i];
    if (!v) { pen = false; continue; }
    d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
    pen = true;
  }
  s += `<path d="${d}" fill="none" stroke="var(--hr)" stroke-width="1.2" vector-effect="non-scaling-stroke" stroke-linejoin="round"/>`;
  for (const h of [0, 6, 12, 18, 24]) s += `<text x="${Math.min(W - 8, Math.max(8, x(h * 60)))}" y="${H - 5}" text-anchor="middle" class="ct-lab">${String(h).padStart(2, '0')}:00</text>`;
  s += `<text x="2" y="${pt + 9}" class="ct-tiny">${Math.round(hi)}</text><text x="2" y="${H - pb - 3}" class="ct-tiny">${Math.round(lo)}</text>`;
  return s + '</svg>';
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
  for (const [type, a, b] of sleep.stages) {
    let ri = rows.indexOf(type);
    if (ri < 0) ri = rows.indexOf(sleep.classic ? 'asleep' : 'light');
    s += `<rect x="${x(Math.max(a, t0))}" y="${pt + rh * ri + 3}" width="${Math.max(0.8, x(Math.min(b, t1)) - x(Math.max(a, t0)))}" height="${rh - 6}" rx="2" fill="${colors[type] || colors.light}"/>`;
  }
  s += `<text x="${pl}" y="${H - 5}" class="ct-lab">${fmtTime(t0)}</text><text x="${W - 2}" y="${H - 5}" text-anchor="end" class="ct-lab">${fmtTime(t1)}</text>`;
  return s + '</svg>';
}

/** Gestapelde horizontale balk (bijv. slaapfasen of zones). parts: [{value,color,label}] */
export function stackBar(parts, { height = 10 } = {}) {
  const total = parts.reduce((a, p) => a + (p.value || 0), 0) || 1;
  return `<div class="stackbar" style="height:${height}px">${parts.map((p) => `<span style="flex:${(p.value || 0) / total};background:${p.color}" title="${esc(p.label || '')}"></span>`).join('')}</div>`;
}

/** Mini sparkline. */
export function spark(values, { color = 'var(--accent)', w = 80, h = 28 } = {}) {
  const v = values.filter((x) => x != null);
  if (v.length < 2) return '';
  const lo = Math.min(...v), hi = Math.max(...v);
  const pts = values.map((val, i) => (val == null ? null : [(w * i) / (values.length - 1), h - 3 - (h - 6) * ((val - lo) / (hi - lo || 1))])).filter(Boolean);
  return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" class="spark"><polyline points="${pts.map((p) => p.join(',')).join(' ')}" fill="none" stroke="${color}" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
}
