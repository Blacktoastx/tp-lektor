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
    return { pageLabel: "Montagefläche", pageSortKey: UNPLACED_SORT_KEY + 1, isOnPasteboard: true };
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
      // Text auf der Montagefläche gehört nicht zum Druckdokument und wird nicht geprüft.
      if (location.isOnPasteboard || !isInRange(location, range)) continue;
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

// ---------- Nur Auswahl ----------

const TEXT_SELECTION_TYPES = ["Character", "Word", "Line", "Paragraph", "Text", "TextStyleRange", "TextColumn"];
const FRAME_TYPES = ["TextFrame", "TextPath"];

const addEntry = (entries, text, paragraph, area) => {
  const location = locate(paragraph);
  if (location.isOnPasteboard) return;
  entries.push({
    id: `P${entries.length + 1}`,
    text,
    paragraph,
    area,
    pageLabel: location.pageLabel,
    pageSortKey: location.pageSortKey,
  });
};

// Markierter Text: nur der markierte Teil jedes Absatzes wird geprüft, nicht der ganze Absatz.
const addMarkedText = (entries, textObject) => {
  const paragraphs = elementsOf(textObject.paragraphs);
  const pieces = String(textObject.contents).split("\r");
  paragraphs.forEach((paragraph, index) => {
    const text = cleanText(pieces[index] || "");
    if (text) addEntry(entries, text, paragraph, "Auswahl");
  });
};

// Ganzer Rahmen: nur der Text, der in diesem Rahmen steht (bei verketteten Rahmen nicht der Rest der Story).
const addFrameText = (entries, frame) => {
  const frameText = frame.texts.item(0);
  for (const paragraph of elementsOf(frameText.paragraphs)) {
    const text = cleanText(paragraph.contents);
    if (text) addEntry(entries, text, paragraph, "Text");
  }
  for (const table of elementsOf(frameText.tables)) {
    for (const cell of elementsOf(table.cells)) {
      for (const paragraph of elementsOf(cell.paragraphs)) {
        const text = cleanText(paragraph.contents);
        if (text) addEntry(entries, text, paragraph, "Tabelle");
      }
    }
  }
};

const addCells = (entries, cells) => {
  for (const cell of cells) {
    for (const paragraph of elementsOf(cell.paragraphs)) {
      const text = cleanText(paragraph.contents);
      if (text) addEntry(entries, text, paragraph, "Tabelle");
    }
  }
};

const addSelectionItem = (entries, item) => {
  const type = item.constructorName;
  if (TEXT_SELECTION_TYPES.includes(type)) {
    addMarkedText(entries, item);
  } else if (type === "InsertionPoint") {
    // Nur der Cursor steht im Text: dann gilt der Rahmen, in dem er steht.
    const frames = item.parentTextFrames;
    if (frames && frames.length > 0) addFrameText(entries, frames[0]);
  } else if (FRAME_TYPES.includes(type)) {
    addFrameText(entries, item);
  } else if (type === "Cell") {
    addCells(entries, elementsOf(item.cells));
  } else if (type === "Table") {
    addCells(entries, elementsOf(item.cells));
  } else if (item.allPageItems) {
    // Gruppen und andere Container: alle Textrahmen darin.
    for (const child of item.allPageItems) {
      if (FRAME_TYPES.includes(child.constructorName)) addFrameText(entries, child);
    }
  }
};

const paragraphKey = (paragraph) => {
  try {
    return `${paragraph.parentStory.id}:${paragraph.index}`;
  } catch {
    return "";
  }
};

const collectSelection = () => {
  const selection = app.selection || [];
  if (selection.length === 0) {
    throw new Error("Nichts ausgewählt. Bitte Text markieren oder einen Textrahmen auswählen.");
  }
  const entries = [];
  for (const item of selection) addSelectionItem(entries, item);
  // Derselbe Absatz kann über zwei ausgewählte Rahmen doppelt hereinkommen.
  const seen = new Set();
  const unique = entries.filter((entry) => {
    const key = `${paragraphKey(entry.paragraph)}|${entry.text}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  unique.sort((a, b) => a.pageSortKey - b.pageSortKey);
  unique.forEach((entry, index) => {
    entry.id = `P${index + 1}`;
  });
  return unique;
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
  collectSelection,
  splitIntoChunks,
  getActiveDocument,
  findActiveDocument,
  resolvePageRange,
  cleanText,
};
