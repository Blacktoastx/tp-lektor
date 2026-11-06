// Sprache der Prüfung. „Gemischt“ bestimmt die Sprache je Absatz anhand häufiger Wörter.

const LANGUAGE_OPTIONS = [
  { id: "de", label: "Deutsch", hint: "Duden und DIN 5008 · einzelne englische Wörter werden englisch geprüft" },
  { id: "en", label: "Englisch", hint: "Englische Rechtschreibung und Typografie" },
  { id: "mixed", label: "Gemischt", hint: "Jeder Absatz nach den Regeln seiner Sprache" },
];

const DEFAULT_LANGUAGE = "de";

const isLanguage = (id) => LANGUAGE_OPTIONS.some((option) => option.id === id);

const languageLabel = (id) => (LANGUAGE_OPTIONS.find((option) => option.id === id) || LANGUAGE_OPTIONS[0]).label;

// Nur Wörter, die es in der anderen Sprache nicht (häufig) gibt. „was“, „will“, „in“, „an“ fehlen deshalb.
const GERMAN_WORDS = new Set(
  "der die das und ist nicht mit für auf ein eine einen einem dem den des zu von im sich auch als wie bei oder wir sie ich es aus nach wird werden sind hat haben über noch nur kann können ihre ihr unsere sowie bitte zum zur".split(" ")
);
const ENGLISH_WORDS = new Set(
  "the and is are were of to for on with that this it be by as at from or have has not you we they can which their our your its been would should could there these those about into more".split(" ")
);

const detectLanguage = (text) => {
  const words = text.toLowerCase().match(/\p{L}+/gu) || [];
  let german = /[äöüß]/i.test(text) ? 1 : 0;
  let english = 0;
  for (const word of words) {
    if (GERMAN_WORDS.has(word)) german++;
    else if (ENGLISH_WORDS.has(word)) english++;
  }
  if (german === english) return null;
  return german > english ? "de" : "en";
};

// Setzt entry.language für jeden Absatz. Bei „Gemischt“ übernehmen Absätze ohne klare Sprache
// (z. B. kurze Überschriften) die Sprache, die in der Prüfung überwiegt.
const assignLanguages = (entries, setting) => {
  if (setting !== "mixed") {
    for (const entry of entries) entry.language = setting;
    return;
  }
  const detected = entries.map((entry) => detectLanguage(entry.text));
  const englishCount = detected.filter((language) => language === "en").length;
  const germanCount = detected.filter((language) => language === "de").length;
  const majority = englishCount > germanCount ? "en" : "de";
  entries.forEach((entry, index) => {
    entry.language = detected[index] || majority;
  });
};

module.exports = { LANGUAGE_OPTIONS, DEFAULT_LANGUAGE, isLanguage, languageLabel, detectLanguage, assignLanguages };
