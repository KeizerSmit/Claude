# Alle nieuwe koppelingen in één keer

Een checklist voor als je alles tegelijk wilt doen. Doe de stappen van boven naar beneden.

## 1. Paneel bijwerken + thermostaatschema (Terminal, 1 commando)
Het commando staat in [07-thermostaatschema.md](07-thermostaatschema.md), stap 1. Hiermee krijgt het paneel ook de knop **Voordeur**. Zet daarna het schema op de Honeywell zelf uit: **Menu → Schema → Uit**.

## 2. Deurbel (Tapo D235, IP 192.168.178.217)
In de **Tapo-app**, bij de deurbel:
1. Zet **Altijd aan-modus** aan. Dat kan alleen als de deurbel vast op stroom zit.
2. Ga naar **Instellingen → Geavanceerde instellingen → Camera-account** en maak een gebruikersnaam en wachtwoord aan.

In **Home Assistant**:
3. Ga naar **Instellingen → Apparaten & diensten → + Integratie toevoegen** en kies **ONVIF**.
   - Staat de deurbel in de lijst, kies hem dan. Anders kies je handmatig en vul je in: host `192.168.178.217`, poort `2020`.
   - Vul de gebruikersnaam en het wachtwoord van het camera-account in.
4. Klaar. Het paneel vindt de camera vanzelf, en er verschijnt een knop **Voordeur** naast "Thuis". Op de telefoon heet die knop **Voordeur bekijken**.
   Zie je de knop niet? Hernoem dan de camera-entiteit in Home Assistant naar `camera.voordeur`.

Het beeld springt **niet** vanzelf aan; je kijkt alleen als je op de knop tikt. Na 2 minuten sluit het vanzelf.

## 2b. Energie-overzicht (Terminal, 1 commando)
Tik op het paneel op de **energiekaart**, dan zie je alle details: het verbruik nu per onderdeel, de kosten per dag, maand en jaar, het sluipverbruik en je tarieven. Zodat dag, maand en jaar worden bijgehouden, plak je dit in de **Terminal**:
```
C=/config; [ -f $C/configuration.yaml ] || C=/homeassistant; cd $C; B=https://raw.githubusercontent.com/keizersmit/claude/claude/blissful-archimedes-2uuo74/home-hub; for f in index.html style.css app.js; do curl -fsSL "$B/dashboard/$f?$(date +%s)" -o www/thuis/$f && echo "OK $f"; done; mkdir -p packages && curl -fsSL "$B/homeassistant/energie.yaml?$(date +%s)" -o packages/energie.yaml && echo "OK energie"; grep -q "packages:" configuration.yaml && echo "OK packages" || echo "LET OP: packages staat niet aan, doe eerst stap 1"; ha core check && ha core restart
```
- De tellers beginnen bij nul op het moment dat je dit installeert. "Gisteren" en "Vorige maand" vullen zich dus pas na een dag of een maand.
- Zet je eigen **stroomprijs** en **terugleververgoeding** onderaan het overzicht met de −/+ knoppen. Die staan op je energierekening of in de app van je energieleverancier.

## 2c. Weheat-warmtepomp (gratis, ± 5 min)
1. Open in je browser het Weheat-artikel [Is er een officiële Home Assistant-integratie?](https://support.weheat.nl/s/article/Is-er-een-offici%C3%ABle-Home-Assistant-integratie). Daar staan een **Client ID** en een **Client Secret**.
2. Ga in Home Assistant naar **Instellingen → Apparaten & diensten → + Integratie toevoegen** en kies **Weheat**.
3. Vul in: Naam `Weheat`, plus de Client ID en het Client Secret uit stap 1.
4. Je komt op de inlogpagina van Weheat. Log in met je **Weheat-account** (hetzelfde als in de Weheat-app) en klik op **Link account**.
5. Klaar. Op het paneel staat in de Klimaat-kaart nu wat de warmtepomp doet (verwarmt, boiler, ontdooit, ...). Tik erop voor alle gegevens: temperaturen, boilervat boven en onder, COP, vermogen en compressor.

## 3. Somfy-screens (als de LilyGO binnen is)
Zie [06-screens-en-ventilatie.md](06-screens-en-ventilatie.md). Claude maakt de ESPHome-configuratie klaar.

## 4. Orcon-ventilatie (als de onderdelen binnen zijn)
Het kastje in de keuken is een **Orcon CO2-bedieningssensor 15RF**. Die werkt op 230 V en stuurt de box **draadloos** aan. De box kan dus via de radio-route (RAMSES II, 868 MHz) bediend worden. Zie [06-screens-en-ventilatie.md](06-screens-en-ventilatie.md).
