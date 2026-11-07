# iPad 2 als wandpaneel: onderzoek

## Wat de iPad 2 kan (en wat niet)

| | iPad 2 (2011) |
|---|---|
| Chip / geheugen | Apple A5 (dual-core, 32-bit), 512 MB RAM |
| Scherm | 9,7", 1024×768, geen retina |
| Laatste iOS | **iOS 9.3.5** (wifi-model) / 9.3.6 (3G-model) |
| Browser | Safari 9: geen moderne JavaScript (ES6), geen CSS Grid, geen `fetch` |
| HTTPS | Vertrouwt de huidige Let's Encrypt-certificaten niet meer, dus **gebruik http binnen je eigen netwerk** |

Wat dat in de praktijk betekent:

- **De standaard Home Assistant-app en de normale dashboards (Lovelace) werken niet meer goed op iOS 9.** De frontend is te zwaar en gebruikt moderne JavaScript. Op het Home Assistant-forum lopen veel mensen hier tegenaan ([iPad 2 als dashboard](https://community.home-assistant.io/t/found-an-old-ipad-2-does-it-worth-to-usi-it-as-dashboard/377458), [Lovelace op iOS 9.3.5](https://community.home-assistant.io/t/options-for-lovelace-on-older-ipad-ios-9-3-5/125497/95)).
- **De oplossing is een eigen, licht dashboard** dat speciaal voor deze iPad is geschreven. Dat staat in [`../dashboard`](../dashboard). Het gebruikt alleen ES5-JavaScript en praat direct met de REST API van Home Assistant.
- De iPad wordt dus **alleen een scherm**. Al het slimme werk (koppelingen, automatiseringen) gebeurt op een klein kastje ernaast (zie [02-architectuur.md](02-architectuur.md)).

## Moet je jailbreaken?

**Kort antwoord: het hoeft niet, maar het mag.** Alles wat het wandpaneel nodig heeft kan ook zonder jailbreak:

| Wens | Zonder jailbreak | Met jailbreak |
|---|---|---|
| Dashboard schermvullend | Safari, *Deel → Zet op beginscherm* (de pagina heeft `apple-mobile-web-app-capable`, dus geen adresbalk) | idem |
| iPad "op slot" in één app | **Begeleide toegang** (Instellingen → Algemeen → Toegankelijkheid). Drukken op de thuisknop doet dan niets meer | Kiosk-tweaks |
| Scherm blijft aan | Automatisch slot op *Nooit*. Het dashboard dimt zelf naar een klok na 2 minuten | Activator: scherm aan/uit op tijd of via een signaal |
| Na een herstart zelf opstarten | Nee, je moet één keer tikken | Ja (bij een untethered jailbreak) |
| SSH / remote beheer | Nee | Ja (OpenSSH via Cydia) |

**Mijn advies:** begin zonder jailbreak. Lukt dat en wil je daarna meer, bijvoorbeeld het scherm automatisch aan- en uitzetten of beheer op afstand, dan kun je alsnog jailbreaken.

## Als je toch wilt jailbreaken: de routes

> Je iPad staat volgens jou volledig up-to-date. Bij een iPad 2 is dat **iOS 9.3.5** (wifi) of 9.3.6 (3G), dus route A hieronder past.
> Controleer eerst je versie: Instellingen → Algemeen → Info. Noteer de iOS-versie en het modelnummer (A1395 = wifi, A1396/A1397 = 3G).
> Maak eerst een back-up. Bij een jailbreak of downgrade kun je alles kwijtraken.

### Route A: blijven op iOS 9.3.5 (eenvoudigst)
- **Phoenix** of **openpwnage**: allebei *semi-untethered* jailbreaks voor 32-bit toestellen op 9.3.5/9.3.6 ([AppleDB: openpwnage](https://appledb.dev/jailbreak/openpwnage.html), [Phoenix-aankondiging](https://www.iclarified.com/61836/phoenix-jailbreak-released-for-32bit-devices-on-ios-935)).
- Semi-untethered betekent dat je na elke herstart de app opnieuw opent en op *Jailbreak* tikt.
- Je zet de app op de iPad met **Sideloadly** of **AltStore** en een (gratis) Apple ID. Met een gratis Apple ID verloopt het certificaat na 7 dagen. Een wandpaneel herstart zelden, dus dat is meestal geen probleem.

### Route B: downgraden naar iOS 8.4.1 of 6.1.3 met Legacy iOS Kit (meer werk, untethered)
- **[Legacy iOS Kit](https://www.theapplewiki.com/wiki/Legacy_iOS_Kit)** (LukeZGD) kan A5-toestellen zoals de iPad 2 zonder opgeslagen SHSH-blobs terugzetten naar **iOS 8.4.1 of 6.1.3**. Apple tekent die versies nog steeds via OTA. Het kan het toestel daarbij ook direct jailbreaken.
- Voordeel: een **untethered** jailbreak, dus na een herstart blijft de jailbreak gewoon actief.
- Nadeel: Safari 8 en Safari 6 zijn nog ouder. Het dashboard in deze map is ES5 en zou op 8.4.1 ook moeten werken, maar dat moet je testen. Op iOS 6 werkt het waarschijnlijk niet goed.
- Je hebt er een Mac of Linux-pc en een USB-kabel voor nodig.

### Mijn conclusie
**Route A, of helemaal geen jailbreak.** iOS 9.3.5 heeft de beste Safari die deze iPad ooit krijgt, en dat is precies wat het wandpaneel nodig heeft. Een downgrade levert vooral "untethered" op, en dat voordeel is klein voor een apparaat dat altijd aan de lader zit.

## Belangrijk: de accu

Een 15 jaar oude accu die 24/7 aan de lader hangt kan **opzwellen**. Dat is een echt brandrisico.

- Hang de lader aan een **slimme stekker**. Een HomeWizard Energy Socket past goed bij wat je al hebt. Laat Home Assistant die bijvoorbeeld 2 uur aan en 4 uur uit zetten, zodat de accu tussen ongeveer 30 en 80% blijft.
- Kijk af en toe of het scherm bol gaat staan of loskomt van de behuizing. Is dat zo, dan meteen loskoppelen.
- Voor de lange termijn: een accu-vervanging is goedkoop, of laat iemand de iPad direct op voeding ombouwen.

## Ophangen

- Gebruik een inbouwlijst of een 3D-geprinte wandhouder voor iPad 2. Er zijn genoeg gratis ontwerpen op Printables of Thingiverse.
- Leg de kabel in de muur of in een kabelgoot, met een haakse 30-pins kabel.
- Hang hem op ooghoogte (± 150 cm tot het midden), niet in direct zonlicht.
