const { formatDateTime } = require("./format");

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

const createButton = (label, style, onClick) => {
  const button = createElement("div", `btn-small ${style}`, label);
  button.addEventListener("click", onClick);
  return button;
};

const createCheckbox = (checked, onChange) => {
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = checked;
  checkbox.addEventListener("change", () => onChange(checkbox.checked));
  return checkbox;
};

const createCategorySelect = (categories, selectedId, onChange) => {
  const select = document.createElement("select");
  for (const category of categories) {
    const option = document.createElement("option");
    option.value = category.id;
    option.textContent = category.name;
    if (category.id === selectedId) option.selected = true;
    select.appendChild(option);
  }
  select.value = selectedId;
  select.addEventListener("change", () => onChange(select.value));
  return select;
};

const createTextForm = (placeholder, buttonLabel, extra, onSubmit) => {
  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = placeholder;
  const submit = () => onSubmit(input.value, input);
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") submit();
  });
  return append(createElement("div", "dict-form"), input, extra, createButton(buttonLabel, "filled", submit));
};

const renderCategories = (container, dictionary, view, handlers) => {
  container.appendChild(createElement("div", "section-title", "Kategorien"));
  container.appendChild(
    createElement("div", "field-hint", "Nur Wörter aus aktiven Kategorien werden beim Prüfen berücksichtigt.")
  );

  for (const category of dictionary.categories) {
    const count = dictionary.entries.filter((entry) => entry.categoryId === category.id).length;
    const isPendingDelete = view.pendingDeleteId === category.id;
    append(
      container,
      append(
        createElement("div", "dict-row"),
        createCheckbox(category.active, (active) => handlers.onToggleCategory(category.id, active)),
        append(
          createElement("span", "dict-name", category.name),
          createElement("span", "dict-meta", `${count} ${count === 1 ? "Wort" : "Wörter"}`)
        ),
        createButton("Exportieren", "outline", () => handlers.onExportCategory(category.id)),
        category.id === handlers.defaultCategoryId
          ? null
          : createButton(isPendingDelete ? "Wirklich löschen?" : "Löschen", "danger", () =>
              handlers.onDeleteCategory(category.id)
            )
      )
    );
  }

  container.appendChild(
    createTextForm("Neue Kategorie, z. B. Kunde Müller", "Anlegen", null, (name, input) =>
      handlers.onAddCategory(name, input)
    )
  );
};

const renderAddWord = (container, dictionary, view, handlers) => {
  container.appendChild(createElement("div", "section-title", "Wort hinzufügen"));
  const select = createCategorySelect(dictionary.categories, view.targetCategoryId, handlers.onSetTarget);
  container.appendChild(
    createTextForm("Wort oder Schreibweise", "Hinzufügen", select, (text, input) => handlers.onAddWord(text, input))
  );
  container.appendChild(
    createElement(
      "div",
      "field-hint",
      "Die gewählte Kategorie gilt auch für „Ins Wörterbuch“ in der Fehlerliste."
    )
  );
};

const renderEntries = (container, dictionary, view, handlers) => {
  container.appendChild(createElement("div", "section-title", `Wörter (${dictionary.entries.length})`));

  const allSelected =
    dictionary.entries.length > 0 && dictionary.entries.every((entry) => view.selection.has(entry.id));
  append(
    container,
    append(
      createElement("div", "dict-toolbar"),
      createButton(allSelected ? "Auswahl aufheben" : "Alle auswählen", "outline", () =>
        handlers.onSelectAll(!allSelected)
      ),
      createButton(`Auswahl exportieren (${view.selection.size})`, "outline", handlers.onExportSelection),
      createButton("Auswahl löschen", "danger", handlers.onDeleteSelection),
      createButton("Importieren", "filled", handlers.onImport)
    )
  );

  if (dictionary.entries.length === 0) {
    container.appendChild(
      createElement("div", "empty", "Noch keine Wörter. Füge sie oben hinzu oder nutze „Ins Wörterbuch“ bei einem Fehler.")
    );
    return;
  }

  for (const category of dictionary.categories) {
    const entries = dictionary.entries
      .filter((entry) => entry.categoryId === category.id)
      .sort((a, b) => a.text.localeCompare(b.text, "de"));
    if (entries.length === 0) continue;
    container.appendChild(createElement("div", "dict-group", category.name));
    for (const entry of entries) {
      append(
        container,
        append(
          createElement("div", "dict-row"),
          createCheckbox(view.selection.has(entry.id), (checked) => handlers.onToggleSelect(entry.id, checked)),
          append(
            createElement("span", "dict-name", entry.text),
            createElement("span", "dict-meta", `${entry.addedBy || "Unbekannt"} · ${formatDateTime(entry.addedAt)}`)
          )
        )
      );
    }
  }
};

const renderDictionary = (container, dictionary, view, handlers) => {
  renderCategories(container, dictionary, view, handlers);
  renderAddWord(container, dictionary, view, handlers);
  renderEntries(container, dictionary, view, handlers);
  container.appendChild(createElement("div", "history-actions"));
};

module.exports = { renderDictionary };
