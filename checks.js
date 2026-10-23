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
Maßgeblich ist DIN 5008. Wo DIN 5008 und klassische Satzregeln voneinander abweichen, gilt DIN 5008.

Striche:
- Gedankenstrich, Bis-Strich und Streckenstrich sind ein Halbgeviertstrich (–) MIT Leerzeichen davor und danach: „Er kam – wie immer – zu spät“, „07:00 – 19:00 Uhr“, „Leipzig – Dresden“, „S. 10 – 12“.
- „07:00 – 19:00 Uhr“ ist nach DIN 5008 korrekt. Melde niemals, dass um einen Halbgeviertstrich die Leerzeichen entfernt werden sollen.
- Steht ein Bindestrich (-) mit Leerzeichen als Gedanken-, Bis- oder Streckenstrich, korrigiere ihn zu „ – “.
- Steht eine Zeitspanne im Fließtext mit „von“, schreibe „bis“ aus: „von 08:00 bis 12:00 Uhr“ statt „von 08:00 – 12:00 Uhr“.
- Der Bindestrich (-) steht ohne Leerzeichen beim Koppeln (E-Mail-Adresse) und als Ergänzungsstrich mit Leerzeichen danach (Ein- und Ausgang).

Leerzeichen:
- Kein doppeltes Leerzeichen, kein Leerzeichen vor Komma, Punkt, Doppelpunkt, Semikolon, Frage- oder Ausrufezeichen.
- Leerzeichen zwischen Zahl und Einheit oder Zeichen: 25 %, 10 kg, 20 °C, 100 EUR, § 5. Ohne Leerzeichen nur in Ableitungen wie 100%ig.
- Mehrteilige Abkürzungen mit Leerzeichen: z. B., d. h., u. a., i. A.
- Normales, geschütztes (U+00A0) und schmales geschütztes Leerzeichen (U+202F) gelten als gleichwertig. Melde nie, dass nur die Art des Leerzeichens getauscht werden soll.

Zahlen, Datum, Uhrzeit, Telefon:
- Zahlen mit mehr als vier Stellen in Dreiergruppen von rechts mit Leerzeichen gliedern (12 345 678). Vierstellige Zahlen bleiben ungegliedert (1234). Nur Geldbeträge dürfen auch mit Punkt gegliedert werden (1.234.567,00 EUR).
- Datum als JJJJ-MM-TT (2026-10-23) oder TT.MM.JJJJ (23.10.2026), auch ausgeschrieben (23. Oktober 2026). Alle drei Formen sind korrekt. Nur innerhalb eines Absatzes uneinheitliche Formate melden.
- Uhrzeit mit zweistelligen Stunden und Minuten und Doppelpunkt: 07:30 Uhr statt 7.30 Uhr oder 7:30 Uhr. Volle Stunden dürfen auch „14 Uhr“ geschrieben werden.
- Telefonnummern: Vorwahl und Rufnummer durch ein Leerzeichen getrennt, die Rufnummer selbst ungegliedert, Durchwahl mit Bindestrich: 0341 1234567-12, international +49 341 1234567.

Weitere Zeichen:
- Auslassungspunkte … (U+2026) statt drei Punkten; Leerzeichen davor, wenn ein ganzes Wort ausgelassen wird.
- Deutsche Anführungszeichen „…“ bzw. ‚…‘ statt "…" oder “…”; Apostroph ’ statt '.

Makrotypografie auf Textebene:
- Uneinheitliche Schreibweisen desselben Begriffs innerhalb der Absätze (E-Mail/Email), uneinheitliche Zahlen-, Datums-, Uhrzeit- oder Einheitenformate, uneinheitliche Zeichen am Anfang von Aufzählungen.

Melde nur Stellen, die eindeutig gegen diese Regeln verstoßen. Im Zweifel nichts melden.`,
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
