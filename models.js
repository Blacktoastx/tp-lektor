// Preise in US-Dollar pro 1 Mio. Tokens laut OpenAI (Stand Oktober 2026). Ohne Preis wird keine Kostenschätzung angezeigt.
const MODEL_OPTIONS = [
  {
    id: "gpt-5.4-mini",
    label: "GPT-5.4 mini",
    hint: "Empfohlen · gutes Preis-Leistungs-Verhältnis",
    price: { input: 0.75, output: 4.5 },
  },
  {
    id: "gpt-5.4-nano",
    label: "GPT-5.4 nano",
    hint: "Am günstigsten · übersieht eher etwas",
    price: { input: 0.2, output: 1.25 },
  },
  {
    id: "gpt-5.4",
    label: "GPT-5.4",
    hint: "Höchste Qualität · deutlich teurer",
    price: null,
  },
];

const EFFORT_OPTIONS = [
  { id: "low", label: "Schnell", hint: "Für die meisten Dokumente ausreichend" },
  { id: "medium", label: "Gründlich", hint: "Findet mehr, dauert länger und kostet mehr" },
];

const DEFAULT_MODEL = MODEL_OPTIONS[0].id;
const DEFAULT_EFFORT = EFFORT_OPTIONS[0].id;

const estimateCostUsd = (model, usage) => {
  const option = MODEL_OPTIONS.find((candidate) => candidate.id === model);
  if (!option || !option.price) return null;
  return (usage.input * option.price.input + usage.output * option.price.output) / 1e6;
};

module.exports = { MODEL_OPTIONS, EFFORT_OPTIONS, DEFAULT_MODEL, DEFAULT_EFFORT, estimateCostUsd };
