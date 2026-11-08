# Alle nieuwe koppelingen in één keer

Een checklist voor als je alles tegelijk wilt doen. Doe de stappen van boven naar beneden.

## 1. Paneel bijwerken + thermostaatschema (Terminal, 1 commando)
Het commando staat in [07-thermostaatschema.md](07-thermostaatschema.md), stap 1. Hiermee krijgt het paneel ook de knop **Voordeur**. Zet daarna het schema op de Honeywell zelf uit: **Menu → Schema → Uit**.

## 2. Deurbel (Tapo D235, IP 192.168.178.217)
In de **Tapo-app**, bij de deurbel:
1. Zet **Altijd aan-modus** aan. Dat kan alleen als de deurbel vast op stroom zit.
2. Ga naar **Instellingen → Geavanceerde instellingen → Camera-account** en maak een gebruikersnaam en wachtwoord aan.

In **Home Assistant**:
3. Ga naar **Instellingen → Apparaten & diensten → + Integratie toevoegen** en kies **ONVIF**.
   - Staat de deurbel in de lijst, kies hem dan. Anders kies je handmatig en vul je in: host `192.168.178.217`, poort `2020`.
   - Vul de gebruikersnaam en het wachtwoord van het camera-account in.
4. Klaar. Het paneel vindt de camera vanzelf, en er verschijnt een knop **Voordeur** naast "Thuis". Op de telefoon heet die knop **Voordeur bekijken**.
   Zie je de knop niet? Hernoem dan de camera-entiteit in Home Assistant naar `camera.voordeur`.

Het beeld springt **niet** vanzelf aan; je kijkt alleen als je op de knop tikt. Na 2 minuten sluit het vanzelf.

## 3. Somfy-screens (als de LilyGO binnen is)
Zie [06-screens-en-ventilatie.md](06-screens-en-ventilatie.md). Claude maakt de ESPHome-configuratie klaar.

## 4. Orcon-ventilatie (als de onderdelen binnen zijn)
Het kastje in de keuken is een **Orcon CO2-bedieningssensor 15RF**. Die werkt op 230 V en stuurt de box **draadloos** aan. De box kan dus via de radio-route (RAMSES II, 868 MHz) bediend worden. Zie [06-screens-en-ventilatie.md](06-screens-en-ventilatie.md).
