#!/bin/bash
# Zet de Frigate-instellingen voor de voordeurcamera klaar: altijd opnemen in lage kwaliteit, 2 dagen bewaren.
# Draai dit in de Terminal van Home Assistant, NA het installeren (en 1x starten) van de app Frigate:
#   curl -fsSL https://raw.githubusercontent.com/keizersmit/claude/claude/blissful-archimedes-2uuo74/home-hub/frigate/installeer-camera.sh -o /tmp/f.sh && bash /tmp/f.sh
set -e
B=/addon_configs; [ -d $B ] || B=/app_configs
D=$(ls -d $B/*_frigate 2>/dev/null | head -1)
[ -n "$D" ] || D=$B/ccab4aaf_frigate
mkdir -p "$D"
echo "Gebruik het camera-account uit de Tapo-app (Geavanceerde instellingen > Camera-account)."
read -r -p "Camera-gebruikersnaam: " CU </dev/tty
read -r -s -p "Camera-wachtwoord (je ziet niets, dat is normaal): " CP </dev/tty; echo
export CU CP D
python3 - <<'PY'
import os, urllib.parse
u = urllib.parse.quote(os.environ['CU'], safe=''); p = urllib.parse.quote(os.environ['CP'], safe='')
cfg = f"""# Frigate - voordeurcamera (Tapo D235). Gemaakt door installeer-camera.sh
mqtt:
  enabled: false

record:
  enabled: true
  continuous:
    days: 2          # alles 2 dagen bewaren, daarna automatisch weg
  motion:
    days: 2
  alerts:
    retain:
      days: 2
  detections:
    retain:
      days: 2
# Iets bewaren? Maak in Frigate een export van dat stuk: exports worden nooit automatisch verwijderd.

cameras:
  voordeur:
    ffmpeg:
      inputs:
        - path: rtsp://{u}:{p}@192.168.178.217:554/stream2   # lage kwaliteit (substream)
          roles:
            - detect
            - record
    detect:
      enabled: false   # geen objectherkenning: scheelt rekenkracht
"""
path = os.path.join(os.environ['D'], 'config.yml')
open(path, 'w').write(cfg)
os.chmod(path, 0o600)
print('OK ' + path)
PY
echo "Klaar. Herstart nu de app Frigate (Instellingen > Apps > Frigate > Opnieuw starten)."
