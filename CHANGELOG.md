# Änderungen

Die Versionsnummer steht in `manifest.json` und wird in den Einstellungen angezeigt.
Kleine Korrekturen erhöhen die letzte Stelle (2.1.0 → 2.1.1), neue Funktionen die mittlere (2.1.x → 2.2.0).

## 2.6.0 – 2026-11-06

- Neue Einstellung „Sprache des Textes“: Deutsch, Englisch oder Gemischt.
- Englisch prüft nach englischer Rechtschreibung und Grammatik. Britische und amerikanische Schreibung gelten beide, gemeldet wird nur, was von der im Text überwiegenden Variante abweicht.
- Englische Typografie-Regeln: “…” statt "…" oder „…“, Bis-Strich ohne Leerzeichen (10–12, 9:00–17:00), Prozent ohne Leerzeichen (25%), Leerzeichen vor Maßeinheiten (5 kg). Dazu Gedankenstrich, Bindestriche bei zusammengesetzten Adjektiven und einheitlicher Oxford Comma über die KI.
- Lektorat für englische Texte, inklusive Germanismen („make a photo“ → „take a photo“).
- Gemischt erkennt die Sprache je Absatz und wendet die passenden Regeln an. Kurze Absätze ohne klare Sprache (z. B. Überschriften) folgen der überwiegenden Sprache.
- Bei Deutsch werden einzelne englische Wörter weiterhin nach englischer Schreibung geprüft, aber nicht eingedeutscht.
- Die Historie zeigt bei englischen und gemischten Prüfungen die Sprache an. Erklärungen bleiben immer auf Deutsch.

## 2.5.1 – 2026-11-05

- Meldungen wie „… ignoriert“ oder „… neue Fehler gefunden“ stehen jetzt in einer festen Statuszeile unten im Panel statt unter „Dokument prüfen“. Sie bleiben stehen, bis die nächste Meldung kommt, und die Fehlerliste springt nicht mehr.

## 2.5.0 – 2026-11-05

- Neue Option „Nur Auswahl“ unter Funktionen: geprüft wird nur der markierte Text oder der Text in den ausgewählten Textrahmen (auch in Gruppen und Tabellenzellen). Steht nur der Cursor im Text, gilt der ganze Rahmen. Der Seitenbereich ist dann ausgegraut.
- Eine Auswahl-Prüfung ersetzt nur die offenen Fehler, die im geprüften Text liegen. Alle anderen bleiben stehen.
- Sind keine Fehler mehr offen, steht da jetzt, wie oft das Dokument schon geprüft wurde, wann zuletzt, von wem und welcher Bereich.

## 2.4.0 – 2026-11-05

- Update mit einem Klick: „Jetzt installieren“ lädt die neue Version direkt im Plugin und öffnet sie in Creative Cloud. Kein Umweg über GitHub oder den Download-Ordner mehr.
- Klappt das auf einem Rechner nicht, startet wie bisher der Download im Browser.

## 2.3.0 – 2026-11-05

- Update-Hinweis: Beim Start fragt TP Lektor bei GitHub nach einer neueren Version (höchstens alle 6 Stunden). Ist eine da, erscheint oben ein Hinweis mit den Änderungen und dem Button „Herunterladen“. Die .ccx-Datei per Doppelklick öffnen, Creative Cloud ersetzt die alte Version.
- „Später“ blendet den Hinweis bis zur nächsten neuen Version aus.
- Einstellungen: „Nach Updates suchen“ unter der Versionsnummer.

## 2.2.2 – 2026-10-26

- „Falsch zusätzlich durchstreichen“ funktioniert jetzt auch in InDesign (eigene Linie statt text-decoration, das UXP nicht umsetzt).

## 2.2.1 – 2026-10-26

- Farbsatz „Kräftig (bisherige Farben)“ heißt jetzt nur noch „Kräftig“.

## 2.2.0 – 2026-10-26

- Farben für „falsch“ und „richtig“ einstellbar (Einstellungen → Farben): Standard, Hoher Kontrast, Orange/Blau, Kräftig oder eigene Hex-Werte, getrennt für helle und dunkle Oberflächen.
- Neuer Standard mit gut lesbaren Farben auf dem InDesign-Grau (Kontrast mind. 4,5 : 1 statt bisher 1,7 bzw. 2,4 : 1).
- Option „Falsch zusätzlich durchstreichen“.
- Live-Vorschau mit Kontrastwert direkt auf dem Panel-Hintergrund.

## 2.1.2 – 2026-10-26

- Telefonregeln (Schrägstrich, Klammer, Durchwahl) greifen nur noch mit einem Hinweis wie „Tel.“, „Fax“, „Telefon“ oder „Durchwahl“ davor. Kunden-, Konto- und Artikelnummern wie „0000 0460 0782“ werden nicht mehr als Telefonnummer erkannt.
- Vorwahlen müssen mit 0 und einer Ziffer von 1 bis 9 beginnen.

## 2.1.1 – 2026-10-26

- Zahlengliederung entfernt (Regeln Z1–Z3): Zahlen werden nicht mehr in Dreiergruppen gegliedert oder umgegliedert.

## 2.1.0 – 2026-10-26

- Feste DIN-5008-Typografieregeln, die lokal und bei jedem Durchlauf gleich prüfen; unsichere Regeln als „Hinweis“ markiert.
- Geschützte Leerzeichen bei Zahl und Einheit, Paragraf, Telefonnummer, vor Bis- und Gedankenstrich und beim Malzeichen; schmale geschützte Leerzeichen in Abkürzungen.
- Bereits gesetzte Sonderleerzeichen (geschützt, schmal, Achtelgeviert, Haarspatium …) werden nicht mehr bemängelt.
- Preise wie „45,- €“ behalten den Bindestrich.
- Text auf der Montagefläche wird nicht mehr geprüft.
- Prüfprotokoll (Prompt und Antwort der letzten 5 Prüfungen) optional in den Einstellungen.
- Keine Platzhalter mehr in Eingabefeldern (InDesign hat sie angeschnitten).
- Farbschema wird live erkannt, Neuzeichnen nur bei echtem Wechsel.

## 2.0.0 – 2026-10-23

- Stand mit hellem Modus, Seitenfeldern, Wörterbuch und kompakter Ansicht (Git-Tag `funktioniert-2026-10-23`).
