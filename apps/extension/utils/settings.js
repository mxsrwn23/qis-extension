import { browser } from "wxt/browser";

const STORAGE_KEY = "qisPlusSettings";
const SEEN_RESULTS_KEY = "qisPlusSeenResults";

// Standardfarben (Apple-Systempalette) — müssen mit :root in style.css des Content-Scripts übereinstimmen.
export const DEFAULT_COLORS = {
  be: "#34c759", // bestanden
  // Eigener Blauton statt Systemblau: "an" (angemeldet) ist ebenfalls blau,
  // ein zu ähnlicher Ton hätte beide Status auf den Notenspiegel-Karten kaum
  // unterscheidbar gemacht.
  pv: "#32ade6", // Prüfungen vorhanden, noch nicht bestanden
  fail: "#ff3b30", // nicht bestanden / endgültig nicht bestanden
  an: "#007aff", // angemeldet, Ergebnis steht noch aus
  wait: "#af52de", // Prüfung geschrieben, Ergebnis steht noch aus
  section: "#8e8e93", // Abschnittstitel (Kern-/Pflicht-/Wahlpflichtmodule)
};

export const DEFAULT_SETTINGS = {
  // "all" = alle bestandenen Versuche zählen, "last" = nur letzter Versuch, "best" = nur beste Note
  avgMode: "all",
  // bestandene Module: Versuchsverlauf einklappen (nicht aufklappbar anzeigen)
  hideCompletedDetails: true,
  // je Modul nur den letzten Prüfungsversuch anzeigen (frühere Versuche ausblenden)
  showOnlyLastAttempt: false,
  // Studienleistungs-Versuche aus dem Verlauf ausblenden
  hideStudienleistungen: false,
  // vom Nutzer überschriebene Statusfarben; leer = Standardfarben
  colors: {},
  // zuletzt gewählter Filter/Sortierung im Notenspiegel ("all"/"passed"/"open",
  // "none"/"grade"/"semester") — bleibt über Seitenaufrufe hinweg erhalten.
  gradesFilter: "all",
  gradesSort: "none",
  // Text des zuletzt gewählten Studiengang-Links im Notenspiegel-Baum (z. B.
  // "Informatik (PO-Version 2019)") — bei mehreren Studiengängen (z. B.
  // dual + regulär) überspringt der Schnellzugriff-Button damit künftig die
  // erneute Auswahl. null = noch keine Wahl gespeichert.
  gradesQuickLinkStudiengang: null,
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

// Zuletzt gesehene Prüfungsergebnisse — Grundlage für das "NEU"-Badge.
// null = noch nie gespeichert (Erstlauf), dann werden keine Badges gezeigt.
export async function loadSeenResults() {
  const stored = await browser.storage.local.get(SEEN_RESULTS_KEY);
  return stored[SEEN_RESULTS_KEY] ?? null;
}

export async function saveSeenResults(map) {
  await browser.storage.local.set({ [SEEN_RESULTS_KEY]: map });
}
