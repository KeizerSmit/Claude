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
  export WS WP
fi
python3 - <<'PY'
import os, secrets, base64
p = 'secrets.yaml'
have = open(p).read()
def q(v): return "'" + v.replace("'", "''") + "'"
add = []
def put(k, v):
    if ('\n' + k + ':') not in ('\n' + have): add.append(k + ': ' + q(v))
if os.environ.get('WS') is not None:
    put('wifi_ssid', os.environ['WS']); put('wifi_password', os.environ['WP'])
put('io_bridge_api_key', base64.b64encode(secrets.token_bytes(32)).decode())
put('io_bridge_2w_controller_address', secrets.token_hex(3))
put('io_bridge_2w_system_key', secrets.token_hex(16))
for c in ('screen_slaapkamer_1', 'screen_slaapkamer_3', 'screen_slaapkamer_4'):
    put('io_%s_node' % c, secrets.token_hex(3)); put('io_%s_key' % c, secrets.token_hex(16))
if add:
    with open(p, 'a') as f:
        if have and not have.endswith('\n'): f.write('\n')
        f.write('\n'.join(add) + '\n')
print('OK secrets.yaml (%d nieuwe regels)' % len(add))
PY
echo "Klaar. Open nu de app ESPHome in Home Assistant: daar staat 'Somfy screens'."
