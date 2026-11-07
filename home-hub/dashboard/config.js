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
    // HomeWizard kWh-meter op de omvormer (zonnepanelen)
    solarPower:     'sensor.kwh_meter_zon_power',
    solarToday:     'sensor.kwh_meter_zon_energy_today',
    // Weheat Blackbird (officiele Weheat-integratie, alleen uitlezen)
    heatPumpPower:  'sensor.blackbird_electrical_power',
    heatPumpCop:    'sensor.blackbird_cop',
    // Honeywell (Evohome / Lyric) zones
    climateDown:    'climate.beneden',
    climateUp:      'climate.boven',
    // Orcon ventilatiebox (zolder, technische ruimte) via RF: ramses_cc
    ventilation:    'fan.orcon',
    bathHumidity:   'sensor.badkamer_vochtigheid',
    // Weer (Buienradar-integratie)
    weather:        'weather.buienradar'
  },

  // LUUMR-lampen op de 2e verdieping (zolder). 'at' = plek in de tekening
  // in meters vanaf de linker bouwmuur (x) en de voorgevel (y), uit het SketchUp-model.
  lights: [
    { id: 'light.slaapkamer_5', name: 'Slaapkamer 5', at: [2.68, 1.30] },
    { id: 'light.slaapkamer_4', name: 'Slaapkamer 4', at: [2.68, 7.30] },
    { id: 'light.toilet',       name: 'Toilet / bad', at: [3.90, 4.40] },
    { id: 'light.overloop',     name: 'Overloop',     at: [1.95, 3.90] }
  ],

  // Na zoveel seconden zonder aanraking dimt het scherm (klok-modus)
  dimAfterSec: 120
};
