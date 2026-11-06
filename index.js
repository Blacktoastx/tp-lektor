// Startfehler sichtbar im Panel anzeigen, damit ein leeres Panel nie ohne Hinweis bleibt.
// Steht bewusst vor allen require-Aufrufen, damit auch Fehler beim Laden der Module erfasst werden.
let bootStatusElement = null;

const reportBootError = (message) => {
  const box = bootStatusElement || document.getElementById("bootStatus");
  if (!box) return;
  box.style.display = "block";
  box.style.color = "#ff6b6b";
  box.textContent = `TP Lektor – Fehler beim Start: ${message}`;
};

try {
  window.addEventListener("error", (event) => reportBootError(event.message || String(event.error)));
  window.addEventListener("unhandledrejection", (event) =>
    reportBootError((event.reason && event.reason.message) || String(event.reason))
  );
} catch {
  // Ohne globale Fehler-Events bleibt die Startanzeige als Hinweis stehen.
}

const { entrypoints, versions } = require("uxp");
const {
  collectParagraphs,
  collectSelection,
  splitIntoChunks,
  getActiveDocument,
  findActiveDocument,
  resolvePageRange,
} = require("./textCollector");
const { checkChunk, verifyApiKey } = require("./openai");
const { checkForType } = require("./checks");
const { MODEL_OPTIONS, EFFORT_OPTIONS } = require("./models");
const { showFinding, applyCorrection } = require("./documentActions");
const { exportCsv, saveTextFile } = require("./csvExport");
const {
  renderFindings,
  renderLoading,
  renderHistory,
  createFindingType,
  createChange,
  createCleanState,
} = require("./views");
const colors = require("./colors");
const { renderDictionary } = require("./dictionaryView");
const dictionary = require("./dictionary");
const { runDinRules } = require("./dinRules");
const languages = require("./languages");
const { computeStats } = require("./stats");
const updater = require("./updater");
const { formatPage } = require("./format");
const store = require("./store");
const settings = require("./settings");

const MAX_CHARS_PER_REQUEST = 6000;
const PARALLEL_REQUESTS = 3;
const CONTEXT_RADIUS = 40;
const NOTICE_DURATION_MS = 5000;

const dictionaryView = { selection: new Set(), pendingDeleteId: null };

const state = {
  apiKey: "",
  activeTab: "open",
  running: false,
  cancelled: false,
  loading: null,
  shownDocumentId: null,
};

// InDesign hängt den Panel-Inhalt in einen eigenen Knoten, darum wird innerhalb dieser Wurzel gesucht.
const roots = [];

const captureRoots = () => {
  if (roots.length > 0) return;
  roots.push($root("mainRoot"));
  bootStatusElement = roots[0].querySelector("#bootStatus");
};

const $root = (id) => document.getElementById(id);

const $ = (id) => {
  for (const root of roots) {
    const element = root.id === id ? root : root.querySelector(`#${id}`);
    if (element) return element;
  }
  return document.getElementById(id);
};

const $$ = (selector) => roots.flatMap((root) => Array.from(root.querySelectorAll(selector)));

// ---------- Allgemeine Helfer ----------

const showScreen = (name) => {
  for (const screen of $$(".screen")) {
    screen.className = screen.id === `screen-${name}` ? "screen visible" : "screen";
  }
};

const noticeTimers = {};
// Die Statuszeile unten in der Hauptansicht bleibt stehen, bis die nächste Meldung kommt.
const STATUS_BAR_ID = "notice";

const showNotice = (message, kind = "info", elementId = "notice") => {
  const notice = $(elementId);
  notice.textContent = message;
  notice.title = message;
  if (elementId === STATUS_BAR_ID) {
    notice.className = `status-bar ${kind}`;
    return;
  }
  notice.className = `notice visible ${kind}`;
  clearTimeout(noticeTimers[elementId]);
  if (kind === "info") {
    noticeTimers[elementId] = setTimeout(() => {
      notice.className = "notice";
    }, NOTICE_DURATION_MS);
  }
};

const hideNotice = (elementId = "notice") => {
  if (elementId === STATUS_BAR_ID) {
    $(elementId).textContent = "";
    $(elementId).className = "status-bar";
    return;
  }
  $(elementId).className = "notice";
};

const runSafely = (action, elementId = "notice") => async () => {
  try {
    await action();
  } catch (error) {
    showNotice(error.message, "error", elementId);
  }
};

const currentUser = () => settings.loadPreferences().userName || "Unbekannt";

// ---------- Hauptansicht ----------

const updateTabs = (data) => {
  const open = data ? data.findings.filter((finding) => finding.status === "open").length : 0;
  const labels = { open: `Offen (${open})`, done: "Bearbeitet", history: "Historie", dictionary: "Wörterbuch" };
  for (const tab of $$(".tab")) {
    if (tab.dataset.tab !== "dictionary") tab.textContent = labels[tab.dataset.tab];
    const iconClass = tab.dataset.tab === "dictionary" ? " tab-icon" : "";
    tab.className = `tab${iconClass}${tab.dataset.tab === state.activeTab ? " active" : ""}`;
  }
};

const sortByPage = (findings) =>
  [...findings].sort((a, b) => a.pageSortKey - b.pageSortKey || a.order - b.order);

const render = () => {
  renderFocus();
  if (state.running) return;
  const doc = findActiveDocument();
  const data = doc ? store.load(doc) : null;
  state.shownDocumentId = doc ? doc.id : null;
  updateTabs(data);

  // Beim Bearbeiten im selben Reiter die Scrollposition halten, bei einem Reiterwechsel nach oben springen.
  const container = $("content");
  const keepScroll = state.renderedTab === state.activeTab;
  const previousScroll = container.scrollTop;
  state.renderedTab = state.activeTab;
  container.innerHTML = "";
  container.scrollTop = 0;
  const restoreScroll = () => {
    if (keepScroll) container.scrollTop = previousScroll;
  };

  if (state.activeTab === "dictionary") {
    renderDictionary(container, dictionary.load(), { ...dictionaryView, targetCategoryId: targetCategoryId() }, dictionaryHandlers);
    restoreScroll();
    return;
  }

  if (!data) {
    renderFindings(container, [], {}, "Öffne ein Dokument, um es zu prüfen.");
    return;
  }

  if (state.activeTab === "history") {
    renderHistory(container, data, computeStats(data), runSafely(exportFindings), historyLogHandlers);
    restoreScroll();
    return;
  }

  if (state.activeTab === "open") {
    const open = sortByPage(data.findings.filter((finding) => finding.status === "open"));
    const emptyText = data.runs.length > 0 ? createCleanState(data.runs) : "Noch keine Prüfung durchgeführt.";
    renderFindings(container, open, findingHandlers, emptyText);
    restoreScroll();
    return;
  }

  const done = sortByPage(data.findings.filter((finding) => finding.status !== "open"));
  renderFindings(container, done, findingHandlers, "Noch nichts bearbeitet.");
  restoreScroll();
};

const changeFindingStatus = (finding, status, extra) => {
  store.updateFindingStatus(getActiveDocument(), finding.id, status, currentUser(), extra);
  render();
};

const sameOpenFindings = (doc, finding) =>
  store.load(doc).findings.filter((candidate) => candidate.status === "open" && candidate.original === finding.original);

const ignoreAllLike = (finding) => {
  const doc = getActiveDocument();
  const count = store.updateFindingsStatus(
    doc,
    sameOpenFindings(doc, finding).map((candidate) => candidate.id),
    "ignored",
    currentUser()
  );
  render();
  return count;
};

const addFindingToDictionary = (finding) => {
  const { term, category, added } = dictionary.addEntry(finding.original, targetCategoryId(), currentUser());
  const doc = getActiveDocument();
  const coveredIds = store
    .load(doc)
    .findings.filter((candidate) => candidate.status === "open" && dictionary.isCoveredByDictionary(candidate, [term]))
    .map((candidate) => candidate.id);
  if (coveredIds.length > 0) {
    store.updateFindingsStatus(doc, coveredIds, "ignored", currentUser(), {}, "ins Wörterbuch");
  }
  render();
  const status = added ? "hinzugefügt" : "war schon enthalten";
  return `„${term}“ ${status} (Wörterbuch „${category.name}“). ${coveredIds.length} offene Stellen ausgeblendet.`;
};

const findingHandlers = {
  countSame: (finding) => {
    const doc = findActiveDocument();
    return doc ? sameOpenFindings(doc, finding).length : 0;
  },
  onIgnoreAll: (finding) =>
    runSafely(() => {
      const count = ignoreAllLike(finding);
      showNotice(`${count}× „${finding.original}“ ignoriert.`);
    })(),
  onAddToDictionary: (finding) => runSafely(() => showNotice(addFindingToDictionary(finding)))(),
  onShow: (finding) => runSafely(() => showFinding(getActiveDocument(), finding))(),
  onApply: (finding) =>
    runSafely(() => {
      applyCorrection(getActiveDocument(), finding);
      const contextAfter = finding.contextCore.replace(finding.original, finding.korrektur);
      changeFindingStatus(finding, "applied", { contextAfter });
      showNotice(`„${finding.original}“ → „${finding.korrektur}“ übernommen.`);
    })(),
  onIgnore: (finding) =>
    runSafely(() => {
      changeFindingStatus(finding, "ignored");
      showNotice(`„${finding.original}“ ignoriert. Künftige Prüfungen blenden diese Stelle aus.`);
    })(),
  onReopen: (finding) =>
    runSafely(() => {
      changeFindingStatus(finding, "open");
      showNotice(`„${finding.original}“ ist wieder offen.`);
    })(),
};

const formatLogAsText = (run, log) =>
  [
    `TP Lektor – Prüfprotokoll vom ${new Date(run.startedAt).toLocaleString()}`,
    `Modell: ${log.model} · Gründlichkeit: ${log.effort} · Anfragen: ${log.exchanges.length} von ${log.totalRequests}`,
    "",
    "=== SYSTEM-PROMPT ===",
    log.system,
    ...log.exchanges.flatMap((exchange) => [
      "",
      `=== ANFRAGE ${exchange.index + 1} · ${exchange.usage.input} Eingabe- / ${exchange.usage.output} Ausgabe-Tokens ===`,
      "--- Gesendet ---",
      exchange.user,
      "--- Antwort ---",
      exchange.response,
    ]),
  ].join("\n");

const historyLogHandlers = {
  loadLog: (runId) => store.loadRunLog(getActiveDocument(), runId),
  onSaveLog: (run) =>
    runSafely(async () => {
      const log = store.loadRunLog(getActiveDocument(), run.id);
      if (!log) throw new Error("Für diese Prüfung ist kein Protokoll mehr gespeichert.");
      const fileName = await saveTextFile(`TP Lektor Protokoll ${run.id}.txt`, formatLogAsText(run, log));
      if (fileName) showNotice(`Gespeichert: ${fileName}`);
    })(),
};

const exportFindings = async () => {
  const doc = getActiveDocument();
  const fileName = await exportCsv(sortByPage(store.load(doc).findings), doc.name);
  if (fileName) showNotice(`Exportiert: ${fileName}`);
};

// ---------- Wörterbuch ----------

const targetCategoryId = () => {
  const { dictionaryCategory } = settings.loadPreferences();
  const exists = dictionary.load().categories.some((category) => category.id === dictionaryCategory);
  return exists ? dictionaryCategory : dictionary.DEFAULT_CATEGORY_ID;
};

const dictionaryHandlers = {
  defaultCategoryId: dictionary.DEFAULT_CATEGORY_ID,
  onToggleCategory: (categoryId, active) => {
    dictionary.setCategoryActive(categoryId, active);
    render();
  },
  onDeleteCategory: (categoryId) =>
    runSafely(() => {
      if (dictionaryView.pendingDeleteId !== categoryId) {
        dictionaryView.pendingDeleteId = categoryId;
        render();
        return;
      }
      dictionaryView.pendingDeleteId = null;
      dictionary.deleteCategory(categoryId);
      render();
      showNotice("Kategorie gelöscht.");
    })(),
  onExportCategory: (categoryId) =>
    runSafely(async () => {
      const fileName = await dictionary.exportCategory(categoryId);
      if (fileName) showNotice(`Exportiert: ${fileName}`);
    })(),
  onAddCategory: (name, input) =>
    runSafely(() => {
      const category = dictionary.addCategory(name);
      settings.savePreferences({ dictionaryCategory: category.id });
      input.value = "";
      render();
      showNotice(`Kategorie „${category.name}“ angelegt.`);
    })(),
  onSetTarget: (categoryId) => {
    settings.savePreferences({ dictionaryCategory: categoryId });
  },
  onAddWord: (text, input) =>
    runSafely(() => {
      const { term, category, added } = dictionary.addEntry(text, targetCategoryId(), currentUser());
      input.value = "";
      render();
      showNotice(added ? `„${term}“ zu „${category.name}“ hinzugefügt.` : `„${term}“ ist schon in „${category.name}“.`);
    })(),
  onToggleSelect: (entryId, checked) => {
    if (checked) dictionaryView.selection.add(entryId);
    else dictionaryView.selection.delete(entryId);
    render();
  },
  onSelectAll: (selectAll) => {
    dictionaryView.selection = new Set(selectAll ? dictionary.load().entries.map((entry) => entry.id) : []);
    render();
  },
  onExportSelection: () =>
    runSafely(async () => {
      const fileName = await dictionary.exportEntries([...dictionaryView.selection]);
      if (fileName) showNotice(`Exportiert: ${fileName}`);
    })(),
  onDeleteSelection: () =>
    runSafely(() => {
      if (dictionaryView.selection.size === 0) throw new Error("Bitte zuerst Wörter auswählen.");
      const count = dictionaryView.selection.size;
      dictionary.removeEntries([...dictionaryView.selection]);
      dictionaryView.selection.clear();
      render();
      showNotice(`${count} ${count === 1 ? "Wort" : "Wörter"} gelöscht.`);
    })(),
  onImport: () =>
    runSafely(async () => {
      const result = await dictionary.importFromFile(currentUser());
      if (!result) return;
      render();
      showNotice(
        `${result.fileName}: ${result.addedWords} neue Wörter, ${result.addedCategories} neue Kategorien importiert.`
      );
    })(),
};

// ---------- Fehler-Navigator ----------

const focusState = { findingId: null, index: 0 };

const openFindingsOf = (doc) =>
  sortByPage(store.load(doc).findings.filter((finding) => finding.status === "open"));

const setButtonEnabled = (id, enabled) => {
  const button = $(id);
  button.className = button.className.replace(" disabled", "") + (enabled ? "" : " disabled");
};

const currentFocusFinding = () => {
  const doc = findActiveDocument();
  if (!doc) return { doc: null, open: [], index: -1 };
  const open = openFindingsOf(doc);
  let index = open.findIndex((finding) => finding.id === focusState.findingId);
  // Wurde der aktuelle Fehler gerade bearbeitet, rückt der nächste an seine Stelle.
  if (index === -1) index = Math.min(focusState.index, open.length - 1);
  focusState.index = Math.max(index, 0);
  focusState.findingId = index >= 0 ? open[index].id : null;
  return { doc, open, index };
};

const createFocusContent = (finding) => {
  const fragment = document.createElement("div");
  const type = createFindingType(finding);
  const change = createChange(finding.original, finding.korrektur);
  const explanation = document.createElement("div");
  explanation.className = "explanation";
  explanation.textContent = finding.erklaerung;
  fragment.appendChild(type);
  fragment.appendChild(change);
  fragment.appendChild(explanation);
  return fragment;
};

const renderFocus = () => {
  if (roots.length === 0) return;
  const { doc, open, index } = currentFocusFinding();
  const body = $("focusBody");
  body.innerHTML = "";

  const hasFinding = index >= 0;
  setButtonEnabled("focusPrev", open.length > 1);
  setButtonEnabled("focusNext", open.length > 1);
  setButtonEnabled("focusApply", hasFinding);
  setButtonEnabled("focusIgnore", hasFinding);
  setButtonEnabled("focusDictionary", hasFinding);
  const sameCount = hasFinding ? open.filter((finding) => finding.original === open[index].original).length : 0;
  $("focusIgnoreAll").style.display = sameCount > 1 ? "block" : "none";
  $("focusIgnoreAll").textContent = `Alle ignorieren (${sameCount})`;

  if (!hasFinding) {
    $("focusCounter").textContent = "0 / 0";
    $("focusPage").textContent = "";
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = doc
      ? "Keine offenen Fehler. Prüfe zuerst das Dokument in der großen Ansicht."
      : "Öffne ein Dokument.";
    body.appendChild(empty);
    return;
  }

  const finding = open[index];
  $("focusCounter").textContent = `${index + 1} / ${open.length}`;
  $("focusPage").textContent = formatPage(finding.pageLabel);
  body.appendChild(createFocusContent(finding));
};

const showFocusedInDocument = () => {
  const { doc, open, index } = currentFocusFinding();
  if (index < 0) return;
  try {
    showFinding(doc, open[index]);
  } catch (error) {
    showNotice(error.message, "error", "focusNotice");
  }
};

const moveFocus = (delta) => {
  const { open, index } = currentFocusFinding();
  if (open.length < 2) return;
  const next = (index + delta + open.length) % open.length;
  focusState.index = next;
  focusState.findingId = open[next].id;
  hideNotice("focusNotice");
  renderFocus();
  showFocusedInDocument();
};

const handleFocusAction = (status) =>
  runSafely(() => {
    const { doc, open, index } = currentFocusFinding();
    if (index < 0) return;
    const finding = open[index];
    hideNotice("focusNotice");
    if (status === "applied") {
      applyCorrection(doc, finding);
      const contextAfter = finding.contextCore.replace(finding.original, finding.korrektur);
      changeFindingStatus(finding, "applied", { contextAfter });
    } else if (status === "ignoredAll") {
      if (findingHandlers.countSame(finding) < 2) return;
      ignoreAllLike(finding);
    } else if (status === "dictionary") {
      showNotice(addFindingToDictionary(finding), "info", "focusNotice");
    } else {
      changeFindingStatus(finding, "ignored");
    }
    showFocusedInDocument();
  }, "focusNotice");

const bindFocusEvents = () => {
  $("focusPrev").addEventListener("click", () => moveFocus(-1));
  $("focusNext").addEventListener("click", () => moveFocus(1));
  $("focusApply").addEventListener("click", handleFocusAction("applied"));
  $("focusIgnore").addEventListener("click", handleFocusAction("ignored"));
  $("focusIgnoreAll").addEventListener("click", handleFocusAction("ignoredAll"));
  $("focusDictionary").addEventListener("click", handleFocusAction("dictionary"));
};

// InDesign kann mehrere Panels pro UXP-Plugin nicht zuverlässig auseinanderhalten (vertauschte Namen und Inhalte).
// Der Navigator ist darum eine kompakte Ansicht im selben Panel, das man dafür einfach klein zieht.
const openNavigator = () => {
  if (state.running) return;
  hideNotice("focusNotice");
  showScreen("navigator");
  renderFocus();
  showFocusedInDocument();
};

const closeNavigator = () => {
  showScreen("main");
  render();
};

// ---------- Prüfung ----------

const buildContextCore = (text, original) => {
  const index = text.indexOf(original);
  return text.slice(Math.max(0, index - CONTEXT_RADIUS), index + original.length + CONTEXT_RADIUS);
};

const SPACE_VARIANTS = /[\u0020\u00A0\u2000-\u200A\u202F\u205F]/g;
const normalizeSpaces = (text) => text.replace(SPACE_VARIANTS, " ");
const removeDashSpaces = (text) => normalizeSpaces(text).replace(/ *– */g, "–");

// Feste Sicherung gegen bekannte Fehlgriffe des Modells: Nach DIN 5008 steht der Halbgeviertstrich
// mit Leerzeichen, und die bloße Art des Leerzeichens ist kein Fehler.
// Hausregel: Preise wie „45,- €“ behalten den Bindestrich, kein Halbgeviertstrich.
const changesPriceDash = (raw) => /\d,-/.test(raw.original) && !/\d,-/.test(raw.korrektur);

// Im Englischen steht der Bis-Strich ohne Leerzeichen; dort darf das Modell sie entfernen.
const contradictsDin5008 = (raw, language) => {
  if (changesPriceDash(raw)) return true;
  const onlySpaceKindChanged = normalizeSpaces(raw.original) === normalizeSpaces(raw.korrektur);
  const removesDashSpaces =
    language !== "en" &&
    raw.original.includes("–") &&
    removeDashSpaces(raw.original) === removeDashSpaces(raw.korrektur) &&
    normalizeSpaces(raw.korrektur).length < normalizeSpaces(raw.original).length;
  return onlySpaceKindChanged || removesDashSpaces;
};

// Das Modell kann Fehler erfinden oder IDs verwechseln – nur Funde behalten, die wirklich im Absatz stehen.
const verifyFindings = (rawFindings, entriesById, runId, createdAt) => {
  const seen = new Set();
  const verified = [];
  for (const raw of rawFindings) {
    const entry = entriesById.get(raw.id);
    const isValid =
      entry && raw.original && raw.original !== raw.korrektur && entry.text.includes(raw.original);
    const key = `${raw.id}|${raw.original}|${raw.korrektur}`;
    if (!isValid || seen.has(key) || contradictsDin5008(raw, entry.language)) continue;
    seen.add(key);
    verified.push({
      id: `${runId}-${raw.id}-${verified.length}`,
      runId,
      check: checkForType(raw.typ),
      typ: raw.typ,
      area: entry.area,
      pageLabel: entry.pageLabel,
      pageSortKey: entry.pageSortKey,
      order: Number(raw.id.slice(1)),
      original: raw.original,
      korrektur: raw.korrektur,
      erklaerung: raw.erklaerung,
      hint: Boolean(raw.hint),
      ruleId: raw.ruleId || null,
      contextCore: buildContextCore(entry.text, raw.original),
      contextAfter: null,
      status: "open",
      createdAt,
      doneAt: null,
      doneBy: null,
    });
  }
  return verified;
};

const runWithConcurrency = async (tasks, limit) => {
  let next = 0;
  const worker = async () => {
    while (next < tasks.length && !state.cancelled) {
      const task = tasks[next++];
      await task();
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const setCheckButtonBusy = (busy) => {
  $("btnCheck").className = busy ? "btn-check disabled" : "btn-check";
  $("btnCheckLabel").textContent = busy ? "Prüfung läuft …" : "Dokument prüfen";
};

const startLoading = () => {
  const container = $("content");
  container.innerHTML = "";
  state.loading = renderLoading(container, () => {
    state.cancelled = true;
    state.loading.setMessage("Wird abgebrochen, sobald die laufenden Anfragen fertig sind …");
  });
};

const checkDocument = async () => {
  if (state.running) return;
  hideNotice();
  const preferences = settings.loadPreferences();
  if (preferences.checks.length === 0) throw new Error("Bitte mindestens eine Funktion auswählen.");
  const doc = getActiveDocument();
  const onlySelection = preferences.onlySelection;
  const range = onlySelection ? null : resolvePageRange(doc, $("pageFrom").value.trim(), $("pageTo").value.trim());
  // Die Auswahl sofort lesen: Während der Prüfung kann der Nutzer schon etwas anderes anklicken.
  const selectionEntries = onlySelection ? collectSelection() : null;
  if (selectionEntries && selectionEntries.length === 0) {
    throw new Error("In der Auswahl wurde kein Text gefunden.");
  }

  state.running = true;
  state.cancelled = false;
  state.activeTab = "open";
  setCheckButtonBusy(true);
  startLoading();

  try {
    await wait(50); // UI zeichnen lassen, bevor das Einsammeln den Thread blockiert
    const entries = selectionEntries || collectParagraphs(doc, range);
    if (entries.length === 0) throw new Error("Im gewählten Bereich wurde kein Text gefunden.");
    languages.assignLanguages(entries, preferences.language);

    const runId = String(Date.now());
    const startedAt = new Date().toISOString();
    const entriesById = new Map(entries.map((entry) => [entry.id, entry]));
    const dictionaryTerms = dictionary.activeTerms();
    const chunks = splitIntoChunks(entries, MAX_CHARS_PER_REQUEST);
    const usage = { input: 0, output: 0 };
    const exchanges = [];
    let systemPrompt = "";
    const found = [];
    let done = 0;
    let rejected = 0;

    // Feste Typografie-Regeln (DIN 5008 bzw. englisch) laufen lokal und liefern bei gleichem Text immer dasselbe Ergebnis.
    if (preferences.checks.includes("typography")) {
      found.push(...verifyFindings(runDinRules(entries), entriesById, runId, startedAt));
    }

    state.loading.update(0, chunks.length, found.length);
    const tasks = chunks.map((chunk, chunkIndex) => async () => {
      const result = await checkChunk({
        apiKey: state.apiKey,
        model: preferences.model,
        effort: preferences.effort,
        checkKeys: preferences.checks,
        dictionaryTerms: dictionaryTerms.slice(0, 400),
        language: preferences.language,
        chunk,
      });
      const verified = verifyFindings(result.findings, entriesById, runId, startedAt);
      rejected += result.findings.length - verified.length;
      found.push(...verified);
      usage.input += result.usage.prompt_tokens;
      usage.output += result.usage.completion_tokens;
      systemPrompt = result.exchange.system;
      exchanges.push({
        index: chunkIndex,
        user: result.exchange.user,
        response: result.exchange.response,
        usage: { input: result.usage.prompt_tokens, output: result.usage.completion_tokens },
      });
      done++;
      state.loading.update(done, chunks.length, found.length);
    });
    await runWithConcurrency(tasks, PARALLEL_REQUESTS);

    // Was das Modell trotz Hinweis im Prompt meldet, filtert das Wörterbuch hier noch einmal heraus.
    const allowed = found.filter((finding) => !dictionary.isCoveredByDictionary(finding, dictionaryTerms));
    const dictionaryHidden = found.length - allowed.length;

    const run = {
      id: runId,
      startedAt,
      user: currentUser(),
      model: preferences.model,
      effort: preferences.effort,
      checks: preferences.checks,
      language: preferences.language,
      range: onlySelection ? { selection: true, paragraphs: entries.length } : range,
      pagesChecked: onlySelection
        ? new Set(entries.map((entry) => entry.pageLabel)).size
        : range
        ? range.to - range.from + 1
        : doc.pages.length,
      rejected,
      dictionaryHidden,
      usage,
      cancelled: state.cancelled,
    };
    // Bei „Nur Auswahl“ ersetzt die Prüfung nur offene Fehler, deren Textstelle im geprüften Text liegt.
    const scopeTexts = onlySelection ? entries.map((entry) => entry.text) : null;
    const replaceScope = state.cancelled ? null : { checks: preferences.checks, range, texts: scopeTexts };
    const log = {
      model: preferences.model,
      effort: preferences.effort,
      language: preferences.language,
      totalRequests: chunks.length,
      system: systemPrompt,
      exchanges: exchanges.sort((a, b) => a.index - b.index),
    };
    const shouldSaveLog = preferences.saveRunLogs && exchanges.length > 0;
    const data = store.addRun(doc, run, allowed, replaceScope, shouldSaveLog ? log : null);
    const savedRun = data.runs[data.runs.length - 1];

    const hidden = savedRun.hiddenCount > 0 ? ` ${savedRun.hiddenCount} waren schon bekannt oder ignoriert.` : "";
    const byDictionary = dictionaryHidden > 0 ? ` ${dictionaryHidden} durch das Wörterbuch ausgeblendet.` : "";
    showNotice(`${state.cancelled ? "Abgebrochen. " : ""}${savedRun.findingsCount} neue Fehler gefunden.${hidden}${byDictionary}`);
  } finally {
    state.loading.stop();
    state.loading = null;
    state.running = false;
    setCheckButtonBusy(false);
    render();
  }
};

// ---------- Funktionen & Seitenbereich ----------

const checkboxes = () => Array.from($$(".check-row input")).filter((checkbox) => checkbox.dataset.check);

const renderRangeState = (onlySelection) => {
  $("rangePanel").className = onlySelection ? "range inactive" : "range";
  $("pageFrom").disabled = onlySelection;
  $("pageTo").disabled = onlySelection;
};

const renderCheckToggles = () => {
  const { checks } = settings.loadPreferences();
  for (const checkbox of checkboxes()) checkbox.checked = checks.includes(checkbox.dataset.check);
  const { onlySelection } = settings.loadPreferences();
  $("check-selection").checked = onlySelection;
  renderRangeState(onlySelection);
};

const saveCheckToggles = () => {
  const checks = Array.from(checkboxes())
    .filter((checkbox) => checkbox.checked)
    .map((checkbox) => checkbox.dataset.check);
  const onlySelection = $("check-selection").checked;
  settings.savePreferences({ checks, onlySelection });
  renderRangeState(onlySelection);
};

const renderFunctionsCollapsed = () => {
  const { functionsCollapsed } = settings.loadPreferences();
  $("functionsPanel").className = functionsCollapsed ? "functions collapsed" : "functions";
  $("functionsChevron").setAttribute("data-icon", functionsCollapsed ? "chevron-right" : "chevron-down");
  applyThemeIcons();
};

// In UXP nimmt ein Klick auf eine normale Fläche einem Eingabefeld den Fokus nicht ab.
// Darum wird der Fokus hier selbst gelöst: bei einem Klick außerhalb eines Feldes und bei Enter.
const FIELD_TAGS = ["INPUT", "TEXTAREA", "SELECT"];

const blurActiveField = () => {
  const active = document.activeElement;
  if (active && FIELD_TAGS.includes(active.tagName)) active.blur();
};

const bindFieldBlur = () => {
  const [root] = roots;
  root.addEventListener("mousedown", (event) => {
    if (!FIELD_TAGS.includes(event.target.tagName)) blurActiveField();
  });
  for (const input of [$("pageFrom"), $("pageTo")]) {
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") input.blur();
    });
  }
};

// ---------- Willkommen & Einrichtung ----------

const saveSetup = async () => {
  const userName = $("setupName").value.trim();
  const apiKey = $("setupApiKey").value.trim();
  if (!userName) throw new Error("Bitte gib deinen Namen ein.");
  if (!apiKey) throw new Error("Bitte gib deinen API-Key ein.");

  $("btnSetupSave").textContent = "Key wird geprüft …";
  try {
    await verifyApiKey(apiKey);
  } finally {
    $("btnSetupSave").textContent = "Speichern & starten";
  }
  await settings.saveApiKey(apiKey);
  settings.savePreferences({ userName });
  state.apiKey = apiKey;
  showScreen("main");
  render();
};

// ---------- Einstellungen ----------

const createOption = (option, isOn, onSelect) => {
  const row = document.createElement("div");
  row.className = isOn ? "option on" : "option";
  row.innerHTML = '<div class="toggle"><div class="toggle-dot"></div></div>';
  const text = document.createElement("div");
  text.className = "option-text";
  const label = document.createElement("span");
  label.textContent = option.label;
  const hint = document.createElement("span");
  hint.className = "option-hint";
  hint.textContent = option.hint;
  text.appendChild(label);
  text.appendChild(hint);
  row.appendChild(text);
  row.addEventListener("click", onSelect);
  return row;
};

const settingsDraft = { model: "", effort: "", language: "", colors: null };

// ---------- Farbeinstellungen ----------

const formatRatio = (ratio) => `${ratio.toFixed(1).replace(".", ",")} : 1`;

const describeContrast = (hex) => {
  const ratio = colors.contrastRatio(hex);
  return `${formatRatio(ratio)} ${ratio >= colors.GOOD_CONTRAST ? "✓" : "– schwach"}`;
};

const renderColorPreview = () => {
  const resolved = colors.resolveColors(settingsDraft.colors);
  const preview = $("colorPreview");
  preview.innerHTML = "";
  preview.appendChild(createChange("betriebs-internen", "betriebsinternen", resolved));
  const contrast = document.createElement("div");
  contrast.className = "contrast-line";
  contrast.textContent = `Kontrast: falsch ${describeContrast(resolved.wrong)} · richtig ${describeContrast(resolved.right)} (ab 4,5 : 1 gut lesbar)`;
  preview.appendChild(contrast);
  $("swatchWrong").style.backgroundColor = resolved.wrong;
  $("swatchRight").style.backgroundColor = resolved.right;
};

const renderColorSettings = () => {
  const draft = settingsDraft.colors;
  const list = $("colorPresetOptions");
  list.innerHTML = "";
  for (const preset of colors.PRESETS) {
    list.appendChild(
      createOption(preset, draft.preset === preset.id, () => {
        draft.preset = preset.id;
        renderColorSettings();
      })
    );
  }

  const isCustom = draft.preset === "custom";
  const mode = colors.currentMode();
  $("customColorFields").style.display = isCustom ? "block" : "none";
  $("customColorModeHint").textContent =
    mode === "light" ? "Gilt für helle InDesign-Oberflächen." : "Gilt für dunkle InDesign-Oberflächen.";
  $("colorWrong").value = draft.custom[mode].wrong;
  $("colorRight").value = draft.custom[mode].right;
  $("colorStrike").checked = draft.strike;
  renderColorPreview();
};

const updateCustomColor = (key, input) => {
  const value = input.value.trim();
  if (!colors.isHexColor(value)) return;
  settingsDraft.colors.custom[colors.currentMode()][key] = value.toLowerCase();
  renderColorPreview();
};

const bindColorSettings = () => {
  $("colorWrong").addEventListener("input", () => updateCustomColor("wrong", $("colorWrong")));
  $("colorRight").addEventListener("input", () => updateCustomColor("right", $("colorRight")));
  $("colorStrike").addEventListener("change", () => {
    settingsDraft.colors.strike = $("colorStrike").checked;
    renderColorPreview();
  });
  $("colorStrikeLabel").addEventListener("click", () => {
    $("colorStrike").checked = !$("colorStrike").checked;
    settingsDraft.colors.strike = $("colorStrike").checked;
    renderColorPreview();
  });
};

const renderSettingsOptions = () => {
  const modelList = $("modelOptions");
  modelList.innerHTML = "";
  for (const option of MODEL_OPTIONS) {
    modelList.appendChild(
      createOption(option, settingsDraft.model === option.id, () => {
        settingsDraft.model = option.id;
        $("settingsCustomModel").value = "";
        renderSettingsOptions();
      })
    );
  }

  const languageList = $("languageOptions");
  languageList.innerHTML = "";
  for (const option of languages.LANGUAGE_OPTIONS) {
    languageList.appendChild(
      createOption(option, settingsDraft.language === option.id, () => {
        settingsDraft.language = option.id;
        renderSettingsOptions();
      })
    );
  }

  const effortList = $("effortOptions");
  effortList.innerHTML = "";
  for (const option of EFFORT_OPTIONS) {
    effortList.appendChild(
      createOption(option, settingsDraft.effort === option.id, () => {
        settingsDraft.effort = option.id;
        renderSettingsOptions();
      })
    );
  }
};

// Die Versionsnummer steht nur im Manifest und wird von dort angezeigt.
const pluginVersion = () => {
  try {
    return versions.plugin || "";
  } catch {
    return "";
  }
};

const openSettings = () => {
  const preferences = settings.loadPreferences();
  settingsDraft.model = preferences.model;
  settingsDraft.effort = preferences.effort;
  settingsDraft.language = preferences.language;
  settingsDraft.colors = colors.normalizeColorSettings(preferences.colors);
  const isKnownModel = MODEL_OPTIONS.some((option) => option.id === preferences.model);
  $("settingsName").value = preferences.userName;
  $("settingsApiKey").value = state.apiKey;
  $("settingsCustomModel").value = isKnownModel ? "" : preferences.model;
  $("settingsSaveLogs").checked = preferences.saveRunLogs;
  $("versionLabel").textContent = `TP Lektor ${pluginVersion()}`.trim();
  hideNotice("settingsNotice");
  renderSettingsOptions();
  renderColorSettings();
  showScreen("settings");
};

const saveSettings = async () => {
  const userName = $("settingsName").value.trim();
  const apiKey = $("settingsApiKey").value.trim();
  const customModel = $("settingsCustomModel").value.trim();
  if (!userName) throw new Error("Bitte gib deinen Namen ein.");
  if (!apiKey) throw new Error("Bitte gib deinen API-Key ein.");

  if (apiKey !== state.apiKey) {
    await verifyApiKey(apiKey);
    await settings.saveApiKey(apiKey);
    state.apiKey = apiKey;
  }
  settings.savePreferences({
    userName,
    model: customModel || settingsDraft.model,
    effort: settingsDraft.effort,
    language: settingsDraft.language,
    saveRunLogs: $("settingsSaveLogs").checked,
    colors: settingsDraft.colors,
  });
  showScreen("main");
  render();
  showNotice("Einstellungen gespeichert.");
};

const clearDocumentLogs = () => {
  const doc = getActiveDocument();
  const count = store.clearRunLogs(doc);
  const message = count > 0 ? `${count} Prüfprotokolle aus „${doc.name}“ gelöscht.` : `„${doc.name}“ enthält keine Prüfprotokolle.`;
  showNotice(message, "info", "settingsNotice");
};

const clearDocumentData = () => {
  const doc = getActiveDocument();
  store.clear(doc);
  showNotice(`Prüfdaten von „${doc.name}“ gelöscht.`, "info", "settingsNotice");
};

// ---------- Helles / dunkles Farbschema ----------

const LIGHT_THEMES = ["light", "lightest"];

const KNOWN_THEMES = ["darkest", "dark", "light", "lightest"];

// Die Theme-API liefert je nach UXP-Version einen Text oder ein Objekt. Hier wird daraus immer
// einer der vier Namen, damit der Vergleich im Sekundentakt nicht jedes Mal eine „Änderung“ meldet.
const themeName = (raw) => {
  const text = typeof raw === "string" ? raw : raw && (raw.name || raw.theme || raw.id);
  const name = String(text || "").toLowerCase();
  return KNOWN_THEMES.includes(name) ? name : null;
};

// Erst die UXP-Theme-API, dann die Media-Query als Rückfall.
const currentTheme = () => {
  try {
    const theme = themeName(document.theme.getCurrent());
    if (theme) return theme;
  } catch {
    // weiter mit matchMedia
  }
  try {
    if (window.matchMedia("(prefers-color-scheme: lightest)").matches) return "lightest";
    if (window.matchMedia("(prefers-color-scheme: light)").matches) return "light";
  } catch {
    // keine Erkennung möglich
  }
  return "dark";
};

const isLightTheme = () => LIGHT_THEMES.includes(currentTheme());

// Die Icons sind SVG-Dateien mit fester Farbe. Für helle Oberflächen gibt es dunkle Kopien in icons/light/.
// Bewusst ohne Attribut-Selektor (img[data-icon]): Den unterstützt UXP nicht zuverlässig.
const applyThemeIcons = () => {
  const folder = isLightTheme() ? "icons/light/" : "icons/";
  for (const image of $$("img")) {
    const icon = image.getAttribute("data-icon");
    const source = `${folder}${icon}.svg`;
    if (icon && image.getAttribute("src") !== source) image.src = source;
  }
};

const applyTheme = () => {
  try {
    state.theme = currentTheme();
    const root = $("mainRoot");
    const isLight = LIGHT_THEMES.includes(state.theme);
    colors.setLightMode(isLight);
    const className = isLight ? "panel-root light-theme" : "panel-root";
    if (root.className !== className) root.className = className;
    applyThemeIcons();
  } catch (error) {
    console.error("Farbschema konnte nicht angewendet werden:", error);
  }
};

// Statt eines Event-Listeners prüft der Sekundentakt in watchActiveDocument, ob sich das Farbschema geändert hat.
const watchTheme = () => {
  applyTheme();
};

// Die Fehlerfarben hängen am Farbschema und stehen direkt an den Elementen, darum nach einem Wechsel neu zeichnen.
const refreshThemeIfChanged = () => {
  if (currentTheme() === state.theme) return;
  applyTheme();
  render();
};

// ---------- Start ----------

const DOCUMENT_POLL_MS = 1000;

// Absichtlich kein app.addEventListener: Solche Handler überleben ein Neuladen des Plugins
// und lösen danach in InDesign „Script context is not available anymore“ aus.
const watchActiveDocument = () => {
  setInterval(() => {
    try {
      refreshThemeIfChanged();
      const doc = findActiveDocument();
      const id = doc ? doc.id : null;
      if (id !== state.shownDocumentId) render();
    } catch {
      // InDesign ist gerade beschäftigt (z. B. modaler Dialog) – beim nächsten Durchlauf erneut versuchen.
    }
  }, DOCUMENT_POLL_MS);
};

const bindEvents = () => {
  $("btnWelcome").addEventListener("click", () => {
    $("setupName").value = settings.loadPreferences().userName;
    showScreen("setup");
  });
  $("btnSetupSave").addEventListener("click", runSafely(saveSetup, "setupNotice"));

  $("toggleFunctions").addEventListener("click", () => {
    settings.savePreferences({ functionsCollapsed: !settings.loadPreferences().functionsCollapsed });
    renderFunctionsCollapsed();
  });
  for (const checkbox of checkboxes()) checkbox.addEventListener("change", saveCheckToggles);
  $("check-selection").addEventListener("change", saveCheckToggles);
  for (const label of $$(".check-label")) {
    label.addEventListener("click", () => {
      const checkbox = $(label.dataset.for);
      checkbox.checked = !checkbox.checked;
      saveCheckToggles();
    });
  }
  $("btnCheck").addEventListener("click", runSafely(checkDocument));
  for (const tab of $$(".tab")) {
    tab.addEventListener("click", () => {
      if (state.running) return;
      state.activeTab = tab.dataset.tab;
      render();
    });
  }

  $("btnFocusPanel").addEventListener("click", openNavigator);
  $("btnNavigatorBack").addEventListener("click", closeNavigator);
  $("btnSettings").addEventListener("click", () => {
    if (!state.running) openSettings();
  });
  $("btnSettingsBack").addEventListener("click", () => showScreen("main"));
  $("btnSettingsSave").addEventListener("click", runSafely(saveSettings, "settingsNotice"));
  $("btnClearData").addEventListener("click", runSafely(clearDocumentData, "settingsNotice"));
  $("btnClearLogs").addEventListener("click", runSafely(clearDocumentLogs, "settingsNotice"));
  $("settingsSaveLogsLabel").addEventListener("click", () => {
    $("settingsSaveLogs").checked = !$("settingsSaveLogs").checked;
  });
};

// ---------- Updates über GitHub ----------

const updateState = { latest: null };

const formatReleaseNotes = (notes) =>
  String(notes || "")
    .split("\n")
    .map((line) => line.replace(/^#+\s*/, "").replace(/^\s*[-*]\s+/, "• ").replace(/\*\*/g, "").trimEnd())
    .filter((line) => line.trim() !== "")
    .join("\n")
    .slice(0, 1200);

const showUpdateBanner = (latest) => {
  updateState.latest = latest;
  $("updateTitle").textContent = `Version ${latest.version} verfügbar (installiert: ${pluginVersion()})`;
  $("updateNotes").textContent = formatReleaseNotes(latest.notes);
  $("updateBanner").className = "update-banner visible";
};

const hideUpdateBanner = () => {
  $("updateBanner").className = "update-banner";
};

const checkForUpdatesInBackground = async () => {
  try {
    const result = await updater.checkForUpdate(pluginVersion());
    if (result.available && !updater.isDismissed(result.latest.version)) showUpdateBanner(result.latest);
  } catch (error) {
    // Ohne Internet oder bei GitHub-Störungen still bleiben; die Prüfung läuft beim nächsten Start erneut.
    console.warn("Update-Prüfung fehlgeschlagen:", error);
  }
};

const checkForUpdatesNow = async () => {
  if (!updater.isConfigured()) {
    showNotice("Für diese Version ist keine Update-Quelle hinterlegt.", "info", "settingsNotice");
    return;
  }
  showNotice("Suche nach Updates …", "info", "settingsNotice");
  const result = await updater.checkForUpdate(pluginVersion(), { force: true });
  if (result.available) {
    showUpdateBanner(result.latest);
    showNotice(`Version ${result.latest.version} ist verfügbar. Der Hinweis steht oben in der Hauptansicht.`, "info", "settingsNotice");
  } else if (result.latest) {
    showNotice(`TP Lektor ist aktuell (${pluginVersion()}).`, "info", "settingsNotice");
  } else {
    showNotice("Auf GitHub ist noch keine Version veröffentlicht.", "info", "settingsNotice");
  }
};

const downloadUpdate = async () => {
  showNotice("Update wird geladen …");
  const way = await updater.installUpdate(updateState.latest);
  if (way === "installer") {
    showNotice("Creative Cloud installiert das Update. Danach InDesign neu starten.");
  } else {
    showNotice("Download im Browser gestartet. Die .ccx-Datei im Download-Ordner doppelklicken.");
  }
};

const bindUpdateEvents = () => {
  $("btnUpdateDownload").addEventListener("click", runSafely(downloadUpdate));
  $("btnUpdateLater").addEventListener("click", () => {
    if (updateState.latest) updater.dismiss(updateState.latest.version);
    hideUpdateBanner();
  });
  $("btnCheckUpdate").addEventListener("click", runSafely(checkForUpdatesNow, "settingsNotice"));
};

let initialized = false;

const initPanel = async () => {
  if (initialized) return;
  initialized = true;
  captureRoots();

  // Jeder Schritt einzeln abgesichert: Ein Fehler in einem Teil darf nie dazu führen, dass das Panel leer bleibt.
  const startupSteps = [
    watchTheme,
    bindEvents,
    bindFocusEvents,
    renderCheckToggles,
    renderFunctionsCollapsed,
    bindColorSettings,
    bindFieldBlur,
    bindUpdateEvents,
    watchActiveDocument,
  ];
  const failures = [];
  for (const step of startupSteps) {
    try {
      step();
    } catch (error) {
      console.error(`Start-Schritt ${step.name} fehlgeschlagen:`, error);
      failures.push(`${step.name}: ${error.message}`);
    }
  }

  state.apiKey = await settings.loadApiKey();
  if (state.apiKey) {
    showScreen("main");
    render();
  } else {
    showScreen("welcome");
  }
  if (failures.length > 0) {
    reportBootError(failures.join(" | "));
  } else {
    bootStatusElement.style.display = "none";
  }
  checkForUpdatesInBackground();
};

const startPanel = () =>
  initPanel().catch((error) => {
    console.error(error);
    reportBootError(error.message || String(error));
  });

const attachRoot = (rootNode) => {
  captureRoots();
  const [root] = roots;
  if (rootNode && root.parentNode !== rootNode) rootNode.appendChild(root);
};

entrypoints.setup({
  panels: {
    mainPanel: {
      create(rootNode) {
        attachRoot(rootNode);
        startPanel();
      },
      show(rootNode) {
        attachRoot(rootNode);
        applyTheme();
        if (state.apiKey) render();
      },
    },
  },
});
