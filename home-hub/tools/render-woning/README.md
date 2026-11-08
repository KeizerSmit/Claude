# Render van de woning (voor het wandpaneel)

Het huis op het paneel (`dashboard/house.png` en `dashboard/house-night.png`) is een render van het SketchUp-model van de woning, gemaakt met three.js. Daarboven tekent het paneel alleen de live onderdelen: lampgloed, vloerverwarming, energiestromen en labels.

## Opnieuw renderen (bijvoorbeeld na een verbouwing)
1. Pak het `.skp`-bestand uit (het is een zip): `unzip woning.skp model.dat`. Zet `model.dat` naast `tlv.py`, `model.py` en `extract.py`.
2. `python3 extract.py woning.skp` maakt `geom.json`: alle vlakken met hun materiaal, in meters.
3. Zet `geom.json`, `index.html`, `scene.js` en `shot.js` in één map, met `node_modules/three` ernaast (`npm i three`). Start daarna een webserver in de bovenliggende map, bijvoorbeeld `python3 -m http.server 8790`.
4. Render met de map `render/` als werkmap:
   - Dag: `VW=890 VH=1380 node render/shot.js "w=890&h=1380&pad=0.025" house.png`
   - Avond: `VW=890 VH=1380 node render/shot.js "w=890&h=1380&pad=0.025&night=1" house-night.png`
5. `shot.js` print de projectie (`ax ... dy`). Neem die over in `PJ` in `dashboard/app.js`. Verhoog daarna `HUB_V` (en `data-hubv` in `index.html`), zodat iPads en telefoons de nieuwe afbeelding ophalen.

## Wat de render doet
- **Verdiepingen opengewerkt:** de 1e verdieping is +3,2 m opgetild, de zolder +6,4 m en het dak +9,6 m. Muren aan de kijkkant (voorgevel en rechter bouwmuur) zijn afgezaagd op 0,95 m, binnenwanden op 1,3 m.
- **Eigen toevoegingen:** de meubels zijn eenvoudige blokken en staan alleen indicatief. De LG-buitenunit en de Weheat staan op het dak van de uitbouw, en de airco-binnenunits op hun plek uit `config.js`.
- **Kleuren:** die komen uit de materialen van het SketchUp-model, met een paar kleine correcties in `scene.js`.
