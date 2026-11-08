# Somfy-screens en Orcon-ventilatie: alle opties

Uitgezocht in november 2026.

## Waarom het niet met alleen software kan
De screens (Somfy io) en de ventilatie (Orcon) praten draadloos op **868 MHz**. De laptop met Home Assistant heeft alleen wifi, bluetooth en ethernet en kan op 868 MHz niet zenden. Er is ook geen gratis cloudroute: Somfy io werkt alleen via een eigen Somfy-kastje, en Orcon heeft geen app met een koppeling.

Je hebt dus altijd een **zendertje** nodig. Maar dat hoeft geen dure TaHoma te zijn: een ESP32-printje van ± €20–30 met gratis software werkt ook. Het printje komt los in een stopcontact (USB-lader) en praat via wifi met Home Assistant. Je zet de software erop vanuit Home Assistant zelf, met de app **ESPHome**.

---

## Somfy io-screens (Situo 1 io)

| Optie | Kosten | Positie zichtbaar? | Oordeel |
|---|---|---|---|
| **somfy-io-bridge** (ESPHome, open source) | ± €20–30 (LilyGO-printje) | Geschat via de looptijd | **Aanrader** |
| Somfy TaHoma Switch (nieuw) | ± €150+ | Ja, echt | Werkt zeker, maar duur |
| Connexoon io / TaHoma (tweedehands, Marktplaats) | ± €40–80 | Ja, echt | Goed alternatief |
| Extra Situo-afstandsbediening laten "indrukken" door een printje | ± €35 | Nee | Solderen, niet aanbevolen |

### De aanrader: somfy-io-bridge
- Project: [danielpetrovic/somfy-io-bridge](https://github.com/danielpetrovic/somfy-io-bridge). Het bouwt op het reverse-engineeringwerk van [Velocet/iown-homecontrol](https://github.com/Velocet/iown-homecontrol).
- **Hardware**: één **LilyGO TTGO T3 LoRa32 868 MHz V1.6.1**. Let op: koop de **868 MHz**-versie, niet 433 of 915. Je hoeft niets te solderen.
- **Status**: "stabiel voor 1W". Volgens de maker gebruikt hij het dagelijks voor 14 screens/rolluiken.
- **Geen TaHoma nodig.** Het printje doet zich voor als een extra afstandsbediening:
  1. Houd **PROG** op je bestaande Situo ingedrukt tot de screen kort op en neer beweegt.
  2. Druk binnen 10 minuten in Home Assistant op de knop **Program** van die screen.
  3. De screen beweegt nog een keer: klaar. Je Situo-afstandsbedieningen blijven gewoon werken.
- **Bediening**: open, dicht, stop, "My"-stand en een percentage. Het paneel weet de stand doordat het de looptijd meet. Je stelt per screen in hoeveel seconden open en dicht duurt.
- **Beperking**: de screen meldt zijn stand niet terug. Bedien je met de Situo, dan weet het paneel dat niet. Gebruik je verder alleen het paneel of de telefoon, dan klopt het.
- Één printje kan alle 3 screens bedienen.

---

## Orcon-ventilatie

Eerst moet duidelijk zijn **welk type** je hebt:
- **Draadloze afstandsbediening** (op batterijen, de Orcon "15RF") → de radio-route hieronder.
- **Vaste standenschakelaar in de muur** (met draden) → de radio-route werkt niet. Dan een printje in de box, of een slim relais achter de schakelaar.

| Optie | Kosten | Voor welk type | Oordeel |
|---|---|---|---|
| **ESPHome-printje dat zich voordoet als je afstandsbediening** ([xupefei/esphome-orcon-mvs15](https://github.com/xupefei/esphome-orcon-mvs15)) | ± €15–45 | Box met draadloze afstandsbediening | **Aanrader** |
| USB-stick met evofw3 + **ramses_cc** in Home Assistant ([tomkooij/promicro-cc1101](https://github.com/tomkooij/promicro-cc1101)) | ± €15–40 | Box met draadloze afstandsbediening | Ook goed |
| OrconWifiController ([Tindie](https://www.tindie.com/products/hjhickinson/orconwificontroller-for-orcon-mvs-15/)) | ± €50 | MVS-15, wordt in de box geplaatst | Als het niet draadloos is |
| Slim relais achter de standenschakelaar | ± €15–25 | Vaste schakelaar | 230 volt: laat een elektricien dit aansluiten |

### De aanrader: ESPHome als "nep-afstandsbediening"
- **Hardware**: een ESP32 met een **CC1101 868 MHz**-module. Kant-en-klaar is dat het **IndaloTech ramses_esp**-printje. Zelf bouwen met een ESP32 en een E07-900MM10S-module is goedkoper, maar dan moet je solderen.
- Het printje stuurt dezelfde signalen als je eigen afstandsbediening. **Koppelen is niet nodig**, en de echte afstandsbediening blijft werken.
- **Bediening**: Weg / Laag / Midden / Hoog / Auto en Boost 15/30/60 min. Het printje luistert ook naar de box, dus het paneel ziet de juiste stand, ook als je de gewone afstandsbediening gebruikt.
- **Eenmalig**: druk een paar keer op je afstandsbediening terwijl het printje meeluistert. Zo leer je het adres van je afstandsbediening en van de box.

---

## Kan één printje beide doen?
Nee. Somfy io gebruikt een SX1276-radio (LilyGO) en Orcon een CC1101. Het zijn dus twee printjes, samen ± €40–70. Ter vergelijking: een TaHoma alleen kost al ± €150.

## Wat ik nodig heb om verder te gaan
1. **Orcon**: een foto van het kastje bij de keuken, en het typeplaatje van de box op zolder.
2. **Somfy**: niets. Bestel de **LilyGO TTGO T3 LoRa32 868 MHz V1.6.1**, dan maak ik de ESPHome-configuratie klaar voor de 3 screens en koppel ik ze aan het paneel.
