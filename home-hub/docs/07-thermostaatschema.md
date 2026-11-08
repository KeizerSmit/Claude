# Thermostaatschema op het wandpaneel

Het weekschema van de verwarming stel je in op de iPad: **Klimaat → Verwarming → knop "Schema"**.
Per dag zijn er 4 wissels: **Opstaan, Weg, Thuis, Slapen**, elk met een tijd en een temperatuur.

## Hoe het werkt
- Het schema staat in Home Assistant, in de helper `input_text.thermostaat_schema`.
- Een automatisering in Home Assistant zet de thermostaat op elke wisseltijd op de juiste temperatuur.
- Draait iemand tussendoor aan de thermostaat of op het paneel? Dan blijft die temperatuur staan tot de volgende wissel, net als bij een gewone klokthermostaat.
- Met **Aan/Uit** rechtsboven in het schema zet je het hele schema stil, bijvoorbeeld als je op vakantie bent.
- Het bestand: [`../homeassistant/thermostaat-schema.yaml`](../homeassistant/thermostaat-schema.yaml).

## Eenmalig installeren
1. Ga naar `http://192.168.178.250`, open de **Terminal** en plak:
   ```
   C=/config; [ -f $C/configuration.yaml ] || C=/homeassistant; cd $C; B=https://raw.githubusercontent.com/keizersmit/claude/claude/blissful-archimedes-2uuo74/home-hub; for f in index.html style.css app.js; do curl -fsSL "$B/dashboard/$f?$(date +%s)" -o www/thuis/$f && echo "OK $f"; done; mkdir -p packages && curl -fsSL "$B/homeassistant/thermostaat-schema.yaml?$(date +%s)" -o packages/thermostaat_schema.yaml && echo "OK schema"; if grep -q "packages:" configuration.yaml; then echo "OK packages stond al aan"; elif grep -q "^homeassistant:" configuration.yaml; then echo "LET OP: stuur een foto van configuration.yaml"; else printf '\nhomeassistant:\n  packages: !include_dir_named packages\n' >> configuration.yaml && echo "OK packages aangezet"; fi; ha core check && ha core restart
   ```
   Je ziet een paar keer **OK**, daarna herstart Home Assistant. Dat duurt ± 1 minuut.
2. **Zet het eigen schema op de Honeywell T6 uit**, op het apparaat zelf: **Menu → Schema (Schedule) → Uit (Off)**. Anders werken de twee schema's elkaar tegen.
3. Open op de iPad **Klimaat → Schema**, stel de tijden en temperaturen in, druk op **Opslaan** en zet het schema op **Aan**.

## Bediening
- **Werkdagen / Weekend / Hele week**: kiest meteen die dagen en laadt hun schema.
- Tik op losse dagen om ze aan of uit te zetten. **Opslaan** zet het schema op alle gekozen dagen.
- Op de telefoon zie je onder de thermostaat de volgende wissel, bijv. "Schema · volgende: 17:00 → 20,0°".

## Goed om te weten
- Als Home Assistant uit staat, blijft de thermostaat op de laatste temperatuur staan. Na een herstart zet Home Assistant meteen de temperatuur die op dat moment hoort.
- Een wissel overslaan? Geef die dezelfde temperatuur als de wissel ervoor.
