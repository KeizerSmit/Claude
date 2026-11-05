import * as store from './store.js';
import * as auth from './auth.js';
import { syncAll, syncHeartNow, syncMinute } from './sync.js';
import { driveLoad, driveSave, AuthError, tokenInfo, probe } from './api.js';
import { computeAll, insights, recoveryColor, recoveryZone, strainLabel, bedtimeAdvice, lastDays, ZONES, strainFromTrimp, trimpForStrain, trimpPerMinute } from './metrics.js';
import { e1rm, parseNotes, allExercises, exerciseHistory, newSession, mergeDocs, exKey, matchExercise, LIBRARY, GROUPS, UPPER, LOWER, templateBaselines, activeTemplates, findTemplate, currentSet, setText } from './strength.js';
import { ring, bars, line, hrDay, hypnogram, stackBar, spark, liveLine, resetCharts, loadBand, waterfall, scale, sleepRange, calendar, clockMin, sleepSpan, clk } from './charts.js';
import { openSheet, closeSheet, isSheetOpen, enablePullToRefresh, enableSwipe, enableCollapsingTitle } from './interact.js';
import { live as liveState, onLive, connect as liveConnect, disconnect as liveDisconnect, current as liveCurrent, liveRmssd, sessionStats as liveSession, bluetoothSupported } from './live.js';
import { generateDemo } from './demo.js';
import { I, INSIGHT_ICON, AI } from './icons.js';
import { TYPES, CATS, typeById, INTENSITY, RPE_LABELS, newActivity, estimateActivity, SOURCE_LABEL } from './activities.js';
import { computeHealthspan, healthspanHistory, INPUTS, vo2Ref } from './healthspan.js';
import { muscleFatigue, bodyMap, fatigueColor, fatigueLabel } from './bodymap.js';
import { buildShare } from './share.js';
import { recommendTraining, progressionTip } from './coach.js';
import { recoveryPatterns, recoveryForecastModel } from './patterns.js';
import { today, addDays, fmtDayTitle, fmtDateLong, fmtDateShort, fmtTime, fmtDur, fmtHM, num, esc, clamp, mean, uid, ymd, pad, parseYmd, debounce, weekdayShort, sd, cap, daysBetween, median } from './util.js';

const DEFAULTS = { sleepNeed: 450, defaultSets: 2, bodyweight: 80, maxHr: null, age: null, sex: 'm', theme: 'auto', wake: '07:00', palette: 'standard', badge: false, goals: { strength: 3, sleep: 420, mvpa: 150, steps: 8000 } };
const APP_VERSION = 'v36';
const CHANGELOG = [
  ['Signaal overbelasting', 'Ligt je HRV meerdere dagen op rij onder je normaal (zeker bij hoge belasting), dan waarschuwt Vandaag en adviseert lichte dagen.'],
  ['Ochtendrapport', 'Bij de eerste keer openen in de ochtend: je herstel in één zin uitgelegd, je nacht, wat gisteren deed en je plan voor vandaag.'],
  ['Verwachting morgen', 'Vanaf 17:00 op Vandaag (en altijd op het slaapscherm): je verwachte herstel van morgen bij verschillende bedtijden, geleerd uit je eigen data.'],
  ['Weekdoelen', 'Vier doelen per week (kracht, beweging, slaap, stappen) met reeksen: hoeveel weken op rij je ze haalt. Tik om je doelen aan te passen.'],
  ['Strain-coach', 'Het plan op Vandaag zegt hoeveel minuten wandelen of zone 2 je nog nodig hebt voor je strain-doel.'],
  ['Slimmer notities plakken', 'Plak je bijgewerkte notitie: de app laat per schema zien wat er verbeterd is (bijv. 87 → 89,5 kg) en logt het meteen als training van vandaag.'],
  ['Samenvatting na je training', 'Na het opslaan: je records, hoeveel oefeningen beter gingen dan vorige keer en je spierbelasting.'],
  ['Vergelijk met vorige keer', 'In een training zie je per oefening je vorige topset en of je vooruit ging, en hoeveel zwaarder de hele training was dan de vorige keer.'],
  ['Rusttimer', 'Vink je tijdens een training een oefening af, dan loopt er een rusttimer met een piepje als je weer kunt. Tik voor +30 s; instellen in Profiel.'],
  ['Hartslag per training', 'In een training zie je je hartslag tijdens de sessie en hoeveel minuten je in elke zone zat.'],
  ['Volume per spiergroep', 'Op Training: hoeveel zware sets elke spier deze week kreeg, naast de richtlijn van 10–20 sets.'],
  ['Voortgang per oefening', 'Per oefening: winst sinds je begon, tempo in kg per maand en wat je de volgende keer probeert.'],
  ['Krachtindex', 'Op Training: één getal voor je krachtvooruitgang over al je oefeningen samen, per week.'],
  ['Slaapschuld', 'Het slaapscherm toont je netto tekort over 7 nachten, met een plan om het in te halen, en je slaapschema met adviestijden.'],
  ['Draagtijd', 'Onder Alle data zie je hoeveel van de dag je Fitbit hartslag mat en waar de gaten zitten. Droeg je hem weinig, dan waarschuwt Vandaag dat je strain te laag kan zijn.'],
  ['—'],
  ['Weekoverzicht', 'Elke week in één scherm: gemiddeld herstel, strain, slaap en je PR\'s, vergeleken met de week ervoor. Op maandag staat hij op Vandaag.'],
  ['Records', 'Je persoonlijke records: hoogste herstel en HRV, langste slaap, en je beste topset per oefening.'],
  ['Kalender', 'Trends heeft nu een maandkalender met herstel, strain, slaap of trainingen per dag.'],
  ['Slaapschema', 'Zie hoe regelmatig je naar bed gaat en opstaat.'],
  ['Normaalband', 'HRV, rusthartslag en ademhaling tonen je persoonlijke normale bereik.'],
  ['Ziek- en rustdagen', 'Markeer een dag via ＋. Zieke dagen tellen niet mee in je baseline en de coach schakelt naar rust.'],
  ['Herstel op je app-icoon', 'Zet in Profiel aan dat je herstel als badge op het Pulse-icoon staat.'],
  ['Kleurenblind-palet', 'In Profiel → Weergave: blauw/geel/oranje in plaats van groen/geel/rood.'],
  ['Persoonlijke RPE-ijking', 'Als je activiteiten met hartslag logt, leert de app hoe jouw “hoe zwaar voelde het” zich verhoudt tot je hartslag.'],
];

const S = {
  settings: { ...DEFAULTS },
  strength: { sessions: [], exerciseMap: {}, updatedAt: 0 },
  days: [],
  profile: null,
  computed: null,
  syncing: false,
  progress: null,
  syncError: null,
  importDraft: null,
  editDraft: null,
};

const app = document.getElementById('app');

// ---------------------------------------------------------------- data

async function loadAll() {
  await store.init();
  S.settings = { ...DEFAULTS, ...((await store.kv.get('settings')) || {}) };
  S.strength = (await store.kv.get('strength')) || { sessions: [], exerciseMap: {}, updatedAt: 0 };
  S.strength.templates ||= [];
  S.strength.activities ||= [];
  S.strength.weights ||= [];
  S.profile = (await store.kv.get('profile')) || null;
  S.days = await store.days.all();
  if (store.isDemo() && !S.days.length) {
    const demo = generateDemo(60);
    await store.days.putMany(demo.days);
    await store.kv.set('strength', demo.strength);
    await store.kv.set('profile', { age: 29 });
    await store.kv.set('lastSyncAt', Date.now());
    S.days = demo.days;
    S.strength = demo.strength;
    S.profile = { age: 29 };
  }
  applyTheme();
  recompute();
}

function recompute() {
  S.computed = computeAll(S.days.map((d) => ({ ...d })), S.strength, S.settings, S.profile);
  updateBadge();
}

/** Herstel als badge op het app-icoon (iOS 16.4+ thuisscherm-app, met meldingstoestemming). */
function updateBadge() {
  try {
    if (!('setAppBadge' in navigator)) return;
    if (!S.settings.badge) return;
    const r = S.computed?.byDate?.[today()]?.recovery?.score;
    if (r) navigator.setAppBadge(r).catch(() => {});
  } catch { /* niet ondersteund */ }
}

function whatsNewSheet() {
  openSheet(`<div class="sh-head"><div class="eyebrow">Pulse ${APP_VERSION}</div><h2>Wat is nieuw</h2></div>
    ${(() => {
      const cut = CHANGELOG.findIndex((x) => x[0] === '—');
      const item = ([t, d]) => `<div class="row"><div class="grow"><div class="title">${esc(t)}</div><div class="sub" style="white-space:normal">${esc(d)}</div></div></div>`;
      const fresh = cut >= 0 ? CHANGELOG.slice(0, cut) : CHANGELOG, older = cut >= 0 ? CHANGELOG.slice(cut + 1) : [];
      return `<div class="list mt">${fresh.map(item).join('')}</div>${older.length ? `<details class="wn-old"><summary>Eerdere update (${older.length})</summary><div class="list">${older.map(item).join('')}</div></details>` : ''}`;
    })()}
    <button class="btn mt" data-act="close-sheet">Oké</button>`, { onClose: () => setTimeout(maybeMorning, 450) });
}

async function saveSettings(patch) {
  S.settings = { ...S.settings, ...patch };
  await store.kv.set('settings', S.settings);
  applyTheme();
  recompute();
}

async function saveStrength(mutator) {
  mutator(S.strength);
  S.strength.updatedAt = Date.now();
  await store.kv.set('strength', S.strength);
  await store.kv.set('strengthDirty', true);
  recompute();
  pushStrengthSoon();
}

const pushStrengthSoon = debounce(() => { syncStrength().catch(() => {}); }, 1500);

async function syncStrength() {
  if (store.isDemo() || !auth.getToken('drive')) return;
  const remote = await driveLoad();
  const merged = mergeDocs(S.strength, remote);
  const sig = (d) => JSON.stringify(['sessions', 'templates', 'activities', 'weights', 'flags'].flatMap((k) => (d?.[k] || []).map((s) => [k, s.id, s.updatedAt])).sort());
  const changedLocal = sig(merged) !== sig(S.strength);
  S.strength = merged;
  await store.kv.set('strength', merged);
  const dirty = await store.kv.get('strengthDirty');
  if (dirty || !remote || sig(remote) !== sig(merged)) {
    await driveSave(merged);
    await store.kv.set('strengthDirty', false);
  }
  if (changedLocal) { recompute(); render(); }
}

function applyTheme() {
  const t = S.settings.theme;
  if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
  else delete document.documentElement.dataset.theme;
  if (S.settings.palette === 'cb') document.documentElement.dataset.palette = 'cb';
  else delete document.documentElement.dataset.palette;
}

// ---------------------------------------------------------------- sync

async function runSync({ full = false, interactive = true, quiet = false, todayOnly = false } = {}) {
  if (S.syncing) return;
  if (store.isDemo()) { if (!quiet) toast('Demomodus: geen synchronisatie'); return; }
  if (!auth.getToken('health')) {
    if (!auth.getClientId()) { location.hash = '#/setup'; return; }
    if (interactive) auth.login({ silent: auth.hasEverLoggedIn() });
    return;
  }
  S.syncing = true; S.syncError = null;
  if (!quiet) { S.progress = { text: 'Verbinden…', frac: 0.01 }; render(); } else { S.tickState = 'busy'; updateLiveStamp(); }
  try {
    await syncAll({ full, todayOnly, onProgress: quiet ? () => {} : (text, frac) => { S.progress = { text, frac }; updateProgress(); } });
    try { await syncStrength(); } catch (e) { console.warn('Drive', e); }
    S.days = await store.days.all();
    S.profile = (await store.kv.get('profile')) || null;
    recompute();
    const log = (await store.kv.get('syncLog'))?.log || [];
    const failed = log.filter((l) => !l.ok);
    if (!quiet) toast(failed.length ? `Gesynchroniseerd, ${failed.length} onderdeel mislukt` : 'Gesynchroniseerd');
  } catch (e) {
    if (e instanceof AuthError) {
      S.syncError = 'Je sessie is verlopen.';
      if (auth.canTrySilent('health')) { auth.login({ silent: true }); return; }
    } else S.syncError = e.message;
    if (!quiet) toast('Synchroniseren mislukt');
  } finally {
    S.syncing = false; S.progress = null; S.diag = null;
    if (S.tickState === 'busy') S.tickState = S.syncError ? 'error' : 'ok';
    S.lastSyncAt = await store.kv.get('lastSyncAt');
    S.syncLog = await store.kv.get('syncLog');
    softRender(!quiet);
  }
}

/** Snel openen: eerst vandaag (± 4 aanvragen), daarna de rest stil op de achtergrond. */
async function quickThenFull({ forceFull = false } = {}) {
  if (store.isDemo() || !auth.getToken('health')) return;
  if (S.days.length < 3) { await runSync({ interactive: false }); return; }
  await minuteTick({ quickOnly: true });
  const stale = !S.lastSyncAt || Date.now() - S.lastSyncAt > 15 * 60000;
  if (stale || forceFull) runSync({ quiet: true });
}

/** Opnieuw tekenen zonder de gebruiker te storen (niet tijdens scrubben, typen of een open sheet). */
function softRender(force = false) {
  if (force) { render(); return; }
  // Niet tijdens invullen (formulieren), een open sheet of het scrubben van een grafiek.
  if (['log', 'import', 'template-edit', 'setup', 'welcome'].includes(parseRoute().name)) { updateLiveStamp(); return; }
  if (isSheetOpen() || document.querySelector('.chartwrap.scrub')) { updateLiveStamp(); return; }
  const ae = document.activeElement;
  if (ae && /INPUT|TEXTAREA|SELECT/.test(ae.tagName)) return;
  const y = window.scrollY;
  render();
  window.scrollTo(0, y);
}

// ---------------------------------------------------------------- elke minuut verversen

let tick = 0;
let ticking = false;
async function minuteTick({ quickOnly = false } = {}) {
  if (document.visibilityState !== 'visible' || store.isDemo() || S.syncing || ticking) { softRender(); return; }
  if (!auth.getToken('health')) {
    // Sleutel verlopen (na ~1 uur): stil vernieuwen (kort Google-scherm, daarna terug).
    if (auth.hasEverLoggedIn() && auth.getClientId() && auth.canTrySilent('health') && !isSheetOpen() && !document.activeElement?.matches?.('input,textarea,select')) auth.login({ silent: true });
    softRender();
    return;
  }
  ticking = true;
  if (!quickOnly) tick++;
  S.tickState = 'busy';
  updateLiveStamp();
  try {
    if (!quickOnly && tick % 5 === 0) {
      // Elke 5 minuten: alles van vandaag (slaap, HRV, rusthartslag, …) + krachtlog uit Drive.
      await runSync({ quiet: true, todayOnly: true });
    } else {
      const day = await syncMinute();
      const i = S.days.findIndex((d) => d.date === day.date);
      if (i >= 0) S.days[i] = { ...S.days[i], ...day }; else S.days.push(day);
      recompute();
    }
    S.liveTickAt = Date.now();
    S.tickState = 'ok';
  } catch (e) {
    console.warn('minuut-sync', e);
    S.tickState = 'error';
    if (e instanceof AuthError && auth.canTrySilent('health') && !isSheetOpen()) { auth.login({ silent: true }); return; }
  } finally {
    ticking = false;
  }
  softRender();
}

/** Klein statuslabel 'Live · 14:32' bovenaan; los bij te werken zonder hele render. */
function liveStampHtml() {
  if (store.isDemo() || !auth.hasEverLoggedIn()) return '';
  const at = S.liveTickAt || S.lastSyncAt;
  const st = S.tickState === 'busy' ? 'busy' : S.tickState === 'error' ? 'err' : auth.getToken('health') ? 'ok' : 'idle';
  return `<span class="livestamp ${st}" data-livestamp><i></i>${st === 'busy' ? 'Bijwerken…' : st === 'err' ? 'Offline' : at ? `Bijgewerkt ${fmtTime(at)}` : 'Live'}</span>`;
}
function updateLiveStamp() { document.querySelectorAll('[data-livestamp]').forEach((el) => { el.outerHTML = liveStampHtml(); }); }

setInterval(() => { const d = S.editDraft; document.querySelectorAll('[data-elapsed]').forEach((el) => { if (d?.start) el.textContent = elapsedText(d.start); }); }, 15000);

// Precies op de minuutgrens, daarna elke 60 s.
setTimeout(() => { minuteTick(); setInterval(minuteTick, 60000); }, 60000 - (Date.now() % 60000) + 500);

// Realtime (Bluetooth): elke seconde alleen de live-onderdelen bijwerken.
let liveFrame = 0;
let liveMode = 'idle';
onLive(() => {
  const now = Date.now();
  if (liveState.state !== liveMode) {
    // Modus gewijzigd (verbonden/verbroken): hele pagina opnieuw opbouwen.
    liveMode = liveState.state;
    softRender();
    return;
  }
  if (now - liveFrame < 900) return;
  liveFrame = now;
  const bpm = liveCurrent();
  document.querySelectorAll('[data-live-bpm]').forEach((el) => { el.innerHTML = `${bpm ?? '–'}<small>bpm</small>`; });
  document.querySelectorAll('.heart.beat').forEach((el) => { if (bpm) el.style.setProperty('--beat', `${Math.max(0.3, 60 / bpm)}s`); });
  const chart = document.querySelector('[data-live-chart]');
  if (chart && liveState.state === 'live') chart.innerHTML = liveLine(liveState.samples, { maxHr: S.computed.maxHr });
  const sess = document.querySelector('[data-live-session]');
  if (sess) {
    const raw = S.days.find((d) => d.date === today());
    sess.innerHTML = liveSessionHtml(liveSession(S.computed.maxHr, raw?.rhr || 60, S.settings.sex === 'v'), liveRmssd());
  }
  const zone = document.querySelector('[data-live-zone]');
  if (zone && bpm) {
    const f = bpm / S.computed.maxHr;
    const z = f >= 0.9 ? 5 : f >= 0.8 ? 4 : f >= 0.7 ? 3 : f >= 0.6 ? 2 : f >= 0.5 ? 1 : 0;
    zone.style.background = z ? `var(--z${z})` : 'var(--card2)';
    zone.textContent = `${z ? `Zone ${z}` : 'Rust'} · ${Math.round(f * 100)}% van max`;
  }
  const age = document.querySelector('.live-sub[data-live-age]');
  if (age && liveState.state === 'live') age.innerHTML = `<span class="badge-live">LIVE</span> realtime via ${esc(liveState.deviceName || 'Bluetooth')}`;
});

function updateProgress() {
  const bar = document.querySelector('.syncbar span');
  const txt = document.querySelector('[data-sync-text]');
  if (bar && S.progress) bar.style.width = `${Math.round(S.progress.frac * 100)}%`;
  if (txt && S.progress) txt.textContent = S.progress.text;
}

// ---------------------------------------------------------------- ui helpers

let toastTimer;
function toast(msg) {
  let el = document.querySelector('.toast');
  if (!el) { el = document.createElement('div'); el.className = 'toast'; document.body.appendChild(el); }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2400);
}

function navbar(title, back = '#/today', right = '') {
  return `<div class="navbar"><button class="back glass" data-back="${esc(back)}" aria-label="Terug">${I.left}</button><div class="title">${esc(title)}</div><div class="right">${right}</div></div>`;
}

function largeTitle(title, eyebrow = '', right = '') {
  return `<div class="large-title"><div>${eyebrow || liveStampHtml() ? `<div class="eyebrow">${eyebrow ? esc(eyebrow) : ''}${eyebrow && liveStampHtml() ? ' · ' : ''}${liveStampHtml()}</div>` : ''}<h1>${esc(title)}</h1></div><div style="display:flex;gap:8px;align-items:center">${right}</div></div>`;
}

function stat(label, value, unit = '', delta = '', icon = '', go = '') {
  return `<div class="stat${go ? ' tap' : ''}" ${go ? `data-go="${go}"` : ''}><div class="l">${icon}${esc(label)}</div><div class="v">${value}${unit ? `<small>${unit}</small>` : ''}</div>${delta ? `<div class="d">${delta}</div>` : ''}</div>`;
}

function deltaText(v, base, unit = '', digits = 0, higherIsBetter = true) {
  if (v == null || base == null) return '';
  const d = v - base;
  if (Math.abs(d) < Math.pow(10, -digits) / 2) return 'gelijk aan baseline';
  const good = higherIsBetter ? d > 0 : d < 0;
  return `<span class="${good ? 'up' : 'down'}">${d > 0 ? '▲' : '▼'} ${num(Math.abs(d), digits)}${unit}</span> vs baseline`;
}

function syncHeader() {
  if (!S.syncing) return '';
  return `<div class="syncbar"><span style="width:${Math.round((S.progress?.frac || 0) * 100)}%"></span></div><div class="small muted center" data-sync-text style="margin:-4px 0 10px">${esc(S.progress?.text || '')}</div>`;
}

function avatar() {
  const u = auth.getUser();
  if (store.isDemo()) return `<button class="icon-btn glass" data-go="#/settings" aria-label="Instellingen">${I.person}</button>`;
  if (u?.picture) return `<img class="avatar" src="${esc(u.picture)}" alt="" data-go="#/settings" referrerpolicy="no-referrer">`;
  return `<button class="icon-btn glass" data-go="#/settings" aria-label="Instellingen">${I.person}</button>`;
}

function syncBtn() {
  return `<button class="icon-btn glass" data-act="sync" aria-label="Synchroniseren">${S.syncing ? I.sync.replace('<svg', '<svg class="spin"') : I.sync}</button>`;
}

const M = (date) => S.computed?.byDate?.[date] || null;

function dayNav(date, base) {
  const isToday = date >= today();
  return `<div class="daynav"><button data-go="${base}/${addDays(date, -1)}" aria-label="Vorige dag">${I.left}</button><span class="d">${esc(fmtDateLong(date))}</span><button data-go="${base}/${addDays(date, 1)}" ${isToday ? 'disabled' : ''} aria-label="Volgende dag">${I.right}</button></div>`;
}

const fmtStrain = (s) => (s == null ? '–' : (Math.round(s * 10) / 10).toFixed(1).replace('.', ','));
const pct = (v) => (v == null ? '–' : `${Math.round(v * 100)}%`);

// ---------------------------------------------------------------- views

function viewWelcome() {
  const hasClient = !!auth.getClientId();
  return `<div class="welcome fade-in">
    <img class="logo" src="icons/icon-192.png" alt="">
    <h1>Pulse</h1>
    <p>Herstel, belasting en slaap uit je Fitbit Air — met je krachttraining erbij.</p>
    ${hasClient ? `<button class="btn gbtn" data-act="login">${I.google} Inloggen met Google</button>` : `<button class="btn" data-go="#/setup">Instellen</button>`}
    <div style="height:10px"></div>
    <button class="btn secondary" data-act="demo-on">Bekijk met demodata</button>
    ${hasClient ? `<p class="small" style="margin-top:22px"><a href="#/setup">Instellingen koppeling</a></p>` : ''}
  </div>`;
}

const SETUP_STEPS = [
  { id: 'project', title: 'Maak een project', text: 'Naam: <b>Pulse</b> → <b>Create</b>.', links: [['Open Google Cloud', 'https://console.cloud.google.com/projectcreate']] },
  { id: 'apis', title: 'Zet de koppelingen aan', text: 'Kijk of bovenaan project <b>Pulse</b> staat → <b>Next</b> → <b>Enable</b>.', links: [['Aanzetten', 'https://console.cloud.google.com/flows/enableapi?apiid=health.googleapis.com,drive.googleapis.com']] },
  { id: 'brand', title: 'Inlogscherm', text: '<b>Get started</b> → naam <b>Pulse</b> + je e-mail → <b>External</b> → je e-mail → akkoord → <b>Create</b>.', links: [['Openen', 'https://console.cloud.google.com/auth/overview']] },
  { id: 'tester', title: 'Jezelf toelaten', text: 'Bij <b>Test users</b> → <b>Add users</b> → je eigen Gmail-adres → <b>Save</b>.', links: [['Openen', 'https://console.cloud.google.com/auth/audience']] },
  { id: 'scopes', title: 'Toestemmingen', text: 'Tik hieronder op <b>Kopieer</b> → op de pagina <b>Add or remove scopes</b> → onderaan bij <b>Manually add scopes</b> plakken → <b>Add to table</b> → <b>Update</b> → <b>Save</b>.', links: [['Openen', 'https://console.cloud.google.com/auth/scopes']], scopes: true },
  { id: 'client', title: 'Sleutel maken', text: 'Type <b>Web application</b>. Plak bij <i>JavaScript origins</i> en bij <i>Redirect URIs</i> de twee regels hieronder (kopieerknop) → <b>Create</b> → kopieer de <b>Client ID</b>.', links: [['Openen', 'https://console.cloud.google.com/auth/clients/create']], copy: true },
];

function setupDone() { try { return JSON.parse(localStorage.getItem('pulse.setupDone') || '[]'); } catch { return []; } }

function isIos() { return /iPhone|iPad|iPod/.test(navigator.userAgent); }
function isStandalone() { return navigator.standalone === true || matchMedia('(display-mode: standalone)').matches; }

function viewSetup() {
  const uri = auth.redirectUri();
  const done = setupDone();
  const needHome = isIos() && !isStandalone() && !auth.getClientId();
  const step = (s, i) => {
    const ok = done.includes(s.id);
    return `<div class="card setup-step${ok ? ' ok' : ''}">
      <div class="ss-head"><span class="ss-num">${ok ? I.check : i + 1}</span><b>${s.title}</b></div>
      <div class="small muted" style="margin:6px 0 10px">${s.text}</div>
      ${s.scopes ? `<div class="copyrow"><code>googlehealth.* (4) + drive.appdata</code><button class="btn small secondary" data-act="copy" data-v="${esc(auth.SCOPES.filter((x) => x.startsWith('https://')).join(','))}">Kopieer</button></div>` : ''}
      ${s.copy ? `<div class="copyrow"><code>${esc(location.origin)}</code><button class="btn small secondary" data-act="copy" data-v="${esc(location.origin)}">Kopieer</button></div>
      <div class="copyrow"><code>${esc(uri)}</code><button class="btn small secondary" data-act="copy" data-v="${esc(uri)}">Kopieer</button></div>` : ''}
      ${s.links.map(([l, href]) => `<a class="btn${ok ? ' secondary' : ''}" href="${href}" target="_blank" rel="noopener" data-step="${s.id}">${l} ↗</a>`).join('')}
    </div>`;
  };
  return `${navbar('Instellen', auth.getClientId() || store.isDemo() ? '#/settings' : '#/welcome')}
  <div class="content fade-in">
    ${needHome ? `<div class="card" style="border:1.5px solid var(--accent)"><b>Eerst: zet Pulse op je beginscherm</b>
      <div class="small muted" style="margin-top:6px">Tik onderin Safari op het deelknopje <b>⬆︎</b> → <b>Zet op beginscherm</b> → <b>Voeg toe</b>. Open daarna Pulse vanaf je beginscherm en doe daar de stappen hieronder.</div></div>` : ''}
    <p class="small muted" style="margin:0 2px 12px">Eenmalig, ±5 minuten. Elke knop opent de juiste Google-pagina; gebruik het Google-account van je Fitbit Air. Kom na elke stap terug naar deze app. Heb je de <b>Google Health</b>-app met dat account al eens geopend? Zo niet, doe dat eerst.</p>
    ${SETUP_STEPS.map(step).join('')}
    <div class="card setup-step">
      <div class="ss-head"><span class="ss-num">${SETUP_STEPS.length + 1}</span><b>Plak de Client ID en log in</b></div>
      <input class="field mt" id="clientId" placeholder="…apps.googleusercontent.com" value="${esc(auth.getClientId())}" autocomplete="off" autocapitalize="off" spellcheck="false" style="background:var(--card2)">
      <button class="btn small secondary mt" data-act="paste-client">Plakken</button>
      <button class="btn gbtn mt" data-act="save-client">${I.google} Inloggen met Google</button>
      <div class="tiny muted mt">Google zegt “app niet geverifieerd”: klopt, het is je eigen app → <b>Doorgaan</b> → alles aanvinken → <b>Doorgaan</b>.</div>
    </div>
  </div>`;
}

// ---------------------------------------------------------------- Vandaag

function weekStrip(date, base = '#/today') {
  const d = parseYmd(date);
  const mon = addDays(date, -((d.getDay() + 6) % 7));
  const days = Array.from({ length: 7 }, (_, i) => addDays(mon, i));
  const t = today();
  const next = addDays(date, 7) > t ? t : addDays(date, 7);
  return `<div class="weekstrip">
    <button class="ws-nav" data-go="${base}/${addDays(date, -7)}" aria-label="Vorige week">${I.left}</button>
    ${days.map((x) => {
      const rec = M(x)?.recovery?.score;
      const fut = x > t;
      return `<button class="ws-day${x === date ? ' on' : ''}${x === t ? ' is-today' : ''}" ${fut ? 'disabled' : ''} data-go="${base}/${x}"><span class="ws-w">${weekdayShort(x)}</span><span class="ws-n">${parseYmd(x).getDate()}</span><span class="ws-dot" style="background:${rec != null ? recoveryColor(rec) : 'transparent'}"></span></button>`;
    }).join('')}
    <button class="ws-nav" data-go="${base}/${next}" ${date >= t ? 'disabled' : ''} aria-label="Volgende week">${I.right}</button>
  </div>`;
}

const INSIGHT_GO = { info: 'recovery', bolt: 'recovery', gauge: 'recovery', bed: 'recovery', up: 'recovery', down: 'recovery', heart: 'recovery', temp: 'recovery', moon: 'sleep', target: 'strain' };

/** Laatste hartslag: Bluetooth (realtime) of laatste gesynchroniseerde minuut. */
function latestHr() {
  const bpm = liveCurrent();
  if (bpm) return { bpm, at: Date.now(), source: 'ble' };
  const day = S.days.find((d) => d.date === today());
  if (!day?.hr?.length) return null;
  let i = day.hr.length - 1;
  while (i >= 0 && !day.hr[i]) i--;
  if (i < 0) return null;
  return { bpm: day.hr[i], at: day.hrStart + i * 60000, source: 'sync', day, idx: i };
}

function ageText(ms) {
  const s = Math.max(0, (Date.now() - ms) / 1000);
  if (s < 90) return 'zojuist';
  if (s < 3600) return `${Math.round(s / 60)} min geleden`;
  return `${Math.floor(s / 3600)} u ${Math.round((s % 3600) / 60)} min geleden`;
}

function heartIcon(bpm, size = 22) {
  const dur = bpm ? Math.max(0.3, 60 / bpm) : 1;
  return `<span class="heart${bpm ? ' beat' : ''}" style="--beat:${dur}s;width:${size}px;height:${size}px"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.4l-1.4-1.3C5.4 15.4 2 12.3 2 8.5 2 5.4 4.4 3 7.5 3c1.7 0 3.4.8 4.5 2.1C13.1 3.8 14.8 3 16.5 3 19.6 3 22 5.4 22 8.5c0 3.8-3.4 6.9-8.6 11.6L12 21.4z"/></svg></span>`;
}

function liveTile() {
  const h = latestHr();
  const isLive = h?.source === 'ble';
  const fresh = h && Date.now() - h.at < 6 * 60000;
  let sp = '';
  if (isLive) sp = spark(liveState.samples.slice(-120).map((s) => s.bpm), { color: 'var(--hr)', w: 120, h: 34, fill: true });
  else if (h?.day) sp = spark(h.day.hr.slice(Math.max(0, h.idx - 120), h.idx + 1).map((v) => v || null), { color: 'var(--hr)', w: 120, h: 34, fill: true });
  return `<button class="tile wide hrtile" data-go="#/live">
    <div class="tile-l">${heartIcon(isLive || fresh ? h?.bpm : null, 18)} Hartslag ${isLive ? '<span class="badge-live">LIVE</span>' : ''}</div>
    <div class="hr-row"><div class="tile-v" data-live-bpm>${h ? h.bpm : '–'}<small>bpm</small></div><div class="hr-spark">${sp}</div></div>
    <div class="tile-d" data-live-age>${h ? (isLive ? `realtime via ${esc(liveState.deviceName || 'Bluetooth')}` : ageText(h.at)) : 'Nog geen meting vandaag'}</div>
  </button>`;
}

// Gezondheidsstatistieken: definities + uitleg.
const METRICS = {
  hrv: { label: 'HRV', unit: 'ms', digits: 0, color: 'var(--green)', higher: true, get: (m) => m?.recovery?.hrv ?? m?.raw?.hrv ?? null, base: (m) => m?.recovery?.baseline?.hrv,
    about: 'Hartslagvariabiliteit (RMSSD) gemeten tijdens je slaap: de variatie in tijd tussen hartslagen. Een hogere HRV dan normaal betekent dat je zenuwstelsel ontspannen en hersteld is.',
    why: 'De belangrijkste factor in je herstelscore (50%). Vergelijk vooral met je eigen baseline, niet met anderen.' },
  rhr: { label: 'Rusthartslag', unit: 'bpm', digits: 0, color: 'var(--hr)', higher: false, get: (m) => m?.recovery?.rhr ?? m?.raw?.rhr ?? null, base: (m) => m?.recovery?.baseline?.rhr,
    about: 'Je hartslag in rust tijdens de non-REM-slaap. Lager is meestal beter: je hart hoeft minder hard te werken.',
    why: 'Een paar slagen hoger dan normaal kan wijzen op vermoeidheid, alcohol, stress of een beginnende verkoudheid.' },
  resp: { label: 'Ademhaling', unit: '/min', digits: 1, color: 'var(--z1)', higher: false, get: (m) => m?.raw?.resp ?? null, base: (m) => m?.recovery?.baseline?.resp,
    about: 'Gemiddeld aantal ademhalingen per minuut tijdens je slaap. Dit is bij de meeste mensen erg stabiel.',
    why: 'Een plotselinge stijging (≥1 per minuut) is vaak een vroeg teken van ziekte.' },
  spo2: { label: 'Zuurstof', unit: '%', digits: 1, color: 'var(--accent)', higher: true, get: (m) => m?.raw?.spo2 ?? null,
    about: 'Gemiddelde zuurstofverzadiging van je bloed tijdens de slaap (SpO₂). Normaal ligt dit tussen 95 en 100%.',
    why: 'Langdurig lagere waarden kunnen wijzen op ademhalingsonderbrekingen of hoogte.' },
  temp: { label: 'Huidtemp.', unit: '°C', digits: 1, signed: true, color: 'var(--muscle)', higher: null, get: (m) => m?.raw?.tempDev ?? null, base: () => 0,
    about: 'Afwijking van je huidtemperatuur tijdens de slaap ten opzichte van je eigen baseline.',
    why: 'Meer dan +0,5 °C kan wijzen op ziekte, een zware dag of (bij vrouwen) de cyclus.' },
  steps: { label: 'Stappen', unit: '', digits: 0, color: 'var(--muscle)', higher: true, get: (m) => m?.raw?.steps ?? null,
    about: 'Totaal aantal stappen op deze dag.', why: 'Dagelijkse beweging buiten je trainingen telt mee in je strain.' },
};

function metricBase(key, date) {
  const def = METRICS[key];
  const m = M(date);
  const b = def.base ? def.base(m) : null;
  if (b != null) return b;
  const vals = lastDays(S.computed.byDate, addDays(date, -1), 30).map((d) => def.get(d)).filter((v) => v != null);
  return vals.length >= 3 ? mean(vals) : null;
}

function fmtMetric(key, v) {
  const def = METRICS[key];
  if (v == null) return '–';
  return `${def.signed && v >= 0 ? '+' : ''}${num(v, def.digits)}`;
}

function metricTile(key, date) {
  const def = METRICS[key];
  const m = M(date);
  const v = def.get(m);
  const base = metricBase(key, date);
  const week = lastDays(S.computed.byDate, date, 7).map((d) => def.get(d));
  let chip = '';
  if (v != null && base != null && def.higher !== undefined) {
    const d = v - base;
    const small = Math.abs(d) < Math.pow(10, -def.digits) * (def.digits ? 3 : 1);
    const good = def.higher == null ? Math.abs(d) < 0.5 : def.higher ? d > 0 : d < 0;
    chip = small ? '<span class="chip-d">normaal</span>' : `<span class="chip-d ${good ? 'good' : 'bad'}">${d > 0 ? '▲' : '▼'} ${num(Math.abs(d), def.digits)}</span>`;
  }
  return `<button class="tile" data-sheet="metric:${key}:${date}">
    <div class="tile-l">${def.label}</div>
    <div class="tile-v">${fmtMetric(key, v)}${v != null && def.unit ? `<small>${def.unit}</small>` : ''}</div>
    <div class="tile-f">${chip}${spark(week, { color: def.color, w: 54, h: 20 })}</div>
  </button>`;
}

function viewToday(date) {
  const m = M(date);
  const t = date === today();
  const rec = m?.recovery;
  const strain = m?.strain;
  const sleep = m?.sleep;
  const raw = m?.raw || S.days.find((d) => d.date === date);
  const ins = insights(m);
  if (date === today()) {
    const top = patterns().list.find((x) => x.enough && x.strength === 'duidelijk');
    if (top) ins.splice(1, 0, { icon: top.diff > 0 ? 'up' : 'down', text: `Jouw patroon: na “${top.label.toLowerCase()}” is je herstel gemiddeld ${num(Math.abs(top.diff), 0)}% ${top.diff > 0 ? 'hoger' : 'lager'}.` });
  }
  const recColor = recoveryColor(rec?.score);
  const zoneTxt = { green: 'Goed hersteld', yellow: 'Redelijk hersteld', red: 'Rust nodig' }[recoveryZone(rec?.score)] || '';

  const zone = recoveryZone(rec?.score);
  const tgt = m?.target;
  const sc = strain?.score || 0;
  const rings = `<div class="hero2 card-lift">
    <button class="h2-rec" data-go="#/recovery/${date}">
      <div class="h2-k">Herstel${rec?.calibrating ? ' <span class="pill">kalibreren</span>' : ''}</div>
      <div class="h2-line"><div class="h2-big">${rec ? rec.score : '–'}<small>%</small></div><div class="h2-state" style="color:${recColor}">${rec ? `<span class="zshape z-${zone}"></span>${esc(zoneTxt)}` : 'Nog geen herstel'}</div></div>
      <div class="gauge"><span class="g-seg g-red"></span><span class="g-seg g-yellow"></span><span class="g-seg g-green"></span>${rec ? `<span class="g-knob" style="left:${rec.score}%"></span>` : ''}</div>
      <div class="g-ticks"><span>0</span><span>33</span><span>67</span><span>100</span></div>
    </button>
    <div class="h2-split">
      <button class="h2-cell" data-go="#/strain/${date}">
        <div class="h2-k">Belasting</div>
        <div class="h2-mid">${strain ? fmtStrain(sc) : '–'}</div>
        <div class="h2-sub">${tgt ? `doel ${fmtStrain(tgt[0])}–${fmtStrain(tgt[1])}` : 'van 21'}</div>
        <div class="mbar">${tgt ? `<span class="mbar-band" style="left:${(tgt[0] / 21) * 100}%;width:${((tgt[1] - tgt[0]) / 21) * 100}%"></span>` : ''}<span class="mbar-fill" style="width:${(sc / 21) * 100}%;background:var(--strain)"></span></div>
      </button>
      <button class="h2-cell" data-go="#/sleep/${date}">
        <div class="h2-k">Slaap</div>
        <div class="h2-mid">${sleep ? fmtHM(sleep.asleep) : '–'}</div>
        <div class="h2-sub">${sleep ? `van ${fmtHM(sleep.need)} nodig` : 'geen data'}</div>
        <div class="mbar"><span class="mbar-fill" style="width:${(sleep?.perf || 0) * 100}%;background:var(--sleep)"></span></div>
      </button>
    </div>
  </div>`;

  const sig = t ? strainSignal(date) : null;
  if (sig) ins.unshift({ icon: 'down', go: `recovery/${date}`, text: sig.text });
  const wr = t ? wearOf(date) : null;
  if (wr && wr.span > 240 && wr.pct < 0.65) ins.unshift({ icon: 'info', go: `day/${date}`, text: `Je droeg je Fitbit ${Math.round(wr.pct * 100)}% van de dag${wr.gap ? ` (gat ${clockTxt(wr.gap.start)}–${clockTxt(wr.gap.start + wr.gap.len)})` : ''}. Je strain is daardoor mogelijk te laag.` });
  const insightsCard = ins.length ? `<div class="list">${ins.filter((i) => i.icon !== 'target').slice(0, 3).map((i) => `<button class="row tap insight" data-go="#/${i.go || `${INSIGHT_GO[i.icon] || 'recovery'}/${date}`}"><div class="ic">${INSIGHT_ICON[i.icon] || I.info}</div><div class="grow"><p>${esc(i.text)}</p></div><span class="chev">${I.chev}</span></button>`).join('')}</div>` : '';

  const acts = m ? activityRows(m) : [];

  const empty = !raw && !strain?.sessions?.length && !strain?.manual?.length;
  return `${largeTitle(fmtDayTitle(date), t ? fmtDateLong(date) : `${fmtDateLong(date)}`, `${syncBtn()}${avatar()}`)}
  ${syncHeader()}
  ${S.syncError ? `<div class="card small" style="color:var(--red)">${esc(S.syncError)} <a href="#" data-act="relogin">Opnieuw inloggen</a></div>` : ''}
  ${t ? syncProblemCard() : ''}
  ${weekStrip(date)}
  <div data-swipe data-base="#/today" data-date="${date}">
  ${rings}
  ${empty ? `<div class="card center muted">${S.days.length ? 'Geen data voor deze dag.' : 'Nog geen data. Trek omlaag om te synchroniseren.'}</div>` : ''}
  ${t && rec && new Date().getHours() < 14 ? `<button class="wk-entry glass" data-act="morning" data-v="${date}"><span>${I.sun}</span><div><b>Ochtendrapport</b><small>${(() => { const v = recoveryVerdict(m); return esc(v.length > 80 ? `${v.slice(0, 79)}…` : v); })()}</small></div><span class="chev">${I.chev}</span></button>` : ''}
  ${t && parseYmd(date).getDay() === 1 ? `<button class="wk-entry glass" data-go="#/week/${addDays(date, -7)}"><span>${I.chart}</span><div><b>Je vorige week</b><small>Week ${isoWeek(addDays(date, -7))} in één oogopslag</small></div><span class="chev">${I.chev}</span></button>` : ''}
  ${m?.flag ? `<div class="card flag-card flag-${m.flag}"><div class="badge" style="background:${m.flag === 'sick' ? 'var(--red)' : 'var(--sleep)'}">${m.flag === 'sick' ? AI.health || I.heart : I.bed}</div><div class="grow"><div class="title">${m.flag === 'sick' ? 'Ziek-modus' : 'Rustdag'}</div><div class="sub">${m.flag === 'sick' ? 'Telt niet mee in je baseline · strain-doel max 6' : 'Strain-doel max 9 · herstel heeft voorrang'}</div></div><button class="btn small ghost" data-act="flag" data-v="${date}:">Uit</button></div>` : ''}
  ${coachCard(date)}
  ${t ? forecastCard(date) : ''}
  ${t ? goalsCard() : ''}
  ${insightsCard}
  <div class="section-title">Activiteiten <button data-act="plus-activity" data-v="${date}">+ Toevoegen</button></div>
  <div class="list">${acts.length ? acts.join('') : `<button class="row tap" data-act="plus-activity" data-v="${date}"><div class="badge" style="background:var(--card2);color:var(--muscle)">${I.plus}</div><div class="grow"><div class="title">Workout of klus toevoegen</div><div class="sub">Ook achteraf — telt mee in je belasting</div></div><span class="chev">${I.chev}</span></button>`}</div>
  <div class="section-title">Gezondheid <a href="#/day/${date}">Alle data</a></div>
  <div class="tiles">
    ${t ? liveTile() : ''}
    ${['hrv', 'rhr', 'resp', 'spo2', 'temp', 'steps'].map((k) => metricTile(k, date)).join('')}
  </div>
  <p class="center tiny muted mt">${S.liveTickAt || S.lastSyncAt ? `Ververst elke minuut · laatst ${esc(fmtTime(S.liveTickAt || S.lastSyncAt))}` : ''}</p>
  </div>`;
}

// ---------------------------------------------------------------- sheets

function metricSheet(key, date, range = 30) {
  const def = METRICS[key];
  const m = M(date);
  const v = def.get(m);
  const base = metricBase(key, date);
  const pts = lastDays(S.computed.byDate, date, range).map((d) => ({ date: d.date, value: def.get(d), go: `#/today/${d.date}` }));
  const vals = pts.map((p) => p.value).filter((x) => x != null);
  const sdv = vals.length > 2 ? Math.sqrt(vals.reduce((a, x) => a + (x - mean(vals)) ** 2, 0) / (vals.length - 1)) : null;
  const band = base != null && sdv ? [base - sdv, base + sdv] : null;
  let deltaLine = '';
  if (v != null && base != null) {
    const d = v - base;
    const good = def.higher == null ? Math.abs(d) < 0.5 : def.higher ? d >= 0 : d <= 0;
    deltaLine = `<div class="sh-delta ${good ? 'good' : 'bad'}">${d > 0 ? '▲' : d < 0 ? '▼' : '='} ${num(Math.abs(d), def.digits)} ${def.unit} t.o.v. je normaal (${fmtMetric(key, base)} ${def.unit})</div>`;
  }
  return `<div class="sh-head"><div class="eyebrow">${esc(fmtDateLong(date))}</div><h2>${def.label}</h2></div>
    <div class="sh-big" style="color:${def.color}">${fmtMetric(key, v)}<small>${def.unit}</small></div>
    ${deltaLine}
    <div class="segmented mt">${[7, 30, 90].map((r) => `<button class="${r === range ? 'on' : ''}" data-act="msheet" data-v="${key}:${date}:${r}">${r === 7 ? '7 dagen' : r === 30 ? '30 dagen' : '90 dagen'}</button>`).join('')}</div>
    <div class="card flat">${line(pts, { color: def.color, band, fmt: (x) => fmtMetric(key, x), unit: def.unit ? ` ${def.unit}` : '', dots: range <= 30 })}
      <div class="legend"><span><i style="background:var(--band)"></i>normale bandbreedte</span><span>tik op een dag om te openen</span></div></div>
    <div class="stats three">
      ${stat('Gemiddeld', fmtMetric(key, mean(vals)), def.unit)}
      ${stat('Laagste', vals.length ? fmtMetric(key, Math.min(...vals)) : '–', def.unit)}
      ${stat('Hoogste', vals.length ? fmtMetric(key, Math.max(...vals)) : '–', def.unit)}
    </div>
    <div class="card flat mt"><div class="small"><b>Wat is het?</b><br>${def.about}</div><div class="small mt"><b>Waarom het ertoe doet</b><br>${def.why}</div></div>`;
}

function activitySheet(date, id) {
  const m = M(date);
  const a = (m?.strain?.activities || []).find((x) => String(x.id) === String(id));
  if (!a) return '<div class="muted">Niet gevonden.</div>';
  const raw = m.raw;
  const from = Math.max(0, Math.floor((a.start - raw.hrStart) / 60000) - 10);
  const to = Math.min(1440, Math.ceil((a.end - raw.hrStart) / 60000) + 10);
  return `<div class="sh-head"><div class="eyebrow">${esc(fmtDateLong(date))} · ${fmtTime(a.start)}–${fmtTime(a.end)}</div><h2>${esc(a.name)}</h2></div>
    <div class="sh-big" style="color:var(--strain)">${fmtStrain(a.strain)}<small>strain</small></div>
    <div class="stats mt">
      ${stat('Duur', fmtDur(a.duration))}
      ${stat('Gem. hartslag', a.avgHr ? num(a.avgHr) : '–', 'bpm')}
      ${stat('Max. hartslag', a.maxHr ? num(a.maxHr) : '–', 'bpm')}
      ${stat('Calorieën', a.calories ? num(a.calories) : '–', 'kcal')}
    </div>
    <div class="card flat mt">${hrDay(raw, { maxHr: S.computed.maxHr, activities: [a], fromMin: from, toMin: to })}</div>
    <button class="btn secondary mt" data-act="fb-label" data-v="${date}:${esc(a.id)}">${AI.hammer} Was dit een klus of iets anders? Label het</button>`;
}

function openSheetFor(spec) {
  const [kind, ...rest] = spec.split(':');
  if (kind === 'metric') openSheet(metricSheet(rest[0], rest[1], Number(rest[2]) || 30));
  else if (kind === 'activity') openSheet(activitySheet(rest[0], rest.slice(1).join(':')));
  else if (kind === 'hs') openSheet(rest[0] === 'about' ? hsAboutSheet() : hsInputSheet(rest[0]));
  else if (kind === 'muscle') openSheet(muscleSheet(rest[0]));
  else if (kind === 'patterns') openSheet(patternsAboutSheet());
  else if (kind === 'volume') openSheet(volumeAboutSheet());
  else if (kind === 'goals') openSheet(goalsSheet());
  else if (kind === 'forecast') openSheet(forecastAboutSheet());
  else if (kind === 'manual') openActivityLog({ id: rest[0] });
}

// ---------------------------------------------------------------- Live

function viewLive() {
  const st = liveState;
  const h = latestHr();
  const ble = st.state === 'live' || st.state === 'lost';
  const max = S.computed.maxHr;
  const raw = S.days.find((d) => d.date === today());
  const rest = raw?.rhr || M(today())?.recovery?.baseline?.rhr || 60;
  const pctMax = h ? h.bpm / max : null;
  const zone = pctMax == null ? null : pctMax >= 0.9 ? 5 : pctMax >= 0.8 ? 4 : pctMax >= 0.7 ? 3 : pctMax >= 0.6 ? 2 : pctMax >= 0.5 ? 1 : 0;
  const vals = (raw?.hr || []).filter(Boolean);
  const nowMin = Math.floor((Date.now() - (raw?.hrStart || 0)) / 60000);
  const sess = ble ? liveSession(max, rest, S.settings.sex === 'v') : null;
  const rm = ble ? liveRmssd() : null;
  const supported = bluetoothSupported();
  return `${navbar('Hartslag', '#/today')}
  <div class="content">
    <div class="live-hero card-lift">
      ${heartIcon(h && (ble || Date.now() - h.at < 6 * 60000) ? h.bpm : null, 54)}
      <div class="live-bpm" data-live-bpm>${h ? h.bpm : '–'}<small>bpm</small></div>
      <div class="live-sub" data-live-age>${h ? (ble ? `<span class="badge-live">LIVE</span> realtime via ${esc(st.deviceName || 'Bluetooth')}` : `Laatste meting ${esc(ageText(h.at))}`) : 'Nog geen meting vandaag'}</div>
      ${zone != null ? `<div class="zone-pill" data-live-zone style="background:${zone ? `var(--z${zone})` : 'var(--card2)'}">${zone ? `Zone ${zone}` : 'Rust'} · ${Math.round(pctMax * 100)}% van max</div>` : ''}
    </div>
    <div class="card"><div class="card-head"><span class="t">${ble ? 'Laatste 5 minuten' : 'Laatste 3 uur'}</span><span class="small muted">${ble ? 'per hartslag' : 'per minuut'}</span></div>
      <div data-live-chart>${ble ? liveLine(st.samples, { maxHr: max }) : raw?.hr ? hrDay({ ...raw }, { maxHr: max, fromMin: Math.max(0, nowMin - 180), toMin: Math.max(60, nowMin + 2), live: true, height: 160 }) : '<div class="empty-chart">Nog geen hartslag vandaag</div>'}</div></div>
    <div class="stats three">
      ${stat('Rust', num(rest), 'bpm')}
      ${stat('Gem. vandaag', vals.length ? num(mean(vals)) : '–', 'bpm')}
      ${stat('Max. vandaag', vals.length ? num(Math.max(...vals)) : '–', 'bpm')}
    </div>
    ${ble ? `<div class="section-title">Deze sessie</div>
      <div class="card" data-live-session>${liveSessionHtml(sess, rm)}</div>` : ''}
    <div class="section-title">Realtime via Bluetooth</div>
    ${supported ? `<div class="card">
        <div class="small muted">Zet in de <b>Google Health-app</b> → <b>Verbindingen</b> → <b>Hartslag delen</b> aan, houd je Fitbit Air dichtbij en tik hieronder. Je ziet dan elke hartslag direct, plus je live HRV.</div>
        ${st.state === 'live' || st.state === 'lost' ? `<button class="btn danger mt" data-act="ble-off">Verbinding verbreken</button>` : `<button class="btn mt" data-act="ble-on" ${st.state === 'connecting' ? 'disabled' : ''}>${st.state === 'connecting' ? 'Verbinden…' : `${heartIcon(null, 18)} Verbind Fitbit Air`}</button>`}
        ${st.error ? `<div class="small mt" style="color:var(--red)">${esc(st.error)}</div>` : ''}
      </div>`
      : `<div class="card"><div class="small"><b>Safari ondersteunt geen Bluetooth.</b> Zonder Bluetooth ververst Pulse je hartslag elke minuut met wat de Google Health-app heeft gesynchroniseerd.</div>
        <div class="small muted mt">Voor <b>echte realtime</b> (elke hartslag): open Pulse op je iPhone in de gratis browser <b>Bluefy</b>, of in Chrome op Android/Mac. Zet daarnaast in de Google Health-app → Verbindingen → <b>Hartslag delen</b> aan.</div>
        <div class="btn-row mt"><a class="btn small" href="https://apps.apple.com/app/bluefy-web-ble-browser/id1492822055" target="_blank" rel="noopener">Bluefy ↗</a><button class="btn small secondary" data-act="copy" data-v="${esc(location.origin + location.pathname)}#/live">Kopieer link</button></div></div>`}
  </div>`;
}

function liveSessionHtml(sess, rm) {
  if (!sess) return '';
  const tot = sess.zones.reduce((a, b) => a + b, 0) || 1;
  return `<div class="stats three">
      ${stat('Duur', `${Math.floor(sess.durSec / 60)}:${pad(Math.floor(sess.durSec % 60))}`)}
      ${stat('Gemiddeld', sess.avg ? num(sess.avg) : '–', 'bpm')}
      ${stat('Live HRV', rm ? num(rm) : '–', 'ms')}
    </div>
    <div class="mt">${stackBar(ZONES.map((z, i) => ({ value: sess.zones[i], color: z.color })), { height: 10 })}</div>
    <div class="legend">${ZONES.map((z, i) => `<span><i style="background:${z.color}"></i>${z.id}: ${Math.floor(sess.zones[i] / 60)}:${pad(Math.floor(sess.zones[i] % 60))}</span>`).join('')}</div>
    <div class="small muted mt">Strain-bijdrage van deze sessie: <b style="color:var(--strain)">${fmtStrain(strainFromTrimp(sess.trimp))}</b> (max ${num(sess.max)} bpm)</div>`;
}

function syncProblemCard() {
  const log = S.syncLog;
  if (!log || store.isDemo()) return '';
  const failed = log.log.filter((l) => !l.ok);
  if (!failed.length) return '';
  const tok = auth.getToken();
  const granted = (tok?.scope || '').split(/\s+/);
  const missing = tok ? auth.HEALTH_SCOPES.filter((x) => !granted.includes(x)).map((x) => x.split('/').pop()) : [];
  const uniq = [];
  for (const f of failed) {
    const k = `${f.status || ''} ${f.error}`;
    const ex = uniq.find((u) => u.k === k);
    if (ex) ex.labels.push(f.label); else uniq.push({ k, labels: [f.label], f });
  }
  return `<div class="card" style="border:1.5px solid var(--red);overflow-wrap:anywhere">
    <div style="font-weight:700;color:var(--red)">Ophalen van ${failed.length} onderdelen mislukt</div>
    ${missing.length ? `<div class="small mt"><b>Niet toegestaan bij inloggen:</b> ${esc(missing.join(', '))}. Log opnieuw in en vink alles aan.</div>` : ''}
    ${uniq.slice(0, 3).map((u) => `<div class="small mt"><b>${esc(u.labels.join(', '))}</b><br>${esc(u.f.status ? u.f.status + ': ' : '')}${esc(u.f.error)}${u.f.detail ? `<div class="tiny muted mono" style="display:block;margin-top:4px;white-space:pre-wrap">${esc(u.f.detail.slice(0, 260))}</div>` : ''}</div>`).join('')}
    ${S.diag ? `<div class="small mt" style="background:var(--card2);border-radius:10px;padding:10px"><b>Diagnose</b><br>${S.diag}</div>` : ''}
    <div class="btn-row mt"><button class="btn small" data-act="sync">Opnieuw proberen</button><button class="btn small secondary" data-act="diagnose">Diagnose</button></div>
    <button class="btn small secondary mt" data-act="relogin" style="width:100%">Opnieuw inloggen (alle vinkjes aan)</button>
    <div class="tiny muted mt">Tik op Diagnose en maak een screenshot van dit kaartje voor Claude.</div>
  </div>`;
}

function fmtRel(ms) {
  const d = (Date.now() - ms) / 60000;
  if (d < 1) return 'zojuist';
  if (d < 60) return `${Math.round(d)} min geleden`;
  if (d < 1440) return `${Math.round(d / 60)} uur geleden`;
  return `${Math.round(d / 1440)} dagen geleden`;
}

function contribRow(label, value, z, weight, detail, sheet = '') {
  const w = clamp(Math.abs(z) / 3, 0, 1) * 50;
  const color = z >= 0 ? 'var(--green)' : 'var(--red)';
  const style = z >= 0 ? `left:50%;width:${w}%` : `left:${50 - w}%;width:${w}%`;
  const attr = !sheet ? '' : sheet.startsWith('#/') ? `data-go="${sheet}"` : `data-sheet="${sheet}"`;
  return `<div class="contrib${sheet ? ' tap' : ''}" ${attr}><div><div>${esc(label)}</div><div class="small muted">${detail}</div></div><div style="text-align:right;font-weight:600">${value}</div><div class="bar"><span style="${style};background:${color}"></span></div></div>`;
}

function viewRecovery(date) {
  const m = M(date);
  const r = m?.recovery;
  const days30 = lastDays(S.computed.byDate, date, 30);
  const color = recoveryColor(r?.score);
  const zone = recoveryZone(r?.score);
  const zoneText = { green: 'Je bent goed hersteld en klaar om te presteren.', yellow: 'Je lichaam is redelijk hersteld. Train, maar luister naar je lichaam.', red: 'Je lichaam heeft rust nodig. Neem het vandaag rustig.' }[zone] || 'Geen herstelgegevens voor deze dag.';
  const hrvPts = days30.map((d) => ({ date: d.date, go: `#/recovery/${d.date}`, value: d.recovery?.hrv ?? null }));
  const rhrPts = days30.map((d) => ({ date: d.date, go: `#/recovery/${d.date}`, value: d.recovery?.rhr ?? null }));
  const hrvBase = r?.baseline?.hrv;
  const contrib = r ? [
    contribRow('Hartslagvariabiliteit', `${num(r.hrv)} ms`, r.z.hrv, r.weights.hrv, `baseline ${num(hrvBase)} ms`, `metric:hrv:${date}`),
    contribRow('Rusthartslag (slaap)', `${num(r.rhr)} bpm`, r.z.rhr, r.weights.rhr, `baseline ${num(r.baseline.rhr)} bpm`, `metric:rhr:${date}`),
    contribRow('Slaapprestatie', pct(m.sleep?.perf), r.z.sleep, r.weights.sleep, m.sleep ? `${fmtHM(m.sleep.asleep)} van ${fmtHM(m.sleep.need)} nodig` : 'geen slaap', `#/sleep/${date}`),
    r.resp != null ? contribRow('Ademhaling', `${num(r.resp, 1)} /min`, r.z.resp, r.weights.resp, `baseline ${num(r.baseline.resp, 1)}`, `metric:resp:${date}`) : '',
    r.tempDev != null ? contribRow('Huidtemperatuur', `${r.tempDev >= 0 ? '+' : ''}${num(r.tempDev, 1)} °C`, r.z.temp, r.weights.temp, 't.o.v. je baseline', `metric:temp:${date}`) : '',
  ].join('') : '';
  return `${navbar('Herstel', `#/today/${date}`)}
  <div class="content" data-swipe data-base="#/recovery" data-date="${date}">
  ${weekStrip(date, '#/recovery')}
  <div class="card hero">${ring({ frac: (r?.score || 0) / 100, color, label: r ? `${r.score}%` : '–', sub: r?.calibrating ? 'kalibreren' : '', size: 190, stroke: 16 })}<div class="big">${esc(zoneText)}</div></div>
  ${r ? `<div class="card"><h2>Wat bepaalt je herstel</h2>${contrib}<p class="tiny muted" style="margin:8px 0 0">Balk naar rechts = beter dan je persoonlijke 30-daagse baseline. HRV weegt het zwaarst (50%), dan rusthartslag en slaap (20% elk).</p></div>` : ''}
  ${patternsCard()}
  <div class="section-title">Herstel · 30 dagen</div>
  <div class="card">${bars(days30.map((d) => ({ date: d.date, go: `#/recovery/${d.date}`, value: d.recovery?.score ?? null, color: recoveryColor(d.recovery?.score) })), { max: 100, labelEvery: 5, fmt: (v) => `${v}` })}
  <div class="legend"><span><i style="background:var(--green)"></i>67–100</span><span><i style="background:var(--yellow)"></i>34–66</span><span><i style="background:var(--red)"></i>0–33</span><span>gem. ${num(mean(days30.map((d) => d.recovery?.score)))}%</span></div></div>
  <div class="section-title">HRV · 30 dagen</div>
  <div class="card">${line(hrvPts, { color: 'var(--green)', band: hrvBase ? [hrvBase * 0.9, hrvBase * 1.1] : null, fmt: (v) => `${Math.round(v)} ms` })}<div class="legend"><span><i style="background:var(--band)"></i>baseline ±10%</span></div></div>
  <div class="section-title">Rusthartslag · 30 dagen</div>
  <div class="card">${line(rhrPts, { color: 'var(--hr)', fmt: (v) => `${Math.round(v)}` })}</div>
  </div>`;
}

function viewStrain(date) {
  const m = M(date);
  const st = m?.strain;
  const raw = m?.raw;
  const days7 = lastDays(S.computed.byDate, date, 7);
  const zoneTotal = (st?.zones || []).reduce((a, b) => a + b, 0);
  const acts = (st?.activities || []);
  const target = m?.target;
  return `${navbar('Strain', `#/today/${date}`)}
  <div class="content" data-swipe data-base="#/strain" data-date="${date}">
  ${weekStrip(date, '#/strain')}
  <div class="card hero">${ring({ frac: (st?.score || 0) / 21, color: 'var(--strain)', label: st ? fmtStrain(st.score) : '–', sub: strainLabel(st?.score), size: 190, stroke: 16, target: target ? [target[0] / 21, target[1] / 21] : null })}
    <div class="big">${target ? `Optimale strain op basis van je herstel: <b>${fmtStrain(target[0])} – ${fmtStrain(target[1])}</b>` : 'Strain loopt van 0 tot 21 (logaritmisch).'}</div></div>
  <div class="stats">
    ${stat('Cardio', fmtStrain(st?.cardio), '', `${num(st?.cardioTrimp)} belastingspunten${st?.estimated ? ' (geschat)' : ''}`)}
    ${stat('Spierbelasting', `+${num(st?.muscularTrimp)}`, '', st?.sessions?.length ? `${st.sessions.length} krachtsessie${st.sessions.length > 1 ? 's' : ''}` : 'geen krachtlog')}
  </div>
  <div class="section-title">Hartslag</div>
  <div class="card">${hrDay({ ...raw, sleepNext: raw?.sleepNext }, { maxHr: S.computed.maxHr, activities: acts })}
    <div class="legend"><span><i style="background:var(--sleep);opacity:.5"></i>slaap</span><span><i style="background:var(--strain);opacity:.5"></i>activiteit</span><span>max HR ${S.computed.maxHr}</span>${st?.peakHr ? `<span>piek vandaag ${st.peakHr}</span>` : ''}</div></div>
  <div class="section-title">Hartslagzones</div>
  <div class="card">${stackBar(ZONES.map((z, i) => ({ value: st?.zones?.[i] || 0, color: z.color })), { height: 12 })}
    <div class="kv mt">${ZONES.map((z, i) => `<div><span class="dot" style="background:${z.color}"></span>&nbsp; ${z.name} <span class="muted small">${Math.round(z.lo * 100)}–${z.hi > 1 ? 100 : Math.round(z.hi * 100)}%</span></div><div>${fmtDur(st?.zones?.[i] || 0)}${zoneTotal ? ` · ${Math.round(((st?.zones?.[i] || 0) / zoneTotal) * 100)}%` : ''}</div>`).join('')}</div></div>
  ${acts.length || st?.sessions?.length ? `<div class="section-title">Activiteiten</div><div class="list">
    ${(st?.sessions || []).map((s) => `<button class="row tap" data-go="#/session/${s.id}"><div class="badge" style="background:var(--muscle)">${I.dumbbell}</div><div class="grow"><div class="title">${esc(s.name || 'Krachttraining')}</div><div class="sub">spierbelasting ${num(s.load, 1)} → +${num(s.muscularTrimp)} punten${s.activity ? ` · cardio ${fmtStrain(s.activity.strain)}` : ''}</div></div><span class="chev">${I.chev}</span></button>`).join('')}
    ${acts.map((a) => `<button class="row tap" data-sheet="activity:${date}:${esc(a.id)}"><div class="badge" style="background:var(--strain)">${/run/i.test(a.type) ? I.run : I.flame}</div><div class="grow"><div class="title">${esc(a.name)}</div><div class="sub">${fmtTime(a.start)}–${fmtTime(a.end)} · ${fmtDur(a.duration)}${a.avgHr ? ` · gem. ${a.avgHr} bpm` : ''}${a.maxHr ? ` · max ${a.maxHr}` : ''}${a.calories ? ` · ${num(a.calories)} kcal` : ''}</div></div><div class="val"><b style="color:var(--strain)">${fmtStrain(a.strain)}</b></div><span class="chev">${I.chev}</span></button>`).join('')}
  </div>` : ''}
  <div class="section-title">Strain · 7 dagen</div>
  <div class="card">${bars(days7.map((d) => ({ date: d.date, go: `#/strain/${d.date}`, value: d.strain?.score ?? null, color: 'var(--strain)' })), { max: 21, fmt: fmtStrain })}</div>
  </div>`;
}

function viewSleep(date) {
  const m = M(date);
  const s = m?.sleep;
  const days14 = lastDays(S.computed.byDate, date, 14);
  const advice = date === today() ? bedtimeAdvice(m, toMin(S.settings.wake)) : null;
  const parts = s && !s.classic ? [
    { label: 'Wakker', value: s.awake, color: 'var(--st-awake)', norm: [0, 10], of: 'bed' },
    { label: 'Licht', value: s.light, color: 'var(--st-light)', norm: [45, 60] },
    { label: 'Diep (SWS)', value: s.deep, color: 'var(--st-deep)', norm: [13, 23] },
    { label: 'REM', value: s.rem, color: 'var(--st-rem)', norm: [20, 25] },
  ] : s ? [{ label: 'Wakker', value: s.awake, color: 'var(--st-awake)' }, { label: 'Slaap', value: s.asleep, color: 'var(--st-light)' }] : [];
  return `${navbar('Slaap', `#/today/${date}`)}
  <div class="content" data-swipe data-base="#/sleep" data-date="${date}">
  ${weekStrip(date, '#/sleep')}
  <div class="card hero">${ring({ frac: s?.perf || 0, color: 'var(--sleep)', label: s ? pct(s.perf) : '–', sub: 'prestatie', size: 190, stroke: 16 })}
    <div class="big">${s ? `${fmtHM(s.asleep)} geslapen van ${fmtHM(s.need)} nodig · ${fmtTime(s.start)} – ${fmtTime(s.end)}` : 'Geen slaap geregistreerd.'}</div></div>
  ${s ? `<div class="stats">
    ${stat('Uren in bed', fmtHM(s.inBed))}
    ${stat('Efficiëntie', pct(s.efficiency))}
    ${stat('Consistentie', s.consistency != null ? `${s.consistency}%` : '–', '', 'bed- en wektijden')}
    ${stat('Herstellend', pct(s.restorativePct), '', s.classic ? '' : `diep + REM ${fmtHM(s.restorative)}`)}
    ${stat('Inslapen', s.latency != null ? Math.round(s.latency) : '–', 'min')}
    ${stat('Onderbrekingen', num(s.awakenings))}
  </div>
  <div class="section-title">Slaapfasen</div>
  <div class="card">${hypnogram(s)}<div class="mt">${stackBar(parts, { height: 10 })}</div>
    <div class="kv mt">${parts.map((p) => `<div><span class="dot" style="background:${p.color}"></span>&nbsp; ${p.label}</div><div>${fmtDur(p.value)} · ${(() => { const den = p.of === 'bed' || !p.norm ? s.inBed : s.asleep; const v = den ? Math.round((p.value / den) * 100) : 0; if (!p.norm) return `${v}%`; const ok = v >= p.norm[0] && v <= p.norm[1]; return `<span class="${ok ? '' : v < p.norm[0] ? (p.of === 'bed' ? '' : 'lo') : (p.of === 'bed' ? 'lo' : '')}">${v}%</span> <small class="muted">${p.of === 'bed' ? `&lt;${p.norm[1]}` : `${p.norm[0]}–${p.norm[1]}`}%</small>`; })()}</div>`).join('')}</div>
    ${s.classic ? '' : '<p class="tiny muted" style="margin:8px 0 0">Kleine getallen: gangbaar bereik voor volwassenen (diep en REM als deel van je slaap, wakker als deel van je tijd in bed). Polsmeting van slaapfasen is een schatting.</p>'}</div>
  <div class="section-title">Slaapbehoefte</div>
  <div class="card"><div class="kv">
    <div>Basisbehoefte</div><div>${fmtDur(s.needParts.base)}</div>
    <div>Door strain van gisteren</div><div>+${fmtDur(s.needParts.strain)}</div>
    <div>Slaapschuld</div><div>+${fmtDur(s.needParts.debt)}</div>
    ${s.needParts.nap ? `<div>Dutjes</div><div>−${fmtDur(-s.needParts.nap)}</div>` : ''}
    <div><b>Totaal nodig</b></div><div><b>${fmtDur(s.need)}</b></div>
  </div></div>` : ''}
  ${advice ? `<div class="card"><div class="card-head"><span class="t">${I.bed} Vanavond</span></div>
    <div style="font-size:28px;font-weight:700">${fmtHM(advice.bed)}</div>
    <div class="small muted">Ga rond deze tijd naar bed om om ${esc(S.settings.wake)} op te staan met ${fmtHM(advice.need)} slaap (strain van vandaag meegerekend).</div></div>` : ''}
  ${forecastCard(date, { force: true })}
  ${sleepDebtCard(date)}
  ${(() => {
    const nights = days14.map((d) => ({ date: d.date, start: d.sleep?.start || null, end: d.sleep?.end || null, go: `#/sleep/${d.date}`, color: d.date === date ? 'var(--sleep)' : 'color-mix(in srgb, var(--sleep) 60%, transparent)' }));
    const wake = toMin(S.settings.wake) + 1440;
    const adv = bedtimeAdvice(m, toMin(S.settings.wake));
    const bedT = adv ? (adv.bed < 720 ? adv.bed + 1440 : adv.bed) : null;
    return nights.some((n) => n.start) ? `<div class="section-title">Slaapschema · 14 dagen</div><div class="card">${sleepRange(nights, { labelEvery: 2, target: bedT ? [bedT, wake] : null })}<div class="legend"><span><i style="background:var(--band)"></i>advies: ${bedT ? clockTxt(bedT) : ''}–${esc(S.settings.wake)}</span><span>tik voor die nacht</span></div></div>` : '';
  })()}
  <div class="section-title">Slaap · 14 dagen</div>
  <div class="card">${bars(days14.map((d) => ({ date: d.date, go: `#/sleep/${d.date}`, value: d.sleep ? d.sleep.asleep / 60 : null, color: d.sleep && d.sleep.perf >= 0.85 ? 'var(--sleep)' : 'rgba(125,122,255,.5)' })), { fmt: (v) => num(v, 1), labelEvery: 2 })}
  <div class="legend"><span><i style="background:var(--sleep)"></i>≥ 85% van behoefte</span><span>gem. ${fmtHM(mean(days14.map((d) => d.sleep?.asleep)))}</span></div></div>
  </div>`;
}

/** Slaapschuld: netto tekort over de laatste 7 nachten (te veel slapen lost een deel af). */
function sleepDebtCard(date) {
  const ds = lastDays(S.computed.byDate, date, 7);
  const bal = ds.map((d) => (d.sleep ? d.sleep.asleep - d.sleep.need : null));
  const have = bal.filter((v) => v != null);
  if (have.length < 2) return '';
  const net = have.reduce((a, v) => a + v, 0);
  const debt = Math.max(0, -net);
  const maxAbs = Math.max(60, ...have.map((v) => Math.abs(v)));
  const word = debt < 30 ? 'Uitgerust' : debt < 120 ? 'Klein tekort' : debt < 300 ? 'Flink tekort' : 'Groot tekort';
  const col = debt < 30 ? 'var(--green)' : debt < 120 ? 'var(--yellow)' : 'var(--red)';
  const extra = Math.max(20, Math.min(60, Math.round(debt / 4)));
  const nights = Math.min(7, Math.ceil(debt / extra));
  const plan = debt >= 30 ? `Inhalen: ${fmtHM(extra)} extra per nacht, ${nights} ${nights === 1 ? 'nacht' : 'nachten'} lang. Eerder naar bed werkt beter dan uitslapen — dat houdt je ritme stabiel.` : 'Je slaapt ongeveer wat je nodig hebt. Zo houden!';
  return `<div class="section-title">Slaapschuld · 7 nachten</div>
  <div class="card debt">
    <div class="debt-top"><div><div class="debt-v" style="color:${col}">${debt < 1 ? '0:00' : fmtHM(debt)}</div><div class="debt-w">${word}</div></div>
    <div class="debt-chart">${ds.map((d, i) => { const v = bal[i]; const h = v == null ? 0 : (Math.abs(v) / maxAbs) * 32; return `<a class="debt-col" href="#/sleep/${d.date}" title="${v == null ? 'geen data' : `${v >= 0 ? '+' : '−'}${fmtHM(Math.abs(v))}`}"><span class="debt-bar ${v == null ? 'none' : v >= 0 ? 'pos' : 'neg'}" style="height:${Math.max(2, h)}px"></span><small>${weekdayShort(d.date)}</small></a>`; }).join('')}</div></div>
    <p class="small muted" style="margin:10px 0 0">${plan}</p>
  </div>`;
}

/** Draagtijd: hoeveel minuten van de dag heeft de Fitbit hartslag gemeten, en waar zitten de gaten? */
function wearOf(date) {
  const raw = M(date)?.raw || S.days.find((d) => d.date === date);
  if (!raw || raw.empty) return null;
  const hr = raw.hr || [];
  const isToday = date === today();
  const now = new Date();
  let span = isToday ? now.getHours() * 60 + now.getMinutes() : 1440;
  // Vandaag: tel alleen tot de laatst gesynchroniseerde minuut (Fitbit loopt vaak wat achter).
  if (isToday) { let last = Math.min(span, hr.length) - 1; while (last > 0 && !hr[last]) last--; span = Math.min(span, last + 1); }
  if (span < 30) return null;
  let have = 0;
  for (let i = 0; i < Math.min(span, hr.length); i++) if (hr[i]) have++;
  // Grootste gat overdag (07–23 u), alleen als je hem niet droeg.
  let gap = null, run = 0, runStart = 0;
  const from = 7 * 60, to = Math.min(span, 23 * 60);
  for (let i = from; i <= to; i++) {
    if (i < to && !hr[i]) { if (!run) runStart = i; run++; } else { if (run > (gap?.len || 0)) gap = { start: runStart, len: run }; run = 0; }
  }
  const segs = [];
  for (let k = 0; k < 96; k++) {
    let n = 0, c = 0;
    for (let i = k * 15; i < k * 15 + 15; i++) { if (i >= span) break; n++; if (hr[i]) c++; }
    segs.push(n ? c / n : null);
  }
  return { minutes: have, span, pct: have / span, gap: gap && gap.len >= 45 ? gap : null, segs };
}

function wearCard(date) {
  const w = wearOf(date);
  if (!w) return '';
  const col = w.pct >= 0.85 ? 'var(--green)' : w.pct >= 0.65 ? 'var(--yellow)' : 'var(--red)';
  return `<div class="section-title">Draagtijd</div><div class="card wear">
    <div class="wear-top"><div><b style="color:${col}">${Math.round(w.pct * 100)}%</b><span>${num(w.minutes / 60, 1)} van ${num(w.span / 60, 1)} uur met hartslag</span></div></div>
    <div class="wear-strip">${w.segs.map((v) => `<i style="${v == null ? 'opacity:.25;background:var(--track)' : `background:color-mix(in srgb, var(--hr) ${Math.round(15 + v * 85)}%, var(--track))`}"></i>`).join('')}</div>
    <div class="wear-ax"><span>0</span><span>6</span><span>12</span><span>18</span><span>24</span></div>
    ${w.gap ? `<p class="small muted" style="margin:8px 0 0">Grootste gat: ${clockTxt(w.gap.start)}–${clockTxt(w.gap.start + w.gap.len)} (${fmtHM(w.gap.len)}). Activiteit in die tijd mist in je strain — log hem via ＋ als je toen iets deed.</p>` : `<p class="small muted" style="margin:8px 0 0">${w.pct >= 0.85 ? 'Goede dekking: je strain en slaap zijn betrouwbaar.' : 'Hoe vaker je hem draagt, hoe betrouwbaarder strain en herstel.'}</p>`}
  </div>`;
}

function toMin(hhmm) { const [h, m] = String(hhmm || '07:00').split(':').map(Number); return h * 60 + (m || 0); }

function viewDay(date) {
  const m = M(date);
  const raw = m?.raw || S.days.find((d) => d.date === date);
  const rows = [];
  const add = (k, v) => rows.push(`<div>${esc(k)}</div><div>${v}</div>`);
  if (raw) {
    add('HRV (gem. RMSSD)', raw.hrv != null ? `${num(raw.hrv, 1)} ms` : '–');
    add('HRV diepe slaap', raw.hrvDeep != null ? `${num(raw.hrvDeep, 1)} ms` : '–');
    add('Rusthartslag (dag)', raw.rhr != null ? `${raw.rhr} bpm` : '–');
    add('Hartslag non-REM', raw.sleepHr != null ? `${raw.sleepHr} bpm` : '–');
    add('Ademhaling', raw.resp != null ? `${num(raw.resp, 1)} /min` : '–');
    add('SpO₂', raw.spo2 != null ? `${num(raw.spo2, 1)}%` : '–');
    add('Huidtemp. nacht', raw.tempNight != null ? `${num(raw.tempNight, 2)} °C` : '–');
    add('Huidtemp. baseline', raw.tempBase != null ? `${num(raw.tempBase, 2)} °C` : '–');
    add('Stappen', num(raw.steps));
    add('Hartslag-metingen', raw.hr ? `${raw.hr.filter(Boolean).length} minuten` : '–');
    add('Hoogste hartslag', raw.hrMax ? `${raw.hrMax} bpm` : '–');
    if (raw.azm) add('Zoneminuten (vet/cardio/piek)', `${raw.azm.fatBurn}/${raw.azm.cardio}/${raw.azm.peak}`);
  }
  const c = [];
  const addc = (k, v) => c.push(`<div>${esc(k)}</div><div>${v}</div>`);
  if (m?.recovery) {
    addc('Herstel', `${m.recovery.score}%`);
    addc('z-score HRV / RHR / slaap', `${num(m.recovery.z.hrv, 2)} / ${num(m.recovery.z.rhr, 2)} / ${num(m.recovery.z.sleep, 2)}`);
    addc('Baseline HRV / RHR', `${num(m.recovery.baseline.hrv, 1)} ms / ${num(m.recovery.baseline.rhr, 1)} bpm`);
  }
  if (m?.strain) {
    addc('Strain', fmtStrain(m.strain.score));
    addc('Cardio-belasting (TRIMP)', num(m.strain.cardioTrimp, 1));
    addc('Spierbelasting (TRIMP-eq.)', num(m.strain.muscularTrimp, 1));
  }
  if (m?.sleep) {
    addc('Slaap / behoefte', `${fmtHM(m.sleep.asleep)} / ${fmtHM(m.sleep.need)}`);
    addc('Diep / REM / licht', `${fmtDur(m.sleep.deep)} / ${fmtDur(m.sleep.rem)} / ${fmtDur(m.sleep.light)}`);
  }
  const rawJson = raw ? JSON.stringify({ ...raw, hr: raw.hr ? `[${raw.hr.length} minuten]` : null, sleep: raw.sleep ? { ...raw.sleep, stages: `[${raw.sleep.stages?.length || 0} fasen]` } : null, sleepNext: undefined }, null, 2) : '';
  return `${navbar('Alle data', `#/today/${date}`)}
  <div class="content" data-swipe data-base="#/day" data-date="${date}">
  ${weekStrip(date, '#/day')}
  <div class="section-title">Hartslag per minuut</div>
  <div class="card">${hrDay(raw, { maxHr: S.computed.maxHr, activities: m?.strain?.activities || [] })}</div>
  ${wearCard(date)}
  <div class="section-title">Gemeten (Fitbit)</div>
  <div class="card">${rows.length ? `<div class="kv">${rows.join('')}</div>` : '<div class="muted">Geen data</div>'}</div>
  <div class="section-title">Berekend</div>
  <div class="card">${c.length ? `<div class="kv">${c.join('')}</div>` : '<div class="muted">Geen data</div>'}</div>
  ${m?.sleep ? `<div class="section-title">Slaapfasen</div><div class="card">${hypnogram(m.sleep)}<div class="small muted mt">${(m.sleep.stages || []).length} segmenten · ${fmtTime(m.sleep.start)}–${fmtTime(m.sleep.end)}</div></div>` : ''}
  <div class="list">${dayFlagRow(date)}</div>
  ${(raw?.exercises || []).length ? `<div class="section-title">Activiteiten (Fitbit)</div><div class="list">${raw.exercises.map((e) => `<div class="row"><div class="grow"><div class="title">${esc(e.name)}</div><div class="sub">${esc(e.type)} · ${fmtTime(e.start)}–${fmtTime(e.end)} · ${fmtDur(e.duration)}${e.avgHr ? ` · ${e.avgHr} bpm` : ''}${e.calories ? ` · ${num(e.calories)} kcal` : ''}${e.distanceKm ? ` · ${num(e.distanceKm, 2)} km` : ''}</div></div></div>`).join('')}</div>` : ''}
  ${rawJson ? `<div class="section-title">Ruwe data</div><details class="card"><summary class="small muted">Toon JSON</summary><pre class="raw">${esc(rawJson)}</pre></details>` : ''}
  </div>`;
}

let trendRange = 30;
let calOffset = 0;
let calMetric = 'rec';
const MONTHS = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];

/** Persoonlijk normaal bereik (gemiddelde ± 1 SD over 60 dagen) als band voor trendgrafieken. */
function normBand(f, end = today(), n = 60) {
  const v = lastDays(S.computed.byDate, end, n).filter((d) => d.flag !== 'sick').map(f).filter((x) => x != null);
  if (v.length < 7) return null;
  const m = mean(v), s = sd(v);
  return s ? [m - s, m + s] : null;
}

const clockTxt = clk;

function sleepScheduleCard(ds, le) {
  const nights = ds.map((d) => ({ date: d.date, start: d.sleep?.start || null, end: d.sleep?.end || null, go: `#/sleep/${d.date}` }));
  const have = nights.filter((x) => x.start && x.end);
  if (!have.length) return '';
  const bed = have.map((x) => sleepSpan(x.start, x.end)[0]), wake = have.map((x) => sleepSpan(x.start, x.end)[1]);
  const med = median;
  const sdBed = have.length > 2 ? sd(bed) : null;
  const sdWake = have.length > 2 ? sd(wake) : null;
  const cons = sdBed == null ? null : (sdBed + sdWake) / 2;
  const word = cons == null ? '' : cons <= 30 ? 'heel regelmatig' : cons <= 45 ? 'regelmatig' : cons <= 75 ? 'wisselend' : 'onregelmatig';
  return trendCard('Slaapschema', `${clockTxt(med(bed))} – ${clockTxt(med(wake))}`,
    cons != null ? `bedtijd wisselt ± ${Math.round(sdBed)} min · opstaan ± ${Math.round(sdWake)} min · <b>${word}</b>` : 'mediane bed- en opstaantijd',
    `${sleepRange(nights, { labelEvery: le })}<div class="legend"><span>Vaste bed- en opstaantijden hangen in grote studies samen met betere gezondheid, los van hoe lang je slaapt.</span></div>`, '#/sleep');
}

function calendarCard() {
  const now = parseYmd(today());
  const ref = new Date(now.getFullYear(), now.getMonth() + calOffset, 1);
  const y = ref.getFullYear(), mo = ref.getMonth();
  const metric = {
    rec: { label: 'Herstel', cell: (d) => (d.recovery ? { color: recoveryColor(d.recovery.score), alpha: 0.85, label: d.recovery.score } : null) },
    str: { label: 'Strain', cell: (d) => (d.strain?.score ? { color: 'var(--strain)', alpha: 0.14 + 0.86 * Math.pow(Math.max(0, Math.min(1, (d.strain.score - 3) / 15)), 1.4), label: num(d.strain.score, 0) } : null) },
    slp: { label: 'Slaap', cell: (d) => (d.sleep ? { color: 'var(--sleep)', alpha: 0.15 + 0.85 * Math.max(0, Math.min(1, (d.sleep.perf || 0))), label: num(d.sleep.asleep / 60, 1) } : null) },
    gym: { label: 'Training', cell: (d) => { const k = (d.strain?.sessions || []).length + (d.strain?.manual || []).length; return k ? { color: 'var(--muscle)', alpha: 0.85, label: (d.strain?.sessions || []).length ? '🏋' : '•' } : null; } },
  }[calMetric];
  const cal = calendar(y, mo, (date) => { const d = S.computed.byDate[date]; return d ? metric.cell(d) : null; }, today());
  const days = new Date(y, mo + 1, 0).getDate();
  const md = [];
  for (let i = 1; i <= days; i++) { const d = S.computed.byDate[`${y}-${pad(mo + 1)}-${pad(i)}`]; if (d) md.push(d); }
  const recs = md.map((d) => d.recovery?.score).filter((v) => v != null);
  const sess = md.reduce((a, d) => a + (d.strain?.sessions || []).length, 0);
  return `<div class="card trend cal-card">
    <div class="cal-head"><button class="icon-btn glass" data-act="cal" data-v="-1" aria-label="Vorige maand">${I.back}</button>
      <div><div class="trend-t">${cap(MONTHS[mo])} ${y}</div><div class="trend-s">${recs.length ? `gem. herstel ${Math.round(mean(recs))}% · ` : ''}${sess} krachttraining${sess === 1 ? '' : 'en'}</div></div>
      <button class="icon-btn glass" data-act="cal" data-v="1" ${calOffset >= 0 ? 'disabled' : ''} aria-label="Volgende maand">${I.chev}</button></div>
    <div class="segmented small">${[['rec', 'Herstel'], ['str', 'Strain'], ['slp', 'Slaap'], ['gym', 'Training']].map(([k, l]) => `<button class="${k === calMetric ? 'on' : ''}" data-act="calm" data-v="${k}">${l}</button>`).join('')}</div>
    ${cal}
  </div>`;
}
function trendCard(title, valueHtml, sub, chart, go = '', sheet = '') {
  const attr = sheet ? `data-sheet="${sheet}"` : go ? `data-go="${go}"` : '';
  return `<div class="card trend">
    <div class="trend-head${attr ? ' tap' : ''}" ${attr}><div><div class="trend-t">${title}</div><div class="trend-v">${valueHtml}</div><div class="trend-s">${sub}</div></div>${attr ? `<span class="chev">${I.chev}</span>` : ''}</div>
    ${chart}
  </div>`;
}

function viewTrends() {
  const end = today();
  const n = trendRange;
  const ds = lastDays(S.computed.byDate, end, n);
  const prev = lastDays(S.computed.byDate, addDays(end, -n), n);
  const le = n <= 7 ? 1 : n <= 30 ? 5 : 15;
  const avgOf = (arr, f) => mean(arr.map(f));
  const cmp = (f, digits = 0, higher = true, fmt = (v) => num(v, digits)) => {
    const a = avgOf(ds, f), b = avgOf(prev, f);
    if (a == null || b == null) return 'vorige periode: –';
    const d = a - b;
    const good = higher ? d >= 0 : d <= 0;
    if (Math.round(Math.abs(d) * Math.pow(10, digits)) === 0) return `gelijk aan vorige ${n === 7 ? 'week' : n === 30 ? 'maand' : 'periode'}`;
    return `<span class="${Math.abs(d) < Math.pow(10, -digits) ? '' : good ? 'up' : 'down'}">${d > 0 ? '▲' : d < 0 ? '▼' : '='} ${fmt(Math.abs(d))}</span> t.o.v. vorige ${n === 7 ? 'week' : n === 30 ? 'maand' : 'periode'}`;
  };
  const weeks = [];
  for (let w = Math.ceil(n / 7) - 1; w >= 0; w--) {
    const wEnd = addDays(end, -w * 7);
    const wd = lastDays(S.computed.byDate, wEnd, 7);
    weeks.push({ date: addDays(wEnd, -6), label: fmtDateShort(addDays(wEnd, -6)), go: '#/strength', value: wd.reduce((a, d) => a + (d.strain?.sessions || []).reduce((x, s) => x + s.load, 0), 0) });
  }
  const g = (d) => `#/today/${d.date}`;
  const rec = (d) => d.recovery?.score ?? null;
  const str = (d) => d.strain?.score || null;
  const slp = (d) => (d.sleep ? d.sleep.asleep : null);
  const hrv = (d) => d.recovery?.hrv ?? null;
  const rhr = (d) => d.recovery?.rhr ?? null;
  const resp = (d) => d.raw?.resp ?? null;
  const steps = (d) => d.raw?.steps ?? null;
  const zoneCount = ['green', 'yellow', 'red'].map((z) => ds.filter((d) => recoveryZone(rec(d)) === z).length);
  return `${largeTitle('Trends', '', avatar())}
  <button class="wk-entry glass" data-go="#/week/${weekStartOf(today())}"><span>${I.chart}</span><div><b>Weekoverzicht</b><small>Week ${isoWeek(today())} · vergelijk met vorige week</small></div><span class="chev">${I.chev}</span></button>
  <div class="segmented">${[7, 30, 90].map((r) => `<button class="${r === n ? 'on' : ''}" data-act="range" data-v="${r}">${r === 7 ? 'Week' : r === 30 ? 'Maand' : '3 maanden'}</button>`).join('')}</div>
  <div>
  ${trendCard('Herstel', `${num(avgOf(ds, rec))}<small>% gem.</small>`, `${cmp(rec)} · <span style="color:var(--green)">●</span> ${zoneCount[0]} <span style="color:var(--yellow)">●</span> ${zoneCount[1]} <span style="color:var(--red)">●</span> ${zoneCount[2]}`,
    bars(ds.map((d) => ({ date: d.date, go: g(d), value: rec(d), color: recoveryColor(rec(d)) })), { max: 100, labelEvery: le, unit: '%', avgLine: true }), '#/recovery')}
  ${trendCard('Strain', `${fmtStrain(avgOf(ds, str))}<small>gem.</small>`, cmp(str, 1, true, (v) => fmtStrain(v)),
    bars(ds.map((d) => ({ date: d.date, go: g(d), value: str(d), color: 'var(--strain)' })), { max: 21, labelEvery: le, fmt: fmtStrain, avgLine: true }), '#/strain')}
  ${trendCard('Slaap', `${fmtHM(avgOf(ds, slp))}<small>gem.</small>`, cmp(slp, 0, true, (v) => `${Math.round(v)} min`),
    bars(ds.map((d) => ({ date: d.date, go: g(d), value: slp(d) != null ? slp(d) / 60 : null, color: 'var(--sleep)' })), { labelEvery: le, fmt: (v) => num(v, 1), unit: ' u', avgLine: true }), '#/sleep')}
  ${sleepScheduleCard(ds, le)}
  ${trendCard('HRV', `${num(avgOf(ds, hrv))}<small>ms gem.</small>`, cmp(hrv),
    line(ds.map((d) => ({ date: d.date, go: g(d), value: hrv(d) })), { band: normBand(hrv), color: 'var(--green)', fmt: (v) => Math.round(v), unit: ' ms', dots: n <= 30 }), '', `metric:hrv:${end}:${n}`)}
  ${trendCard('Rusthartslag', `${num(avgOf(ds, rhr))}<small>bpm gem.</small>`, cmp(rhr, 0, false),
    line(ds.map((d) => ({ date: d.date, go: g(d), value: rhr(d) })), { band: normBand(rhr), color: 'var(--hr)', fmt: (v) => Math.round(v), unit: ' bpm', dots: n <= 30 }), '', `metric:rhr:${end}:${n}`)}
  ${trendCard('Ademhaling', `${num(avgOf(ds, resp), 1)}<small>/min gem.</small>`, cmp(resp, 1, false, (v) => num(v, 1)),
    line(ds.map((d) => ({ date: d.date, go: g(d), value: resp(d) })), { band: normBand(resp), color: 'var(--z1)', fmt: (v) => num(v, 1), unit: ' /min', dots: n <= 30 }), '', `metric:resp:${end}:${n}`)}
  <div class="band-note"><i></i>Grijze band = jouw normale bereik (gemiddelde ± 1 SD, 60 dagen)</div>
  ${calendarCard()}
  ${patternsCard({ limit: 4 })}
  ${trendCard('Spierbelasting', `${num(weeks.reduce((a, w) => a + w.value, 0) / Math.max(1, weeks.length), 0)}<small>per week</small>`, 'uit je krachtlog',
    bars(weeks, { fmt: (v) => num(v, 0), unit: '' }), '#/strength')}
  ${trendCard('Stappen', `${num(avgOf(ds, steps))}<small>gem.</small>`, cmp(steps, 0, true),
    bars(ds.map((d) => ({ date: d.date, go: g(d), value: steps(d), color: 'var(--muscle)' })), { labelEvery: le, fmt: (v) => `${Math.round(v / 1000)}k`, avgLine: true }), '', `metric:steps:${end}:${n}`)}
  </div>`;
}

function weekGroups(endDate) {
  const from = addDays(endDate, -6);
  const sets = {};
  let load = 0, count = 0;
  const loads = S.computed.loads;
  for (const s of S.strength.sessions) {
    if (s.deleted || !s.date || s.date < from || s.date > endDate) continue;
    const r = loads[s.id];
    if (!r) continue;
    count++; load += r.load;
    for (const [g, v] of Object.entries(r.hardSets)) sets[g] = (sets[g] || 0) + v;
  }
  return { sets, load, count };
}

/** Zware sets per spiergroep in een venster (hoofdspier 1, meewerkend ½). */
function setsPerGroup(from, to) {
  const out = {};
  for (const s of S.strength.sessions) {
    if (s.deleted || !s.date || s.date < from || s.date > to) continue;
    const r = S.computed.loads[s.id];
    if (r?.fracSets) for (const [g, v] of Object.entries(r.fracSets)) out[g] = (out[g] || 0) + v;
  }
  return out;
}

/** Krachtindex: mediane verhouding (beste e1RM tot dan / eerste e1RM) over al je oefeningen, per week. */
function strengthIndex(weeks = 16) {
  const sess = S.strength.sessions.filter((x) => !x.deleted && x.date).sort((a, b) => (a.date < b.date ? -1 : 1));
  const first = {}, best = {}, count = {};
  for (const x of sess) for (const e of S.computed.loads[x.id]?.exercises || []) if (e.e1rm) count[e.key] = (count[e.key] || 0) + 1;
  const keys = new Set(Object.keys(count).filter((k) => count[k] >= 3));
  if (keys.size < 3) return null;
  const pts = [];
  let i = 0;
  const end = weekStartOf(today());
  for (let w = weeks - 1; w >= 0; w--) {
    const wEnd = addDays(end, -7 * w + 6);
    while (i < sess.length && sess[i].date <= wEnd) {
      for (const e of S.computed.loads[sess[i].id]?.exercises || []) {
        if (!e.e1rm || !keys.has(e.key)) continue;
        first[e.key] ??= e.e1rm;
        best[e.key] = Math.max(best[e.key] || 0, e.e1rm);
      }
      i++;
    }
    const r = [...keys].filter((k) => first[k]).map((k) => best[k] / first[k]);
    pts.push({ date: addDays(end, -7 * w), value: r.length >= 3 ? Math.round(median(r) * 1000) / 10 : null, label: `wk ${isoWeek(addDays(end, -7 * w))}` });
  }
  const f = pts.findIndex((p) => p.value != null);
  return { pts: f > 0 ? pts.slice(f) : pts, n: keys.size };
}

function strengthIndexCard() {
  const si = strengthIndex();
  if (!si) return '';
  const vals = si.pts.filter((p) => p.value != null);
  if (vals.length < 2) return '';
  const cur = vals[vals.length - 1].value;
  const ago = vals.length > 8 ? vals[vals.length - 9].value : vals[0].value;
  const d = cur - ago;
  return `<div class="card trend">
    <div class="trend-head"><div><div class="trend-t">Krachtindex</div><div class="trend-v">${num(cur, 1)}<small>%</small></div><div class="trend-s">${d >= 0 ? '<span class="up">▲' : '<span class="down">▼'} ${num(Math.abs(d), 1)}%</span> in ${Math.min(8, vals.length - 1)} weken · ${si.n} oefeningen</div></div></div>
    ${line(si.pts.map((p) => ({ ...p, go: '#/records' })), { color: 'var(--muscle)', fmt: (v) => `${num(v, 1)}%`, unit: '', dots: true })}
    <p class="tiny muted" style="margin:6px 0 0">100% = je eerste gelogde topset per oefening. Telt je beste geschatte 1RM tot dan; de mediaan over al je oefeningen, zodat één uitschieter niet alles bepaalt.</p>
  </div>`;
}

function volumeCard() {
  const end = today();
  const cur = setsPerGroup(addDays(end, -6), end);
  const prev4 = setsPerGroup(addDays(end, -34), addDays(end, -7));
  const order = ['borst', 'rug', 'schouders', 'biceps', 'triceps', 'quads', 'hamstrings', 'billen', 'kuiten', 'core'];
  const rows = order.filter((g) => (cur[g] || 0) + (prev4[g] || 0) > 0);
  if (!rows.length) return '';
  const MAX = 24;
  const x = (v) => `${Math.min(100, (v / MAX) * 100)}%`;
  const status = (v) => (v >= 20 ? ['veel', 'var(--muscle)'] : v >= 10 ? ['optimaal', 'var(--green)'] : v >= 5 ? ['onderhoud', 'var(--yellow)'] : ['weinig', 'var(--text3)']);
  const low = rows.filter((g) => (cur[g] || 0) < 5).map((g) => GROUPS[g].toLowerCase());
  return `<div class="card vol">
    <div class="card-head"><span class="t">Volume per spiergroep</span><button class="link-btn small" data-sheet="volume:about">Hoe?</button></div>
    <div class="vol-sub">Zware sets in de laatste 7 dagen · streepje = je gemiddelde van de 4 weken ervoor</div>
    <div class="vol-scale"><span style="left:${x(10)}">10</span><span style="left:${x(20)}">20</span></div>
    ${rows.map((g) => {
      const v = cur[g] || 0, p = (prev4[g] || 0) / 4;
      const [lbl, col] = status(v);
      return `<button class="vol-row" data-sheet="muscle:${g}"><span class="vol-g">${GROUPS[g]}</span><span class="vol-bar"><i class="vol-band" style="left:${x(10)};width:calc(${x(20)} - ${x(10)})"></i><i class="vol-fill" style="width:${x(v)};background:${col}"></i>${p > 0 ? `<i class="vol-prev" style="left:${x(p)}"></i>` : ''}</span><span class="vol-n">${num(v, v % 1 && v < 10 ? 1 : 0)}</span><span class="vol-s" style="color:${col}">${lbl}</span></button>`;
    }).join('')}
    ${low.length && low.length < rows.length ? `<p class="small muted" style="margin:10px 0 0">Weinig deze week: ${esc(low.join(', '))}. Voor groei is ±10 sets per week een goed doel; minder houdt vooral vast wat je hebt.</p>` : ''}
  </div>`;
}

function volumeAboutSheet() {
  return `<div class="sh-head"><div class="eyebrow">Uitleg</div><h2>Volume per spiergroep</h2></div>
  <div class="card flat mt small"><p style="margin-top:0">Telt je <b>zware sets</b> per spiergroep over de laatste 7 dagen. Een oefening telt volledig voor de spier die het meeste werk doet en half voor meewerkende spieren (bijv. chest press: borst 1, triceps ½; een kleine bijrol telt niet).</p>
  <p>Omdat je alleen je topset noteert, gebruiken we het aantal sets uit je notitie (bijv. "2 sets"), anders ${S.settings.defaultSets} per oefening — aan te passen in Profiel.</p>
  <p><b>Richtlijn</b>: onderzoek (o.a. meta-analyses van Schoenfeld en Pelland) laat zien dat spiergroei toeneemt tot ongeveer <b>10–20 zware sets per spier per week</b>, met afnemende meerwaarde daarboven. Rond 5 sets per week behoud je vooral wat je hebt.</p>
  <p style="margin-bottom:0">Het blijft een schatting: tempo, rust tussen sets en hoe dicht je bij falen zit tellen ook mee.</p></div>`;
}

let showAllSessions = false;
const SS = () => ({ ...S.settings, exerciseMap: S.strength.exerciseMap, baselines: templateBaselines(S.strength, S.settings.bodyweight) });

function templateLastDate(t) {
  let last = null;
  for (const s of S.strength.sessions) if (!s.deleted && s.date && (s.name || '').trim().toLowerCase() === t.name.trim().toLowerCase() && (!last || s.date > last)) last = s.date;
  return last;
}

function activityRows(m, opts = {}) {
  const rows = [];
  const date = m.date;
  for (const a of m.strain?.manual || []) {
    const t = typeById(a.typeId);
    rows.push({ t: a.start, html: `<button class="row tap" data-sheet="manual:${a.id}"><div class="badge" style="background:${CATS[t.cat].color}">${actIcon(t)}</div><div class="grow"><div class="title">${esc(t.name)}</div><div class="sub">${opts.withDate ? `${weekdayShort(date)} ${fmtDateShort(date)} · ` : ''}${fmtTime(a.start)} · ${fmtDur(a.duration)} · ${a.est.source === 'hr' ? 'gemeten' : 'geschat'}${t.cat !== 'sport' ? ' · telt niet als fitheid' : ''}</div></div><div class="val"><b style="color:var(--strain)">${fmtStrain(strainFromTrimp(a.est.trimp))}</b></div><span class="chev">${I.chev}</span></button>` });
  }
  for (const s of m.strain?.sessions || []) {
    rows.push({ t: s.activity?.start || parseYmd(date).getTime() + 18 * 3600000, html: `<button class="row tap" data-go="#/session/${s.id}"><div class="badge" style="background:var(--muscle)">${I.dumbbell}</div><div class="grow"><div class="title">${esc(s.name || 'Krachttraining')}</div><div class="sub">${opts.withDate ? `${weekdayShort(date)} ${fmtDateShort(date)} · ` : ''}${s.exercises.length} oefeningen${s.activity ? ` · ${fmtDur(s.activity.duration)}` : ''}</div></div><div class="val"><b style="color:var(--muscle)">+${num(s.muscularTrimp, 0)}</b></div><span class="chev">${I.chev}</span></button>` });
  }
  for (const a of m.strain?.activities || []) {
    if (a.linked || a.linkedManual) continue;
    rows.push({ t: a.start, html: `<button class="row tap" data-sheet="activity:${date}:${esc(a.id)}"><div class="badge" style="background:var(--strain)">${/run|loop/i.test(a.type + a.name) ? I.run : I.flame}</div><div class="grow"><div class="title">${esc(a.name)}</div><div class="sub">${opts.withDate ? `${weekdayShort(date)} ${fmtDateShort(date)} · ` : ''}${fmtTime(a.start)} · ${fmtDur(a.duration)}${a.avgHr ? ` · gem. ${num(a.avgHr)} bpm` : ''}</div></div><div class="val"><b style="color:var(--strain)">${fmtStrain(a.strain)}</b></div><span class="chev">${I.chev}</span></button>` });
  }
  return rows.sort((a, b) => b.t - a.t).map((r) => r.html);
}

function recentActivitiesList(n = 14) {
  const rows = [];
  for (const m of lastDays(S.computed.byDate, today(), n).reverse()) if (m.strain) rows.push(...activityRows(m, { withDate: true }));
  return `<div class="list">${rows.length ? rows.slice(0, 12).join('') : `<button class="row tap" data-act="plus-activity" data-v="${today()}"><div class="badge" style="background:var(--card2);color:var(--muscle)">${I.plus}</div><div class="grow"><div class="title">Nog niets de afgelopen 2 weken</div><div class="sub">Voeg een workout of klus toe</div></div></button>`}</div>`;
}

function viewStrength() {
  const sessions = S.strength.sessions.filter((s) => !s.deleted).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : (b.createdAt || 0) - (a.createdAt || 0)));
  const loads = S.computed.loads;
  const wk = weekGroups(today());
  const order = [...UPPER, ...LOWER, 'core'];
  const maxSets = Math.max(10, ...Object.values(wk.sets));
  const exs = allExercises(S.strength.sessions, { exerciseMap: S.strength.exerciseMap }).slice(0, 6);
  const tpls = activeTemplates(S.strength);
  const recId = (() => { const m = M(today()); const r = recommendTraining({ templates: tpls, sessions: S.strength.sessions, fatigue: currentFatigue(), recovery: m?.recovery?.score ?? null, today: today(), settings: SS(), doneToday: (m?.strain?.sessions?.length || 0) > 0, flag: m?.flag }); return r?.kind === 'template' ? r.template.id : null; })();
  const byMonth = {};
  for (const s of sessions.slice(0, showAllSessions ? 1000 : 8)) {
    const k = s.date ? s.date.slice(0, 7) : 'zonder datum';
    (byMonth[k] ||= []).push(s);
  }
  const monthName = (k) => (k === 'zonder datum' ? 'Zonder datum' : new Date(k + '-01T12:00').toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' }));
  return `${largeTitle('Training', '', avatar())}
  <div class="fade-in">
  <div class="section-title" style="margin-top:4px">Schema's <button data-go="#/template-edit/new">+ Nieuw</button></div>
  ${tpls.length ? `<div class="list">${tpls.map((t) => {
    const last = templateLastDate(t);
    return `<div class="row tap" data-go="#/template/${t.id}"><div class="badge" style="background:var(--muscle)">${I.dumbbell}</div><div class="grow"><div class="title">${esc(t.name)}${recId === t.id ? ' <span class="pill tip-pill">tip vandaag</span>' : ''}</div><div class="sub">${t.exercises.length} oefeningen · ${last ? `laatst ${weekdayShort(last)} ${fmtDateShort(last)}` : 'nog niet gelogd'}</div></div><button class="btn small" data-act="start-template" data-id="${t.id}">Start</button></div>`;
  }).join('')}</div>`
    : `<div class="card"><div class="small muted">Plak je notitie met <b>Upper 6</b>, <b>Upper 7</b>, <b>Lower</b> en je topsets. Daar maakt de app schema's van: per training zie je je huidige topsets, vink je af wat je deed en pas je aan wat je verbeterd hebt.</div><button class="btn mt" data-go="#/import">${I.doc} Notitie plakken</button></div>`}
  <div class="btn-row mt"><button class="btn secondary" data-go="#/log/new">${I.plus} Losse training</button><button class="btn secondary" data-go="#/import">${I.doc} Notities</button></div>
  ${loadBandCard()}
  ${muscleCard()}
  ${volumeCard()}
  ${strengthIndexCard()}
  <div class="btn-row"><button class="btn secondary" data-go="#/records">${I.flame} Records</button><button class="btn secondary" data-act="share-claude">${I.doc} Deel met Claude</button></div>
  <div class="section-title">Recent <button data-act="plus-activity" data-v="${today()}">+ Activiteit</button></div>
  ${recentActivitiesList(6)}
  <div class="stats three mt">
    ${stat('Deze week', wk.count, wk.count === 1 ? 'training' : 'trainingen')}
    ${stat('Spierbelasting', num(wk.load, 0))}
    ${stat('Zware sets', num(Object.values(wk.sets).reduce((a, b) => a + b, 0), 0), '', 'geschat')}
  </div>
  ${sessions.length && !showAllSessions ? `<button class="btn secondary mt" data-act="all-sessions">Alle ${sessions.length} krachttrainingen</button>` : ''}
  ${sessions.length && showAllSessions ? `<div class="section-title">Krachttrainingen</div>` + Object.entries(byMonth).map(([k, list]) => `<div class="list-header">${esc(monthName(k))}</div><div class="list">${list.map((s) => `<button class="row tap" data-go="#/session/${s.id}"><div class="grow"><div class="title">${esc(s.name || 'Training')}</div><div class="sub">${s.date ? `${weekdayShort(s.date)} ${fmtDateShort(s.date)}` : 'geen datum'} · ${s.exercises.length} oefeningen${(loads[s.id]?.exercises || []).some((e) => e.isPR) ? ' · 🏆 PR' : ''}</div></div><div class="val">${num(loads[s.id]?.load, 1)}</div><span class="chev">${I.chev}</span></button>`).join('')}</div>`).join('') + (sessions.length > 8 && !showAllSessions ? `<button class="btn secondary" data-act="all-sessions">Alle ${sessions.length} trainingen</button>` : '') : ''}
  ${exs.length ? `<div class="section-title">Oefeningen</div><div class="list">${exs.map((e) => {
    const h = exerciseHistory(S.strength.sessions, e.key, SS());
    const last = h[h.length - 1];
    return `<button class="row tap" data-go="#/exercise/${encodeURIComponent(e.key)}"><div class="grow"><div class="title">${esc(e.name)}</div><div class="sub">${esc(e.lib.name)} · ${e.count}× · laatst ${esc(setText(last))}</div></div>${spark(h.slice(-12).map((x) => x.e1rm), { color: 'var(--muscle)', w: 64, h: 24 })}<span class="chev">${I.chev}</span></button>`;
  }).join('')}</div>${allExercises(S.strength.sessions, {}).length > 6 ? `<button class="btn secondary" data-go="#/exercises">Alle oefeningen</button>` : ''}` : ''}
  </div>`;
}

function viewTemplate(id) {
  const t = activeTemplates(S.strength).find((x) => x.id === id);
  if (!t) return `${navbar('Schema', '#/strength')}<div class="content card muted">Niet gevonden.</div>`;
  const last = templateLastDate(t);
  const rows = t.exercises.map((e) => {
    const cur = currentSet(S.strength, e.name, S.settings);
    const lib = matchExercise(e.name, S.strength.exerciseMap);
    const h = exerciseHistory(S.strength.sessions, exKey(e.name), SS());
    const improved = cur && !cur.fromTemplate && e.reps && cur.reps && (e1rmOf(cur) > e1rmOf(e) + 0.01);
    return `<button class="row tap wrap" data-go="#/exercise/${encodeURIComponent(exKey(e.name))}"><div class="grow"><div class="title">${esc(e.name)} ${improved ? '<span class="pill pr">↑</span>' : ''}</div><div class="sub">${esc(lib.name)} · ${cur?.date ? fmtDateShort(cur.date) : 'uit notitie'}${h.length > 1 ? ` · ${h.length}× gelogd` : ''}</div></div><div class="val"><b style="color:var(--text)">${esc(setText(cur || e))}</b></div></button>`;
  }).join('');
  return `${navbar(t.name, '#/strength', `<button class="nav-pill glass" data-go="#/template-edit/${t.id}">Wijzig</button>`)}
  <div class="content fade-in">
  ${largeTitle(t.name, last ? `Laatst ${fmtDateLong(last)}` : 'Schema')}
  <button class="btn" data-act="start-template" data-id="${t.id}">${I.dumbbell} Start training</button>
  <div class="list-header">Huidige topsets</div>
  <div class="list">${rows}</div>
  <div class="list-footer">Dit is je “levende notitie”: na elke training staan hier automatisch je nieuwste topsets. ↑ = beter dan toen je de notitie importeerde.</div>
  <button class="btn secondary" data-act="copy-template" data-id="${t.id}">${I.doc} Kopieer als notitie</button>
  </div>`;
}

function e1rmOf(e) {
  const w = e.bw ? (S.settings.bodyweight || 80) + (e.weight || 0) : e.weight;
  return e.reps ? (w || 0) * (1 + Math.min(e.reps, 30) / 30) : 0;
}

function viewTemplateEdit(id) {
  let d = S.tplDraft;
  if (!d || d._for !== id) {
    const src = id !== 'new' ? activeTemplates(S.strength).find((x) => x.id === id) : null;
    d = src ? JSON.parse(JSON.stringify(src)) : { id: uid(), name: '', exercises: [{ name: '', weight: null, reps: null, sets: null }], order: activeTemplates(S.strength).length };
    d._for = id;
    S.tplDraft = d;
  }
  const exNames = allExercises(S.strength.sessions, {}).map((e) => e.name);
  return `${navbar(id === 'new' ? 'Nieuw schema' : 'Schema wijzigen', id === 'new' ? '#/strength' : `#/template/${id}`, `<button class="nav-pill glass prominent" data-act="save-template" style="font-weight:600">Bewaar</button>`)}
  <div class="content fade-in">
  <div class="list"><div class="row"><div class="grow">Naam</div><input type="text" id="tpl-name" value="${esc(d.name)}" placeholder="bijv. Upper 6"></div></div>
  <div class="list">
    <div class="ex-head tpl"><span>Oefening</span><span>kg</span><span>reps</span><span>sets</span><span></span></div>
    ${d.exercises.map((e, i) => `<div class="ex-edit tpl" data-i="${i}">
      <input type="text" list="ex-names" data-f="name" value="${esc(e.name || '')}" placeholder="Oefening" autocomplete="off">
      <input class="num" type="number" inputmode="decimal" step="0.5" data-f="weight" value="${e.weight ?? ''}" placeholder="kg">
      <input class="num" type="number" inputmode="numeric" data-f="reps" value="${e.reps ?? ''}" placeholder="–">
      <input class="num" type="number" inputmode="numeric" data-f="sets" value="${e.sets ?? ''}" placeholder="${S.settings.defaultSets}">
      <button class="x" data-act="tpl-del-ex" data-i="${i}" aria-label="Verwijder">${I.minus}</button>
    </div>`).join('')}
  </div>
  <datalist id="ex-names">${exNames.map((n) => `<option value="${esc(n)}">`).join('')}</datalist>
  <button class="btn secondary" data-act="tpl-add-ex">${I.plus} Oefening</button>
  <p class="small muted mt">Gewicht en reps zijn startwaarden; na je eerste training gebruikt de app automatisch je nieuwste topsets. Bij bodyweight-oefeningen: zet “BW” in de naam of laat kg leeg.</p>
  ${id !== 'new' ? `<div style="height:20px"></div><button class="btn danger" data-act="delete-template">${I.trash} Verwijder schema</button>` : ''}
  </div>`;
}

function viewExercises() {
  const exs = allExercises(S.strength.sessions, { exerciseMap: S.strength.exerciseMap });
  return `${navbar('Oefeningen', '#/strength')}<div class="content fade-in"><div class="list">${exs.map((e) => `<button class="row tap" data-go="#/exercise/${encodeURIComponent(e.key)}"><div class="grow"><div class="title">${esc(e.name)}</div><div class="sub">${esc(e.lib.name)} · ${e.count}×</div></div><span class="chev">${I.chev}</span></button>`).join('')}</div></div>`;
}

/** Alle trainingen vóór deze sessie, nieuwste eerst (zelfde dag: eerder aangemaakt telt als vorige). Per render gecachet. */
let PREV_CACHE = null;
function sessionsBefore(sess) {
  const k = `${sess.id}|${S.strength.updatedAt}`;
  if (PREV_CACHE?.k === k) return PREV_CACHE.v;
  const v = S.strength.sessions.filter((x) => !x.deleted && x.date && x.id !== sess.id && (x.date < sess.date || (x.date === sess.date && (x.createdAt || 0) < (sess.createdAt || 0))))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : (b.createdAt || 0) - (a.createdAt || 0)));
  PREV_CACHE = { k, v };
  return v;
}

/** Dezelfde oefening in de vorige training (vóór deze sessie). */
function prevExercise(key, sess) {
  const loads = S.computed.loads;
  for (const x of sessionsBefore(sess)) { const e = loads[x.id]?.exercises.find((y) => y.key === key); if (e) return { ...e, date: x.date }; }
  return null;
}

/** De vorige training met dezelfde naam (bijv. vorige Upper 6). */
function prevSameSession(sess) {
  const n = (sess.name || '').trim().toLowerCase();
  return sessionsBefore(sess).find((x) => (x.name || '').trim().toLowerCase() === n) || null;
}

/** Samenvatting direct na het opslaan van een training. */
function shareExtras() {
  const r1 = (v) => (v == null ? null : Math.round(v * 10) / 10);
  const fm = forecastModel();
  const wk = weekGoalValues(weekStartOf(today()));
  return {
    volume7d: Object.fromEntries(Object.entries(setsPerGroup(addDays(today(), -6), today())).map(([g, v]) => [g, r1(v)])),
    goals: { target: goalsOf(), thisWeek: { strength: wk.strength, mvpa: Math.round(wk.mvpa), sleep: wk.sleep && Math.round(wk.sleep), steps: wk.steps && Math.round(wk.steps) } },
    forecast: fm ? { n: fm.n, perHourSleep: r1(fm.perHourSleep), perStrain: r1(fm.perStrain), rse: r1(fm.rse) } : null,
    rpeCal: S.computed.rpeCal || null,
    wear: lastDays(S.computed.byDate, today(), 7).map((d) => { const w = wearOf(d.date); return w ? Math.round(w.pct * 100) : null; }),
    flags: (S.strength.flags || []).filter((f) => !f.deleted && f.date >= addDays(today(), -30)).map((f) => [f.date, f.kind]),
  };
}

function workoutSummarySheet(id) {
  const s = S.strength.sessions.find((x) => x.id === id);
  const r = S.computed.loads[id];
  if (!s || !r) return '<p>Training bewaard.</p>';
  const prs = r.exercises.filter((e) => e.isPR);
  let up = 0, same = 0, down = 0;
  for (const e of r.exercises) { const pv = prevExercise(e.key, s); if (!pv) continue; const d = (e.e1rm || 0) - (pv.e1rm || 0); if (d > 0.05) up++; else if (d < -0.05) down++; else same++; }
  const pv = prevSameSession(s);
  const pl = pv ? S.computed.loads[pv.id]?.load : null;
  const top = Object.entries(r.groups).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([g]) => GROUPS[g]);
  const m = M(s.date);
  const tgt = m?.target;
  const headline = prs.length ? `${prs.length} ${prs.length === 1 ? 'record' : 'records'}!` : up > down ? 'Sterker dan vorige keer' : up === 0 && down === 0 ? 'Training bewaard' : down > up ? 'Zwaardere dag' : 'Stabiel';
  return `<div class="wo-sum">
    <div class="wo-badge">${prs.length ? '🏆' : I.check}</div>
    <div class="eyebrow center">${esc(s.name || 'Training')} · ${esc(fmtDateShort(s.date))}</div>
    <h2 class="center">${headline}</h2>
    <div class="stats three mt">
      ${stat('Beter', up, '', `${same} gelijk · ${down} lager`)}
      ${stat('Spierbelasting', num(r.load, 1), '', pl ? `${r.load >= pl ? '▲' : '▼'} ${num(Math.abs((r.load / pl - 1) * 100), 0)}% vs vorige` : 'eerste keer')}
      ${stat('Dag-strain', m?.strain ? fmtStrain(m.strain.score) : '–', '', tgt ? `doel ${fmtStrain(tgt[0])}–${fmtStrain(tgt[1])}` : '')}
    </div>
    ${prs.length ? `<div class="list mt">${prs.map((e) => `<div class="row"><div class="badge" style="background:var(--yellow);color:#000">${I.flame}</div><div class="grow"><div class="title">${esc(e.name)}</div><div class="sub">e1RM ${num(e.e1rm, 1)} kg</div></div><div class="val"><b>${esc(setText({ ...e, sets: null }))}</b></div></div>`).join('')}</div>` : ''}
    <p class="small muted center mt">Vooral ${esc(top.join(', ').toLowerCase())} getraind. Eet binnen een paar uur ±0,4 g eiwit per kg en slaap vannacht genoeg — daar groei je van.</p>
    <button class="btn mt" data-act="close-sheet">Klaar</button>
  </div>`;
}

/** Hartslag tijdens de training, met tijd per zone (% van je max). */
function sessionHrCard(s, m) {
  const sm = m?.strain?.sessions?.find((x) => x.id === s.id);
  const act = sm?.activity;
  const raw = m?.raw;
  if (!act?.start || !act?.end || !raw?.hr?.length) return '';
  const from = Math.max(0, Math.floor((act.start - raw.hrStart) / 60000) - 10);
  const to = Math.min(raw.hr.length, Math.ceil((act.end - raw.hrStart) / 60000) + 10);
  if (to - from < 10) return '';
  const max = S.computed.maxHr;
  const zones = [0, 0, 0, 0, 0];
  const i0 = Math.floor((act.start - raw.hrStart) / 60000), i1 = Math.ceil((act.end - raw.hrStart) / 60000);
  for (let i = i0; i < i1; i++) { const v = raw.hr[i]; if (!v) continue; const z = ZONES.findIndex((q) => v / max >= q.lo && v / max < q.hi); if (z >= 0) zones[z]++; }
  const tot = zones.reduce((a, b) => a + b, 0);
  return `<div class="section-title">Hartslag tijdens training</div>
  <div class="card">${hrDay(raw, { maxHr: max, activities: [act], fromMin: from, toMin: to })}
    ${tot ? `<div class="mt">${stackBar(zones.map((v, i) => ({ value: v, color: `var(--z${i + 1})`, label: `zone ${i + 1}` })), { height: 10 })}</div>
    <div class="legend">${zones.map((v, i) => (v ? `<span><i style="background:var(--z${i + 1})"></i>Z${i + 1} ${v} min</span>` : '')).join('')}</div>` : ''}
    ${act.fromLog ? '' : `<p class="tiny muted" style="margin:8px 0 0">Gekoppeld aan Fitbit-workout “${esc(act.name || '')}”.</p>`}
  </div>`;
}

function viewSession(id) {
  const s = S.strength.sessions.find((x) => x.id === id);
  if (!s) return `${navbar('Training', '#/strength')}<div class="content card muted">Niet gevonden.</div>`;
  const r = S.computed.loads[id] || { exercises: [], groups: {}, load: 0 };
  const groups = Object.entries(r.groups).sort((a, b) => b[1] - a[1]);
  const maxG = Math.max(1, ...groups.map((g) => g[1]));
  const m = s.date ? M(s.date) : null;
  const sess = m?.strain?.sessions?.find((x) => x.id === id);
  return `${navbar(s.name || 'Training', '#/strength', `<button class="nav-pill glass" data-go="#/log/${id}">Wijzig</button>`)}
  <div class="content fade-in">
  ${largeTitle(s.name || 'Training', s.date ? fmtDateLong(s.date) : 'Geen datum')}
  <div class="stats">
    ${(() => { const pv = s.date ? prevSameSession(s) : null; const pl = pv ? S.computed.loads[pv.id]?.load : null; return stat('Spierbelasting', num(r.load, 1), '', pl ? `${r.load >= pl ? '▲' : '▼'} ${num(Math.abs((r.load / pl - 1) * 100), 0)}% vs ${fmtDateShort(pv.date)}` : `+${num(r.load * 3.2)} strain-punten`); })()}
    ${stat('Dag-strain', m ? fmtStrain(m.strain.score) : '–', '', sess?.activity ? `cardio tijdens training ${fmtStrain(sess.activity.strain)}` : '')}
  </div>
  ${(() => {
    const sm = m?.strain?.sessions?.find((x) => x.id === id);
    const hw = sm?.hrWindow || (sm?.activity ? { avg: sm.activity.avgHr, max: sm.activity.maxHr } : null);
    return `<div class="stats three mt">
      ${stat('Tijd', s.start ? fmtTime(s.start) : '–', '', s.duration ? fmtDur(s.duration) : 'duur onbekend')}
      ${stat('Zwaarte', s.rpe != null ? s.rpe : '–', s.rpe != null ? '/10' : '', s.rpe != null ? `×${num(r.rpeFactor, 2)} op belasting` : 'niet ingevuld')}
      ${stat('Hartslag', hw?.avg ? num(hw.avg) : '–', hw?.avg ? 'bpm' : '', hw?.max ? `max ${num(hw.max)}` : 'geen meting')}
    </div>`;
  })()}
  ${sessionHrCard(s, m)}
  <div class="section-title">Topsets</div>
  <div class="list">${r.exercises.map((e) => `<button class="row tap wrap" data-go="#/exercise/${encodeURIComponent(e.key)}"><div class="grow"><div class="title">${esc(e.name)} ${e.isPR ? '<span class="pill pr">PR</span>' : ''}</div><div class="sub">${esc(e.libName)}${e.e1rm ? ` · e1RM ${num(e.e1rm, 1)} kg` : ''} · belasting ${num(e.load, 1)}${e.note ? ` · ${esc(e.note)}` : ''}</div></div><div class="val"><b style="color:var(--text)">${esc(setText(e))}</b>${(() => { const pv = prevExercise(e.key, s); if (!pv) return '<small class="vs new">eerste keer</small>'; const d = (e.e1rm || 0) - (pv.e1rm || 0); return `<small class="vs ${d > 0.05 ? 'up' : d < -0.05 ? 'down' : ''}">${d > 0.05 ? '▲' : d < -0.05 ? '▼' : '='} vorige: ${esc(setText({ ...pv, sets: null }))}</small>`; })()}</div></button>`).join('')}</div>
  <div class="section-title">Spiergroepen</div>
  <div class="card">${groups.map(([g, v]) => `<div class="mg"><span>${GROUPS[g] || g}</span><div class="meter"><span style="width:${(v / maxG) * 100}%;background:var(--muscle)"></span></div><span class="n">${num(v, 1)}</span></div>`).join('')}</div>
  <button class="btn secondary" data-go="#/log/${id}">Bewerken</button>
  </div>`;
}

function viewExercise(key) {
  const h = exerciseHistory(S.strength.sessions, key, SS());
  const cur = currentSet(S.strength, key, S.settings);
  const name = h[h.length - 1]?.name || cur?.name || key;
  const lib = matchExercise(name, S.strength.exerciseMap);
  const best = h.reduce((a, e) => (e.e1rm > (a?.e1rm || 0) ? e : a), null);
  const lastE = h[h.length - 1] || cur;
  return `${navbar(name, '#/strength')}
  <div class="content fade-in">
  ${largeTitle(name, lib.name)}
  <div class="stats">
    ${stat('Beste e1RM', num(best?.e1rm, 1), 'kg', best ? `${esc(setText(best))} · ${fmtDateShort(best.date)}` : '')}
    ${stat('Huidige topset', lastE ? esc(setText({ ...lastE, sets: null })) : '–', '', lastE?.date ? fmtDateShort(lastE.date) : lastE ? 'uit notitie' : '')}
  </div>
  ${(() => {
    const pts = h.filter((e) => e.e1rm && e.date);
    if (pts.length < 2) return '';
    const first = pts[0], last = pts[pts.length - 1];
    const gain = last.e1rm - first.e1rm;
    // Trend: lineaire regressie over de laatste 90 dagen (kg per maand).
    const rec = pts.filter((e) => e.date >= addDays(today(), -90));
    let slope = null;
    if (rec.length >= 3) {
      const xs = rec.map((e) => daysBetween(rec[0].date, e.date)), ys = rec.map((e) => e.e1rm);
      const mx = mean(xs), my = mean(ys);
      const den = xs.reduce((a, x) => a + (x - mx) ** 2, 0);
      if (den > 0) slope = (xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0) / den) * 30;
    }
    const tplEx = activeTemplates(S.strength).flatMap((t) => t.exercises).find((x) => exKey(x.name) === key);
    const tip = progressionTip(h, tplEx?.reps);
    return `<div class="stats three">
      ${stat('Sinds start', `${gain >= 0 ? '+' : ''}${num(gain, 1)}`, 'kg', `${gain >= 0 ? '+' : ''}${num((gain / first.e1rm) * 100, 0)}% · ${fmtDateShort(first.date)}`)}
      ${stat('Tempo', slope == null ? '–' : `${slope >= 0 ? '+' : ''}${num(slope, 1)}`, slope == null ? '' : 'kg', slope == null ? 'na 3 sessies' : `per maand · ${slope > 0.3 ? 'stijgend' : slope < -0.3 ? 'dalend' : 'stabiel'}`)}
      ${stat('Volgende keer', tip ? esc(tip.text.replace(/^Probeer /, '')) : 'zelfde', '', tip?.kind === 'up' ? 'zwaarder' : tip?.kind === 'reps' ? 'meer reps' : tip?.kind === 'hold' ? 'vasthouden' : 'herhaal topset')}
    </div>`;
  })()}
  <div class="section-title">Geschatte 1RM</div>
  <div class="card">${line(h.map((e) => ({ date: e.date, go: e.sessionId ? `#/session/${e.sessionId}` : '', value: e.e1rm ? Math.round(e.e1rm * 10) / 10 : null, color: e.isPR ? 'var(--yellow)' : null })), { color: 'var(--muscle)', fmt: (v) => `${num(v, 1)} kg`, unit: '' })}<div class="legend"><span><i style="background:var(--yellow)"></i>PR</span><span>tik op een punt voor die training</span></div></div>
  <div class="list-header">Spiergroep-indeling</div>
  <div class="list"><div class="row"><div class="grow">Type oefening</div><select data-act="map-ex" data-key="${esc(key)}">${[...LIBRARY.filter((l) => l.id !== 'press'), { id: 'other', name: 'Overig' }].map((l) => `<option value="${l.id}" ${l.id === lib.id ? 'selected' : ''}>${esc(l.name)}</option>`).join('')}</select></div></div>
  <div class="list-footer">Bepaalt welke spieren meetellen: ${Object.entries(lib.g).map(([g, w]) => `${GROUPS[g]} ${Math.round(w * 100)}%`).join(', ')}.</div>
  ${h.length ? `<div class="list-header">Geschiedenis</div>
  <div class="list">${[...h].reverse().map((e) => `<button class="row tap" data-go="#/session/${e.sessionId}"><div class="grow"><div class="title">${esc(setText(e))} ${e.isPR ? '<span class="pill pr">PR</span>' : ''}</div><div class="sub">${fmtDateShort(e.date)} · ${esc(e.session || '')}</div></div><div class="val">${num(e.e1rm, 1)}</div></button>`).join('')}</div>` : ''}
  </div>`;
}

function draftFromTemplate(t, date) {
  const d = newSession(date || today());
  d.name = t.name;
  d.templateId = t.id;
  d.exercises = t.exercises.map((e) => {
    const cur = currentSet(S.strength, e.name, S.settings) || e;
    const bw = cur.bw ?? e.bw ?? false;
    const w = cur.weight ?? e.weight ?? null;
    return { name: e.name, weight: bw && !w ? null : w, reps: cur.reps ?? e.reps ?? null, sets: cur.sets ?? e.sets ?? null, bw, done: false, fixed: true };
  });
  return d;
}

function saveDraftLS() { try { if (S.editDraft) localStorage.setItem('pulse.draft', JSON.stringify(S.editDraft)); } catch { /* */ } }
function loadDraftLS() { try { return JSON.parse(localStorage.getItem('pulse.draft') || 'null'); } catch { return null; } }
function clearDraftLS() { try { localStorage.removeItem('pulse.draft'); } catch { /* */ } }

function viewLog(id, presetDate) {
  if (!S.editDraft) {
    const saved = loadDraftLS();
    if (saved && saved._for === (id || 'new') && !(saved.start && Date.now() - saved.start > 12 * 3600000)) { S.editDraft = saved; S.draftRestored = true; }
    else if (saved) clearDraftLS();
  }
  let d = S.editDraft;
  if (!d || d._for !== (id || 'new')) {
    const src = id && id !== 'new' ? S.strength.sessions.find((s) => s.id === id) : null;
    d = src ? JSON.parse(JSON.stringify(src)) : newSession(presetDate || today());
    if (!d.exercises.length) d.exercises.push({ name: '', weight: null, reps: null });
    d._for = id || 'new';
    S.editDraft = d;
  }
  const tpls = activeTemplates(S.strength);
  const tplNames = new Set(tpls.map((t) => t.name.toLowerCase()));
  const recentNames = [...new Set(S.strength.sessions.filter((s) => !s.deleted).sort((a, b) => (a.date < b.date ? 1 : -1)).map((s) => s.name).filter((n) => n && !tplNames.has(n.toLowerCase())))].slice(0, 4);
  const exNames = [...new Set([...allExercises(S.strength.sessions, {}).map((e) => e.name), ...tpls.flatMap((t) => t.exercises.map((e) => e.name))])];
  const isNew = d._for === 'new';
  const fromTpl = d.exercises.some((e) => e.done === false || e.done === true);
  const doneCount = d.exercises.filter((e) => e.done !== false && e.name).length;
  return `${navbar(isNew ? 'Training' : 'Bewerken', isNew ? (presetDate ? `#/today/${presetDate}` : '#/strength') : `#/session/${id}`, `<button class="nav-pill glass prominent" data-act="save-log" style="font-weight:600">Bewaar</button>`)}
  <div class="content fade-in">
  <div class="list">
    <div class="row"><div class="grow">Datum</div><input type="date" id="log-date" value="${esc(d.date || '')}" max="${today()}"></div>
    <div class="row"><div class="grow">Naam</div><input type="text" id="log-name" value="${esc(d.name || '')}" placeholder="bijv. Upper 6"></div>
  </div>
  ${isNew ? `<div class="chips">${tpls.map((t) => `<button class="chip${d.templateId === t.id ? ' on' : ''}" data-act="use-template" data-id="${t.id}">${esc(t.name)}</button>`).join('')}${recentNames.map((c) => `<button class="chip" data-act="chip-name" data-v="${esc(c)}">${esc(c)}</button>`).join('')}</div>` : ''}
  ${S.draftRestored ? `<div class="card flat small" style="display:flex;align-items:center;gap:10px">Je onafgemaakte training is teruggezet.<button class="link-btn" data-act="discard-draft" style="margin-left:auto">Weggooien</button></div>` : ''}
  ${fromTpl ? `<p class="small muted" style="margin:0 2px 8px">Vink af wat je gedaan hebt en pas gewicht/reps aan als je verbeterd bent. <span data-done-count>${doneCount} afgevinkt.</span></p>` : ''}
  <div class="list" id="ex-list">
    <div class="ex-head chk"><span></span><span>Oefening</span><span>kg</span><span>reps</span><span></span></div>
    ${d.exercises.map((e, i) => exRow(e, i)).join('')}
  </div>
  <datalist id="ex-names">${exNames.map((n) => `<option value="${esc(n)}">`).join('')}</datalist>
  <button class="btn secondary" data-act="add-ex">${I.plus} Oefening</button>
  <div class="list-header">Tijd</div>
  <div class="list">
    ${d.live && d.start ? `<div class="row"><div class="badge" style="background:var(--green)">${I.dumbbell}</div><div class="grow"><div class="title">Training loopt</div><div class="sub">gestart om ${fmtTime(d.start)} · eindtijd wordt bij Bewaar ingevuld</div></div><div class="val"><b data-elapsed style="color:var(--green)">${elapsedText(d.start)}</b></div></div>` : ''}
    <div class="row"><div class="grow">Begon om</div><input type="time" id="log-start" value="${d.start ? `${pad(new Date(d.start).getHours())}:${pad(new Date(d.start).getMinutes())}` : ''}"></div>
    <div class="row"><div class="grow">Duur</div><input type="number" inputmode="numeric" id="log-dur" value="${d.duration ?? ''}" placeholder="${d.live ? 'automatisch' : 'min'}" style="width:110px"><span class="muted">&nbsp;min</span></div>
  </div>
  <div class="list-header">Hoe zwaar voelde de training?</div>
  <div class="card flat rpe">
    <div class="rpe-top"><span class="rpe-v" data-lrpe-v>${d.rpe ?? '–'}</span><span class="rpe-l" data-lrpe-l>${d.rpe != null ? RPE_LABELS[d.rpe] : 'Sleep om in te vullen (5 = normaal)'}</span></div>
    <input type="range" min="0" max="10" step="1" value="${d.rpe ?? 5}" id="log-rpe" class="slider${d.rpe == null ? ' unset' : ''}">
    <div class="rpe-scale"><span>0 rust</span><span>5 normaal zwaar</span><span>10 max</span></div>
  </div>
  <p class="small muted mt">Noteer alleen je topset. Leeg = je vorige topset (grijs). Bodyweight: zet “BW” in de naam; extra gewicht (bijv. dips +20) vul je in als kg.</p>
  <div class="list-header">Snel plakken</div>
  <textarea class="notes" id="quick" style="min-height:90px" placeholder="Chest press 80kg 8 reps&#10;Lat pulldown 87kg 2 sets 8 reps"></textarea>
  <button class="btn secondary mt" data-act="quick-add">Regels toevoegen</button>
  ${!isNew ? `<div style="height:24px"></div><button class="btn danger" data-act="delete-log">${I.trash} Verwijder training</button>` : ''}
  </div>`;
}

function lastSet(name) {
  return currentSet(S.strength, name, S.settings);
}

function exRow(e, i) {
  const last = e.name ? lastSet(e.name) : null;
  const done = e.done !== false;
  let tip = null;
  if (e.fixed && e.name) {
    const h = exerciseHistory(S.strength.sessions, exKey(e.name), SS());
    const tplEx = activeTemplates(S.strength).flatMap((t) => t.exercises).find((x) => exKey(x.name) === exKey(e.name));
    tip = progressionTip(h.length ? h : (last ? [last] : []), tplEx?.reps);
  }
  return `<div class="ex-edit chk${done ? '' : ' off'}" data-i="${i}" data-done="${done ? 1 : 0}">
    <button class="ck${done ? ' on' : ''}" data-act="toggle-done" data-i="${i}" aria-label="Gedaan">${done ? I.check : ''}</button>
    ${e.fixed ? `<div class="nm" data-act="toggle-done" data-i="${i}">${esc(e.name)}${last?.date ? `<small>${fmtDateShort(last.date)}: ${esc(setText({ ...last, sets: null }))}</small>` : ''}${tip ? `<span class="tip tip-${tip.kind}">${tip.kind === 'up' ? '↑ ' : ''}${esc(tip.text)}</span>` : ''}</div>` : `<input type="text" list="ex-names" data-f="name" value="${esc(e.name || '')}" placeholder="Oefening" autocomplete="off">`}
    <input class="num" type="number" inputmode="decimal" step="0.5" data-f="weight" value="${e.weight ?? ''}" placeholder="${e.bw || last?.bw ? 'BW' : last ? num(last.weight, 1) : 'kg'}">
    <input class="num" type="number" inputmode="numeric" data-f="reps" value="${e.reps ?? ''}" placeholder="${last?.reps ?? 'reps'}">
    <button class="x" data-act="del-ex" data-i="${i}" aria-label="Verwijder">${I.minus}</button>
  </div>`;
}

/** Wat is er veranderd in een geplakt schema t.o.v. het opgeslagen schema? */
function templateDiff(block) {
  const t = findTemplate(S.strength, block.name);
  if (!t) return null;
  const old = new Map(t.exercises.map((e) => [exKey(e.name), e]));
  const bw = S.settings.bodyweight || 80;
  const est = (e) => e1rm(e.bw ? bw + (e.weight || 0) : e.weight, e.reps);
  const changes = [];
  for (const e of block.exercises) {
    const o = old.get(exKey(e.name));
    old.delete(exKey(e.name));
    if (!o) { changes.push({ kind: 'new', e }); continue; }
    if ((o.weight || 0) === (e.weight || 0) && o.reps === e.reps && !!o.bw === !!e.bw) continue;
    const a = est(o), b = est(e);
    changes.push({ kind: a != null && b != null ? (b > a + 0.01 ? 'up' : b < a - 0.01 ? 'down' : 'same') : 'same', e, o });
  }
  for (const o of old.values()) changes.push({ kind: 'removed', o });
  return changes;
}

function diffHtml(changes) {
  if (!changes) return '<div class="imp-diff"><span class="pill">nieuw schema</span></div>';
  if (!changes.length) return '<div class="imp-diff muted small">Geen wijzigingen t.o.v. je opgeslagen schema.</div>';
  const up = changes.filter((c) => c.kind === 'up').length;
  const sv = (e) => setText({ ...e, sets: null });
  const cnt = (k) => changes.filter((c) => c.kind === k).length;
  const sum = [[up, 'verbeterd'], [cnt('new'), 'nieuw'], [cnt('down'), 'lichter'], [cnt('same'), 'aangepast'], [cnt('removed'), 'weg']].filter(([n]) => n).map(([n, l]) => `${n} ${l}`);
  return `<div class="imp-diff"><div class="small"><b>${sum[0]}</b>${sum.length > 1 ? ` · ${sum.slice(1).join(' · ')}` : ''}</div>
    ${changes.map((c) => c.kind === 'new' ? `<div class="dl new">＋ ${esc(c.e.name)} <b>${esc(sv(c.e))}</b></div>`
      : c.kind === 'removed' ? `<div class="dl rem">− ${esc(c.o.name)}</div>`
      : `<div class="dl ${c.kind}">${c.kind === 'up' ? '▲' : c.kind === 'down' ? '▼' : '•'} ${esc(c.e.name)} <span class="muted">${esc(sv(c.o))} →</span> <b>${esc(sv(c.e))}</b></div>`).join('')}</div>`;
}

function viewImport() {
  const draft = S.importDraft;
  const existing = new Set(S.strength.sessions.filter((s) => !s.deleted).map((s) => `${s.date}|${(s.name || '').toLowerCase()}`));
  const mode = draft?.mode || 'templates';
  const tplMode = mode === 'templates';
  return `${navbar('Notitie plakken', '#/strength')}
  <div class="content fade-in">
  <p class="small muted" style="margin-top:0">Kopieer je notitie in Apple Notities (selecteer alles → Kopieer) en plak hem hieronder. Koppen als <code>Upper 6</code>, <code>Upper 7</code> en <code>Lower</code> worden schema's; regels als <code>Lat pulldown 87kg 8 reps</code> of <code>Hack squat 75kg 2 sets 6 reps</code> worden je topsets.</p>
  <textarea class="notes" id="notes" placeholder="Upper 6&#10;Lat pulldown 87kg 8 reps&#10;flat press machine 45kg 2 sets 8 reps&#10;&#10;Lower&#10;Hack squat 75kg 2 sets 6 reps&#10;...">${esc(draft?.text || '')}</textarea>
  <button class="btn mt" data-act="parse">Voorbeeld</button>
  ${draft?.result ? `
    <div class="section-title">${draft.result.sessions.length} ${draft.result.sessions.length === 1 ? 'blok' : 'blokken'} gevonden</div>
    <div class="segmented"><button class="${tplMode ? 'on' : ''}" data-act="imp-mode" data-v="templates">Als schema's</button><button class="${!tplMode ? 'on' : ''}" data-act="imp-mode" data-v="sessions">Als trainingen</button></div>
    <p class="small muted" style="margin:-4px 2px 12px">${tplMode ? 'Je huidige topsets worden de startwaarden van je schema\'s. Daarna start je een training vanuit het schema en vink je af wat je deed — je dag-strain krijgt dan je spierbelasting.' : 'Elk blok wordt een gelogde training op de gekozen datum en telt mee in de strain van die dag.'}</p>
    ${draft.result.sessions.map((s, i) => {
      const dup = tplMode ? !!findTemplate(S.strength, s.name) : existing.has(`${s.date}|${(s.name || '').toLowerCase()}`);
      return `<div class="card" style="padding:12px 14px">
        <div style="display:flex;gap:10px;align-items:center">
          <input type="checkbox" data-imp="${i}" checked style="width:20px;height:20px;flex-shrink:0">
          <input class="field" style="padding:8px 10px;font-size:15px;flex:1;min-width:0" data-imp-name="${i}" value="${esc(s.name)}">
          ${tplMode ? '' : `<input type="date" class="field" style="padding:8px 6px;font-size:14px;width:150px" data-imp-date="${i}" value="${esc(s.date || '')}" max="${today()}">`}
        </div>
        ${!tplMode && !s.date ? '<div class="small" style="color:var(--yellow);margin-top:6px">Geen datum gevonden — vul hem in.</div>' : ''}
        ${tplMode ? diffHtml(templateDiff(s)) : dup ? `<div class="small" style="color:var(--yellow);margin-top:6px">Lijkt al te bestaan (zelfde datum en naam).</div>` : ''}
        <div class="small muted" style="margin-top:8px;line-height:1.7">${s.exercises.map((e) => `${esc(e.name)} <b style="color:var(--text)">${esc(setText(e))}</b> <span class="tiny">(${esc(matchExercise(e.name, S.strength.exerciseMap).name)})</span>`).join('<br>')}</div>
      </div>`;
    }).join('')}
    ${draft.result.skipped.length ? `<details class="card small"><summary class="muted">${draft.result.skipped.length} regels niet herkend</summary><pre class="raw">${esc(draft.result.skipped.join('\n'))}</pre></details>` : ''}
    ${tplMode && draft.result.sessions.some((s) => (templateDiff(s) || []).some((c) => c.kind === 'up' || c.kind === 'down' || c.kind === 'same')) ? `<div class="card imp-log"><label class="imp-log-row"><input type="checkbox" id="imp-log" checked><div><b>Ook loggen als training</b><div class="small muted">Elk gewijzigd schema wordt een training op deze datum, zodat je spierbelasting en PR's kloppen.</div></div></label><input type="date" class="field" id="imp-log-date" value="${today()}" max="${today()}"></div>` : ''}
    ${draft.result.sessions.length ? `<button class="btn" data-act="do-import">${tplMode ? 'Schema\'s opslaan' : 'Trainingen importeren'}</button>` : ''}
  ` : ''}
  </div>`;
}

function viewSettings() {
  const st = S.settings;
  const u = auth.getUser();
  const demo = store.isDemo();
  const log = S.syncLog;
  const row = (label, input, sub = '') => `<div class="row"><div class="grow">${label}${sub ? `<div class="sub">${sub}</div>` : ''}</div>${input}</div>`;
  const numIn = (k, v, ph = '', step = 1) => `<input type="number" inputmode="decimal" step="${step}" data-set="${k}" value="${v ?? ''}" placeholder="${ph}">`;
  return `${largeTitle('Profiel')}
  <div class="fade-in">
  <div class="list">
    ${demo ? `<div class="row"><div class="badge" style="background:var(--muscle)">${I.info}</div><div class="grow"><div class="title">Demomodus</div><div class="sub">Je ziet voorbeelddata</div></div><button class="btn small" data-act="demo-off">Stop</button></div>`
      : u ? `<div class="row"><img class="avatar" src="${esc(u.picture || '')}" alt="" referrerpolicy="no-referrer" onerror="this.style.visibility='hidden'"><div class="grow"><div class="title">${esc(u.name || 'Google-account')}</div><div class="sub">${esc(u.email || '')}</div></div></div>`
        : `<button class="row tap" data-act="login"><div class="badge" style="background:#fff">${I.google}</div><div class="grow"><div class="title">Inloggen met Google</div></div><span class="chev">${I.chev}</span></button>`}
    ${!demo ? `<button class="row tap" data-act="sync"><div class="badge" style="background:var(--accent)">${I.sync}</div><div class="grow"><div class="title">Nu synchroniseren</div><div class="sub">${S.lastSyncAt ? fmtRel(S.lastSyncAt) : 'nog nooit'}</div></div></button>
    <button class="row tap" data-act="full-sync"><div class="badge" style="background:var(--card2);color:var(--text)">${I.download}</div><div class="grow"><div class="title">Alles opnieuw ophalen</div><div class="sub">laatste 45 dagen</div></div></button>
    <button class="row tap" data-go="#/live"><div class="badge" style="background:var(--hr)">${I.heart}</div><div class="grow"><div class="title">Live hartslag</div><div class="sub">${liveState.state === 'live' ? `realtime via ${esc(liveState.deviceName || 'Bluetooth')}` : 'elke minuut ververst · Bluetooth voor realtime'}</div></div><span class="chev">${I.chev}</span></button>
    <button class="row tap" data-act="drive-login"><div class="badge" style="background:var(--green)">${I.upload}</div><div class="grow"><div class="title">Back-up krachtlog (Google Drive)</div><div class="sub">${auth.getToken('drive') ? 'verbonden' : 'tik om te verbinden'}</div></div></button>` : ''}
  </div>
  ${log ? `<div class="list-header">Laatste synchronisatie</div><div class="list">${log.log.map((l) => `<div class="row"><div class="grow"><div class="title" style="font-size:15px">${esc(l.label)}</div>${l.error ? `<div class="sub" style="color:var(--red);white-space:normal">${esc(l.status ? `${l.status}: ` : '')}${esc(l.error)}</div>` : ''}</div><div class="val">${l.ok ? `<span class="up">${I.check.replace('<svg', '<svg width="16" height="16"')}</span> ${l.count ?? ''}` : '<span class="down">mislukt</span>'}</div></div>`).join('')}</div><div class="list-footer">${new Date(log.at).toLocaleString('nl-NL')} · ${log.from} t/m ${log.to} · ${Math.round(log.ms / 1000)} s</div>` : ''}

  <div class="list-header">Persoonlijk</div>
  <div class="list">
    ${row('Leeftijd', numIn('age', st.age, S.profile?.age ? String(S.profile.age) : '30'), S.profile?.age && !st.age ? 'uit je Google-profiel' : '')}
    ${row('Geslacht', `<select data-set="sex"><option value="m" ${st.sex === 'm' ? 'selected' : ''}>Man</option><option value="v" ${st.sex === 'v' ? 'selected' : ''}>Vrouw</option></select>`, 'voor de TRIMP-formule')}
    ${row('Lichaamsgewicht', numIn('bodyweight', st.bodyweight, '80', 0.5) + '<span class="muted">&nbsp;kg</span>', 'voor bodyweight-oefeningen')}
    ${row('Max. hartslag', numIn('maxHr', st.maxHr, String(S.computed?.maxHr || ''), 1), st.maxHr ? 'handmatig' : `automatisch: ${S.computed?.maxHr}`)}
  </div>
  <div class="list-header">Slaap</div>
  <div class="list">
    ${row('Basis slaapbehoefte', `<input type="number" step="0.25" inputmode="decimal" data-set="sleepNeedH" value="${(st.sleepNeed / 60).toFixed(2).replace(/\.?0+$/, '')}"><span class="muted">&nbsp;uur</span>`)}
    ${row('Wektijd', `<input type="time" data-set="wake" value="${esc(st.wake)}">`, 'voor bedtijd-advies')}
  </div>
  <div class="list-header">Kracht</div>
  <div class="list">
    ${row('Zware sets per oefening', numIn('defaultSets', st.defaultSets, '3'), 'je noteert alleen je topset; dit schat het totaal')}
    ${row('Rusttimer', `<select data-set="restSec">${[[0, 'Uit'], [60, '1:00'], [90, '1:30'], [120, '2:00'], [150, '2:30'], [180, '3:00'], [240, '4:00']].map(([v, l]) => `<option value="${v}" ${(st.restTimer === false ? 0 : (st.restSec || 150)) === v ? 'selected' : ''}>${l}</option>`).join('')}</select>`, 'start bij afvinken tijdens een training, met piepje')}
  </div>
  <div class="list-header">Weergave</div>
  <div class="list">${row('Thema', `<select data-set="theme"><option value="auto" ${st.theme === 'auto' ? 'selected' : ''}>Automatisch</option><option value="dark" ${st.theme === 'dark' ? 'selected' : ''}>Donker</option><option value="light" ${st.theme === 'light' ? 'selected' : ''}>Licht</option></select>`)}
    ${row('Kleuren', `<select data-set="palette"><option value="standard" ${st.palette !== 'cb' ? 'selected' : ''}>Standaard</option><option value="cb" ${st.palette === 'cb' ? 'selected' : ''}>Kleurenblind</option></select>`, 'herstel in blauw · geel · oranje')}
    ${row('Herstel op app-icoon', `<label class="switch"><input type="checkbox" data-set="badge" ${st.badge ? 'checked' : ''}><span></span></label>`, 'navigator' in window && 'setAppBadge' in navigator ? 'vraagt toestemming voor meldingen (nodig voor badges op iPhone)' : 'werkt als Pulse op je beginscherm staat (iOS 16.4+)')}
    ${row('Ochtendrapport', `<label class="switch"><input type="checkbox" data-set="morning" ${st.morning !== false ? 'checked' : ''}><span></span></label>`, 'automatisch bij de eerste keer openen')}
    <button class="row tap" data-act="whats-new"><div class="grow">Wat is nieuw</div><span class="muted">${APP_VERSION}</span><span class="chev">${I.chev}</span></button></div>

  <div class="list-header">Data</div>
  <div class="list">
    <button class="row tap" data-act="share-claude"><div class="badge" style="background:var(--accent)">${I.doc}</div><div class="grow"><div class="title">Deel met Claude</div><div class="sub">Kopieert een anonieme samenvatting van 14 dagen</div></div><span class="chev">${I.chev}</span></button>
    <button class="row tap" data-act="export"><div class="grow">Exporteer back-up (JSON)</div><span class="chev">${I.chev}</span></button>
    <button class="row tap" data-act="export-csv"><div class="grow">Exporteer als CSV<div class="sub">voor Numbers of Excel: alle dagen en al je topsets</div></div><span class="chev">${I.chev}</span></button>
    <label class="row tap"><div class="grow">Importeer back-up</div><input type="file" accept="application/json,.json" data-act="import-backup" style="display:none"><span class="chev">${I.chev}</span></label>
    <button class="row tap" data-go="#/setup"><div class="grow">Koppeling (Google Client ID)</div><span class="chev">${I.chev}</span></button>
    <button class="row tap" data-go="#/about"><div class="grow">Hoe worden scores berekend?</div><span class="chev">${I.chev}</span></button>
  </div>
  <div class="list-footer">Je krachtlog wordt na inloggen automatisch bewaard in een verborgen map in je eigen Google Drive, zodat hij niet verloren gaat.</div>
  <div class="list">
    ${!demo ? `<button class="row tap" data-act="demo-on"><div class="grow" style="color:var(--accent)">Demodata bekijken</div></button>` : ''}
    ${u && !demo ? `<button class="row tap" data-act="logout"><div class="grow" style="color:var(--red)">Uitloggen</div></button>` : ''}
    <button class="row tap" data-act="wipe"><div class="grow" style="color:var(--red)">Gezondheidsdata op dit toestel wissen</div></button>
  </div>
  <p class="center tiny muted">Pulse · persoonlijke app · data blijft op je toestel en in je eigen Google-account</p>
  </div>`;
}

function viewAbout() {
  return `${navbar('Berekeningen', '#/settings')}
  <div class="content fade-in">
  <div class="card"><h2 style="color:var(--green)">Herstel (0–100%)</h2>
  <p class="small">Elke ochtend vergelijken we je nachtelijke <b>HRV</b> (RMSSD), <b>rusthartslag</b> tijdens non-REM-slaap, <b>slaapprestatie</b>, <b>ademhalingsfrequentie</b> en <b>huidtemperatuur</b> met je eigen gemiddelde van de afgelopen 30 dagen. HRV telt voor 50%, rusthartslag en slaap elk 20%, ademhaling en temperatuur elk 5%. De gewogen z-score wordt omgezet naar een percentage: groen 67–100, geel 34–66, rood 0–33. De eerste 4 nachten is de app aan het kalibreren.</p></div>
  <div class="card"><h2 style="color:var(--strain)">Strain (0–21)</h2>
  <p class="small">Voor elke minuut dat je wakker bent berekenen we je inspanning als percentage van je <b>hartslagreserve</b> (tussen rust- en maximale hartslag) en tellen die op met de Banister-TRIMP-formule; hogere intensiteit telt exponentieel zwaarder. Daar komt je <b>spierbelasting</b> uit je krachtlog bij. Het totaal gaat op een logaritmische schaal: van 0 naar 10 is makkelijk, van 18 naar 21 bijna onmogelijk. Licht &lt;10, gemiddeld 10–14, zwaar 14–18, maximaal 18+.</p>
  <p class="small">Je <b>optimale strain</b> hangt af van je herstel: hoe beter hersteld, hoe meer belasting je lichaam aankan.</p></div>
  <div class="card"><h2 style="color:var(--muscle)">Spierbelasting</h2>
  <p class="small">Per oefening: <i>sets × lichaamsbelasting van de oefening × intensiteit × rep-factor</i>. De intensiteit is je geschatte 1RM (Epley: gewicht × (1 + reps/30)) gedeeld door je beste 1RM op die oefening. Grote oefeningen (leg press, hack squat, rows) wegen zwaarder dan isolatie (curls, lateral raises). Omdat je alleen je topset noteert, gebruiken we het aantal sets uit je notitie (bijv. “2 sets”), anders ${S.settings.defaultSets} zware sets per oefening. Elke punt spierbelasting telt als 3,2 belastingspunten in je dag-strain.</p></div>
  <div class="card"><h2 style="color:var(--sleep)">Slaap</h2>
  <p class="small"><b>Slaapbehoefte</b> = basisbehoefte (${fmtHM(S.settings.sleepNeed)}) + extra door de strain van gisteren (tot 40 min) + slaapschuld van de afgelopen nachten − dutjes. <b>Slaapprestatie</b> = geslapen ÷ behoefte. Daarnaast: efficiëntie (geslapen ÷ in bed), consistentie (hoe constant je bed- en wektijden zijn) en herstellende slaap (diep + REM).</p></div>
  <div class="card"><h2 style="color:var(--hr)">Live hartslag</h2>
  <p class="small">Zolang de app open is, haalt Pulse <b>elke minuut</b> je nieuwste hartslag op uit Google Health en elke 5 minuten de rest van vandaag. Hoe vers dat is, hangt af van hoe vaak de Google Health-app met je Fitbit Air synchroniseert. Voor <b>echte realtime</b> verbind je de Fitbit Air via Bluetooth (Hartslag delen); dan zie je elke hartslag, je live HRV (RMSSD uit de RR-intervallen) en de strain van je sessie.</p></div>
  <div class="card"><h2 style="color:var(--muscle)">Activiteiten &amp; RPE-ijking</h2>
  <p class="small">Een gelogde activiteit telt met <b>gemeten hartslag</b> als die minstens 80% van de tijd beschikbaar is. Anders schatten we de intensiteit uit het type (MET-waarden uit het Compendium) en hoe zwaar het voelde (RPE 0–10). Fysiek werk krijgt daarnaast spierbelasting (sessie-RPE × minuten), omdat hartslag dat mist.</p>
  <p class="small">${(() => { const c = S.computed?.rpeCal || {}; const f = (k, l) => c[k]?.n >= 3 ? `${l}: ${Math.abs(Math.round((c[k].scale - 1) * 100)) < 3 ? 'je hartslag past precies bij je RPE' : `je hartslag ligt gemiddeld ${Math.abs(Math.round((c[k].scale - 1) * 100))}% ${c[k].scale > 1 ? 'hoger' : 'lager'} dan je RPE doet verwachten`} (${c[k].n} metingen)` : `${l}: nog ${3 - (c[k]?.n || 0)} activiteit${3 - (c[k]?.n || 0) === 1 ? '' : 'en'} met RPE én hartslag nodig`; return `<b>Persoonlijke ijking</b> — ${f('sport', 'sport')}; ${f('werk', 'werk/klussen')}. Daarmee worden schattingen zonder hartslag nauwkeuriger.`; })()}</p></div>
  <p class="tiny muted center">Geïnspireerd op hoe WHOOP data interpreteert; de exacte formules van WHOOP zijn niet openbaar, dit is een eigen benadering.</p>
  </div>`;
}

// ---------------------------------------------------------------- context

function latestWeight() {
  const ws = (S.strength.weights || []).filter((w) => !w.deleted && w.kg).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (a.updatedAt || 0) - (b.updatedAt || 0)));
  return ws.length ? ws[ws.length - 1] : null;
}
function userAge() { return S.settings.age || S.profile?.age || null; }
function hsCtx() { return { age: userAge(), sex: S.settings.sex, maxHr: S.computed.maxHr }; }
let HS_CACHE = null;
function healthspan() {
  if (HS_CACHE && HS_CACHE.c === S.computed) return HS_CACHE;
  const ctx = hsCtx();
  HS_CACHE = { c: S.computed, hs: computeHealthspan(S.computed.byDate, today(), ctx), hist: ctx.age ? healthspanHistory(S.computed.byDate, today(), ctx) : [] };
  return HS_CACHE;
}
const yrs = (v, d = 1) => (v == null ? '–' : num(Math.abs(v), d));

function actIcon(t) { return AI[t.icon] || AI.flame; }

// ---------------------------------------------------------------- belastingsband

function loadSeries(end, n = 42) {
  const all = lastDays(S.computed.byDate, end, n + 27);
  const daily = all.map((d) => (d.raw || d.strain?.sessions?.length || d.strain?.manual?.length ? d.strain?.trimp || 0 : null));
  const pts = [];
  for (let i = 27; i < all.length; i++) {
    const w7 = daily.slice(i - 6, i + 1).filter((v) => v != null);
    const w28 = daily.slice(i - 27, i + 1).filter((v) => v != null);
    const acute = w7.length >= 4 ? mean(w7) : null;
    const chronic = w28.length >= 14 ? mean(w28) : null;
    pts.push({ date: all[i].date, daily: daily[i], acute, chronic, lo: chronic != null ? chronic * 0.8 : null, hi: chronic != null ? chronic * 1.3 : null });
  }
  return pts;
}

function loadStatus(p) {
  if (!p || p.acute == null || p.chronic == null || !p.chronic) return { label: 'Nog aan het leren', text: 'Na ±2 weken data zie je hier of je belasting in balans is.', color: 'var(--text3)' };
  const r = p.acute / p.chronic;
  if (r < 0.8) return { r, label: 'Onder je normaal', text: 'Je doet deze week minder dan je gewend bent. Prima als rustweek; anders is er ruimte voor meer.', color: 'var(--z1)' };
  if (r <= 1.3) return { r, label: 'In balans', text: 'Je belasting zit binnen je duurzame bereik: genoeg prikkel om fitter te worden, zonder overbelasting.', color: 'var(--green)' };
  if (r <= 1.5) return { r, label: 'Hoog', text: 'Je doet duidelijk meer dan normaal. Plan herstel en let op je slaap en HRV.', color: 'var(--yellow)' };
  return { r, label: 'Te veel', text: 'Je belasting ligt ver boven je normaal: grotere kans op blessures en slecht herstel. Bouw rustiger op.', color: 'var(--red)' };
}

/**
 * Vroeg signaal van overbelasting: HRV ligt meerdere dagen op rij duidelijk onder je normaal
 * (en/of rusthartslag erboven), vaak samen met een hoge belasting.
 */
function strainSignal(date = today()) {
  const ds = lastDays(S.computed.byDate, date, 7).filter((d) => d.recovery && d.flag !== 'sick');
  if (ds.length < 4) return null;
  let streak = 0;
  for (let i = ds.length - 1; i >= 0; i--) {
    const r = ds[i].recovery;
    const low = (r.hrv && r.baseline.hrv && r.hrv < r.baseline.hrv * 0.93) || (r.rhr && r.baseline.rhr && r.rhr > r.baseline.rhr + 3);
    if (low) streak++; else break;
  }
  if (streak < 3) return null;
  const pts = loadSeries(date, 1);
  const st = loadStatus(pts[pts.length - 1]);
  const high = st.r != null && st.r > 1.15;
  const hrvs = ds.slice(-streak).map((d) => d.recovery.hrv / d.recovery.baseline.hrv).filter((x) => x);
  const pct = hrvs.length ? Math.round((1 - mean(hrvs)) * 100) : null;
  return {
    streak, high,
    text: `${streak} dagen op rij ${pct > 0 ? `HRV gemiddeld ${pct}% onder je normaal` : 'verhoogde rusthartslag'}${high ? ' terwijl je belasting hoger is dan normaal' : ''}. ${high ? 'Signaal van overbelasting: plan 1–2 lichte dagen en slaap extra.' : 'Kan wijzen op stress, slecht slapen of beginnende ziekte. Doe het rustiger aan.'}`,
  };
}

function loadBandCard(end = today()) {
  const pts = loadSeries(end);
  const last = pts[pts.length - 1];
  const st = loadStatus(last);
  const fmtS = (v) => fmtStrain(strainFromTrimp(v));
  return `<div class="card trend">
    <div class="trend-head"><div><div class="trend-t">Belastingsband · 7 vs 28 dagen</div>
      <div class="trend-v" style="color:${st.color}">${st.label}${st.r ? `<small>${num(st.r * 100)}% van normaal</small>` : ''}</div>
      <div class="trend-s">${last?.acute != null ? `Week-gemiddelde strain ${fmtS(last.acute)} · jouw normaal ${fmtS(last.lo)}–${fmtS(last.hi)}` : ''}</div></div></div>
    ${loadBand(pts, { fmt: fmtS })}
    <div class="legend"><span><i style="background:var(--band-strong)"></i>duurzaam bereik</span><span><i style="background:var(--strain)"></i>7-daags gemiddelde</span><span><i style="background:var(--track)"></i>per dag</span></div>
    <p class="small muted" style="margin:8px 0 0">${st.text}</p>
  </div>`;
}

let PAT_CACHE = null;
function patterns() {
  if (PAT_CACHE?.c === S.computed) return PAT_CACHE.v;
  PAT_CACHE = { c: S.computed, v: recoveryPatterns(S.computed.byDate, today()) };
  return PAT_CACHE.v;
}

function patternsCard({ limit = 6 } = {}) {
  const { list, pairs } = patterns();
  const ok = list.filter((x) => x.enough);
  if (!ok.length) return `<div class="card"><div class="card-head"><span class="t">Wat beïnvloedt jouw herstel</span></div><p class="small muted" style="margin:0">Na ±3 weken data zie je hier automatisch wat jouw herstel omhoog of omlaag duwt — zonder dagboek. Nu: ${pairs} dagen.</p></div>`;
  const max = Math.max(5, ...ok.map((x) => Math.abs(x.diff)));
  return `<div class="card pat">
    <div class="card-head"><span class="t">Wat beïnvloedt jouw herstel</span><button class="link-btn small" data-sheet="patterns:about">Hoe?</button></div>
    ${ok.slice(0, limit).map((x) => {
      const up = x.diff > 0;
      const w = Math.min(50, (Math.abs(x.diff) / max) * 50);
      return `<div class="pat-row ${x.strength === 'onzeker' ? 'weak' : ''}">
        <div class="pat-top"><span class="pat-l">${esc(x.label)}</span><span class="pat-v ${up ? 'up' : 'down'}">${up ? '+' : '−'}${num(Math.abs(x.diff), 0)}%</span></div>
        <div class="pat-bar"><span class="pat-mid"></span><span class="pat-fill ${up ? 'good' : 'bad'}" style="${up ? `left:50%;width:${w}%` : `left:${50 - w}%;width:${w}%`}"></span></div>
        <div class="pat-sub">${esc(x.strength)} · ${x.nYes}× wel, ${x.nNo}× niet${x.hrvPct != null ? ` · HRV ${x.hrvPct > 0 ? '+' : '−'}${num(Math.abs(x.hrvPct), 0)}%` : ''}</div>
      </div>`;
    }).join('')}
    <p class="tiny muted" style="margin:8px 0 0">Herstel de ochtend erna, vergeleken met dagen zonder. Verbanden uit je eigen data; geen bewijs van oorzaak.</p>
  </div>`;
}

// ---------------------------------------------------------------- ochtendrapport

/** Eén zin die uitlegt waarom je herstel is wat het is. */
function recoveryVerdict(m) {
  const r = m?.recovery;
  if (!r) return '';
  const parts = [
    { k: 'hrv', z: r.z.hrv * r.weights.hrv, txt: r.hrv && r.baseline.hrv ? `je HRV ${Math.abs(Math.round((r.hrv / r.baseline.hrv - 1) * 100))}% ${r.hrv >= r.baseline.hrv ? 'boven' : 'onder'} je normaal ligt` : null },
    { k: 'rhr', z: r.z.rhr * r.weights.rhr, txt: r.rhr && r.baseline.rhr ? (Math.abs(r.rhr - r.baseline.rhr) < 1 ? 'je rusthartslag normaal is' : `je rusthartslag ${Math.abs(Math.round(r.rhr - r.baseline.rhr))} ${Math.abs(Math.round(r.rhr - r.baseline.rhr)) === 1 ? 'slag' : 'slagen'} ${r.rhr > r.baseline.rhr ? 'hoger' : 'lager'} is dan normaal`) : null },
    { k: 'sleep', z: r.z.sleep * r.weights.sleep, txt: m.sleep ? `je ${fmtHM(m.sleep.asleep)} sliep van de ${fmtHM(m.sleep.need)} die je nodig had` : null },
  ].filter((x) => x.txt).sort((a, b) => Math.abs(b.z) - Math.abs(a.z));
  if (!parts.length) return '';
  const a = parts[0];
  const counter = parts.slice(1).find((x) => Math.sign(x.z) !== Math.sign(a.z) && Math.abs(x.z) > 0.15);
  const along = parts.slice(1).find((x) => Math.sign(x.z) === Math.sign(a.z) && Math.abs(x.z) > 0.1);
  if (counter) return `Vooral omdat ${a.txt}, ook al ${counter.txt}.`;
  return `Vooral omdat ${a.txt}${along ? ` en ${along.txt}` : ''}.`;
}

/** Kenmerken van gisteren die volgens jouw patronen je herstel van vandaag raken. */
function yesterdayEffects(date) {
  const d = M(date), p = M(addDays(date, -1));
  if (!d || !p) return [];
  return patterns().list.filter((f) => f.enough && f.strength !== 'onzeker' && Math.abs(f.diff) >= 3).filter((f) => { try { return f.test(p, d, { medBed: null }) === true; } catch { return false; } }).slice(0, 2);
}

function morningSheet(date = today()) {
  const m = M(date);
  const r = m?.recovery, sl = m?.sleep;
  const zone = recoveryZone(r?.score);
  const color = recoveryColor(r?.score);
  const hour = new Date().getHours();
  const hello = hour < 6 ? 'Vroeg op' : hour < 12 ? 'Goedemorgen' : hour < 18 ? 'Goedemiddag' : 'Goedenavond';
  const tpls = activeTemplates(S.strength);
  const rec = recommendTraining({ templates: tpls, sessions: S.strength.sessions, fatigue: currentFatigue(), recovery: r?.score ?? null, today: date, settings: SS(), doneToday: (m?.strain?.sessions?.length || 0) > 0, flag: m?.flag });
  const adv = bedtimeAdvice(m, toMin(S.settings.wake));
  const eff = yesterdayEffects(date);
  const y = M(addDays(date, -1));
  const zoneTxt = { green: 'Klaar om te presteren', yellow: 'Redelijk hersteld', red: 'Rust gaat voor' }[zone] || 'Nog geen herstel';
  const row = (label, val, sub, delta) => `<div class="mr-row"><div><div class="mr-l">${label}</div>${sub ? `<div class="mr-s">${sub}</div>` : ''}</div><div class="mr-v">${val}${delta || ''}</div></div>`;
  const dlt = (v, base, higher, unit = '', digits = 0) => {
    if (v == null || base == null) return '';
    const d = v - base;
    if (Math.abs(d) < Math.pow(10, -digits) / 2) return '<span class="mr-d">=</span>';
    const good = higher ? d > 0 : d < 0;
    return `<span class="mr-d ${good ? 'up' : 'down'}">${d > 0 ? '▲' : '▼'}${num(Math.abs(d), digits)}${unit}</span>`;
  };
  return `<div class="morning">
    <div class="mr-hero" style="--zc:${color}">
      <div class="eyebrow">${hello} · ${esc(fmtDateLong(date))}</div>
      <div class="mr-big">${r ? r.score : '–'}<small>%</small></div>
      <div class="mr-zone"><span class="zshape z-${zone}"></span>${zoneTxt}</div>
      ${r ? `<p class="mr-why">${esc(recoveryVerdict(m))}</p>` : '<p class="mr-why">Zodra je Fitbit je slaap heeft doorgestuurd, verschijnt hier je herstel.</p>'}
    </div>
    ${m?.flag === 'sick' ? '<div class="mr-note">Ziek-modus staat aan. Beterschap!</div>' : ''}
    ${r ? `<div class="mr-sec">Hersteldata</div><div class="card flat mr-card">
      ${row('HRV', `${num(r.hrv)} <small>ms</small>`, `normaal ${num(r.baseline.hrv)} ms`, dlt(r.hrv, r.baseline.hrv, true))}
      ${row('Rusthartslag', `${num(r.rhr)} <small>bpm</small>`, `normaal ${num(r.baseline.rhr)} bpm`, dlt(r.rhr, r.baseline.rhr, false))}
      ${r.resp != null ? row('Ademhaling', `${num(r.resp, 1)} <small>/min</small>`, `normaal ${num(r.baseline.resp, 1)}`, dlt(r.resp, r.baseline.resp, false, '', 1)) : ''}
      ${r.tempDev != null ? row('Huidtemperatuur', `${r.tempDev >= 0 ? '+' : ''}${num(r.tempDev, 1)} <small>°C</small>`, 't.o.v. normaal', '') : ''}
    </div>` : ''}
    ${sl ? `<div class="mr-sec">Vannacht</div><div class="card flat mr-card">
      <div class="mr-sleep"><div><b>${fmtHM(sl.asleep)}</b><span>geslapen</span></div><div><b>${clockTxt(sleepSpan(sl.start, sl.end)[0])}–${clockTxt(sleepSpan(sl.start, sl.end)[1])}</b><span>in bed</span></div><div><b>${Math.round((sl.perf || 0) * 100)}%</b><span>van je behoefte</span></div></div>
      ${stackBar([{ value: sl.deep || 0, color: 'var(--st-deep)', label: 'diep' }, { value: sl.rem || 0, color: 'var(--st-rem)', label: 'REM' }, { value: Math.max(0, sl.asleep - (sl.deep || 0) - (sl.rem || 0)), color: 'var(--st-light)', label: 'licht' }, { value: sl.awake || 0, color: 'var(--st-awake)', label: 'wakker' }], { height: 12 })}
      <div class="legend"><span><i style="background:var(--st-deep)"></i>diep ${fmtHM(sl.deep || 0)}</span><span><i style="background:var(--st-rem)"></i>REM ${fmtHM(sl.rem || 0)}</span>${sl.need - sl.asleep > 15 ? `<span>tekort ${fmtHM(sl.need - sl.asleep)}</span>` : ''}</div>
    </div>` : ''}
    ${eff.length || y?.strain?.score ? `<div class="mr-sec">Gisteren</div><div class="card flat mr-card">
      ${y?.strain ? row('Strain', fmtStrain(y.strain.score), [(y.strain.sessions || []).map((x) => x.name).join(', '), (y.strain.manual || []).map((a) => typeById(a.typeId).name.toLowerCase()).join(', ')].filter(Boolean).join(' · ') || (y.raw?.steps ? `${num(y.raw.steps)} stappen` : ''), '') : ''}
      ${eff.map((f) => `<div class="mr-eff"><span class="${f.diff > 0 ? 'up' : 'down'}">${f.diff > 0 ? '▲' : '▼'} ${num(Math.abs(f.diff), 0)}%</span> ${esc(f.label)} — bij jou gemiddeld ${f.diff > 0 ? 'hoger' : 'lager'} herstel de dag erna</div>`).join('')}
    </div>` : ''}
    <div class="mr-sec">Plan voor vandaag</div><div class="card flat mr-card">
      ${rec ? `<div class="mr-plan"><b>${esc(rec.title)}</b>${rec.intensity ? ` <span class="pill">${rec.intensity}</span>` : ''}<div class="small muted">${esc(rec.reason)}</div></div>` : ''}
      <div class="mr-chips">${m?.target ? `<div><span>Strain-doel</span><b>${fmtStrain(m.target[0])}–${fmtStrain(m.target[1])}</b></div>` : ''}${adv ? `<div><span>Vanavond naar bed</span><b>${fmtHM(adv.bed)}</b></div>` : ''}</div>
      ${rec?.kind === 'template' ? `<button class="btn mt" data-act="start-template" data-id="${rec.template.id}">Start ${esc(rec.template.name)}</button>` : ''}
    </div>
    <button class="btn secondary mt" data-act="close-sheet">Begin je dag</button>
  </div>`;
}

/** Toon het ochtendrapport één keer per dag, zodra er herstel is (vóór 14:00). */
function maybeMorning() {
  try {
    if (S.settings.morning === false || isSheetOpen() || parseRoute().name !== 'today' || (parseRoute().a && parseRoute().a !== today())) return;
    if (new Date().getHours() >= 14 || !M(today())?.recovery) return;
    if (localStorage.getItem('pulse.morning') === today()) return;
    localStorage.setItem('pulse.morning', today());
    openSheet(morningSheet());
  } catch { /* */ }
}

function patternsAboutSheet() {
  return `<div class="sh-head"><div class="eyebrow">Uitleg</div><h2>Jouw patronen</h2></div>
  <div class="card flat mt small"><p style="margin-top:0">Voor elk kenmerk (bijv. "minder dan 7 uur geslapen" of "benen getraind") vergelijkt de app je herstel op de ochtend erna met de ochtenden waarop dat niet zo was, over de laatste 4 maanden.</p>
  <p>Het percentage is het verschil in herstelpunten. <b>Duidelijk</b> = statistisch sterk (t ≥ 2,5), <b>waarschijnlijk</b> = redelijk, <b>onzeker</b> = kan toeval zijn. Een kenmerk verschijnt pas als het minstens 4× wel en 4× niet voorkwam.</p>
  <p style="margin-bottom:0">Let op: dingen hangen samen. Op gymdagen slaap je misschien ook korter. Gebruik het als aanwijzing, niet als harde regel.</p></div>`;
}

function currentFatigue() {
  const sessions = S.strength.sessions.filter((s) => !s.deleted).map((s) => { const m = S.computed.byDate[s.date]?.strain?.sessions?.find((x) => x.id === s.id); return m?.activity ? { ...s, activity: m.activity } : s; });
  return muscleFatigue(sessions, S.computed.loads).fatigue;
}

/** Wat moet je nog doen om je strain-doel te halen (of: zit je er al boven)? */
function strainToGo(m) {
  const tgt = m?.target, st = m?.strain;
  if (!tgt || !st) return null;
  const sc = st.score || 0;
  if (sc > tgt[1] + 0.3) return { kind: 'over', text: `Je zit ${fmtStrain(sc - tgt[1])} boven je doel — houd de rest van de dag rustig.` };
  if (sc >= tgt[0]) return { kind: 'in', text: 'Je zit binnen je strain-doel. Lekker bezig!' };
  if (new Date().getHours() >= 22) return null;
  const need = trimpForStrain(tgt[0]) - (st.trimp || 0);
  const fem = S.settings.sex === 'v';
  const opts = [['stevig wandelen', 0.38], ['zone 2 (fietsen, rustig joggen)', 0.62], ['hardlopen', 0.78]];
  const mins = opts.map(([l, h]) => [l, Math.max(5, Math.round(need / trimpPerMinute(h, fem) / 5) * 5)]);
  return { kind: 'under', need: tgt[0] - sc, mins, text: `Nog ${fmtStrain(tgt[0] - sc)} tot je doel: ±${mins[0][1]} min ${mins[0][0]} of ${mins[1][1]} min ${mins[1][0].split(' (')[0]}.` };
}

// ---------------------------------------------------------------- weekdoelen

const GOALS = [
  { key: 'strength', label: 'Kracht', unit: 'x', color: 'var(--muscle)', fmt: (v) => num(v), goalFmt: (g) => `${g}×`, sum: true },
  { key: 'mvpa', label: 'Beweging', unit: 'min', color: 'var(--strain)', fmt: (v) => num(v), goalFmt: (g) => `${g} min`, sum: true },
  { key: 'sleep', label: 'Slaap', unit: '', color: 'var(--sleep)', fmt: (v) => fmtHM(v), goalFmt: (g) => fmtHM(g) },
  { key: 'steps', label: 'Stappen', unit: '', color: 'var(--green)', fmt: (v) => (v >= 1000 ? `${num(v / 1000, 1)}k` : num(v)), goalFmt: (g) => `${num(g / 1000, 1).replace(/,0$/, '')}k` },
];

function goalsOf() { return { ...DEFAULTS.goals, ...(S.settings.goals || {}) }; }

let WGV_CACHE = { c: null, m: new Map() };
function weekGoalValues(start) {
  if (WGV_CACHE.c !== S.computed) WGV_CACHE = { c: S.computed, m: new Map() };
  if (WGV_CACHE.m.has(start)) return WGV_CACHE.m.get(start);
  const v = weekGoalValuesRaw(start);
  WGV_CACHE.m.set(start, v);
  return v;
}

function weekGoalValuesRaw(start) {
  const end = addDays(start, 6) > today() ? today() : addDays(start, 6);
  const days = [];
  for (let d = start; d <= end; d = addDays(d, 1)) days.push(M(d) || { date: d });
  const strength = days.reduce((a, d) => a + (d.strain?.sessions?.length || 0) + (d.strain?.manual || []).filter((x) => typeById(x.typeId).id === 'kracht').length, 0);
  const mvpa = days.reduce((a, d) => a + (d.strain?.mvpa || 0), 0);
  const sl = days.map((d) => d.sleep?.asleep).filter((v) => v != null);
  const st = days.filter((d) => d.date < today() || days.length === 1).map((d) => d.raw?.steps).filter((v) => v != null);
  return { strength, mvpa, sleep: sl.length ? mean(sl) : null, steps: st.length ? mean(st) : null, n: days.length };
}

function goalMet(key, v, g) { return v != null && v >= g - (key === 'sleep' ? 0.5 : 0); }

/** Hoeveel weken op rij (vóór deze week) haalde je dit doel? Deze week telt mee als hij al gehaald is. */
function goalStreak(key) {
  const g = goalsOf()[key];
  let n = 0;
  const cur = weekStartOf(today());
  if (goalMet(key, weekGoalValues(cur)[key], g)) n++;
  for (let w = 1; w < 52; w++) {
    const st = addDays(cur, -7 * w);
    if (st < (S.days[0]?.date || today())) break;
    if (goalMet(key, weekGoalValues(st)[key], g)) n++; else break;
  }
  return n;
}

function goalsCard(start = weekStartOf(today()), { compact = false } = {}) {
  const v = weekGoalValues(start);
  const g = goalsOf();
  const isCur = start === weekStartOf(today());
  return `<div class="card goals${compact ? ' compact' : ''}">
    <div class="card-head"><span class="t">${isCur ? 'Weekdoelen' : 'Doelen deze week'}</span>${isCur ? `<button class="link-btn small" data-go="#/week/${start}">Week ${isoWeek(start)} ›</button>` : ''}</div>
    <div class="goal-grid">${GOALS.map((x) => {
      const val = v[x.key], goal = g[x.key];
      const frac = val == null ? 0 : val / goal;
      const met = goalMet(x.key, val, goal);
      const streak = isCur ? goalStreak(x.key) : 0;
      return `<button class="goal" data-sheet="goals">
        ${ring({ frac: Math.min(1, frac), color: x.color, size: 64, stroke: 7, label: met ? '✓' : val == null ? '–' : `${Math.round(Math.min(frac, 9.99) * 100)}%` })}
        <b>${x.label}</b><span>${val == null ? '–' : x.fmt(val)} / ${x.goalFmt(goal)}</span>${streak >= 2 ? `<em>${streak} wk op rij</em>` : ''}
      </button>`;
    }).join('')}</div>
  </div>`;
}

function goalsSheet() {
  const g = goalsOf();
  const inp = (k, v, step, unit) => `<input type="number" inputmode="decimal" step="${step}" data-set="goal.${k}" value="${v}"><span class="muted">&nbsp;${unit}</span>`;
  return `<div class="sh-head"><div class="eyebrow">Per week</div><h2>Weekdoelen</h2></div>
  <div class="list mt">
    <div class="row"><div class="grow"><div class="title">Krachttrainingen</div><div class="sub">sessies per week</div></div>${inp('strength', g.strength, 1, '×')}</div>
    <div class="row"><div class="grow"><div class="title">Beweging</div><div class="sub">minuten per week · advies 150</div></div>${inp('mvpa', g.mvpa, 10, 'min')}</div>
    <div class="row"><div class="grow"><div class="title">Slaap</div><div class="sub">gemiddeld per nacht</div></div>${inp('sleepH', String(Math.round((g.sleep / 60) * 100) / 100), 0.25, 'uur')}</div>
    <div class="row"><div class="grow"><div class="title">Stappen</div><div class="sub">gemiddeld per dag</div></div>${inp('steps', g.steps, 500, '')}</div>
  </div>
  <p class="small muted">Beweging telt alleen je hartslag-minuten boven 40% van je hartslagreserve (intensief dubbel) — klussen telt hier bewust niet mee, wel in je strain.</p>`;
}

let FC_CACHE = null;
function forecastModel() {
  if (FC_CACHE?.c === S.computed) return FC_CACHE.v;
  FC_CACHE = { c: S.computed, v: recoveryForecastModel(S.computed.byDate, today()) };
  return FC_CACHE.v;
}

/** Verwachting voor morgen bij verschillende bedtijden. */
function forecastCard(date, { force = false } = {}) {
  if (date !== today() || (!force && new Date().getHours() < 17)) return '';
  const m = M(date);
  const fm = forecastModel();
  const adv = bedtimeAdvice(m, toMin(S.settings.wake));
  if (!fm || !m?.recovery || !adv) return '';
  const st = m.strain?.score || 0;
  const eff = m.sleep?.efficiency || 0.9;
  const sleepAt = (bedShift) => Math.max(3, (adv.inBed - bedShift) * eff / 60);
  const opts = [[-60, '1 uur eerder'], [0, `om ${fmtHM(adv.bed)}`], [60, '1 uur later'], [120, '2 uur later']];
  const vals = opts.map(([sh]) => fm.predict(m.recovery.score, st, sleepAt(sh)));
  const main = Math.round(vals[1]);
  const zc = recoveryColor(main);
  return `<div class="card fc">
    <div class="card-head"><span class="t">${I.bed} Verwachting morgen</span><button class="link-btn small" data-sheet="forecast">Hoe?</button></div>
    <div class="fc-top"><div class="fc-big" style="color:${zc}">±${main}<small>%</small></div><div class="small muted">herstel als je <b>om ${fmtHM(adv.bed)}</b> gaat slapen (±${fmtHM(Math.round(sleepAt(0) * 60))} slaap). Marge ±${Math.round(fm.rse)}.</div></div>
    <div class="fc-opts">${opts.map(([sh, l], i) => `<div class="${sh === 0 ? 'on' : ''}"><span>${l}</span><b style="color:${recoveryColor(vals[i])}">${Math.round(vals[i])}%</b></div>`).join('')}</div>
    ${fm.perHourSleep > 1 ? `<p class="small muted" style="margin:10px 0 0">Bij jou is elk uur slaap gemiddeld <b>${num(fm.perHourSleep, 0)}%</b> herstel waard.</p>` : ''}
  </div>`;
}

function forecastAboutSheet() {
  const fm = forecastModel();
  return `<div class="sh-head"><div class="eyebrow">Uitleg</div><h2>Verwachting morgen</h2></div>
  <div class="card flat mt small"><p style="margin-top:0">Een eigen rekenmodel, geleerd uit <b>jouw</b> laatste ${fm?.n || 0} dagen: hoe hangt je herstel samen met je herstel van de dag ervoor, je strain en hoeveel je de nacht ervoor sliep?</p>
  ${fm ? `<p>Bij jou: elk uur extra slaap ≈ <b>${fm.perHourSleep >= 0 ? '+' : ''}${num(fm.perHourSleep, 1)}%</b>, elk strainpunt ≈ <b>${fm.perStrain >= 0 ? '+' : ''}${num(fm.perStrain, 1)}%</b>.</p>` : ''}
  <p style="margin-bottom:0">De marge (±${fm ? Math.round(fm.rse) : '–'}%) is groot: HRV schommelt ook door stress, alcohol, eten en toeval. Gebruik het als richting — vooral om te zien wat een uur eerder slapen oplevert.</p></div>`;
}

function coachCard(date) {
  if (date !== today()) return '';
  const m = M(date);
  const tpls = activeTemplates(S.strength);
  const doneToday = (m?.strain?.sessions?.length || 0) > 0;
  const rec = recommendTraining({ templates: tpls, sessions: S.strength.sessions, fatigue: currentFatigue(), recovery: m?.recovery?.score ?? null, today: today(), settings: SS(), doneToday, flag: m?.flag });
  const sig = strainSignal(date);
  if (sig?.high && rec?.kind === 'template') { rec.intensity = 'licht'; rec.reason += ' · houd het licht: je HRV zit al een paar dagen onder normaal'; }
  const adv = bedtimeAdvice(m, toMin(S.settings.wake));
  const tgt = m?.target;
  if (!rec && !tgt) return '';
  const icon = rec?.kind === 'template' ? I.dumbbell : rec?.kind === 'rest' ? I.bed : rec?.kind === 'done' ? I.check : I.run;
  const color = rec?.kind === 'template' ? 'var(--muscle)' : rec?.kind === 'rest' ? 'var(--sleep)' : rec?.kind === 'done' ? 'var(--green)' : 'var(--strain)';
  return `<div class="card coach">
    <div class="coach-k">Plan voor vandaag</div>
    ${rec ? `<div class="coach-main"><div class="badge" style="background:${color}">${icon}</div><div class="grow"><div class="coach-t">${esc(rec.title)}${rec.intensity ? ` <span class="pill">${rec.intensity}</span>` : ''}</div><div class="small muted">${esc(rec.reason)}</div></div>
      ${rec.kind === 'template' ? `<button class="btn small" data-act="start-template" data-id="${rec.template.id}">Start</button>` : ''}</div>` : ''}
    ${(() => { const g = strainToGo(m); return g ? `<div class="coach-go coach-go-${g.kind}">${g.kind === 'under' ? I.run : g.kind === 'over' ? I.bed : I.check}<span>${esc(g.text)}</span></div>` : ''; })()}
    <div class="coach-row">
      ${tgt ? `<button class="coach-chip" data-go="#/strain/${date}"><span>Strain-doel</span><b>${fmtStrain(tgt[0])}–${fmtStrain(tgt[1])}</b></button>` : ''}
      ${adv ? `<button class="coach-chip" data-go="#/sleep/${date}"><span>Naar bed</span><b>${fmtHM(adv.bed)}</b></button>` : ''}
      ${rec?.others?.length ? `<button class="coach-chip" data-go="#/strength"><span>Ook goed</span><b>${esc(rec.others.map((o) => o.t.name).join(', '))}</b></button>` : ''}
    </div>
  </div>`;
}

function muscleCard() {
  const sessions = S.strength.sessions.filter((s) => !s.deleted);
  // Koppel workouts aan sessies via de berekende dagdata.
  const withAct = sessions.map((s) => { const m = S.computed.byDate[s.date]?.strain?.sessions?.find((x) => x.id === s.id); return m?.activity ? { ...s, activity: m.activity } : s; });
  const { fatigue } = muscleFatigue(withAct, S.computed.loads);
  const tired = Object.entries(fatigue).filter(([, f]) => f >= 0.4).sort((a, b) => b[1] - a[1]).map(([g]) => GROUPS[g]);
  const fresh = Object.entries(fatigue).filter(([, f]) => f < 0.12).map(([g]) => GROUPS[g]);
  return `<div class="card">
    <div class="card-head"><span class="t">Spierherstel</span><span class="small muted">tik op een spier</span></div>
    ${bodyMap(fatigue)}
    <div class="legend center-legend"><span><i style="background:var(--mus-fresh)"></i>Fris</span><span><i style="background:var(--mus-low)"></i>Bijna</span><span><i style="background:var(--mus-mid)"></i>Herstellend</span><span><i style="background:var(--mus-high)"></i>Vermoeid</span></div>
    <p class="small muted" style="margin:8px 0 0">${tired.length ? `Nog vermoeid: <b style="color:var(--text)">${esc(tired.slice(0, 4).join(', '))}</b>. ` : 'Alles is (bijna) hersteld. '}${fresh.length ? `Fris: ${esc(fresh.slice(0, 5).join(', '))}.` : ''}</p>
  </div>`;
}

function muscleSheet(g) {
  const sessions = S.strength.sessions.filter((s) => !s.deleted);
  const { fatigue, last } = muscleFatigue(sessions, S.computed.loads);
  const f = fatigue[g] || 0;
  const recent = sessions.filter((s) => (S.computed.loads[s.id]?.groups?.[g] || 0) > 0.2).sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 5);
  return `<div class="sh-head"><div class="eyebrow">Spiergroep</div><h2>${esc(GROUPS[g] || g)}</h2></div>
    <div class="sh-big" style="color:${fatigueColor(f)}">${Math.round(f * 100)}<small>% vermoeid</small></div>
    <div class="sh-delta">${fatigueLabel(f)}</div>
    <div class="list-header">Recent getraind</div>
    <div class="list">${recent.length ? recent.map((s) => { const r = S.computed.loads[s.id]; const ex = r.exercises.filter((e) => (matchExercise(e.name, S.strength.exerciseMap).g[g] || 0) > 0); return `<button class="row tap wrap" data-go="#/session/${s.id}"><div class="grow"><div class="title">${esc(s.name)} · ${fmtDateShort(s.date)}</div><div class="sub">${esc(ex.map((e) => `${e.name} ${setText({ ...e, sets: null })}`).join(' · '))}</div></div><span class="chev">${I.chev}</span></button>`; }).join('') : '<div class="row"><div class="grow muted small">Nog niet gelogd.</div></div>'}</div>
    <p class="small muted">Model: elke set belast de betrokken spieren; herstel halveert grofweg elke 1,5–2 dagen (grote spieren langzamer). Het is een schatting, geen meting.</p>`;
}

// ---------------------------------------------------------------- activiteit loggen (sheet)

let ACT = null; // { draft, mode: 'pick'|'form', cat, q }

function openActivityLog({ id = null, date = null, typeId = null, fromFitbit = null } = {}) {
  if (id) {
    const a = (S.strength.activities || []).find((x) => x.id === id);
    if (!a) return;
    ACT = { draft: { ...a }, mode: 'form', isNew: false };
  } else if (typeId) {
    ACT = { draft: newActivity(typeId, date || today()), mode: 'form', isNew: true };
  } else {
    ACT = { draft: null, mode: 'pick', cat: 'alle', q: '', date: date || today(), fromFitbit, isNew: true };
  }
  if (fromFitbit && ACT.draft) applyFitbit(ACT.draft, fromFitbit);
  openSheet(actSheetHtml(), { onClose: () => { ACT = null; } });
}

function applyFitbit(d, fb) {
  d.start = fb.start; d.duration = Math.max(1, Math.round((fb.end - fb.start) / 60000)); d.date = ymd(new Date(fb.start)); d.linkedFitbit = fb.id;
}

function recentTypes() {
  const seen = [];
  for (const a of [...(S.strength.activities || [])].filter((x) => !x.deleted).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))) if (!seen.includes(a.typeId)) seen.push(a.typeId);
  return seen.slice(0, 6).map(typeById);
}

function actSheetHtml() {
  if (!ACT) return '';
  if (ACT.mode === 'pick') {
    const q = ACT.q.trim().toLowerCase();
    const list = TYPES.filter((t) => (ACT.cat === 'alle' || t.cat === ACT.cat) && (!q || t.name.toLowerCase().includes(q)));
    const rec = recentTypes();
    return `<div class="sh-head"><div class="eyebrow">Ook achteraf invullen</div><h2>Wat heb je gedaan?</h2></div>
      <input class="field mt" type="search" placeholder="Zoek: timmeren, padel, tuin…" value="${esc(ACT.q)}" data-act-search autocomplete="off">
      <div class="segmented mt">${[['alle', 'Alles'], ['sport', 'Sport'], ['werk', 'Klussen & werk'], ['huis', 'Huis & tuin']].map(([k, l]) => `<button class="${ACT.cat === k ? 'on' : ''}" data-act="act-cat" data-v="${k}">${l}</button>`).join('')}</div>
      ${rec.length && !q && ACT.cat === 'alle' ? `<div class="list-header">Recent</div><div class="chips">${rec.map((t) => `<button class="chip" data-act="act-pick" data-v="${t.id}">${esc(t.name)}</button>`).join('')}</div>` : ''}
      <div class="type-grid">${list.map((t) => `<button class="type-tile" data-act="act-pick" data-v="${t.id}"><span class="tt-ic" style="color:${CATS[t.cat].color}">${actIcon(t)}</span><span class="tt-n">${esc(t.name)}</span></button>`).join('') || '<div class="muted small">Niets gevonden — kies “Iets anders”.</div>'}</div>`;
  }
  const d = ACT.draft;
  const t = typeById(d.typeId);
  const isWork = t.cat !== 'sport';
  const st = new Date(d.start);
  const timeVal = `${pad(st.getHours())}:${pad(st.getMinutes())}`;
  const durs = [15, 30, 45, 60, 90, 120, 180, 240, 360];
  return `<div class="sh-head"><div class="eyebrow" style="color:${CATS[t.cat].color}">${CATS[t.cat].label}</div><h2 class="act-title"><span class="tt-ic" style="color:${CATS[t.cat].color}">${actIcon(t)}</span>${esc(t.name)}</h2>
      ${ACT.isNew ? `<button class="link-btn" data-act="act-back">Ander type</button>` : `<button class="link-btn" data-act="act-back">Type wijzigen</button>`}</div>
    <div class="list mt">
      <div class="row"><div class="grow">Datum</div><input type="date" data-af="date" value="${esc(d.date)}" max="${today()}"></div>
      <div class="row"><div class="grow">Begon om</div><input type="time" data-af="time" value="${timeVal}"></div>
      <div class="row"><div class="grow">Duur</div><input type="number" inputmode="numeric" data-af="duration" value="${d.duration}" style="width:64px"><span class="muted">&nbsp;min</span></div>
    </div>
    <div class="chips">${durs.map((m) => `<button class="chip${d.duration === m ? ' on' : ''}" data-act="act-dur" data-v="${m}">${m < 60 ? `${m} min` : `${num(m / 60, m % 60 ? 1 : 0)} u`}</button>`).join('')}</div>
    <div class="list-header">Intensiteit</div>
    <div class="segmented">${Object.entries(INTENSITY).map(([k, l]) => `<button class="${d.intensity === k ? 'on' : ''}" data-act="act-int" data-v="${k}">${l}</button>`).join('')}</div>
    <div class="list-header">Hoe zwaar voelde het? <span class="opt">optioneel</span></div>
    <div class="card flat rpe">
      <div class="rpe-top"><span class="rpe-v" data-rpe-v>${d.rpe ?? '–'}</span><span class="rpe-l" data-rpe-l>${d.rpe != null ? RPE_LABELS[d.rpe] : 'Sleep om in te vullen'}</span>${d.rpe != null ? '<button class="link-btn" data-act="act-rpe-clear">wis</button>' : ''}</div>
      <input type="range" min="0" max="10" step="1" value="${d.rpe ?? 5}" data-af="rpe" class="slider${d.rpe == null ? ' unset' : ''}">
      <div class="rpe-scale"><span>0 rust</span><span>5 zwaar</span><span>10 max</span></div>
    </div>
    ${isWork ? `<div class="list-header">Actieve tijd</div>
    <div class="card flat"><div class="rpe-top"><span class="rpe-v" data-active-v>${Math.round((d.active ?? 0.7) * 100)}%</span><span class="rpe-l">echt aan het werk (rest: pauzes, materiaal pakken, overleggen)</span></div>
      <input type="range" min="30" max="100" step="5" value="${Math.round((d.active ?? 0.7) * 100)}" data-af="active" class="slider"></div>` : ''}
    <div class="list mt"><div class="row"><input type="text" data-af="note" value="${esc(d.note || '')}" placeholder="Notitie (optioneel)" style="text-align:left;max-width:100%;width:100%"></div></div>
    <div class="est card flat" data-est>${actEstimateHtml()}</div>
    <button class="btn mt" data-act="act-save">${ACT.isNew ? 'Toevoegen' : 'Bewaren'}</button>
    ${!ACT.isNew ? `<button class="btn danger mt" data-act="act-del">${I.trash} Verwijderen</button>` : ''}`;
}

function actEstimateHtml() {
  const d = ACT?.draft;
  if (!d) return '';
  const m = S.computed.byDate[d.date];
  const raw = m?.raw && !m.raw.empty ? m.raw : S.days.find((x) => x.date === d.date) || null;
  const rest = raw?.rhr || m?.recovery?.baseline?.rhr || 60;
  const vo2 = raw?.vo2max || healthspan().hs?.inputs?.find((i) => i.key === 'vo2')?.value || null;
  const e = estimateActivity(d, raw, { rest, max: S.computed.maxHr, female: S.settings.sex === 'v', vo2max: vo2, kg: latestWeight()?.kg || S.settings.bodyweight || 80, rpeScale: Object.fromEntries(Object.entries(S.computed.rpeCal || {}).map(([k, v]) => [k, v.scale])) });
  const isWork = typeById(d.typeId).cat !== 'sport';
  const icon = e.source === 'hr' ? '●' : e.source === 'mix' ? '◐' : '○';
  return `<div class="est-row"><div><div class="est-k">Belasting</div><div class="est-v" style="color:var(--strain)">${fmtStrain(strainFromTrimp(e.trimp))}<small>strain</small></div></div>
    <div><div class="est-k">Energie</div><div class="est-v">${num(e.kcal)}<small>kcal</small></div></div>
    <div><div class="est-k">Intensiteit</div><div class="est-v">${num(e.met, 1)}<small>MET</small></div></div></div>
    <div class="est-split"><span><i style="background:var(--strain)"></i>Hart ${fmtStrain(strainFromTrimp(e.measured + e.estimated))}</span>${e.muscular ? `<span><i style="background:var(--muscle)"></i>Spieren +${num(e.muscular)}</span>` : ''}</div>
    <div class="small muted mt">${icon} ${esc(SOURCE_LABEL[e.source])}${e.coverage > 0 ? ` · hartslag gemeten in ${Math.round(e.coverage * 100)}% van de tijd${e.avgHr ? `, gem. ${e.avgHr} bpm` : ''}` : ''}.${isWork ? ' Telt mee voor je belasting en herstel, niet als fitheid in je leefstijl-leeftijd.' : ''}</div>`;
}

function readActForm() {
  const d = ACT?.draft;
  const body = document.querySelector('.sheet-body');
  if (!d || !body) return;
  const g = (k) => body.querySelector(`[data-af="${k}"]`);
  if (g('date')?.value) d.date = g('date').value;
  if (g('time')?.value) d.start = new Date(`${d.date}T${g('time').value}:00`).getTime();
  else d.start = new Date(`${d.date}T${pad(new Date(d.start).getHours())}:${pad(new Date(d.start).getMinutes())}:00`).getTime();
  if (g('duration')) d.duration = clamp(Math.round(Number(g('duration').value) || 0), 1, 24 * 60);
  if (g('active')) d.active = Number(g('active').value) / 100;
  if (g('note')) d.note = g('note').value;
}

function refreshActSheet() { const body = document.querySelector('.sheet-body'); if (body) body.innerHTML = actSheetHtml(); }
function refreshEstimate() { const el = document.querySelector('[data-est]'); if (el) el.innerHTML = actEstimateHtml(); }

// ---------------------------------------------------------------- plus-menu en gewicht

function openPlusMenu() {
  const d = parseRoute().name === 'today' && parseRoute().a ? parseRoute().a : today();
  openSheet(`<div class="sh-head"><h2>Toevoegen</h2></div>
    <div class="list mt">
      <button class="row tap" data-act="plus-activity" data-v="${d}"><div class="badge" style="background:var(--muscle)">${AI.hammer}</div><div class="grow"><div class="title">Activiteit of klus</div><div class="sub">Sport, timmerwerk, tuin, verhuizen — ook achteraf</div></div><span class="chev">${I.chev}</span></button>
      <button class="row tap" data-go="#/import"><div class="badge" style="background:var(--strain)">${I.doc}</div><div class="grow"><div class="title">Krachttraining uit notitie</div><div class="sub">Plak je notitie (Upper 6, Upper 7, Lower)</div></div><span class="chev">${I.chev}</span></button>
      <button class="row tap" data-go="#/log/new"><div class="badge" style="background:var(--card2);color:var(--text)">${I.dumbbell}</div><div class="grow"><div class="title">Krachttraining handmatig</div><div class="sub">Vanuit een schema afvinken</div></div><span class="chev">${I.chev}</span></button>
      ${dayFlagRow(d)}
      <button class="row tap" data-act="plus-weight"><div class="badge" style="background:var(--green)">${AI.scale}</div><div class="grow"><div class="title">Gewicht</div><div class="sub">${latestWeight() ? `laatst ${num(latestWeight().kg, 1)} kg · ${fmtDateShort(latestWeight().date)}` : 'Voor calorieën en je leefstijl-leeftijd'}</div></div><span class="chev">${I.chev}</span></button>
    </div>`);
}

function dayFlagRow(d) {
  const cur = M(d)?.flag || null;
  const lbl = d === today() ? 'vandaag' : fmtDateShort(d);
  return `<div class="row flag-row"><div class="badge" style="background:var(--red)">${AI.health}</div><div class="grow"><div class="title">Ziek of rustdag</div><div class="sub">${cur ? `${lbl} staat op ${cur === 'sick' ? 'ziek' : 'rust'}` : `Markeer ${lbl}: ziek telt niet mee in je baseline`}</div></div>
    <div class="flag-btns"><button class="pill-btn${cur === 'sick' ? ' on' : ''}" data-act="flag" data-v="${d}:${cur === 'sick' ? '' : 'sick'}">Ziek</button><button class="pill-btn${cur === 'rest' ? ' on' : ''}" data-act="flag" data-v="${d}:${cur === 'rest' ? '' : 'rest'}">Rust</button></div></div>`;
}

async function setDayFlag(date, kind) {
  await saveStrength((doc) => {
    doc.flags ||= [];
    const id = `f-${date}`;
    const ex = doc.flags.find((f) => f.id === id);
    const rec = { id, date, kind: kind || null, deleted: !kind, updatedAt: Date.now() };
    if (ex) Object.assign(ex, rec); else doc.flags.push(rec);
  });
}

function weightSheetHtml() {
  const ws = (S.strength.weights || []).filter((w) => !w.deleted).sort((a, b) => (a.date < b.date ? 1 : -1));
  const last = ws[0];
  return `<div class="sh-head"><div class="eyebrow">Lichaam</div><h2>Gewicht</h2></div>
    <div class="weight-in"><input type="number" inputmode="decimal" step="0.1" id="w-kg" value="${last ? last.kg : S.settings.bodyweight || ''}" placeholder="80,0"><span>kg</span></div>
    <div class="list mt"><div class="row"><div class="grow">Datum</div><input type="date" id="w-date" value="${today()}" max="${today()}"></div></div>
    <button class="btn mt" data-act="w-save">Opslaan</button>
    ${ws.length > 1 ? `<div class="card flat mt">${line(ws.slice(0, 60).reverse().map((w) => ({ date: w.date, value: w.kg })), { color: 'var(--green)', fmt: (v) => num(v, 1), unit: ' kg' })}</div>` : ''}
    ${ws.length ? `<div class="list-header">Geschiedenis</div><div class="list">${ws.slice(0, 12).map((w) => `<div class="row"><div class="grow">${fmtDateShort(w.date)}</div><div class="val">${num(w.kg, 1)} kg</div><button class="x" data-act="w-del" data-v="${w.id}" aria-label="Verwijder" style="border:0;background:none;color:var(--red)">${I.minus}</button></div>`).join('')}</div>` : ''}`;
}

// ---------------------------------------------------------------- Gezondheid

function viewHealth() {
  const age = userAge();
  if (!age) {
    return `${largeTitle('Gezondheid', '', avatar())}
      <div class="card"><h2>Hoe oud ben je?</h2><p class="small muted">Je leefstijl-leeftijd wordt vergeleken met je kalenderleeftijd.</p>
      <div class="weight-in"><input type="number" inputmode="numeric" id="age-in" placeholder="30"><span>jaar</span></div>
      <div class="segmented mt"><button class="${S.settings.sex !== 'v' ? 'on' : ''}" data-act="sex" data-v="m">Man</button><button class="${S.settings.sex === 'v' ? 'on' : ''}" data-act="sex" data-v="v">Vrouw</button></div>
      <button class="btn mt" data-act="age-save">Opslaan</button></div>`;
  }
  const { hs, hist } = healthspan();
  const younger = hs.delta < 0;
  const lw = latestWeight();
  const vo2In = hs.inputs.find((i) => i.key === 'vo2');
  const tempoTxt = hs.tempo < 0.7 ? 'Je gewoontes van de laatste 30 dagen laten je trager verouderen dan de kalender.' : hs.tempo <= 1.15 ? 'Je recente gewoontes houden je leefstijl-leeftijd ongeveer stabiel.' : 'Je laatste 30 dagen zijn minder gunstig dan je half-jaargemiddelde.';
  const rows = hs.inputs.map((i) => ({ label: i.short, years: i.years, sheet: `hs:${i.key}` }));
  return `${largeTitle('Gezondheid', '', avatar())}
  ${!hs.ready ? `<div class="card"><div class="card-head"><span class="t">Kalibreren</span><span class="small muted">${hs.nights30} van 14 nachten</span></div><div class="meter"><span style="width:${Math.min(100, (hs.nights30 / 14) * 100)}%;background:var(--accent)"></span></div><p class="small muted" style="margin:8px 0 0">Na 14 nachten in de laatste 30 dagen verschijnt je leefstijl-leeftijd. Hieronder zie je alvast een voorlopige inschatting.</p></div>` : ''}
  <button class="hs-hero card-lift" data-sheet="hs:about">
    <div class="hs-k">Leefstijl-leeftijd${hs.provisional ? ' <span class="pill">voorlopig</span>' : ''}</div>
    <div class="hs-big">${num(hs.lifestyleAge, 1)}</div>
    <div class="hs-range">marge ${num(hs.lo, 1)} – ${num(hs.hi, 1)} · kalenderleeftijd ${age}</div>
    <div class="hs-chip ${younger ? 'good' : 'bad'}">${younger ? '▼' : '▲'} ${yrs(hs.delta)} jaar ${younger ? 'jonger' : 'ouder'} dan je kalender</div>
  </button>
  <div class="card">
    <div class="card-head"><span class="t">Tempo</span><span class="tempo-v">${num(hs.tempo, 1)}×</span></div>
    ${scale(hs.tempo, { fmt: (v) => `${v}×` })}
    <p class="small muted" style="margin:10px 0 0">${tempoTxt} 1× = even snel als de kalender.</p>
  </div>
  ${hs.levers.length ? `<div class="section-title">Grootste hefbomen</div><div class="list">${hs.levers.slice(0, 3).map((l) => `<button class="row tap wrap" data-sheet="hs:${l.key}"><div class="badge" style="background:var(--green)">${I.up}</div><div class="grow"><div class="title">${esc(l.text)}</div><div class="sub">${esc(INPUTS[l.key].lever)}</div></div><div class="val"><b style="color:var(--green)">−${yrs(-l.gain)} j</b></div></button>`).join('')}</div>` : ''}
  <div class="section-title">Wat telt mee</div>
  <div class="card">${waterfall(rows)}<p class="tiny muted" style="margin:10px 0 0">Jaren per onderdeel na correctie voor overlap. Tik voor uitleg en het onderzoek erachter. HRV telt niet mee (alleen als trend), klussen niet als fitheid.</p></div>
  ${hist.filter((h) => h.value != null).length > 1 ? `<div class="section-title">Verloop</div><div class="card">${line(hist.map((h) => ({ date: h.date, value: h.value, label: fmtDateShort(h.date) })), { color: 'var(--green)', fmt: (v) => num(v, 1), unit: ' j', dots: true, min: Math.floor(Math.min(...hist.filter((h) => h.value != null).map((h) => h.value)) - 2), max: Math.ceil(Math.max(...hist.filter((h) => h.value != null).map((h) => h.value)) + 2) })}</div>` : ''}
  <div class="section-title">Lichaam</div>
  <div class="tiles">
    <button class="tile" data-act="plus-weight"><div class="tile-l">Gewicht</div><div class="tile-v">${lw ? num(lw.kg, 1) : '–'}<small>kg</small></div><div class="tile-d">${lw ? fmtDateShort(lw.date) : 'Tik om in te vullen'}</div></button>
    <button class="tile" data-sheet="hs:vo2"><div class="tile-l">VO₂max${vo2In?.estimated ? ' <span class="pill">geschat</span>' : ''}</div><div class="tile-v">${vo2In?.value ? num(vo2In.value) : '–'}<small>ml/kg/min</small></div><div class="tile-d">gemiddeld ${num(vo2Ref(age, S.settings.sex))} voor ${age} jaar</div></button>
    ${metricTile('hrv', today())}
    ${metricTile('rhr', today())}
  </div>
  <p class="tiny muted center mt">Gebaseerd op verbanden uit grote bevolkingsstudies (observationeel). Geen diagnose en geen voorspelling van je levensduur.</p>`;
}

function hsInputSheet(key) {
  const { hs } = healthspan();
  const inp = hs.inputs.find((i) => i.key === key);
  if (!inp) return '';
  const ctx = hsCtx();
  const fmtV = (v) => (v == null ? '–' : key === 'sleepDur' ? fmtHM(v * 60) : num(v, inp.digits));
  const daily = { steps: (d) => d.raw?.steps, rhr: (d) => d.raw?.rhr, sleepDur: (d) => (d.sleep ? d.sleep.asleep / 60 : null), vo2: (d) => d.raw?.vo2max, mvpa: (d) => d.strain?.mvpa ?? null }[key];
  const pts = daily ? lastDays(S.computed.byDate, today(), 90).map((d) => ({ date: d.date, value: daily(d) ?? null, go: `#/today/${d.date}` })) : null;
  return `<div class="sh-head"><div class="eyebrow">Leefstijl-leeftijd</div><h2>${esc(inp.label)}</h2></div>
    <div class="sh-big">${fmtV(inp.value)}<small>${key === 'sleepDur' ? 'per nacht' : inp.unit}</small></div>
    <div class="sh-delta ${inp.years == null ? '' : inp.years < 0 ? 'good' : inp.years > 0.05 ? 'bad' : ''}">${inp.years == null ? 'Nog geen data' : `${inp.years < 0 ? '−' : '+'}${yrs(inp.years)} jaar op je leefstijl-leeftijd`}${inp.estimated ? ' · geschat uit je rusthartslag' : ''}</div>
    <div class="stats mt">
      ${stat('Laatste 30 dagen', fmtV(inp.value30), key === 'sleepDur' ? '' : inp.unit)}
      ${stat('Referentie', esc(inp.ref(ctx)))}
    </div>
    ${pts && pts.some((p) => p.value != null) ? `<div class="card flat mt">${line(pts, { color: 'var(--green)', fmt: (v) => fmtV(v), dots: false })}</div>` : ''}
    <div class="card flat mt"><div class="small"><b>Wat zegt het onderzoek?</b><br>${esc(inp.evidence)}</div><div class="small mt"><b>Wat kun je doen?</b><br>${esc(inp.lever)}</div></div>`;
}

function hsAboutSheet() {
  return `<div class="sh-head"><div class="eyebrow">Uitleg</div><h2>Leefstijl-leeftijd</h2></div>
    <div class="card flat mt small">
      <p style="margin-top:0">Je leefstijl-leeftijd laat zien hoe oud je "bent" qua risicoprofiel, op basis van gewoontes die in grote studies samenhangen met hoe lang mensen leven: <b>cardiofitheid (VO₂max), stappen, matig/zwaar bewegen, krachttraining, slaapregelmaat, slaapduur en rusthartslag</b>.</p>
      <p>Per onderdeel vergelijken we je gemiddelde van het laatste half jaar met een referentie en rekenen het sterfterisico om naar jaren (risico verdubbelt grofweg elke 8 jaar). Overlappende onderdelen tellen minder mee, het totaal wordt afgezwakt (×0,6) en begrensd op ±12 jaar. De marge komt uit 800 simulaties met de onzekerheid uit de studies.</p>
      <p><b>Tempo</b> vergelijkt je laatste 30 dagen met het half jaar: lager dan 1× betekent dat je huidige gewoontes je leefstijl-leeftijd omlaag duwen.</p>
      <p style="margin-bottom:0">Klussen en fysiek werk tellen mee voor je belasting, maar niet als fitheid: onderzoek laat zien dat werk-beweging niet dezelfde gezondheidswinst geeft als sport. HRV telt niet mee omdat die per apparaat sterk verschilt.</p>
    </div>
    <p class="tiny muted">Geen medisch advies. Observationele verbanden zijn geen oorzaak-gevolg.</p>`;
}

// ---------------------------------------------------------------- Weekoverzicht & records

function weekStartOf(date) { const d = parseYmd(date); return addDays(date, -((d.getDay() + 6) % 7)); }
function isoWeek(date) {
  const d = parseYmd(date); const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day);
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t - y0) / 86400000 + 1) / 7);
}

function weekStats(start) {
  const days = Array.from({ length: 7 }, (_, i) => S.computed.byDate[addDays(start, i)] || { date: addDays(start, i) });
  const past = days.filter((d) => d.date <= today());
  const vals = (f) => past.map(f).filter((v) => v != null);
  const sessions = past.flatMap((d) => (d.strain?.sessions || []).map((s) => ({ ...s, date: d.date })));
  const manual = past.flatMap((d) => (d.strain?.manual || []).map((a) => ({ ...a, date: d.date })));
  const prs = sessions.flatMap((s) => (s.exercises || []).filter((e) => e.isPR).map((e) => ({ ...e, date: s.date, session: s.name })));
  return {
    days, past,
    rec: mean(vals((d) => d.recovery?.score)), strain: mean(vals((d) => d.strain?.score || null)), strainSum: vals((d) => d.strain?.score || null).reduce((a, b) => a + b, 0),
    sleep: mean(vals((d) => d.sleep?.asleep)), sleepPerf: mean(vals((d) => d.sleep?.perf)), hrv: mean(vals((d) => d.recovery?.hrv)), rhr: mean(vals((d) => d.recovery?.rhr)),
    steps: mean(vals((d) => d.raw?.steps)), musc: sessions.reduce((a, s) => a + (s.load || 0), 0),
    sessions, manual, prs,
    best: past.filter((d) => d.recovery).sort((a, b) => b.recovery.score - a.recovery.score)[0] || null,
    hardest: past.filter((d) => d.strain?.score).sort((a, b) => b.strain.score - a.strain.score)[0] || null,
    zones: ['green', 'yellow', 'red'].map((z) => past.filter((d) => recoveryZone(d.recovery?.score) === z).length),
  };
}

function cmpCell(a, b, digits = 0, higher = true, fmt = (v) => num(v, digits)) {
  if (a == null) return '–';
  if (b == null) return fmt(a);
  const d = a - b;
  const z = Math.round(Math.abs(d) * Math.pow(10, digits)) === 0;
  const good = higher ? d > 0 : d < 0;
  return `${fmt(a)} <span class="${z ? 'muted' : good ? 'up' : 'down'} small">${z ? '=' : `${d > 0 ? '▲' : '▼'}${fmt(Math.abs(d))}`}</span>`;
}

function viewWeek(start) {
  start = weekStartOf(start || today());
  const w = weekStats(start), pw = weekStats(addDays(start, -7));
  const end = addDays(start, 6);
  const next = addDays(start, 7);
  const recColor = recoveryColor(w.rec);
  return `${navbar(`Week ${isoWeek(start)}`, '#/trends', `<button class="nav-pill glass" data-act="share-claude">Deel</button>`)}
  <div class="content" data-swipe data-base="#/week" data-date="${start}" data-step="7">
    <div class="weeknav"><button class="icon-btn glass" data-go="#/week/${addDays(start, -7)}" aria-label="Vorige week">${I.left}</button>
      <div class="center"><div class="eyebrow">${fmtDateShort(start)} – ${fmtDateShort(end)}</div><div class="wk-title">Week ${isoWeek(start)}</div></div>
      <button class="icon-btn glass" data-go="#/week/${next}" ${next > today() ? 'disabled style="opacity:.3"' : ''} aria-label="Volgende week">${I.right}</button></div>
    <div class="wk-hero card-lift">
      <div class="wk-big" style="color:${recColor}">${w.rec != null ? num(w.rec) : '–'}<small>%</small></div>
      <div class="wk-sub">gemiddeld herstel · <span style="color:var(--green)">●</span> ${w.zones[0]} <span style="color:var(--yellow)">◆</span> ${w.zones[1]} <span style="color:var(--red)">▲</span> ${w.zones[2]}</div>
      <div class="wk-days">${w.days.map((d) => {
        const fut = d.date > today();
        const r = d.recovery?.score, st = d.strain?.score || 0;
        return `<button class="wk-day" ${fut ? 'disabled' : ''} data-go="#/today/${d.date}"><span class="wk-st" style="height:${Math.max(3, (st / 21) * 56)}px"></span><span class="wk-dot" style="background:${r != null ? recoveryColor(r) : 'var(--track)'}"></span><span class="wk-w">${weekdayShort(d.date)}</span></button>`;
      }).join('')}</div>
      <div class="legend center-legend"><span><i style="background:var(--strain)"></i>strain per dag</span><span><i style="background:var(--green)"></i>herstel</span></div>
    </div>
    ${goalsCard(start)}
    <div class="list-header">Vergeleken met vorige week</div>
    <div class="card"><div class="kv">
      <div>Herstel</div><div>${cmpCell(w.rec, pw.rec, 0, true, (v) => `${num(v)}%`)}</div>
      <div>Strain (gem. per dag)</div><div>${cmpCell(w.strain, pw.strain, 1, true, fmtStrain)}</div>
      <div>Slaap per nacht</div><div>${cmpCell(w.sleep, pw.sleep, 0, true, fmtHM)}</div>
      <div>HRV</div><div>${cmpCell(w.hrv, pw.hrv, 0, true, (v) => `${num(v)} ms`)}</div>
      <div>Rusthartslag</div><div>${cmpCell(w.rhr, pw.rhr, 0, false, (v) => `${num(v)}`)}</div>
      <div>Stappen per dag</div><div>${cmpCell(w.steps, pw.steps, 0, true, (v) => num(v))}</div>
      <div>Krachttrainingen</div><div>${cmpCell(w.sessions.length, pw.sessions.length, 0, true)}</div>
      <div>Spierbelasting</div><div>${cmpCell(w.musc, pw.musc, 0, true)}</div>
    </div></div>
    ${w.best || w.hardest || w.prs.length ? `<div class="list-header">Hoogtepunten</div><div class="list">
      ${w.best ? `<button class="row tap" data-go="#/recovery/${w.best.date}"><div class="badge" style="background:var(--green)">${I.bolt}</div><div class="grow"><div class="title">Best hersteld: ${weekdayShort(w.best.date)} ${fmtDateShort(w.best.date)}</div><div class="sub">${w.best.recovery.score}% herstel</div></div><span class="chev">${I.chev}</span></button>` : ''}
      ${w.hardest ? `<button class="row tap" data-go="#/strain/${w.hardest.date}"><div class="badge" style="background:var(--strain)">${I.flame}</div><div class="grow"><div class="title">Zwaarste dag: ${weekdayShort(w.hardest.date)} ${fmtDateShort(w.hardest.date)}</div><div class="sub">strain ${fmtStrain(w.hardest.strain.score)}</div></div><span class="chev">${I.chev}</span></button>` : ''}
      ${w.prs.slice(0, 5).map((e) => `<button class="row tap" data-go="#/exercise/${encodeURIComponent(e.key)}"><div class="badge" style="background:var(--muscle)">🏆</div><div class="grow"><div class="title">PR: ${esc(e.name)}</div><div class="sub">${esc(setText({ ...e, sets: null }))} · ${esc(e.session)} · ${fmtDateShort(e.date)}</div></div><span class="chev">${I.chev}</span></button>`).join('')}
    </div>` : ''}
    ${w.sessions.length || w.manual.length ? `<div class="list-header">Trainingen & activiteiten</div><div class="list">
      ${w.sessions.map((s) => `<button class="row tap" data-go="#/session/${s.id}"><div class="badge" style="background:var(--muscle)">${I.dumbbell}</div><div class="grow"><div class="title">${esc(s.name)}</div><div class="sub">${weekdayShort(s.date)} ${fmtDateShort(s.date)} · belasting ${num(s.load, 1)}${s.rpe != null ? ` · zwaarte ${s.rpe}/10` : ''}</div></div><span class="chev">${I.chev}</span></button>`).join('')}
      ${w.manual.map((a) => `<button class="row tap" data-sheet="manual:${a.id}"><div class="badge" style="background:${CATS[typeById(a.typeId).cat].color}">${actIcon(typeById(a.typeId))}</div><div class="grow"><div class="title">${esc(typeById(a.typeId).name)}</div><div class="sub">${weekdayShort(a.date)} ${fmtDateShort(a.date)} · ${fmtDur(a.duration)}</div></div><span class="chev">${I.chev}</span></button>`).join('')}
    </div>` : ''}
    <button class="btn secondary mt" data-go="#/records">${I.flame} Al je records</button>
  </div>`;
}

function viewRecords() {
  const exs = allExercises(S.strength.sessions, { exerciseMap: S.strength.exerciseMap });
  // Eén keer door alle (al berekende) sessies in plaats van per oefening alles opnieuw te rekenen.
  const hist = {};
  for (const ss of S.strength.sessions.filter((x) => !x.deleted && x.date).sort((x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1 : (x.createdAt || 0) - (y.createdAt || 0)))) {
    for (const ex of S.computed.loads[ss.id]?.exercises || []) (hist[ex.key] ||= []).push({ ...ex, date: ss.date, sessionId: ss.id });
  }
  const rows = exs.map((e) => {
    const h = hist[e.key] || [];
    const best = h.reduce((a, x) => ((x.e1rm || 0) > (a?.e1rm || 0) ? x : a), null);
    const first = h.find((x) => x.e1rm);
    return { e, best, gain: best && first && first.e1rm ? (best.e1rm / first.e1rm - 1) * 100 : null };
  }).filter((r) => r.best);
  const recentPRs = S.strength.sessions.filter((s) => !s.deleted && s.date >= addDays(today(), -30)).flatMap((s) => (S.computed.loads[s.id]?.exercises || []).filter((e) => e.isPR).map((e) => ({ ...e, date: s.date }))).sort((a, b) => (a.date < b.date ? 1 : -1));
  const all = Object.values(S.computed.byDate);
  const top = (f, cmp = (a, b) => b - a) => all.filter((d) => f(d) != null).sort((a, b) => cmp(f(a), f(b)))[0];
  const tRec = top((d) => d.recovery?.score), tStr = top((d) => d.strain?.score || null), tSleep = top((d) => d.sleep?.asleep), tHrv = top((d) => d.recovery?.hrv), tRhr = top((d) => d.raw?.rhr, (a, b) => a - b), tSteps = top((d) => d.raw?.steps);
  const pb = (label, d, v, go) => (d ? `<button class="tile" data-go="${go}"><div class="tile-l">${label}</div><div class="tile-v">${v}</div><div class="tile-d">${fmtDateShort(d.date)}</div></button>` : '');
  return `${navbar('Records', '#/strength')}
  <div class="content">
    ${largeTitle('Records')}
    <div class="tiles">
      ${pb('Hoogste herstel', tRec, `${tRec?.recovery.score}<small>%</small>`, `#/recovery/${tRec?.date}`)}
      ${pb('Hoogste strain', tStr, fmtStrain(tStr?.strain.score), `#/strain/${tStr?.date}`)}
      ${pb('Langste slaap', tSleep, fmtHM(tSleep?.sleep.asleep), `#/sleep/${tSleep?.date}`)}
      ${pb('Hoogste HRV', tHrv, `${num(tHrv?.recovery.hrv)}<small>ms</small>`, `#/recovery/${tHrv?.date}`)}
      ${pb('Laagste rusthartslag', tRhr, `${tRhr?.raw.rhr}<small>bpm</small>`, `#/day/${tRhr?.date}`)}
      ${pb('Meeste stappen', tSteps, num(tSteps?.raw.steps), `#/day/${tSteps?.date}`)}
    </div>
    ${recentPRs.length ? `<div class="section-title">PR's laatste 30 dagen</div><div class="list">${recentPRs.slice(0, 10).map((e) => `<button class="row tap" data-go="#/exercise/${encodeURIComponent(e.key)}"><div class="badge" style="background:var(--muscle)">🏆</div><div class="grow"><div class="title">${esc(e.name)}</div><div class="sub">${fmtDateShort(e.date)} · e1RM ${num(e.e1rm, 1)} kg</div></div><div class="val"><b>${esc(setText({ ...e, sets: null }))}</b></div></button>`).join('')}</div>` : ''}
    <div class="section-title">Beste topset per oefening</div>
    <div class="list">${rows.sort((a, b) => (b.best.e1rm || 0) - (a.best.e1rm || 0)).map((r) => `<button class="row tap wrap" data-go="#/exercise/${encodeURIComponent(r.e.key)}"><div class="grow"><div class="title">${esc(r.e.name)}</div><div class="sub">${esc(setText({ ...r.best, sets: null }))} · ${fmtDateShort(r.best.date)}${r.gain != null && r.gain > 0.5 ? ` · <span class="up">+${num(r.gain, 0)}% sinds start</span>` : ''}</div></div><div class="val"><b>${num(r.best.e1rm, 1)}</b> kg</div></button>`).join('')}</div>
  </div>`;
}

// ---------------------------------------------------------------- router

function parseRoute() {
  const h = location.hash.replace(/^#\/?/, '');
  const [name, a, b] = h.split('/');
  return { name: name || 'today', a: a ? decodeURIComponent(a) : null, b: b || null };
}

const TABS = [['today', 'Vandaag', I.today], ['strength', 'Training', I.dumbbell], ['trends', 'Trends', I.chart], ['health', 'Gezondheid', AI.health]];
let tabEl = null;
/** Blijvende glazen tabbalk (buiten de pagina), zodat de 'druppel' kan meeschuiven. */
function updateTabbar(active, show) {
  if (!tabEl) {
    tabEl = document.createElement('nav');
    tabEl.className = 'tabbar';
    tabEl.innerHTML = `<div class="tb-pill glass"><span class="tb-drop"></span>${TABS.map(([k, l, ic]) => `<a href="#/${k}" data-tab="${k}">${ic}<span>${l}</span></a>`).join('')}</div><button class="tb-plus glass" data-act="plus" aria-label="Toevoegen">${AI.plus}</button>`;
    document.body.appendChild(tabEl);
  }
  tabEl.classList.toggle('hidden', !show);
  const i = Math.max(0, TABS.findIndex(([k]) => k === active));
  tabEl.style.setProperty('--ti', i);
  tabEl.querySelectorAll('a').forEach((a) => a.classList.toggle('on', a.dataset.tab === active));
}

let lastRoute = '';
const DEPTH = { today: 0, trends: 0, strength: 0, health: 0, week: 1, records: 1, settings: 1, welcome: 0, recovery: 1, strain: 1, sleep: 1, day: 2, live: 1, exercises: 1, session: 1, template: 1, import: 1, about: 1, setup: 1, exercise: 2, log: 2, 'template-edit': 2 };
let lastDepth = 0;
let lastName = '';
let titleUpdate = () => {};

function render() {
  resetCharts();
  const r = parseRoute();
  const loggedIn = store.isDemo() || auth.hasEverLoggedIn() || S.days.length > 0 || S.strength.sessions.length > 0 || activeTemplates(S.strength).length > 0;
  let html;
  let tab = null;
  if (!loggedIn && !['setup', 'welcome', 'about', 'import', 'live'].includes(r.name)) r.name = 'welcome';
  switch (r.name) {
    case 'welcome': html = viewWelcome(); break;
    case 'setup': html = viewSetup(); break;
    case 'recovery': html = viewRecovery(r.a || today()); break;
    case 'strain': html = viewStrain(r.a || today()); break;
    case 'sleep': html = viewSleep(r.a || today()); break;
    case 'day': html = viewDay(r.a || today()); break;
    case 'trends': html = viewTrends(); tab = 'trends'; break;
    case 'strength': html = viewStrength(); tab = 'strength'; break;
    case 'exercises': html = viewExercises(); tab = 'strength'; break;
    case 'session': html = viewSession(r.a); tab = 'strength'; break;
    case 'exercise': html = viewExercise(r.a); tab = 'strength'; break;
    case 'log': html = viewLog(r.a, r.b); tab = 'strength'; break;
    case 'import': html = viewImport(); tab = 'strength'; break;
    case 'template': html = viewTemplate(r.a); tab = 'strength'; break;
    case 'template-edit': html = viewTemplateEdit(r.a || 'new'); tab = 'strength'; break;
    case 'settings': html = viewSettings(); tab = 'today'; break;
    case 'about': html = viewAbout(); tab = 'today'; break;
    case 'live': html = viewLive(); tab = 'today'; break;
    case 'health': html = viewHealth(); tab = 'health'; break;
    case 'week': html = viewWeek(r.a); tab = 'trends'; break;
    case 'records': html = viewRecords(); tab = 'strength'; break;
    default: html = viewToday(r.a && /^\d{4}-\d{2}-\d{2}$/.test(r.a) ? (r.a > today() ? today() : r.a) : today()); tab = 'today';
  }
  const showTabs = loggedIn && !['welcome', 'setup', 'log', 'template-edit'].includes(r.name);
  const key = location.hash;
  const same = key === lastRoute;
  html = html.replace(/ fade-in"/g, '"').replace(/class="fade-in"/g, 'class=""');
  const depth = DEPTH[r.name] ?? 1;
  let anim = '';
  if (!same) anim = r.name === lastName ? 'swap' : depth > lastDepth ? 'push' : depth < lastDepth ? 'pop' : 'fade';
  const ptr = ['today', 'trends', 'strength', 'health'].includes(r.name) || (r.name !== 'welcome' && !r.name) ? ' data-ptr' : '';
  app.innerHTML = `<div class="page ${anim}"${ptr}>${html}</div>`;
  updateTabbar(tab || 'today', showTabs);
  // Achtergrondgloed in de kleur van je herstel van vandaag.
  document.documentElement.dataset.zone = recoveryZone(M(today())?.recovery?.score) || 'none';
  if (!same) { window.scrollTo(0, 0); lastRoute = key; lastDepth = depth; lastName = r.name; }
  titleUpdate();  if (r.name === 'today' || !r.name) setTimeout(maybeMorning, 700);
}

// ---------------------------------------------------------------- events

function readDraftFromDom() {
  const d = S.editDraft;
  if (!d) return;
  const date = document.getElementById('log-date');
  const name = document.getElementById('log-name');
  if (date) d.date = date.value;
  if (name) d.name = name.value.trim();
  const st = document.getElementById('log-start');
  if (st?.value && d.date) {
    const ns = new Date(`${d.date}T${st.value}:00`).getTime();
    if (!d.start || Math.abs(ns - d.start) >= 60000) { d.start = ns; }
  }
  const du = document.getElementById('log-dur');
  if (du) d.duration = du.value === '' ? null : clamp(Math.round(Number(du.value)), 1, 600);
  const rp = document.getElementById('log-rpe');
  if (rp && !rp.classList.contains('unset')) d.rpe = Number(rp.value);
  document.querySelectorAll('.ex-edit').forEach((row) => {
    const i = +row.dataset.i;
    const e = d.exercises[i];
    if (!e) return;
    if (row.dataset.done != null) e.done = row.dataset.done === '1';
    for (const inp of row.querySelectorAll('input')) {
      const f = inp.dataset.f;
      if (f === 'name') e.name = inp.value;
      else e[f] = inp.value === '' ? null : Number(inp.value);
    }
  });
  saveDraftLS();
}

// ---------------------------------------------------------------- rusttimer

const REST = { t0: null, target: 150, beeped: false, timer: null };
let audioCtx = null;
function beep() {
  try {
    audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
    const now = audioCtx.currentTime;
    for (const [i, f] of [[0, 880], [0.18, 1175]]) {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.frequency.value = f; o.type = 'sine';
      g.gain.setValueAtTime(0.0001, now + i); g.gain.exponentialRampToValueAtTime(0.25, now + i + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, now + i + 0.16);
      o.connect(g).connect(audioCtx.destination); o.start(now + i); o.stop(now + i + 0.18);
    }
    navigator.vibrate?.(200);
  } catch { /* geen geluid */ }
}
function restTick() {
  const el = document.querySelector('.rest-pill');
  if (!REST.t0 || !el || parseRoute().name !== 'log') { el?.remove(); clearInterval(REST.timer); REST.timer = null; REST.t0 = null; return; }
  const sec = Math.floor((Date.now() - REST.t0) / 1000);
  const left = REST.target - sec;
  const done = left <= 0;
  if (done && !REST.beeped) { REST.beeped = true; beep(); }
  el.classList.toggle('done', done);
  el.querySelector('b').textContent = done ? `+${Math.floor(-left / 60)}:${pad(-left % 60)}` : `${Math.floor(left / 60)}:${pad(left % 60)}`;
  el.querySelector('span').textContent = done ? 'Volgende set!' : 'Rust';
  el.querySelector('i').style.width = `${Math.min(100, (sec / REST.target) * 100)}%`;
}
function startRest() {
  // AudioContext moet door een tik worden aangemaakt (iOS).
  try { audioCtx ||= new (window.AudioContext || window.webkitAudioContext)(); audioCtx.resume?.(); } catch { /* */ }
  REST.t0 = Date.now(); REST.beeped = false;
  REST.target = Number(S.settings.restSec) || 150;
  if (!document.querySelector('.rest-pill')) {
    const el = document.createElement('button');
    el.className = 'rest-pill glass';
    el.dataset.act = 'rest-tap';
    el.innerHTML = '<i></i><span>Rust</span><b></b><small>tik +30 s</small><em data-act="rest-stop" aria-label="Stop">✕</em>';
    document.body.appendChild(el);
  }
  clearInterval(REST.timer);
  REST.timer = setInterval(restTick, 500);
  restTick();
}

function elapsedText(start) {
  const m = Math.max(0, Math.floor((Date.now() - start) / 60000));
  return `${Math.floor(m / 60)}:${pad(m % 60)}`;
}

function readTplFromDom() {
  const d = S.tplDraft;
  if (!d) return;
  const name = document.getElementById('tpl-name');
  if (name) d.name = name.value;
  document.querySelectorAll('.ex-edit.tpl').forEach((row) => {
    const e = d.exercises[+row.dataset.i];
    if (!e) return;
    for (const inp of row.querySelectorAll('input')) {
      const f = inp.dataset.f;
      if (f === 'name') e.name = inp.value;
      else e[f] = inp.value === '' ? null : Number(inp.value);
    }
  });
}

const actions = {
  async sync() { await runSync(); },
  async 'full-sync'() { await runSync({ full: true }); },
  login() { if (!auth.getClientId()) { location.hash = '#/setup'; return; } auth.login({ silent: false }); },
  relogin() { auth.login({ silent: false, consent: true }); },
  'drive-login'() { auth.setDriveDisabled(false); auth.login({ kind: 'drive', silent: false }); },
  plus() { openPlusMenu(); },
  'plus-activity'(el) { closeSheet(true); openActivityLog({ date: el.dataset.v || today() }); },
  'plus-weight'() { closeSheet(true); openSheet(weightSheetHtml()); },
  'fb-label'(el) {
    const [date, ...idp] = el.dataset.v.split(':');
    const a = (M(date)?.strain?.activities || []).find((x) => String(x.id) === idp.join(':'));
    closeSheet(true);
    if (a) openActivityLog({ date, fromFitbit: a });
  },
  'act-cat'(el) { ACT.cat = el.dataset.v; refreshActSheet(); },
  'act-pick'(el) {
    const prev = ACT.draft;
    const d = newActivity(el.dataset.v, prev?.date || ACT.date || today());
    if (prev) { d.id = prev.id; d.start = prev.start; d.duration = prev.duration; d.intensity = prev.intensity; d.rpe = prev.rpe; d.note = prev.note; d.createdAt = prev.createdAt; d.date = prev.date; d.linkedFitbit = prev.linkedFitbit; }
    if (ACT.fromFitbit && !prev) applyFitbit(d, ACT.fromFitbit);
    ACT.draft = d; ACT.mode = 'form';
    refreshActSheet();
  },
  'act-back'() { readActForm(); ACT.mode = 'pick'; ACT.cat = 'alle'; ACT.q = ''; refreshActSheet(); },
  'act-dur'(el) { readActForm(); ACT.draft.duration = Number(el.dataset.v); refreshActSheet(); },
  'act-int'(el) { readActForm(); ACT.draft.intensity = el.dataset.v; refreshActSheet(); },
  'act-rpe-clear'() { readActForm(); ACT.draft.rpe = null; refreshActSheet(); },
  async 'act-save'() {
    readActForm();
    const d = { ...ACT.draft, updatedAt: Date.now() };
    await saveStrength((doc) => {
      doc.activities ||= [];
      const i = doc.activities.findIndex((x) => x.id === d.id);
      if (i >= 0) doc.activities[i] = d; else doc.activities.push(d);
    });
    closeSheet();
    toast(`${typeById(d.typeId).name} bewaard`);
    softRender(true);
  },
  async 'act-del'() {
    if (!confirm('Deze activiteit verwijderen?')) return;
    const id = ACT.draft.id;
    await saveStrength((doc) => { const a = (doc.activities || []).find((x) => x.id === id); if (a) { a.deleted = true; a.updatedAt = Date.now(); } });
    closeSheet();
    softRender(true);
  },
  async 'w-save'() {
    const kg = Number(String(document.getElementById('w-kg').value).replace(',', '.'));
    const date = document.getElementById('w-date').value || today();
    if (!(kg > 25 && kg < 300)) { toast('Vul een geldig gewicht in'); return; }
    await saveStrength((doc) => { doc.weights ||= []; doc.weights.push({ id: uid(), date, kg: Math.round(kg * 10) / 10, updatedAt: Date.now() }); });
    await saveSettings({ bodyweight: Math.round(kg * 10) / 10 });
    closeSheet();
    toast('Gewicht opgeslagen');
    softRender(true);
  },
  async 'w-del'(el) {
    await saveStrength((doc) => { const w = (doc.weights || []).find((x) => x.id === el.dataset.v); if (w) { w.deleted = true; w.updatedAt = Date.now(); } });
    const b = document.querySelector('.sheet-body'); if (b) b.innerHTML = weightSheetHtml();
  },
  async sex(el) { await saveSettings({ sex: el.dataset.v }); render(); },
  async 'age-save'() {
    const a = Number(document.getElementById('age-in').value);
    if (!(a > 12 && a < 100)) { toast('Vul je leeftijd in'); return; }
    await saveSettings({ age: a });
    render();
  },
  msheet(el) {
    const [k, d, r] = el.dataset.v.split(':');
    const body = document.querySelector('.sheet-body');
    if (body) body.innerHTML = metricSheet(k, d, Number(r));
  },
  async 'ble-on'() {
    try { await liveConnect(); toast('Verbonden — realtime hartslag'); } catch (e) { if (e.name !== 'NotFoundError') toast('Verbinden mislukt'); }
    render();
  },
  'ble-off'() { liveDisconnect(); render(); },
  async diagnose() {
    S.diag = 'Bezig…'; render();
    const out = [];
    try {
      const ti = await tokenInfo();
      if (!ti) out.push('Geen geldig token — log opnieuw in.');
      else if (ti.error || ti.error_description) out.push(`Token: ${esc(ti.error_description || ti.error)}`);
      else {
        const sc = (ti.scope || '').split(' ').map((x) => x.split('/').pop());
        out.push(`Token van client …${esc(String(ti.aud || ti.azp || '').slice(0, 12))}, geldig nog ${Math.round((ti.expires_in || 0) / 60)} min.`);
        out.push(`Scopes: ${esc(sc.join(', '))}`);
      }
    } catch (e) { out.push(`Tokeninfo mislukt: ${esc(e.message)}`); }
    const p = await probe();
    out.push(p.ok ? `Health API: OK (gebruiker ${esc(p.r?.healthUserId || p.r?.name || '')})` : `Health API: ${esc(String(p.status))} ${esc(p.raw || p.msg)}`);
    S.diag = out.join('<br>');
    render();
  },
  async copy(el) {
    try { await navigator.clipboard.writeText(el.dataset.v); toast('Gekopieerd'); } catch { prompt('Kopieer:', el.dataset.v); }
  },
  async 'paste-client'() {
    try { const t = (await navigator.clipboard.readText()).trim(); document.getElementById('clientId').value = t; } catch { toast('Plak met lang drukken in het veld'); }
  },
  'save-client'() {
    const v = document.getElementById('clientId').value.trim();
    if (!/\.apps\.googleusercontent\.com$/.test(v)) { toast('Dat lijkt geen geldige Client ID'); return; }
    auth.setClientId(v);
    if (store.isDemo()) { store.setDemo(false); }
    auth.login({ silent: false, returnTo: '#/today' });
  },
  async 'demo-on'() { store.setDemo(true); await loadAll(); location.hash = '#/today'; render(); toast('Demodata geladen'); },
  async 'demo-off'() { store.setDemo(false); await store.deleteDemoDb(); await loadAll(); location.hash = auth.hasEverLoggedIn() ? '#/today' : '#/welcome'; render(); },
  logout() { if (!confirm('Uitloggen? Je lokale data blijft bewaard.')) return; auth.logout(); location.hash = '#/welcome'; render(); },
  async wipe() {
    if (!confirm('Alle gezondheidsdata op dit toestel wissen? Je krachtlog blijft bewaard.')) return;
    await store.days.clear(); await store.kv.del('lastSyncDate'); S.days = []; recompute(); render(); toast('Gewist');
  },
  range(el) { trendRange = +el.dataset.v; render(); },
  'whats-new'() { whatsNewSheet(); },
  morning(el) { openSheet(morningSheet(el.dataset.v || today())); },
  'close-sheet'() { closeSheet(); },
  async flag(el) {
    const [date, kind] = el.dataset.v.split(':');
    await setDayFlag(date, kind || null);
    closeSheet();
    render();
    toast(kind === 'sick' ? 'Ziek-modus aan — beterschap' : kind === 'rest' ? 'Rustdag gemarkeerd' : 'Markering verwijderd');
  },
  cal(el) { calOffset = Math.min(0, calOffset + +el.dataset.v); render(); },
  calm(el) { calMetric = el.dataset.v; render(); },
  'all-sessions'() { showAllSessions = true; render(); },
  'chip-name'(el) { readDraftFromDom(); S.editDraft.name = el.dataset.v; render(); },
  'use-template'(el) {
    readDraftFromDom();
    const t = activeTemplates(S.strength).find((x) => x.id === el.dataset.id);
    if (!t) return;
    const date = S.editDraft?.date;
    const live = date === today();
    S.editDraft = { ...draftFromTemplate(t, date), _for: 'new', ...(live ? { start: S.editDraft?.start || Date.now(), live: true } : {}) };
    saveDraftLS();
    render();
  },
  'start-template'(el) {
    const t = activeTemplates(S.strength).find((x) => x.id === el.dataset.id);
    if (!t) return;
    S.editDraft = { ...draftFromTemplate(t, today()), _for: 'new', start: Date.now(), live: true };
    saveDraftLS();
    location.hash = '#/log/new';
  },
  'toggle-done'(el) {
    const row = el.closest('.ex-edit');
    const on = row.dataset.done !== '1';
    row.dataset.done = on ? '1' : '0';
    row.classList.toggle('off', !on);
    const ck = row.querySelector('.ck');
    ck.classList.toggle('on', on);
    ck.innerHTML = on ? I.check : '';
    readDraftFromDom();
    const n = document.querySelectorAll('.ex-edit.chk[data-done="1"]').length;
    const c = document.querySelector('[data-done-count]');
    if (c) c.textContent = `${n} afgevinkt.`;
    if (on && S.editDraft?.live && S.settings.restTimer !== false) startRest();
  },
  'rest-tap'() { if (!REST.t0) return; REST.target = Math.max(REST.target, Math.floor((Date.now() - REST.t0) / 1000)) + 30; REST.beeped = false; restTick(); },
  'rest-stop'() { REST.t0 = null; restTick(); },
  'add-ex'() { readDraftFromDom(); S.editDraft.exercises.push({ name: '', weight: null, reps: null, done: true }); render(); const rows = document.querySelectorAll('.ex-edit input[data-f="name"]'); rows[rows.length - 1]?.focus(); },
  'del-ex'(el) { readDraftFromDom(); S.editDraft.exercises.splice(+el.dataset.i, 1); render(); },
  'quick-add'() {
    readDraftFromDom();
    const txt = document.getElementById('quick').value;
    const r = parseNotes(txt);
    const exs = r.sessions.flatMap((s) => s.exercises).map((e) => ({ ...e, done: true }));
    if (!exs.length) { toast('Geen oefeningen herkend'); return; }
    S.editDraft.exercises = S.editDraft.exercises.filter((e) => e.name || e.weight || e.reps).concat(exs);
    render();
    toast(`${exs.length} oefeningen toegevoegd`);
  },
  async 'save-log'() {
    readDraftFromDom();
    const d = S.editDraft;
    // Alleen afgevinkte regels; leeg gewicht/reps = vorige topset overnemen.
    const exercises = d.exercises.filter((e) => e.name && e.name.trim() && e.done !== false).map((e) => {
      const last = (e.weight == null || e.reps == null) ? lastSet(e.name) : null;
      const bw = !!(e.bw || last?.bw || /\bbw\b|bodyweight|pull.?ups?|chin.?ups?|\bdips\b/i.test(e.name) && (e.weight == null || e.weight === 0));
      return { name: e.name.trim(), weight: e.weight ?? last?.weight ?? 0, reps: e.reps ?? last?.reps ?? null, bw, sets: e.sets ?? last?.sets ?? null, note: e.note || '' };
    }).filter((e) => e.reps || e.sets);
    if (!exercises.length) { toast('Vink minstens één oefening af'); return; }
    if (!d.date) { toast('Kies een datum'); return; }
    const { _for, live, ...clean } = d;
    if (live && clean.start && clean.duration == null && clean.date === today()) clean.duration = clamp(Math.round((Date.now() - clean.start) / 60000), 1, 300);
    if (clean.start && clean.date && ymd(new Date(clean.start)) !== clean.date) {
      const t = new Date(clean.start); clean.start = new Date(`${clean.date}T${pad(t.getHours())}:${pad(t.getMinutes())}:00`).getTime();
    }
    clean.exercises = exercises;
    const wasNew = !S.strength.sessions.some((x) => x.id === clean.id);
    clean.name = clean.name || 'Training';
    clean.updatedAt = Date.now();
    clean.createdAt = clean.createdAt || Date.now();
    await saveStrength((doc) => {
      const i = doc.sessions.findIndex((s) => s.id === clean.id);
      if (i >= 0) doc.sessions[i] = clean; else doc.sessions.push(clean);
      // Nieuwe oefeningen ook aan het schema toevoegen.
      const t = (doc.templates || []).find((x) => !x.deleted && x.name.trim().toLowerCase() === clean.name.trim().toLowerCase());
      if (t) {
        const keys = new Set(t.exercises.map((e) => exKey(e.name)));
        const extra = exercises.filter((e) => !keys.has(exKey(e.name)));
        if (extra.length) { t.exercises.push(...extra.map(({ note, ...e }) => e)); t.updatedAt = Date.now(); }
      }
    });
    S.editDraft = null; S.draftRestored = false;
    clearDraftLS();
    location.hash = `#/session/${clean.id}`;
    if (wasNew) setTimeout(() => openSheet(workoutSummarySheet(clean.id)), 450); else toast('Training bewaard');
  },
  async 'share-claude'() {
    const pts = loadSeries(today());
    const txt = buildShare({ computed: S.computed, strength: S.strength, settings: S.settings, profile: S.profile, syncLog: S.syncLog, hrMethod: await store.kv.get('hrMethod'), healthspan: userAge() ? healthspan().hs : null, loadPoint: pts[pts.length - 1], version: APP_VERSION, extras: shareExtras() });
    const msg = `Pulse-data (laatste 14 dagen) — check de belasting:\n${txt}`;
    try { await navigator.clipboard.writeText(msg); toast('Gekopieerd — plak het in je chat met Claude'); }
    catch {
      openSheet(`<div class="sh-head"><h2>Deel met Claude</h2><div class="eyebrow">Selecteer alles en kopieer</div></div><textarea class="notes mt" style="min-height:300px" readonly>${esc(msg)}</textarea>`);
      setTimeout(() => { const t = document.querySelector('.sheet textarea'); t?.focus(); t?.select(); }, 300);
    }
  },
  'discard-draft'() { clearDraftLS(); S.editDraft = null; S.draftRestored = false; location.hash = '#/strength'; },
  async 'delete-log'() {
    if (!confirm('Deze training verwijderen?')) return;
    clearDraftLS();
    const id = S.editDraft.id;
    await saveStrength((doc) => {
      const s = doc.sessions.find((x) => x.id === id);
      if (s) { s.deleted = true; s.updatedAt = Date.now(); s.exercises = []; }
    });
    S.editDraft = null;
    location.hash = '#/strength';
  },
  'tpl-add-ex'() { readTplFromDom(); S.tplDraft.exercises.push({ name: '', weight: null, reps: null, sets: null }); render(); const rows = document.querySelectorAll('.ex-edit input[data-f="name"]'); rows[rows.length - 1]?.focus(); },
  'tpl-del-ex'(el) { readTplFromDom(); S.tplDraft.exercises.splice(+el.dataset.i, 1); render(); },
  async 'save-template'() {
    readTplFromDom();
    const { _for, ...t } = S.tplDraft;
    t.name = (t.name || '').trim();
    if (!t.name) { toast('Geef het schema een naam'); return; }
    t.exercises = t.exercises.filter((e) => e.name && e.name.trim()).map((e) => ({ name: e.name.trim(), weight: e.weight ?? 0, reps: e.reps ?? null, sets: e.sets ?? null, bw: !!(e.bw || /\bbw\b|bodyweight/i.test(e.name) || (e.weight == null && /pull.?ups?|chin.?ups?|\bdips\b|push.?ups?/i.test(e.name))) }));
    t.updatedAt = Date.now();
    await saveStrength((doc) => {
      doc.templates ||= [];
      const i = doc.templates.findIndex((x) => x.id === t.id);
      if (i >= 0) doc.templates[i] = t; else doc.templates.push(t);
    });
    S.tplDraft = null;
    toast('Schema bewaard');
    location.hash = `#/template/${t.id}`;
  },
  async 'delete-template'() {
    if (!confirm('Dit schema verwijderen? Je gelogde trainingen blijven bewaard.')) return;
    const id = S.tplDraft.id;
    await saveStrength((doc) => { const t = (doc.templates || []).find((x) => x.id === id); if (t) { t.deleted = true; t.updatedAt = Date.now(); } });
    S.tplDraft = null;
    location.hash = '#/strength';
  },
  async 'copy-template'(el) {
    const t = activeTemplates(S.strength).find((x) => x.id === el.dataset.id);
    if (!t) return;
    const lines = [t.name, ...t.exercises.map((e) => {
      const c = currentSet(S.strength, e.name, S.settings) || e;
      const w = Number(c.weight || 0).toLocaleString('nl-NL', { maximumFractionDigits: 2 });
      return `${e.name} ${c.bw ? (c.weight ? `+${w}kg` : '') : `${w}kg`}${c.sets ? ` ${c.sets} sets` : ''}${c.reps ? ` ${c.reps} reps` : ''}`.replace(/\s+/g, ' ').trim();
    })];
    try { await navigator.clipboard.writeText(lines.join('\n')); toast('Gekopieerd — plak in Notities'); } catch { prompt('Kopieer deze tekst:', lines.join('\n')); }
  },
  parse() {
    const text = document.getElementById('notes').value;
    const result = parseNotes(text);
    const mode = result.sessions.some((s) => s.date) ? 'sessions' : 'templates';
    S.importDraft = { text, result, mode };
    render();
    setTimeout(() => document.querySelector('.section-title')?.scrollIntoView({ behavior: 'smooth' }), 50);
  },
  'imp-mode'(el) {
    const d = S.importDraft;
    d.result.sessions.forEach((s, i) => {
      const n = document.querySelector(`[data-imp-name="${i}"]`)?.value.trim();
      const dt = document.querySelector(`[data-imp-date="${i}"]`)?.value;
      if (n) s.name = n;
      if (dt) s.date = dt;
    });
    d.mode = el.dataset.v;
    render();
  },
  async 'do-import'() {
    const draft = S.importDraft;
    const tplMode = draft.mode === 'templates';
    const chosen = [];
    draft.result.sessions.forEach((s, i) => {
      const cb = document.querySelector(`[data-imp="${i}"]`);
      const name = document.querySelector(`[data-imp-name="${i}"]`)?.value.trim();
      const date = document.querySelector(`[data-imp-date="${i}"]`)?.value;
      if (cb?.checked) chosen.push({ ...s, name: name || s.name, date: date || s.date });
    });
    if (!chosen.length) { toast('Niets geselecteerd'); return; }
    const now = Date.now();
    const strip = (e) => ({ name: e.name, weight: e.weight ?? 0, reps: e.reps ?? null, sets: e.sets ?? null, bw: !!e.bw, note: e.note || '' });
    if (tplMode) {
      const logIt = document.getElementById('imp-log')?.checked;
      const logDate = document.getElementById('imp-log-date')?.value || today();
      const toLog = logIt ? chosen.filter((s) => (templateDiff(s) || []).some((c) => ['up', 'down', 'same'].includes(c.kind))) : [];
      const exists = new Set(S.strength.sessions.filter((x) => !x.deleted).map((x) => `${x.date}|${(x.name || '').toLowerCase()}`));
      await saveStrength((doc) => {
        toLog.forEach((s, k) => { if (!exists.has(`${logDate}|${s.name.toLowerCase()}`)) doc.sessions.push({ id: uid(), date: logDate, name: s.name, exercises: s.exercises.map(strip), createdAt: now + 100 + k, updatedAt: now + 100 + k, fromNotes: true }); });
        doc.templates ||= [];
        chosen.forEach((s, k) => {
          const ex = doc.templates.find((t) => !t.deleted && t.name.trim().toLowerCase() === s.name.trim().toLowerCase());
          const exercises = s.exercises.map(({ note, ...e }) => strip(e));
          if (ex) { ex.exercises = exercises; ex.updatedAt = now + k; } else doc.templates.push({ id: uid(), name: s.name, exercises, order: doc.templates.length + k, updatedAt: now + k });
        });
      });
      S.importDraft = null;
      toast(`${chosen.length} schema's opgeslagen${toLog.length ? ` · ${toLog.length} training${toLog.length === 1 ? '' : 'en'} gelogd` : ''}`);
      location.hash = '#/strength';
      return;
    }
    const missing = chosen.filter((s) => !s.date);
    if (missing.length) { toast(`${missing.length} training(en) zonder datum`); return; }
    await saveStrength((doc) => {
      chosen.forEach((s, k) => doc.sessions.push({ id: uid(), date: s.date, name: s.name, exercises: s.exercises.map(strip), createdAt: now + k, updatedAt: now + k }));
    });
    S.importDraft = null;
    toast(`${chosen.length} trainingen geïmporteerd`);
    location.hash = '#/strength';
  },
  async export() {
    const data = { app: 'pulse', version: 1, exportedAt: new Date().toISOString(), settings: S.settings, strength: S.strength, days: S.days };
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `pulse-backup-${today()}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  },  'export-csv'() {
    const q = (v) => (v == null ? '' : typeof v === 'number' ? String(Math.round(v * 100) / 100).replace('.', ',') : `"${String(v).replace(/"/g, '""')}"`);
    const rows = [['datum', 'herstel', 'hrv_ms', 'rusthartslag', 'ademhaling', 'temp_afwijking', 'slaap_min', 'slaapbehoefte_min', 'diep_min', 'rem_min', 'bedtijd', 'opstaan', 'strain', 'cardio_trimp', 'spier_trimp', 'stappen', 'vo2max', 'markering']];
    for (const d of Object.values(S.computed.byDate).sort((a, b) => (a.date < b.date ? -1 : 1))) {
      const r = d.recovery, sl = d.sleep;
      rows.push([d.date, r?.score, r?.hrv, r?.rhr, r?.resp, r?.tempDev, sl?.asleep, sl?.need, sl?.deep, sl?.rem, sl ? fmtTime(sl.start) : null, sl ? fmtTime(sl.end) : null, d.strain?.score, d.strain?.cardioTrimp, d.strain?.muscularTrimp, d.raw?.steps, d.raw?.vo2max, d.flag]);
    }
    const ex = [['datum', 'training', 'oefening', 'gewicht_kg', 'reps', 'sets', 'bodyweight', 'e1rm', 'pr', 'belasting']];
    for (const ss of S.strength.sessions.filter((x) => !x.deleted && x.date).sort((a, b) => (a.date < b.date ? -1 : 1))) {
      for (const e of S.computed.loads[ss.id]?.exercises || []) ex.push([ss.date, ss.name, e.name, e.weight, e.reps, e.sets, e.bw ? 'ja' : '', e.e1rm, e.isPR ? 'ja' : '', e.load]);
    }
    const csv = (t) => t.map((r) => r.map((v, i) => (i === 0 && typeof v === 'string' ? v : q(v))).join(';')).join('\n');
    for (const [name, t] of [['dagen', rows], ['krachttraining', ex]]) {
      const blob = new Blob(['﻿' + csv(t)], { type: 'text/csv;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `pulse-${name}-${today()}.csv`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    }
    toast('2 CSV-bestanden gemaakt (dagen + krachttraining)');
  },
};

document.addEventListener('click', (ev) => {
  const stepLink = ev.target.closest('[data-step]');
  if (stepLink) {
    const d = setupDone();
    if (!d.includes(stepLink.dataset.step)) { d.push(stepLink.dataset.step); try { localStorage.setItem('pulse.setupDone', JSON.stringify(d)); } catch { /* */ } }
    setTimeout(render, 300);
    return;
  }
  const sheetBtn = ev.target.closest('[data-sheet]');
  if (sheetBtn) { ev.preventDefault(); openSheetFor(sheetBtn.dataset.sheet); return; }
  const go = ev.target.closest('[data-go]');
  const back = ev.target.closest('[data-back]');
  const act = ev.target.closest('[data-act]');
  if (act && act.tagName !== 'SELECT' && act.tagName !== 'INPUT') {
    const fn = actions[act.dataset.act];
    if (fn) { ev.preventDefault(); fn(act); return; }
  }
  if (back) { ev.preventDefault(); location.hash = back.dataset.back; return; }
  if (go) { ev.preventDefault(); if (location.hash === go.dataset.go) render(); else location.hash = go.dataset.go; }
});

document.addEventListener('change', async (ev) => {
  const el = ev.target;
  if (el.dataset.set) {
    const k = el.dataset.set;
    let v = el.value;
    if (k === 'sleepNeedH') { await saveSettings({ sleepNeed: Math.round(clamp(Number(v) || 7.5, 4, 12) * 60) }); return; }
    if (k.startsWith('goal.')) {
      const sub = k.slice(5);
      const n = Number(String(v).replace(',', '.'));
      if (!isFinite(n) || n <= 0) return;
      const goals = { ...goalsOf(), ...(sub === 'sleepH' ? { sleep: Math.round(clamp(n, 4, 12) * 60) } : { [sub]: sub === 'strength' ? clamp(Math.round(n), 1, 14) : Math.round(n) }) };
      await saveSettings({ goals });
      render();
      return;
    }
    if (k === 'restSec') { const n = Number(v); await saveSettings(n ? { restSec: n, restTimer: true } : { restTimer: false }); return; }
    if (k === 'morning') { await saveSettings({ morning: el.checked }); return; }
    if (k === 'badge') {
      v = el.checked;
      if (v && 'Notification' in window && Notification.permission === 'default') { try { await Notification.requestPermission(); } catch { /* */ } }
      await saveSettings({ badge: v });
      if (!v) { try { navigator.clearAppBadge?.().catch(() => {}); } catch { /* */ } }
      updateBadge();
      toast(v ? ('setAppBadge' in navigator ? 'Herstel staat nu op je app-icoon' : 'Je toestel ondersteunt geen badges (zet Pulse op je beginscherm)') : 'Badge uit');
      return;
    }
    if (['age', 'bodyweight', 'maxHr', 'defaultSets'].includes(k)) v = v === '' ? null : Number(v);
    if (k === 'defaultSets' && v != null) v = clamp(Math.round(v), 1, 10);
    await saveSettings({ [k]: v });
    if (k === 'theme' || k === 'palette') applyTheme();
    if (k === 'theme' || k === 'palette' || k === 'maxHr' || k === 'age') render();
    return;
  }
  if (el.dataset.act === 'map-ex') {
    const key = el.dataset.key;
    await saveStrength((doc) => { doc.exerciseMap = { ...(doc.exerciseMap || {}), [key]: el.value }; doc.mapUpdatedAt = Date.now(); });
    render();
    toast('Indeling bijgewerkt');
    return;
  }
  if (el.dataset.act === 'import-backup' && el.files?.[0]) {
    try {
      const data = JSON.parse(await el.files[0].text());
      if (data.app !== 'pulse') throw new Error('Geen Pulse-back-up');
      if (!confirm(`Back-up van ${data.exportedAt?.slice(0, 10)} importeren? Krachtlogs worden samengevoegd.`)) return;
      if (data.days?.length) { await store.days.putMany(data.days); S.days = await store.days.all(); }
      if (data.settings) await saveSettings(data.settings);
      if (data.strength) await saveStrength((doc) => { Object.assign(doc, mergeDocs(doc, data.strength)); });
      recompute(); render(); toast('Back-up geïmporteerd');
    } catch (e) { toast('Importeren mislukt: ' + e.message); }
  }
});

// Naam in krachtlog → toon vorige topset als placeholder.
document.addEventListener('input', (ev) => {
  const el = ev.target;
  if (el.matches?.('[data-act-search]') && ACT) {
    ACT.q = el.value;
    const pos = el.selectionStart;
    refreshActSheet();
    const n = document.querySelector('[data-act-search]'); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch { /* */ } }
    return;
  }
  if (el.dataset?.af && ACT?.draft) {
    if (el.dataset.af === 'rpe') {
      ACT.draft.rpe = Number(el.value);
      el.classList.remove('unset');
      const v = document.querySelector('[data-rpe-v]'); const l = document.querySelector('[data-rpe-l]');
      if (v) v.textContent = el.value; if (l) l.textContent = RPE_LABELS[Number(el.value)];
    } else if (el.dataset.af === 'active') {
      const v = document.querySelector('[data-active-v]'); if (v) v.textContent = `${el.value}%`;
      readActForm();
    } else readActForm();
    refreshEstimate();
    return;
  }
  if (el.id === 'log-rpe') {
    el.classList.remove('unset');
    const v = document.querySelector('[data-lrpe-v]'); const l = document.querySelector('[data-lrpe-l]');
    if (v) v.textContent = el.value; if (l) l.textContent = RPE_LABELS[Number(el.value)];
  }
  if (S.editDraft && el.closest('.content') && parseRoute().name === 'log') setTimeout(readDraftFromDom, 0);
  if ((el.dataset?.f === 'weight' || el.dataset?.f === 'reps') && el.closest('.ex-edit.chk')) {
    const row = el.closest('.ex-edit.chk');
    if (row.dataset.done !== '1') {
      row.dataset.done = '1'; row.classList.remove('off');
      const ck = row.querySelector('.ck'); ck.classList.add('on'); ck.innerHTML = I.check;
    }
  }
  if (el.dataset?.f === 'name' && !el.closest('.tpl')) {
    const row = el.closest('.ex-edit');
    const last = lastSet(el.value);
    if (row) {
      row.querySelector('[data-f="weight"]').placeholder = last ? num(last.weight, 1) : 'kg';
      row.querySelector('[data-f="reps"]').placeholder = last ? last.reps : 'reps';
    }
  }
});

window.addEventListener('hashchange', () => {
  const r = parseRoute();
  if (r.name !== 'log') S.editDraft = null;
  if (r.name !== 'template-edit') S.tplDraft = null;
  render();
});

// ---------------------------------------------------------------- boot

async function boot() {
  enablePullToRefresh(() => runSync());
  enableSwipe((dir, area) => {
    const d = addDays(area.dataset.date, dir * Number(area.dataset.step || 1));
    if (d > today()) return;
    location.hash = `${area.dataset.base || '#/today'}/${d}`;
  });
  titleUpdate = enableCollapsingTitle();
  const redirect = auth.handleRedirect();
  await loadAll();
  S.lastSyncAt = await store.kv.get('lastSyncAt');
  S.syncLog = await store.kv.get('syncLog');
  if (redirect && !redirect.ok && redirect.kind !== 'drive') {
    if (redirect.silent && (redirect.error === 'interaction_required' || redirect.error === 'login_required' || redirect.error === 'consent_required')) {
      S.syncError = 'Opnieuw inloggen nodig.';
    } else if (redirect.error !== 'state_mismatch') {
      S.syncError = `Inloggen mislukt: ${redirect.error}`;
    }
  }
  render();
  try {
    const seen = localStorage.getItem('pulse.seenVersion');
    if (seen !== APP_VERSION) {
      localStorage.setItem('pulse.seenVersion', APP_VERSION);
      if (seen || auth.hasEverLoggedIn()) setTimeout(whatsNewSheet, 600);
    }
  } catch { /* */ }
  if (redirect?.ok && redirect.kind === 'health') {
    if (redirect.missingScopes?.length) toast('Niet alle toestemmingen gegeven — sommige data ontbreekt mogelijk');
    if (store.isDemo()) { store.setDemo(false); await loadAll(); }
    // Tweede (stille) sleutel voor Drive-back-up en je naam/foto.
    if (!auth.getToken('drive') && !auth.driveDisabled() && auth.canTrySilent('drive')) { auth.login({ kind: 'drive', silent: true, returnTo: redirect.returnTo }); return; }
    await quickThenFull();
  } else if (redirect && redirect.kind === 'drive') {
    if (redirect.ok) auth.setDriveDisabled(false);
    await quickThenFull();
  } else if (!store.isDemo() && auth.hasEverLoggedIn()) {
    if (auth.getToken('health')) quickThenFull();
    else if (auth.getClientId() && auth.canTrySilent('health')) auth.login({ silent: true });
  }
  S.lastSyncAt = await store.kv.get('lastSyncAt');
  S.syncLog = await store.kv.get('syncLog');
}

boot().catch((e) => {
  console.error(e);
  app.innerHTML = `<div class="card" style="margin-top:40px"><h2>Er ging iets mis</h2><pre class="raw">${esc(e.stack || e.message)}</pre></div>`;
});

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('sw.js').then((reg) => reg.update?.()).catch(() => {});
  // Nieuwe versie actief → één keer herladen (niet midden in een formulier of sheet).
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) return;
    const tryReload = () => {
      if (isSheetOpen() || ['log', 'import', 'template-edit'].includes(parseRoute().name)) { setTimeout(tryReload, 5000); return; }
      location.reload();
    };
    tryReload();
  });
}

// Bij terugkeren naar de app (bijv. vanuit achtergrond): ververs als data oud is.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible' || store.isDemo()) return;
  if (auth.getToken('health')) quickThenFull(); else minuteTick();
});
