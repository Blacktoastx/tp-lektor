const pad = (value) => String(value).padStart(2, "0");

const formatTime = (isoString) => {
  const date = new Date(isoString);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const formatDateTime = (isoString) => {
  const date = new Date(isoString);
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}, ${formatTime(isoString)}`;
};

const formatNumber = (value) => String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");

const formatDecimal = (value, digits) => value.toFixed(digits).replace(".", ",");

const formatPercent = (ratio) => `${Math.round(ratio * 100)} %`;

const formatUsd = (value) => (value < 0.01 ? "< 0,01 $" : `${formatDecimal(value, 2)} $`);

const formatPage = (pageLabel) => (/^\d/.test(pageLabel) ? `Seite ${pageLabel}` : pageLabel);

const formatRange = (range) => {
  if (!range) return "Ganzes Dokument";
  if (range.selection) return `Auswahl (${range.paragraphs} ${range.paragraphs === 1 ? "Absatz" : "Absätze"})`;
  return `Seiten ${range.fromLabel}–${range.toLabel}`;
};

module.exports = {
  formatTime,
  formatDateTime,
  formatNumber,
  formatDecimal,
  formatPercent,
  formatUsd,
  formatPage,
  formatRange,
};
