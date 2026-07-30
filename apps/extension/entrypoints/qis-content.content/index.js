import "./style.css";
import { loadSettings, saveKnownColumns, loadSeenResults, saveSeenResults } from "../../utils/settings.js";

const DEBUG = false;
const log = (...args) => {
  if (DEBUG) console.log("[QIS+]", ...args);
};

const URL_PARAM_KEY_STATE = "state";
const URL_PARAM_VALUE_NOTEN_UEBERSICHT = "notenspiegelStudent";
const URL_PARAM_VALUE_PRUEFUNGS_ANMELDUNG = "prfAnmStudent";

const NO_RESULT_REMARKS = ["nz", "rt", "ne", "kr"];

const STATUS_CLASSES = [
  "qisplus-status--be",
  "qisplus-status--pv",
  "qisplus-status--fail",
  "qisplus-status--an",
  "qisplus-status--wait",
];

const STATUS_LABELS = {
  be: "Bestanden",
  pv: "Prüfungen vorhanden, aber noch nicht bestanden",
  nb: "Nicht bestanden",
  en: "Endgültig nicht bestanden",
  an: "Angemeldet, Ergebnis steht noch aus",
  wait: "Prüfung geschrieben, Ergebnis steht noch aus",
};

const SECTION_LABELS = {
  kernmodule: "Kernmodule",
  pflichtmodule: "Pflichtmodule",
  wahlpflichtmodule: "Wahlpflichtmodule",
};

async function initNotenUebersicht(settings) {
  let table;
  try {
    // Notentabelle robust anhand der Spaltenüberschriften finden, nicht anhand der Position
    table = getGradesTable();
  } catch (e) {
    log("Notentabelle nicht gefunden.");
    return;
  }
  const tableRows = Array.from(table.querySelectorAll("tbody tr"));
  if (!tableRows.length) {
    log("Notentabelle ist leer.");
    return;
  }

  // Markiert die Notentabelle fürs Styling (mehr Zeilenhöhe, siehe style.css)
  table.classList.add("qisplus-table");

  // Spaltenüberschriften fürs Popup hinterlegen — dort entstehen daraus die
  // "Spalten anzeigen"-Checkboxen.
  const headers = getColumnHeaders(table);
  saveKnownColumns(headers.filter(Boolean)).catch((e) =>
    console.error("[QIS+] Spalten konnten nicht gespeichert werden:", e)
  );

  // Schnitt, NEU-Badges und Warten-Markierung VOR dem Entfernen der
  // Detailzeilen — danach wären die Zeilen detached bzw. weg.
  const avgGrade = calcAvgGrade(tableRows, settings.avgMode);
  await markNewResults(tableRows);
  markWaitingAttempts(tableRows);
  formatTableCells(tableRows, settings.hideCompletedDetails);
  if (settings.showOnlyLastAttempt) {
    hideEarlierAttempts(tableRows);
  }
  if (settings.hideStudienleistungen) {
    hideStudienleistungRows(tableRows);
  }
  hideColumns(table, headers, settings.hiddenColumns);

  const noteCell = Array.from(document.querySelectorAll("th.tabelleheader")).find(
    (e) => e.textContent.trim() === "Note"
  );
  if (noteCell && Number.isFinite(avgGrade)) {
    noteCell.textContent += ` (${avgGrade.toFixed(2)})`;
  }
}

function getColumnHeaders(table) {
  // Nur die echte Kopfzeile (erste Zeile mit <th>) auswerten — QIS nutzt auch
  // in Konto-/Summenzeilen th-Zellen, die sonst die Spaltenliste verfälschen.
  const headerRow = Array.from(table.querySelectorAll("tr")).find((tr) => tr.querySelector("th"));
  return headerRow ? Array.from(headerRow.children).map((c) => c.textContent.trim()) : [];
}

// Spalten per display:none ausblenden statt Zellen zu entfernen — so bleiben
// die festen Spaltenindizes (readAttempt) und der Notenschnitt unberührt.
// Läuft colspan-bewusst durch JEDE Zeile (auch Konto-/Summenzeilen mit weniger
// Zellen), damit Kopf- und Datenzeilen nicht auseinanderlaufen.
function hideColumns(table, headers, hiddenNames) {
  if (!hiddenNames?.length) return;
  const hiddenIdx = new Set(
    headers.map((h, i) => (hiddenNames.includes(h) ? i : -1)).filter((i) => i >= 0)
  );
  if (!hiddenIdx.size) return;

  table.querySelectorAll("tr").forEach((row) => {
    let col = 0;
    for (const cell of row.children) {
      const span = cell.colSpan || 1;
      const coveredHidden = [];
      for (let k = 0; k < span; k++) {
        if (hiddenIdx.has(col + k)) coveredHidden.push(col + k);
      }

      if (coveredHidden.length === span) {
        cell.style.display = "none";
      } else if (coveredHidden.length > 0) {
        // Zelle überspannt sichtbare UND ausgeblendete Spalten:
        // colspan um die ausgeblendeten reduzieren, damit die Breite stimmt
        cell.colSpan = span - coveredHidden.length;
      }
      col += span;
    }
  });
}

// "Nur letzter Versuch": frühere Prüfungsversuche eines Moduls nur ausblenden
// (nicht entfernen), damit der Notenschnitt im Modus "alle Versuche" stimmt.
function hideEarlierAttempts(tableRows) {
  groupRowsByModule(tableRows).forEach((detailRows) => {
    const attempts = detailRows
      .filter((row) => row.isConnected)
      .map((row) => ({
        row,
        versuch: parseInt((row.children?.[8]?.textContent || "").trim(), 10) || 0,
      }));
    const maxVersuch = Math.max(0, ...attempts.map((a) => a.versuch));
    if (maxVersuch <= 1) return;
    attempts.forEach((a) => {
      if (a.versuch < maxVersuch) a.row.style.display = "none";
    });
  });
}

function parseGermanDate(s) {
  const m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec((s || "").trim());
  return m ? new Date(+m[3], +m[2] - 1, +m[1]) : null;
}

// Vermerke, bei denen kein Ergebnis mehr kommt, obwohl Status AN und das
// Prüfungsdatum vorbei ist: NZ = nicht zugelassen, RT = Rücktritt,
// NE = nicht erschienen, KR = krank. Die Prüfung wird dann in einem späteren
// Semester geschrieben — es gibt nichts, worauf gewartet würde.
function markWaitingAttempts(tableRows) {
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);

  tableRows.forEach((row) => {
    if (!row?.children || isModuleRow(row) || isSummaryRow(row)) return;
    const cells = Array.from(row.children);

    const statusCell = cells.find((c) => norm(c.textContent) === "an");
    if (!statusCell) return;

    if (cells.some((c) => NO_RESULT_REMARKS.includes(norm(c.textContent)))) return;

    const examDate = cells.map((c) => parseGermanDate(c.textContent)).find(Boolean);
    if (examDate && examDate <= endOfToday) {
      setStatusClass(statusCell, "qisplus-status--wait", STATUS_LABELS.wait);
    }
  });
}

// "NEU"-Badge: Ergebnisse (Note oder finaler Status) je Prüfungsversuch mit dem
// letzten Besuch vergleichen. Ein frisch aufgetauchtes Ergebnis bekommt ein Badge
// an der Modulzeile und gilt danach sofort als gesehen — beim nächsten Laden ist
// das Badge also wieder weg. Muss VOR formatTableCells laufen, da dort die
// Detailzeilen bestandener Module entfernt werden.
async function markNewResults(tableRows) {
  let prev;
  try {
    prev = await loadSeenResults();
  } catch (e) {
    console.error("[QIS+] Gesehene Ergebnisse konnten nicht geladen werden:", e);
    return;
  }
  const firstRun = prev === null; // Erstlauf: alles speichern, nichts badgen
  const next = {};
  // Zähler je Basis-Schlüssel: identische Zeilen (gleiche Nummer/Text/Semester/
  // Versuch) dürfen sich nicht gegenseitig überschreiben, sonst löst der
  // Vergleich bei jedem Laden erneut aus und das Badge bleibt dauerhaft.
  const keyCounts = new Map();
  let currentModuleRow = null;

  tableRows.forEach((row) => {
    if (!row?.children) return;
    if (isModuleRow(row)) {
      currentModuleRow = row;
      return;
    }
    if (isSummaryRow(row)) {
      currentModuleRow = null;
      return;
    }

    const cells = Array.from(row.children).map((c) => c.textContent.trim());
    if (cells.length < 4) return;

    // Versuch identifizieren: Nummer/Text/Semester + Versuchsnummer + Duplikat-Zähler
    const baseKey = [cells[0], cells[1], cells[2], cells[8] || ""].join("|");
    const n = keyCounts.get(baseKey) || 0;
    keyCounts.set(baseKey, n + 1);
    const key = `${baseKey}#${n}`;

    // Ergebnis = Note, oder finaler Status ohne Note (z.B. "BE" bei Studienleistungen)
    const statusText = cells.map(norm).find((t) => ["be", "nb", "en"].includes(t)) || "";
    const result = cells[3] || statusText;
    next[key] = result;

    // Altformate abfangen: Einträge ohne #-Suffix bzw. als {result, resultSince}-Objekt
    const prevRaw = prev?.[key] ?? (n === 0 ? prev?.[baseKey] : undefined);
    const prevResult = prevRaw && typeof prevRaw === "object" ? prevRaw.result : prevRaw;

    if (result && !firstRun && prevResult !== result) {
      addNewBadge(currentModuleRow?.children?.[1]);
    }
  });

  saveSeenResults(next).catch((e) =>
    console.error("[QIS+] Gesehene Ergebnisse konnten nicht gespeichert werden:", e)
  );
}

function addNewBadge(cell) {
  if (!cell || cell.querySelector(".qisplus-badge-new")) return;
  const badge = document.createElement("span");
  badge.className = "qisplus-badge-new";
  badge.textContent = "NEU";
  cell.appendChild(badge);
}

// Detailzeilen von Studienleistungen ausblenden (nur ausblenden, nicht entfernen —
// Studienleistungen haben zwar keine Note, aber so bleibt die Logik konsistent).
// Modul- und Abschnittszeilen bleiben immer sichtbar.
function hideStudienleistungRows(tableRows) {
  tableRows.forEach((row) => {
    if (!row?.children || isModuleRow(row) || isSummaryRow(row)) return;
    if (norm(row.textContent).includes("studienleistung")) {
      row.style.display = "none";
    }
  });
}

// Vom Nutzer gewählte Farben als CSS-Variablen setzen — überschreibt die
// Standardwerte aus style.css (wirkt auch auf der Prüfungsanmeldungs-Seite).
// Nur valide Hex-Farben übernehmen, damit aus dem Storage kein beliebiges CSS kommt.
function applyCustomColors(colors) {
  for (const [key, value] of Object.entries(colors || {})) {
    if (/^#[0-9a-f]{6}$/i.test(value)) {
      document.documentElement.style.setProperty(`--qisplus-${key}`, value);
    }
  }
}

// Detailzeilen (einzelne Prüfungsversuche) unter ihrer jeweiligen Modul-Übersichtszeile
// gruppieren. Nötig, um beim Notenschnitt zwischen "alle Versuche", "nur letzter Versuch"
// und "nur beste Note" unterscheiden zu können, statt jede gültige Zeile blind aufzusummieren.
function groupRowsByModule(tableRows) {
  const groups = [];
  let current = null;

  tableRows.forEach((row) => {
    if (!row?.children) return;

    if (isModuleRow(row)) {
      current = [];
      groups.push(current);
    } else if (isSummaryRow(row)) {
      current = null; // Abschnittstrenner (z.B. "Wahlpflichtmodule") beendet die Gruppe
    } else if (current) {
      current.push(row);
    }
  });

  return groups;
}

// Detailzeilen (Prüfungsversuche) haben keine eigenen <th>-Header, deshalb hier feste
// Spaltenindizes statt Header-Lookup: 3 = Note, 5 = ECTS-Punkte, 8 = Versuchsnummer.
function readAttempt(row) {
  const gradeCell = row.children[3];
  const ectsCell = row.children[5];
  const versuchCell = row.children[8];
  if (!gradeCell || !ectsCell) return null;

  const grade = parseFloat(gradeCell.textContent.replace(",", "."));
  const ects = parseFloat(ectsCell.textContent.replace(",", "."));
  const versuch = parseInt((versuchCell?.textContent || "").trim(), 10) || 0;

  // fehlende Noten und nicht bestandene Prüfungen ignorieren
  if (!(grade > 0 && grade < 5 && ects > 0)) return null;
  return { grade, ects, versuch };
}

function calcAvgGrade(tableRows, mode = "all") {
  const sum = groupRowsByModule(tableRows).reduce(
    (acc, detailRows) => {
      const attempts = detailRows.map(readAttempt).filter(Boolean);
      if (!attempts.length) return acc;

      let selected;
      if (mode === "last") {
        selected = [attempts.reduce((a, b) => (b.versuch >= a.versuch ? b : a))];
      } else if (mode === "best") {
        selected = [attempts.reduce((a, b) => (b.grade < a.grade ? b : a))];
      } else {
        selected = attempts; // "all"
      }

      selected.forEach((a) => {
        acc.ects += a.ects;
        acc.weighted += a.grade * a.ects;
      });
      return acc;
    },
    { ects: 0, weighted: 0 }
  );

  return sum.ects > 0 ? sum.weighted / sum.ects : NaN;
}

function norm(s) {
  return (s || "").toLocaleLowerCase("de-DE").trim();
}

function isModuleRow(r) {
  return norm(r?.children?.[1]?.textContent).startsWith("modul:");
}

// Übersichtszeilen (Modul- UND Abschnitts-/Trennzeilen wie "Pflichtmodule") tragen
// die Klasse qis_konto/qis_kontoOnTop auf ihrer ersten Zelle, echte Detailzeilen
// (einzelne Prüfungsversuche) dagegen ns_tabelle1_*. So lässt sich zuverlässig
// unterscheiden, wann die "bis zur nächsten Zeile entfernen"-Schleife stoppen muss.
function isSummaryRow(r) {
  const cls = r?.children?.[0]?.className || "";
  return /\bqis_konto(OnTop)?\b/.test(cls);
}

function setStatusClass(cell, cls, title) {
  if (!cell) return;
  cell.classList.remove(...STATUS_CLASSES);
  cell.classList.add(cls);
  if (title) cell.title = title;
}

function formatTableCells(tableRows, hideCompletedDetails = true) {
  const rows = Array.from(tableRows);

  const moduleStatus = (r) => norm(r?.children?.[3]?.textContent);

  rows.forEach((row) => {
    if (!row?.children || !row.isConnected) return;

    if (isModuleRow(row)) {
      // Modul-Status einfärben
      const mStatusCell = row.children[3];
      const status = moduleStatus(row);

      if (status === "be") {
        setStatusClass(mStatusCell, "qisplus-status--be", STATUS_LABELS.be);

        if (hideCompletedDetails) {
          // Nur die reinen Detailzeilen (Prüfungsversuche) entfernen, bis zur nächsten
          // Übersichtszeile (nächstes Modul ODER Abschnittstrenner wie "Wahlpflichtmodule")
          let next = row.nextElementSibling;
          while (next && !isSummaryRow(next)) {
            const toRemove = next;
            next = next.nextElementSibling;
            toRemove.remove();
          }
        }
      } else if (status === "pv") {
        // Prüfungen vorhanden, aber noch nicht bestanden -> offen, nicht "durchgefallen"
        setStatusClass(mStatusCell, "qisplus-status--pv", STATUS_LABELS.pv);
      } else if (status === "nb" || status === "en") {
        // nicht bestanden / endgültig nicht bestanden -> echter Fehlschlag
        setStatusClass(mStatusCell, "qisplus-status--fail", STATUS_LABELS[status]);
      } else if (status === "an") {
        // angemeldet, Ergebnis steht noch aus
        setStatusClass(mStatusCell, "qisplus-status--an", STATUS_LABELS.an);
      }
    }

    // Abschnittszeilen (Kern-/Pflicht-/Wahlpflichtmodule) markieren
    const pk = norm(row?.children?.[1]?.textContent);
    const sectionKey = Object.keys(SECTION_LABELS).find((p) => pk.startsWith(p));
    if (sectionKey) {
      const label = SECTION_LABELS[sectionKey];
      for (const c of row.children) {
        c.classList.add("qisplus-status--section");
        c.title = label;
      }
    }
  });
}

function initPruefungsAnmeldung() {
  setIndicatorsForCompletedCourses();
}

function setIndicatorsForCompletedCourses() {
  document.querySelectorAll("ul li.treelist a.Konto").forEach((e) => {
    if (e.textContent.includes("[Status: BE]")) {
      e.classList.add("qisplus-course--completed");
    }
  });
}

function getGradesTable() {
  // Suche die Notentabelle anhand der Header
  const tables = Array.from(document.querySelectorAll("table"));
  const t = tables.find((tbl) => {
    const headers = Array.from(tbl.querySelectorAll("th")).map((th) => th.textContent.trim());
    return headers.includes("Prüfungstext") && headers.includes("Status");
  });
  if (!t) throw new Error("Notentabelle nicht gefunden");
  return t;
}

export default defineContentScript({
  matches: ["*://qis.hochschule-trier.de/*"],
  runAt: "document_idle",
  async main() {
    // Safari injiziert Content-Scripts manchmal doppelt (z.B. bei BFCache-Restore).
    // Ohne diese Sperre würde die Seite trotzdem ein zweites Mal bearbeitet
    // (Zeilen doppelt entfernt, Notenschnitt doppelt angehängt usw.).
    if (window.__qisPlusContentScriptLoaded) {
      log("content script bereits geladen, überspringe erneute Ausführung.");
      return;
    }
    window.__qisPlusContentScriptLoaded = true;
    log("content script loaded on", location.href);

    const urlParams = new URLSearchParams(location.search);
    const state = urlParams.get(URL_PARAM_KEY_STATE);

    // Fällt auf die Defaults zurück, falls das Laden aus storage.local (noch)
    // fehlschlägt — ein Settings-Fehler darf nicht die komplette
    // Formatierung/Notenschnitt-Berechnung lahmlegen.
    let settings;
    try {
      settings = await loadSettings();
    } catch (e) {
      console.error("[QIS+] Settings konnten nicht geladen werden, nutze Defaults:", e);
      settings = {
        avgMode: "all",
        hideCompletedDetails: true,
        showOnlyLastAttempt: false,
        hideStudienleistungen: false,
        hiddenColumns: [],
        colors: {},
      };
    }

    applyCustomColors(settings.colors);

    // check site (Prüfungsan- und abmeldung, Info über angemeldete Prüfungen, ..., Notenübersicht)
    switch (state) {
      // NOTENÜBERSICHT/NOTENSPIEGEL
      case URL_PARAM_VALUE_NOTEN_UEBERSICHT:
        await initNotenUebersicht(settings);
        break;
      case URL_PARAM_VALUE_PRUEFUNGS_ANMELDUNG:
        initPruefungsAnmeldung();
        break;
      /**
       * insert other states here if functions on other pages are implemented
       */
      default:
        log("could not identify site. No modifications.");
    }
  },
});
