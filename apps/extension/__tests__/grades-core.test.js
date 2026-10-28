import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normText,
  parseGermanDecimal,
  parseGermanDate,
  statusCategoryFor,
  semesterKey,
  refineWaitingStatus,
  attemptResult,
  updateSeenResults,
  computeAverage,
  computeTotalEcts,
  attemptsForDisplay,
} from "../utils/grades-core.js";

// Modell entsprechen den von parseGradesTable gebauten Modulen.
function mod(overrides = {}, attempts = []) {
  return {
    section: "Kern",
    name: "Modul A",
    grade: "",
    status: "BE",
    statusCategory: "be",
    ects: "5",
    attempts,
    ...overrides,
  };
}

function attempt(overrides = {}) {
  return {
    semester: "WiSe 24/25",
    note: "1,3",
    ectsRaw: "5",
    versuch: "1",
    datum: "01.02.2025",
    status: "BE",
    isStudienleistung: false,
    ...overrides,
  };
}

const defaultSettings = {
  avgMode: "all",
  hideCompletedDetails: true,
  showOnlyLastAttempt: false,
  hideStudienleistungen: false,
};

test("beginning helpers", () => {
  assert.equal(normText("  a\n b "), "a b");
  assert.equal(parseGermanDecimal("1,3"), 1.3);
  assert.equal(parseGermanDecimal("2.0"), 2);
  assert.equal(parseGermanDecimal(""), null);
  assert.equal(parseGermanDecimal("xyz"), null);
  assert.deepEqual(parseGermanDate("01.02.2025"), new Date(2025, 1, 1));
  assert.equal(parseGermanDate("2025-02-01"), null);
});

test("statusCategoryFor maps QIS statuses", () => {
  assert.equal(statusCategoryFor("BE"), "be");
  assert.equal(statusCategoryFor("pv"), "pv");
  assert.equal(statusCategoryFor("nb"), "fail");
  assert.equal(statusCategoryFor("EN"), "fail");
  assert.equal(statusCategoryFor("an"), "an");
  assert.equal(statusCategoryFor("NE"), null);
});

test("semesterKey orders WiSe before SoSe before next WiSe", () => {
  const keys = ["WiSe 23/24", "SoSe 24", "WiSe 24/25", ""].map(semesterKey);
  assert.ok(keys[0] < keys[1]);
  assert.ok(keys[1] < keys[2]);
  assert.equal(keys[3], -Infinity);
});

test("attemptResult uses note or final status", () => {
  assert.equal(attemptResult(attempt()), "1,3");
  assert.equal(attemptResult(attempt({ note: "" })), "BE");
  assert.equal(attemptResult(attempt({ note: "", status: "NB" })), "NB");
  assert.equal(attemptResult(attempt({ note: "", status: "an" })), "");
});

test("updateSeenResults: bestehendes Modul unverändert → kein NEU", () => {
  const module = mod({ name: "Modul A" }, [attempt()]);
  const prev = { "Modul A|WiSe 24/25|1#0": "1,3" };
  updateSeenResults([module], prev);
  assert.equal(module.isNew, undefined);
});

test("updateSeenResults: neues Modul → NEU", () => {
  const modA = mod({ name: "Modul A" }, [attempt()]);
  const modB = mod({ name: "Modul B" }, [attempt({ note: "2,0" })]);
  const prev = { "Modul A|WiSe 24/25|1#0": "1,3" };
  updateSeenResults([modA, modB], prev);
  assert.equal(modA.isNew, undefined);
  assert.equal(modB.isNew, true);
});

test("updateSeenResults: neue Note auf bestehendem Modul → NEU", () => {
  const module = mod({ name: "Modul A" }, [attempt({ note: "1,7" })]);
  const prev = { "Modul A|WiSe 24/25|1#0": "1,3" };
  updateSeenResults([module], prev);
  assert.equal(module.isNew, true);
});

test("updateSeenResults: Erstlauf → kein Badge, Stand wird gespeichert", () => {
  const module = mod({ name: "Modul A" }, [attempt()]);
  const next = updateSeenResults([module], null);
  assert.equal(module.isNew, undefined);
  assert.deepEqual(next, { "Modul A|WiSe 24/25|1#0": "1,3" });
});

test("updateSeenResults: neuer zweiter Versuch → NEU, beide Keys getrennt", () => {
  const module = mod(
    { name: "Modul A" },
    [attempt({ versuch: "1", note: "4,0" }), attempt({ versuch: "2", note: "2,7" })]
  );
  const prev = { "Modul A|WiSe 24/25|1#0": "4,0" };
  updateSeenResults([module], prev);
  assert.equal(module.isNew, true);
});

test("updateSeenResults: angemeldet ohne Ergebnis → weder NEU noch gespeichert", () => {
  const module = mod(
    { name: "Modul C", status: "AN", statusCategory: "an" },
    [attempt({ note: "", status: "AN", datum: "15.09.2026" })]
  );
  const next = updateSeenResults([module], {});
  assert.equal(module.isNew, undefined);
  assert.deepEqual(next, {});
});

test("updateSeenResults: bestandene Studienleistung ohne Note → Ergebnis BE", () => {
  const modE = mod({ name: "Modul E" }, [attempt()]);
  const modD = mod(
    { name: "Modul D" },
    [attempt({ note: "", status: "BE", isStudienleistung: true })]
  );
  const next = updateSeenResults([modE, modD], { "Modul E|WiSe 24/25|1#0": "1,3" });
  assert.equal(modD.isNew, true);
  assert.equal(next["Modul D|WiSe 24/25|1#0"], "BE");
});

test("updateSeenResults: erste Note nach Besuch ohne Noten → NEU", () => {
  // Student war schon einmal auf der Seite (leerer Stand gespeichert), jetzt
  // wird die allererste Note eingetragen → Badge direkt beim ersten Aufruf.
  const module = mod({ name: "Modul A" }, [attempt()]);
  const next = updateSeenResults([module], {});
  assert.equal(module.isNew, true);
  assert.deepEqual(next, { "Modul A|WiSe 24/25|1#0": "1,3" });
});

test("updateSeenResults: komplett fremder Stand → Reset statt All-NEU", () => {
  const module = mod({ name: "Modul A" }, [attempt()]);
  // Gespeicherte Keys passen nirgends (anderes Format/fremder Browser):
  const prev = { "irgendwas|andere|format#0": "7,7", "??": "?" };
  const next = updateSeenResults([module], prev);
  assert.equal(module.isNew, undefined);
  assert.deepEqual(next, { "Modul A|WiSe 24/25|1#0": "1,3" });
});

test("updateSeenResults: einzelne Notenänderung bleibt NEU (kein Reset)", () => {
  const module = mod({ name: "Modul A" }, [attempt({ note: "1,7" })]);
  const prev = { "Modul A|WiSe 24/25|1#0": "1,3" };
  updateSeenResults([module], prev);
  assert.equal(module.isNew, true);
});

function wissArbeit(note, versuch = "1", semester = "WiSe 24/25") {
  return mod(
    { name: "Wissenschaftliches Arbeiten", section: "Methodenkompetenz", ects: "5" },
    [attempt({ semester, versuch, note, datum: "15.02.2025" })]
  );
}
const WISS_KY = { "Wissenschaftliches Arbeiten|WiSe 24/25|1#0": "" };

test("WissArbeit 1: Erstbesuch → kein Badge, Baseline gespeichert", () => {
  const module = wissArbeit("2,3");
  const next = updateSeenResults([module], null);
  assert.equal(module.isNew, undefined);
  assert.equal(next["Wissenschaftliches Arbeiten|WiSe 24/25|1#0"], "2,3");
});

test("WissArbeit 2: Besuch unverändert → Badge bleibt weg", () => {
  const module = wissArbeit("2,3");
  updateSeenResults([module], Object.assign({}, WISS_KY, { "Wissenschaftliches Arbeiten|WiSe 24/25|1#0": "2,3" }));
  assert.equal(module.isNew, undefined);
});

test("WissArbeit 3: Note erstmals eingetragen → NEU sofort (andere Module unverändert)", () => {
  const statistik = mod({ name: "Statistik" }, [attempt()]);
  const module = wissArbeit("2,3");
  const prev = { "Statistik|WiSe 24/25|1#0": "1,3" };
  updateSeenResults([module, statistik], prev);
  assert.equal(module.isNew, true);
  assert.equal(statistik.isNew, undefined);
});

test("WissArbeit 4: nach Sichtung ist die Note gesehen → Badge weg", () => {
  const module = wissArbeit("2,3");
  const prev = { "Wissenschaftliches Arbeiten|WiSe 24/25|1#0": "2,3" };
  updateSeenResults([module], prev);
  assert.equal(module.isNew, undefined);
});

test("WissArbeit 5: zweiter Versuch (Note 5,0 → 3,0) → NEU", () => {
  const module = wissArbeit("3,0", "1", "WiSe 24/25");
  module.attempts.push(attempt({ versuch: "2", note: "2,0", datum: "20.08.2025" }));
  const prev = { "Wissenschaftliches Arbeiten|WiSe 24/25|1#0": "5,0" };
  updateSeenResults([module], prev);
  assert.equal(module.isNew, true);
});

test("computeAverage: nur bestehende bestandene Versuchszeilen zählen", () => {
  const modules = [
    mod({ name: "A" }, [attempt({ note: "1,0", ectsRaw: "5" })]),
    mod({ name: "B" }, [attempt({ note: "3.0", ectsRaw: "5" })]),
    mod(
      { name: "C", status: "AN", statusCategory: "an" },
      [attempt({ note: "", status: "AN", ectsRaw: "5" })]
    ),
  ];
  assert.equal(computeAverage(modules, "all"), 2.0);
});

test("computeAverage: Modus last nutzt höchsten Versuch", () => {
  const module = mod(
    { name: "A" },
    [attempt({ versuch: "1", note: "2,3", ectsRaw: "5" }), attempt({ versuch: "2", note: "1,7", ectsRaw: "5" })]
  );
  assert.equal(computeAverage([module], "last"), 1.7);
  assert.equal(computeAverage([module], "all"), 2.0);
});

test("computeAverage: Modus best nutzt beste Note", () => {
  const module = mod(
    { name: "A" },
    [attempt({ versuch: "1", note: "1,0", ectsRaw: "5" }), attempt({ versuch: "2", note: "2,0", ectsRaw: "5" })]
  );
  assert.equal(computeAverage([module], "best"), 1.0);
});

test("computeAverage: keine gültigen Noten → null", () => {
  const modules = [
    mod(
      { name: "C", status: "AN", statusCategory: "an" },
      [attempt({ note: "", status: "AN" })]
    ),
  ];
  assert.equal(computeAverage(modules, "all"), null);
});

test("computeTotalEcts zählt nur bestandene Module", () => {
  const modules = [
    mod({ name: "A", ects: "5,5" }, [attempt()]),
    mod({ name: "B", status: "AN", statusCategory: "an", ects: "6" }, []),
  ];
  assert.equal(computeTotalEcts(modules), 5.5);
});

test("attemptsForDisplay: Default zeigt alle Versuche", () => {
  const module = mod({ name: "A" }, [attempt({ no: 1 }), attempt({ no: 2 })]);
  // Modul nicht bestanden → Verlauf sichtbar
  const open = { ...module, statusCategory: "an", status: "an" };
  assert.equal(attemptsForDisplay(open, defaultSettings).length, 2);
});

test("attemptsForDisplay: hideCompletedDetails klappt bestandene ein", () => {
  const module = mod({ name: "A" }, [attempt()]);
  assert.deepEqual(attemptsForDisplay(module, defaultSettings), []);
});

test("attemptsForDisplay: showOnlyLastAttempt zeigt nur letzten Versuch", () => {
  const module = mod(
    { name: "A", statusCategory: "fail", status: "NB" },
    [attempt({ versuch: "1", note: "4,0" }), attempt({ versuch: "2", note: "3,0" })]
  );
  const shown = attemptsForDisplay(module, { ...defaultSettings, showOnlyLastAttempt: true });
  assert.equal(shown.length, 1);
  assert.equal(shown[0].versuch, "2");
});

test("attemptsForDisplay: hideStudienleistungen blendet PV aus", () => {
  const module = mod(
    { name: "A", statusCategory: "an", status: "an" },
    [attempt(), attempt({ isStudienleistung: true, note: "" })]
  );
  const shown = attemptsForDisplay(module, { ...defaultSettings, hideStudienleistungen: true });
  assert.equal(shown.length, 1);
  assert.equal(shown[0].isStudienleistung, false);
});

test("refineWaitingStatus: vergangenes Prüfungsdatum → wait", () => {
  const module = mod(
    { name: "A", status: "AN", statusCategory: "an" },
    [attempt({ datum: "01.01.2020", status: "AN", note: "" })]
  );
  refineWaitingStatus([module]);
  assert.equal(module.statusCategory, "wait");
});

test("refineWaitingStatus: zukünftiges Datum bleibt an", () => {
  const module = mod(
    { name: "A", status: "AN", statusCategory: "an" },
    [attempt({ datum: "01.01.2999", status: "AN", note: "" })]
  );
  refineWaitingStatus([module]);
  assert.equal(module.statusCategory, "an");
});