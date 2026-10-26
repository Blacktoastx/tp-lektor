// Die drei Prüf-Funktionen. Jede bringt ihre Fehlertypen und ihren Prompt-Baustein mit.
const CHECKS = {
  orthography: {
    label: "Rechtschreibung & Grammatik",
    types: ["Rechtschreibung", "Grammatik", "Zeichensetzung"],
    prompt: `RECHTSCHREIBUNG & GRAMMATIK (Typen: Rechtschreibung, Grammatik, Zeichensetzung)
- Melde eindeutige Fehler in Rechtschreibung, Grammatik und Zeichensetzung nach aktuellem Duden.
- Anderssprachige Passagen prüfst du nach der Rechtschreibung ihrer Sprache.
- Fehlende Satzzeichen am Ende von Überschriften, Aufzählungspunkten, Tabellenzellen und Bildunterschriften sind kein Fehler.`,
  },
  typography: {
    label: "Mikro- & Makrotypografie",
    types: ["Typografie"],
    prompt: `MIKRO- & MAKROTYPOGRAFIE nach DIN 5008:2020 (Typ: Typografie)
TP Lektor prüft die meisten Typografie-Regeln bereits selbst mit festen Regeln. Melde zu den folgenden Punkten NICHTS, auch wenn du dort etwas findest:
Leerzeichen (doppelt, vor oder nach Satzzeichen), Zahl und Einheit, Prozent, Grad, Paragraf, Abkürzungen wie „z. B.“, Gedankenstrich zwischen Wörtern, Bis-Strich zwischen Zahlen und Uhrzeiten, „von … bis …“, Uhrzeit- und Datumsformate, Zahlengliederung, Telefonnummern, Anführungszeichen, Apostroph, Auslassungspunkte, Malzeichen.

Prüfe ausschließlich, was nur mit Sprachverständnis erkennbar ist:
- Streckenstrich zwischen Orten, Namen oder Begriffen als Halbgeviertstrich MIT Leerzeichen: „Leipzig-Dresden“ → „Leipzig – Dresden“, „Bayern-Schalke“ (Spiel) → „Bayern – Schalke“. Echte Komposita wie „Baden-Württemberg“ oder „Max-Planck-Institut“ bleiben.
- Bindestrich, der als Gedankenstrich gemeint ist, wo kein Leerzeichen auf beiden Seiten steht, z. B. am Satzende („… so war es -“).
- Ergänzungsstrich: „Ein und Ausgang“ → „Ein- und Ausgang“.
- Uneinheitliche Schreibweisen desselben Begriffs innerhalb der Absätze (E-Mail/Email) und uneinheitliche Zeichen am Anfang von Aufzählungen.

Nach DIN 5008 stehen Gedanken-, Bis- und Streckenstrich immer MIT Leerzeichen. Melde niemals, dass diese Leerzeichen entfernt werden sollen. Im Zweifel nichts melden.`,
  },
  editing: {
    label: "Lektorieren",
    types: ["Lektorat"],
    prompt: `LEKTORAT (Typ: Lektorat)
- Schlage Verbesserungen für Verständlichkeit und Lesefluss vor: überlange oder verschachtelte Sätze, Wortwiederholungen auf engem Raum, Füllwörter, Nominalstil, unklare Bezüge, Pleonasmen, uneinheitliche Begriffe.
- Nur deutliche Verbesserungen, höchstens eine pro Absatz. Behalte Inhalt, Tonfall und Fachbegriffe bei.
- "original" ist ein zusammenhängender, exakter Ausschnitt von höchstens einem Satz, "korrektur" die verbesserte Fassung genau dieses Ausschnitts.`,
  },
};

const CHECK_KEYS = Object.keys(CHECKS);

const typesFor = (checkKeys) => checkKeys.flatMap((key) => CHECKS[key].types);

const checkForType = (typ) => CHECK_KEYS.find((key) => CHECKS[key].types.includes(typ));

module.exports = { CHECKS, CHECK_KEYS, typesFor, checkForType };
