import { browser } from "wxt/browser";

const STORAGE_KEY = "qisPlusSettings";
const COLUMNS_KEY = "qisPlusKnownColumns";
const SEEN_RESULTS_KEY = "qisPlusSeenResults";

// Standardfarben (Apple-Systempalette) — müssen mit :root in style.css des Content-Scripts übereinstimmen.
export const DEFAULT_COLORS = {
  be: "#34c759", // bestanden
  pv: "#ff9500", // Prüfungen vorhanden, noch nicht bestanden
  fail: "#ff3b30", // nicht bestanden / endgültig nicht bestanden
  an: "#007aff", // angemeldet, Ergebnis steht noch aus
  wait: "#af52de", // Prüfung geschrieben, Ergebnis steht noch aus
  section: "#8e8e93", // Abschnittszeilen (Kern-/Pflicht-/Wahlpflichtmodule)
};

export const DEFAULT_SETTINGS = {
  // "all" = alle bestandenen Versuche zählen, "last" = nur letzter Versuch, "best" = nur beste Note
  avgMode: "all",
  // bestandene Module: Detailzeilen (einzelne Prüfungsversuche) ausblenden
  hideCompletedDetails: true,
  // je Modul nur den letzten Prüfungsversuch anzeigen (frühere Versuche ausblenden)
  showOnlyLastAttempt: false,
  // Detailzeilen von Studienleistungen ausblenden
  hideStudienleistungen: false,
  // Header-Namen der ausgeblendeten Spalten der Notentabelle
  hiddenColumns: [],
  // vom Nutzer überschriebene Statusfarben; leer = Standardfarben
  colors: {},
};

export async function loadSettings() {
  const stored = await browser.storage.local.get(STORAGE_KEY);
  return Object.assign({}, DEFAULT_SETTINGS, stored[STORAGE_KEY] || {});
}

export async function saveSettings(partial) {
  const current = await loadSettings();
  const next = Object.assign({}, current, partial);
  await browser.storage.local.set({ [STORAGE_KEY]: next });
  return next;
}

// Das Content-Script hinterlegt hier die Spaltenüberschriften der Notentabelle,
// damit das Popup daraus die "Spalten anzeigen"-Checkboxen bauen kann.
export async function saveKnownColumns(names) {
  await browser.storage.local.set({ [COLUMNS_KEY]: names });
}

export async function loadKnownColumns() {
  const stored = await browser.storage.local.get(COLUMNS_KEY);
  return stored[COLUMNS_KEY] || [];
}

// Zuletzt gesehene Prüfungsergebnisse — Grundlage für das "NEU"-Badge.
// null = noch nie gespeichert (Erstlauf), dann werden keine Badges gezeigt.
export async function loadSeenResults() {
  const stored = await browser.storage.local.get(SEEN_RESULTS_KEY);
  return stored[SEEN_RESULTS_KEY] ?? null;
}

export async function saveSeenResults(map) {
  await browser.storage.local.set({ [SEEN_RESULTS_KEY]: map });
}
