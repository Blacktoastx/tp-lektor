const { estimateCostUsd } = require("./models");

const TYPE_ORDER = ["Rechtschreibung", "Grammatik", "Zeichensetzung", "Typografie", "Lektorat"];

const countBy = (items, keyOf) => {
  const counts = new Map();
  for (const item of items) {
    const key = keyOf(item);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return counts;
};

const sumUsage = (runs) =>
  runs.reduce(
    (total, run) => ({
      input: total.input + (run.usage ? run.usage.input : 0),
      output: total.output + (run.usage ? run.usage.output : 0),
    }),
    { input: 0, output: 0 }
  );

const sumCost = (runs) => {
  let total = 0;
  let complete = true;
  for (const run of runs) {
    if (!run.usage) continue;
    const cost = estimateCostUsd(run.model, run.usage);
    if (cost === null) complete = false;
    else total += cost;
  }
  return { total, complete };
};

const computeStats = (data) => {
  const byStatus = countBy(data.findings, (finding) => finding.status);
  const applied = byStatus.get("applied") || 0;
  const ignored = byStatus.get("ignored") || 0;
  const open = byStatus.get("open") || 0;

  const appliedByType = countBy(
    data.findings.filter((finding) => finding.status === "applied"),
    (finding) => finding.typ
  );
  const correctedByType = TYPE_ORDER.map((typ) => ({ typ, count: appliedByType.get(typ) || 0 })).filter(
    (row) => row.count > 0
  );

  const repeated = countBy(
    data.findings.filter((finding) => finding.status !== "ignored"),
    (finding) => `${finding.original}\u0000${finding.korrektur}`
  );
  const topMistakes = [...repeated.entries()]
    .sort((a, b) => b[1] - a[1])
    .filter(([, count]) => count > 1)
    .slice(0, 3)
    .map(([key, count]) => {
      const [original, korrektur] = key.split("\u0000");
      return { original, korrektur, count };
    });

  const editors = [...countBy(data.events.filter((event) => event.user), (event) => event.user).entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([user, count]) => ({ user, count }));

  const lastRun = data.runs[data.runs.length - 1] || null;
  const decided = applied + ignored;

  return {
    runs: data.runs.length,
    found: data.findings.length,
    applied,
    ignored,
    open,
    correctedByType,
    topMistakes,
    editors,
    acceptanceRate: decided > 0 ? applied / decided : null,
    errorsPerPage:
      lastRun && lastRun.pagesChecked > 0 ? lastRun.findingsCount / lastRun.pagesChecked : null,
    usage: sumUsage(data.runs),
    lastUsage: lastRun && lastRun.usage,
    cost: sumCost(data.runs),
  };
};

module.exports = { computeStats };
