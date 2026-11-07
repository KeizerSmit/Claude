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
    // Honeywell-thermostaat in de keuken (model nog onbekend; zie docs/02-architectuur.md)
    thermostat:     'climate.honeywell',
    // Weheat: aanvoertemperatuur (optioneel)
    heatPumpFlow:   'sensor.blackbird_water_outlet_temperature',
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

  // LG-aircos (multi-split, 1 buitenunit op het dak van de uitbouw) via de LG ThinQ-integratie.
  // 'at' = plek van de binnenunit in de tekening (x, y van de wand), 'side' = kant van de kamer (1 = achter, -1 = voor),
  // 'floor' = 1 (1e verdieping) of 2 (2e verdieping/zolder).
  acs: [
    { id: 'climate.airco_slaapkamer_4', name: 'Slaapkamer 4', floor: 2, at: [1.45, 5.46], side: 1 },
    { id: 'climate.airco_slaapkamer_5', name: 'Slaapkamer 5', floor: 2, at: [3.75, 2.28], side: -1 },
    { id: 'climate.airco_slaapkamer_1', name: 'Slaapkamer 1', floor: 1, at: [3.85, 4.80], side: 1 }
  ],

  // Somfy-screens aan de tuinzijde (cover-entiteiten; via TaHoma/Overkiz bij io, ESPSomfy-RTS bij RTS)
  screens: [
    { id: 'cover.screen_1', name: 'Screen 1' },
    { id: 'cover.screen_2', name: 'Screen 2' },
    { id: 'cover.screen_3', name: 'Screen 3' }
  ],

  screenMyPos: 60,   // stand van de Somfy 'my'-knop (procent dicht), alleen voor de weergave

  // Na zoveel seconden zonder aanraking dimt het scherm (klok-modus)
  dimAfterSec: 120
};
