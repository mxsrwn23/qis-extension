<div align="center">

  <img src="apps/extension/public/icon-128.png" width="96" height="96" alt="QIS+ Logo">

  # QIS+

  **Endlich Durchblick im QIS-Portal der Hochschule Trier.**

  Eine Browser-Erweiterung für Chrome, Firefox und Safari, die deinen Notenspiegel aufräumt, einfärbt und deinen Notenschnitt live berechnet.

  [![Platform](https://img.shields.io/badge/Platform-Chrome%20%7C%20Firefox%20%7C%20Safari-blue)](#installation)
  [![Safari](https://img.shields.io/badge/Safari-16.4%2B-orange)](#safari-macosios)
  [![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

  <br>

  <a href="https://apps.apple.com/de/app/qis/id6790536583">
    <img height="48" alt="Im App Store laden" src="apps/extension/public/badges/appstore.svg"/>
  </a>
  <!--
  <a href="https://chromewebstore.google.com/detail/DEINE_EXTENSION_ID">
    <img height="48" alt="Im Chrome Web Store" src="apps/extension/public/badges/chrome.png"/>
  </a>
  <a href="https://addons.mozilla.org/de/firefox/addon/DEIN_ADDON_SLUG/">
    <img height="48" alt="Für Firefox herunterladen" src="apps/extension/public/badges/firefox.svg"/>
  </a>
  -->

</div>

---

## Features

- **Farbcodierter Status:** Jedes Modul ist sofort erkennbar: *bestanden*, *offen*, *angemeldet* oder *durchgefallen* — inklusive Klartext-Tooltip.
- **Live-Notenschnitt:** ECTS-gewichtet direkt im Tabellenkopf (`Note (2.34)`). Konfigurierbar: Aus allen Versuchen, nur dem letzten oder nur der besten Note.
- **"NEU"-Badge:** Sobald eine neue Note eingetragen wurde, erhält das Modul automatisch ein Badge. Kein manuelles Vergleichen mehr.
- **"Warten"-Markierung:** Prüfung geschrieben, aber noch keine Note? QIS+ markiert sie automatisch und ignoriert dabei Vermerke wie *"nicht zugelassen"*.
- **Individuelles Aufräumen:** Blende Detailzeilen bestandener Module, frühere Versuche, Studienleistungen oder ganze Spalten flexibel aus.
- **Eigene Farbschemata:** Alle Statusfarben lassen sich im Popup anpassen und jederzeit per Klick zurücksetzen.
- **Prüfungsanmeldung:** Bereits bestandene Module werden auf der Anmeldeseite direkt grün hervorgehoben.

Alle Einstellungen erreichst du über das **QIS+-Symbol in der Browser-Werkzeugleiste**. Änderungen greifen nach dem Neuladen der QIS-Seite.

---

## Farblegende (Standardfarben)

| Status | Bedeutung | Farbe |
| :--- | :--- | :--- |
| `BE` | Bestanden | Grün |
| `PV` | Prüfungen vorhanden, noch nicht bestanden | Orange |
| `NB` / `EN` | (Endgültig) nicht bestanden | Rot |
| `AN` | Angemeldet, Ergebnis steht noch aus | Blau |
| `AN` + Datum vorbei | Geschrieben, warten auf Note | Lila |
| **Abschnitte** | Kern-/Pflicht-/Wahlpflichtmodule | Grau |

---

## Installation

### Safari (macOS / iOS)

QIS+ ist direkt im Mac App Store und App Store verfügbar:

<a href="https://apps.apple.com/de/app/qis/id6790536583">
    <img height="48" alt="Im App Store laden" src="apps/extension/public/badges/appstore.svg"/>
  </a>

---

### Chrome & Firefox (Manuell bauen)

Da die Versionen im Chrome Web Store und bei Firefox Add-ons noch ausstehen, kannst du das Projekt lokal bauen:

```bash
# Repository klonen & Abhängigkeiten installieren
git clone https://github.com/mxsrwn23/qis-extension.git
cd qis-extension
pnpm install

# Für Chrome bauen (Output: apps/extension/.output/chrome-mv3)
pnpm build

# Für Firefox bauen (Output: apps/extension/.output/firefox-mv2)
pnpm build:firefox
```

* **Chrome:** Öffne `chrome://extensions` → **Entwicklermodus** aktivieren → **"Entpackte Erweiterung laden"** → Ordner `chrome-mv3` auswählen.
* **Firefox:** Öffne `about:debugging#/runtime/this-firefox` → **"Temporäres Add-on laden"** → `manifest.json` im Ordner `firefox-mv2` auswählen.

---

### Safari selbst bauen

```bash
pnpm build:safari
```

1. Öffne `apps/safari/QIS Plus/QIS Plus.xcodeproj` in Xcode.
2. Wähle das Scheme **"QIS Plus (macOS)"** (oder **"QIS Plus (iOS)"**) und starte das Projekt (`⌘ + R`).
3. Aktiviere die Extension in Safari unter **Einstellungen → Erweiterungen → QIS Plus** und erlaube den Zugriff auf `qis.hochschule-trier.de`.
4. *Bei unsignierten Debug-Builds:* Im Entwickler-Menü von Safari **"Nicht signierte Erweiterungen erlauben"** aktivieren.

---

## Datenschutz

QIS+ erhebt, speichert und überträgt **keinerlei persönliche Daten**. 

Alle Einstellungen sowie der lokale Notenstand für das *NEU-Badge* verbleiben ausschließlich lokal auf deinem Gerät. Die Erweiterung fordert nur Berechtigungen für `qis.hochschule-trier.de` an.

---

## Projektstruktur

```text
qis-extension/
├── apps/
│   ├── extension/                     # WXT: Eine Codebase -> Chrome, Firefox & Safari
│   │   ├── entrypoints/
│   │   │   ├── qis-content.content/   # Kernlogik: Färben, Filtern, Schnitt, Badges
│   │   │   ├── popup/                 # Einstellungen-UI
│   │   │   └── background.js          # Service Worker
│   │   ├── utils/settings.js          # Shared Settings-API (Storage)
│   │   ├── public/                    # Icons, _locales
│   │   └── wxt.config.js
│   └── safari/                        # Xcode-Projekt (App-Wrapper + Extension)
├── package.json / turbo.json
└── .github/workflows/ci.yml           # CI: Automatischer Build bei Push/PR
```

---

## Für Entwickler:innen

- **Eine Codebase für alle Browser:** Dank [WXT](https://wxt.dev) wird aus `apps/extension` das passende Manifest und Bundle für Chrome, Firefox und Safari generiert.
- **Doppel-Injektions-Schutz:** Das Content Script nutzt `window.__qisPlusContentScriptLoaded`, um Mehrfachausführungen (z. B. bei BFCache-Restores) zu verhindern.
- **Modulare Settings:** `apps/extension/utils/settings.js` dient als echtes ES-Modul für Content Script und Popup.
- **Dynamic Headers:** Die Notentabelle wird dynamisch über Spaltenüberschriften (`Prüfungstext`, `Status`) identifiziert, um bei studiengangspezifischen Layout-Abweichungen stabil zu funktionieren.
- **Debugging:** Setze das `DEBUG`-Flag in `apps/extension/entrypoints/qis-content.content/index.js` auf `true` für erweiterte Konsolen-Logs.

---

## Troubleshooting

| Problem | Lösung |
| :--- | :--- |
| **Extension reagiert nicht** | Extension kurz aus-/einschalten oder Browser neu starten. Zugriff auf `qis.hochschule-trier.de` prüfen. |
| **Farben / Schnitt fehlen** | Ist die Notenspiegel-Seite geöffnet? Die Tabelle benötigt die Spalten `Prüfungstext` und `Status`. |
| **Spaltenliste im Popup leer** | Öffne einmalig den Notenspiegel im Portal, damit die Spalten erkannt und gespeichert werden. |
| **Einstellungen greifen nicht** | Lade die QIS-Seite nach Änderungen im Popup neu. |

Bugs gefunden oder Ideen zur Verbesserung? Erstelle gerne ein [Issue](https://github.com/mxsrwn23/qis-extension/issues) oder einen Pull Request!

---

## Lizenz & Hinweis

Veröffentlicht unter der [MIT-Lizenz](LICENSE).

*QIS+ ist ein unabhängiges Open-Source-Projekt und steht in keiner offiziellen Verbindung zur Hochschule Trier.*
