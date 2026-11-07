# Stappenplan: zo goedkoop mogelijk

Doel: het wandpaneel werkend krijgen, op afstand te beheren, met zo min mogelijk aankopen.

## Wat kost wat?

| Onderdeel | Gratis? | Toelichting |
|---|---|---|
| iPad 4 jailbreaken (h3lix) | ✅ €0 | Sideloadly + een (extra) Apple ID |
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

## Stap 1. De iPad jailbreaken (h3lix, iOS 10.3.3)

Nodig: een Windows-pc of Mac, de Lightning-kabel en een Apple ID. Neem bij voorkeur een **apart, nieuw Apple ID** en niet je eigen account.

1. **Schoon beginnen (aanbevolen).** Zet de iPad terug via Finder (Mac) of iTunes (Windows): *iPad herstellen*. Stel hem in als **nieuwe** iPad, zonder back-up. Updates hoeven niet: iOS 10.3.3 is de laatste versie voor deze iPad.
2. **Sideloadly installeren** op de computer (sideloadly.io). Op Windows heb je ook iTunes nodig, de versie van apple.com en niet die uit de Microsoft Store.
3. **h3lix downloaden**: de IPA voor iOS 10 (32-bit) van de officiële h3lix-site van tihmstar. Download alleen van de officiële bron.
4. **Installeren**: iPad aansluiten, de IPA in Sideloadly slepen, je Apple ID invullen en op *Start* drukken.
5. **Vertrouwen op de iPad**: Instellingen → Algemeen → **Apparaatbeheer** (of Profielen) → jouw Apple ID → *Vertrouw*.
6. **Jailbreaken**: open h3lix en tik op *jailbreak*. Lukt het niet in één keer? Herstart de iPad en probeer opnieuw; dat is normaal. Daarna verschijnt **Cydia**.
7. **OpenSSH installeren** in Cydia, en **meteen de wachtwoorden wijzigen**. Het standaardwachtwoord is voor iedereen hetzelfde (`alpine`). Log via SSH in en typ `passwd` (voor root) en `passwd mobile`.
8. **Handige extra's** (als de repositories nog bereikbaar zijn; sommige oude bronnen zijn offline):
   - *Activator*: acties op knoppen en gebaren
   - *NoSlowAnimations*: snellere animaties
   - een tweak die updatemeldingen blokkeert

**Let op:**
- **Na een herstart** open je h3lix en tik je weer op *jailbreak*. Herstart de iPad dus niet op afstand, want dan moet je er even bij.
- Met een gratis Apple ID **verloopt de h3lix-app na 7 dagen**. Dat merk je alleen bij een herstart: installeer hem dan opnieuw met Sideloadly (stap 4) en tik weer op jailbreak.

## Stap 2. Home Assistant installeren (gratis)

- Heb je een oude laptop of pc? Installeer daar **Home Assistant OS** op (de installatiehandleiding "Generic x86-64" op home-assistant.io). Een laptop is zelfs handig: de accu werkt als noodstroom.
- De computer moet 24/7 aan blijven. Een oude laptop of thin client verbruikt ongeveer 5–15 W, oftewel €10–35 per jaar.

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
