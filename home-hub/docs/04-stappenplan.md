# Stappenplan: zo goedkoop mogelijk

Doel: het wandpaneel werkend krijgen, op afstand te beheren, met zo min mogelijk aankopen.

## Wat kost wat?

| Onderdeel | Gratis? | Toelichting |
|---|---|---|
| iPad 4 jailbreaken (Socket + Procyon) | ✅ €0 | Sideloadly + een (extra) Apple ID |
| Home Assistant (software) | ✅ €0 | Open source |
| Computer waar Home Assistant op draait | ✅ €0 *als je een oude laptop/pc hebt* | Anders tweedehands thin client (bijv. Dell Wyse 5070, HP t630, Fujitsu Futro) ± €30–60 via Marktplaats, of een Home Assistant Green ± €100–130 |
| HomeWizard (P1, kWh-meters) | ✅ €0 | Lokale koppeling |
| Weheat Blackbird | ✅ €0 | Officiële koppeling (cloud, alleen uitlezen) |
| Honeywell (wifi) | ✅ €0 | HomeKit Device (lokaal) of de Honeywell/Lyric-koppeling (cloud) |
| LG-aircos | ✅ €0 | LG ThinQ-koppeling (cloud), als de units wifi hebben |
| LUUMR-lampen | ✅ €0 *als je al een gateway/app gebruikt* | Via Smart Life/Tuya (cloud). Zonder gateway: Zigbee-stick ± €25–35 |
| Buienradar, afvalkalender | ✅ €0 | |
| **Op afstand** (huis + iPad) | ✅ €0 | **Tailscale** (gratis voor thuisgebruik) + de Home Assistant-app op je telefoon |
| Somfy io-screens | ❌ | io-homecontrol is versleuteld en heeft een Somfy-gateway nodig. Goedkoopst: een **tweedehands TaHoma of Connexoon io** (vaak €40–80 op Marktplaats; de lokale API werkt ook op de Connexoon io), nieuw een TaHoma Switch ± €150–200 |
| Orcon-ventilatie | ❌ | 868 MHz USB-stick ± €30–50. Kan later; het kastje in de keuken blijft gewoon werken |

**Gratis start:** alles behalve de screens en de ventilatie. Die twee kun je later toevoegen. In het dashboard staan ze klaar, maar ze doen pas iets als ze gekoppeld zijn.

---

## Stap 1. De iPad jailbreaken (Socket + Procyon, iOS 10.3.3)

We gebruiken **Socket** en niet h3lix. Socket is nieuwer, gemaakt voor precies dit toestel (iPad 4 op iOS 10), en hoeft niet eerst "gepatcht" te worden. Daarbovenop komt **Procyon**: die zorgt dat de iPad na een herstart of stroomstoring **vanzelf** weer gejailbreakt opstart. Ideaal voor een wandpaneel.

De officiële handleiding staat op **ios.cfw.guide → "Installing socket"**. Volg die als hoofdbron; hieronder staat de route in het kort.

Nodig: je Mac, de Lightning-kabel en een **apart, nieuw Apple ID** (niet je eigen account).

1. **Schoon beginnen (aanbevolen).** Zet de iPad terug via Finder op de Mac (*iPad herstellen*) en stel hem in als **nieuwe** iPad, zonder back-up. Updates hoeven niet: iOS 10.3.3 is de laatste versie voor deze iPad.
2. **Sideloadly installeren** op de Mac (sideloadly.io).
3. **Socket downloaden**: het `.ipa`-bestand van de officiële bron (socket-jb.app, of de "Releases" op github.com/staturnzz/socket).
4. **Installeren**: iPad aansluiten, de IPA in Sideloadly slepen, het aparte Apple ID invullen en op *Start* drukken.
5. **Vertrouwen op de iPad**: Instellingen → Algemeen → **Apparaatbeheer** (of Profielen) → het Apple ID → *Vertrouw*.
6. **Jailbreaken**: open de Socket-app en tik op *jailbreak*. Lukt het niet in één keer? Herstart en probeer opnieuw; dat is normaal. Daarna verschijnt **Zebra**. Dat is de app-winkel voor tweaks, de opvolger van Cydia.
7. **Procyon (automatisch jailbreaken na herstart)**: voeg in Zebra de bron `https://lukezgd.github.io/repo` toe en installeer **procyon untether**. Op de iPad 4 met iOS 10.3.2+ lukt het automatisch opstarten in ±93% van de keren. Blijft hij een keer hangen bij het opstarten (geen beginscherm)? Houd dan de aan/uit-knop en de thuisknop tegelijk ingedrukt tot het Apple-logo verschijnt.
8. **OpenSSH installeren** in Zebra, en **meteen de wachtwoorden wijzigen**. Het standaardwachtwoord is voor iedereen hetzelfde (`alpine`). Log via SSH in en typ `passwd` (voor root) en `passwd mobile`.
9. **Handige extra's** (als de bronnen nog bereikbaar zijn):
   - *Activator*: acties op knoppen en gebaren
   - *NoSlowAnimations*: snellere animaties
   - een tweak die updatemeldingen blokkeert

**Let op:**
- Met Procyon hoef je na een herstart **niets** te doen. Daardoor maakt het ook niet uit dat de Socket-app na **7 dagen** verloopt (bij een gratis Apple ID): die app heb je alleen nodig als je ooit opnieuw moet jailbreaken.
- Zonder Procyon is Socket *semi-untethered*: na een herstart open je Socket en tik je weer op *jailbreak*.
- Installeer Procyon **niet** samen met de tweak "CoolBooter Untetherer". Volgens de makers start de iPad dan op met een zwart scherm.

## Stap 2. Home Assistant installeren (gratis)

We gebruiken de **HP Laptop 15-bw0xx** (AMD A6-9220, 8 GB RAM, 64-bit). Die is ruim genoeg voor Home Assistant OS. Hij is traag onder Windows, maar Home Assistant OS is veel lichter. Hij verbruikt zo'n **6–10 W**, oftewel ± €15–25 per jaar. De accu werkt als noodstroom.

**Let op: Home Assistant OS wist Windows en alles op de laptop.** Zet eerst bestanden die je wilt houden op een USB-stick of in de cloud.

Nodig: een USB-stick van minimaal 8 GB, je Mac, en een netwerkkabel naar de router (aanbevolen; wifi kan ook).

1. **Op de Mac:** download *Ubuntu Desktop* (ubuntu.com) en *balenaEtcher*. Zet Ubuntu met Etcher op de USB-stick.
2. **BIOS van de HP:** zet de laptop aan en druk meteen herhaaldelijk op **F10**. Zet **Secure Boot uit** (Home Assistant OS ondersteunt dat niet) en laat UEFI-boot aan. Opslaan en afsluiten.
3. **Opstarten van de USB-stick:** stick erin, aanzetten en herhaaldelijk op **F9** drukken (opstartmenu). Kies de USB-stick en dan *Try Ubuntu* (niet installeren).
4. **In Ubuntu:** open Firefox, ga naar home-assistant.io → Installation → *Generic x86-64*, en download het Home Assistant OS-bestand (`haos_generic-x86-64-….img.xz`).
5. Open de app **Schijven** (*Disks*). Kies de **interne schijf van de laptop** (niet de USB-stick!), dan **⋮ → Schijfkopie terugzetten** (*Restore Disk Image*) en kies het gedownloade bestand. Bevestig.
6. Klaar? Zet de laptop uit, haal de USB-stick eruit en zet hem weer aan. Na een paar minuten staat er een adres op het scherm.
7. **Op je Mac of telefoon:** ga naar `http://homeassistant.local:8123` en maak een account aan.

**Klep dicht:** dat werkt bij de meeste laptops gewoon. Test het: klep dicht en kijk of `homeassistant.local:8123` bereikbaar blijft. Gaat hij toch slapen? Dan kan dat met een instelling worden uitgezet (dat doen we samen), of je laat de klep een paar centimeter open; het scherm gaat vanzelf uit.

Tips:
- Zet hem met een kabel bij de router (meterkast of zolder), met de lader eraan.
- Kijk af en toe of de accu niet opzwelt: bolle bodem, of de klep sluit niet goed meer.
- Is het een laptop met een draaiende harde schijf (HDD)? Dat werkt prima. Een SSD (± €20) maakt hem sneller, maar is niet nodig.

## Stap 3. Koppelingen toevoegen (Instellingen → Apparaten & diensten)

1. **HomeWizard**: zet in de HomeWizard-app per meter *Lokale API* aan. Home Assistant vindt ze dan vanzelf.
2. **Weheat**: log in met je Weheat-account. De Client ID en Client Secret staan in de Weheat-kennisbank.
3. **Honeywell (wifi)**:
   - Zit er een **HomeKit-code** op de thermostaat of in de doos, zoals bij de T6? Kies dan *HomeKit Device*. Dat is **lokaal** en het snelst. Haal hem eerst uit de Apple Woning-app als hij daar in staat, want HomeKit staat maar één "baas" toe.
   - Anders: de Honeywell- of Lyric-koppeling, via de cloud.
4. **LG ThinQ**: maak op de LG ThinQ-site een *personal access token* aan en vul die in. Je krijgt drie airco-entiteiten.
5. **LUUMR**: voeg de lampen (of de gateway) toe aan de gratis **Smart Life**-app en koppel daarna de **Tuya**-integratie door met die app een QR-code te scannen.
6. **Buienradar**: voor het weer en de regen in Tilburg.
7. Later: **Overkiz** (Somfy, met TaHoma/Connexoon) en **ramses_cc** (Orcon, met een 868 MHz-stick).

## Stap 4. Het dashboard op de iPad

1. Installeer de add-on **File editor** (of Samba) en kopieer de map `dashboard/` naar `/config/www/thuis/`.
2. Maak een **long-lived access token** aan (Profiel → Beveiliging) en zet die in `config.js`. Vul de entiteit-namen in en zet `mode: 'homeassistant'`.
3. Maak twee **helpers** aan (Instellingen → Apparaten & diensten → Helpers):
   - *Knop* `wandpaneel_herladen`: indrukken = het paneel laadt opnieuw, ook op afstand.
   - *Schakelaar* `wandpaneel_scherm_uit`: aan = het paneel wordt zwart, bijvoorbeeld 's nachts of als iedereen weg is. Aanraken maakt hem even wakker.
4. Open op de iPad in Safari `http://<ip-van-home-assistant>:8123/local/thuis/index.html`. Kies *Deel → Zet op beginscherm* en open hem vanaf het beginscherm. Zet daarna **Begeleide toegang** aan.

## Stap 5. Op afstand (gratis)

- **Huis bedienen vanaf je telefoon**: installeer de add-on **Tailscale** in Home Assistant en de Tailscale-app op je telefoon. Met de Home Assistant-app werkt alles dan ook buiten de deur. Je hoeft geen poorten open te zetten.
- **De iPad beheren op afstand**:
  - *Zonder SSH*: met de helpers uit stap 4 herlaad je het paneel of zet je het scherm zwart. Dat kan gewoon vanuit de Home Assistant-app.
  - *Met SSH (jailbreak)*: installeer de add-on **Advanced SSH & Web Terminal** in Home Assistant. Via Tailscale kom je op Home Assistant, en daarvandaan met `ssh root@<ip-van-de-ipad>` op de iPad. Handig: `killall -9 SpringBoard` herstart de interface. Gebruik **geen** `reboot` op afstand, want daarna moet je er even bij om opnieuw te jailbreaken.

## Stap 6. De accu sparen

Laat de iPad niet 24/7 laden. Heb je een HomeWizard Energy Socket of een andere slimme stekker? Laat Home Assistant die dan 2 uur aan en 4 uur uit zetten. Een simpele tijdschakelklok (± €5) werkt ook.
