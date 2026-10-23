const { app, NothingEnum } = require("indesign");
const { cleanText } = require("./textCollector");

const FIND_OPTIONS = {
  caseSensitive: true,
  wholeWord: false,
  includeFootnotes: true,
  includeMasterPages: true,
  includeHiddenLayers: true,
  includeLockedLayersForFind: true,
  includeLockedStoriesForFind: true,
};

// "^" leitet in der InDesign-Textsuche Metazeichen ein (^p, ^t …).
const escapeFindText = (text) => text.replace(/\^/g, "^^");

const withFindSettings = (searchText, search) => {
  const options = app.findChangeTextOptions;
  const previous = {};
  for (const key of Object.keys(FIND_OPTIONS)) previous[key] = options[key];
  try {
    app.findTextPreferences = NothingEnum.NOTHING;
    Object.assign(options, FIND_OPTIONS);
    app.findTextPreferences.findWhat = escapeFindText(searchText);
    return search();
  } finally {
    app.findTextPreferences = NothingEnum.NOTHING;
    Object.assign(options, previous);
  }
};

const paragraphContains = (match, context) =>
  cleanText(match.paragraphs.item(0).contents).includes(context);

// Sucht die Stelle im ganzen Dokument und erkennt den richtigen Treffer am umgebenden Text.
// So funktioniert es auch auf einem anderen Rechner oder nachdem Text verschoben wurde.
const locateText = (doc, searchText, context) => {
  if (!searchText) return null;
  const matches = Array.from(withFindSettings(searchText, () => doc.findText()));
  const exact = matches.find((match) => paragraphContains(match, context));
  if (exact) return exact;
  return matches.length === 1 ? matches[0] : null;
};

const showFinding = (doc, finding) => {
  const isApplied = finding.status === "applied";
  const match = isApplied
    ? locateText(doc, finding.korrektur, finding.contextAfter)
    : locateText(doc, finding.original, finding.contextCore);
  if (!match) {
    throw new Error("Die Stelle wurde nicht gefunden. Vermutlich wurde der Text inzwischen geändert.");
  }
  app.select(match);
  match.showText();
};

const applyCorrection = (doc, finding) => {
  const match = locateText(doc, finding.original, finding.contextCore);
  if (!match) {
    throw new Error(`„${finding.original}“ wurde nicht mehr gefunden. Vermutlich wurde der Text inzwischen geändert.`);
  }
  match.contents = finding.korrektur;
};

module.exports = { showFinding, applyCorrection };
