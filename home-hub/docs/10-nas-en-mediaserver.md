# De WD-schijf als gedeelde map (NAS) en mediaserver

De WD-schijf (1 TB, NTFS) komt aan de **laptop met Home Assistant**. Je bestaande bestanden blijven staan: er wordt **niet geformatteerd**.

| Onderdeel | Wat het doet | App in Home Assistant |
|---|---|---|
| **Gedeelde map** | Bestanden en foto's opslaan en openen vanaf de Mac en de iPhones | **Samba NAS2** (dianlight) |
| **Mediaserver** | Films en series kijken op tv, iPad en telefoon | **Jellyfin NAS** (alexbelgium) |

Belangrijk: alleen **Samba NAS2** koppelt de schijf aan. Jellyfin leest de films via de gedeelde map. Zo is de schijf maar één keer aangekoppeld; twee programma's die tegelijk direct op een NTFS-schijf schrijven, kunnen hem beschadigen.

> Tip vooraf: staan er bestanden op die je echt niet kwijt wilt, zet daar dan eerst ook een kopie van op je Mac. Dat is altijd verstandig.

---

## 1. Schijf aansluiten
Steek de WD-schijf in een USB-poort van de laptop in de meterkast.

## 2. Samba NAS2 installeren (gedeelde map)
1. Ga naar **Instellingen → Apps → App-winkel → ⋮ (rechtsboven) → Repositories**, voeg `https://github.com/dianlight/hassio-addons` toe en klik op **Toevoegen**.
2. Ververs de pagina. Zoek **Samba NAS2** en klik op **Installeren**.
3. Zet **Toon in zijbalk** aan en **Beveiligingsmodus (Protection mode)** uit. Klik daarna op **Starten**.
   Staat de gewone app **Samba share** nog geïnstalleerd? Zet die dan eerst uit; ze gebruiken allebei dezelfde poort.
4. Klik in de zijbalk op **Samba NAS 2**. De wizard vraagt om een naam, een werkgroep (laat `WORKGROUP` staan) en een **beheerwachtwoord**.
5. Ga naar **Volumes**. Daar staat de WD-schijf. Klik op **Mount** (aankoppelen) en daarna op **Share** (delen).
6. Ga naar **Users** en maak een gebruiker aan, bijvoorbeeld `thuis`, met een wachtwoord. Geef die gebruiker toegang tot de share van de WD-schijf.

**Openen op de Mac:** kies in Finder **Ga → Verbind met server** (⌘K), typ `smb://192.168.178.250` en log in met `thuis`.
**Openen op de iPhone:** open de app **Bestanden → ⋯ → Verbind met server** en typ `smb://192.168.178.250`.

## 3. Jellyfin installeren (mediaserver)
1. Ga naar **Instellingen → Apps → App-winkel → ⋮ → Repositories** en voeg `https://github.com/alexbelgium/hassio-addons` toe.
2. Zoek **Jellyfin NAS** en klik op **Installeren**.
3. Vul bij **Configuratie** in:
   - `networkdisks`: `//192.168.178.250/<naam van de share>`. Die naam zie je in Samba NAS2 onder **Shares**.
   - `cifsusername`: `thuis`
   - `cifspassword`: het wachtwoord van `thuis`
4. Klik op **Opslaan** en daarna op **Starten**.
5. Ga naar `http://192.168.178.250:8096`. Maak een Jellyfin-account aan en voeg een **bibliotheek** toe: kies **Films** of **Series** en blader naar de map op de schijf (onder `/mnt/...`).

**Kijken:**
- **Tv:** de **Jellyfin**-app, voor LG, Samsung, Android TV en Fire TV.
- **iPhone en iPad:** de app **Jellyfin** of **Swiftfin**.
- **Mac:** gewoon de browser.
- **Buitenshuis:** werkt via Tailscale op `http://100.75.26.42:8096`.

---

## Problemen
- **De schijf staat niet bij Volumes.** Probeer een andere USB-poort en controleer of de schijf aan staat. Herstart daarna Samba NAS2.
- **Mount lukt niet.** Controleer of **Beveiligingsmodus** uit staat. Was de schijf het laatst aan een Windows-pc en niet netjes "uitgeworpen"? Dan kan Linux hem weigeren. Sluit hem dan één keer aan op een Windows-pc, open hem en werp hem netjes uit.
- **Jellyfin ziet geen films.** Controleer of de share-naam, de gebruiker en het wachtwoord bij `networkdisks` precies kloppen. Kijk daarna in het **Logboek** van Jellyfin NAS.
