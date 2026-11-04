// Gebaren en iOS-achtige UI-onderdelen: grafiek-scrubben, sheets, pull-to-refresh,
// vegen tussen dagen en de inklappende titelbalk.
import { getChart } from './charts.js';
import { esc } from './util.js';

// ---------------------------------------------------------------- grafieken

let active = null;
let hideTimer = null;

function show(wrap, model, clientX) {
  const rect = wrap.getBoundingClientRect();
  const xv = ((clientX - rect.left) / rect.width) * model.W;
  const p = model.at(Math.max(0, Math.min(model.W, xv)));
  if (!p) return null;
  const px = (p.x / model.W) * 100;
  const py = (p.y / model.H) * 100;
  const rule = wrap.querySelector('.ch-rule');
  const dot = wrap.querySelector('.ch-dot');
  const tip = wrap.querySelector('.ch-tip');
  rule.style.left = `${px}%`;
  dot.style.left = `${px}%`;
  dot.style.top = `${py}%`;
  dot.style.background = p.color || 'var(--accent)';
  tip.innerHTML = `<b>${esc(p.value)}</b><span>${esc(p.title)}</span>${p.go ? '<i>tik om te openen ›</i>' : ''}`;
  const tw = tip.offsetWidth || 120;
  const left = Math.max(0, Math.min(rect.width - tw, (px / 100) * rect.width - tw / 2));
  tip.style.left = `${left}px`;
  wrap.classList.add('scrub');
  wrap.querySelectorAll('.bar').forEach((b) => b.classList.toggle('dim', p.bars && +b.dataset.i !== p.i));
  return p;
}

function hide(wrap) {
  wrap.classList.remove('scrub');
  wrap.querySelectorAll('.bar.dim').forEach((b) => b.classList.remove('dim'));
}

document.addEventListener('pointerdown', (ev) => {
  const wrap = ev.target.closest('.chartwrap');
  if (!wrap) return;
  const model = getChart(wrap.dataset.chart);
  if (!model) return;
  clearTimeout(hideTimer);
  document.querySelectorAll('.chartwrap.scrub').forEach((w) => w !== wrap && hide(w));
  active = { wrap, model, x0: ev.clientX, y0: ev.clientY, moved: false, p: show(wrap, model, ev.clientX) };
});

document.addEventListener('pointermove', (ev) => {
  if (!active) return;
  if (Math.abs(ev.clientX - active.x0) > 6) active.moved = true;
  active.p = show(active.wrap, active.model, ev.clientX);
});

function endScrub(ev, cancel) {
  if (!active) return;
  const { wrap, moved, p } = active;
  active = null;
  if (!cancel && !moved && p?.go) {
    ev.preventDefault();
    hide(wrap);
    location.hash = p.go;
    return;
  }
  hideTimer = setTimeout(() => hide(wrap), cancel ? 0 : 1800);
}
document.addEventListener('pointerup', (ev) => endScrub(ev, false));
document.addEventListener('pointercancel', (ev) => endScrub(ev, true));

// ---------------------------------------------------------------- sheets

let sheetEl = null;

export function openSheet(html, { onClose } = {}) {
  closeSheet(true);
  const back = document.createElement('div');
  back.className = 'sheet-back';
  const sh = document.createElement('div');
  sh.className = 'sheet';
  sh.innerHTML = `<div class="grabber"></div><button class="sheet-x" aria-label="Sluiten">✕</button><div class="sheet-body">${html}</div>`;
  document.body.append(back, sh);
  document.body.classList.add('sheet-open');
  requestAnimationFrame(() => { back.classList.add('in'); sh.classList.add('in'); });
  sheetEl = { back, sh, onClose };
  back.addEventListener('click', () => closeSheet());
  sh.querySelector('.sheet-x').addEventListener('click', () => closeSheet());
  // Omlaag slepen om te sluiten.
  let y0 = null, dy = 0;
  sh.addEventListener('touchstart', (e) => { if (sh.scrollTop <= 0 && !e.target.closest('.chartwrap')) { y0 = e.touches[0].clientY; dy = 0; } }, { passive: true });
  sh.addEventListener('touchmove', (e) => {
    if (y0 == null) return;
    dy = e.touches[0].clientY - y0;
    if (dy > 0) { sh.style.transition = 'none'; sh.style.transform = `translateY(${dy}px)`; }
  }, { passive: true });
  sh.addEventListener('touchend', () => {
    if (y0 == null) return;
    sh.style.transition = '';
    if (dy > 110) closeSheet(); else sh.style.transform = '';
    y0 = null;
  });
  return sh.querySelector('.sheet-body');
}

export function closeSheet(instant = false) {
  if (!sheetEl) return;
  const { back, sh, onClose } = sheetEl;
  sheetEl = null;
  document.body.classList.remove('sheet-open');
  if (instant) { back.remove(); sh.remove(); } else {
    back.classList.remove('in'); sh.classList.remove('in'); sh.style.transform = '';
    setTimeout(() => { back.remove(); sh.remove(); }, 320);
  }
  onClose?.();
}

export function sheetBody() { return sheetEl?.sh.querySelector('.sheet-body') || null; }
export function isSheetOpen() { return !!sheetEl; }

window.addEventListener('hashchange', () => closeSheet());
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSheet(); });

// ---------------------------------------------------------------- pull-to-refresh

let ptr = null;
export function enablePullToRefresh(onRefresh) {
  let y0 = null, dy = 0;
  const ind = document.createElement('div');
  ind.className = 'ptr';
  ind.innerHTML = '<div class="ptr-spin"></div>';
  document.body.appendChild(ind);
  ptr = { ind };
  document.addEventListener('touchstart', (e) => {
    if (window.scrollY > 0 || document.body.classList.contains('sheet-open') || e.target.closest('.chartwrap,input,textarea,select')) { y0 = null; return; }
    if (!document.querySelector('[data-ptr]')) { y0 = null; return; }
    y0 = e.touches[0].clientY; dy = 0;
  }, { passive: true });
  document.addEventListener('touchmove', (e) => {
    if (y0 == null) return;
    dy = Math.max(0, e.touches[0].clientY - y0);
    const d = Math.min(90, dy * 0.5);
    ind.style.transform = `translate(-50%, ${d}px) rotate(${dy * 2}deg)`;
    ind.style.opacity = Math.min(1, dy / 80);
    ind.classList.toggle('ready', dy > 120);
  }, { passive: true });
  document.addEventListener('touchend', () => {
    if (y0 == null) return;
    const go = dy > 120;
    y0 = null;
    ind.style.transform = '';
    ind.style.opacity = '';
    ind.classList.remove('ready');
    if (go) onRefresh();
  });
}

// ---------------------------------------------------------------- vegen tussen dagen

export function enableSwipe(onSwipe) {
  let s = null;
  document.addEventListener('touchstart', (e) => {
    const area = e.target.closest('[data-swipe]');
    if (!area || e.target.closest('.chartwrap,input,textarea,.weekstrip') || document.body.classList.contains('sheet-open')) { s = null; return; }
    s = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now(), area };
  }, { passive: true });
  document.addEventListener('touchend', (e) => {
    if (!s) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - s.x, dy = t.clientY - s.y;
    if (Math.abs(dx) > 70 && Math.abs(dy) < 50 && Date.now() - s.t < 600) onSwipe(dx < 0 ? 1 : -1, s.area);
    s = null;
  });
}

// ---------------------------------------------------------------- inklappende titel

export function enableCollapsingTitle() {
  const bar = document.createElement('div');
  bar.className = 'topbar';
  document.body.appendChild(bar);
  const update = () => {
    const lt = document.querySelector('.large-title h1');
    if (!lt || document.querySelector('.navbar')) { bar.classList.remove('show'); return; }
    bar.textContent = lt.textContent;
    bar.classList.toggle('show', window.scrollY > 46);
  };
  window.addEventListener('scroll', update, { passive: true });
  return update;
}
