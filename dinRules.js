// Feste Typografie-Regeln nach DIN 5008 (und Satzpraxis bei Q1–Q4). Sie laufen lokal ohne KI und liefern
// bei gleichem Text immer dasselbe Ergebnis. Regeln mit unsicheren Ausnahmen melden nur einen Hinweis.

// Alle Leerzeichen, die InDesign kennt: normal, geschützt, Geviert-Varianten, Achtelgeviert, Haarspatium, schmal geschützt.
const SPACE = "[ \\u00A0\\u2000-\\u200A\\u202F\\u205F]";
const NBSP = "\u00A0"; // geschütztes Leerzeichen: kein Zeilenumbruch an dieser Stelle
const NARROW_NBSP = "\u202F"; // schmales geschütztes Leerzeichen

const pad = (value) => String(value).padStart(2, "0");
const normalizeTime = (hours, minutes) => `${pad(hours)}:${minutes}`;

const UNITS = ["%", "‰", "€", "£", "\\$", "°C", "°F", "kg", "mg", "km", "cm", "mm", "m²", "m³", "ml", "kWh", "kW", "MB", "GB", "TB", "KB", "Hz", "EUR", "USD", "CHF"];

const ABBREVIATIONS = [
  ["z", "B"], ["d", "h"], ["u", "a"], ["i", "d", "R"], ["o", "Ä"], ["o", "ä"], ["u", "ä"], ["u", "U"],
  ["z", "T"], ["s", "o"], ["s", "u"], ["i", "A"], ["i", "V"], ["v", "a"], ["z", "H"], ["u", "v", "m"],
  ["m", "E"], ["z", "Zt"],
];

// Ganze Zahl samt Tausender- und Dezimaltrennern, damit „25%“ nicht nur als „5%“ erfasst wird.
const NUMBER = "(?<![\\d.,])((?:\\d[\\d.,]*)?\\d)";

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Jede Regel: id, hint (nur Hinweis?), pattern (global), fix(match) → Korrektur oder null, erklaerung.
// "original" ist immer der komplette Treffer, damit er exakt im Absatz vorkommt.
const RULES = [
  {
    id: "S4",
    hint: false,
    pattern: new RegExp(`\\bvon${SPACE}+(\\d{1,2}(?:[:.]\\d{2})?)${SPACE}*[-–]${SPACE}*(\\d{1,2}(?:[:.]\\d{2})?)`, "g"),
    fix: (m) => `von ${m[1]} bis ${m[2]}`,
    erklaerung: "DIN 5008: Steht „von“ davor, wird „bis“ ausgeschrieben statt eines Strichs.",
  },
  {
    id: "S2",
    hint: false,
    pattern: new RegExp(`(?<![\\d:.])(\\d{1,2})[:.](\\d{2})${SPACE}*[-–]${SPACE}*(\\d{1,2})[:.](\\d{2})(?![\\d])`, "g"),
    fix: (m) => `${normalizeTime(m[1], m[2])}${NBSP}– ${normalizeTime(m[3], m[4])}`,
    erklaerung: "DIN 5008: Bis-Strich als Halbgeviertstrich mit Leerzeichen (davor geschützt), Uhrzeiten zweistellig mit Doppelpunkt.",
  },
  {
    id: "S2",
    hint: false,
    pattern: new RegExp(`(?<![\\d:.,])(\\d{1,2})${SPACE}*[-–]${SPACE}*(\\d{1,2})(${SPACE}+Uhr)`, "g"),
    fix: (m) => `${m[1]}${NBSP}– ${m[2]}${m[3]}`,
    erklaerung: "DIN 5008: Bis-Strich als Halbgeviertstrich mit Leerzeichen (davor geschützt).",
  },
  {
    id: "U1",
    hint: false,
    pattern: new RegExp(`(?<![\\d:.])(\\d{1,2})[:.](\\d{2})(?=${SPACE}*Uhr)`, "g"),
    fix: (m) => normalizeTime(m[1], m[2]),
    erklaerung: "DIN 5008: Uhrzeit mit zweistelligen Stunden und Minuten, getrennt durch Doppelpunkt.",
  },
  {
    id: "D1",
    hint: false,
    pattern: /(?<![\d.])(\d{1,2})\.(\d{1,2})\.(\d{4})(?![\d])/g,
    fix: (m) => (Number(m[1]) <= 31 && Number(m[2]) <= 12 ? `${pad(m[1])}.${pad(m[2])}.${m[3]}` : null),
    erklaerung: "DIN 5008: Numerisches Datum mit zweistelligem Tag und Monat.",
  },
  {
    id: "D2",
    hint: true,
    pattern: /(?<![\d.])(\d{1,2})\.(\d{1,2})\.(\d{2})(?![\d.])/g,
    fix: (m) => (Number(m[1]) <= 31 && Number(m[2]) <= 12 ? `${pad(m[1])}.${pad(m[2])}.20${m[3]}` : null),
    erklaerung: "DIN 5008: Jahr vierstellig. Bitte prüfen, ob das Jahrhundert stimmt.",
  },
  {
    id: "E2",
    hint: false,
    pattern: new RegExp(`${NUMBER}${SPACE}+%(ig|ige|igem|igen|iger|iges)\\b`, "g"),
    fix: (m) => `${m[1]}%${m[2]}`,
    erklaerung: "DIN 5008: In Ableitungen wie „100%ig“ steht kein Leerzeichen vor dem Prozentzeichen.",
  },
  {
    id: "E1",
    hint: false,
    pattern: new RegExp(`${NUMBER}(${UNITS.join("|")})(?![\\p{L}\\d])`, "gu"),
    fix: (m) => `${m[1]}${NBSP}${m[2]}`,
    erklaerung: "DIN 5008: Zwischen Zahl und Einheit oder Zeichen steht ein geschütztes Leerzeichen.",
  },
  {
    id: "E3",
    hint: false,
    pattern: new RegExp(`${NUMBER}${SPACE}+°(?![CF])`, "g"),
    fix: (m) => `${m[1]}°`,
    erklaerung: "DIN 5008: Winkelgrade ohne Leerzeichen (90°), Temperaturen mit Leerzeichen (20 °C).",
  },
  {
    id: "E4",
    hint: false,
    pattern: /(§§?)(\d)/g,
    fix: (m) => `${m[1]}${NBSP}${m[2]}`,
    erklaerung: "DIN 5008: Zwischen Paragrafenzeichen und Zahl steht ein geschütztes Leerzeichen.",
  },
  ...ABBREVIATIONS.map((parts) => ({
    id: "A1",
    hint: false,
    pattern: new RegExp(`(?<![\\p{L}])${parts.map(escapeRegex).join("\\.")}\\.`, "gu"),
    fix: () => `${parts.join(`.${NARROW_NBSP}`)}.`,
    erklaerung: "DIN 5008: Mehrteilige Abkürzungen mit Leerzeichen (hier ein schmales geschütztes Leerzeichen).",
  })),
  {
    id: "T2",
    hint: false,
    pattern: new RegExp(`\\+49${SPACE}*\\(0\\)${SPACE}*(\\d+)`, "g"),
    fix: (m) => `+49${NBSP}${m[1]}`,
    erklaerung: "DIN 5008: International entfällt die Null der Vorwahl, ohne Klammer.",
  },
  {
    id: "T1",
    hint: false,
    pattern: new RegExp(`(?<!\\d)(0\\d{2,5})${SPACE}*\\/${SPACE}*(\\d{3,})`, "g"),
    fix: (m) => `${m[1]}${NBSP}${m[2]}`,
    erklaerung: "DIN 5008: Vorwahl und Rufnummer durch ein (geschütztes) Leerzeichen getrennt, ohne Schrägstrich.",
  },
  {
    id: "T1",
    hint: false,
    pattern: new RegExp(`\\((0\\d{2,5})\\)${SPACE}*(\\d{3,})`, "g"),
    fix: (m) => `${m[1]}${NBSP}${m[2]}`,
    erklaerung: "DIN 5008: Vorwahl ohne Klammer, durch ein (geschütztes) Leerzeichen von der Rufnummer getrennt.",
  },
  {
    id: "T3",
    hint: true,
    pattern: /(?<![\d+])(0\d{2,5} \d{3,}) (\d{1,4})(?![\d]|[.,]\d)/g,
    fix: (m) => `${m[1]}-${m[2]}`,
    erklaerung: "DIN 5008: Eine Durchwahl wird mit Bindestrich angehängt. Bitte prüfen, ob es eine Durchwahl ist.",
  },
  {
    id: "S3",
    hint: true,
    pattern: /(?<![\d\/.,\-–])(\d{1,4})(?: ?[-–] ?|[-–])(\d{1,4})(?![\d\-–]|[.,]\d)/g,
    fix: (m) => `${m[1]}${NBSP}– ${m[2]}`,
    erklaerung: "DIN 5008: Bis-Strich als Halbgeviertstrich mit Leerzeichen (davor geschützt). Bitte prüfen, ob es keine Nummer (z. B. Durchwahl) ist.",
  },
  {
    id: "Z2",
    hint: false,
    pattern: new RegExp(`(?<![\\d.,])(\\d)${SPACE}(\\d{3})(?![\\d,.]|${SPACE}\\d|${SPACE}*(?:€|EUR|Euro|USD|CHF))`, "g"),
    fix: (m) => `${m[1]}${m[2]}`,
    erklaerung: "DIN 5008: Vierstellige Zahlen werden nicht gegliedert.",
  },
  {
    id: "Z3",
    hint: true,
    pattern: new RegExp(`(?<![\\d.,€$])(\\d{1,3}(?:\\.\\d{3})+)(?![\\d,.]|${SPACE}*(?:€|EUR|Euro|USD|CHF|\\$))`, "g"),
    fix: (m) => {
      const digits = m[1].replace(/\./g, "");
      return digits.length <= 4 ? digits : digits.replace(/\B(?=(\d{3})+(?!\d))/g, NARROW_NBSP);
    },
    erklaerung: "DIN 5008: Der Punkt gliedert nur Geldbeträge, sonst Leerzeichen bzw. keine Gliederung. Bitte prüfen, ob es kein Betrag ist.",
  },
  {
    id: "Z1",
    hint: true,
    pattern: new RegExp(`(?<![\\d+.,\\/]|\\d${SPACE})([1-9]\\d{4,})(?![\\d]|[.,]\\d)`, "gu"),
    fix: (m) => {
      const followedByWord = /^[ \u00A0]\p{Lu}/u.test(m.input.slice(m.index + m[0].length));
      if (m[1].length === 5 && followedByWord) return null; // vermutlich Postleitzahl
      return m[1].replace(/\B(?=(\d{3})+(?!\d))/g, NARROW_NBSP);
    },
    erklaerung: "DIN 5008: Zahlen ab fünf Stellen in Dreiergruppen gliedern. Bitte prüfen, ob es keine Postleitzahl oder Nummer ist.",
  },
  {
    id: "Q1",
    hint: false,
    pattern: /"([^"\r\n]{1,200})"/g,
    fix: (m) => `„${m[1]}“`,
    erklaerung: "Satzpraxis: Deutsche Anführungszeichen „…“.",
  },
  {
    id: "Q1",
    hint: false,
    pattern: /“([^“”„\r\n]{1,200})”/g,
    fix: (m) => `„${m[1]}“`,
    erklaerung: "Satzpraxis: Deutsche Anführungszeichen „…“ statt englischer “…”.",
  },
  {
    id: "Q2",
    hint: false,
    pattern: /(\p{L}+)'(\p{L}+)/gu,
    fix: (m) => `${m[1]}’${m[2]}`,
    erklaerung: "Satzpraxis: Typografischer Apostroph ’ statt '.",
  },
  {
    id: "Q3",
    hint: false,
    pattern: /(\S*)\.\.\.(?!\.)/g,
    fix: (m) => `${m[1]}…`,
    erklaerung: "Satzpraxis: Auslassungspunkte als ein Zeichen (…).",
  },
  {
    id: "Q4",
    hint: true,
    pattern: new RegExp(`(\\d)${SPACE}*[xX]${SPACE}*(\\d)`, "g"),
    fix: (m) => `${m[1]}${NBSP}×${NBSP}${m[2]}`,
    erklaerung: "Satzpraxis: Malzeichen × statt x. Bitte prüfen, ob es kein Bestandteil einer Bezeichnung ist.",
  },
  {
    id: "S1",
    hint: false,
    pattern: /(\S+) - (\S+)/g,
    fix: (m) => `${m[1]}${NBSP}– ${m[2]}`,
    erklaerung: "DIN 5008: Gedankenstrich als Halbgeviertstrich (–) mit Leerzeichen, davor geschützt, damit keine Zeile mit dem Strich beginnt.",
  },
  {
    id: "L1",
    hint: false,
    pattern: /(\S+) {2,}(\S+)/g,
    fix: (m) => `${m[1]} ${m[2]}`,
    erklaerung: "DIN 5008: Kein doppeltes Leerzeichen.",
  },
  {
    id: "L2",
    hint: false,
    pattern: new RegExp(`(\\S+)${SPACE}+([,;:!?]|\\.(?!\\.))(?!\\d)`, "g"),
    fix: (m) => `${m[1]}${m[2]}`,
    erklaerung: "DIN 5008: Kein Leerzeichen vor einem Satzzeichen.",
  },
  {
    id: "L3",
    hint: true,
    pattern: /(\p{Ll}{2,})([,;!?])(\p{L}{2,})/gu,
    fix: (m) => `${m[1]}${m[2]} ${m[3]}`,
    erklaerung: "DIN 5008: Nach einem Satzzeichen folgt ein Leerzeichen. Bitte prüfen, ob es kein Fachbegriff oder Code ist.",
  },
];

const overlaps = (ranges, start, end) => ranges.some(([from, to]) => start < to && end > from);

// Prüft einen Absatz. Spätere Regeln überspringen Stellen, die eine frühere Regel schon gemeldet hat.
const checkParagraph = (entry) => {
  const findings = [];
  const covered = [];
  for (const rule of RULES) {
    rule.pattern.lastIndex = 0;
    for (const match of entry.text.matchAll(rule.pattern)) {
      const start = match.index;
      const end = start + match[0].length;
      if (overlaps(covered, start, end)) continue;
      const korrektur = rule.fix(match);
      if (korrektur === null || korrektur === match[0]) continue;
      covered.push([start, end]);
      findings.push({
        id: entry.id,
        original: match[0],
        korrektur,
        typ: "Typografie",
        erklaerung: rule.erklaerung,
        hint: rule.hint,
        ruleId: rule.id,
      });
    }
  }
  return findings;
};

// ---------- Einheitlichkeit im ganzen Dokument (M1, M2) ----------

const DOTTED_DATE = /(?<![\d.])(\d{2})\.(\d{2})\.(\d{4})(?![\d])/g;
const ISO_DATE = /(?<![\d-])(\d{4})-(\d{2})-(\d{2})(?![\d-])/g;
// Uhrzeiten am Ende einer Spanne („07:00 – 19:00 Uhr“) zählen nicht, sonst würde nur die halbe Spanne umgestellt.
const NOT_IN_RANGE = `(?<![\\d:.])(?<![-–]${SPACE}?)(?<!bis${SPACE})`;
const FULL_HOUR = new RegExp(`${NOT_IN_RANGE}(\\d{1,2})(${SPACE}+Uhr)`, "g");
const HOUR_MINUTES = new RegExp(`${NOT_IN_RANGE}(\\d{2}):00(${SPACE}+Uhr)`, "g");

const collectMatches = (entries, pattern) =>
  entries.flatMap((entry) => [...entry.text.matchAll(pattern)].map((match) => ({ entry, match })));

// Meldet die Schreibweise, die seltener vorkommt, als Hinweis mit Umwandlung in die häufigere.
const flagMinority = (groupA, groupB, toA, toB, erklaerung, ruleId) => {
  if (groupA.length === 0 || groupB.length === 0) return [];
  const [minority, convert] = groupA.length >= groupB.length ? [groupB, toA] : [groupA, toB];
  return minority.map(({ entry, match }) => ({
    id: entry.id,
    original: match[0],
    korrektur: convert(match),
    typ: "Typografie",
    erklaerung,
    hint: true,
    ruleId,
  }));
};

const checkConsistency = (entries) => [
  ...flagMinority(
    collectMatches(entries, DOTTED_DATE),
    collectMatches(entries, ISO_DATE),
    (m) => `${m[3]}.${m[2]}.${m[1]}`,
    (m) => `${m[3]}-${m[2]}-${m[1]}`,
    "Uneinheitliche Datumsformate im Dokument. Vorschlag: das überwiegend verwendete Format.",
    "M1"
  ),
  ...flagMinority(
    collectMatches(entries, FULL_HOUR),
    collectMatches(entries, HOUR_MINUTES),
    (m) => `${Number(m[1])}${m[2]}`,
    (m) => `${pad(m[1])}:00${m[2]}`,
    "Uneinheitliche Uhrzeitformate im Dokument (14 Uhr / 14:00 Uhr). Vorschlag: das überwiegend verwendete Format.",
    "M2"
  ),
];

const runDinRules = (entries) => [...entries.flatMap(checkParagraph), ...checkConsistency(entries)];

module.exports = { runDinRules, RULES };
