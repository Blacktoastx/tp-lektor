const settings = require("./settings");

// Farben für „falsch“ und „richtig“. Jeder Satz hat Werte für dunkle und helle InDesign-Oberflächen.
// Die Kontrastwerte beziehen sich auf den Panel-Hintergrund (dunkel #535353, hell #f0f0f0); ab 4,5 : 1 gilt Schrift als gut lesbar.
const REFERENCE_BACKGROUND = { dark: "#535353", light: "#f0f0f0" };
const GOOD_CONTRAST = 4.5;

const PRESETS = [
  {
    id: "standard",
    label: "Standard",
    hint: "Gut lesbar auf dem InDesign-Grau",
    dark: { wrong: "#ffb4ab", right: "#7ee787" },
    light: { wrong: "#c5221f", right: "#116329" },
  },
  {
    id: "contrast",
    label: "Hoher Kontrast",
    hint: "Hellere Töne für schwierige Bildschirme",
    dark: { wrong: "#ffc9c4", right: "#a6f0ae" },
    light: { wrong: "#a40e26", right: "#0f5323" },
  },
  {
    id: "colorblind",
    label: "Orange / Blau",
    hint: "Auch bei Rot-Grün-Sehschwäche gut unterscheidbar",
    dark: { wrong: "#ffc58a", right: "#b4d7ff" },
    light: { wrong: "#953800", right: "#0550ae" },
  },
  {
    id: "classic",
    label: "Kräftig",
    hint: "Satte Farben, auf Grau aber schwer lesbar",
    dark: { wrong: "#e8202a", right: "#16a51d" },
    light: { wrong: "#d01219", right: "#11841a" },
  },
  {
    id: "custom",
    label: "Eigene Farben",
    hint: "Hex-Werte selbst festlegen",
    dark: null,
    light: null,
  },
];

const [DEFAULT_PRESET] = PRESETS;

const defaultColorSettings = () => ({
  preset: DEFAULT_PRESET.id,
  strike: false,
  custom: { dark: { ...DEFAULT_PRESET.dark }, light: { ...DEFAULT_PRESET.light } },
});

const normalizeColorSettings = (stored) => {
  const defaults = defaultColorSettings();
  if (!stored) return defaults;
  return {
    preset: PRESETS.some((preset) => preset.id === stored.preset) ? stored.preset : defaults.preset,
    strike: stored.strike === true,
    custom: {
      dark: { ...defaults.custom.dark, ...(stored.custom && stored.custom.dark) },
      light: { ...defaults.custom.light, ...(stored.custom && stored.custom.light) },
    },
  };
};

let mode = "dark";

const setLightMode = (isLight) => {
  mode = isLight ? "light" : "dark";
};

const currentMode = () => mode;

const resolveColors = (colorSettings, forMode = mode) => {
  const preset = PRESETS.find((candidate) => candidate.id === colorSettings.preset) || DEFAULT_PRESET;
  const pair = preset.id === "custom" ? colorSettings.custom[forMode] : preset[forMode];
  return { ...pair, strike: colorSettings.strike };
};

const loadColorSettings = () => normalizeColorSettings(settings.loadPreferences().colors);

const currentColors = () => resolveColors(loadColorSettings());

// UXP setzt text-decoration: line-through nicht um. Die Linie ist darum ein eigenes Element über dem Text.
const addStrikeLine = (element, color) => {
  element.className = `${element.className} struck`;
  const line = document.createElement("span");
  line.className = "strike-line";
  line.style.backgroundColor = color;
  element.appendChild(line);
};

// Farben werden direkt an den Elementen gesetzt: zuverlässiger in UXP als dynamische CSS-Variablen.
const paintChange = (originalElement, correctionElement, colors = currentColors()) => {
  originalElement.style.color = colors.wrong;
  correctionElement.style.color = colors.right;
  if (colors.strike) addStrikeLine(originalElement, colors.wrong);
};

const isHexColor = (text) => /^#[0-9a-f]{6}$/i.test(text);

const luminance = (hex) => {
  const channels = [1, 3, 5]
    .map((start) => parseInt(hex.slice(start, start + 2), 16) / 255)
    .map((value) => (value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
};

const contrastRatio = (hex, forMode = mode) => {
  const [lighter, darker] = [luminance(hex), luminance(REFERENCE_BACKGROUND[forMode])].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
};

module.exports = {
  PRESETS,
  GOOD_CONTRAST,
  normalizeColorSettings,
  loadColorSettings,
  resolveColors,
  currentColors,
  paintChange,
  setLightMode,
  currentMode,
  isHexColor,
  contrastRatio,
};
