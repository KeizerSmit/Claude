# Telefoon (jij en je moeder) en bediening op afstand

Doel: op beide telefoons alles kunnen zien en instellen, thuis én onderweg. Kosten: **€0**.

| Onderdeel | Wat het doet |
|---|---|
| **Home Assistant-app** (gratis, App Store / Play Store) | De bediening op de telefoon |
| **Tailscale** (gratis voor thuisgebruik) | Een veilige "tunnel" naar huis. Er staat geen poort open naar internet. |
| **Dashboard "Thuis"** ([`../homeassistant/dashboard-telefoon.yaml`](../homeassistant/dashboard-telefoon.yaml)) | Een overzichtelijk scherm met thermostaat, aircos, energie en weer |

---

## Deel A: eenmalig door Julius (op de Mac, ± 15 min)

**A1. Tailscale in Home Assistant**
1. Ga naar `http://192.168.178.250` → **Instellingen → Apps → App-winkel**, zoek **Tailscale** en klik op **Installeren**.
2. Klik op **Starten** en daarna op **Open web UI**. Log in, bijvoorbeeld met je Apple- of Google-account. Daarmee maak je je eigen Tailscale-netwerk aan.
3. Ga naar **login.tailscale.com → Machines**. Daar staat nu **homeassistant**, met een adres dat begint met **100.** (bijv. `100.101.102.103`). **Noteer dat adres.**

**A2. Een account voor je moeder in Home Assistant**
**Instellingen → Personen → Persoon toevoegen**: naam Muriel, zet **"Mag inloggen"** aan, en kies een gebruikersnaam en wachtwoord. Beheerder hoeft niet: dan kan ze alles bedienen, maar niets kapotmaken.

**A3. Je moeder uitnodigen voor Tailscale**
Ga op **login.tailscale.com → Users → Invite users** en vul haar e-mailadres in. Ze krijgt een uitnodiging per mail.

**A4. Het dashboard "Thuis" maken**
1. Ga naar **Instellingen → Dashboards → + Dashboard toevoegen → Nieuw dashboard vanaf nul** en noem het `Thuis`.
2. Open het dashboard, klik op het **potlood** (bewerken), dan **⋮ → Raw configuration editor**.
3. Wis alles en plak de inhoud van [`dashboard-telefoon.yaml`](../homeassistant/dashboard-telefoon.yaml). Klik op **Opslaan**.
4. Ga terug naar **Instellingen → Dashboards**, klik op ⋮ bij *Thuis* en kies **Instellen als standaard**. Dan opent de app meteen op dit scherm.

**A5. Thuis- en internetadres invullen**
Ga naar **Instellingen → Systeem → Netwerk → Home Assistant URL's**:
- **Lokaal netwerk**: `http://192.168.178.250`
- **Internet**: `http://100.x.x.x` (het Tailscale-adres uit A1; werkt dat niet, probeer dan `http://100.x.x.x:8123`)

---

**A6. Het wandpaneel ook in de app (menu-item "Wandpaneel")**
**Instellingen → Dashboards → + Dashboard toevoegen → Webpagina**. Vul bij URL `/local/thuis/index.html` in en bij titel **Wandpaneel**. Op de telefoon staat het dan in het menu (☰). Het paneel schaalt zich automatisch naar het scherm; houd de telefoon **liggend**.

**Tailscale-adres van Home Assistant:** `100.75.26.42`. Je moeder krijgt toegang via **Share** (alleen Home Assistant) en logt in op Tailscale met haar eigen Apple ID.

## Deel B: op elke telefoon (± 5 min per telefoon), zo werkt het nu

Op de telefoon gebruiken we **hetzelfde wandpaneel als op de iPad**, als icoon op het beginscherm. De Home Assistant-app is daarvoor niet nodig.

1. **Tailscale** installeren:
   - Julius logt in met zijn eigen account.
   - Je moeder opent de **share-link** en logt in met haar eigen Apple ID → **Accept**.
2. In Tailscale: **Instellingen → VPN On Demand** aanzetten, zodat Tailscale altijd vanzelf verbindt, ook na een herstart.
3. Open **Safari** en ga naar `http://100.75.26.42/local/thuis/index.html` (werkt dat niet, dan met `:8123` achter het adres). Linksboven moet **"Verbonden"** staan.
4. **Deel → Zet op beginscherm → Voeg toe.** Open het icoon **Thuis** en houd de telefoon **liggend**.

Dit werkt thuis en onderweg, zolang Tailscale verbonden is.

## Goed om te weten
- Tailscale moet op de telefoon **aan** staan voor bediening van buitenaf. Thuis op wifi is het niet nodig.
- Het wandpaneel op de iPad heeft hier niets mee te maken. Dat blijft gewoon werken.
- Iemand de toegang afnemen kan op twee manieren: in Tailscale de gebruiker verwijderen, of in Home Assistant de persoon uitzetten.
