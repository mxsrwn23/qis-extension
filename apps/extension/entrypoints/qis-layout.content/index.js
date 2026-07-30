import "./style.css";

/**
 * Findet die Notenspiegel-Ergebnistabelle anhand ihrer Spaltenüber-
 * schriften statt anhand von Klassennamen, da dieselben Klassen
 * (tabelleheader, qis_konto, ...) auch von anderen QIS-Modulen
 * (Prüfungsanmeldung, Prüfungsinfos) für andere Tabellen genutzt werden.
 */
function findGradeTable() {
  const tables = document.querySelectorAll("table");
  for (const table of tables) {
    const firstRow = table.querySelector("tr");
    if (!firstRow) continue;
    const headers = Array.from(firstRow.querySelectorAll("th")).map((th) => th.textContent.trim());
    const hasNote = headers.includes("Note");
    const hasEcts = headers.some((h) => h.startsWith("ECTS"));
    if (hasNote && hasEcts) {
      return table;
    }
  }
  return null;
}

function lockGradeTable() {
  const table = findGradeTable();
  if (!table) return;

  // Der gesamte umschließende Container (Stammdaten-Tabelle, Notentabelle
  // und Legenden teilen sich ein <form> ohne eigene ID/Klasse) gilt als
  // "direktes Container-Element" der Notentabelle und wird mitgesperrt.
  const container = table.closest("form") || table.parentElement;
  container.setAttribute("data-qisplus-locked", "true");
}

export default defineContentScript({
  matches: ["*://qis.hochschule-trier.de/*"],
  runAt: "document_end",
  main() {
    // Safari injiziert Content-Scripts manchmal doppelt (z.B. bei BFCache-Restore).
    if (window.__qisPlusLayoutScriptLoaded) {
      return;
    }
    window.__qisPlusLayoutScriptLoaded = true;

    function init() {
      try {
        lockGradeTable();
      } catch (err) {
        console.error("[QIS+ Layout] Notentabelle konnte nicht gesperrt werden:", err);
      }
    }

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", init);
    } else {
      init();
    }
  },
});
