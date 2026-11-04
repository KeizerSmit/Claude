// Realtime hartslag via Bluetooth (standaard Heart Rate Profile, 0x180D).
// De Fitbit Air kan dit uitzenden: Google Health-app → Verbindingen → Hartslag delen.
// Werkt in Chrome (Android/Mac/Windows) en op iPhone in de Bluefy-browser.

const listeners = new Set();
const MAX_SAMPLES = 3600; // 1 uur bij 1 Hz

export const live = {
  state: 'idle', // idle | connecting | live | lost | error
  error: null,
  deviceName: null,
  samples: [], // {t, bpm}
  rr: [], // {t, ms}
  sessionStart: null,
  lastAt: null,
  device: null,
};

export function bluetoothSupported() {
  return typeof navigator !== 'undefined' && !!navigator.bluetooth;
}

export function onLive(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function emit() { for (const fn of listeners) { try { fn(live); } catch (e) { console.warn(e); } } }

function parse(dv) {
  const flags = dv.getUint8(0);
  let i = 1;
  const wide = flags & 0x01;
  const bpm = wide ? dv.getUint16(i, true) : dv.getUint8(i);
  i += wide ? 2 : 1;
  if (flags & 0x08) i += 2; // energy expended
  const rr = [];
  if (flags & 0x10) for (; i + 1 < dv.byteLength; i += 2) rr.push((dv.getUint16(i, true) / 1024) * 1000);
  return { bpm, rr };
}

function onValue(ev) {
  const { bpm, rr } = parse(ev.target.value);
  const t = Date.now();
  if (bpm > 0) {
    live.samples.push({ t, bpm });
    if (live.samples.length > MAX_SAMPLES) live.samples.splice(0, live.samples.length - MAX_SAMPLES);
  }
  for (const ms of rr) if (ms > 250 && ms < 2200) live.rr.push({ t, ms });
  if (live.rr.length > 600) live.rr.splice(0, live.rr.length - 600);
  live.lastAt = t;
  if (live.state !== 'live') live.state = 'live';
  emit();
}

async function attach(device) {
  const server = await device.gatt.connect();
  const svc = await server.getPrimaryService('heart_rate');
  const ch = await svc.getCharacteristic('heart_rate_measurement');
  ch.addEventListener('characteristicvaluechanged', onValue);
  await ch.startNotifications();
  live.state = 'live';
  live.sessionStart ||= Date.now();
  emit();
}

export async function connect() {
  if (!bluetoothSupported()) throw new Error('Bluetooth wordt niet ondersteund in deze browser.');
  live.state = 'connecting'; live.error = null; emit();
  try {
    const device = await navigator.bluetooth.requestDevice({ filters: [{ services: ['heart_rate'] }], optionalServices: ['battery_service'] });
    live.device = device;
    live.deviceName = device.name || 'Hartslagmeter';
    device.addEventListener('gattserverdisconnected', async () => {
      live.state = 'lost'; emit();
      // Automatisch opnieuw verbinden (bijv. even buiten bereik).
      for (let i = 0; i < 5 && live.device === device; i++) {
        await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
        try { await attach(device); return; } catch { /* nog niet */ }
      }
      if (live.device === device) { live.state = 'error'; live.error = 'Verbinding verbroken'; emit(); }
    });
    await attach(device);
  } catch (e) {
    live.state = e.name === 'NotFoundError' ? 'idle' : 'error';
    live.error = e.name === 'NotFoundError' ? null : e.message;
    emit();
    throw e;
  }
}

export function disconnect() {
  const d = live.device;
  live.device = null;
  live.state = 'idle';
  live.sessionStart = null;
  try { d?.gatt?.disconnect(); } catch { /* */ }
  emit();
}

export function current() {
  const s = live.samples[live.samples.length - 1];
  return s && Date.now() - s.t < 15000 ? s.bpm : null;
}

/** RMSSD over de laatste ~60 slagen (live HRV). */
export function liveRmssd() {
  const r = live.rr.slice(-61).map((x) => x.ms);
  if (r.length < 10) return null;
  let sum = 0;
  for (let i = 1; i < r.length; i++) sum += (r[i] - r[i - 1]) ** 2;
  return Math.sqrt(sum / (r.length - 1));
}

/** Samenvatting van de huidige sessie: tijd per zone, gem/max, TRIMP. */
export function sessionStats(maxHr, restHr, female = false) {
  const s = live.sessionStart ? live.samples.filter((x) => x.t >= live.sessionStart) : [];
  const zones = [0, 0, 0, 0, 0];
  let trimp = 0, sum = 0, mx = 0;
  for (let i = 0; i < s.length; i++) {
    const dt = i ? Math.min(5, (s[i].t - s[i - 1].t) / 1000) : 1;
    const v = s[i].bpm;
    sum += v; if (v > mx) mx = v;
    const f = v / maxHr;
    const z = f >= 0.9 ? 4 : f >= 0.8 ? 3 : f >= 0.7 ? 2 : f >= 0.6 ? 1 : f >= 0.5 ? 0 : -1;
    if (z >= 0) zones[z] += dt;
    const hrr = (v - restHr) / (maxHr - restHr);
    if (hrr >= 0.2) { const h = Math.min(hrr, 1.05); trimp += (dt / 60) * (female ? h * 0.86 * Math.exp(1.67 * h) : h * 0.64 * Math.exp(1.92 * h)); }
  }
  return { n: s.length, avg: s.length ? sum / s.length : null, max: mx || null, zones, trimp, durSec: s.length ? (s[s.length - 1].t - s[0].t) / 1000 : 0 };
}
