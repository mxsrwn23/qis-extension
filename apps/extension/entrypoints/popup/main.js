import { loadSettings, saveSettings, loadKnownColumns, DEFAULT_COLORS } from "../../utils/settings.js";

const COLOR_LABELS = {
  be: "Bestanden",
  pv: "Offen (Prüfungen vorhanden)",
  fail: "Nicht bestanden",
  an: "Angemeldet",
  wait: "Prüfung geschrieben (warten)",
  section: "Abschnittszeilen",
};

const avgModeSelect = document.getElementById("avg-mode");
const hideDetailsCheckbox = document.getElementById("hide-completed-details");
const lastAttemptCheckbox = document.getElementById("show-only-last-attempt");
const studienleistungenCheckbox = document.getElementById("hide-studienleistungen");
const columnList = document.getElementById("column-list");
const columnHint = document.getElementById("column-hint");
const colorList = document.getElementById("color-list");
const resetColorsButton = document.getElementById("reset-colors");

(async function () {
  let settings;
  let knownColumns = [];
  try {
    settings = await loadSettings();
    knownColumns = await loadKnownColumns();
  } catch (e) {
    console.error("[QIS+] Settings konnten nicht geladen werden:", e);
    return;
  }

  // --- Anzeige & Notenschnitt ---
  avgModeSelect.value = settings.avgMode;
  hideDetailsCheckbox.checked = settings.hideCompletedDetails;
  lastAttemptCheckbox.checked = settings.showOnlyLastAttempt;
  studienleistungenCheckbox.checked = settings.hideStudienleistungen;

  avgModeSelect.addEventListener("change", () => saveSettings({ avgMode: avgModeSelect.value }));
  hideDetailsCheckbox.addEventListener("change", () =>
    saveSettings({ hideCompletedDetails: hideDetailsCheckbox.checked })
  );
  lastAttemptCheckbox.addEventListener("change", () =>
    saveSettings({ showOnlyLastAttempt: lastAttemptCheckbox.checked })
  );
  studienleistungenCheckbox.addEventListener("change", () =>
    saveSettings({ hideStudienleistungen: studienleistungenCheckbox.checked })
  );

  // --- Spalten: Checkboxen aus den vom Content-Script gemeldeten Headern bauen ---
  columnHint.hidden = knownColumns.length > 0;

  const columnCheckboxes = new Map();
  knownColumns.forEach((name) => {
    const label = document.createElement("label");
    label.className = "checkbox";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = !settings.hiddenColumns.includes(name);
    checkbox.addEventListener("change", () => {
      const hidden = [...columnCheckboxes].filter(([, cb]) => !cb.checked).map(([n]) => n);
      saveSettings({ hiddenColumns: hidden });
    });
    columnCheckboxes.set(name, checkbox);
    label.append(checkbox, document.createTextNode(" " + name));
    columnList.append(label);
  });

  // --- Farben: ein Picker pro Status; Tint/Textfarbe leitet style.css selbst ab ---
  const colorInputs = new Map();
  Object.entries(COLOR_LABELS).forEach(([key, labelText]) => {
    const label = document.createElement("label");
    label.className = "color-row";
    const input = document.createElement("input");
    input.type = "color";
    input.value = settings.colors[key] || DEFAULT_COLORS[key];
    input.addEventListener("change", () => {
      const colors = {};
      colorInputs.forEach((inp, k) => {
        colors[k] = inp.value;
      });
      saveSettings({ colors });
    });
    colorInputs.set(key, input);
    label.append(input, document.createTextNode(" " + labelText));
    colorList.append(label);
  });

  resetColorsButton.addEventListener("click", () => {
    colorInputs.forEach((inp, k) => {
      inp.value = DEFAULT_COLORS[k];
    });
    saveSettings({ colors: {} });
  });
})();
