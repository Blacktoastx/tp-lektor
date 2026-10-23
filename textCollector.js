const { app } = require("indesign");

// InDesign-Marker (Anker, Fußnotenzeichen, Seitenzahlen, Tabellenplatzhalter …) liegen im Steuerzeichenbereich.
const INDESIGN_MARKERS = /[﻿\u0000-\u0008\u000B\u000C\u000E-\u001F]/g;
const UNPLACED_SORT_KEY = 1e9;

const elementsOf = (collection) =>
  collection.length > 0 ? collection.everyItem().getElements() : [];

const cleanText = (contents) =>
  String(contents).replace(INDESIGN_MARKERS, "").replace(/\r$/, "").trim();

const locate = (textObject) => {
  const frames = textObject.parentTextFrames;
  if (!frames || frames.length === 0) {
    return { pageLabel: "Übersatz", pageSortKey: UNPLACED_SORT_KEY + 2 };
  }
  const page = frames[0].parentPage;
  if (!page) {
    return { pageLabel: "Montagefläche", pageSortKey: UNPLACED_SORT_KEY + 1 };
  }
  if (page.parent.constructorName === "MasterSpread") {
    return { pageLabel: `Musterseite ${page.parent.name}`, pageSortKey: UNPLACED_SORT_KEY };
  }
  return { pageLabel: page.name, pageSortKey: page.documentOffset, isOnPage: true };
};

const isInRange = (location, range) =>
  !range || (location.isOnPage && location.pageSortKey >= range.from && location.pageSortKey <= range.to);

// range: { from, to } als 0-basierter documentOffset oder null für das ganze Dokument.
const collectParagraphs = (doc, range) => {
  const entries = [];

  const addParagraphs = (paragraphs, area, fixedLocation) => {
    for (const paragraph of elementsOf(paragraphs)) {
      const text = cleanText(paragraph.contents);
      if (!text) continue;
      const location = fixedLocation || locate(paragraph);
      if (!isInRange(location, range)) continue;
      entries.push({
        id: `P${entries.length + 1}`,
        text,
        paragraph,
        area,
        pageLabel: location.pageLabel,
        pageSortKey: location.pageSortKey,
      });
    }
  };

  for (const story of elementsOf(doc.stories)) {
    addParagraphs(story.paragraphs, "Text");

    for (const table of elementsOf(story.tables)) {
      const tableLocation = locate(table.storyOffset);
      for (const cell of elementsOf(table.cells)) {
        addParagraphs(cell.paragraphs, "Tabelle", tableLocation);
      }
    }

    for (const footnote of elementsOf(story.footnotes)) {
      addParagraphs(footnote.paragraphs, "Fußnote", locate(footnote.storyOffset));
    }
  }

  return entries.sort((a, b) => a.pageSortKey - b.pageSortKey);
};

const splitIntoChunks = (entries, maxChars) => {
  const chunks = [];
  let current = [];
  let currentSize = 0;
  for (const entry of entries) {
    if (current.length > 0 && currentSize + entry.text.length > maxChars) {
      chunks.push(current);
      current = [];
      currentSize = 0;
    }
    current.push(entry);
    currentSize += entry.text.length;
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
};

const getActiveDocument = () => {
  if (app.documents.length === 0) {
    throw new Error("Kein Dokument geöffnet.");
  }
  return app.activeDocument;
};

const findActiveDocument = () => (app.documents.length > 0 ? app.activeDocument : null);

const resolvePageOffset = (doc, value) => {
  const page = doc.pages.itemByName(value);
  if (page.isValid) return page.documentOffset;
  const number = Number(value);
  if (Number.isInteger(number) && number >= 1 && number <= doc.pages.length) return number - 1;
  throw new Error(`Seite „${value}“ gibt es in diesem Dokument nicht.`);
};

// Leere Felder bedeuten: ganzes Dokument bzw. bis zum Anfang/Ende.
const resolvePageRange = (doc, fromValue, toValue) => {
  if (!fromValue && !toValue) return null;
  const from = fromValue ? resolvePageOffset(doc, fromValue) : 0;
  const to = toValue ? resolvePageOffset(doc, toValue) : doc.pages.length - 1;
  if (from > to) throw new Error("„Von“ muss vor „Bis“ liegen.");
  return {
    from,
    to,
    fromLabel: doc.pages.item(from).name,
    toLabel: doc.pages.item(to).name,
  };
};

module.exports = {
  collectParagraphs,
  splitIntoChunks,
  getActiveDocument,
  findActiveDocument,
  resolvePageRange,
  cleanText,
};
