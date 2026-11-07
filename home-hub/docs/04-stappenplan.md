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
8. **OpenSSH installeren** in Zebra, en **meteen de wachtwoorden wijzigen** (standaard `alpine`). Zo hebben we het werkend gekregen:
   - **Wachtwoorden wijzigen op de iPad zelf**: installeer **MTerminal** in Zebra en typ `su` (wachtwoord `alpine`), dan `passwd` en `passwd mobile`.
   - **Ontbrekende sleutels aanmaken**: `ssh-keygen -A` (in MTerminal, als root).
   - **Oude SSH-versie**: de iPad heeft OpenSSH 6.7 (uit 2015). Die kent alleen het oude sleuteltype `ssh-rsa`, en een nieuwe Mac staat dat standaard niet toe. Op de Mac zet je `HostKeyAlgorithms +ssh-rsa` in de instellingen (zie hieronder).
   - **Poort 22 bleef hangen**: de standaard automatische start van OpenSSH werkt niet op dit toestel. Daarom draait SSH op **poort 2222**, via een eigen opstartbestand op de iPad: `/Library/LaunchDaemons/nl.thuis.sshd.plist`. Dat start `/usr/sbin/sshd -D -p 2222` bij het opstarten.
   - **Snelkoppeling op de Mac** in `~/.ssh/config`:
     ```
     Host ipad
       HostName 192.168.178.226
       Port 2222
       User root
       HostKeyAlgorithms +ssh-rsa
       PubkeyAcceptedAlgorithms +ssh-rsa
     ```
     Daarna is inloggen gewoon `ssh ipad`. Vlak na een herstart geeft hij een minuutje *Connection refused*, tot de iPad helemaal is opgestart.
   - ✅ **Getest**: na een herstart, zonder Socket te openen, werkt `ssh ipad`. Procyon en de automatische SSH-start doen het dus.
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
7. **Op je Mac of telefoon:** ga naar `http://homeassistant.local` en maak een account aan.
   (Bij deze versie, Home Assistant OS 18, werkt het adres **zonder** `:8123`. Oudere handleidingen noemen nog `:8123`.)

**Klep dicht:** dat werkt bij de meeste laptops gewoon. Test het: klep dicht en kijk of `homeassistant.local` bereikbaar blijft. Gaat hij toch slapen? Dan kan dat met een instelling worden uitgezet (dat doen we samen), of je laat de klep een paar centimeter open; het scherm gaat vanzelf uit.

Tips:
- Zet hem met een kabel bij de router (meterkast of zolder), met de lader eraan.
- Kijk af en toe of de accu niet opzwelt: bolle bodem, of de klep sluit niet goed meer.
- Is het een laptop met een draaiende harde schijf (HDD)? Dat werkt prima. Een SSD (± €20) maakt hem sneller, maar is niet nodig.

## Stap 2b. Zonder USB-stick: Home Assistant in VirtualBox op Windows

Dit is een officieel ondersteunde manier. Windows blijft gewoon op de laptop staan. Later kun je met een back-up overstappen naar stap 2 (± 15 minuten); alles blijft dan bewaard.

**A. Virtualisatie aanzetten**
1. Herstart de laptop en druk herhaaldelijk op **F10** (BIOS).
2. Zet **Virtualization Technology** (ook *SVM* of *AMD-V* genoemd) op **Enabled**. Je vindt het meestal onder *Advanced* of *System Configuration*.
3. Druk op **F10** om op te slaan en af te sluiten.

**B. Downloaden en installeren (op de laptop)**
1. **VirtualBox voor Windows** (virtualbox.org → Downloads): installeer met steeds *Volgende*. Een melding over "Python" mag je negeren.
2. **Home Assistant OS voor VirtualBox**: home-assistant.io → Installation → **Windows** → het **.vdi**-bestand (een .zip). Klik er met rechts op en kies **Alles uitpakken**.

**C. Virtuele machine maken (VirtualBox → Nieuw)**
1. **Naam**: `Home Assistant` (precies zo, dat hebben we straks nodig). **Type**: Linux. **Versie**: *Other Linux (64-bit)*. Laat het ISO-veld leeg.
2. **Hardware**:
   - Geheugen: **3072 MB**
   - Processors: **2**
   - Vink **Enable EFI** aan
3. **Harde schijf**: kies **Bestaande virtuele harde schijf gebruiken** → mapje → *Toevoegen* → kies het uitgepakte `.vdi`-bestand → *Voltooien*.
4. Selecteer de machine → **Instellingen**:
   - **Netwerk** → Adapter 1 → *Gekoppeld aan*: **Netwerkbrug (Bridged Adapter)**. Kies je wifi- of netwerkkaart.
   - **Audio** uitvinken (niet nodig).
5. Klik op **Starten**. De eerste keer duurt het **10–20 minuten** ("Preparing Home Assistant").
6. Ga op je Mac naar **`http://homeassistant.local`**. Werkt dat niet, gebruik dan het IP-adres dat in het VirtualBox-venster staat, met `:8123` erachter. Maak daar je account aan.

**D. Windows zo instellen dat het blijft draaien**
1. Configuratiescherm → **Energiebeheer**:
   - Slaapstand bij **netstroom**: *Nooit*
   - **"Wat het sluiten van de klep doet"** → bij netstroom: *Niets doen*. Dan kan de klep dicht.
2. Instellingen → Windows Update → **Actieve uren**: zet ze op handmatig, bijvoorbeeld 07:00–01:00, zodat updates 's nachts gebeuren.
3. **Automatisch aanmelden** (zodat Home Assistant na een herstart vanzelf start):
   - Instellingen → Accounts → Aanmeldingsopties → zet **"Alleen Windows Hello-aanmelding toestaan"** *uit*.
   - Druk op **Windows + R**, typ `netplwiz` en druk op Enter.
   - Vink **"Gebruikers moeten een gebruikersnaam en wachtwoord opgeven"** *uit* → OK → vul je wachtwoord in.

**E. Home Assistant automatisch starten met Windows**
1. Sluit eerst het VirtualBox-venster netjes af: rechtsklik op de machine → **Sluiten → ACPI-afsluitsignaal**.
2. Druk op **Windows + R**, typ `shell:startup` en druk op Enter. Er opent een map.
3. Rechtsklik in die map → **Nieuw → Snelkoppeling**. Plak als locatie:
   ```
   "C:\Program Files\Oracle\VirtualBox\VBoxManage.exe" startvm "Home Assistant" --type headless
   ```
   Klik op *Volgende* en geef hem de naam `Home Assistant starten`.
4. Dubbelklik er één keer op om te testen. Home Assistant start nu **onzichtbaar op de achtergrond**. In VirtualBox zie je de machine wel op *Actief* staan.
5. **Test**: herstart Windows en wacht 5 minuten. Werkt `homeassistant.local` dan weer? Dan is het klaar.

**Problemen?**
- Zie je in VirtualBox een **groen schildpadje** onderin, of is alles extreem traag? Zet dan in Windows-beveiliging → Apparaatbeveiliging → Kernisolatie → **Geheugenintegriteit** *uit* en herstart.
- *"VT-x/AMD-V is not available"*: virtualisatie staat nog uit in de BIOS (stap A).
- Zet in de FRITZ!Box (`fritz.box` → Thuisnetwerk → Netwerk) bij **homeassistant** ook **"Altijd hetzelfde IPv4-adres toewijzen"** aan.

## Stap 2c. Netwerkkabel en vast IP-adres (zo staat het nu)

- De laptop ligt **dicht** in de meterkast, met een **netwerkkabel** naar het Ziggo-modem en de lader eraan. Met de klep dicht blijft hij gewoon draaien (getest).
- Home Assistant heeft een **vast adres: `192.168.178.250`**, ingesteld in Home Assistant zelf (niet in het modem). Het netwerkscherm in Home Assistant gaf een fout (dubbele `/24`), daarom is het via de **Terminal & SSH-app** gedaan (Instellingen → Apps → Terminal & SSH → Open web UI):
  ```
  ha network update enp2s0 --ipv4-method static --ipv4-address 192.168.178.250/24 --ipv4-gateway 192.168.178.1 --ipv4-nameserver 192.168.178.1
  ha network update wlp3s0 --disabled
  ```
- Op de laptop zelf typ je dezelfde commando's **zonder** `ha` ervoor (daar staat al `ha >`).
- **Stroomstoring:** korte storingen vangt de accu op. Is de accu leeg geraakt, dan gaat de laptop niet vanzelf weer aan: druk dan één keer op de aan-knop.

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

**A. Bestanden op Home Assistant zetten (Samba)**
1. Ga naar **Instellingen → Add-ons → Samba share** → *Installeren*. Vul bij *Configuratie* een username en password in en klik op **Starten**.
2. Druk op de Mac in Finder op **⌘ + K**, typ `smb://homeassistant.local`, log in met die username en dat password en kies **config**. Laat dit venster open.

**B. Alles in één keer installeren en het token erin zetten (Terminal op de Mac)**
Plak dit in de Terminal en druk op Enter:
```
printf "Plak je token en druk op Enter (je ziet niets, dat is normaal): "; read -s T; echo; T=$(printf %s "$T" | tr -d "[:space:]"); W=/Volumes/config/www/thuis; B=https://raw.githubusercontent.com/keizersmit/claude/claude/blissful-archimedes-2uuo74/home-hub/dashboard; if [ ! -d /Volumes/config ]; then echo "Map config niet gevonden: verbind eerst in Finder met smb://homeassistant.local"; else mkdir -p "$W"; for f in index.html style.css app.js config.js; do curl -fsSL "$B/$f" -o "$W/$f" || echo "FOUT bij $f"; done; perl -pi -e "s/PLAK_HIER_EEN_LONG_LIVED_ACCESS_TOKEN/$T/" "$W/config.js" && grep -q "$T" "$W/config.js" && echo "Token staat in config.js"; curl -s -o /dev/null -w "Token-test: %{http_code}  (200 = goed, 401 = token fout)\n" -H "Authorization: Bearer $T" http://192.168.178.250/api/; fi
```
Hij vraagt om het token. Maak het aan in Home Assistant (**je naam → Beveiliging → Langdurige toegangstokens → Token aanmaken**), kopieer het, plak het in de Terminal en druk op Enter. Je moet zien: `Token staat in config.js` en `Token-test: 200`.
**Updates van het paneel**: gewoon via de **Terminal in Home Assistant**. Samba of Finder is niet nodig, en je config.js met het token blijft staan.
Open `http://192.168.178.250`, klik in de zijbalk op **Terminal** en plak:
```
D=/config/www/thuis; [ -d $D ] || D=/homeassistant/www/thuis; cd $D && for f in index.html style.css app.js icon-180.png icon-152.png; do (curl -fsSL "https://raw.githubusercontent.com/keizersmit/claude/claude/blissful-archimedes-2uuo74/home-hub/dashboard/$f?$(date +%s)" -o $f || wget -qO $f "https://raw.githubusercontent.com/keizersmit/claude/claude/blissful-archimedes-2uuo74/home-hub/dashboard/$f") && echo "OK $f"; done
```
Je ziet vijf keer **OK**. Sluit daarna de app op de iPad af en open hem opnieuw.

**C. Op de iPad**
1. Open Safari en ga naar `http://192.168.178.250/local/thuis/index.html?app=2`. Gebruik het **IP-adres**; de oude iPad vindt `homeassistant.local` niet.
2. Staat er linksboven **"Verbonden"**? Kies dan **Deel → Zet op beginscherm**.
3. ⚠️ **Een icoon op het beginscherm heeft een eigen geheugen.** Toont het icoon een oude versie (bijv. "Demo-modus") terwijl Safari "Verbonden" laat zien? Verwijder dan het icoon en maak het opnieuw aan met een ander nummer: `?app=3`, `?app=4`, enzovoort.
4. Zet daarna **Begeleide toegang** aan (Instellingen → Algemeen → Toegankelijkheid).

**D. Helpers voor bediening op afstand (optioneel)**
Ga naar Instellingen → Apparaten & diensten → **Helpers**:
- Maak een *Knop* `wandpaneel_herladen` aan: indrukken laat het paneel opnieuw laden.
- Maak een *Schakelaar* `wandpaneel_scherm_uit` aan: aan maakt het paneel zwart.

## Stap 5. Op afstand (gratis)

- **Huis bedienen vanaf je telefoon**: installeer de add-on **Tailscale** in Home Assistant en de Tailscale-app op je telefoon. Met de Home Assistant-app werkt alles dan ook buiten de deur. Je hoeft geen poorten open te zetten.
- **De iPad beheren op afstand**:
  - *Zonder SSH*: met de helpers uit stap 4 herlaad je het paneel of zet je het scherm zwart. Dat kan gewoon vanuit de Home Assistant-app.
  - *Met SSH (jailbreak)*: installeer de add-on **Advanced SSH & Web Terminal** in Home Assistant. Via Tailscale kom je op Home Assistant, en daarvandaan met `ssh root@<ip-van-de-ipad>` op de iPad. Handig: `killall -9 SpringBoard` herstart de interface. Gebruik **geen** `reboot` op afstand, want daarna moet je er even bij om opnieuw te jailbreaken.

## Stap 6. De accu sparen

Laat de iPad niet 24/7 laden. Heb je een HomeWizard Energy Socket of een andere slimme stekker? Laat Home Assistant die dan 2 uur aan en 4 uur uit zetten. Een simpele tijdschakelklok (± €5) werkt ook.
