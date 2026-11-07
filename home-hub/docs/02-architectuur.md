# Architectuur: hoe alles aan elkaar hangt

```
 ┌───────────────┐   wifi (http)   ┌──────────────────────────────┐
 │ iPad 2 (muur) │ ◄─────────────► │ Home Assistant               │
 │ dashboard/    │   REST API      │ (Home Assistant Green of     │
 │ ES5 webpagina │                 │  Raspberry Pi 5 / mini-pc)   │
 └───────────────┘                 └──────────────┬───────────────┘
                                                  │ integraties
     ┌──────────────┬──────────────┬──────────────┼──────────────┬───────────────┐
     ▼              ▼              ▼              ▼              ▼               ▼
 HomeWizard     Honeywell      Warmtepomp     Ventilatie     Lumen-lampen     Buienradar
 P1 + kWh-      thermostaat    (merk?)        (merk?)        (protocol?)      (weer/regen)
 meters (lokaal)(cloud/lokaal)
```

**Waarom zo?** De iPad is te oud om zelf integraties te draaien. Home Assistant is gratis, Nederlands-vriendelijk en ondersteunt vrijwel alles wat je hebt. De iPad haalt elke 5 seconden alle waarden op uit Home Assistant en stuurt een opdracht als je ergens op tikt.

## Het centrale kastje

| Optie | Prijs (indicatie) | Opmerking |
|---|---|---|
| **Home Assistant Green** | ± €100–130 | Aanbevolen. Kant-en-klaar: stekker erin en klaar |
| Raspberry Pi 5 + SSD | ± €120–150 | Meer knutselwerk |
| Oude laptop / mini-pc | €0–150 | Prima. Zuiniger dan je denkt |

Optioneel: een **Zigbee-stick** (bijv. SMLIGHT SLZB-06 of Home Assistant Connect ZBT-1) als je goedkope sensoren wilt toevoegen (zie [03-upgrades.md](03-upgrades.md)).

## Per apparaat

### HomeWizard (P1-meter, kWh-meters): werkt direct
- Officiële Home Assistant-integratie **HomeWizard Energy**, volledig **lokaal**, geen cloud.
- Zet in de HomeWizard-app per meter *Lokale API* aan.
- Levert: vermogen (W) per fase, import/export (kWh), gas, en eventueel water.
- Heb je een losse kWh-meter op de **zonnepanelen** en op de **warmtepomp**? Dan krijg je exact de cijfers die het dashboard toont. Zo niet, dan raad ik ze aan (± €30–50 per stuk, DIN-rail, laten plaatsen in de meterkast).

### Honeywell thermostaat: welk model?
Twee zones (vloerverwarming beneden en warmte boven) wijst bijna zeker op **Honeywell evohome**.

| Model | Integratie | Opmerking |
|---|---|---|
| **evohome** | `evohome` (officieel) | Via de Honeywell TCC-cloud. Per zone temperatuur en setpoint, plus systeemmodus (Auto/Eco/Weg) |
| Lyric T6 / T6R | `lyric` (officieel) | Via de Resideo-cloud. De T6 kan ook via HomeKit-koppeling **lokaal** |
| Round Connected | `honeywell` (officieel) | Via de TCC-cloud |

### Warmtepomp: welk merk?
Minimaal meet je het verbruik met een HomeWizard kWh-meter. Voor temperaturen, COP of een stooklijn hangt het van het merk af. Een paar voorbeelden: Daikin (Onecta / ESPAltherma), Mitsubishi (MELCloud), Itho Daalderop, Quatt, Remeha, Nefit en Vaillant (via add-ons).

### "Afzuiger": wat is het precies?
- **Mechanische ventilatiebox** (meestal op zolder): bij Itho Daalderop werkt de open-source *Itho WiFi add-on* (ESP32) erg goed en volledig lokaal. Bij Orcon of Itho met een RF-afstandsbediening kan het via een RF-dongle (`ramses_rf`), en bij Zehnder via de ComfoConnect LAN C.
- **WTW-unit** (Brink, Zehnder): vaak via een add-on module of Modbus.
- **Keukenafzuigkap**: meestal niet slim. Stand bedienen gaat dan alleen met een (door een installateur geplaatste) relaismodule.

Het dashboard gaat uit van standen Auto / 1 / 2 / 3 / Boost, zoals bij de meeste ventilatieboxen.

### Lumen-lampen: welke app gebruik je?
"Lumen" kon ik niet eenduidig vinden. Dit bepaalt de koppeling:
- **Tuya / Smart Life-app** (veel huismerken, zoals LSC van de Action): Tuya-integratie of Local Tuya.
- **Zigbee** (bijv. Innr, IKEA, Hue zonder bridge): via een Zigbee-stick, lokaal en snel.
- **Eigen wifi of MQTT**: via MQTT.
Stuur me de naam van de app of een foto van de verpakking, dan zoek ik het precies uit.

### Weer
Integratie **Buienradar**: temperatuur, verwachting en "komende 2 uur droog/regen" voor Tilburg.

## Het dashboard koppelen

1. Installeer Home Assistant en voeg de integraties hierboven toe.
2. Kopieer `dashboard/` naar `/config/www/thuis/` (via de *File editor*- of *Samba*-add-on).
3. Maak een *long-lived access token* aan (Profiel → Beveiliging) en zet die in `config.js`.
4. Pas de `entity_id`'s in `config.js` aan naar die van jou en zet `mode: 'homeassistant'`.
5. Open op de iPad `http://<ip-van-home-assistant>:8123/local/thuis/index.html`, kies *Zet op beginscherm* en zet Begeleide toegang aan.

> Beveiliging: het token staat in een bestand op je eigen netwerk. Dat is acceptabel voor een thuisnetwerk, maar zet Home Assistant dan **niet** zonder extra beveiliging open naar internet. Wil je van buitenaf, gebruik dan Home Assistant Cloud (Nabu Casa) of een VPN zoals Tailscale.

## Het 3D-huis

Nu staat er een gestileerd huis in het dashboard (3 verdiepingen, opengewerkt). De volgende stap is jouw eigen woning:

1. **Jouw 3D-beelden**: stuur ze, dan maak ik er een isometrische tekening van in dezelfde stijl.
2. **3D BAG** (TU Delft, open data): gratis LoD2-model van elk Nederlands gebouw, met de echte dakvorm en hoogtes ([3dbag.nl](https://3dbag.nl), [projectpagina](https://3d.bk.tudelft.nl/projects/3dbag/)). Daarmee kloppen de dakvlakken voor de zonnepanelen precies.
3. Plattegrond per verdieping: welke kamers waar? Dan zet ik de lampen en zones op de juiste plek.

Voor de iPad 2 wordt het huis **vooraf getekend** (SVG/afbeelding) en niet live in 3D gerenderd. De A5-chip trekt echte 3D (WebGL) niet soepel, en zo blijft alles vloeiend.
