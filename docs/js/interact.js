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
  sh.className = 'sheet glass-sheet';
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
    // Vanaf de linkerrand is het 'terugvegen', niet 'vorige dag'.
    if (e.touches[0].clientX < 24 && document.querySelector('.navbar [data-back]')) { s = null; return; }
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
  bar.className = 'topbar glass-bar';
  document.body.appendChild(bar);
  const update = () => {
    document.body.classList.toggle('scrolled', window.scrollY > 8);
    const lt = document.querySelector('.large-title h1');
    if (!lt || document.querySelector('.navbar')) { bar.classList.remove('show'); return; }
    bar.textContent = lt.textContent;
    bar.classList.toggle('show', window.scrollY > 46);
  };
  window.addEventListener('scroll', update, { passive: true });
  return update;
}

// ---------------------------------------------------------------- haptics (iOS 18+: via een verborgen schakelaar)

let hapticLabel = null;
/** Kort tikje voelbaar maken. Werkt op iPhone (iOS 18+) alleen tijdens een tik/aanraking van de gebruiker. */
export function haptic() {
  try {
    if (navigator.vibrate && !/iPhone|iPad/.test(navigator.userAgent)) { navigator.vibrate(8); return; }
    if (!hapticLabel) {
      hapticLabel = document.createElement('label');
      hapticLabel.setAttribute('aria-hidden', 'true');
      hapticLabel.style.cssText = 'position:fixed;left:-200px;top:-200px;width:1px;height:1px;opacity:0;pointer-events:none';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.setAttribute('switch', '');
      input.tabIndex = -1;
      hapticLabel.appendChild(input);
      hapticLabel.addEventListener('click', (e) => e.stopPropagation());
      document.body.appendChild(hapticLabel);
    }
    hapticLabel.click();
  } catch { /* geen haptics */ }
}

// ---------------------------------------------------------------- terugvegen vanaf de linkerrand

/** iOS-gebaar: veeg vanaf de linkerrand naar rechts om terug te gaan (alleen op schermen met een terugknop). */
export function enableEdgeBack() {
  let g = null;
  const page = () => document.querySelector('#app .page');
  document.addEventListener('touchstart', (e) => {
    const t = e.touches[0];
    const back = document.querySelector('.navbar [data-back]');
    if (!back || t.clientX > 24 || document.body.classList.contains('sheet-open') || e.touches.length > 1) { g = null; return; }
    g = { x0: t.clientX, y0: t.clientY, t0: Date.now(), dx: 0, active: false, target: back.dataset.back, armed: false };
    window.__edgeBack = true;
  }, { passive: true });
  document.addEventListener('touchmove', (e) => {
    if (!g) return;
    const t = e.touches[0];
    const dx = t.clientX - g.x0, dy = t.clientY - g.y0;
    if (!g.active) {
      if (Math.abs(dy) > 12 && Math.abs(dy) > dx) { g = null; window.__edgeBack = false; return; }
      if (dx < 10) return;
      g.active = true;
      document.body.classList.add('edge-back');
      const p = page(); if (p) p.style.transition = 'none';
    }
    g.dx = Math.max(0, dx);
    const p = page();
    if (p) p.style.transform = `translateX(${g.dx}px)`;
    document.body.style.setProperty('--edge', String(Math.min(1, g.dx / window.innerWidth)));
    const armed = g.dx > window.innerWidth * 0.35;
    if (armed !== g.armed) { g.armed = armed; if (armed) haptic(); }
  }, { passive: true });
  const end = () => {
    if (!g) return;
    const st = g; g = null;
    setTimeout(() => { window.__edgeBack = false; }, 50);
    if (!st.active) return;
    const p = page();
    const v = st.dx / Math.max(1, Date.now() - st.t0);
    const go = st.dx > window.innerWidth * 0.35 || (v > 0.6 && st.dx > 40);
    if (p) { p.style.transition = 'transform .28s cubic-bezier(.2,.8,.2,1)'; p.style.transform = go ? `translateX(${window.innerWidth}px)` : 'translateX(0)'; }
    setTimeout(() => {
      document.body.classList.remove('edge-back');
      document.body.style.removeProperty('--edge');
      if (go) {
        document.body.classList.add('no-page-anim');
        location.hash = st.target;
        setTimeout(() => document.body.classList.remove('no-page-anim'), 400);
      } else if (p) { p.style.transition = ''; p.style.transform = ''; }
    }, 280);
  };
  document.addEventListener('touchend', end);
  document.addEventListener('touchcancel', end);
}

// ---------------------------------------------------------------- lang drukken: contextmenu

let menuEl = null;
export function closeMenu() {
  if (!menuEl) return;
  const m = menuEl; menuEl = null;
  m.classList.remove('in');
  setTimeout(() => m.remove(), 220);
}

/**
 * Lang drukken (±0,45 s) op een element waarvoor getItems(el) een lijst teruggeeft
 * → iOS-contextmenu: wazige achtergrond, het item 'opgetild', menu eronder.
 * items: [{ label, icon, danger, run }]
 */
export function enableLongPress(selector, getItems) {
  let lp = null;
  let suppress = 0;
  document.addEventListener('touchstart', (e) => {
    const el = e.target.closest(selector);
    if (!el || e.touches.length > 1 || document.body.classList.contains('sheet-open')) { lp = null; return; }
    const t = e.touches[0];
    lp = { el, x: t.clientX, y: t.clientY, timer: setTimeout(() => {
      if (!lp || window.__edgeBack) return;
      const items = getItems(lp.el);
      if (!items?.length) return;
      suppress = Date.now();
      haptic();
      showMenu(lp.el, items);
      lp = null;
    }, 450) };
    el.classList.add('lp-press');
  }, { passive: true });
  const cancel = () => { if (lp) { clearTimeout(lp.timer); lp.el.classList.remove('lp-press'); lp = null; } };
  document.addEventListener('touchmove', (e) => { if (lp && (Math.abs(e.touches[0].clientX - lp.x) > 8 || Math.abs(e.touches[0].clientY - lp.y) > 8)) cancel(); }, { passive: true });
  document.addEventListener('touchend', cancel);
  document.addEventListener('touchcancel', cancel);
  // De tik die bij het loslaten volgt mag niet alsnog de rij openen.
  document.addEventListener('click', (e) => { if (Date.now() - suppress < 700 && !e.target.closest('.ctx-menu')) { e.stopPropagation(); e.preventDefault(); } }, true);
  document.addEventListener('contextmenu', (e) => { if (e.target.closest(selector)) e.preventDefault(); });
}

function showMenu(el, items) {
  closeMenu();
  el.classList.remove('lp-press');
  const r = el.getBoundingClientRect();
  const wrap = document.createElement('div');
  wrap.className = 'ctx-wrap';
  const lift = el.cloneNode(true);
  lift.classList.add('ctx-lift');
  lift.removeAttribute('data-go'); lift.removeAttribute('data-sheet');
  lift.style.cssText = `left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px`;
  const menu = document.createElement('div');
  menu.className = 'ctx-menu glass-sheet';
  menu.innerHTML = items.map((it, i) => `<button class="ctx-item${it.danger ? ' danger' : ''}" data-i="${i}"><span>${esc(it.label)}</span>${it.icon || ''}</button>`).join('');
  wrap.append(lift, menu);
  document.body.appendChild(wrap);
  const mh = items.length * 46 + 10;
  const below = r.bottom + 10 + mh < window.innerHeight - 20;
  menu.style.top = `${below ? r.bottom + 10 : Math.max(60, r.top - 10 - mh)}px`;
  menu.style.left = `${Math.max(12, Math.min(window.innerWidth - 262, r.left))}px`;
  menu.style.transformOrigin = below ? 'top left' : 'bottom left';
  requestAnimationFrame(() => wrap.classList.add('in'));
  menuEl = wrap;
  wrap.addEventListener('click', (e) => {
    const b = e.target.closest('.ctx-item');
    e.stopPropagation();
    closeMenu();
    if (b) setTimeout(() => items[+b.dataset.i].run(), 120);
  });
}
