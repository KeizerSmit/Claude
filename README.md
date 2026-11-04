# Pulse

Persoonlijke WHOOP-achtige app voor de **Fitbit Air**: herstel, strain en slaap, met je krachttraining (topsets) meegerekend in je dagbelasting. Draait als web-app op je telefoon (zet hem op je beginscherm) en je logt in met je Google-account.

- **Herstel (0–100%)**: HRV, rusthartslag tijdens slaap, slaapprestatie, ademhaling en huidtemperatuur, vergeleken met je eigen 30-daagse baseline (groen / geel / rood).
- **Strain (0–21)**: hartslagreserve per minuut (TRIMP), logaritmisch, plus de **spierbelasting** uit je krachtlog. Inclusief optimale strain op basis van je herstel.
- **Slaap**: slaapbehoefte (basis + strain + slaapschuld − dutjes), prestatie, fasen, efficiëntie, consistentie en bedtijd-advies.
- **Kracht**: log alleen je topset per oefening, of plak je notities (bijv. `Upper 6 – 3/11` met daaronder `Chest press 80 x 8`). Herkent ~35 machines/oefeningen, toont PR's, geschatte 1RM-progressie en zware sets per spiergroep per week. Wordt bewaard in een verborgen map in je eigen Google Drive.
- **Alle data**: per dag de ruwe meetwaarden, hartslag per minuut, slaapfasen en de tussenstappen van de berekeningen.

De app staat in `docs/` (pure HTML/CSS/JS, geen build-stap). Data blijft op je telefoon en in je eigen Google-account.

## Online zetten (eenmalig, ±2 min)

1. GitHub → deze repo → **Settings → Pages**.
2. *Source*: **Deploy from a branch**, branch `claude/fitbit-whoop-app` (of `main` na mergen), map **`/docs`** → Save.
3. Na een minuut staat de app op `https://keizersmit.github.io/claude/`.

## Google-koppeling (eenmalig, ±5 min)

De Fitbit Web API is op 2 november 2026 uitgezet; Fitbit-data loopt nu via de **Google Health API** met Google-login. Daarvoor heb je een eigen gratis Google Cloud-project nodig:

1. [console.cloud.google.com](https://console.cloud.google.com/projectcreate) → nieuw project, bijv. “Pulse”.
2. *APIs & Services → Library*: zet **Google Health API** en **Google Drive API** aan.
3. *Google Auth Platform*:
   - **Branding**: app-naam + je e-mail.
   - **Audience**: External, status *Testing*, voeg je eigen Google-account toe als **test user**.
   - **Data Access**: scopes `googlehealth.activity_and_fitness.readonly`, `googlehealth.health_metrics_and_measurements.readonly`, `googlehealth.sleep.readonly`, `googlehealth.profile.readonly`, `drive.appdata`.
   - **Clients → Create client** → *Web application*
     - Authorized JavaScript origin: `https://keizersmit.github.io`
     - Authorized redirect URI: `https://keizersmit.github.io/claude/`
4. Open de app → *Koppeling instellen* → plak de **Client ID** → *Inloggen met Google*. Google meldt “app niet geverifieerd”: dat klopt (het is je eigen app), kies *Doorgaan*.

Wil je de Client ID niet in de app invullen, zet hem dan in `docs/config.js`.

**Op je iPhone**: open de link in Safari → deelknop → *Zet op beginscherm*.

Zonder koppeling kun je alles bekijken met **demodata** (knop op het startscherm).

## Hoe de scores werken

Zie in de app *Profiel → Hoe worden scores berekend?*. Kort:

| Score | Berekening |
|---|---|
| Herstel | gewogen z-scores t.o.v. 30-daagse baseline: HRV 50%, rusthartslag 20%, slaapprestatie 20%, ademhaling 5%, huidtemp 5% → normaalverdeling → 1–99% |
| Strain | `21 × (1 − e^(−belasting/110))`; belasting = Banister-TRIMP over wakkere minuten + 3,2 × spierbelasting |
| Spierbelasting | per oefening: sets (standaard 3) × lichaamsbelasting van de oefening × intensiteit (e1RM ÷ beste e1RM) × rep-factor |
| Slaapbehoefte | basis (7,5 u) + tot 40 min door strain van gisteren + slaapschuld − dutjes |

De exacte WHOOP-formules zijn niet openbaar; dit is een eigen benadering die dezelfde signalen op dezelfde manier interpreteert.

## Ontwikkelen

```bash
cd docs && python3 -m http.server 8000   # http://localhost:8000
npm test                                  # parser, API-conversies en scores
```
