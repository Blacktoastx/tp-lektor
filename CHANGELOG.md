# Änderungen

Die Versionsnummer steht in `manifest.json` und wird in den Einstellungen angezeigt.
Kleine Korrekturen erhöhen die letzte Stelle (2.1.0 → 2.1.1), neue Funktionen die mittlere (2.1.x → 2.2.0).

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
