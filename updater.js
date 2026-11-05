// Update-Prüfung über GitHub Releases.
// Das Plugin kann sich in InDesign nicht selbst austauschen. Es fragt nur nach der neuesten Version
// und öffnet den Download der .ccx-Datei im Browser; ein Doppelklick darauf installiert das Update.

// GitHub-Repository im Format "benutzer/repository". Leer = Update-Prüfung ausgeschaltet.
const GITHUB_REPO = "Blacktoastx/tp-lektor";

const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
const CACHE_KEY = "tplektor.updateCheck";
const DISMISSED_KEY = "tplektor.updateDismissed";

const readStorage = (key) => {
  try {
    return JSON.parse(localStorage.getItem(key) || "null");
  } catch {
    return null;
  }
};

const writeStorage = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ohne Speicher wird beim nächsten Start einfach erneut geprüft.
  }
};

const parseVersion = (text) =>
  String(text || "")
    .trim()
    .replace(/^v/i, "")
    .split(/[.-]/)
    .slice(0, 3)
    .map((part) => parseInt(part, 10) || 0);

const isNewerVersion = (candidate, current) => {
  const a = parseVersion(candidate);
  const b = parseVersion(current);
  for (let i = 0; i < 3; i += 1) {
    if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) > (b[i] || 0);
  }
  return false;
};

const isConfigured = () => GITHUB_REPO.includes("/");

const releasesPageUrl = () => `https://github.com/${GITHUB_REPO}/releases/latest`;

const fetchLatestRelease = async () => {
  const response = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
    headers: { Accept: "application/vnd.github+json" },
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`GitHub antwortet mit Status ${response.status}`);
  const release = await response.json();
  const assets = Array.isArray(release.assets) ? release.assets : [];
  const ccx = assets.find((asset) => /\.ccx$/i.test(asset.name || ""));
  return {
    version: String(release.tag_name || "").replace(/^v/i, ""),
    notes: String(release.body || "").trim(),
    downloadUrl: ccx ? ccx.browser_download_url : release.html_url || releasesPageUrl(),
    pageUrl: release.html_url || releasesPageUrl(),
  };
};

// Liefert { available, latest, current } oder wirft bei Netzwerkfehlern.
// force = true ignoriert den Zwischenspeicher (Button in den Einstellungen).
const checkForUpdate = async (currentVersion, { force = false } = {}) => {
  if (!isConfigured()) return { available: false, latest: null, current: currentVersion };

  const cached = readStorage(CACHE_KEY);
  let latest = cached && cached.release;
  const isFresh = cached && Date.now() - cached.checkedAt < CHECK_INTERVAL_MS;
  if (force || !isFresh) {
    latest = await fetchLatestRelease();
    writeStorage(CACHE_KEY, { checkedAt: Date.now(), release: latest });
  }

  const available = Boolean(latest && isNewerVersion(latest.version, currentVersion));
  return { available, latest, current: currentVersion };
};

const isDismissed = (version) => readStorage(DISMISSED_KEY) === version;
const dismiss = (version) => writeStorage(DISMISSED_KEY, version);

const openInBrowser = async (url) => {
  const { shell } = require("uxp");
  await shell.openExternal(url, "TP Lektor öffnet den Download der neuen Version im Browser.");
};

module.exports = {
  checkForUpdate,
  isNewerVersion,
  isConfigured,
  isDismissed,
  dismiss,
  openInBrowser,
  releasesPageUrl,
};
