# De iPad als wandpaneel: onderzoek

## Welke iPad is het?

Je iPad draait **iOS 10.3.3**. Die versie kan een iPad 2 niet draaien (die stopt bij iOS 9.3.5). Het is dus een **iPad van de 4e generatie** (2012). Dat is goed nieuws:

| | iPad 4 |
|---|---|
| Chip / geheugen | Apple A6X (dual-core, 32-bit), 1 GB RAM: twee keer zoveel als een iPad 2 |
| Scherm | 9,7" **Retina**, 2048×1536. Het dashboard rendert op 1024×768 punten en is dus haarscherp |
| Laatste iOS | **iOS 10.3.3** (wifi-model) / 10.3.4 (4G-model). Hoger gaat niet |
| Aansluiting | Lightning |
| Browser | Safari 10. Het dashboard is bewust in "oude" JavaScript (ES5) geschreven, zodat het hier zeker werkt |

Controleer: Instellingen → Algemeen → Info → Modelnummer. A1458 is de wifi-versie, A1459/A1460 hebben 4G.

## Waarom is hij zo traag?

Na jaren updates en apps is het geheugen vol en draaien er veel processen op de achtergrond. Een jailbreak maakt hem **niet** vanzelf sneller. Wat wél helpt, in deze volgorde:

1. **Schoon herinstalleren**: zet iOS 10.3.3 opnieuw terug via een Mac/pc (Finder of iTunes, "Herstel iPad"). Zet daarna **geen back-up** terug, maar stel hem in als nieuwe iPad. Dit scheelt het meest.
2. Alleen Safari gebruiken. Geen andere apps, geen iCloud-sync, en Achtergrondverversing uit.
3. Instellingen → Algemeen → Toegankelijkheid → **Verminder beweging** aan en **Verhoog contrast → Verminder doorzichtigheid** aan.
4. Het dashboard zelf is licht gemaakt (geen frameworks, weinig animatie) en ververst alleen getallen.

## Jailbreaken

Je wilt hem jailbreaken. Op iOS 10.3.3 met een 32-bit iPad zijn er twee opties:

| | **Socket** (aanbevolen) | h3lix (oud) |
|---|---|---|
| Voor | iPhone 5/5c en **iPad 4** op iOS 10 ([The Apple Wiki](https://theapplewiki.com/wiki/Socket), [GitHub](https://github.com/staturnzz/socket)) | Alle 32-bit toestellen op iOS 10 ([The Apple Wiki](https://theapplewiki.com/wiki/H3lix)) |
| Installeren | IPA met Sideloadly, geen patch nodig | IPA moet eerst gepatcht worden, omdat het oude Cydia Impactor niet meer werkt |
| Tweak-winkel | Zebra | Cydia |
| Na een herstart | Met de **Procyon**-untether automatisch weer gejailbreakt ([Procyon-wiki](https://github.com/staturnzz/procyon/wiki)) | Handmatig opnieuw jailbreaken |
| Onderhoud | Nog bijgewerkt | Sinds 2017 nauwelijks |

**Conclusie: Socket + Procyon.** Na een stroomstoring start het wandpaneel dan vanzelf gejailbreakt op (±93% van de keren op de iPad 4; anders één keer handmatig herstarten). Het stappenplan staat in [04-stappenplan.md](04-stappenplan.md).

**Wat levert de jailbreak op voor het wandpaneel:**

| Tweak / tool | Nut |
|---|---|
| **OpenSSH** | Beheer op afstand, bijv. het dashboard herladen zonder de iPad aan te raken |
| **Activator** | Scherm 's nachts uit en 's ochtends aan op tijd, of via een webverzoek vanuit Home Assistant |
| Animaties uitzetten (bijv. NoSlowAnimations) | Voelt sneller aan |
| Updatemeldingen blokkeren | Geen pop-ups over iOS-updates meer |
| Safari of een kioskbrowser automatisch starten | Na een herstart komt het dashboard vanzelf terug (met Procyon) |

> Maak eerst een back-up van wat je wilt bewaren. Jailbreaken is op eigen risico, maar op een oude iPad die alleen nog als scherm dient is het risico klein.

## Zonder jailbreak lukt ook alles

- Schermvullend: Safari → *Deel → Zet op beginscherm*. Het dashboard heeft `apple-mobile-web-app-capable`, dus geen adresbalk.
- Op slot in één app: **Begeleide toegang** (Instellingen → Algemeen → Toegankelijkheid).
- Scherm aan: Automatisch slot op *Nooit*. Het dashboard dimt zelf naar een klok na 2 minuten.

## Belangrijk: de accu

Een oude accu die 24/7 aan de lader hangt kan **opzwellen**. Dat is een echt brandrisico.

- Hang de lader aan een **slimme stekker** (bijv. HomeWizard Energy Socket). Laat Home Assistant die bijvoorbeeld 2 uur aan en 4 uur uit zetten, zodat de accu tussen ongeveer 30 en 80% blijft.
- Kijk af en toe of het scherm bol gaat staan. Is dat zo, dan meteen loskoppelen.

## Ophangen

- Gebruik een inbouwlijst of een (3D-geprinte) wandhouder voor de iPad 4 / iPad 3 (zelfde maat), met een haakse Lightning-kabel in de muur.
- Hang hem op ooghoogte (± 150 cm tot het midden), niet in direct zonlicht.
- Gebruik **http** binnen je eigen netwerk naar Home Assistant. Dat is het eenvoudigst en voorkomt certificaatproblemen op oude iOS.
