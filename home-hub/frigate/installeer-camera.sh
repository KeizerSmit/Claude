#!/bin/bash
# Zet de Frigate-instellingen voor de voordeurcamera klaar: altijd opnemen in lage kwaliteit, 2 dagen bewaren.
# Draai dit in de Terminal van Home Assistant, NA het installeren van de app Frigate:
#   curl -fsSL https://raw.githubusercontent.com/keizersmit/claude/claude/blissful-archimedes-2uuo74/home-hub/frigate/installeer-camera.sh -o /tmp/f.sh && bash /tmp/f.sh
# Zelf gebruikersnaam/wachtwoord invullen: ... && bash /tmp/f.sh vraag
# Het camera-account wordt overgenomen uit de deurbel-koppeling (ONVIF) in Home Assistant; lukt dat niet, dan vraagt het script erom.
set -e
CAM=192.168.178.217
B=/addon_configs; [ -d $B ] || B=/app_configs
D=$(ls -d $B/*_frigate 2>/dev/null | head -1)
[ -n "$D" ] || D=$B/ccab4aaf_frigate
mkdir -p "$D"
C=/config; [ -f $C/configuration.yaml ] || C=/homeassistant
E=$C/.storage/core.config_entries
CU=""; CP=""
# 'bash f.sh vraag' = altijd zelf invullen (bijv. na een nieuw wachtwoord in de Tapo-app)
if [ "$1" != "vraag" ] && [ -f "$E" ] && command -v jq >/dev/null 2>&1; then
  Q='[.data.entries[] | select(.domain=="onvif")] | (map(select(.data.host=="'$CAM'")) + .)[0].data'
  CU=$(jq -r "$Q.username // empty" "$E" 2>/dev/null || true)
  CP=$(jq -r "$Q.password // empty" "$E" 2>/dev/null || true)
fi
if [ -n "$CU" ] && [ -n "$CP" ]; then
  echo "Camera-account gevonden in de deurbel-koppeling (gebruiker: $CU)."
else
  echo "Gebruik het camera-account uit de Tapo-app (Geavanceerde instellingen > Camera-account)."
  read -r -p "Camera-gebruikersnaam: " CU </dev/tty
  read -r -s -p "Camera-wachtwoord (je ziet niets, dat is normaal): " CP </dev/tty; echo
fi
urlenc() { local LC_ALL=C s="$1" o="" c i; for ((i = 0; i < ${#s}; i++)); do c=${s:i:1}; case "$c" in [a-zA-Z0-9.~_-]) o+="$c" ;; *) o+=$(printf '%%%02X' "'$c") ;; esac; done; printf '%s' "$o"; }
U=$(urlenc "$CU"); P=$(urlenc "$CP")
cat > "$D/config.yml" <<EOF
# Frigate - voordeurcamera (Tapo D235). Gemaakt door installeer-camera.sh
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
        - path: rtsp://$U:$P@$CAM:554/stream2   # lage kwaliteit (substream)
          roles:
            - detect
            - record
    detect:
      enabled: false   # geen objectherkenning: scheelt rekenkracht
EOF
chmod 600 "$D/config.yml"
echo "OK $D/config.yml"
echo "Klaar. Herstart nu de app Frigate (Instellingen > Apps > Frigate > Opnieuw starten)."
