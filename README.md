# TP Lektor

[![Downloads](https://img.shields.io/github/downloads/Blacktoastx/tp-lektor/total?label=Downloads)](https://github.com/Blacktoastx/tp-lektor/releases)

InDesign-Plugin (UXP) für KI-gestütztes Korrekturlesen: Rechtschreibung und Grammatik, Typografie nach DIN 5008 und Lektorat. Die Prüfung läuft über die OpenAI-API mit dem eigenen API-Key, der verschlüsselt auf dem jeweiligen Rechner gespeichert wird.

## Installieren

1. **[TP Lektor herunterladen](https://github.com/Blacktoastx/tp-lektor/releases/latest/download/TP-Lektor.ccx)** (immer die neueste Version).
2. Doppelklick auf die Datei. Creative Cloud installiert das Plugin.
3. In InDesign: Fenster → Zusatzmodule → TP Lektor.

Neue Versionen meldet das Plugin selbst. Installiert wird ein Update genauso per Doppelklick auf die neue `.ccx`.

## Neue Version veröffentlichen

1. Version in `manifest.json` erhöhen und `CHANGELOG.md` ergänzen.
2. Committen, Tag setzen und pushen:

   ```bash
   git tag v2.3.0
   git push origin main --tags
   ```

GitHub Actions baut daraus die `.ccx` und legt das Release mit den Änderungen aus dem Changelog an.
