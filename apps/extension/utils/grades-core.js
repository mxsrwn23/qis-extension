// Reiner, DOM-freier Kern der Notenspiegel-Logik. Alle Funktionen sind
// deterministisch und ohne Browser-APIs testbar (node:test). Das Content-Script
// verdrahtet sie mit DOM + Storage.

export function normText(s) {
  return (s || "").replace(/\s+/g, " ").trim();
}

/** Wandelt deutsche Dezimalzahlen ("1,3"/"2.0") in Number um; null bei Mist. */
export function parseGermanDecimal(value) {
  const n = parseFloat(String(value ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/** "dd.mm.yyyy" → Date (Mitternacht); null bei ungültigem Format. */
export function parseGermanDate(s) {
  const m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec((s || "").trim());
  return m ? new Date(+m[3], +m[2] - 1, +m[1]) : null;
}

/** Gruppiert den rohen QIS-Status in die Kategorien der Karten-Ansicht. */
export function statusCategoryFor(status) {
  switch (normText(status).toLowerCase()) {
    case "be": return "be";
    case "pv": return "pv";
    case "nb":
    case "en": return "fail";
    case "an": return "an";
    default: return null;
  }
}

/** Chronologischer Sortierschlüssel für "WiSe 23/24" / "SoSe 24"; fehlende
 *  Semester rutschen ans Ende (unabhängig von der Sortierrichtung). */
export function semesterKey(text) {
  if (!text) return -Infinity;
  const normalized = text.toLowerCase();
  const digits = (text.match(/\d/g) || []).join("");
  if (normalized.startsWith("wise") && digits.length >= 2) {
    return parseInt(digits.slice(0, 2), 10) * 2;
  }
  if (normalized.startsWith("sose") && digits.length >= 2) {
    return (parseInt(digits.slice(0, 2), 10) - 1) * 2 + 1;
  }
  return -Infinity;
}

export const NOT_ADMITTED_REMARKS = new Set(["nz"]);
export const WITHDRAWN_REMARKS = new Set(["rt", "ne", "kr"]);

/** Ergebnis eines Versuchs = die Note, oder – falls keine Note existiert
 *  (z. B. bestandene Studienleistung ohne Benotung) – der finale Status. */
export function attemptResult(attempt) {
  if (attempt.note) return attempt.note;
  const statusNorm = normText(attempt.status).toLowerCase();
  return ["be", "nb", "en"].includes(statusNorm) ? attempt.status : "";
}

/** "Warten"-Status: Module, die noch als "an" (angemeldet) gelten, deren
 *  Prüfungstermin aber schon vergangen ist, bekommen einen eigenen Status
 *  ("Prüfung geschrieben, Ergebnis steht noch aus") statt weiter als
 *  "Angemeldet" zu erscheinen. */
export function refineWaitingStatus(modules) {
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);

  modules.forEach((m) => {
    if (m.statusCategory !== "an") return;
    const examDates = m.attempts
      .filter((a) => normText(a.status).toLowerCase() === "an")
      .map((a) => parseGermanDate(a.datum))
      .filter(Boolean)
      .sort((a, b) => b - a);
    if (examDates.length && examDates[0] <= endOfToday) {
      m.statusCategory = "wait";
    }
  });
}

/** Vergleicht die aktuellen Versuchsergebnisse mit dem letzten bekannten Stand
 *  (`prev` aus dem Storage) und markiert Module mit geändertem/neuem Ergebnis
 *  als `isNew`. Es gilt:
 *  - `prev == null` (noch nie besucht) → Erstlauf, nichts badgen.
 *  - Ein leerer Stand `{}` kam von einem früheren Besuch ohne Noten → neue
 *    Noten danach dürfen sofort badgen ("erscheint direkt, wenn eine Note
 *    erstmals eingetragen wurde").
 *  - Ein gefüllter Stand, gegen den kein einziger Schlüssel mehr passt (Reset,
 *    Fremd-Browser, anderes Format) → nur Baseline aktualisieren, nichts
 *    badgen, damit nicht das ganze Semester als "NEU" aufblitzt.
 *  Gibt den neuen gesehenen Stand als Map zurück, die der Aufrufer speichern
 *  muss. */
export function updateSeenResults(modules, prev) {
  const visitedBefore = prev != null;
  const next = {};
  const keyCounts = new Map();
  let overlapping = false;

  modules.forEach((module) => {
    let anyUnmatched = false;
    module.attempts.forEach((attempt) => {
      const baseKey = `${module.name}|${attempt.semester}|${attempt.versuch}`;
      const n = keyCounts.get(baseKey) || 0;
      keyCounts.set(baseKey, n + 1);
      const key = `${baseKey}#${n}`;
      const result = attemptResult(attempt);
      if (!result) return;
      next[key] = result;
      if (visitedBefore && key in prev) overlapping = true;
      if (visitedBefore && prev[key] !== result) anyUnmatched = true;
    });
    module.__qisUnmatched = anyUnmatched;
  });

  // Leerer Stand = echter früherer Besuch ohne Noten → als Baseline zählen.
  const isRecovered = visitedBefore && (overlapping || Object.keys(prev).length === 0);

  modules.forEach((module) => {
    if (isRecovered && module.__qisUnmatched) module.isNew = true;
    delete module.__qisUnmatched;
  });

  return next;
}

/** ECTS-gewichteter Notenschnitt. Je nach avgMode-Einstellung zählen alle
 *  bestandenen Versuche, nur der letzte Versuch je Modul, oder nur die beste
 *  Note je Modul. Nur Versuchszeilen mit gültiger Note (0–5) und ECTS>0
 *  zählen — die Modulzeile selbst wird dafür nicht herangezogen. */
export function computeAverage(modules, avgMode = "all") {
  let weightedSum = 0;
  let totalEcts = 0;
  modules.forEach((m) => {
    const valid = m.attempts
      .map((a) => ({ grade: parseGermanDecimal(a.note), ects: parseGermanDecimal(a.ectsRaw), versuch: parseInt(a.versuch, 10) || 0 }))
      .filter((a) => a.grade !== null && a.grade > 0 && a.grade < 5 && a.ects !== null && a.ects > 0);
    if (!valid.length) return;

    let selected;
    if (avgMode === "last") {
      selected = [valid.reduce((a, b) => (b.versuch >= a.versuch ? b : a))];
    } else if (avgMode === "best") {
      selected = [valid.reduce((a, b) => (b.grade < a.grade ? b : a))];
    } else {
      selected = valid; // "all"
    }

    selected.forEach((a) => {
      weightedSum += a.grade * a.ects;
      totalEcts += a.ects;
    });
  });
  return totalEcts > 0 ? weightedSum / totalEcts : null;
}

export function computeTotalEcts(modules) {
  return modules.reduce((sum, m) => {
    if (m.statusCategory !== "be") return sum;
    const v = parseGermanDecimal(m.ects);
    return v !== null ? sum + v : sum;
  }, 0);
}

/** Filtert die anzuzeigenden Versuche eines Moduls gemäß Einstellungen:
 *  bestandene Module ohne Verlauf (hideCompletedDetails), nur letzter Versuch
 *  (showOnlyLastAttempt), Studienleistungen ausblenden (hideStudienleistungen).
 *  Wirkt nur auf die Darstellung, nicht auf den Notenschnitt. */
export function attemptsForDisplay(module, settings) {
  if (settings.hideCompletedDetails && module.statusCategory === "be") return [];

  let attempts = module.attempts;
  if (settings.showOnlyLastAttempt && attempts.length > 1) {
    const maxVersuch = Math.max(...attempts.map((a) => parseInt(a.versuch, 10) || 0));
    if (maxVersuch > 1) attempts = attempts.filter((a) => (parseInt(a.versuch, 10) || 0) >= maxVersuch);
  }
  if (settings.hideStudienleistungen) {
    attempts = attempts.filter((a) => !a.isStudienleistung);
  }
  return attempts;
}