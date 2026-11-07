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
 HomeWizard     Honeywell      Weheat         Orcon MV-box   LUUMR-lampen     Buienradar
 P1 + kWh-      thermostaat    Blackbird      (RF 868 MHz,   (Zigbee,         (weer/regen)
 meters (lokaal)(cloud/lokaal) (cloud, lezen) lokaal)        lokaal)
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

### Warmtepomp: Weheat Blackbird
- Officiële Home Assistant-integratie **[Weheat](https://www.home-assistant.io/integrations/weheat/)**. Die ondersteunt de Blackbird, Sparrow en Flint.
- Je logt in met je Weheat-account. De Client ID en Client Secret staan in de kennisbank van Weheat.
- Je krijgt onder meer elektrisch en thermisch vermogen, **COP**, aanvoer- en retourtemperatuur, buitentemperatuur, status en (optioneel) de temperatuur van het warmwatervat. Het dashboard toont vermogen en COP.
- **Alleen uitlezen.** De integratie kan de warmtepomp niet aansturen. Dat is ook niet nodig: de thermostaat stuurt de warmtevraag. De gegevens komen via de cloud en ververst om de ±2 minuten.
- In de tekening staat de buitenunit achter in de tuin, en het buffervat en het boilervat in de technische ruimte op zolder, zoals in het SketchUp-model. Staat de buitenunit ergens anders (bijv. op het dak van de uitbouw)? Dan verplaats ik hem.

### Ventilatie: Orcon-box op zolder, bediend met het kastje in de keuken
- De MV-unit hangt in de technische ruimte op zolder, met afzuigpunten in keuken, toilet en badkamers. Het kastje bij de keuken is vrijwel zeker een **Orcon RF-afstandsbediening** (bijv. de 15RF, 868 MHz).
- Koppelen kan **lokaal** met een 868 MHz USB-stick (evofw3-type, ± €40–60) en de community-integratie **ramses_cc** (via HACS). Home Assistant doet zich dan voor als een tweede afstandsbediening. Op het forum werkt dat met de Orcon MVS-15, maar het instellen (binden) is wat priegelwerk ([forumdraad](https://community.home-assistant.io/t/honeywell-ch-dhw-via-rf-evohome-sundial-hometronics-chronotherm/151584?page=154)).
- Mooie bijvangst: blijkt de Honeywell een **evohome** te zijn, dan leest dezelfde stick die ook lokaal uit (evohome gebruikt hetzelfde RF-protocol).
- Alternatief zonder solderen of configuratiewerk: een RFXtrx 868 die de afstandsbediening nabootst.
- Graag nog een foto van het kastje en van het typeplaatje van de box (merk en type, bijv. "MVS-15RHB").

### Verlichting: LUUMR op de 2e verdieping
- Lampen in slaapkamer 4, slaapkamer 5, toilet/badkamer en overloop.
- LUUMR-slimme lampen zijn **Zigbee-lampen** (werken met Tuya en Philips Hue). Een losse Zigbee-stick aan Home Assistant (bijv. Home Assistant Connect ZBT-1 of SLZB-06, ± €30–40) is dan de beste route: **lokaal, snel en zonder cloud**. Je koppelt de lampen direct aan Home Assistant (ZHA of Zigbee2MQTT).
- Gebruik je nu de LUUMR- of Tuya-app met een Tuya-gateway? Dan kan het ook via de Tuya-integratie, maar dat loopt via de cloud en is trager.
- In `config.js` staat per lamp de plek in de tekening (`at: [x, y]` in meters), zodat de juiste kamer oplicht.

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

Het huis in het dashboard is nu op maat getekend uit het SketchUp-model van de woning (verbouwing zolder):

- Tussenwoning van 5,37 m breed en 9,5 m diep, plus een uitbouw tot 11,9 m. Vloerhoogtes 0 / 2,90 / 5,78 m, nok op 9,74 m.
- Zadeldak in grijs felszink met 6 zonnepanelen op het rechter dakvlak. Topgevels voor en achter in oranje gevelsteen, met zolderramen. De bouwmuren zijn grijs, zoals in het model.
- Begane grond: hal, toilet, trap, meterkast, woonkamer met vloerverwarming, keuken en uitbouw met tuinpui.
- 1e verdieping: badkamer, slaapkamer 1, 2 en 3, en de radiatoren.
- 2e verdieping (zolder): slaapkamer 4 en 5, badkamer met toilet, overloop, en de technische ruimte met wasmachine, droger, buffervat, boilervat en de Orcon-unit.
- Weergave: opengewerkt. De verdiepingen en het dak zweven los, zodat je in elke verdieping kijkt.

Het SketchUp-bestand zelf staat **niet** in deze repository (privé). Alleen de maten zijn overgenomen in `dashboard/app.js`.
