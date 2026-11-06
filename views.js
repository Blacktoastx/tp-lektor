const { CHECKS } = require("./checks");
const { languageLabel } = require("./languages");
const colors = require("./colors");
const {
  formatTime,
  formatDateTime,
  formatNumber,
  formatDecimal,
  formatPercent,
  formatUsd,
  formatPage,
  formatRange,
} = require("./format");

const AVATAR_COLORS = ["#1e96f0", "#16a51d", "#e8702a", "#9b59b6", "#d63a4a", "#139c9c", "#b8860b"];

const createElement = (tag, className, text) => {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
};

const append = (parent, ...children) => {
  for (const child of children) if (child) parent.appendChild(child);
  return parent;
};

const createSmallButton = (label, style, onClick) => {
  const button = createElement("div", `btn-small ${style}`, label);
  button.addEventListener("click", onClick);
  return button;
};

const initialsOf = (name) => {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
};

const colorOf = (name) => {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) % 997;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
};

const createAvatar = (name) => {
  const displayName = name || "Unbekannt";
  const avatar = createElement("div", "avatar", initialsOf(displayName));
  avatar.style.backgroundColor = colorOf(displayName);
  avatar.title = displayName;
  return avatar;
};

const createChange = (original, korrektur, changeColors) => {
  const originalElement = createElement("span", "original", original);
  const correctionElement = createElement("span", "correction", korrektur || "(entfernen)");
  colors.paintChange(originalElement, correctionElement, changeColors);
  return append(
    createElement("div", "change"),
    originalElement,
    createElement("span", "arrow", "  →  "),
    correctionElement
  );
};

const createDoneBy = (finding) => {
  const isApplied = finding.status === "applied";
  return append(
    createElement("div", "done-by"),
    createAvatar(finding.doneBy),
    createElement(
      "span",
      isApplied ? "status-applied" : "status-ignored",
      isApplied ? "Übernommen" : "Ignoriert"
    ),
    createElement("span", "", `von ${finding.doneBy || "Unbekannt"} · ${formatDateTime(finding.doneAt)}`)
  );
};

// Hinweise kommen von Regeln mit möglichen Ausnahmen: Sie sind Vorschläge zum Prüfen, keine sicheren Fehler.
const createFindingType = (finding) => {
  const line = createElement("div", "finding-type", `${finding.typ}  •  ${finding.area}`);
  if (finding.hint) line.appendChild(createElement("span", "hint-badge", "Hinweis"));
  return line;
};

const createFindingCard = (finding, handlers) => {
  const isOpen = finding.status === "open";
  const card = createElement("div", "finding");
  if (!isOpen) card.appendChild(createDoneBy(finding));

  const actions = append(
    createElement("div", "finding-actions"),
    createSmallButton("Anzeigen", "outline", () => handlers.onShow(finding))
  );
  if (isOpen) {
    const sameCount = handlers.countSame(finding);
    append(
      actions,
      createSmallButton("Übernehmen", "filled", () => handlers.onApply(finding)),
      createSmallButton("Ignorieren", "filled", () => handlers.onIgnore(finding)),
      sameCount > 1
        ? createSmallButton(`Alle ignorieren (${sameCount})`, "filled", () => handlers.onIgnoreAll(finding))
        : null,
      createSmallButton("Ins Wörterbuch", "outline", () => handlers.onAddToDictionary(finding))
    );
  } else if (finding.status === "ignored") {
    actions.appendChild(createSmallButton("Wieder öffnen", "filled", () => handlers.onReopen(finding)));
  }

  return append(
    card,
    createFindingType(finding),
    createChange(finding.original, finding.korrektur),
    createElement("div", "explanation", finding.erklaerung),
    actions
  );
};

// Anzeige, wenn das Dokument schon geprüft wurde und nichts mehr offen ist.
const createCleanState = (runs) => {
  const completed = runs.filter((run) => !run.cancelled);
  const last = completed[completed.length - 1] || runs[runs.length - 1];
  const count = completed.length;
  const box = createElement("div", "clean-state");
  const title = createElement("div", "clean-title", "Keine offenen Fehler");
  // Gleiche Farbe wie „richtig“ in den Korrekturen: in den Einstellungen auf gute Lesbarkeit abgestimmt.
  const { right } = colors.currentColors();
  title.style.color = right;
  box.style.borderColor = right;
  return append(
    box,
    title,
    createElement("div", "clean-text", `Bereits ${count}-mal geprüft. Alle gefundenen Fehler sind bearbeitet.`),
    createElement(
      "div",
      "clean-meta",
      `Letzte Prüfung: ${formatDateTime(last.startedAt)} · ${last.user || "Unbekannt"} · ${formatRange(last.range)}`
    )
  );
};

const renderFindings = (container, findings, handlers, emptyText) => {
  if (findings.length === 0) {
    container.appendChild(typeof emptyText === "string" ? createElement("div", "empty", emptyText) : emptyText);
    return;
  }
  let currentPage = null;
  for (const finding of findings) {
    if (finding.pageLabel !== currentPage) {
      currentPage = finding.pageLabel;
      container.appendChild(createElement("div", "page-heading", formatPage(currentPage)));
    }
    container.appendChild(createFindingCard(finding, handlers));
  }
};

// ---------- Laden ----------

const renderLoading = (container, onCancel) => {
  const title = createElement("div", "loading-title", "Dokument wird geprüft");
  const bar = createElement("div", "progress-bar");
  const meta = createElement("div", "loading-meta", "Text wird gesammelt …");
  const cancel = createElement("div", "btn-outline", "Abbrechen");
  cancel.addEventListener("click", onCancel);
  append(container, append(createElement("div", "loading"), title, append(createElement("div", "progress"), bar), meta, cancel));

  // UXP kennt keine CSS-Keyframes, darum treibt ein Timer Punkte und Balken an.
  let dots = 0;
  let shown = 0;
  let target = 0.04;
  let ceiling = 0.1;
  const timer = setInterval(() => {
    dots = (dots + 1) % 4;
    title.textContent = `Dokument wird geprüft${".".repeat(dots)}`;
    shown = Math.max(shown, target) + (ceiling - Math.max(shown, target)) * 0.04;
    bar.style.width = `${Math.min(shown, 1) * 100}%`;
  }, 250);

  return {
    update: (done, total, foundCount) => {
      target = done / total;
      ceiling = Math.min(1, (done + 1) / total);
      meta.textContent = `${done} von ${total} Abschnitten geprüft · ${foundCount} Fundstellen`;
    },
    setMessage: (message) => {
      meta.textContent = message;
    },
    stop: () => clearInterval(timer),
  };
};

// ---------- Statistik ----------

const createTile = (value, label) =>
  append(createElement("div", "tile"), createElement("div", "tile-value", value), createElement("div", "tile-label", label));

const createBarRow = (label, count, max) => {
  const fill = createElement("div", "bar-fill");
  fill.style.width = `${max > 0 ? (count / max) * 100 : 0}%`;
  return append(
    createElement("div", "bar-row"),
    createElement("div", "bar-label", label),
    append(createElement("div", "bar-track"), fill),
    createElement("div", "bar-value", String(count))
  );
};

const renderUsageDetails = (container, stats) => {
  const details = createElement("div", "details");
  details.style.display = "none";
  const toggle = createElement("div", "details-toggle", "Details anzeigen");
  toggle.addEventListener("click", () => {
    const isHidden = details.style.display === "none";
    details.style.display = isHidden ? "block" : "none";
    toggle.textContent = isHidden ? "Details ausblenden" : "Details anzeigen";
  });

  const lines = [
    `Tokens gesamt: ${formatNumber(stats.usage.input)} Eingabe / ${formatNumber(stats.usage.output)} Ausgabe`,
    stats.lastUsage
      ? `Letzte Prüfung: ${formatNumber(stats.lastUsage.input)} Eingabe / ${formatNumber(stats.lastUsage.output)} Ausgabe`
      : null,
    `Geschätzte Kosten gesamt: ${formatUsd(stats.cost.total)}${stats.cost.complete ? "" : " (ohne Modelle ohne Preisangabe)"}`,
  ].filter(Boolean);
  for (const line of lines) details.appendChild(createElement("div", "", line));

  append(container, toggle, details);
};

const renderStats = (container, stats, onExport) => {
  container.appendChild(createElement("div", "section-title", "Statistik"));
  // Zwei feste Zeilen mit je zwei Kacheln, damit das 2×2-Raster auch in schmalen Panels erhalten bleibt.
  append(
    container,
    append(
      createElement("div", "tiles"),
      createTile(String(stats.applied), "korrigiert"),
      createTile(String(stats.open), "noch offen")
    ),
    append(
      createElement("div", "tiles"),
      createTile(String(stats.ignored), "ignoriert"),
      createTile(String(stats.runs), stats.runs === 1 ? "Prüfung" : "Prüfungen")
    )
  );

  const facts = [
    stats.acceptanceRate !== null ? `Übernahmequote: ${formatPercent(stats.acceptanceRate)}` : null,
    stats.errorsPerPage !== null ? `Fehler pro Seite (letzte Prüfung): ${formatDecimal(stats.errorsPerPage, 1)}` : null,
  ].filter(Boolean);
  for (const fact of facts) container.appendChild(createElement("div", "list-row", fact));

  if (stats.correctedByType.length > 0) {
    container.appendChild(createElement("div", "section-title", "Korrigiert nach Art"));
    const max = Math.max(...stats.correctedByType.map((row) => row.count));
    for (const row of stats.correctedByType) container.appendChild(createBarRow(row.typ, row.count, max));
  }

  if (stats.topMistakes.length > 0) {
    container.appendChild(createElement("div", "section-title", "Häufigste Fehler"));
    for (const mistake of stats.topMistakes) {
      const row = append(
        createElement("div", "list-row"),
        createChange(mistake.original, mistake.korrektur),
        createElement("span", "muted", `${mistake.count}×`)
      );
      container.appendChild(row);
    }
  }

  if (stats.editors.length > 0) {
    container.appendChild(createElement("div", "section-title", "Bearbeiter"));
    for (const editor of stats.editors) {
      container.appendChild(
        append(
          createElement("div", "list-row"),
          createAvatar(editor.user),
          createElement("span", "", editor.user),
          createElement("span", "muted", `${editor.count} ${editor.count === 1 ? "Aktion" : "Aktionen"}`)
        )
      );
    }
  }

  renderUsageDetails(container, stats);

  const exportButton = createElement("div", "btn-outline", "Bericht als CSV exportieren");
  exportButton.addEventListener("click", onExport);
  container.appendChild(exportButton);
};

// ---------- Historie ----------

const EVENT_LABELS = {
  übernommen: "Übernommen",
  ignoriert: "Ignoriert",
  "wieder geöffnet": "Wieder geöffnet",
  "ins Wörterbuch": "Ins Wörterbuch übernommen",
};

const createEvent = (event) =>
  append(
    createElement("div", "event"),
    createAvatar(event.user),
    append(
      createElement("div", "event-body"),
      createElement(
        "div",
        "run-meta",
        `${formatTime(event.at)} · ${EVENT_LABELS[event.action]} von ${event.user || "Unbekannt"} · ${formatPage(event.pageLabel)} · ${event.typ}`
      ),
      createChange(event.original, event.korrektur)
    )
  );

const describeRun = (run) => {
  const checkLabels = (run.checks || []).map((key) => CHECKS[key].label).join(", ");
  const hidden = run.hiddenCount > 0 ? ` · ${run.hiddenCount} schon bekannt/ignoriert` : "";
  const cancelled = run.cancelled ? " · abgebrochen" : "";
  // Ältere Prüfungen ohne Sprachangabe liefen immer auf Deutsch.
  const language = run.language && run.language !== "de" ? ` · ${languageLabel(run.language)}` : "";
  return `${checkLabels}${language} · ${formatRange(run.range)} · ${run.findingsCount} neue Fehler${hidden}${cancelled}`;
};

const prettyJson = (raw) => {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
};

// Auf- und zuklappbarer Bereich. Der Inhalt wird erst beim ersten Öffnen gebaut, weil Protokolle groß sein können.
const createCollapsible = (label, buildContent) => {
  const wrapper = createElement("div", "collapsible");
  const toggle = createElement("div", "details-toggle", `▸ ${label}`);
  const body = createElement("div", "collapsible-body");
  body.style.display = "none";
  let built = false;
  toggle.addEventListener("click", () => {
    const opening = body.style.display === "none";
    if (opening && !built) {
      buildContent(body);
      built = true;
    }
    body.style.display = opening ? "block" : "none";
    toggle.textContent = `${opening ? "▾" : "▸"} ${label}`;
  });
  return append(wrapper, toggle, body);
};

const createLogText = (text) => createElement("div", "log-text", text);

const renderRunLog = (body, run, logHandlers) => {
  const log = logHandlers.loadLog(run.id);
  if (!log) {
    body.appendChild(createElement("div", "run-meta", "Für diese Prüfung ist kein Protokoll mehr gespeichert."));
    return;
  }
  body.appendChild(
    createElement(
      "div",
      "run-meta",
      `${log.model} · Gründlichkeit ${log.effort} · ${log.exchanges.length} von ${log.totalRequests} Anfragen beantwortet`
    )
  );
  body.appendChild(createCollapsible("System-Prompt (Anweisungen an die KI)", (inner) => inner.appendChild(createLogText(log.system))));
  for (const exchange of log.exchanges) {
    const label = `Anfrage ${exchange.index + 1} · ${formatNumber(exchange.usage.input)} / ${formatNumber(exchange.usage.output)} Tokens`;
    body.appendChild(
      createCollapsible(label, (inner) =>
        append(
          inner,
          createElement("div", "log-label", "Gesendet"),
          createLogText(exchange.user),
          createElement("div", "log-label", "Antwort"),
          createLogText(prettyJson(exchange.response))
        )
      )
    );
  }
  const saveButton = createElement("div", "btn-small outline log-save", "Als Textdatei speichern");
  saveButton.addEventListener("click", () => logHandlers.onSaveLog(run));
  body.appendChild(saveButton);
};

const renderRuns = (container, data, logHandlers) => {
  container.appendChild(createElement("div", "section-title", "Verlauf"));
  if (data.runs.length === 0) {
    container.appendChild(createElement("div", "empty", "Für dieses Dokument gibt es noch keine Prüfungen."));
    return;
  }
  for (const run of [...data.runs].reverse()) {
    const runElement = createElement("div", "run");
    append(
      runElement,
      append(
        createElement("div", "run-heading"),
        createAvatar(run.user),
        createElement("span", "", `${formatDateTime(run.startedAt)} · geprüft von ${run.user || "Unbekannt"}`)
      ),
      createElement("div", "run-meta", describeRun(run))
    );
    if (run.hasLog) {
      runElement.appendChild(
        createCollapsible("Details: Prompt & Antwort", (body) => renderRunLog(body, run, logHandlers))
      );
    }
    const events = data.events.filter((event) => event.runId === run.id);
    if (events.length === 0) runElement.appendChild(createElement("div", "run-meta", "Noch nichts bearbeitet."));
    for (const event of events) runElement.appendChild(createEvent(event));
    container.appendChild(runElement);
  }
};

const renderHistory = (container, data, stats, onExport, logHandlers) => {
  renderStats(container, stats, onExport);
  renderRuns(container, data, logHandlers);
  container.appendChild(createElement("div", "history-actions"));
};

module.exports = {
  renderFindings,
  renderLoading,
  renderHistory,
  createFindingType,
  createChange,
  createCleanState,
};
