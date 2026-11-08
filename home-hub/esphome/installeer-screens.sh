#!/bin/bash
# Zet de screens-software klaar in Home Assistant (ESPHome). Draai dit in de Terminal van Home Assistant:
#   curl -fsSL https://raw.githubusercontent.com/keizersmit/claude/claude/blissful-archimedes-2uuo74/home-hub/esphome/installeer-screens.sh -o /tmp/s.sh && bash /tmp/s.sh
set -e
C=/config; [ -f $C/configuration.yaml ] || C=/homeassistant
E=$C/esphome; mkdir -p "$E"; cd "$E"
B=https://raw.githubusercontent.com/keizersmit/claude/claude/blissful-archimedes-2uuo74/home-hub/esphome
U=https://raw.githubusercontent.com/danielpetrovic/somfy-io-bridge/main
curl -fsSL "$B/thuis-screens.yaml?$(date +%s)" -o thuis-screens.yaml && echo "OK thuis-screens.yaml"
curl -fsSL "$U/somfy-io-cover.yaml" -o somfy-io-cover.yaml && echo "OK somfy-io-cover.yaml"
touch secrets.yaml
if ! grep -q '^wifi_ssid:' secrets.yaml; then
  echo "De screens-ontvanger moet op je wifi. Je typt dit alleen hier; het blijft in Home Assistant."
  read -r -p "Naam van je wifi-netwerk: " WS </dev/tty
  read -r -s -p "Wifi-wachtwoord (je ziet niets, dat is normaal): " WP </dev/tty; echo
fi
hex() { head -c "$1" /dev/urandom | od -An -tx1 | tr -d ' \n'; }
q() { local v="$1"; printf "'%s'" "${v//\'/\'\'}"; }
N=0
put() { if ! grep -q "^$1:" secrets.yaml; then [ -s secrets.yaml ] && [ -n "$(tail -c1 secrets.yaml)" ] && echo >> secrets.yaml; echo "$1: $(q "$2")" >> secrets.yaml; N=$((N + 1)); fi; }
if [ -n "${WS+x}" ]; then put wifi_ssid "$WS"; put wifi_password "$WP"; fi
put io_bridge_api_key "$(head -c 32 /dev/urandom | base64 | tr -d '\n')"
put io_bridge_2w_controller_address "$(hex 3)"
put io_bridge_2w_system_key "$(hex 16)"
for c in screen_slaapkamer_1 screen_slaapkamer_3 screen_slaapkamer_4; do put "io_${c}_node" "$(hex 3)"; put "io_${c}_key" "$(hex 16)"; done
echo "OK secrets.yaml ($N nieuwe regels)"
echo "Klaar. Open nu de app ESPHome in Home Assistant: daar staat 'Somfy screens'."
