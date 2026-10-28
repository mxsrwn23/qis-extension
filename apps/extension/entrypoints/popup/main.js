import { loadSettings, saveSettings, DEFAULT_COLORS } from "../../utils/settings.js";

const COLOR_LABELS = {
  be: "Bestanden",
  pv: "Offen (Prüfungen vorhanden)",
  fail: "Nicht bestanden",
  an: "Angemeldet",
  wait: "Prüfung geschrieben (warten)",
  section: "Abschnittstitel",
};

const avgModeSelect = document.getElementById("avg-mode");
const hideDetailsCheckbox = document.getElementById("hide-completed-details");
const lastAttemptCheckbox = document.getElementById("show-only-last-attempt");
const studienleistungenCheckbox = document.getElementById("hide-studienleistungen");
const colorList = document.getElementById("color-list");
const resetColorsButton = document.getElementById("reset-colors");

(async function () {
  let settings;
  try {
    settings = await loadSettings();
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
