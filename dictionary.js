const { localFileSystem, formats } = require("uxp").storage;

// Das Wörterbuch gehört zum Rechner, nicht zum Dokument: Es gilt in allen Dateien.
const STORAGE_KEY = "dictionary";
const EXPORT_FORMAT = "tp-lektor-woerterbuch";
const DEFAULT_CATEGORY_ID = "allgemein";
const MAX_PROMPT_TERMS = 400;

const createId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

const emptyDictionary = () => ({
  categories: [{ id: DEFAULT_CATEGORY_ID, name: "Allgemein", active: true }],
  entries: [],
});

const load = () => {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (stored && Array.isArray(stored.categories) && Array.isArray(stored.entries)) return stored;
  } catch {
    // beschädigter Eintrag – mit leerem Wörterbuch weitermachen
  }
  return emptyDictionary();
};

const save = (dictionary) => localStorage.setItem(STORAGE_KEY, JSON.stringify(dictionary));

const update = (change) => {
  const dictionary = load();
  const result = change(dictionary);
  save(dictionary);
  return result;
};

// Satzzeichen am Rand gehören nicht zum Wort („Kalendarium+,“ → „Kalendarium+“).
const normalizeTerm = (text) => text.trim().replace(/^[\s"'„“”‚‘’«»(\[]+|[\s"'„“”‚‘’«»)\].,;:!?]+$/g, "");

const findCategoryByName = (dictionary, name) =>
  dictionary.categories.find((category) => category.name.toLowerCase() === name.toLowerCase());

const addCategory = (name) =>
  update((dictionary) => {
    const trimmed = name.trim();
    if (!trimmed) throw new Error("Bitte einen Namen für die Kategorie eingeben.");
    if (findCategoryByName(dictionary, trimmed)) throw new Error(`Die Kategorie „${trimmed}“ gibt es schon.`);
    const category = { id: createId(), name: trimmed, active: true };
    dictionary.categories.push(category);
    return category;
  });

const deleteCategory = (categoryId) =>
  update((dictionary) => {
    if (categoryId === DEFAULT_CATEGORY_ID) throw new Error("Die Kategorie „Allgemein“ kann nicht gelöscht werden.");
    dictionary.categories = dictionary.categories.filter((category) => category.id !== categoryId);
    dictionary.entries = dictionary.entries.filter((entry) => entry.categoryId !== categoryId);
  });

const setCategoryActive = (categoryId, active) =>
  update((dictionary) => {
    const category = dictionary.categories.find((candidate) => candidate.id === categoryId);
    if (category) category.active = active;
  });

const addEntry = (text, categoryId, user) =>
  update((dictionary) => {
    const term = normalizeTerm(text);
    if (!term) throw new Error("Bitte ein Wort eingeben.");
    const category =
      dictionary.categories.find((candidate) => candidate.id === categoryId) || dictionary.categories[0];
    const exists = dictionary.entries.some((entry) => entry.text === term && entry.categoryId === category.id);
    if (!exists) {
      dictionary.entries.push({ id: createId(), text: term, categoryId: category.id, addedBy: user, addedAt: new Date().toISOString() });
    }
    return { term, category, added: !exists };
  });

const removeEntries = (entryIds) =>
  update((dictionary) => {
    const ids = new Set(entryIds);
    dictionary.entries = dictionary.entries.filter((entry) => !ids.has(entry.id));
  });

const activeTerms = (dictionary = load()) => {
  const active = new Set(dictionary.categories.filter((category) => category.active).map((category) => category.id));
  return [...new Set(dictionary.entries.filter((entry) => active.has(entry.categoryId)).map((entry) => entry.text))];
};

const promptTerms = () => activeTerms().slice(0, MAX_PROMPT_TERMS);

// Ein Fund gilt als abgedeckt, wenn er genau ein Wörterbuch-Wort ist oder ein Teil davon, der im Text
// als Teil dieses Worts steht (z. B. „Lektor“ aus „TP Lektor“).
const isCoveredByDictionary = (finding, terms) => {
  const original = normalizeTerm(finding.original);
  if (!original) return false;
  return terms.some(
    (term) => term === original || (term.includes(original) && finding.contextCore.includes(term))
  );
};

// ---------- Export & Import ----------

const toExportData = (dictionary, entries) => {
  const categories = dictionary.categories
    .map((category) => ({
      name: category.name,
      woerter: entries.filter((entry) => entry.categoryId === category.id).map((entry) => entry.text),
    }))
    .filter((category) => category.woerter.length > 0);
  return { format: EXPORT_FORMAT, version: 1, exportiertAm: new Date().toISOString(), kategorien: categories };
};

const writeExport = async (data, suggestedName) => {
  const file = await localFileSystem.getFileForSaving(`${suggestedName}.json`, { types: ["json"] });
  if (!file) return null;
  await file.write(JSON.stringify(data, null, 2), { format: formats.utf8 });
  return file.name;
};

const exportEntries = (entryIds) => {
  const dictionary = load();
  const ids = new Set(entryIds);
  const entries = dictionary.entries.filter((entry) => ids.has(entry.id));
  if (entries.length === 0) throw new Error("Bitte zuerst Wörter auswählen.");
  return writeExport(toExportData(dictionary, entries), "TP Lektor Wörterbuch");
};

const exportCategory = (categoryId) => {
  const dictionary = load();
  const category = dictionary.categories.find((candidate) => candidate.id === categoryId);
  const entries = dictionary.entries.filter((entry) => entry.categoryId === categoryId);
  if (entries.length === 0) throw new Error(`Die Kategorie „${category.name}“ ist leer.`);
  return writeExport(toExportData(dictionary, entries), `TP Lektor Wörterbuch – ${category.name}`);
};

const parseImport = (raw) => {
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error("Die Datei ist kein gültiges Wörterbuch.");
  }
  if (!data || data.format !== EXPORT_FORMAT || !Array.isArray(data.kategorien)) {
    throw new Error("Die Datei ist kein TP-Lektor-Wörterbuch.");
  }
  return data.kategorien;
};

const importFromFile = async (user) => {
  const file = await localFileSystem.getFileForOpening({ types: ["json"] });
  if (!file) return null;
  const imported = parseImport(await file.read({ format: formats.utf8 }));

  return update((dictionary) => {
    let addedWords = 0;
    let addedCategories = 0;
    for (const importedCategory of imported) {
      let category = findCategoryByName(dictionary, String(importedCategory.name || "Allgemein"));
      if (!category) {
        category = { id: createId(), name: String(importedCategory.name), active: true };
        dictionary.categories.push(category);
        addedCategories++;
      }
      for (const word of importedCategory.woerter || []) {
        const term = normalizeTerm(String(word));
        const exists = dictionary.entries.some((entry) => entry.text === term && entry.categoryId === category.id);
        if (!term || exists) continue;
        dictionary.entries.push({ id: createId(), text: term, categoryId: category.id, addedBy: user, addedAt: new Date().toISOString() });
        addedWords++;
      }
    }
    return { addedWords, addedCategories, fileName: file.name };
  });
};

module.exports = {
  DEFAULT_CATEGORY_ID,
  load,
  addCategory,
  deleteCategory,
  setCategoryActive,
  addEntry,
  removeEntries,
  activeTerms,
  promptTerms,
  isCoveredByDictionary,
  normalizeTerm,
  exportEntries,
  exportCategory,
  importFromFile,
};
