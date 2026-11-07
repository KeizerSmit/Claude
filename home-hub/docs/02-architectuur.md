# Architectuur: hoe alles aan elkaar hangt

```
 ┌───────────────┐   wifi (http)   ┌──────────────────────────────┐
 │ iPad 4 (muur) │ ◄─────────────► │ Home Assistant               │
 │ dashboard/    │   REST API      │ (Home Assistant Green of     │
 │ ES5 webpagina │                 │  Raspberry Pi 5 / mini-pc)   │
 └───────────────┘                 └──────────────┬───────────────┘
                                                  │ integraties
   ┌────────────┬────────────┬────────────┬───────┴─────┬────────────┬────────────┬────────────┐
   ▼            ▼            ▼            ▼             ▼            ▼            ▼            ▼
 HomeWizard   Honeywell    Weheat       Orcon MV-box  LUUMR-lampen LG-aircos    Somfy-screens Buienradar
 P1 + kWh     thermostaat  Blackbird    RF 868 MHz    Zigbee       ThinQ        io of RTS    weer/regen
 (lokaal)     (model?)     (cloud,lezen)(lokaal)      (lokaal)     (cloud)      (lokaal)
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

### Honeywell-thermostaat in de keuken (met wifi) ✅
De thermostaat heeft wifi, dus aflezen **én** instellen vanaf het paneel kan, gratis. Welke koppeling hangt af van het model. Kijk welke app je gebruikt ("Honeywell Home"/"Resideo" of "Total Connect Comfort") en of er een **HomeKit-code** op de thermostaat of in de doos staat:

| Als het is... | Koppeling | Opmerking |
|---|---|---|
| **Honeywell T6 / Lyric T6(R)** (met wifi, app "Resideo") | `lyric` (officieel), of via HomeKit **lokaal** | Temperatuur aflezen én instellen vanaf het paneel |
| **Round Connected / evohome** | `honeywell` / `evohome` (officieel) | Zelfde: aflezen en instellen |
| **Zonder wifi** (bijv. T3, T4, Round Modulation, Chronotherm) | Niet direct | Twee opties: (1) een **OpenTherm Gateway** (Nederlands product, Nodo-shop, ± €70) tussen thermostaat en warmtepomp, met de officiële integratie `opentherm_gw`, lokaal: aflezen en een setpoint opleggen. Werkt alleen als de Honeywell met de Weheat praat via OpenTherm. (2) De thermostaat vervangen door een T6 of iets vergelijkbaars. |

Het dashboard gaat nu uit van **één** thermostaat (keuken) met Thuis/Eco/Weg. Daaronder staat de Weheat-info (aanvoertemperatuur en COP).

### Warmtepomp: Weheat Blackbird
- Officiële Home Assistant-integratie **[Weheat](https://www.home-assistant.io/integrations/weheat/)**. Die ondersteunt de Blackbird, Sparrow en Flint.
- Je logt in met je Weheat-account. De Client ID en Client Secret staan in de kennisbank van Weheat.
- Je krijgt onder meer elektrisch en thermisch vermogen, **COP**, aanvoer- en retourtemperatuur, buitentemperatuur, status en (optioneel) de temperatuur van het warmwatervat. Het dashboard toont vermogen en COP.
- **Alleen uitlezen.** De integratie kan de warmtepomp niet aansturen. Dat is ook niet nodig: de thermostaat stuurt de warmtevraag. De gegevens komen via de cloud en ververst om de ±2 minuten.
- De buitenunit staat op het **grinddak van de uitbouw**, naast de buitenunit van de LG-aircos (zoals op je foto). Het buffervat en het boilervat staan in de technische ruimte op zolder. Zo staan ze ook in de tekening.

### Ventilatie: Orcon-box op zolder, bediend met het kastje in de keuken
- De MV-unit hangt in de technische ruimte op zolder (op je foto: een Orcon MVS-15-uitvoering), met afzuigpunten in keuken, toilet en badkamers.
- Het kastje in de keuken heeft één knop en lampjes voor **timer / auto / 1 / 2 / 3**, plus een groen lampje. Dat lijkt de **Orcon RF-ruimtesensor/bediening (CO₂)**: draadloos op 868 MHz, en het groene lampje geeft waarschijnlijk de luchtkwaliteit aan. Draadloos is goed nieuws: dan kan Home Assistant meedoen.
- Geen typeplaatje gevonden? Het zit bij de MVS-15 meestal aan de **zijkant of achterkant** van de box, of onder het deksel. Je kunt de stekker even uit het stopcontact halen, het deksel afnemen en kijken. Ook zonder plaatje kunnen we verder: de USB-stick hieronder "luistert" en laat zien welk apparaat het is.
- Koppelen kan **lokaal** met een 868 MHz USB-stick (evofw3-type, ± €40–60) en de community-integratie **ramses_cc** (via HACS). Home Assistant doet zich dan voor als een tweede afstandsbediening. Op het forum werkt dat met de Orcon MVS-15, maar het instellen (binden) is wat priegelwerk ([forumdraad](https://community.home-assistant.io/t/honeywell-ch-dhw-via-rf-evohome-sundial-hometronics-chronotherm/151584?page=154)).
- Mooie bijvangst: blijkt de Honeywell een **evohome** te zijn, dan leest dezelfde stick die ook lokaal uit (evohome gebruikt hetzelfde RF-protocol).
- Alternatief zonder solderen of configuratiewerk: een RFXtrx 868 die de afstandsbediening nabootst.
- Graag nog een foto van het kastje en van het typeplaatje van de box (merk en type, bijv. "MVS-15RHB").

### Aircos: LG multi-split (3 binnenunits, 1 buitenunit)
- Binnenunits in **slaapkamer 4 en 5 (zolder)** en **slaapkamer 1 (1e verdieping)**. De buitenunit staat op het dak van de uitbouw.
- De afstandsbediening (Comfort Air, Energy Ctrl, UVnano, Jet Mode) hoort bij een recente LG-serie (DUALCOOL-familie). Die heeft vaak **ingebouwde wifi**. Kijk in de **LG ThinQ-app** of je ze kunt toevoegen.
- Officiële Home Assistant-integratie **[LG ThinQ](https://www.home-assistant.io/integrations/lg_thinq/)**, met een "personal access token" van LG. Per binnenunit krijg je een eigen klimaatentiteit: aan/uit, koelen/verwarmen/auto, temperatuur en ventilatorstand. Dit gaat **via de LG-cloud**.
- Geen wifi in de units? Dan kan een LG-wifimodule (PWFMDD200, ± €40 per unit) of een ESPHome-module op de bedrade bedieningsaansluiting (meer knutselwerk, wel lokaal).
- Het dashboard heeft een tabblad **Klimaat → Airco**: per kamer de stand Uit/Koelt/Warmt/Auto (tikken wisselt de stand) en de temperatuur met − en +. In de tekening blaast een kleine lijn blauw (koelen) of oranje (verwarmen) onder de binnenunit.

### Screens: Somfy io (3×, slaapkamers op de zuidzijde) ✅ bevestigd io

> Bevestigd: **io** (Situo 1 io). De screens hangen bij **slaapkamer 1, 3 (1e verdieping) en 4 (zolder)**, aan de zuidzijde (tuinzijde). Gratis gaat dit helaas niet: io-homecontrol heeft altijd een Somfy-gateway nodig. Goedkoopst is een **tweedehands TaHoma of Connexoon io** (de lokale API werkt op TaHoma Switch, TaHoma v2, Connexoon io). In Home Assistant: officiële **Overkiz**-integratie, en je krijgt de echte stand van de screens terug. Zie [04-stappenplan.md](04-stappenplan.md).

- De Situo-afstandsbediening op je foto bestaat in twee varianten: **io** (io-homecontrol, met terugmelding) en **RTS** (alleen zenden). Aan de buitenkant zie je het verschil niet; kijk op het etiketje in het batterijvak of achterop: "io" of "RTS". Een tip: een io-afstandsbediening geeft na het indrukken met een **groen lampje** aan dat de screen het commando heeft ontvangen.
- **io** → een Somfy-gateway nodig: **TaHoma Switch** (± €150–200), gekoppeld met de officiële **Overkiz**-integratie. Die heeft een **lokale API** (zet de ontwikkelaarsmodus aan op somfy.com). Je krijgt dan ook de echte stand van de screen.
- **RTS** → goedkoop en lokaal met **[ESPSomfy-RTS](https://github.com/rstrouse/ESPSomfy-RTS)**: een ESP32 met een 433 MHz CC1101-radio (± €15–25). Die koppel je als extra afstandsbediening aan elke screen. Nadeel: RTS meldt niet terug, dus als iemand met de muurbediening schakelt, weet Home Assistant dat niet.
- Het dashboard heeft een tabblad **Screens** met ▲ / my / ▼ per screen, net als de Situo.
- De slimme schakelaar met drie lampjes naast de Situo: welk merk/welke app is dat? Die kan waarschijnlijk ook mee.

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
5. Open op de iPad `http://<ip-van-home-assistant>/local/thuis/index.html`, kies *Zet op beginscherm* en zet Begeleide toegang aan.

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
