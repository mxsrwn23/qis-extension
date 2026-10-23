import "./style.css";
import { loadSettings, saveSettings, loadSeenResults, saveSeenResults } from "../../utils/settings.js";
import {
  normText,
  parseGermanDecimal,
  statusCategoryFor,
  semesterKey,
  NOT_ADMITTED_REMARKS,
  WITHDRAWN_REMARKS,
  refineWaitingStatus,
  attemptResult,
  updateSeenResults,
  computeAverage,
  computeTotalEcts,
  attemptsForDisplay,
} from "../../utils/grades-core.js";

const DEBUG = false;
const log = (...args) => {
  if (DEBUG) console.log("[QIS+]", ...args);
};

const DEBOUNCE_MS = 150;
const LEGACY_TABLE_ATTRS = ["width", "height", "align", "valign", "border", "cellpadding", "cellspacing", "bgcolor"];

/* -----------------------------------------------------------------------
   Lade-Overlay für den Notentabelle-Schnellzugriff (siehe weiter unten:
   "Schnellzugriff auf Meine Funktionen"). Deckt den sichtbaren
   Durchklick-Flicker der automatischen Zwischenschritte ab — möglichst früh
   (document_start) registriert, damit kein ungestyltes Zwischenbild
   aufblitzt, bevor nach DOMContentLoaded entschieden wird, ob der nächste
   Sprung automatisch erfolgt oder der Overlay wieder verschwinden soll.
   ------------------------------------------------------------------------- */

const AUTO_GRADES_FLAG = "qisPlusAutoGrades";
const AUTO_GRADES_HOPS_KEY = "qisPlusAutoGradesHops";
const AUTO_GRADES_VISITED_KEY = "qisPlusAutoGradesVisited";
const AUTO_GRADES_OVERLAY_ID = "qis-plus-auto-grades-overlay";

function isAutoGradesPilotActive() {
  try {
    return sessionStorage.getItem(AUTO_GRADES_FLAG) === "1";
  } catch (e) {
    return false;
  }
}

function showAutoGradesOverlay() {
  if (document.getElementById(AUTO_GRADES_OVERLAY_ID)) return;
  const overlay = document.createElement("div");
  overlay.id = AUTO_GRADES_OVERLAY_ID;
  overlay.innerHTML =
    '<div class="qis-auto-grades-spinner"></div><div class="qis-auto-grades-text">Notentabelle wird geöffnet …</div>';
  const mount = () => {
    if (document.getElementById(AUTO_GRADES_OVERLAY_ID)) return;
    (document.body || document.documentElement).appendChild(overlay);
  };
  if (document.body) {
    mount();
  } else {
    // document_start: <body> existiert ggf. noch nicht.
    new MutationObserver((_, observer) => {
      if (document.body) {
        mount();
        observer.disconnect();
      }
    }).observe(document.documentElement, { childList: true, subtree: true });
  }
}

function hideAutoGradesOverlay() {
  const overlay = document.getElementById(AUTO_GRADES_OVERLAY_ID);
  if (overlay) overlay.remove();
}

(function maybeShowAutoGradesOverlay() {
  if (isAutoGradesPilotActive()) showAutoGradesOverlay();
})();

// QIS liefert keinen Viewport-Meta-Tag (klassische Desktop-Java-Webanwendung).
// Ohne ihn rendert mobile Safari/Chrome die Seite auf einem virtuellen
// ~980px-Layout-Viewport und zoomt nur verkleinert heraus — unsere
// @media(max-width: 900px)-Regeln (Bottom-Nav, responsive Tabellen, große
// Touch-Targets) greifen dadurch auf echten Handys nie.
// Läuft bei run_at:"document_start", damit das Tag vor der ersten
// Layout-Berechnung sitzt — iOS Safari berücksichtigt ein nachträglich per
// JS eingefügtes Viewport-Meta sonst teils nicht zuverlässig rückwirkend.
// <head> existiert bei document_start ggf. noch nicht, daher Retry per
// MutationObserver.
(function ensureViewportMeta() {
  function apply() {
    if (!document.head) return false;
    let meta = document.querySelector('meta[name="viewport"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "viewport";
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", "width=device-width, initial-scale=1");
    return true;
  }
  if (!apply()) {
    new MutationObserver((_, observer) => {
      if (apply()) observer.disconnect();
    }).observe(document.documentElement, { childList: true, subtree: true });
  }
})();

function debounce(fn, wait) {
  let timer = null;
  return function debounced(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(null, args), wait);
  };
}

/** Safari behandelt von Extensions injiziertes CSS mit niedrigerer Priorität
 *  als das CSS der Seite selbst — dort verliert unser !important im
 *  Stylesheet gegen QIS' eigene, sogar nicht-important Regeln (z. B. das
 *  harte "min-width: 380px" auf .portalcontent2). Chrome/Firefox betroffen
 *  das nicht, dort reicht das Stylesheet allein. Inline-!important per JS
 *  gewinnt browserübergreifend immer, deshalb setzen wir die kritischen
 *  Layout-Overrides zusätzlich direkt am Element. */
const LOGIN_LAYOUT_OVERRIDES = {
  float: "none",
  width: "auto",
  "min-width": "0",
  "max-width": "100%",
};

/** Wie forceLoginLayout, nur für die Sidebar #makronavigation: die QIS-Eigenen
 *  Regeln (weißer/heller Hintergrund, dunkle Link-Farben, aktiver Menüpunkt
 *  ohne sichtbaren Zustand) gewinnen auf Safari gegen unser injiziertes
 *  Stylesheet. Deshalb Hintergrund/Rahmen/Schriftfarben zusätzlich inline mit
 *  !important setzen — Werte live aus den CSS-Variablen gelesen, damit sich
 *  helle und dunkle Einstellung ohne Neuladen korrekt verhalten. */
function applySidebarOverrides() {
  const nav = document.getElementById("makronavigation");
  if (!nav) return;
  const cs = getComputedStyle(document.documentElement);
  const varValue = (name) => cs.getPropertyValue(name).trim();
  const surface = varValue("--qis-surface");
  const border = varValue("--qis-border");
  const text = varValue("--qis-text");
  const heading = varValue("--qis-heading");
  const activeTint = varValue("--qis-active-tint");
  const imp = (el, prop, value) => el.style.setProperty(prop, value, "important");

  imp(nav, "background", surface || "#ffffff");
  imp(nav, "border-color", border || "#e2e6eb");
  imp(nav, "border-width", "1px");
  imp(nav, "border-style", "solid");

  // QIS gibt Listen/Knoten teils eigene (helle) Hintergründe — abräumen, damit
  // keine weißen Flächen durch unsere Karten-/Zeilen-Optik schimmern.
  nav.querySelectorAll("ul, li").forEach((el) => {
    imp(el, "background", "transparent");
    imp(el, "border", "none"); // auch die weißen gestrichelten Linien weg
  });

  nav.querySelectorAll("a").forEach((a) => {
    imp(a, "border", "none"); // QIS setzt fest weiße gestrichelte Unterstreichungen
    // Schriftfarbe normal (ohne !important), damit die Hover-Regeln aus
    // style.css weiterhin greifen können.
    a.style.color = text || "#1c2733";
    const active = a.classList.contains("visited") || Boolean(a.closest(".submenuCss"));
    if (active) imp(a, "background", activeTint || "rgba(0, 60, 98, 0.08)");
  });
}

function forceLoginLayout(root) {
  root.querySelectorAll(".portalcontent, .portalcontent1, .portalcontent2, form.formular, .containerLogin, .mikronavi_list, form").forEach((el) => {
    if (el.dataset.qisLoginLayoutFixed) return;
    Object.entries(LOGIN_LAYOUT_OVERRIDES).forEach(([prop, value]) => {
      el.style.setProperty(prop, value, "important");
    });
    el.dataset.qisLoginLayoutFixed = "1";
  });

  // Kompakte, zentrierte Login-Box statt über die volle (auf Desktop teils
  // sehr breite) .content-Karte gestreckt.
  root.querySelectorAll(".portalcontent").forEach((el) => {
    if (el.dataset.qisLoginBoxCentered) return;
    el.style.setProperty("max-width", "360px", "important");
    el.style.setProperty("margin", "0 auto", "important");
    el.dataset.qisLoginBoxCentered = "1";
  });

  // Auch die äußere Content-Karte selbst eng um den Login-Inhalt schrumpfen
  // statt über die volle (auf Desktop teils sehr breite) Fläche gestreckt.
  // Nur Karten mit Login-Formular — .content_max_portal_qis wird auch für
  // andere Portal-Seiten (z. B. Prüfungsverwaltung-Menü) verwendet, die
  // weiter die volle Breite brauchen.
  root.querySelectorAll(".content_max_portal_qis").forEach((el) => {
    if (el.dataset.qisCardShrunk || !el.querySelector(".portalcontent")) return;
    el.style.setProperty("max-width", "420px", "important");
    el.style.setProperty("margin", "0 auto", "important");
    el.dataset.qisCardShrunk = "1";
  });

  // Die Eingabefeld-/Button-Spalte (.containerLogin ol, max-width:420px) saß
  // linksbündig in der (jetzt volle Breite einnehmenden) .containerLogin —
  // der Anmelden-Button wirkte dadurch nach rechts verschoben, sobald man
  // ihn separat innerhalb der ganzen Box zentrierte. Richtig ist: die ganze
  // Spalte zentrieren, dann darin den Button zentrieren.
  root.querySelectorAll(".containerLogin ol").forEach((ol) => {
    if (ol.dataset.qisColumnCentered) return;
    ol.style.setProperty("margin", "0 auto", "important");
    ol.dataset.qisColumnCentered = "1";
  });

  // QIS platziert vor dem Anmelden-Button einen <span class="nolabel"> —
  // Platzhalter aus dem alten Label-Spalten-Layout mit "float:left;
  // width:40%" (per Inspector bestätigt). Der schwebt weiterhin als
  // unsichtbare Spalte und schiebt den Button nach rechts, egal welche
  // Zentrierungstechnik man auf den Button/die Zeile anwendet — floats
  // verdrängen nachfolgenden Inhalt nach rechts. Komplett ausblenden statt
  // nur zu neutralisieren, da er nur ein &nbsp; enthält.
  root.querySelectorAll(".nolabel").forEach((span) => {
    if (span.dataset.qisNolabelHidden) return;
    span.style.setProperty("display", "none", "important");
    span.dataset.qisNolabelHidden = "1";
  });

  // Zentriert den Anmelden-Button anhand seiner eigenen Breite und rundet
  // die Ecken (Stylesheet-Wert allein kam auf Safari nicht zuverlässig an).
  root.querySelectorAll('.containerLogin input[type="submit"]').forEach((submit) => {
    if (submit.dataset.qisSubmitCentered) return;
    submit.style.setProperty("display", "block", "important");
    submit.style.setProperty("margin", "0 auto", "important");
    submit.style.setProperty("border-radius", "12px", "important");
    submit.dataset.qisSubmitCentered = "1";
  });

  // Schreibgeschützte Info-Felder (z. B. Stammdaten: Name, Geburtsort ...)
  // sind teils echte <input readonly>, teils reiner Zellentext — dadurch
  // wirkten die Werte uneinheitlich (manche mit Rahmen/Box, manche ohne).
  root.querySelectorAll("input[readonly], input:disabled").forEach((el) => {
    if (el.dataset.qisReadonlyPlain) return;
    el.style.setProperty("border", "none", "important");
    el.style.setProperty("background", "transparent", "important");
    el.style.setProperty("padding", "0", "important");
    el.style.setProperty("min-height", "0", "important");
    el.style.setProperty("box-shadow", "none", "important");
    el.dataset.qisReadonlyPlain = "1";
  });
}

/** Entfernt veraltete Präsentations-Attribute von Tabellen-Elementen, damit die
 *  CSS-Regeln (Flex/Grid, max-width: 100%) die Kontrolle über das Layout
 *  übernehmen können, statt gegen inline HTML4-Attribute zu kämpfen. */
function stripLegacyTableAttrs(root) {
  root.querySelectorAll("table, tr, td, th, tbody, thead").forEach((el) => {
    if (el.dataset.qisCleaned) return;
    LEGACY_TABLE_ATTRS.forEach((attr) => el.removeAttribute(attr));
    el.dataset.qisCleaned = "1";
  });
}

/** Entfernt feste Pixel-Breiten/-Höhen aus inline style-Attributen, ohne
 *  funktionale Deklarationen wie display:none anzutasten. */
function stripInlineDimensions(root) {
  root.querySelectorAll("[style]").forEach((el) => {
    if (el.dataset.qisDimCleaned) return;
    if (el.style.width) el.style.removeProperty("width");
    if (el.style.height && el.tagName !== "IMG") el.style.removeProperty("height");
    el.dataset.qisDimCleaned = "1";
  });
}

/** Markiert Schlüssel/Wert-Tabellen (z. B. "Stammdaten des Studierenden") mit
 *  einer eigenen Klasse, damit styles.css table-layout gezielt darauf anwenden
 *  kann. */
function markKeyValueTables(root) {
  root.querySelectorAll("table:not(.qis-kv-table)").forEach((table) => {
    if (table.querySelector("th.mod_header")) table.classList.add("qis-kv-table");
  });
}

/** Wickelt breite Datentabellen in einen horizontal scrollbaren Container und
 *  beschriftet jede Zelle mit dem zugehörigen Spaltenkopf, damit CSS sie auf
 *  Mobilgeräten als Karten (Label + Wert) darstellen kann. */
function makeTablesResponsive(root) {
  root.querySelectorAll("table:not([data-qis-wrapped])").forEach((table) => {
    table.dataset.qisWrapped = "1";

    // KV-Klasse atomar MIT dem Wrapping setzen (nicht erst im nächsten
    // enhance-Durchlauf): QIS kann die Tabelle nach dem ersten Rendern
    // asynchron neu aufbauen — wäre die Klasse nur im Folgepass da, blitzte
    // die generische Karten-Ansicht kurz zwischenzeitlich auf.
    if (table.querySelector("th.mod_header")) table.classList.add("qis-kv-table");

    const headerRow = table.querySelector("tr");
    const headerCells = headerRow ? Array.from(headerRow.querySelectorAll("th")) : [];
    if (headerCells.length > 1) {
      headerRow.classList.add("qis-table-head-row");
      const labels = headerCells.map((th) => th.textContent.trim());
      Array.from(table.querySelectorAll("tr")).forEach((row) => {
        if (row === headerRow) return;
        const cells = Array.from(row.children).filter((c) => c.tagName === "TD");
        let labelIndex = 0;
        cells.forEach((td) => {
          const span = parseInt(td.getAttribute("colspan") || "1", 10);
          if (labels[labelIndex]) td.setAttribute("data-label", labels[labelIndex]);
          labelIndex += span;
        });
      });
    }

    if (table.rows.length < 2 || table.parentElement.classList.contains("qis-table-scroll")) return;
    const wrapper = document.createElement("div");
    wrapper.className = "qis-table-scroll";
    table.parentNode.insertBefore(wrapper, table);
    wrapper.appendChild(table);
  });
}

/** Key/Value-Tabellen ("Stammdaten des Studierenden", "Studienverlauf", …):
 *  In der mobilen Ansicht wird die Abschnitts-Überschrift (th[colspan]) durch
 *  einen klickbaren Button ersetzt, der den Tabelleninhalt ein-/ausklappt.
 *  Desktop bleibt unverändert — der Button wird dort per CSS ausgeblendet. */
function makeKvTablesCollapsible(root) {
  root.querySelectorAll("table.qis-kv-table:not([data-qis-kv-toggle])").forEach((table) => {
    const headingCell = table.querySelector("th[colspan]");
    const title = (headingCell || table.querySelector("caption, .t_capt"))?.textContent?.trim();
    if (!title) return;
    table.dataset.qisKvToggle = "1";
    table.classList.add("qis-kv-collapsible");

    // Die original Überschriftszeile in der Tabelle ausblenden (der Button
    // übernimmt sie), damit beim Entklappen kein Doppeln erscheint.
    if (headingCell) {
      const headingRow = headingCell.closest("tr");
      if (headingRow) headingRow.classList.add("qis-kv-heading-row");
    }
    // Gehört die Überschrift als <caption>/.t_capt oberhalb der Tabelle,
    // ebenfalls verstecken, falls sie denselben Titel trägt.
    const caption = table.querySelector("caption, .t_capt");
    if (caption && !headingCell && caption.textContent.trim() === title) {
      caption.classList.add("qis-kv-heading-row");
    }

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "qis-kv-toggle";
    toggle.textContent = title;
    toggle.setAttribute("aria-expanded", "false");

    toggle.addEventListener("click", () => {
      const expanded = table.classList.toggle("qis-kv-expanded");
      toggle.classList.toggle("qis-kv-expanded", expanded);
      toggle.setAttribute("aria-expanded", String(expanded));
    });

    // Vor dem Scroll-Wrapper (falls vorhanden) einfügen, damit der Button in
    // der mobilen Vollbreite (gleicher Negative-Margin-Bereich) erscheint.
    const anchor = table.parentElement?.classList.contains("qis-table-scroll")
      ? table.parentElement
      : table;
    anchor.parentNode.insertBefore(toggle, anchor);
  });
}

/* -----------------------------------------------------------------------
   Notenspiegel — card-based grade view
   Ersetzt die rohe QIS-Notentabelle auf state=notenspiegelStudent durch eine
   Karten-Ansicht (KPI-Kopfzeile, Filter/Sortierung, aufklappbare Modul-Karten
   mit Versuchen).
   ------------------------------------------------------------------------- */

const GRADE_STATUS_LABELS = {
  be: "Bestanden",
  pv: "Offen",
  fail: "Nicht bestanden",
  an: "Angemeldet",
  wait: "Prüfung geschrieben",
  notAdmitted: "Nicht zugelassen",
  noResult: "Kein Ergebnis",
};
const DEGREE_ABBR = {
  "bachelor of science": "B.Sc.",
  "master of science": "M.Sc.",
  "bachelor of arts": "B.A.",
  "master of arts": "M.A.",
  "bachelor of engineering": "B.Eng.",
  "master of engineering": "M.Eng.",
};

function findGradesTable(root) {
  return Array.from(root.querySelectorAll("table")).find((t) => {
    const headerCells = t.querySelectorAll("th.tabelleheader");
    if (headerCells.length < 5) return false;
    const labels = Array.from(headerCells).map((th) => normText(th.textContent).toLowerCase());
    return labels.some((l) => l.includes("prüfungstext")) && labels.some((l) => l.includes("ects"));
  });
}

/** Platziert die Zellen einer Zeile in einem Grid fester Breite (colspan- und
 *  rowspan-bewusst). Nötig, weil QIS z. B. bei Abschnitts-/Modul-Zeilen
 *  "Prüfungstext" und "Semester" per colspan="2" zu einer Zelle verschmilzt —
 *  ohne Grid-Ausrichtung würden alle Folgespalten für diese Zeilen um eine
 *  Position nach links rutschen. */
function gridCellsForRow(row, columnCount, rowspanCarry) {
  const directCells = Array.from(row.children).filter((c) => c.tagName === "TD" || c.tagName === "TH");
  let values = new Array(columnCount).fill("");
  let cellIndex = 0;
  let column = 0;

  while (column < columnCount) {
    const remaining = rowspanCarry[column] || 0;
    if (remaining > 0) {
      rowspanCarry[column] = remaining - 1;
      column += 1;
      continue;
    }
    if (cellIndex >= directCells.length) break;
    const cell = directCells[cellIndex];
    cellIndex += 1;
    const text = normText(cell.textContent);
    const colspan = Math.max(1, parseInt(cell.getAttribute("colspan") || "1", 10) || 1);
    const rowspan = Math.max(1, parseInt(cell.getAttribute("rowspan") || "1", 10) || 1);
    for (let offset = 0; offset < colspan && column + offset < columnCount; offset += 1) {
      values[column + offset] = offset === 0 ? text : "";
      if (rowspan > 1) rowspanCarry[column + offset] = rowspan - 1;
    }
    column += colspan;
  }

  // Sicherheitsnetz: Falls die Carry-Buchführung von der echten Tabelle
  // abgedriftet ist und dadurch alle Spalten dieser Zeile "verschluckt"
  // wurden, Carry zurücksetzen und die Zellen dieser einen Zeile flach
  // platzieren, statt sie (und folgende Zeilen) zu verlieren.
  if (cellIndex === 0 && directCells.length) {
    Object.keys(rowspanCarry).forEach((k) => delete rowspanCarry[k]);
    values = directCells.map((c) => normText(c.textContent));
    if (values.length < columnCount) values = values.concat(new Array(columnCount - values.length).fill(""));
    else if (values.length > columnCount) values = values.slice(0, columnCount);
  }

  return values;
}

/** Wandelt die rohen Notenspiegel-Zeilen in ein Modul-pro-Karte-Modell um.
 *  QIS markiert Zeilenarten nicht per Klasse, sondern über die Zell-Klasse der
 *  ersten Spalte (qis_kontoOnTop = Gesamtsumme, qis_konto = Abschnitt ODER
 *  Modul, ns_tabelle1_* = Versuchs-/Detailzeile) kombiniert mit dem
 *  "Modul:"-Präfix im Prüfungstext, der Abschnitte von Modulzeilen
 *  unterscheidet. */
function parseGradesTable(table) {
  const headerCells = Array.from(table.querySelectorAll("th.tabelleheader"));
  const labels = headerCells.map((th) => normText(th.textContent).toLowerCase());
  const colIndex = (kw) => labels.findIndex((l) => l.includes(kw));
  const col = {
    text: colIndex("prüfungstext"),
    semester: colIndex("semester"),
    note: colIndex("note"),
    status: colIndex("status"),
    ects: colIndex("ects"),
    // "Freiversuch" enthält ebenfalls das Substring "versuch" und steht in der
    // Spaltenreihenfolge vor "Versuch" — ohne den Ausschluss würde hier immer
    // die falsche (meist leere) Spalte gefunden.
    versuch: labels.findIndex((l) => l.includes("versuch") && !l.includes("frei")),
    datum: colIndex("datum"),
  };
  if (col.text === -1 || col.note === -1 || col.ects === -1) return null;

  const columnCount = labels.length;
  const rowspanCarry = {};
  const bodyRows = Array.from(table.rows).slice(1);
  const cellText = (values, index) => (index >= 0 && index < values.length ? values[index] : "");
  const rowKind = (row) => {
    const firstClass = row.children[0] ? row.children[0].className : "";
    if (firstClass.includes("qis_kontoOnTop")) return "total";
    if (firstClass.includes("qis_konto")) return "konto";
    return "detail";
  };

  const modules = [];
  let currentSection = null;
  let currentModule = null;

  bodyRows.forEach((row) => {
    const values = gridCellsForRow(row, columnCount, rowspanCarry);
    const kind = rowKind(row);
    if (kind === "total") return;

    if (kind === "konto") {
      const text = cellText(values, col.text);
      if (!text.startsWith("Modul:")) {
        currentSection = text;
        currentModule = null;
        return;
      }
      const status = cellText(values, col.status);
      currentModule = {
        section: currentSection,
        name: text.replace(/^Modul:\s*/, ""),
        grade: cellText(values, col.note),
        status,
        statusCategory: statusCategoryFor(status),
        ects: cellText(values, col.ects),
        attempts: [],
        remarkTexts: [],
      };
      modules.push(currentModule);
      return;
    }

    // detail/attempt row
    if (!currentModule) return;
    currentModule.attempts.push({
      semester: cellText(values, col.semester),
      note: cellText(values, col.note),
      ectsRaw: cellText(values, col.ects),
      versuch: cellText(values, col.versuch),
      datum: cellText(values, col.datum),
      status: cellText(values, col.status),
      // Prüfungsvorleistung (Studienleistung): eigener Versuch desselben
      // Moduls, aber keine reguläre Prüfung — im eigenen Zeilentext erkennbar
      // an "(Studienleistung)".
      isStudienleistung: cellText(values, col.text).toLowerCase().includes("studienleistung"),
    });
    values.forEach((v) => currentModule.remarkTexts.push(v.toLowerCase()));
  });

  // Vermerk-Codes (NZ/RT/NE/KR) können in einer beliebigen Detailspalte
  // stehen; solange kein finales Ergebnis vorliegt, ersetzen sie den
  // regulären Status.
  modules.forEach((m) => {
    if (m.statusCategory !== "be" && m.statusCategory !== "fail") {
      if (m.remarkTexts.some((t) => NOT_ADMITTED_REMARKS.has(t))) m.statusCategory = "notAdmitted";
      else if (m.remarkTexts.some((t) => WITHDRAWN_REMARKS.has(t))) m.statusCategory = "noResult";
    }
    delete m.remarkTexts;
  });

  return modules;
}

/** Liest Abschluss/Fach aus der Stammdaten-Tabelle oberhalb des Notenspiegels,
 *  um Kopfzeilen-Label und Ziel-ECTS (Bachelor 180 / Master 120) automatisch
 *  zu bestimmen. */
function detectGradesMeta(root) {
  let abschluss = "";
  let fach = "";
  root.querySelectorAll("table tr").forEach((row) => {
    const label = normText(row.children[0]?.textContent).toLowerCase();
    const value = normText(row.children[1]?.textContent);
    if (!value || row.children.length < 2) return;
    if (label.includes("abschluss")) abschluss = value;
    else if (label === "fach") fach = value;
  });
  const degreeAbbr = abschluss ? DEGREE_ABBR[abschluss.toLowerCase()] || abschluss : "";
  const fachName = fach.replace(/\s*\(PO-Version\s*\d{4}\)/i, "").trim();
  const studiengang = [degreeAbbr, fachName].filter(Boolean).join(" ");
  const targetEcts = abschluss.toLowerCase().includes("master") ? 120 : 180;
  return { studiengang, targetEcts };
}

/** Vergleicht die aktuellen Versuchsergebnisse mit dem letzten bekannten Stand
 *  und markiert Module mit geändertem/neuem Ergebnis als `isNew` (reine Logik
 *  in updateSeenResults). Danach gilt der aktuelle Stand sofort als gesehen —
 *  beim nächsten Laden ist das Badge wieder weg. Erstlauf (noch nichts
 *  gespeichert) badgt nichts. */
async function markNewModules(modules) {
  let prev;
  try {
    prev = await loadSeenResults();
  } catch (e) {
    console.error("[QIS+] Gesehene Ergebnisse konnten nicht geladen werden:", e);
    return;
  }

  const next = updateSeenResults(modules, prev);

  saveSeenResults(next).catch((e) =>
    console.error("[QIS+] Gesehene Ergebnisse konnten nicht gespeichert werden:", e)
  );
}

function buildChevron() {
  const host = document.createElement("span");
  host.className = "qis-chevron";
  host.innerHTML =
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
  return host.firstChild;
}

function renderModuleCard(module, attempts) {
  const card = document.createElement("div");
  card.className = "qis-module-card";

  const header = document.createElement("button");
  header.type = "button";
  header.className = "qis-module-header";

  const info = document.createElement("div");
  info.className = "qis-module-info";
  const name = document.createElement("div");
  name.className = "qis-module-name";
  name.textContent = module.name;
  info.appendChild(name);

  const badges = document.createElement("div");
  badges.className = "qis-module-badges";
  if (module.isNew) {
    const newChip = document.createElement("span");
    newChip.className = "qis-chip qis-chip-new";
    newChip.textContent = "NEU";
    badges.appendChild(newChip);
  }
  if (module.status) {
    const chip = document.createElement("span");
    chip.className = "qis-chip qis-chip-status";
    if (module.statusCategory) chip.dataset.status = module.statusCategory;
    chip.textContent = GRADE_STATUS_LABELS[module.statusCategory] || module.status;
    badges.appendChild(chip);
  }
  if (module.ects) {
    const ectsChip = document.createElement("span");
    ectsChip.className = "qis-chip qis-chip-ects";
    ectsChip.textContent = `${module.ects} ECTS`;
    badges.appendChild(ectsChip);
  }
  if (badges.children.length) info.appendChild(badges);
  header.appendChild(info);

  const gradeWrap = document.createElement("div");
  gradeWrap.className = "qis-module-grade";
  const gradeValue = document.createElement("span");
  gradeValue.className = "qis-grade-value";
  gradeValue.textContent = module.grade || "–";
  gradeWrap.appendChild(gradeValue);
  if (attempts.length) gradeWrap.appendChild(buildChevron());
  header.appendChild(gradeWrap);

  card.appendChild(header);

  if (attempts.length) {
    const attemptsWrap = document.createElement("div");
    attemptsWrap.className = "qis-module-attempts";
    attemptsWrap.hidden = !module.isNew;
    if (module.isNew) card.classList.add("qis-expanded");
    attempts.forEach((attempt) => {
      const row = document.createElement("div");
      row.className = "qis-attempt-row";
      const isFailed = ["nb", "en"].includes(normText(attempt.status).toLowerCase());
      if (isFailed) row.classList.add("qis-attempt-failed");

      const semesterEl = document.createElement("span");
      semesterEl.className = "qis-attempt-semester";
      semesterEl.textContent = attempt.semester;
      const noteEl = document.createElement("span");
      noteEl.className = "qis-attempt-note";
      noteEl.textContent = attempt.note || "–";
      const versuchEl = document.createElement("span");
      versuchEl.className = "qis-attempt-versuch";
      versuchEl.textContent = attempt.versuch ? `Versuch ${attempt.versuch}` : "";
      const datumEl = document.createElement("span");
      datumEl.className = "qis-attempt-datum";
      datumEl.textContent = attempt.datum;

      row.append(semesterEl, noteEl, versuchEl, datumEl);
      if (attempt.isStudienleistung) {
        const pvTag = document.createElement("span");
        pvTag.className = "qis-attempt-tag";
        pvTag.textContent = "PV";
        pvTag.title = "Prüfungsvorleistung (Studienleistung)";
        row.insertBefore(pvTag, versuchEl);
      }
      attemptsWrap.appendChild(row);
    });
    card.appendChild(attemptsWrap);

    header.setAttribute("aria-expanded", String(!!module.isNew));
    header.addEventListener("click", () => {
      const expanded = card.classList.toggle("qis-expanded");
      attemptsWrap.hidden = !expanded;
      header.setAttribute("aria-expanded", String(expanded));
    });
  } else {
    header.classList.add("qis-module-header-static");
  }

  return card;
}

function renderGradesList(listEl, modules, state, settings) {
  listEl.textContent = "";
  const items = modules.filter((m) => {
    if (state.filter === "passed") return m.statusCategory === "be";
    if (state.filter === "open") return m.statusCategory !== "be";
    return true;
  });

  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "qis-grades-empty";
    empty.textContent = "Keine Module gefunden";
    listEl.appendChild(empty);
    return;
  }

  const appendCard = (m) => listEl.appendChild(renderModuleCard(m, attemptsForDisplay(m, settings)));

  if (state.sort === "none") {
    let currentSection;
    items.forEach((m) => {
      if (m.section !== currentSection) {
        currentSection = m.section;
        if (m.section) {
          const title = document.createElement("div");
          title.className = "qis-grades-section-title";
          title.textContent = m.section;
          listEl.appendChild(title);
        }
      }
      appendCard(m);
    });
    return;
  }

  const sorted = items.slice().sort((a, b) => {
    if (state.sort === "grade") {
      const ga = parseGermanDecimal(a.grade);
      const gb = parseGermanDecimal(b.grade);
      if (ga !== null && gb !== null) return ga - gb;
      if (ga === null && gb === null) return 0;
      return ga === null ? 1 : -1;
    }
    const ka = semesterKey(a.attempts[a.attempts.length - 1]?.semester);
    const kb = semesterKey(b.attempts[b.attempts.length - 1]?.semester);
    return kb - ka;
  });
  sorted.forEach(appendCard);
}

function buildGradesStat(value, label) {
  const stat = document.createElement("div");
  stat.className = "qis-grades-stat";
  const valueEl = document.createElement("span");
  valueEl.className = "qis-grades-stat-value";
  valueEl.textContent = value;
  const labelEl = document.createElement("span");
  labelEl.className = "qis-grades-stat-label";
  labelEl.textContent = label;
  stat.append(valueEl, labelEl);
  return stat;
}

function buildKpiHeader(meta, average, totalEcts) {
  const wrap = document.createElement("div");
  wrap.className = "qis-grades-kpi";

  const overline = document.createElement("div");
  overline.className = "qis-grades-overline";
  overline.textContent = meta.studiengang || "Notenspiegel";
  wrap.appendChild(overline);

  const stats = document.createElement("div");
  stats.className = "qis-grades-stats";
  stats.appendChild(buildGradesStat(average !== null ? average.toFixed(2).replace(".", ",") : "–", "Schnitt"));

  const ectsStat = buildGradesStat(
    totalEcts % 1 === 0 ? String(totalEcts) : totalEcts.toFixed(1).replace(".", ","),
    `ECTS von ${meta.targetEcts}`
  );
  const progress = document.createElement("div");
  progress.className = "qis-grades-progress";
  const fill = document.createElement("div");
  fill.className = "qis-grades-progress-fill";
  const ratio = meta.targetEcts > 0 ? Math.min(Math.max(totalEcts / meta.targetEcts, 0), 1) : 0;
  fill.style.width = `${(ratio * 100).toFixed(1)}%`;
  progress.appendChild(fill);
  ectsStat.appendChild(progress);
  stats.appendChild(ectsStat);

  wrap.appendChild(stats);
  return wrap;
}

function buildFilterSortBar(state, onChange) {
  const bar = document.createElement("div");
  bar.className = "qis-grades-filterbar";

  const chips = document.createElement("div");
  chips.className = "qis-grades-filterchips";
  [
    ["all", "Alle"],
    ["passed", "Bestanden"],
    ["open", "Offen"],
  ].forEach(([value, label]) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "qis-choice-chip";
    btn.textContent = label;
    btn.dataset.value = value;
    if (state.filter === value) btn.classList.add("qis-active");
    btn.addEventListener("click", () => {
      state.filter = value;
      Array.from(chips.children).forEach((b) => b.classList.toggle("qis-active", b.dataset.value === value));
      saveSettings({ gradesFilter: value }).catch((e) => console.error("[QIS+] Filter konnte nicht gespeichert werden:", e));
      onChange();
    });
    chips.appendChild(btn);
  });
  bar.appendChild(chips);

  const sortSelect = document.createElement("select");
  sortSelect.className = "qis-sort-select";
  sortSelect.setAttribute("aria-label", "Sortierung");
  [
    ["none", "Standard"],
    ["grade", "Note"],
    ["semester", "Semester"],
  ].forEach(([value, label]) => {
    const opt = document.createElement("option");
    opt.value = value;
    opt.textContent = label;
    sortSelect.appendChild(opt);
  });
  sortSelect.value = state.sort;
  sortSelect.addEventListener("change", () => {
    state.sort = sortSelect.value;
    saveSettings({ gradesSort: state.sort }).catch((e) => console.error("[QIS+] Sortierung konnte nicht gespeichert werden:", e));
    onChange();
  });
  bar.appendChild(sortSelect);

  return bar;
}

async function enhanceGradesView(root, settings) {
  if (!location.href.includes("state=notenspiegelStudent")) return;
  const table = findGradesTable(root);
  if (!table || table.dataset.qisGradesBuilt) return;

  let modules;
  try {
    modules = parseGradesTable(table);
  } catch (err) {
    console.error("[QIS+] Notenspiegel-Parsing fehlgeschlagen", err);
    return;
  }
  if (!modules || !modules.length) return;

  // Synchron VOR dem await setzen, damit ein erneuter enhance()-Durchlauf
  // (z. B. vom MutationObserver, während markNewModules noch lädt) nicht
  // parallel an derselben Tabelle baut.
  table.dataset.qisGradesBuilt = "1";
  table.dataset.qisWrapped = "1";

  refineWaitingStatus(modules);
  await markNewModules(modules);

  const meta = detectGradesMeta(root);
  const average = computeAverage(modules, settings.avgMode);
  const totalEcts = computeTotalEcts(modules);

  const container = document.createElement("div");
  container.className = "qis-grades";
  container.appendChild(buildKpiHeader(meta, average, totalEcts));

  const state = { filter: settings.gradesFilter, sort: settings.gradesSort };
  const list = document.createElement("div");
  list.className = "qis-grades-list";
  container.appendChild(buildFilterSortBar(state, () => renderGradesList(list, modules, state, settings)));
  container.appendChild(list);
  renderGradesList(list, modules, state, settings);

  table.parentNode.insertBefore(container, table);
  table.style.display = "none";
}

/* -----------------------------------------------------------------------
   Schnellzugriff auf "Meine Funktionen" — Direktsprung zur Notentabelle.
   Normalerweise: Funktionen → Prüfungsverwaltung → Notenspiegel → Abschluss
   → Studiengang (4 Klicks), obwohl Abschluss/Studiengang für eine Person
   praktisch nie wechseln.
   QIS' Auswahlbaum ist serverseitig zustandsbehaftet (welche Knoten
   "aufgeklappt" sind, hängt vom bisherigen Navigationsverlauf der Session
   ab) — ein Nachbau per Hintergrund-fetch() liefert deshalb je nach
   Sitzungsverlauf unterschiedliche (teils unvollständige) Bäume. Robuster:
   ein "Autopilot"-Flag in sessionStorage, das echte Seitenaufrufe (wie ein
   Klick sie auch auslösen würde) automatisch weiterklickt, bis entweder die
   Notentabelle erreicht ist oder eine echte Entscheidung (z. B. zwischen
   mehreren Studiengängen) ansteht. */

// Funktionen → Prüfungsverwaltung → Notenspiegel → Abschluss → Studiengang
// sind 4 Sprünge im Normalfall — 6 lässt Luft, ohne eine echte Endlosschleife
// (z. B. falls ein Baum-Knoten serverseitig bei jedem Aufruf zwischen
// auf-/zugeklappt umschaltet statt stabil zu bleiben) durchzulassen.
const AUTO_GRADES_MAX_HOPS = 6;

function startAutoGradesPilot() {
  try {
    sessionStorage.setItem(AUTO_GRADES_FLAG, "1");
    sessionStorage.setItem(AUTO_GRADES_HOPS_KEY, "0");
    sessionStorage.setItem(AUTO_GRADES_VISITED_KEY, "[]");
  } catch (e) {
    // sessionStorage kann z. B. im strikten privaten Modus fehlschlagen —
    // der Pilot bleibt dann einfach aus, kein Folgefehler nötig.
  }
  showAutoGradesOverlay();
}

function stopAutoGradesPilot() {
  try {
    sessionStorage.removeItem(AUTO_GRADES_FLAG);
    sessionStorage.removeItem(AUTO_GRADES_HOPS_KEY);
    sessionStorage.removeItem(AUTO_GRADES_VISITED_KEY);
  } catch (e) {
    // s.o.
  }
  hideAutoGradesOverlay();
}

/** Navigiert einen Autopilot-Schritt weiter. Zwei unabhängige Schutzschranken
 *  gegen Endlosschleifen: ein hartes Sprunglimit und eine Erkennung, falls
 *  derselbe Baum-Zustand (URL) ein zweites Mal angesteuert würde — QIS' Baum
 *  ist serverseitig zustandsbehaftet und kann einen Knoten im Einzelfall
 *  zwischen auf-/zugeklappt umschalten statt stabil zu erweitern. */
function advanceAutoGradesPilot(url) {
  let hops;
  let visited;
  try {
    hops = parseInt(sessionStorage.getItem(AUTO_GRADES_HOPS_KEY) || "0", 10) + 1;
    visited = JSON.parse(sessionStorage.getItem(AUTO_GRADES_VISITED_KEY) || "[]");
  } catch (e) {
    hops = AUTO_GRADES_MAX_HOPS + 1; // sessionStorage nicht verfügbar → sicherheitshalber abbrechen
    visited = [];
  }
  if (visited.includes(url)) {
    console.warn("[QIS+] Schnellzugriff Notentabelle abgebrochen (Schleife im QIS-Auswahlbaum erkannt).");
    stopAutoGradesPilot();
    return;
  }
  if (hops > AUTO_GRADES_MAX_HOPS) {
    console.warn("[QIS+] Schnellzugriff Notentabelle abgebrochen (zu viele automatische Sprünge).");
    stopAutoGradesPilot();
    return;
  }
  visited.push(url);
  try {
    sessionStorage.setItem(AUTO_GRADES_HOPS_KEY, String(hops));
    sessionStorage.setItem(AUTO_GRADES_VISITED_KEY, JSON.stringify(visited));
  } catch (e) {
    // s.o.
  }
  location.href = url;
}

/** "Meine Funktionen" ist über mehrere URL-Varianten erreichbar (u. a.
 *  direkt nach dem Login über type=0&category=menu.browse, über die
 *  "Meine Funktionen"-Kachel dagegen über type=8) — beide rendern aber
 *  denselben leeren Hub mit der H1 "Meine Funktionen". Die Überschrift ist
 *  damit der zuverlässigere Anker als die wechselnden type-Parameter.
 *  Der Wrapper um das h1 unterscheidet sich je Variante (type=8: .headline
 *  .headlineText h1, type=0&category=menu.browse: h1 ohne .headline direkt
 *  im Content-Div) — daher wird hier bewusst nur nach h1 innerhalb der
 *  Content-Karte gesucht statt den .headline-Wrapper vorauszusetzen. */
function findFunctionsOverviewHeading(root) {
  const params = new URLSearchParams(location.search);
  if (params.get("state") !== "user") return null;
  const heading = root.querySelector(".content_max_portal_qis h1, .content h1");
  return heading && normText(heading.textContent) === "Meine Funktionen" ? heading : null;
}

function isFunctionsOverviewPage(root) {
  return !!findFunctionsOverviewHeading(root);
}

/** Der Sidebar-Link zur Prüfungsverwaltung trägt (anders als die Links
 *  dahinter) kein Session-Token und ist daher stabil genug, um ihn direkt aus
 *  dem aktuellen DOM zu lesen statt ihn selbst herzuleiten. */
function findPruefungsverwaltungLink(root) {
  const nav = root.getElementById ? root.getElementById("makronavigation") : null;
  if (!nav) return null;
  const link = Array.from(nav.querySelectorAll(".menue a")).find((a) =>
    normText(a.textContent).toLowerCase().includes("prüfungsverwaltung")
  );
  return link ? link.href : null;
}

function buildQuickAccessCard() {
  const card = document.createElement("div");
  card.className = "qis-quicklinks";

  const title = document.createElement("div");
  title.className = "qis-quicklinks-title";
  title.textContent = "Schnellzugriff";
  card.appendChild(title);

  const row = document.createElement("div");
  row.className = "qis-quicklinks-row";
  card.appendChild(row);

  const button = document.createElement("button");
  button.type = "button";
  button.className = "qis-quicklink-btn";
  button.textContent = "Zur Notentabelle";
  row.appendChild(button);

  const status = document.createElement("div");
  status.className = "qis-quicklinks-status";
  card.appendChild(status);

  button.addEventListener("click", () => {
    const pvUrl = findPruefungsverwaltungLink(document);
    if (!pvUrl) {
      status.textContent = "Prüfungsverwaltung-Link nicht gefunden — bitte über die Navigation öffnen.";
      return;
    }
    button.disabled = true;
    button.textContent = "Lädt …";
    startAutoGradesPilot();
    advanceAutoGradesPilot(pvUrl);
  });

  return card;
}

function enhanceFunctionsOverview(root) {
  const heading = findFunctionsOverviewHeading(root);
  if (!heading) return;
  if (document.querySelector(".qis-quicklinks")) return;
  const content = root.querySelector(".content_max_portal_qis") || root.querySelector(".content");
  if (!content) return;
  // type=8 rendert die Überschrift in .headline, type=0&category=menu.browse
  // packt das h1 direkt in ein unbenanntes Div — in beiden Fällen soll die
  // Karte direkt hinter diesem Wrapper landen statt vor dem h1.
  const anchor = heading.closest(".headline") || heading.parentElement || heading;
  const card = buildQuickAccessCard();
  anchor.insertAdjacentElement("afterend", card);
}

/** Setzt die automatische Klickkette fort, solange der Autopilot aktiv ist:
 *  Prüfungsverwaltung-Menü → "Notenspiegel" → (einziger) Abschluss →
 *  (gemerkter oder einziger) Studiengang → Notentabelle. Bei einer echten
 *  Entscheidung (mehrere Studiengänge, noch keine Wahl gespeichert) merkt
 *  sich ein einmaliger Klick-Listener die Auswahl für künftige Durchläufe,
 *  ohne den Klick selbst zu beeinflussen. */
function runAutoGradesPilot(root, settings) {
  if (!isAutoGradesPilotActive()) return;

  if (findGradesTable(root)) {
    stopAutoGradesPilot();
    return;
  }

  if (!location.href.includes("state=notenspiegelStudent")) {
    const nsLink = Array.from(root.querySelectorAll("a")).find((a) =>
      (a.getAttribute("href") || "").includes("state=notenspiegelStudent")
    );
    if (nsLink) advanceAutoGradesPilot(nsLink.href);
    else stopAutoGradesPilot();
    return;
  }

  const leafLinks = Array.from(root.querySelectorAll("li.treelist > a")).filter((a) =>
    (a.getAttribute("href") || "").includes("next=list.vm")
  );

  if (leafLinks.length) {
    if (leafLinks.length === 1) {
      advanceAutoGradesPilot(leafLinks[0].href);
      return;
    }
    const preferred = settings.gradesQuickLinkStudiengang;
    const match = preferred && leafLinks.find((a) => normText(a.textContent) === preferred);
    if (match) {
      advanceAutoGradesPilot(match.href);
      return;
    }
    // Mehrere Studiengänge, noch keine Wahl gespeichert: Entscheidung bleibt
    // beim Nutzer (Klick auf den echten QIS-Baumlink) — wir merken uns seine
    // Wahl für das nächste Mal. Der Klick wird abgefangen (preventDefault),
    // damit die Seite nicht wegnavigiert, bevor der asynchrone Storage-Write
    // abgeschlossen ist — sonst geht die Auswahl im Race gegen die Navigation
    // verloren. Overlay weg (Pilot-Flag bleibt aktiv, damit der Klick noch
    // abgefangen werden kann), damit der Nutzer die echte Auswahl sieht.
    hideAutoGradesOverlay();
    leafLinks.forEach((a) => {
      if (a.dataset.qisAutoGradesBound) return;
      a.dataset.qisAutoGradesBound = "1";
      a.addEventListener("click", (event) => {
        event.preventDefault();
        const href = a.href;
        saveSettings({ gradesQuickLinkStudiengang: normText(a.textContent) })
          .catch((e) => console.error("[QIS+] Studiengang-Auswahl konnte nicht gespeichert werden:", e))
          .finally(() => {
            stopAutoGradesPilot();
            location.href = href;
          });
      });
    });
    return;
  }

  // Noch keine Blätter sichtbar: den (einzigen) nächsten Zweig automatisch
  // aufklappen. Bei mehreren Zweigen (z. B. mehrere Abschlüsse, sehr selten)
  // bricht der Pilot ab und überlässt die Wahl dem Nutzer.
  const branchLinks = Array.from(root.querySelectorAll("li.treelist > a")).filter((a) =>
    (a.getAttribute("href") || "").includes("next=tree.vm")
  );
  if (branchLinks.length === 1) advanceAutoGradesPilot(branchLinks[0].href);
  else stopAutoGradesPilot();
}

/* -----------------------------------------------------------------------
   Prüfungsanmeldung — bereits bestandene Module im Baum markieren
   ------------------------------------------------------------------------- */

function enhancePruefungsAnmeldung(root) {
  if (!location.href.includes("state=prfAnmStudent")) return;
  root.querySelectorAll("ul li.treelist a.Konto").forEach((e) => {
    if (e.dataset.qisCourseChecked) return;
    e.dataset.qisCourseChecked = "1";
    if (e.textContent.includes("[Status: BE]")) {
      e.classList.add("qisplus-course--completed");
    }
  });
}

/* -----------------------------------------------------------------------
   Seitenweites Redesign (Navigation, Baumlisten, Branding)
   ------------------------------------------------------------------------- */

/** QIS verschachtelt aufgeklappte Baum-Knoten als <ul class="treelist"> DIREKT
 *  im selben <li class="treelist"> wie Icon/Link des Elternknotens (kein
 *  eigener Wrapper). Ohne diese Funktion landen Icon, Link und die komplette
 *  Unterliste als vier Geschwister in einer einzigen Flex-Reihe und
 *  überlappen sich sichtbar. Wir kapseln Icon+Link+Sprunganker in einen
 *  eigenen .qis-tree-row-Container, damit CSS die Kopfzeile und die
 *  eingerückte Unterliste sauber untereinander anordnen kann. */
function wrapTreeRows(root) {
  root.querySelectorAll("li.treelist:not([data-qis-tree-wrapped])").forEach((li) => {
    li.dataset.qisTreeWrapped = "1";
    const nestedList = li.querySelector(":scope > ul.treelist");
    const row = document.createElement("div");
    row.className = "qis-tree-row";
    Array.from(li.childNodes)
      .filter((node) => node !== nestedList)
      .forEach((node) => row.appendChild(node));
    li.insertBefore(row, li.firstChild);
  });
}

/** QIS rendert #makronavigation auf manchen Seiten (z. B. Login) nur mit einem
 *  &nbsp; ohne Menüpunkte. Eine leere Sidebar-Karte / Tab-Bar wäre dort nur
 *  visueller Leerraum, also blenden wir beide dann aus. */
function syncNavVisibility() {
  const nav = document.getElementById("makronavigation");
  if (!nav) return;
  const isEmpty = !nav.querySelector("a");
  nav.classList.toggle("qis-nav-empty", isEmpty);
  const bottomNav = document.querySelector(".qis-bottom-nav");
  if (bottomNav) bottomNav.classList.toggle("qis-nav-empty", isEmpty);
}

const NAV_ICONS = {
  home: '<path d="M4 11.5 12 4l8 7.5"/><path d="M6 10v9a1 1 0 0 0 1 1h3v-6h4v6h3a1 1 0 0 0 1-1v-9"/>',
  exam: '<rect x="6" y="4" width="12" height="17" rx="2"/><path d="M9 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1"/><path d="M9 11h6M9 15h6M9 19h3"/>',
  download: '<path d="M12 3v11"/><path d="M8 10l4 4 4-4"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>',
  logout: '<path d="M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3"/><path d="M15 16l4-4-4-4"/><path d="M19 12H9"/>',
  generic: '<circle cx="12" cy="12" r="3"/>',
};

function iconMarkupFor(label) {
  const t = label.toLowerCase();
  if (t.includes("start")) return NAV_ICONS.home;
  if (t.includes("prüfungsverwaltung") || t.includes("pruefungsverwaltung")) return NAV_ICONS.exam;
  if (t.includes("download")) return NAV_ICONS.download;
  if (t.includes("abmelden")) return NAV_ICONS.logout;
  return NAV_ICONS.generic;
}

function buildSvgIcon(label) {
  const host = document.createElement("span");
  host.innerHTML =
    `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" ` +
    `stroke-linejoin="round" aria-hidden="true">${iconMarkupFor(label)}</svg>`;
  return host.firstChild;
}

/** Baut aus den #makronavigation-Links eine fixierte Bottom-Tab-Bar für
 *  Phone/iPad-Portrait (<900px) — ersetzt dort die alte Push-Down-Sidebar. */
function buildBottomNav() {
  const nav = document.getElementById("makronavigation");
  if (!nav) return;

  const items = [];
  const homeLink = document.querySelector('.divloginstatus a[title="Startseite"]');
  if (homeLink) items.push({ href: homeLink.href, label: "Startseite", active: false });

  nav.querySelectorAll(".menue > li").forEach((li) => {
    if (li.classList.contains("menueListStyleCloseMenu")) return;
    const a = li.querySelector("a");
    if (!a) return;
    items.push({ href: a.href, label: a.textContent.trim(), active: false });
  });

  if (!items.length) return;

  // QIS markiert den zuletzt geöffneten Menüpunkt serverseitig dauerhaft mit
  // "submenuCss" — das bleibt auch auf der Startseite stehen und würde dort
  // fälschlich z.B. "Prüfungsverwaltung" als aktiv anzeigen. Die Breadcrumb
  // ("Sie sind hier: ...") spiegelt dagegen zuverlässig die aktuelle Seite
  // wider. Sie ist aber kein reiner Pfad ab der Startseite — von Notenspiegel
  // aus aufgerufene Downloads zeigen z.B. "Startseite > Prüfungsverwaltung >
  // Notenspiegel > Downloads". Deshalb von hinten (aktuellste Station) nach
  // vorn das erste Segment nehmen, das zu einem Menüpunkt passt.
  const crumbs = Array.from(document.querySelectorAll(".breadcrumb a, .breadcrumb strong"))
    .map((el) => el.textContent.trim())
    .filter(Boolean);
  const labels = new Set(items.map((item) => item.label));
  const currentSection = [...crumbs].reverse().find((crumb) => labels.has(crumb));
  items.forEach((item) => {
    item.active = item.label === currentSection;
  });

  const signature = items.map((item) => item.href).join("|");
  let bar = document.querySelector(".qis-bottom-nav");

  if (bar && bar.dataset.qisSignature === signature) {
    Array.from(bar.children).forEach((a, i) => a.classList.toggle("qis-active", items[i].active));
    return;
  }

  if (!bar) {
    bar = document.createElement("nav");
    bar.className = "qis-bottom-nav";
    bar.setAttribute("aria-label", "Hauptnavigation");
    document.body.appendChild(bar);
  }

  bar.dataset.qisSignature = signature;
  bar.textContent = "";
  items.forEach((item) => {
    const a = document.createElement("a");
    a.href = item.href;
    if (item.active) a.classList.add("qis-active");
    a.appendChild(buildSvgIcon(item.label));

    const label = document.createElement("span");
    label.textContent = item.label;
    a.appendChild(label);

    bar.appendChild(a);
  });
}

/** Zeigt dezent, dass die Seite gerade von QIS+ modernisiert wird — ein
 *  kleines Badge neben dem Sprachumschalter im Header. */
function injectBrandCaption() {
  if (document.querySelector(".qis-brand-caption")) return;
  const logo = document.querySelector(".header_hisinone .logo");
  if (!logo) return;

  const caption = document.createElement("span");
  caption.className = "qis-brand-caption";
  caption.textContent = "Modernisiert mit QIS+";
  caption.title = "Diese Seite wird durch die QIS+ Erweiterung optimiert";
  logo.appendChild(caption);
}

// Vom Nutzer gewählte Farben als CSS-Variablen setzen — überschreibt die
// Standardwerte aus style.css. Nur valide Hex-Farben übernehmen, damit aus
// dem Storage kein beliebiges CSS kommt.
function applyCustomColors(colors) {
  for (const [key, value] of Object.entries(colors || {})) {
    if (/^#[0-9a-f]{6}$/i.test(value)) {
      document.documentElement.style.setProperty(`--qis-grade-${key}`, value);
    }
  }
}

function enhance(root, settings) {
  forceLoginLayout(root);
  applySidebarOverrides();
  stripLegacyTableAttrs(root);
  stripInlineDimensions(root);
  markKeyValueTables(root);
  runAutoGradesPilot(root, settings);
  enhanceGradesView(root, settings);
  enhanceFunctionsOverview(root);
  enhancePruefungsAnmeldung(root);
  makeTablesResponsive(root);
  makeKvTablesCollapsible(root);
  wrapTreeRows(root);
  buildBottomNav();
  syncNavVisibility();
  injectBrandCaption();
}

export default defineContentScript({
  matches: ["*://qis.hochschule-trier.de/*"],
  // document_start (statt document_idle), damit ensureViewportMeta oben vor
  // dem ersten Layout der Seite läuft. Der restliche, DOM-abhängige Code
  // wartet unten explizit auf DOMContentLoaded, bevor er anfasst.
  runAt: "document_start",
  async main() {
    // Safari injiziert Content-Scripts manchmal doppelt (z.B. bei BFCache-Restore).
    // Ohne diese Sperre würde die Seite trotzdem ein zweites Mal bearbeitet.
    if (window.__qisPlusContentScriptLoaded) {
      log("content script bereits geladen, überspringe erneute Ausführung.");
      return;
    }
    window.__qisPlusContentScriptLoaded = true;
    log("content script loaded on", location.href);

    if (document.readyState === "loading") {
      await new Promise((resolve) => document.addEventListener("DOMContentLoaded", resolve, { once: true }));
    }

    // Fällt auf die Defaults zurück, falls das Laden aus storage.local (noch)
    // fehlschlägt — ein Settings-Fehler darf nicht die komplette Darstellung
    // lahmlegen.
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
        colors: {},
        gradesFilter: "all",
        gradesSort: "none",
      };
    }

    applyCustomColors(settings.colors);

    const debouncedEnhance = debounce(() => enhance(document, settings), DEBOUNCE_MS);

    function observe() {
      const observer = new MutationObserver((mutations) => {
        // Vermeidet Endlosschleifen: Mutationen, die ausschließlich von
        // unseren eigenen Elementen stammen, lösen kein erneutes Enhancement aus.
        const isOwnMutation = mutations.every((m) =>
          [...m.addedNodes, ...m.removedNodes].every(
            (n) =>
              n.nodeType !== 1 ||
              n.classList?.contains("qis-table-scroll") ||
              n.closest?.(
                ".qis-bottom-nav, .qis-brand-caption, .qis-tree-row, .qis-grades, .qis-quicklinks, #qis-plus-auto-grades-overlay"
              )
          )
        );
        if (!isOwnMutation) debouncedEnhance();
      });

      observer.observe(document.body, { childList: true, subtree: true });
    }

    enhance(document, settings);
    observe();

    // Sidebar-Farben live nachziehen, wenn das OS zwischen Hell/Dunkel wechselt
    // (Inline-Overrides oben würden sonst auf dem letzten Stand einfrieren).
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
      applyCustomColors(settings.colors);
      applySidebarOverrides();
    });
  },
});
