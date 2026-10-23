// Alle Prüfdaten liegen als Label im Dokument selbst. Wer die .indd-Datei öffnet,
// sieht dieselben offenen Fehler, bearbeiteten Fehler und dieselbe Historie.
const LABEL_KEY = "de.tpmarketing.tplektor.data";
const LEGACY_LABEL_KEY = "de.tpmarketing.korrektor.history";

const emptyData = () => ({ version: 2, runs: [], findings: [], events: [], ignoredKeys: [] });

const migrateLegacy = (legacy) => {
  const data = emptyData();
  data.ignoredKeys = legacy.ignoredKeys || [];
  for (const run of legacy.runs || []) {
    const { events = [], ...runData } = run;
    data.runs.push({ ...runData, user: "", checks: ["orthography"], range: null, usage: null });
    for (const event of events) data.events.push({ ...event, user: "", runId: run.id });
  }
  return data;
};

const parse = (raw) => {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const load = (doc) => {
  const current = parse(doc.extractLabel(LABEL_KEY));
  if (current) return { ...emptyData(), ...current };
  const legacy = parse(doc.extractLabel(LEGACY_LABEL_KEY));
  return legacy ? migrateLegacy(legacy) : emptyData();
};

const save = (doc, data) => doc.insertLabel(LABEL_KEY, JSON.stringify(data));

const findingKey = (finding) => `${finding.original}|${finding.korrektur}|${finding.contextCore}`;

const isInScope = (finding, scope) =>
  scope.checks.includes(finding.check) &&
  (!scope.range || (finding.pageSortKey >= scope.range.from && finding.pageSortKey <= scope.range.to));

// Eine neue Prüfung ersetzt die offenen Fehler, die sie selbst abdeckt (gleiche Funktionen, gleicher Seitenbereich).
// Bei abgebrochenen Prüfungen bleibt alles Alte stehen, es kommen nur neue Funde dazu.
const addRun = (doc, run, newFindings, replaceScope) => {
  const data = load(doc);
  const ignored = new Set(data.ignoredKeys);
  if (replaceScope) {
    data.findings = data.findings.filter(
      (finding) => finding.status !== "open" || !isInScope(finding, replaceScope)
    );
  }
  const openKeys = new Set(
    data.findings.filter((finding) => finding.status === "open").map(findingKey)
  );
  const accepted = newFindings.filter((finding) => {
    const key = findingKey(finding);
    return !ignored.has(key) && !openKeys.has(key);
  });
  data.runs.push({ ...run, findingsCount: accepted.length, hiddenCount: newFindings.length - accepted.length });
  data.findings.push(...accepted);
  save(doc, data);
  return data;
};

const DEFAULT_ACTIONS = {
  applied: "übernommen",
  ignored: "ignoriert",
  open: "wieder geöffnet",
};

// Ändert einen oder mehrere Fehler in einem Rutsch, damit das Dokument-Label nur einmal geschrieben wird.
const updateFindingsStatus = (doc, findingIds, status, user, extra = {}, action = DEFAULT_ACTIONS[status]) => {
  const data = load(doc);
  const ids = new Set(findingIds);
  const findings = data.findings.filter((candidate) => ids.has(candidate.id));
  if (findings.length === 0) throw new Error("Dieser Fehler existiert nicht mehr. Bitte neu prüfen.");

  const now = new Date().toISOString();
  for (const finding of findings) {
    Object.assign(finding, extra, {
      status,
      doneAt: status === "open" ? null : now,
      doneBy: status === "open" ? null : user,
    });

    data.events.push({
      at: now,
      user,
      action,
      runId: finding.runId,
      findingId: finding.id,
      pageLabel: finding.pageLabel,
      typ: finding.typ,
      original: finding.original,
      korrektur: finding.korrektur,
    });

    const key = findingKey(finding);
    data.ignoredKeys = data.ignoredKeys.filter((ignoredKey) => ignoredKey !== key);
    if (status === "ignored") data.ignoredKeys.push(key);
  }

  save(doc, data);
  return findings.length;
};

const updateFindingStatus = (doc, findingId, status, user, extra) =>
  updateFindingsStatus(doc, [findingId], status, user, extra);

const clear = (doc) => {
  save(doc, emptyData());
  if (doc.extractLabel(LEGACY_LABEL_KEY)) doc.insertLabel(LEGACY_LABEL_KEY, "");
};

module.exports = { load, addRun, updateFindingStatus, updateFindingsStatus, clear };
