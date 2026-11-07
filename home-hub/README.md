# Thuis: wandpaneel op een oude iPad 2

Een oude iPad 2 als mooi, rustig bedieningspaneel aan de muur. Er staat een opengewerkt 3D-huis op met live energie, verwarming, ventilatie en verlichting.

![Ontwerp van het wandpaneel](dashboard/preview.png)

## Wat staat er in deze map

| Pad | Inhoud |
|---|---|
| [`dashboard/`](dashboard) | Werkend ontwerp (HTML/CSS/ES5-JS), gemaakt voor iPad 2 (1024×768, iOS 9 Safari). Draait nu in **demo-modus** met nepdata |
| [`docs/01-ipad-2-onderzoek.md`](docs/01-ipad-2-onderzoek.md) | Wat de iPad 2 nog kan, wel of niet jailbreaken, accu-veiligheid en ophangen |
| [`docs/02-architectuur.md`](docs/02-architectuur.md) | Hoe alles koppelt via Home Assistant, per apparaat |
| [`docs/03-upgrades.md`](docs/03-upgrades.md) | Wat je nog meer kunt toevoegen (energie, klimaat, veiligheid) |

## Het ontwerp in het kort
- **Links**: het huis per verdieping uit elkaar getrokken. Je ziet de zonnepanelen op het dak, de ventilatie op zolder, de lampen boven (ze gloeien als ze aan staan), de vloerverwarming beneden (oranje als hij aan staat), de warmtepomp buiten en de aansluiting op het net. Geanimeerde lijnen tonen hoe de stroom loopt: geel voor zon, groen voor teruglevering, blauw voor afname en oranje voor de warmtepomp.
- **Rechts**: kaarten om te bedienen, namelijk Energie nu (met daggrafiek), Klimaat (twee zones met − en +, en Thuis/Eco/Weg), Ventilatie (Auto/1/2/3/Boost) en Verlichting boven.
- **Boven**: klok, datum, buitentemperatuur en de Buienradar-verwachting.
- Tik je op een verdieping in het huis, dan licht de bijbehorende kaart op. Na 2 minuten zonder aanraking dimt het scherm naar een grote klok.
- Grote knoppen (≥ 42 px), donker thema en weinig animatie, zodat het soepel blijft op de A5-chip.

## Bekijken
Open `dashboard/index.html` in een browser (op een pc: venster op 1024×768), of op de iPad via een webserver.

## Plan
1. ✅ Opzet, onderzoek en ontwerp (deze map)
2. ⏳ Jouw gegevens: thermostaatmodel, merk warmtepomp en ventilatie, app van de Lumen-lampen, 3D-beelden en plattegrond
3. Home Assistant installeren en koppelen, daarna `config.js` op `mode: 'homeassistant'`
4. Het 3D-huis vervangen door jouw eigen woning (op basis van je beelden en 3D BAG)
5. iPad inrichten (Begeleide toegang, slimme stekker voor de lader) en ophangen
