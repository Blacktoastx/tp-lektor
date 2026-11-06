// Die drei Prüf-Funktionen. Jede bringt ihre Fehlertypen und je Sprache ihren Prompt-Baustein mit.

const ORTHOGRAPHY = {
  de: `RECHTSCHREIBUNG & GRAMMATIK (Typen: Rechtschreibung, Grammatik, Zeichensetzung)
- Der Text ist deutsch. Melde eindeutige Fehler in Rechtschreibung, Grammatik und Zeichensetzung nach aktuellem Duden.
- Einzelne englische Wörter und Begriffe im deutschen Text (z. B. Meeting, Workflow, Feedback, Call-to-Action) sind erlaubt. Prüfe ihre Schreibweise nach englischer Rechtschreibung und melde Tippfehler darin („Feedbak“ → „Feedback“). Ersetze sie nicht durch deutsche Wörter.
- Englische oder andere anderssprachige Passagen prüfst du nach der Rechtschreibung und Grammatik ihrer Sprache.
- Fehlende Satzzeichen am Ende von Überschriften, Aufzählungspunkten, Tabellenzellen und Bildunterschriften sind kein Fehler.`,
  en: `SPELLING & GRAMMAR (Typen: Rechtschreibung, Grammatik, Zeichensetzung)
- Der Text ist englisch. Melde eindeutige Fehler in Rechtschreibung, Grammatik und Zeichensetzung nach englischer Standardsprache.
- Britische und amerikanische Schreibweise sind beide richtig. Ermittle, welche Variante der Text überwiegend verwendet (z. B. colour/color, organise/organize, centre/center), und melde nur Wörter, die davon abweichen.
- Typische Fehler: its/it's, their/there/they're, your/you're, affect/effect, fehlende Kongruenz von Subjekt und Verb, falsche Zeitformen.
- Deutsche Eigennamen und Begriffe im englischen Text nicht übersetzen.
- Fehlende Satzzeichen am Ende von Überschriften, Aufzählungspunkten, Tabellenzellen und Bildunterschriften sind kein Fehler.`,
};

const TYPOGRAPHY = {
  de: `MIKRO- & MAKROTYPOGRAFIE nach DIN 5008:2020 (Typ: Typografie)
TP Lektor prüft die meisten Typografie-Regeln bereits selbst mit festen Regeln. Melde zu den folgenden Punkten NICHTS, auch wenn du dort etwas findest:
Leerzeichen (doppelt, vor oder nach Satzzeichen), Zahl und Einheit, Prozent, Grad, Paragraf, Abkürzungen wie „z. B.“, Gedankenstrich zwischen Wörtern, Bis-Strich zwischen Zahlen und Uhrzeiten, „von … bis …“, Uhrzeit- und Datumsformate, Zahlengliederung, Telefonnummern, Anführungszeichen, Apostroph, Auslassungspunkte, Malzeichen.

Prüfe ausschließlich, was nur mit Sprachverständnis erkennbar ist:
- Streckenstrich zwischen Orten, Namen oder Begriffen als Halbgeviertstrich MIT Leerzeichen: „Leipzig-Dresden“ → „Leipzig – Dresden“, „Bayern-Schalke“ (Spiel) → „Bayern – Schalke“. Echte Komposita wie „Baden-Württemberg“ oder „Max-Planck-Institut“ bleiben.
- Bindestrich, der als Gedankenstrich gemeint ist, wo kein Leerzeichen auf beiden Seiten steht, z. B. am Satzende („… so war es -“).
- Ergänzungsstrich: „Ein und Ausgang“ → „Ein- und Ausgang“.
- Uneinheitliche Schreibweisen desselben Begriffs innerhalb der Absätze (E-Mail/Email) und uneinheitliche Zeichen am Anfang von Aufzählungen.

Nach DIN 5008 stehen Gedanken-, Bis- und Streckenstrich immer MIT Leerzeichen. Melde niemals, dass diese Leerzeichen entfernt werden sollen. Im Zweifel nichts melden.`,
  en: `ENGLISCHE TYPOGRAFIE (Typ: Typografie)
TP Lektor prüft die meisten Typografie-Regeln bereits selbst mit festen Regeln. Melde zu den folgenden Punkten NICHTS, auch wenn du dort etwas findest:
Leerzeichen (doppelt, vor oder nach Satzzeichen), Zahl und Einheit, Prozent, Grad, Gedankenstrich zwischen Wörtern, Bis-Strich zwischen Zahlen und Uhrzeiten, Anführungszeichen, Apostroph, Auslassungspunkte, Malzeichen.

Englische Regeln, die nur mit Sprachverständnis erkennbar sind:
- Bis- und Streckenstrich als Halbgeviertstrich OHNE Leerzeichen: „London-Paris flight“ → „London–Paris flight“, „pages 10 – 20“ → „pages 10–20“. Echte Komposita mit Bindestrich bleiben („well-known“, „state-of-the-art“).
- Gedankenstrich: entweder Halbgeviertstrich mit Leerzeichen („word – word“) oder Geviertstrich ohne Leerzeichen („word—word“). Beides ist richtig; melde nur, wenn im Text beide Varianten gemischt vorkommen, und schlage die überwiegende vor.
- Bindestrich bei zusammengesetzten Adjektiven vor dem Nomen: „a long term plan“ → „a long-term plan“ (aber nicht nach Adverbien auf -ly: „a highly rated product“).
- Serial comma (Oxford comma) einheitlich: melde nur, wenn er im Text uneinheitlich verwendet wird.
- Uneinheitliche Schreibweisen desselben Begriffs (e-mail/email) und uneinheitliche Zeichen am Anfang von Aufzählungen.
Im Zweifel nichts melden.`,
};

const EDITING = {
  de: `LEKTORAT (Typ: Lektorat)
- Schlage Verbesserungen für Verständlichkeit und Lesefluss vor: überlange oder verschachtelte Sätze, Wortwiederholungen auf engem Raum, Füllwörter, Nominalstil, unklare Bezüge, Pleonasmen, uneinheitliche Begriffe.
- Nur deutliche Verbesserungen, höchstens eine pro Absatz. Behalte Inhalt, Tonfall und Fachbegriffe bei.
- "original" ist ein zusammenhängender, exakter Ausschnitt von höchstens einem Satz, "korrektur" die verbesserte Fassung genau dieses Ausschnitts.`,
  en: `LEKTORAT ENGLISCH (Typ: Lektorat)
- Schlage Verbesserungen für Verständlichkeit und Lesefluss des englischen Textes vor: überlange Sätze, Wortwiederholungen, Füllwörter, unnötiges Passiv, Nominalstil, unklare Bezüge, Germanismen und wörtlich aus dem Deutschen übersetzte Wendungen („make a photo“ → „take a photo“, „since three years“ → „for three years“).
- Nur deutliche Verbesserungen, höchstens eine pro Absatz. Behalte Inhalt, Tonfall, Fachbegriffe und die Schreibvariante (britisch/amerikanisch) bei.
- "original" ist ein zusammenhängender, exakter Ausschnitt von höchstens einem Satz, "korrektur" die verbesserte englische Fassung genau dieses Ausschnitts.`,
};

const CHECKS = {
  orthography: {
    label: "Rechtschreibung & Grammatik",
    types: ["Rechtschreibung", "Grammatik", "Zeichensetzung"],
    prompts: ORTHOGRAPHY,
  },
  typography: {
    label: "Mikro- & Makrotypografie",
    types: ["Typografie"],
    prompts: TYPOGRAPHY,
  },
  editing: {
    label: "Lektorieren",
    types: ["Lektorat"],
    prompts: EDITING,
  },
};

const MIXED_INTRO = `GEMISCHTE SPRACHEN
Das Dokument enthält deutsche und englische Absätze. Bestimme für jeden Absatz seine Sprache und wende nur die Regeln dieser Sprache an: für deutsche Absätze die Abschnitte „Deutsch“, für englische die Abschnitte „Englisch“. Einzelne englische Wörter in einem deutschen Absatz machen ihn nicht zu einem englischen.`;

// Bei „Gemischt“ bekommt das Modell beide Regelwerke, klar nach Sprache getrennt.
const promptFor = (key, language) => {
  const prompts = CHECKS[key].prompts;
  if (language !== "mixed") return prompts[language] || prompts.de;
  return `${prompts.de.replace(/\n/, " – für deutsche Absätze (Deutsch)\n")}\n\n${prompts.en.replace(/\n/, " – für englische Absätze (Englisch)\n")}`;
};

const CHECK_KEYS = Object.keys(CHECKS);

const typesFor = (checkKeys) => checkKeys.flatMap((key) => CHECKS[key].types);

const checkForType = (typ) => CHECK_KEYS.find((key) => CHECKS[key].types.includes(typ));

module.exports = { CHECKS, CHECK_KEYS, MIXED_INTRO, promptFor, typesFor, checkForType };
