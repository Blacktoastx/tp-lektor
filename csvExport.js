const { localFileSystem, formats } = require("uxp").storage;
const { formatDateTime } = require("./format");

const STATUS_LABELS = { open: "Offen", applied: "Übernommen", ignored: "Ignoriert" };

const COLUMNS = [
  ["Seite", (finding) => finding.pageLabel],
  ["Bereich", (finding) => finding.area],
  ["Typ", (finding) => finding.typ],
  ["Fehler", (finding) => finding.original],
  ["Korrektur", (finding) => finding.korrektur],
  ["Erklärung", (finding) => finding.erklaerung],
  ["Kontext", (finding) => finding.contextCore],
  ["Status", (finding) => STATUS_LABELS[finding.status]],
  ["Bearbeitet von", (finding) => finding.doneBy || ""],
  ["Bearbeitet am", (finding) => (finding.doneAt ? formatDateTime(finding.doneAt) : "")],
];

const quote = (value) => `"${String(value).replace(/"/g, '""')}"`;

// Semikolon und BOM, damit ein deutsches Excel die Datei direkt korrekt öffnet.
const toCsv = (findings) =>
  [
    COLUMNS.map(([title]) => quote(title)).join(";"),
    ...findings.map((finding) => COLUMNS.map(([, read]) => quote(read(finding))).join(";")),
  ].join("\r\n");

const exportCsv = async (findings, documentName) => {
  const baseName = documentName.replace(/\.indd$/i, "");
  const file = await localFileSystem.getFileForSaving(`${baseName} – TP Lektor.csv`, {
    types: ["csv"],
  });
  if (!file) return null;
  await file.write("﻿" + toCsv(findings), { format: formats.utf8 });
  return file.name;
};

module.exports = { exportCsv };
