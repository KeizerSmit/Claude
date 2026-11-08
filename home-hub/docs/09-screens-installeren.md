# Somfy-screens koppelen met de LilyGO (± 30 min)

Je hebt nodig:
- de **LilyGO TTGO T3 LoRa32 868 MHz V1.6.1**;
- een **micro-USB-kabel** waarmee je ook gegevens kunt overzetten (geen kabel die alleen laadt);
- de **Situo-afstandsbedieningen** van de screens.

## 1. ESPHome installeren (eenmalig)
Ga in Home Assistant naar **Instellingen → Apps → App-winkel**. Zoek **ESPHome Device Builder**, klik op **Installeren** en daarna op **Starten**. Zet ook **Toon in zijbalk** aan.

## 2. De screens-software klaarzetten (Terminal)
Open **Terminal** en plak:
```
curl -fsSL https://raw.githubusercontent.com/keizersmit/claude/claude/blissful-archimedes-2uuo74/home-hub/esphome/installeer-screens.sh -o /tmp/s.sh && bash /tmp/s.sh
```
Het script vraagt de **naam van je wifi** en het **wifi-wachtwoord**. Die typ je alleen daar; ze blijven in Home Assistant. Je moet 3× **OK** zien.

## 3. De LilyGO programmeren
1. Steek de LilyGO met de USB-kabel in de **laptop met Home Assistant** (in de meterkast).
2. Open **ESPHome** in de zijbalk. Klik bij **Somfy screens** op **⋮ → Install → Plug into the computer running ESPHome Device Builder** en kies de USB-poort.
3. Wacht tot hij klaar is. De eerste keer duurt dat **5–15 minuten**.
4. Home Assistant meldt daarna **Nieuw apparaat gevonden: Somfy screens**. Klik op **Configureren**. Vraagt hij om een sleutel, kijk die dan op in de Terminal met:
   ```
   grep io_bridge_api_key /config/esphome/secrets.yaml
   ```
   Neem alleen het deel tussen de aanhalingstekens over.

## 4. Een vaste plek geven
Haal de LilyGO uit de laptop en steek hem in een **gewone USB-lader** op een centrale plek, bijvoorbeeld de **overloop op de 1e verdieping**. Daar zit hij dicht bij alle drie de screens. Hij praat via wifi met Home Assistant.

## 5. Elke screen één keer koppelen
Doe dit per screen:
1. Houd op de **Situo** van die screen de **PROG**-knop (achterop) ingedrukt tot de screen **kort op en neer beweegt**.
2. Ga binnen 10 minuten in Home Assistant naar **Instellingen → Apparaten → Screen slaapkamer …** en druk op **Program (1W)**.
3. De screen beweegt nog een keer: hij is gekoppeld. De Situo blijft gewoon werken.

## 6. Looptijd instellen (voor de juiste stand op het paneel)
Meet met een stopwatch hoe lang de screen erover doet om helemaal **open** en helemaal **dicht** te gaan. Vul dat bij het apparaat in, bij **Travel Time Open** en **Travel Time Close** (in seconden).

## Klaar
Op het paneel staan de screens onder **Lampen → Screens**, en op de tekening zie je het doek zakken. Ze heten `cover.screen_slaapkamer_1`, `_3` en `_4`; zo staan ze al in `config.js`.

**Goed om te weten**
- Het paneel weet de stand doordat het de looptijd meet. Bedien je met de Situo, dan weet het paneel dat niet.
- Komt het signaal niet aan? Zet de LilyGO dan dichter bij de screens, bijvoorbeeld op de zolderoverloop.
- De software is open source: [danielpetrovic/somfy-io-bridge](https://github.com/danielpetrovic/somfy-io-bridge).
