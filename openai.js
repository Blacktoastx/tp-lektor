const { CHECKS, typesFor } = require("./checks");

const API_BASE = "https://api.openai.com/v1";
const MAX_ATTEMPTS = 3;
const RETRYABLE_STATUS = [429, 500, 502, 503, 504];

const BASE_PROMPT = `Du bist ein erfahrener Korrektor und Lektor für Drucksachen.
Du erhältst Absätze aus einem InDesign-Dokument, jeweils im Format "[ID] Text".
Prüfe ausschließlich die unten aufgeführten Bereiche und melde nichts anderes.

Allgemeine Regeln:
- Eigennamen, Marken, Produktbezeichnungen, Fachbegriffe und Abkürzungen nicht korrigieren, solange sie plausibel sind.
- Wenn ein Wort durch den Umbruch auf zwei Absätze verteilt scheint, ignoriere es.
- "original" muss Zeichen für Zeichen exakt so im Absatz vorkommen. Wähle nur so viel Text, wie nötig ist, damit die Stelle eindeutig ist.
- "korrektur" ersetzt genau den Text aus "original".
- "erklaerung" ist ein kurzer Satz auf Deutsch.
- Melde jede Stelle nur einmal, auch wenn sie zu mehreren Bereichen passt.
- Sonderleerzeichen (geschützt, schmal geschützt, Achtelgeviert, Haarspatium usw.) sind bewusst gesetzt. Ersetze sie nie durch normale Leerzeichen und melde sie nicht.
- Preise wie „45,- €“ oder „45,-“ sind so gewollt. Ersetze den Bindestrich dort nie durch einen Halbgeviertstrich.
- Gibt es nichts zu melden, liefere eine leere Liste.`;

const buildDictionaryPrompt = (terms) =>
  terms.length === 0
    ? null
    : `HAUSWÖRTERBUCH
Folgende Wörter und Schreibweisen sind ausdrücklich korrekt. Melde sie nie als Fehler, auch nicht in Varianten mit anderem Satzzeichen am Rand:
${terms.map((term) => `- ${term}`).join("\n")}`;

const buildSystemPrompt = (checkKeys, dictionaryTerms) =>
  [BASE_PROMPT, ...checkKeys.map((key) => CHECKS[key].prompt), buildDictionaryPrompt(dictionaryTerms)]
    .filter(Boolean)
    .join("\n\n");

const buildSchema = (checkKeys) => ({
  type: "object",
  additionalProperties: false,
  required: ["fehler"],
  properties: {
    fehler: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "original", "korrektur", "typ", "erklaerung"],
        properties: {
          id: { type: "string" },
          original: { type: "string" },
          korrektur: { type: "string" },
          typ: { type: "string", enum: typesFor(checkKeys) },
          erklaerung: { type: "string" },
        },
      },
    },
  },
});

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const supportsReasoningEffort = (model) => /^(gpt-5|o\d)/.test(model);

const buildRequestBody = ({ model, effort, checkKeys, dictionaryTerms = [], chunk }) => {
  const body = {
    model,
    messages: [
      { role: "system", content: buildSystemPrompt(checkKeys, dictionaryTerms) },
      { role: "user", content: chunk.map((entry) => `[${entry.id}] ${entry.text}`).join("\n") },
    ],
    response_format: {
      type: "json_schema",
      json_schema: { name: "pruefergebnis", strict: true, schema: buildSchema(checkKeys) },
    },
  };
  if (supportsReasoningEffort(model)) body.reasoning_effort = effort;
  return body;
};

const readErrorMessage = async (response) => {
  const raw = await response.text();
  try {
    return JSON.parse(raw).error.message;
  } catch {
    return raw.slice(0, 200);
  }
};

const request = async (apiKey, path, options = {}) => {
  for (let attempt = 1; ; attempt++) {
    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    });
    if (response.ok) return response.json();
    if (attempt < MAX_ATTEMPTS && RETRYABLE_STATUS.includes(response.status)) {
      await wait(2000 * attempt);
      continue;
    }
    if (response.status === 401) throw new Error("Der API-Key ist ungültig.");
    throw new Error(`OpenAI (${response.status}): ${await readErrorMessage(response)}`);
  }
};

const verifyApiKey = (apiKey) => request(apiKey, "/models");

const checkChunk = async (options) => {
  const body = buildRequestBody(options);
  const data = await request(options.apiKey, "/chat/completions", {
    method: "POST",
    body: JSON.stringify(body),
  });
  const message = data.choices[0].message;
  if (message.refusal) throw new Error(`Modell hat abgelehnt: ${message.refusal}`);
  return {
    findings: JSON.parse(message.content).fehler,
    usage: data.usage,
    exchange: { system: body.messages[0].content, user: body.messages[1].content, response: message.content },
  };
};

module.exports = { checkChunk, verifyApiKey };
