import * as store from './store.js';
import * as auth from './auth.js';
import { syncAll } from './sync.js';
import { driveLoad, driveSave, AuthError } from './api.js';
import { computeAll, insights, recoveryColor, recoveryZone, strainLabel, bedtimeAdvice, lastDays, ZONES } from './metrics.js';
import { parseNotes, computeLoads, allExercises, exerciseHistory, newSession, mergeDocs, exKey, matchExercise, LIBRARY, GROUPS, UPPER, LOWER, libById } from './strength.js';
import { ring, bars, line, hrDay, hypnogram, stackBar, spark } from './charts.js';
import { generateDemo } from './demo.js';
import { I, INSIGHT_ICON } from './icons.js';
import { today, addDays, fmtDayTitle, fmtDateLong, fmtDateShort, fmtTime, fmtDur, fmtHM, num, esc, clamp, mean, uid, ymd, pad, parseYmd, debounce, weekdayShort } from './util.js';

const DEFAULTS = { sleepNeed: 450, defaultSets: 3, bodyweight: 80, maxHr: null, age: null, sex: 'm', theme: 'auto', wake: '07:00' };

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
  if (store.isDemo() || !auth.getToken()) return;
  const remote = await driveLoad();
  const merged = mergeDocs(S.strength, remote);
  const changedLocal = JSON.stringify(merged.sessions.map((s) => [s.id, s.updatedAt]).sort()) !== JSON.stringify(S.strength.sessions.map((s) => [s.id, s.updatedAt]).sort());
  S.strength = merged;
  await store.kv.set('strength', merged);
  const dirty = await store.kv.get('strengthDirty');
  if (dirty || !remote || JSON.stringify(remote.sessions?.length) !== JSON.stringify(merged.sessions.length)) {
    await driveSave(merged);
    await store.kv.set('strengthDirty', false);
  }
  if (changedLocal) { recompute(); render(); }
}

function applyTheme() {
  const t = S.settings.theme;
  if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
  else delete document.documentElement.dataset.theme;
}

// ---------------------------------------------------------------- sync

async function runSync({ full = false, interactive = true } = {}) {
  if (S.syncing) return;
  if (store.isDemo()) { toast('Demomodus: geen synchronisatie'); return; }
  if (!auth.getToken()) {
    if (!auth.getClientId()) { location.hash = '#/setup'; return; }
    if (interactive) auth.login({ silent: auth.hasEverLoggedIn() });
    return;
  }
  S.syncing = true; S.syncError = null; S.progress = { text: 'Verbinden…', frac: 0.01 };
  render();
  try {
    await syncAll({ full, onProgress: (text, frac) => { S.progress = { text, frac }; updateProgress(); } });
    try { await syncStrength(); } catch (e) { console.warn('Drive', e); if (e instanceof AuthError) throw e; }
    S.days = await store.days.all();
    S.profile = (await store.kv.get('profile')) || null;
    recompute();
    const log = (await store.kv.get('syncLog'))?.log || [];
    const failed = log.filter((l) => !l.ok);
    toast(failed.length ? `Gesynchroniseerd, ${failed.length} onderdeel mislukt` : 'Gesynchroniseerd');
  } catch (e) {
    if (e instanceof AuthError) {
      S.syncError = 'Je sessie is verlopen.';
      if (auth.canTrySilent()) { auth.login({ silent: true }); return; }
    } else S.syncError = e.message;
    toast('Synchroniseren mislukt');
  } finally {
    S.syncing = false; S.progress = null;
    S.lastSyncAt = await store.kv.get('lastSyncAt');
    S.syncLog = await store.kv.get('syncLog');
    render();
  }
}

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
  return `<div class="navbar"><button class="back" data-back="${esc(back)}">${I.left}<span>Terug</span></button><div class="title">${esc(title)}</div><div class="right">${right}</div></div>`;
}

function largeTitle(title, eyebrow = '', right = '') {
  return `<div class="large-title"><div>${eyebrow ? `<div class="eyebrow">${esc(eyebrow)}</div>` : ''}<h1>${esc(title)}</h1></div><div style="display:flex;gap:8px;align-items:center">${right}</div></div>`;
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
  if (store.isDemo()) return `<button class="icon-btn" data-go="#/settings" aria-label="Instellingen">${I.person}</button>`;
  if (u?.picture) return `<img class="avatar" src="${esc(u.picture)}" alt="" data-go="#/settings" referrerpolicy="no-referrer">`;
  return `<button class="icon-btn" data-go="#/settings" aria-label="Instellingen">${I.person}</button>`;
}

function syncBtn() {
  return `<button class="icon-btn" data-act="sync" aria-label="Synchroniseren">${S.syncing ? I.sync.replace('<svg', '<svg class="spin"') : I.sync}</button>`;
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
    ${hasClient ? `<button class="btn gbtn" data-act="login">${I.google} Inloggen met Google</button>` : `<button class="btn" data-go="#/setup">Koppeling instellen</button>`}
    <div style="height:10px"></div>
    <button class="btn secondary" data-act="demo-on">Bekijk met demodata</button>
    ${hasClient ? `<p class="small" style="margin-top:22px"><a href="#/setup">Instellingen koppeling</a></p>` : ''}
  </div>`;
}

function viewSetup() {
  const uri = auth.redirectUri();
  return `${navbar('Koppeling', auth.getClientId() || store.isDemo() ? '#/settings' : '#/welcome')}
  <div class="content fade-in">
    <div class="card"><h2>Eenmalig instellen</h2>
      <p class="small muted" style="margin-top:-4px">Sinds november 2026 loopt Fitbit-data via de <b>Google Health API</b>. Daarvoor heb je een eigen (gratis) Google Cloud-project nodig. Dit duurt ±5 minuten en hoeft maar één keer.</p>
      <ol class="steps">
        <li>Ga naar <a href="https://console.cloud.google.com/projectcreate" target="_blank" rel="noopener">console.cloud.google.com</a> en maak een project (bijv. “Pulse”).</li>
        <li>Zet onder <i>APIs &amp; Services → Library</i> de <b>Google Health API</b> en de <b>Google Drive API</b> aan.</li>
        <li><i>Google Auth Platform → Branding</i>: app-naam “Pulse”, je e-mail. Bij <i>Audience</i>: type <b>External</b>, status <b>Testing</b>, en voeg jezelf toe als <b>test user</b>.</li>
        <li><i>Data Access</i>: voeg de scopes <code>googlehealth.activity_and_fitness.readonly</code>, <code>googlehealth.health_metrics_and_measurements.readonly</code>, <code>googlehealth.sleep.readonly</code>, <code>googlehealth.profile.readonly</code> en <code>drive.appdata</code> toe.</li>
        <li><i>Clients → Create client</i>: type <b>Web application</b>.<br>Authorized JavaScript origin: <code>${esc(location.origin)}</code><br>Authorized redirect URI: <code>${esc(uri)}</code></li>
        <li>Kopieer de <b>Client ID</b> en plak hem hieronder.</li>
      </ol>
    </div>
    <div class="list-header">Google Client ID</div>
    <input class="field" id="clientId" placeholder="123456-abc.apps.googleusercontent.com" value="${esc(auth.getClientId())}" autocomplete="off" autocapitalize="off" spellcheck="false">
    <div class="list-footer" style="margin-top:6px">Wordt alleen op dit toestel bewaard. Google toont bij inloggen een melding “app niet geverifieerd” — dat klopt, het is je eigen app. Kies <i>Doorgaan</i>.</div>
    <button class="btn gbtn mt" data-act="save-client">${I.google} Opslaan en inloggen</button>
  </div>`;
}

function viewToday(date) {
  const m = M(date);
  const t = date === today();
  const rec = m?.recovery;
  const strain = m?.strain;
  const sleep = m?.sleep;
  const raw = m?.raw || S.days.find((d) => d.date === date);
  const ins = insights(m);
  const recColor = recoveryColor(rec?.score);

  const rings = `<div class="rings">
    <button class="r" data-go="#/recovery/${date}">${ring({ frac: (rec?.score || 0) / 100, color: recColor, label: rec ? `${rec.score}%` : '–', size: 104, stroke: 10 })}<span class="name">Herstel</span></button>
    <button class="r" data-go="#/strain/${date}">${ring({ frac: (strain?.score || 0) / 21, color: 'var(--strain)', label: strain ? fmtStrain(strain.score) : '–', size: 104, stroke: 10, target: m?.target ? [m.target[0] / 21, m.target[1] / 21] : null })}<span class="name">Strain</span></button>
    <button class="r" data-go="#/sleep/${date}">${ring({ frac: sleep?.perf || 0, color: 'var(--sleep)', label: sleep ? pct(sleep.perf) : '–', size: 104, stroke: 10 })}<span class="name">Slaap</span></button>
  </div>`;

  const insightsCard = ins.length ? `<div class="card">${ins.slice(0, 4).map((i) => `<div class="insight"><div class="ic">${INSIGHT_ICON[i.icon] || I.info}</div><p>${esc(i.text)}</p></div>`).join('')}</div>` : '';

  const acts = [];
  for (const s of strain?.sessions || []) {
    acts.push(`<button class="row tap" data-go="#/session/${s.id}"><div class="badge" style="background:var(--muscle)">${I.dumbbell}</div><div class="grow"><div class="title">${esc(s.name || 'Krachttraining')}</div><div class="sub">${s.exercises.length} oefeningen · spierbelasting ${num(s.load, 1)}${s.activity ? ` · ${fmtDur(s.activity.duration)}, gem. ${num(s.activity.avgHr)} bpm` : ''}</div></div><div class="val" style="color:var(--muscle)">+${num(s.muscularTrimp, 0)}</div><span class="chev">${I.chev}</span></button>`);
  }
  for (const a of strain?.activities || []) {
    if (a.linked) continue;
    acts.push(`<button class="row tap" data-go="#/strain/${date}"><div class="badge" style="background:var(--strain)">${/run|loop/i.test(a.type + a.name) ? I.run : I.flame}</div><div class="grow"><div class="title">${esc(a.name)}</div><div class="sub">${fmtTime(a.start)} · ${fmtDur(a.duration)}${a.avgHr ? ` · gem. ${num(a.avgHr)} bpm` : ''}</div></div><div class="val">${fmtStrain(a.strain)}</div><span class="chev">${I.chev}</span></button>`);
  }

  const stats = raw ? `<div class="stats">
    ${stat('HRV', num(rec?.hrv), 'ms', deltaText(rec?.hrv, rec?.baseline?.hrv, ' ms'), '', `#/recovery/${date}`)}
    ${stat('Rusthartslag', num(rec?.rhr), 'bpm', deltaText(rec?.rhr, rec?.baseline?.rhr, '', 0, false), '', `#/recovery/${date}`)}
    ${stat('Slaap', sleep ? fmtHM(sleep.asleep) : '–', '', sleep ? `behoefte ${fmtHM(sleep.need)}` : '', '', `#/sleep/${date}`)}
    ${stat('Ademhaling', num(raw.resp, 1), '/min', deltaText(raw.resp, rec?.baseline?.resp, '', 1, false), '', `#/day/${date}`)}
    ${stat('Stappen', num(raw.steps), '', '', '', `#/day/${date}`)}
    ${stat('Huidtemp.', raw.tempDev != null ? (raw.tempDev >= 0 ? '+' : '') + num(raw.tempDev, 1) : '–', '°C', raw.spo2 ? `SpO₂ ${num(raw.spo2, 1)}%` : '', '', `#/day/${date}`)}
  </div>` : '';

  const empty = !raw && !strain?.sessions?.length;
  const lastSync = S.lastSyncAt ? `Laatst gesynchroniseerd ${fmtRel(S.lastSyncAt)}` : '';

  return `${largeTitle(fmtDayTitle(date), '', `${syncBtn()}${avatar()}`)}
  ${syncHeader()}
  ${S.syncError ? `<div class="card small" style="color:var(--red)">${esc(S.syncError)} <a href="#" data-act="relogin">Opnieuw inloggen</a></div>` : ''}
  ${dayNav(date, '#/today')}
  <div class="fade-in">
  ${rings}
  ${empty ? `<div class="card center muted">${S.days.length ? 'Geen data voor deze dag.' : 'Nog geen data. Tik op ↻ om te synchroniseren.'}</div>` : ''}
  ${insightsCard}
  ${!empty ? `<div class="section-title">Activiteiten <button data-go="#/log/new/${date}">+ Kracht</button></div>
  <div class="list">${acts.length ? acts.join('') : `<div class="row"><div class="grow muted small">Geen activiteiten. Log je krachttraining met “+ Kracht”.</div></div>`}</div>` : `<button class="btn secondary" data-go="#/log/new/${date}">${I.plus} Krachttraining loggen</button>`}
  ${stats ? `<div class="section-title">Statistieken <a href="#/day/${date}">Alle data</a></div>${stats}` : ''}
  <p class="center tiny muted mt">${esc(lastSync)}</p>
  </div>`;
}

function fmtRel(ms) {
  const d = (Date.now() - ms) / 60000;
  if (d < 1) return 'zojuist';
  if (d < 60) return `${Math.round(d)} min geleden`;
  if (d < 1440) return `${Math.round(d / 60)} uur geleden`;
  return `${Math.round(d / 1440)} dagen geleden`;
}

function contribRow(label, value, z, weight, detail) {
  const w = clamp(Math.abs(z) / 3, 0, 1) * 50;
  const color = z >= 0 ? 'var(--green)' : 'var(--red)';
  const style = z >= 0 ? `left:50%;width:${w}%` : `left:${50 - w}%;width:${w}%`;
  return `<div class="contrib"><div><div>${esc(label)}</div><div class="small muted">${detail}</div></div><div style="text-align:right;font-weight:600">${value}</div><div class="bar"><span style="${style};background:${color}"></span></div></div>`;
}

function viewRecovery(date) {
  const m = M(date);
  const r = m?.recovery;
  const days30 = lastDays(S.computed.byDate, date, 30);
  const color = recoveryColor(r?.score);
  const zone = recoveryZone(r?.score);
  const zoneText = { green: 'Je bent goed hersteld en klaar om te presteren.', yellow: 'Je lichaam is redelijk hersteld. Train, maar luister naar je lichaam.', red: 'Je lichaam heeft rust nodig. Neem het vandaag rustig.' }[zone] || 'Geen herstelgegevens voor deze dag.';
  const hrvPts = days30.map((d) => ({ date: d.date, value: d.recovery?.hrv ?? null }));
  const rhrPts = days30.map((d) => ({ date: d.date, value: d.recovery?.rhr ?? null }));
  const hrvBase = r?.baseline?.hrv;
  const contrib = r ? [
    contribRow('Hartslagvariabiliteit', `${num(r.hrv)} ms`, r.z.hrv, r.weights.hrv, `baseline ${num(hrvBase)} ms`),
    contribRow('Rusthartslag (slaap)', `${num(r.rhr)} bpm`, r.z.rhr, r.weights.rhr, `baseline ${num(r.baseline.rhr)} bpm`),
    contribRow('Slaapprestatie', pct(m.sleep?.perf), r.z.sleep, r.weights.sleep, m.sleep ? `${fmtHM(m.sleep.asleep)} van ${fmtHM(m.sleep.need)} nodig` : 'geen slaap'),
    r.resp != null ? contribRow('Ademhaling', `${num(r.resp, 1)} /min`, r.z.resp, r.weights.resp, `baseline ${num(r.baseline.resp, 1)}`) : '',
    r.tempDev != null ? contribRow('Huidtemperatuur', `${r.tempDev >= 0 ? '+' : ''}${num(r.tempDev, 1)} °C`, r.z.temp, r.weights.temp, 't.o.v. je baseline') : '',
  ].join('') : '';
  return `${navbar('Herstel', `#/today/${date}`)}
  <div class="content fade-in">
  ${dayNav(date, '#/recovery')}
  <div class="card hero">${ring({ frac: (r?.score || 0) / 100, color, label: r ? `${r.score}%` : '–', sub: r?.calibrating ? 'kalibreren' : '', size: 190, stroke: 16 })}<div class="big">${esc(zoneText)}</div></div>
  ${r ? `<div class="card"><h2>Wat bepaalt je herstel</h2>${contrib}<p class="tiny muted" style="margin:8px 0 0">Balk naar rechts = beter dan je persoonlijke 30-daagse baseline. HRV weegt het zwaarst (50%), dan rusthartslag en slaap (20% elk).</p></div>` : ''}
  <div class="section-title">Herstel · 30 dagen</div>
  <div class="card">${bars(days30.map((d) => ({ date: d.date, value: d.recovery?.score ?? null, color: recoveryColor(d.recovery?.score) })), { max: 100, labelEvery: 5, fmt: (v) => `${v}` })}
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
  <div class="content fade-in">
  ${dayNav(date, '#/strain')}
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
    ${acts.map((a) => `<div class="row"><div class="badge" style="background:var(--strain)">${/run/i.test(a.type) ? I.run : I.flame}</div><div class="grow"><div class="title">${esc(a.name)}</div><div class="sub">${fmtTime(a.start)}–${fmtTime(a.end)} · ${fmtDur(a.duration)}${a.avgHr ? ` · gem. ${a.avgHr} bpm` : ''}${a.maxHr ? ` · max ${a.maxHr}` : ''}${a.calories ? ` · ${num(a.calories)} kcal` : ''}</div></div><div class="val"><b style="color:var(--strain)">${fmtStrain(a.strain)}</b></div></div>`).join('')}
  </div>` : ''}
  <div class="section-title">Strain · 7 dagen</div>
  <div class="card">${bars(days7.map((d) => ({ date: d.date, value: d.strain?.score ?? null, color: 'var(--strain)' })), { max: 21, fmt: fmtStrain })}</div>
  </div>`;
}

function viewSleep(date) {
  const m = M(date);
  const s = m?.sleep;
  const days14 = lastDays(S.computed.byDate, date, 14);
  const advice = date === today() ? bedtimeAdvice(m, toMin(S.settings.wake)) : null;
  const parts = s && !s.classic ? [
    { label: 'Wakker', value: s.awake, color: 'var(--st-awake)' },
    { label: 'Licht', value: s.light, color: 'var(--st-light)' },
    { label: 'Diep (SWS)', value: s.deep, color: 'var(--st-deep)' },
    { label: 'REM', value: s.rem, color: 'var(--st-rem)' },
  ] : s ? [{ label: 'Wakker', value: s.awake, color: 'var(--st-awake)' }, { label: 'Slaap', value: s.asleep, color: 'var(--st-light)' }] : [];
  return `${navbar('Slaap', `#/today/${date}`)}
  <div class="content fade-in">
  ${dayNav(date, '#/sleep')}
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
    <div class="kv mt">${parts.map((p) => `<div><span class="dot" style="background:${p.color}"></span>&nbsp; ${p.label}</div><div>${fmtDur(p.value)} · ${s.inBed ? Math.round((p.value / s.inBed) * 100) : 0}%</div>`).join('')}</div></div>
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
  <div class="section-title">Slaap · 14 dagen</div>
  <div class="card">${bars(days14.map((d) => ({ date: d.date, value: d.sleep ? d.sleep.asleep / 60 : null, color: d.sleep && d.sleep.perf >= 0.85 ? 'var(--sleep)' : 'rgba(125,122,255,.5)' })), { fmt: (v) => num(v, 1), labelEvery: 2 })}
  <div class="legend"><span><i style="background:var(--sleep)"></i>≥ 85% van behoefte</span><span>gem. ${fmtHM(mean(days14.map((d) => d.sleep?.asleep)))}</span></div></div>
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
  <div class="content fade-in">
  ${dayNav(date, '#/day')}
  <div class="section-title">Hartslag per minuut</div>
  <div class="card">${hrDay(raw, { maxHr: S.computed.maxHr, activities: m?.strain?.activities || [] })}</div>
  <div class="section-title">Gemeten (Fitbit)</div>
  <div class="card">${rows.length ? `<div class="kv">${rows.join('')}</div>` : '<div class="muted">Geen data</div>'}</div>
  <div class="section-title">Berekend</div>
  <div class="card">${c.length ? `<div class="kv">${c.join('')}</div>` : '<div class="muted">Geen data</div>'}</div>
  ${m?.sleep ? `<div class="section-title">Slaapfasen</div><div class="card">${hypnogram(m.sleep)}<div class="small muted mt">${(m.sleep.stages || []).length} segmenten · ${fmtTime(m.sleep.start)}–${fmtTime(m.sleep.end)}</div></div>` : ''}
  ${(raw?.exercises || []).length ? `<div class="section-title">Activiteiten (Fitbit)</div><div class="list">${raw.exercises.map((e) => `<div class="row"><div class="grow"><div class="title">${esc(e.name)}</div><div class="sub">${esc(e.type)} · ${fmtTime(e.start)}–${fmtTime(e.end)} · ${fmtDur(e.duration)}${e.avgHr ? ` · ${e.avgHr} bpm` : ''}${e.calories ? ` · ${num(e.calories)} kcal` : ''}${e.distanceKm ? ` · ${num(e.distanceKm, 2)} km` : ''}</div></div></div>`).join('')}</div>` : ''}
  ${rawJson ? `<div class="section-title">Ruwe data</div><details class="card"><summary class="small muted">Toon JSON</summary><pre class="raw">${esc(rawJson)}</pre></details>` : ''}
  </div>`;
}

let trendRange = 30;
function viewTrends() {
  const end = today();
  const n = trendRange;
  const ds = lastDays(S.computed.byDate, end, n);
  const le = n <= 7 ? 1 : n <= 30 ? 5 : 15;
  const avg = (f) => mean(ds.map(f));
  // Weekelijkse spierbelasting
  const weeks = [];
  for (let w = Math.ceil(n / 7) - 1; w >= 0; w--) {
    const wEnd = addDays(end, -w * 7);
    const wd = lastDays(S.computed.byDate, wEnd, 7);
    weeks.push({ date: addDays(wEnd, -6), label: fmtDateShort(addDays(wEnd, -6)), value: wd.reduce((a, d) => a + (d.strain?.sessions || []).reduce((x, s) => x + s.load, 0), 0) });
  }
  return `${largeTitle('Trends', '', avatar())}
  <div class="segmented">${[7, 30, 90].map((r) => `<button class="${r === n ? 'on' : ''}" data-act="range" data-v="${r}">${r === 7 ? 'Week' : r === 30 ? 'Maand' : '3 maanden'}</button>`).join('')}</div>
  <div class="fade-in">
  <div class="stats three">
    ${stat('Herstel', num(avg((d) => d.recovery?.score)), '%')}
    ${stat('Strain', fmtStrain(avg((d) => d.strain?.score || null)))}
    ${stat('Slaap', fmtHM(avg((d) => d.sleep?.asleep)))}
  </div>
  <div class="section-title">Herstel</div>
  <div class="card">${bars(ds.map((d) => ({ date: d.date, value: d.recovery?.score ?? null, color: recoveryColor(d.recovery?.score) })), { max: 100, labelEvery: le })}</div>
  <div class="section-title">Strain</div>
  <div class="card">${bars(ds.map((d) => ({ date: d.date, value: d.strain?.score || null, color: 'var(--strain)' })), { max: 21, labelEvery: le, fmt: fmtStrain })}</div>
  <div class="section-title">Slaap (uren)</div>
  <div class="card">${bars(ds.map((d) => ({ date: d.date, value: d.sleep ? d.sleep.asleep / 60 : null, color: 'var(--sleep)' })), { labelEvery: le, fmt: (v) => num(v, 1) })}</div>
  <div class="section-title">HRV</div>
  <div class="card">${line(ds.map((d) => ({ date: d.date, value: d.recovery?.hrv ?? null })), { color: 'var(--green)', fmt: (v) => `${Math.round(v)} ms`, dots: n <= 30 })}</div>
  <div class="section-title">Rusthartslag</div>
  <div class="card">${line(ds.map((d) => ({ date: d.date, value: d.recovery?.rhr ?? null })), { color: 'var(--hr)', fmt: (v) => `${Math.round(v)}`, dots: n <= 30 })}</div>
  <div class="section-title">Ademhaling</div>
  <div class="card">${line(ds.map((d) => ({ date: d.date, value: d.raw?.resp ?? null })), { color: 'var(--z1)', fmt: (v) => num(v, 1), dots: n <= 30 })}</div>
  <div class="section-title">Spierbelasting per week</div>
  <div class="card">${bars(weeks, { fmt: (v) => num(v, 0) })}</div>
  <div class="section-title">Stappen</div>
  <div class="card">${bars(ds.map((d) => ({ date: d.date, value: d.raw?.steps ?? null, color: 'var(--muscle)' })), { labelEvery: le, fmt: (v) => `${Math.round(v / 1000)}k` })}</div>
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

let showAllSessions = false;
function viewStrength() {
  const sessions = S.strength.sessions.filter((s) => !s.deleted).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : (b.createdAt || 0) - (a.createdAt || 0)));
  const loads = S.computed.loads;
  const wk = weekGroups(today());
  const order = [...UPPER, ...LOWER, 'core'];
  const maxSets = Math.max(10, ...Object.values(wk.sets));
  const exs = allExercises(S.strength.sessions, { exerciseMap: S.strength.exerciseMap }).slice(0, 12);
  const byMonth = {};
  for (const s of sessions.slice(0, showAllSessions ? 1000 : 10)) {
    const k = s.date ? s.date.slice(0, 7) : 'zonder datum';
    (byMonth[k] ||= []).push(s);
  }
  const monthName = (k) => (k === 'zonder datum' ? 'Zonder datum' : new Date(k + '-01T12:00').toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' }));
  return `${largeTitle('Kracht', '', `<button class="icon-btn" data-go="#/log/new" aria-label="Nieuwe training">${I.plus}</button>${avatar()}`)}
  <div class="fade-in">
  <div class="stats three">
    ${stat('Deze week', wk.count, wk.count === 1 ? 'sessie' : 'sessies')}
    ${stat('Spierbelasting', num(wk.load, 0))}
    ${stat('Zware sets', num(Object.values(wk.sets).reduce((a, b) => a + b, 0), 0), '', 'geschat')}
  </div>
  <div class="section-title">Spiergroepen · 7 dagen</div>
  <div class="card">${order.map((g) => `<div class="mg"><span>${GROUPS[g]}</span><div class="meter"><span style="width:${((wk.sets[g] || 0) / maxSets) * 100}%;background:${(wk.sets[g] || 0) >= 10 ? 'var(--green)' : (wk.sets[g] || 0) >= 5 ? 'var(--muscle)' : 'var(--text3)'}"></span></div><span class="n">${num(wk.sets[g] || 0, 0)}</span></div>`).join('')}
    <p class="tiny muted" style="margin:8px 0 0">Geschatte zware sets per spiergroep (${S.settings.defaultSets} sets per oefening, verdeeld over de betrokken spieren). 10+ per week is een goede richtlijn voor groei.</p></div>
  <div class="btn-row mt"><button class="btn" data-go="#/log/new">${I.plus} Training loggen</button><button class="btn secondary" data-go="#/import">${I.doc} Notities</button></div>
  ${sessions.length ? Object.entries(byMonth).map(([k, list]) => `<div class="list-header">${esc(monthName(k))}</div><div class="list">${list.map((s) => `<button class="row tap" data-go="#/session/${s.id}"><div class="grow"><div class="title">${esc(s.name || 'Training')}</div><div class="sub">${s.date ? `${weekdayShort(s.date)} ${fmtDateShort(s.date)}` : 'geen datum'} · ${s.exercises.length} oefeningen${(loads[s.id]?.exercises || []).some((e) => e.isPR) ? ' · 🏆 PR' : ''}</div></div><div class="val">${num(loads[s.id]?.load, 1)}</div><span class="chev">${I.chev}</span></button>`).join('')}</div>`).join('') : `<div class="card center muted mt">Nog geen trainingen. Log je topsets of plak je notities.</div>`}
  ${exs.length ? `<div class="section-title">Oefeningen</div><div class="list">${exs.map((e) => {
    const h = exerciseHistory(S.strength.sessions, e.key, { ...S.settings, exerciseMap: S.strength.exerciseMap });
    const last = h[h.length - 1];
    return `<button class="row tap" data-go="#/exercise/${encodeURIComponent(e.key)}"><div class="grow"><div class="title">${esc(e.name)}</div><div class="sub">${esc(e.lib.name)} · ${e.count}× · laatst ${last ? `${num(last.weight, 1)} kg × ${last.reps}` : '–'}</div></div>${spark(h.slice(-12).map((x) => x.e1rm), { color: 'var(--muscle)', w: 64, h: 24 })}<span class="chev">${I.chev}</span></button>`;
  }).join('')}</div>${allExercises(S.strength.sessions, {}).length > 12 ? `<button class="btn secondary" data-go="#/exercises">Alle oefeningen</button>` : ''}` : ''}
  </div>`;
}

function viewExercises() {
  const exs = allExercises(S.strength.sessions, { exerciseMap: S.strength.exerciseMap });
  return `${navbar('Oefeningen', '#/strength')}<div class="content fade-in"><div class="list">${exs.map((e) => `<button class="row tap" data-go="#/exercise/${encodeURIComponent(e.key)}"><div class="grow"><div class="title">${esc(e.name)}</div><div class="sub">${esc(e.lib.name)} · ${e.count}×</div></div><span class="chev">${I.chev}</span></button>`).join('')}</div></div>`;
}

function viewSession(id) {
  const s = S.strength.sessions.find((x) => x.id === id);
  if (!s) return `${navbar('Training', '#/strength')}<div class="content card muted">Niet gevonden.</div>`;
  const r = S.computed.loads[id] || { exercises: [], groups: {}, load: 0 };
  const groups = Object.entries(r.groups).sort((a, b) => b[1] - a[1]);
  const maxG = Math.max(1, ...groups.map((g) => g[1]));
  const m = s.date ? M(s.date) : null;
  const sess = m?.strain?.sessions?.find((x) => x.id === id);
  return `${navbar(s.name || 'Training', '#/strength', `<button class="back" data-go="#/log/${id}">Wijzig</button>`)}
  <div class="content fade-in">
  ${largeTitle(s.name || 'Training', s.date ? fmtDateLong(s.date) : 'Geen datum')}
  <div class="stats">
    ${stat('Spierbelasting', num(r.load, 1), '', `+${num(r.load * 3.2)} strain-punten`)}
    ${stat('Dag-strain', m ? fmtStrain(m.strain.score) : '–', '', sess?.activity ? `cardio tijdens training ${fmtStrain(sess.activity.strain)}` : '')}
  </div>
  <div class="section-title">Topsets</div>
  <div class="list">${r.exercises.map((e) => `<button class="row tap" data-go="#/exercise/${encodeURIComponent(e.key)}"><div class="grow"><div class="title">${esc(e.name)} ${e.isPR ? '<span class="pill pr">PR</span>' : ''}</div><div class="sub">${esc(e.libName)} · e1RM ${num(e.e1rm, 1)} kg · belasting ${num(e.load, 1)}${e.note ? ` · ${esc(e.note)}` : ''}</div></div><div class="val"><b style="color:var(--text)">${e.bw ? (e.weight ? `BW+${num(e.weight, 1)}` : 'BW') : num(e.weight, 1)}</b>${e.bw && !e.weight ? '' : ' kg'} × ${e.reps}</div></button>`).join('')}</div>
  <div class="section-title">Spiergroepen</div>
  <div class="card">${groups.map(([g, v]) => `<div class="mg"><span>${GROUPS[g] || g}</span><div class="meter"><span style="width:${(v / maxG) * 100}%;background:var(--muscle)"></span></div><span class="n">${num(v, 1)}</span></div>`).join('')}</div>
  <button class="btn secondary" data-go="#/log/${id}">Bewerken</button>
  </div>`;
}

function viewExercise(key) {
  const h = exerciseHistory(S.strength.sessions, key, { ...S.settings, exerciseMap: S.strength.exerciseMap });
  const name = h[h.length - 1]?.name || key;
  const lib = matchExercise(name, S.strength.exerciseMap);
  const best = h.reduce((a, e) => (e.e1rm > (a?.e1rm || 0) ? e : a), null);
  return `${navbar(name, '#/strength')}
  <div class="content fade-in">
  ${largeTitle(name, lib.name)}
  <div class="stats">
    ${stat('Beste e1RM', num(best?.e1rm, 1), 'kg', best ? `${num(best.weight, 1)} kg × ${best.reps} · ${fmtDateShort(best.date)}` : '')}
    ${stat('Laatste', h.length ? `${num(h[h.length - 1].weight, 1)}` : '–', 'kg', h.length ? `× ${h[h.length - 1].reps} · ${fmtDateShort(h[h.length - 1].date)}` : '')}
  </div>
  <div class="section-title">Geschatte 1RM</div>
  <div class="card">${line(h.map((e) => ({ date: e.date, value: e.e1rm ? Math.round(e.e1rm * 10) / 10 : null })), { color: 'var(--muscle)', fmt: (v) => `${num(v, 1)} kg` })}</div>
  <div class="list-header">Spiergroep-indeling</div>
  <div class="list"><div class="row"><div class="grow">Type oefening</div><select data-act="map-ex" data-key="${esc(key)}">${[...LIBRARY.filter((l) => l.id !== 'press'), { id: 'other', name: 'Overig' }].map((l) => `<option value="${l.id}" ${l.id === lib.id ? 'selected' : ''}>${esc(l.name)}</option>`).join('')}</select></div></div>
  <div class="list-footer">Bepaalt welke spieren meetellen: ${Object.entries(lib.g).map(([g, w]) => `${GROUPS[g]} ${Math.round(w * 100)}%`).join(', ')}.</div>
  <div class="list-header">Geschiedenis</div>
  <div class="list">${[...h].reverse().map((e) => `<button class="row tap" data-go="#/session/${e.sessionId}"><div class="grow"><div class="title">${num(e.weight, 1)} kg × ${e.reps} ${e.isPR ? '<span class="pill pr">PR</span>' : ''}</div><div class="sub">${fmtDateShort(e.date)} · ${esc(e.session || '')}</div></div><div class="val">${num(e.e1rm, 1)}</div></button>`).join('')}</div>
  </div>`;
}

function viewLog(id, presetDate) {
  let d = S.editDraft;
  if (!d || d._for !== (id || 'new')) {
    const src = id && id !== 'new' ? S.strength.sessions.find((s) => s.id === id) : null;
    d = src ? JSON.parse(JSON.stringify(src)) : newSession(presetDate || today());
    if (!d.exercises.length) d.exercises.push({ name: '', weight: null, reps: null });
    d._for = id || 'new';
    S.editDraft = d;
  }
  const recentNames = [...new Set(S.strength.sessions.filter((s) => !s.deleted).sort((a, b) => (a.date < b.date ? 1 : -1)).map((s) => s.name).filter(Boolean))].slice(0, 6);
  const chips = [...new Set([...recentNames, 'Upper 6', 'Upper 7', 'Lower', 'Push', 'Pull', 'Legs'])].slice(0, 8);
  const exNames = allExercises(S.strength.sessions, {}).map((e) => e.name);
  const isNew = d._for === 'new';
  return `${navbar(isNew ? 'Nieuwe training' : 'Bewerken', isNew ? (presetDate ? `#/today/${presetDate}` : '#/strength') : `#/session/${id}`, `<button class="back" data-act="save-log" style="font-weight:600">Bewaar</button>`)}
  <div class="content fade-in">
  <div class="list">
    <div class="row"><div class="grow">Datum</div><input type="date" id="log-date" value="${esc(d.date || '')}" max="${today()}"></div>
    <div class="row"><div class="grow">Naam</div><input type="text" id="log-name" value="${esc(d.name || '')}" placeholder="bijv. Upper 6"></div>
  </div>
  <div class="chips">${chips.map((c) => `<button class="chip" data-act="chip-name" data-v="${esc(c)}">${esc(c)}</button>`).join('')}${recentNames.length ? `<button class="chip" data-act="copy-last">↺ Kopieer vorige “${esc(d.name || recentNames[0])}”</button>` : ''}</div>
  <div class="list" id="ex-list">
    <div class="ex-head"><span>Oefening</span><span>kg</span><span>reps</span><span></span></div>
    ${d.exercises.map((e, i) => exRow(e, i)).join('')}
  </div>
  <datalist id="ex-names">${exNames.map((n) => `<option value="${esc(n)}">`).join('')}</datalist>
  <button class="btn secondary" data-act="add-ex">${I.plus} Oefening</button>
  <p class="small muted mt">Noteer alleen je topset. Gebruik 0 kg + “BW” in de naam voor bodyweight-oefeningen. Belasting wordt geschat met ${S.settings.defaultSets} zware sets per oefening (aan te passen in Profiel).</p>
  <div class="list-header">Snel plakken</div>
  <textarea class="notes" id="quick" style="min-height:90px" placeholder="Chest press 80 x 8&#10;Lat pulldown 70 x 10"></textarea>
  <button class="btn secondary mt" data-act="quick-add">Regels toevoegen</button>
  ${!isNew ? `<div style="height:24px"></div><button class="btn danger" data-act="delete-log">${I.trash} Verwijder training</button>` : ''}
  </div>`;
}

function lastSet(name) {
  const k = exKey(name);
  if (!k) return null;
  const h = exerciseHistory(S.strength.sessions, k, { ...S.settings, exerciseMap: S.strength.exerciseMap });
  return h[h.length - 1] || null;
}

function exRow(e, i) {
  const last = e.name ? lastSet(e.name) : null;
  return `<div class="ex-edit" data-i="${i}">
    <input type="text" list="ex-names" data-f="name" value="${esc(e.name || '')}" placeholder="Oefening" autocomplete="off">
    <input class="num" type="number" inputmode="decimal" step="0.5" data-f="weight" value="${e.weight ?? ''}" placeholder="${last ? num(last.weight, 1) : 'kg'}">
    <input class="num" type="number" inputmode="numeric" data-f="reps" value="${e.reps ?? ''}" placeholder="${last ? last.reps : 'reps'}">
    <button class="x" data-act="del-ex" data-i="${i}" aria-label="Verwijder">${I.minus}</button>
  </div>`;
}

function viewImport() {
  const draft = S.importDraft;
  const existing = new Set(S.strength.sessions.filter((s) => !s.deleted).map((s) => `${s.date}|${(s.name || '').toLowerCase()}`));
  return `${navbar('Notities importeren', '#/strength')}
  <div class="content fade-in">
  <p class="small muted" style="margin-top:0">Plak je trainingsnotities (bijv. uit Apple Notities). Koppen met een naam en/of datum starten een nieuwe training, zoals <code>Upper 6 – 3/11</code> of <code>ma 3 nov</code>. Regels als <code>Chest press 80 x 8</code>, <code>Leg press 200kg 10</code> of <code>Curl 14/12</code> worden oefeningen.</p>
  <textarea class="notes" id="notes" placeholder="Upper 6 - 3/11&#10;Chest press 80 x 8&#10;Lat pulldown 70 x 10&#10;Shoulder press 30 x 9&#10;&#10;Upper 7 - 5/11&#10;Incline press 70 x 9&#10;...">${esc(draft?.text || '')}</textarea>
  <button class="btn mt" data-act="parse">Voorbeeld</button>
  ${draft?.result ? `
    <div class="section-title">${draft.result.sessions.length} trainingen gevonden</div>
    ${draft.result.sessions.map((s, i) => {
      const dup = existing.has(`${s.date}|${(s.name || '').toLowerCase()}`);
      return `<div class="card" style="padding:12px 14px">
        <div style="display:flex;gap:10px;align-items:center">
          <input type="checkbox" data-imp="${i}" ${s._skip ? '' : 'checked'} style="width:20px;height:20px">
          <input class="field" style="padding:8px 10px;font-size:15px;flex:1" data-imp-name="${i}" value="${esc(s.name)}">
          <input type="date" class="field" style="padding:8px 6px;font-size:14px;width:150px" data-imp-date="${i}" value="${esc(s.date || '')}" max="${today()}">
        </div>
        ${!s.date ? '<div class="small" style="color:var(--yellow);margin-top:6px">Geen datum gevonden — vul hem in.</div>' : ''}
        ${dup ? '<div class="small" style="color:var(--yellow);margin-top:6px">Lijkt al te bestaan (zelfde datum en naam).</div>' : ''}
        <div class="small muted" style="margin-top:8px;line-height:1.6">${s.exercises.map((e) => `${esc(e.name)} <b style="color:var(--text)">${e.bw ? (e.weight ? 'BW+' + num(e.weight, 1) : 'BW') : num(e.weight, 1) + ' kg'} × ${e.reps}</b> <span class="tiny">(${esc(matchExercise(e.name, S.strength.exerciseMap).name)})</span>`).join('<br>')}</div>
      </div>`;
    }).join('')}
    ${draft.result.skipped.length ? `<details class="card small"><summary class="muted">${draft.result.skipped.length} regels overgeslagen</summary><pre class="raw">${esc(draft.result.skipped.join('\n'))}</pre></details>` : ''}
    ${draft.result.sessions.length ? `<button class="btn" data-act="do-import">Importeer</button>` : ''}
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
    <button class="row tap" data-act="full-sync"><div class="badge" style="background:var(--card2);color:var(--text)">${I.download}</div><div class="grow"><div class="title">Alles opnieuw ophalen</div><div class="sub">laatste 45 dagen</div></div></button>` : ''}
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
  </div>
  <div class="list-header">Weergave</div>
  <div class="list">${row('Thema', `<select data-set="theme"><option value="auto" ${st.theme === 'auto' ? 'selected' : ''}>Automatisch</option><option value="dark" ${st.theme === 'dark' ? 'selected' : ''}>Donker</option><option value="light" ${st.theme === 'light' ? 'selected' : ''}>Licht</option></select>`)}</div>

  <div class="list-header">Data</div>
  <div class="list">
    <button class="row tap" data-act="export"><div class="grow">Exporteer back-up (JSON)</div><span class="chev">${I.chev}</span></button>
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
  <p class="small">Per oefening: <i>sets × lichaamsbelasting van de oefening × intensiteit × rep-factor</i>. De intensiteit is je geschatte 1RM (Epley: gewicht × (1 + reps/30)) gedeeld door je beste 1RM op die oefening. Grote oefeningen (leg press, hack squat, rows) wegen zwaarder dan isolatie (curls, lateral raises). Omdat je alleen je topset noteert, rekenen we standaard met ${S.settings.defaultSets} zware sets per oefening. Elke punt spierbelasting telt als 3,2 belastingspunten in je dag-strain.</p></div>
  <div class="card"><h2 style="color:var(--sleep)">Slaap</h2>
  <p class="small"><b>Slaapbehoefte</b> = basisbehoefte (${fmtHM(S.settings.sleepNeed)}) + extra door de strain van gisteren (tot 40 min) + slaapschuld van de afgelopen nachten − dutjes. <b>Slaapprestatie</b> = geslapen ÷ behoefte. Daarnaast: efficiëntie (geslapen ÷ in bed), consistentie (hoe constant je bed- en wektijden zijn) en herstellende slaap (diep + REM).</p></div>
  <p class="tiny muted center">Geïnspireerd op hoe WHOOP data interpreteert; de exacte formules van WHOOP zijn niet openbaar, dit is een eigen benadering.</p>
  </div>`;
}

// ---------------------------------------------------------------- router

function parseRoute() {
  const h = location.hash.replace(/^#\/?/, '');
  const [name, a, b] = h.split('/');
  return { name: name || 'today', a: a ? decodeURIComponent(a) : null, b: b || null };
}

function tabbar(active) {
  const tabs = [['today', 'Vandaag', I.today], ['trends', 'Trends', I.chart], ['strength', 'Kracht', I.dumbbell], ['settings', 'Profiel', I.person]];
  return `<nav class="tabbar"><div class="inner">${tabs.map(([k, l, ic]) => `<a href="#/${k}" class="${active === k ? 'on' : ''}">${ic}<span>${l}</span></a>`).join('')}</div></nav>`;
}

let lastRoute = '';
function render() {
  const r = parseRoute();
  const loggedIn = store.isDemo() || auth.hasEverLoggedIn() || S.days.length > 0 || S.strength.sessions.length > 0;
  let html;
  let tab = null;
  if (!loggedIn && !['setup', 'welcome', 'about'].includes(r.name)) r.name = 'welcome';
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
    case 'settings': html = viewSettings(); tab = 'settings'; break;
    case 'about': html = viewAbout(); tab = 'settings'; break;
    default: html = viewToday(r.a && /^\d{4}-\d{2}-\d{2}$/.test(r.a) ? (r.a > today() ? today() : r.a) : today()); tab = 'today';
  }
  const showTabs = loggedIn && !['welcome', 'setup', 'log'].includes(r.name);
  app.innerHTML = html + (showTabs ? tabbar(tab || 'today') : '');
  const key = location.hash;
  if (key !== lastRoute) { window.scrollTo(0, 0); lastRoute = key; }
}

// ---------------------------------------------------------------- events

function readDraftFromDom() {
  const d = S.editDraft;
  if (!d) return;
  const date = document.getElementById('log-date');
  const name = document.getElementById('log-name');
  if (date) d.date = date.value;
  if (name) d.name = name.value.trim();
  document.querySelectorAll('.ex-edit').forEach((row) => {
    const i = +row.dataset.i;
    const e = d.exercises[i];
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
  relogin() { auth.login({ silent: false }); },
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
  'all-sessions'() { showAllSessions = true; render(); },
  'chip-name'(el) { readDraftFromDom(); S.editDraft.name = el.dataset.v; render(); },
  'copy-last'() {
    readDraftFromDom();
    const name = S.editDraft.name;
    const list = S.strength.sessions.filter((s) => !s.deleted && s.id !== S.editDraft.id).sort((a, b) => (a.date < b.date ? 1 : -1));
    const src = (name && list.find((s) => s.name.toLowerCase() === name.toLowerCase())) || list[0];
    if (!src) return;
    S.editDraft.name = S.editDraft.name || src.name;
    S.editDraft.exercises = src.exercises.map((e) => ({ name: e.name, weight: null, reps: null, bw: e.bw }));
    render();
    toast(`Oefeningen van ${src.name} (${fmtDateShort(src.date)}) overgenomen`);
  },
  'add-ex'() { readDraftFromDom(); S.editDraft.exercises.push({ name: '', weight: null, reps: null }); render(); const rows = document.querySelectorAll('.ex-edit input[data-f="name"]'); rows[rows.length - 1]?.focus(); },
  'del-ex'(el) { readDraftFromDom(); S.editDraft.exercises.splice(+el.dataset.i, 1); render(); },
  'quick-add'() {
    readDraftFromDom();
    const txt = document.getElementById('quick').value;
    const r = parseNotes(txt);
    const exs = r.sessions.flatMap((s) => s.exercises);
    if (!exs.length) { toast('Geen oefeningen herkend'); return; }
    S.editDraft.exercises = S.editDraft.exercises.filter((e) => e.name || e.weight || e.reps).concat(exs);
    render();
    toast(`${exs.length} oefeningen toegevoegd`);
  },
  async 'save-log'() {
    readDraftFromDom();
    const d = S.editDraft;
    // Lege regels negeren; gewicht leeg = vorige waarde (placeholder) overnemen.
    d.exercises = d.exercises.filter((e) => e.name && e.name.trim()).map((e) => {
      const last = (e.weight == null || e.reps == null) ? lastSet(e.name) : null;
      const bw = e.bw || /\bbw\b|bodyweight/i.test(e.name);
      return { name: e.name.trim(), weight: e.weight ?? last?.weight ?? 0, reps: e.reps ?? last?.reps ?? null, bw, sets: e.sets || null, note: e.note || '' };
    }).filter((e) => e.reps);
    if (!d.exercises.length) { toast('Voeg minstens één oefening met reps toe'); return; }
    if (!d.date) { toast('Kies een datum'); return; }
    const { _for, ...clean } = d;
    clean.name = clean.name || 'Training';
    clean.updatedAt = Date.now();
    await saveStrength((doc) => {
      const i = doc.sessions.findIndex((s) => s.id === clean.id);
      if (i >= 0) doc.sessions[i] = clean; else doc.sessions.push(clean);
    });
    S.editDraft = null;
    toast('Training bewaard');
    location.hash = `#/session/${clean.id}`;
  },
  async 'delete-log'() {
    if (!confirm('Deze training verwijderen?')) return;
    const id = S.editDraft.id;
    await saveStrength((doc) => {
      const s = doc.sessions.find((x) => x.id === id);
      if (s) { s.deleted = true; s.updatedAt = Date.now(); s.exercises = []; }
    });
    S.editDraft = null;
    location.hash = '#/strength';
  },
  parse() {
    const text = document.getElementById('notes').value;
    const result = parseNotes(text);
    S.importDraft = { text, result };
    render();
    setTimeout(() => document.querySelector('.section-title')?.scrollIntoView({ behavior: 'smooth' }), 50);
  },
  async 'do-import'() {
    const draft = S.importDraft;
    const chosen = [];
    draft.result.sessions.forEach((s, i) => {
      const cb = document.querySelector(`[data-imp="${i}"]`);
      const name = document.querySelector(`[data-imp-name="${i}"]`)?.value.trim();
      const date = document.querySelector(`[data-imp-date="${i}"]`)?.value;
      if (cb?.checked) chosen.push({ ...s, name: name || s.name, date: date || s.date });
    });
    const missing = chosen.filter((s) => !s.date);
    if (missing.length) { toast(`${missing.length} training(en) zonder datum`); return; }
    const now = Date.now();
    await saveStrength((doc) => {
      chosen.forEach((s, k) => doc.sessions.push({ id: uid(), date: s.date, name: s.name, exercises: s.exercises, createdAt: now + k, updatedAt: now + k }));
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
  },
};

document.addEventListener('click', (ev) => {
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
    if (['age', 'bodyweight', 'maxHr', 'defaultSets'].includes(k)) v = v === '' ? null : Number(v);
    if (k === 'defaultSets' && v != null) v = clamp(Math.round(v), 1, 10);
    await saveSettings({ [k]: v });
    if (k === 'theme' || k === 'maxHr' || k === 'age') render();
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
      if (data.strength) await saveStrength((doc) => { const m = mergeDocs(doc, data.strength); doc.sessions = m.sessions; doc.exerciseMap = m.exerciseMap; });
      recompute(); render(); toast('Back-up geïmporteerd');
    } catch (e) { toast('Importeren mislukt: ' + e.message); }
  }
});

// Naam in krachtlog → toon vorige topset als placeholder.
document.addEventListener('input', (ev) => {
  const el = ev.target;
  if (el.dataset?.f === 'name') {
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
  render();
});

// ---------------------------------------------------------------- boot

async function boot() {
  const redirect = auth.handleRedirect();
  await loadAll();
  S.lastSyncAt = await store.kv.get('lastSyncAt');
  S.syncLog = await store.kv.get('syncLog');
  if (redirect && !redirect.ok) {
    if (redirect.silent && (redirect.error === 'interaction_required' || redirect.error === 'login_required' || redirect.error === 'consent_required')) {
      S.syncError = 'Opnieuw inloggen nodig.';
    } else if (redirect.error !== 'state_mismatch') {
      S.syncError = `Inloggen mislukt: ${redirect.error}`;
    }
  }
  render();
  if (redirect?.ok) {
    if (redirect.missingScopes?.length) toast('Niet alle toestemmingen gegeven — sommige data ontbreekt mogelijk');
    if (store.isDemo()) { store.setDemo(false); await loadAll(); }
    await runSync({ interactive: false });
  } else if (!store.isDemo() && auth.hasEverLoggedIn()) {
    const stale = !S.lastSyncAt || Date.now() - S.lastSyncAt > 15 * 60000;
    if (stale && auth.getToken()) runSync({ interactive: false });
    else if (stale && Date.now() - (S.lastSyncAt || 0) > 3 * 3600000 && auth.canTrySilent()) auth.login({ silent: true });
  }
  S.lastSyncAt = await store.kv.get('lastSyncAt');
  S.syncLog = await store.kv.get('syncLog');
}

boot().catch((e) => {
  console.error(e);
  app.innerHTML = `<div class="card" style="margin-top:40px"><h2>Er ging iets mis</h2><pre class="raw">${esc(e.stack || e.message)}</pre></div>`;
});

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

// Bij terugkeren naar de app (bijv. vanuit achtergrond): ververs als data oud is.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && !store.isDemo() && auth.getToken() && S.lastSyncAt && Date.now() - S.lastSyncAt > 30 * 60000) runSync({ interactive: false });
});
