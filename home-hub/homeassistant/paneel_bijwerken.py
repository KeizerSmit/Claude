# Haalt de nieuwste versie van het wandpaneel op (zelfde bestanden als de Terminal-commando's).
# Wordt gestart door de knop "Paneel bijwerken" (shell_command.paneel_bijwerken).
import os, time, urllib.request
B = "https://raw.githubusercontent.com/keizersmit/claude/claude/blissful-archimedes-2uuo74/home-hub/dashboard/"
D = "/config/www/thuis"
FILES = ["index.html", "style.css", "app.js", "house.png", "house-night.png", "icon-180.png", "icon-152.png"]
ok = 0
for f in FILES:
    try:
        data = urllib.request.urlopen(B + f + "?" + str(int(time.time())), timeout=30).read()
        if len(data) < 100:
            continue
        tmp = os.path.join(D, f + ".new")
        with open(tmp, "wb") as fh:
            fh.write(data)
        os.replace(tmp, os.path.join(D, f))
        ok += 1
    except Exception as e:
        print("FOUT", f, e)
print("OK", ok, "bestanden")
