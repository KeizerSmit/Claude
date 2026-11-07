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

## Deel B: op elke telefoon (± 5 min per telefoon)

1. Installeer **Tailscale** en log in. Julius gebruikt zijn eigen account; je moeder accepteert de uitnodiging uit de mail. Zet de schakelaar op **Verbonden** en geef toestemming voor de VPN.
2. Installeer de **Home Assistant**-app en open hem.
   - **Thuis** vindt hij Home Assistant meestal vanzelf. Anders vul je in: `http://192.168.178.250`.
   - Log in met je eigen gebruikersnaam en wachtwoord (je moeder met haar account uit A2).
3. In de app: **Instellingen → Companion-app → (server) → Thuisnetwerk**: voeg het wifinetwerk **BJS** toe. Thuis gebruikt de app dan het thuisadres, onderweg het Tailscale-adres.
4. Laat de app **meldingen** sturen. Dat is handig voor latere automatiseringen, zoals "raam open" of "wasmachine klaar".

**Onderweg testen:** zet de wifi op je telefoon uit (4G/5G), zorg dat Tailscale op *Verbonden* staat en open de Home Assistant-app.

---

## Goed om te weten
- Tailscale moet op de telefoon **aan** staan voor bediening van buitenaf. Thuis op wifi is het niet nodig.
- Het wandpaneel op de iPad heeft hier niets mee te maken. Dat blijft gewoon werken.
- Iemand de toegang afnemen kan op twee manieren: in Tailscale de gebruiker verwijderen, of in Home Assistant de persoon uitzetten.
