#!/bin/bash
# Zet nieuwe films in de Films-map netjes neer voor Jellyfin:  Titel (jaar)/Titel (jaar).mkv
# - herkent titel en jaar uit rommelige namen (Interstellar.2014.1080p.BluRay.x264-[YTS.MX] -> Interstellar (2014))
# - ondertitels gaan mee (.nl.srt / .en.srt), torrent-rommel en lege/kapotte bestanden gaan naar _Opruimen
# - films die al goed staan worden overgeslagen; er wordt niets weggegooid
# - je ziet eerst wat er gaat gebeuren en moet het bevestigen; terugzetten kan met films-terugzetten.sh op je bureaublad
# Draai dit in Terminal op de Mac (met de gedeelde map open in Finder):
#   curl -fsSL https://raw.githubusercontent.com/keizersmit/claude/claude/blissful-archimedes-2uuo74/home-hub/tools/films-netjes.sh -o /tmp/fn.sh && bash /tmp/fn.sh
F="${FILMS_DIR:-}"
if [ -z "$F" ]; then for c in /Volumes/SERVER/Films /Volumes/server/Films; do [ -d "$c" ] && F="$c" && break; done; fi
if [ -z "$F" ]; then
  read -r -p "Sleep de map met films hierin en druk op Enter: " F </dev/tty
  F="${F//\\/}"; F="${F%"${F##*[! ]}"}"
fi
F="${F%/}"
[ -d "$F" ] || { echo "Map niet gevonden: $F"; echo "Is de gedeelde map open in Finder?"; exit 1; }
O="$(dirname "$F")/_Opruimen"
DESK="${DESK:-$HOME/Desktop}"
U="$DESK/films-terugzetten.sh"
P=$(mktemp -t filmsplan.XXXXXX)
VIDRE='\.(mkv|mp4|m4v|avi|ts|m2ts)$'
JUNKRE='(\.parts$|/~utorrentpartfile[^/]*$|\.!qb$|\.!ut$|\.exe$|\.url$|/rarbg[^/]*\.txt$|/[^/]*(torrent|downloaded from)[^/]*\.txt$|/[^/]*(yts|yify)[^/]*\.(jpg|png|txt)$)'

# titel en jaar uit een naam halen. Uitvoer: "Titel|jaar|resolutie|editie" of niets
# $2 = 1: nummer vooraan weghalen ("01 Shrek - Animation (2001)" uit een genummerde collectie)
parse() {
  printf '%s\n' "$1" | awk -v num="${2:-0}" '
  function fin(title, y, res,   lt, ed, k, a, i) {
    ed = ""; gsub(/ +/, " ", title)
    lt = tolower(title)
    if (match(lt, / - (action|animation|animated|comedy|drama|sci-fi|scifi|horror|thriller|family|adventure|fantasy|crime|romance|documentary|musical|war|western|mystery|kids)$/)) title = substr(title, 1, RSTART - 1)
    lt = tolower(title)
    if (match(lt, /(the )?(super duper cut|rogue cut|director.?s cut|extended (cut|edition)|theatrical (cut|edition)|ultimate (cut|edition)|final cut|special edition|unrated (cut|edition)|remastered)/) || match(lt, / (extended|unrated|imax)$/)) {
      ed = substr(title, RSTART, RLENGTH); sub(/^ +/, "", ed); sub(/^[Tt]he /, "", ed)
      title = substr(title, 1, RSTART - 1) " " substr(title, RSTART + RLENGTH)
    }
    gsub(/ +/, " ", title); sub(/^[ -]+/, "", title); sub(/[ -]+$/, "", title)
    lt = tolower(title)
    if (title == "" || lt ~ /collection|trilogy|quadrilogy|box ?set|complete [0-9]|[0-9]+ (movie|film)s?( |$)/) return 0
    if (title == lt) { k = split(title, a, " "); title = ""; for (i = 1; i <= k; i++) title = title (i > 1 ? " " : "") toupper(substr(a[i], 1, 1)) substr(a[i], 2) }
    if (ed == tolower(ed)) ed = toupper(substr(ed, 1, 1)) substr(ed, 2)
    print title "|" y "|" res "|" ed; return 1
  }
  BEGIN { q = "^(480p|576p|720p|1080p|2160p|4k|uhd|hdr|hdr10|dv|bluray|blu-ray|brrip|bdrip|bdremux|remux|web|webrip|web-dl|webdl|hdtv|dvdrip|hdrip|hdts|ts|cam|x264|x265|h264|h265|hevc|avc|extended|repack|proper|criterion|unrated|imax|dubbed|multi|nl|dutch|subs)$" }
  {
    s = $0; gsub(/\[/, " ", s); gsub(/\]/, " ", s); gsub(/[()._]/, " ", s)
    n = split(s, t, / +/); m = 0; st = 1
    for (i = 1; i <= n; i++) if (t[i] != "") w[++m] = t[i]
    if (num == 1 && m >= 2 && w[1] ~ /^[0-9][0-9]$/) { for (i = 1; i < m; i++) w[i] = w[i + 1]; m-- }
    qi = m + 1; res = ""
    for (i = 1; i <= m; i++) { l = tolower(w[i]); if (res == "" && l ~ /^(480|576|720|1080|2160)p$/) res = l; if (l == "4k" && res == "") res = "2160p" }
    for (i = 2; i <= m; i++) if (tolower(w[i]) ~ q) { qi = i; break }
    # "1992 - Aladdin": jaartal vooraan
    if (m >= 3 && w[1] ~ /^(19[2-9][0-9]|20[0-3][0-9])$/ && w[2] == "-") {
      title = ""; for (i = 3; i < qi; i++) title = title (i > 3 ? " " : "") w[i]
      fin(title, w[1], res); exit
    }
    y = ""; yi = 0
    for (i = 2; i < qi; i++) if (w[i] ~ /^(19[2-9][0-9]|20[0-3][0-9])$/) { y = w[i] }
    if (y != "") { for (i = 2; i < qi; i++) if (w[i] == y) { yi = i; break } }
    else { for (i = 2; i <= m; i++) if (w[i] ~ /^(19[2-9][0-9]|20[0-3][0-9])$/) { y = w[i]; yi = i; break } }  # bv. "The Wolverine Extended - Action 2013"
    if (y == "") exit
    title = ""; e = yi - 1
    while (e >= 1 && (w[e] == "-" || w[e] == "–")) e--
    for (i = 1; i <= e; i++) title = title (i > 1 ? " " : "") w[i]
    fin(title, y, res)
  }'
}
lang_of() { # taal van een ondertitel: eerst uit de naam, anders uit de tekst
  local n l nl en
  n=$(printf '%s' "$(basename "$1")" | tr 'A-Z' 'a-z')
  case "$n" in *[.\ _-]nl.srt|*[.\ _-]nld.srt|*[.\ _-]dut.srt|*dutch*|*nederlands*) echo nl; return ;; esac
  case "$n" in *[.\ _-]en.srt|*[.\ _-]eng.srt|*english*) echo en; return ;; esac
  nl=$(LC_ALL=C grep -o -i -w -E 'het|een|niet|wat|ik|je|maar|jij|hij|zijn' "$1" 2>/dev/null | wc -l)
  en=$(LC_ALL=C grep -o -i -w -E 'the|you|what|and|is|not|this|that|he|are' "$1" 2>/dev/null | wc -l)
  if [ "$nl" -gt 50 ] && [ "$nl" -gt "$en" ]; then echo nl; elif [ "$en" -gt 50 ] && [ "$en" -gt "$nl" ]; then echo en; fi
}
mv1() { # verplaats $1 naar $2 (nooit overschrijven) en onthoud hoe het terug kan
  local s="$1" d="$2" i=2
  if [ -e "$d" ]; then while [ -e "${d%.*}.$i.${d##*.}" ]; do i=$((i + 1)); done; d="${d%.*}.$i.${d##*.}"; fi
  mkdir -p "$(dirname "$d")" && mv -n "$s" "$d" && printf 'mkdir -p %q && mv -n %q %q\n' "$(dirname "$s")" "$d" "$s" >> "$U"
}
size_of() { wc -c < "$1" | tr -d ' '; }

# 1. plan maken
echo "Bezig met zoeken in $F ... (thuis een paar seconden, via VPN soms een paar minuten)"
NEW=0; SKIP=0; BAD=0; DUP=0; UNK=""; SHOW=""
find "$F" -type f ! -name '._*' 2>/dev/null | grep -Ei "$VIDRE" | sort > "$P.v"
# mappen met een genummerde collectie (minstens 3 films die met "01 ", "02 " ... beginnen)
grep -E '/[0-9]{2}[ ._-][^/]*$' "$P.v" | sed 's#/[^/]*$##' | sort | uniq -c | awk '$1 >= 3 { sub(/^ *[0-9]+ /, ""); print }' > "$P.n"
: > "$P.t"
while IFS= read -r v; do
  rel="${v#$F/}"; d=$(dirname "$rel"); b=$(basename "$v"); x=$(printf '%s' "${b##*.}" | tr 'A-Z' 'a-z'); base="${b%.*}"
  case "$rel" in */*/*) ;; */*) # staat al goed?
    if printf '%s' "$d" | grep -Eq '^.+ \([0-9]{4}\)( \[(tmdbid|imdbid)-[a-z0-9]+\])?$'; then
      case "$base" in "$d"|"$d - "*) SKIP=$((SKIP + 1)); continue ;; esac
    fi ;; esac
  sz=$(size_of "$v")
  if [ "$sz" -eq 0 ]; then echo "K|$rel||" >> "$P"; BAD=$((BAD + 1)); continue; fi
  if printf '%s' "$base" | grep -Eiq '(^|[^a-z])sample([^a-z]|$)' && [ "$sz" -lt 400000000 ]; then echo "J|$rel||" >> "$P"; continue; fi
  nm=0; grep -Fxq "$(dirname "$v")" "$P.n" && nm=1
  r=$(parse "$base" $nm); [ -n "$r" ] || r=$(parse "$(basename "$d")"); [ -n "$r" ] || r=$(parse "$(basename "$(dirname "$d")")")
  if [ -z "$r" ]; then UNK="$UNK\n  - $rel"; continue; fi
  IFS='|' read -r t y res ed <<< "$r"
  T="$t ($y)"; lab=""
  if { [ -d "$F/$T" ] && find "$F/$T" -maxdepth 1 -type f ! -name '._*' 2>/dev/null | grep -Eiq "$VIDRE"; } || grep -Fxq "$T" "$P.t"; then  # film staat er al
    if [ -n "$ed" ]; then lab="$ed"; elif [ "$res" = "2160p" ]; then lab="2160p"
    else echo "D|$rel||" >> "$P"; DUP=$((DUP + 1)); SHOW="$SHOW\n  $T  (staat er al -> _Opruimen/Dubbel)"; continue; fi
  fi
  echo "$T" >> "$P.t"
  echo "V|$rel|$T|$lab" >> "$P"; NEW=$((NEW + 1)); SHOW="$SHOW\n  $T${lab:+  (extra versie: $lab)}"
done < "$P.v"
rm -f "$P.v" "$P.n" "$P.t"

# losse torrent-rommel, waar die ook staat
JNK=0
while IFS= read -r j; do echo "G|${j#$F/}||" >> "$P"; JNK=$((JNK + 1)); done < <(find "$F" -type f 2>/dev/null | grep -Ei "$JUNKRE")

leeg() { # _Opruimen definitief leegmaken (alleen na een duidelijk ja)
  [ -d "$O" ] || return 0
  local L sz; sz=$(du -sh "$O" 2>/dev/null | cut -f1)
  echo
  read -r -p "Map _Opruimen ($sz: dubbel, kapot en rommel) definitief weggooien? Dit kan niet terug. (j/n) " L </dev/tty
  if [ "$L" = "j" ] || [ "$L" = "J" ]; then
    chflags -R nouchg "$O" 2>/dev/null; rm -rf "$O" 2>/dev/null
    if [ -d "$O" ]; then echo "Niet alles kon weg (geen rechten). Vraag Claude om hulp; je films zijn niet aangeraakt."; else echo "_Opruimen is weggegooid."; fi
  else echo "_Opruimen blijft staan."; fi
}

echo "Films-map: $F"
echo "Al goed: $SKIP films (blijven staan)"
if [ "$NEW" -eq 0 ] && [ "$BAD" -eq 0 ] && [ "$JNK" -eq 0 ] && [ "$DUP" -eq 0 ]; then
  echo "Niets nieuws te doen."; [ -n "$UNK" ] && printf "Niet herkend (zet zelf het jaartal in de naam):%b\n" "$UNK"; rm -f "$P"; leeg; exit 0
fi
printf "Wordt netjes gezet (%s):%b\n" "$NEW" "$SHOW"
[ "$JNK" -gt 0 ] && echo "Torrent-rommel (naar _Opruimen/Rommel): $JNK bestanden"
[ "$BAD" -gt 0 ] && echo "Kapot (0 bytes, naar _Opruimen/Kapot): $BAD"
[ "$DUP" -gt 0 ] && echo "Dubbel (staat er al, naar _Opruimen/Dubbel): $DUP"
[ -n "$UNK" ] && printf "Niet herkend, blijft staan (zet zelf het jaartal in de naam):%b\n" "$UNK"
read -r -p "Doorgaan? (j/n) " OK </dev/tty
[ "$OK" = "j" ] || [ "$OK" = "J" ] || { echo "Niets gedaan."; rm -f "$P"; exit 0; }
[ -f "$U" ] || { echo '#!/bin/bash'; echo '# Zet films terug zoals ze stonden'; } > "$U"

# 2. uitvoeren
n_v=0; n_s=0; n_j=0; DIRS=""
while IFS='|' read -r a rel T res; do
  s="$F/$rel"; [ -e "$s" ] || continue
  sd=$(dirname "$s"); b=$(basename "$s"); x=$(printf '%s' "${b##*.}" | tr 'A-Z' 'a-z'); base="${b%.*}"
  case "$a" in
    K) mv1 "$s" "$O/Kapot/$rel"; DIRS="$DIRS$sd\n"; continue ;;
    J) mv1 "$s" "$O/Rommel/$rel"; DIRS="$DIRS$sd\n"; continue ;;
    G) mv1 "$s" "$O/Rommel/$rel"; continue ;;  # losse rommel: map verder ongemoeid laten
    D) mv1 "$s" "$O/Dubbel/$rel"; DIRS="$DIRS$sd\n"; continue ;;
  esac
  lab="$res"; DB="$T${lab:+ - $lab}"; dst="$F/$T/$DB.$x"
  if [ -e "$dst" ]; then mv1 "$s" "$O/Dubbel/$rel"; echo "  dubbel: $T -> _Opruimen/Dubbel"; DIRS="$DIRS$sd\n"; continue; fi
  # ondertitels: in dezelfde map (en een submap Subs); bij meerdere films in een map alleen die met dezelfde naam
  nvid=$(find "$sd" -maxdepth 1 -type f ! -name '._*' | grep -Eic "$VIDRE"); depth=2
  if [ "$sd" = "$F" ]; then nvid=2; depth=1; fi
  mv1 "$s" "$dst"; n_v=$((n_v + 1))
  while IFS= read -r sub; do
    [ -n "$sub" ] || continue
    sb=$(basename "$sub")
    if [ "$nvid" -gt 1 ]; then case "$sb" in "$base"*) ;; *) continue ;; esac; fi
    if [ "$(size_of "$sub")" -lt 1000 ]; then mv1 "$sub" "$O/Rommel/${sub#$F/}"; continue; fi
    l=$(lang_of "$sub")
    mv1 "$sub" "$F/$T/$DB${l:+.$l}.srt"; n_s=$((n_s + 1))
  done < <(find "$sd" -maxdepth "$depth" -type f -iname '*.srt' ! -name '._*' 2>/dev/null | grep -Fv "$F/$T/" | sort)
  [ "$sd" != "$F" ] && DIRS="$DIRS$sd\n"
done < "$P"

# overgebleven rommel uit de oude mappen (geen films) naar _Opruimen/Rommel
printf '%b' "$DIRS" | sort -u | while IFS= read -r sd; do
  [ -n "$sd" ] && [ -d "$sd" ] && [ "$sd" != "$F" ] || continue
  # een nette filmmap ("Titel (jaar)") nooit leeghalen: daar staan ondertitels en posters
  if [ "$(dirname "$sd")" = "$F" ] && basename "$sd" | grep -Eq '^.+ \([0-9]{4}\)( \[(tmdbid|imdbid)-[a-z0-9]+\])?$'; then continue; fi
  dp=2; [ -z "$(find "$sd" -type f ! -name '._*' 2>/dev/null | grep -Ei "$VIDRE" | head -1)" ] && dp=99  # geen films meer: alles eruit
  find "$sd" -maxdepth $dp -type f ! -name '.DS_Store' 2>/dev/null | grep -Eiv "$VIDRE" | while IFS= read -r j; do mv1 "$j" "$O/Rommel/${j#$F/}"; done
  # ook bovenliggende verzamelmappen (bijv. "Disney Movie Collection") als daar geen films meer in zitten
  p=$(dirname "$sd")
  while [ "$p" != "$F" ] && [ "${p#$F/}" != "$p" ]; do
    [ -n "$(find "$p" -type f ! -name '._*' 2>/dev/null | grep -Ei "$VIDRE" | head -1)" ] && break
    find "$p" -type f ! -name '.DS_Store' 2>/dev/null | while IFS= read -r j; do mv1 "$j" "$O/Rommel/${j#$F/}"; done
    p=$(dirname "$p")
  done
done
find "$F" -name .DS_Store -delete 2>/dev/null; find "$F" -name '._*' -delete 2>/dev/null
find "$F" -mindepth 1 -depth -type d -empty -delete 2>/dev/null
chmod +x "$U"; rm -f "$P"
echo
echo "Klaar: $n_v films netjes gezet, $n_s ondertitels meegenomen."
echo "Laat Jellyfin nu de bibliotheek scannen (Dashboard > Bibliotheken > Films > Bibliotheek scannen)."
echo "Rommel staat in _Opruimen (naast Films). Alles goed? Dan mag die map weg. Terugzetten: bash ~/Desktop/films-terugzetten.sh"
leeg
