/* Instellingen voor het wandpaneel.
 * mode 'demo'          : nepdata, werkt zonder iets aan te sluiten (voor het design).
 * mode 'homeassistant' : leest live data uit Home Assistant via de REST API.
 *
 * Zet dit bestand samen met index.html/app.js/style.css in de map
 * /config/www/thuis/ van Home Assistant; open op de iPad dan
 *   http://<ip-van-home-assistant>:8123/local/thuis/index.html
 * Gebruik op de iPad bewust http (geen https): iOS 9 vertrouwt de
 * huidige Let's Encrypt-certificaten niet meer.
 *
 * Alle entity_id's hieronder zijn voorbeelden: vervang ze door de namen
 * die Home Assistant aan jouw apparaten geeft (Instellingen > Entiteiten).
 */
var HUB_CONFIG = {
  mode: 'demo',

  homeassistant: {
    url: '',                // leeg = dezelfde server als waar de pagina vandaan komt
    token: 'PLAK_HIER_EEN_LONG_LIVED_ACCESS_TOKEN', // Profiel > Beveiliging > Long-lived tokens
    pollMs: 5000
  },

  entities: {
    // HomeWizard P1-meter (vermogen in W, positief = afname, negatief = teruglevering)
    gridPower:      'sensor.p1_meter_power',
    gridImportToday:'sensor.p1_meter_energy_import',
    gridExportToday:'sensor.p1_meter_energy_export',
    // HomeWizard kWh-meter op de omvormer (zonnepanelen) en op de warmtepomp
    solarPower:     'sensor.kwh_meter_zon_power',
    solarToday:     'sensor.kwh_meter_zon_energy_today',
    heatPumpPower:  'sensor.kwh_meter_warmtepomp_power',
    // Honeywell (Evohome / Lyric) zones
    climateDown:    'climate.beneden',
    climateUp:      'climate.boven',
    // Ventilatie (bijv. Itho/Orcon/Zehnder via add-on)
    ventilation:    'fan.ventilatie',
    bathHumidity:   'sensor.badkamer_vochtigheid',
    // Weer (Buienradar-integratie)
    weather:        'weather.buienradar'
  },

  lights: [
    { id: 'light.slaapkamer',  name: 'Slaapkamer', room: 0 },
    { id: 'light.overloop',    name: 'Overloop',   room: 1 },
    { id: 'light.kinderkamer', name: 'Kamer 2',    room: 2 },
    { id: 'light.badkamer',    name: 'Badkamer',   room: 1 }
  ],

  // Na zoveel seconden zonder aanraking dimt het scherm (klok-modus)
  dimAfterSec: 120
};
