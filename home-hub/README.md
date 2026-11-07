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
- **Links: de woning op maat**, getekend uit het SketchUp-model (verbouwing zolder). Het huis is opengewerkt: de verdiepingen en het dak zweven los, zodat je erin kijkt.
  - de topgevel in oranje gevelsteen met het zolderraam, en het felszink dak met 6 zonnepanelen
  - de 2e verdieping (zolder) met de LUUMR-lampen (ze gloeien als ze aan staan) en de technische ruimte met de Orcon-unit, het buffervat en het boilervat
  - de 1e verdieping met de radiatoren
  - de begane grond met de vloerverwarming (oranje als hij aan staat) en de Honeywell-thermostaat
  - de Weheat Blackbird in de tuin en de aansluiting op het net aan de straat
  - Bewegende lijnen tonen de stroom: geel voor zon, groen voor teruglevering, blauw voor afname en oranje voor de warmtepomp. Een blauwe stippellijn toont de ventilatie naar het dak.
- **Rechts**: kaarten om te bedienen, namelijk Energie nu (met daggrafiek), Klimaat (twee zones: beneden vloerverwarming, boven radiatoren, en Thuis/Eco/Weg), Ventilatie Orcon (Auto/1/2/3/Boost) en Verlichting 2e verdieping.
- **Boven**: klok, datum, buitentemperatuur en de Buienradar-verwachting.
- Tik je op een verdieping in het huis, dan licht de bijbehorende kaart op. Na 2 minuten zonder aanraking dimt het scherm naar een grote klok.
- Grote knoppen (≥ 42 px), donker thema en weinig animatie, zodat het soepel blijft op de A5-chip.

## Bekijken
Open `dashboard/index.html` in een browser (op een pc: venster op 1024×768), of op de iPad via een webserver.

## Plan
1. ✅ Opzet, onderzoek en ontwerp (deze map)
2. ✅ Woning op maat uit het SketchUp-model; Weheat, Orcon en LUUMR uitgezocht
   ⏳ Nog open: model Honeywell-thermostaat, plek buitenunit warmtepomp, typeplaatje Orcon-box
3. Home Assistant installeren en koppelen, daarna `config.js` op `mode: 'homeassistant'`
4. iPad inrichten (Begeleide toegang, slimme stekker voor de lader) en ophangen
