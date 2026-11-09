#!/bin/bash
# Maakt een lijst van alle bestanden in je Films-map (alleen lezen, er verandert niets).
# Draai dit in Terminal op de Mac:
#   curl -fsSL https://raw.githubusercontent.com/keizersmit/claude/claude/blissful-archimedes-2uuo74/home-hub/tools/films-lijst.sh -o /tmp/fl.sh && bash /tmp/fl.sh
# Het resultaat komt op je bureaublad: films-lijst.txt
echo "Open in Finder de gedeelde map (server) en sleep de map met films hier in dit venster."
read -r -p "Sleep de map hierin en druk op Enter: " F </dev/tty
F="${F//\\/}"                       # Finder zet \ voor spaties en haakjes
F="${F%"${F##*[! ]}"}"               # spaties aan het eind weg
F="${F%/}"
[ -d "$F" ] || { echo "Map niet gevonden: $F"; exit 1; }
O="$HOME/Desktop/films-lijst.txt"
cd "$F" || exit 1
{
  echo "# map: $F"
  echo "# gemaakt: $(date)"
  find . -type f ! -name '.DS_Store' ! -name '._*' -print0 | xargs -0 stat -f '%z	%N' | sort -t '	' -k2
} > "$O"
echo "Klaar: $(grep -vc '^#' "$O") bestanden. Het lijstje staat op je bureaublad: films-lijst.txt"
echo "Sleep dat bestand in de chat."
