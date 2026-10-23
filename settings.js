const { app } = require("indesign");
const { secureStorage } = require("uxp").storage;
const { CHECK_KEYS } = require("./checks");
const { DEFAULT_MODEL, DEFAULT_EFFORT } = require("./models");

const API_KEY_STORAGE_KEY = "openaiApiKey";
const PREFERENCES_STORAGE_KEY = "preferences";

const loadApiKey = async () => {
  try {
    const bytes = await secureStorage.getItem(API_KEY_STORAGE_KEY);
    return bytes ? String.fromCharCode(...bytes) : "";
  } catch {
    return "";
  }
};

const saveApiKey = (apiKey) => secureStorage.setItem(API_KEY_STORAGE_KEY, apiKey);

const inDesignUserName = () => {
  try {
    const name = app.userName;
    return name && !/unknown|unbekannt/i.test(name) ? name : "";
  } catch {
    return "";
  }
};

const loadPreferences = () => {
  let stored = {};
  try {
    stored = JSON.parse(localStorage.getItem(PREFERENCES_STORAGE_KEY)) || {};
  } catch {
    stored = {};
  }
  return {
    model: stored.model || DEFAULT_MODEL,
    effort: stored.effort || DEFAULT_EFFORT,
    userName: stored.userName || inDesignUserName(),
    checks: (stored.checks || ["orthography"]).filter((key) => CHECK_KEYS.includes(key)),
    functionsCollapsed: Boolean(stored.functionsCollapsed),
    dictionaryCategory: stored.dictionaryCategory || "allgemein",
    saveRunLogs: stored.saveRunLogs === true,
  };
};

const savePreferences = (changes) => {
  const merged = { ...loadPreferences(), ...changes };
  localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(merged));
  return merged;
};

module.exports = { loadApiKey, saveApiKey, loadPreferences, savePreferences };
