# Pulse

Persoonlijke WHOOP-achtige app voor de **Fitbit Air**: herstel, strain en slaap, met je krachttraining (topsets) meegerekend in je dagbelasting. Draait als web-app op je telefoon (zet hem op je beginscherm) en je logt in met je Google-account.

- **Vandaag**: eigen hoofdscherm met een herstelmeter (0–100%, groen/geel/rood), je belasting ten opzichte van je doel en je slaap ten opzichte van je behoefte; daaronder inzichten, activiteiten en gezondheidstegels.
- **Activiteiten achteraf invullen**: sport, klussen en werk (timmeren, verbouwen, sjouwen, verhuizen…) en huis & tuin, met MET-waarden uit het 2024 Compendium. Belasting komt uit gemeten hartslag, anders uit hoe zwaar het voelde (RPE) en de activiteit; fysiek werk krijgt daarnaast spierbelasting. Werk telt wél voor belasting en herstel, níet als fitheid.
- **Training**: belastingsband (laatste 7 vs 28 dagen: onder normaal / in balans / hoog / te veel), lichaamskaart met spierherstel per spiergroep, schema's (Upper 6 / Upper 7 / Lower) uit je notities, recente activiteiten.
- **Gezondheid**: leefstijl-leeftijd met marge, tempo, grootste hefbomen en per onderdeel hoeveel jaar het scheelt (VO₂max, stappen, matig/zwaar bewegen, krachttraining, slaapregelmaat, slaapduur, rusthartslag), plus gewicht en VO₂max.
- **Herstel, strain en slaap** zoals WHOOP het interpreteert, met je eigen 30-daagse baseline.
- **Live hartslag**: elke minuut ververst; realtime via Bluetooth *Hartslag delen* (Chrome, of Bluefy op iPhone).
- **Ochtendrapport**: bij de eerste keer openen je herstel in één zin uitgelegd, je nacht, wat gisteren deed (jouw patronen) en je plan voor vandaag.
- **Coach**: welk schema past vandaag (herstel + spiervermoeidheid), progressietips per oefening, hoeveel minuten wandelen of zone 2 je nog nodig hebt voor je strain-doel, en 's avonds je verwachte herstel van morgen per bedtijd (geleerd uit je eigen data).
- **Weekdoelen en reeksen**: kracht, beweging, slaap en stappen per week; weekoverzicht met vergelijking en PR's; records.
- **Trends**: maandkalender, slaapschema, persoonlijke normaalbanden, automatische herstelpatronen (zonder dagboek).
- **Slaap**: slaapschuld over 7 nachten met inhaalplan, slaapschema met adviestijden.
- **Kracht**: volume per spiergroep (afgestemd op laag volume tot falen, of meer volume), Upper/Lower-weekdoel, voortgang per oefening, vergelijking met vorige keer, hartslag per training, rusttimer, samenvatting na je training, en notities plakken met automatische verschillen.
- **Ziek- en rustdagen**, draagtijd-controle, herstel als app-badge, kleurenblind-palet, "Deel met Claude"-export.
- **Interactief**: schuif over elke grafiek, tik op alles voor details, veeg tussen dagen, trek omlaag om te verversen; ＋-knop om iets toe te voegen.

Onderbouwing en concurrentieonderzoek: zie [`reports/Onderzoek gezondheidsapps en design.md`](reports/Onderzoek%20gezondheidsapps%20en%20design.md).

De app staat in `docs/` (pure HTML/CSS/JS, geen build-stap). Data blijft op je telefoon en in je eigen Google-account.

## Online zetten (eenmalig, ±2 min)

1. GitHub → deze repo → **Settings → Pages**.
2. *Source*: **Deploy from a branch**, branch `claude/fitbit-whoop-app` (of `main` na mergen), map **`/docs`** → Save.
3. Na een minuut staat de app op `https://keizersmit.github.io/Claude/`.

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
     - Authorized redirect URI: `https://keizersmit.github.io/Claude/`
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
| Spierbelasting | per oefening: sets (uit je notitie, anders 2) × lichaamsbelasting van de oefening × intensiteit (e1RM ÷ beste e1RM) × rep-factor |
| Slaapbehoefte | basis (7,5 u) + tot 40 min door strain van gisteren + slaapschuld − dutjes |

De exacte WHOOP-formules zijn niet openbaar; dit is een eigen benadering die dezelfde signalen op dezelfde manier interpreteert.

## Ontwikkelen

```bash
cd docs && python3 -m http.server 8000   # http://localhost:8000
npm test                                  # parser, API-conversies en scores
```
