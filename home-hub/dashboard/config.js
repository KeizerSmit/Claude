/* Instellingen voor het wandpaneel.
 * mode 'demo'          : nepdata, werkt zonder iets aan te sluiten (voor het design).
 * mode 'homeassistant' : leest live data uit Home Assistant via de REST API.
 *
 * Dit bestand staat samen met index.html/app.js/style.css in /config/www/thuis/
 * van Home Assistant. Open op de iPad:
 *   http://192.168.178.250/local/thuis/index.html
 *
 * Een entiteit die (nog) niet bestaat, wordt op het paneel als "–" getoond.
 * Zodra je hem koppelt in Home Assistant verschijnt hij vanzelf.
 */
var HUB_CONFIG = {
  mode: 'homeassistant',

  homeassistant: {
    url: '',                // leeg = dezelfde server als waar de pagina vandaan komt
    token: 'PLAK_HIER_EEN_LONG_LIVED_ACCESS_TOKEN', // Profiel > Beveiliging > Langdurige toegangstokens
    pollMs: 5000
  },

  entities: {
    // HomeWizard P1-meter: vermogen in W (positief = afname, negatief = teruglevering) en tellerstanden
    gridPower:        'sensor.p1_meter_vermogen',
    gridImportTotal:  'sensor.p1_meter_energie_import',
    gridExportTotal:  'sensor.p1_meter_energie_export',
    // HomeWizard tussenmeters (namen na hernoemen in Home Assistant: Zonnepanelen / Warmtepomp / Airco)
    solarPower:       'sensor.zonnepanelen_vermogen',
    solarEnergyTotal: 'sensor.zonnepanelen_energie_export',
    heatPumpPower:    'sensor.warmtepomp_vermogen',
    acPower:          'sensor.airco_vermogen',
    // Weheat Blackbird (officiele Weheat-integratie, alleen uitlezen) - nog niet gekoppeld
    heatPumpCop:      'sensor.blackbird_cop',
    heatPumpFlow:     'sensor.blackbird_water_outlet_temperature',
    // Honeywell Home T6 (keuken), gekoppeld via HomeKit Device (lokaal)
    thermostat:       'climate.tstat_287065_t6_thermostat',
    // Orcon-ventilatie via ramses_cc - nog niet gekoppeld
    ventilation:      'fan.orcon',
    bathHumidity:     'sensor.badkamer_vochtigheid',
    // Weer
    weather:          'weather.buienradar',
    // Wandpaneel op afstand bedienen (helpers die je zelf in Home Assistant aanmaakt)
    panelReload:      'input_button.wandpaneel_herladen',
    panelScreenOff:   'input_boolean.wandpaneel_scherm_uit'
  },

  // LUUMR-lampen op de 2e verdieping (zolder) - nog niet gekoppeld.
  // 'at' = plek in de tekening in meters vanaf de linker bouwmuur (x) en de voorgevel (y).
  lights: [
    { id: 'light.slaapkamer_5', name: 'Slaapkamer 5', at: [2.68, 1.30] },
    { id: 'light.slaapkamer_4', name: 'Slaapkamer 4', at: [2.68, 7.30] },
    { id: 'light.toilet',       name: 'Toilet / bad', at: [3.90, 4.40] },
    { id: 'light.overloop',     name: 'Overloop',     at: [1.95, 3.90] }
  ],

  // LG-aircos via LG ThinQ. 'floor' = 1 (1e verdieping) of 2 (zolder),
  // 'at' = plek van de binnenunit in de tekening, 'side' = kant van de kamer (1 = achter, -1 = voor).
  // Margje = zolder straatkant, Julius = zolder tuinkant, Muriel = 1e verdieping (slaapkamer 1).
  acs: [
    { id: 'climate.kamer_julius', name: 'Kamer Julius', floor: 2, at: [1.45, 5.46], side: 1 },
    { id: 'climate.kamer_margje', name: 'Kamer Margje', floor: 2, at: [3.75, 2.28], side: -1 },
    { id: 'climate.kamer_muriel', name: 'Kamer Muriel', floor: 1, at: [3.85, 4.80], side: 1 }
  ],

  // Somfy io-screens via TaHoma + Overkiz - nog niet gekoppeld
  screens: [
    { id: 'cover.screen_slaapkamer_1', name: 'Slaapkamer 1', floor: 1, win: [3.15, 4.74] },
    { id: 'cover.screen_slaapkamer_3', name: 'Slaapkamer 3', floor: 1, win: [0.63, 2.22] },
    { id: 'cover.screen_slaapkamer_4', name: 'Slaapkamer 4', floor: 2 }
  ],
  screenMyPos: 60,

  // Na zoveel seconden zonder aanraking dimt het scherm (klok-modus)
  dimAfterSec: 120
};
