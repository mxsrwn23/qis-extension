<div align="center">
  <img src="apps/extension/public/icon-128.png" width="96" height="96" alt="QIS+ Logo">

  <h1>QIS+</h1>

  <p><strong>Endlich Durchblick im QIS-Portal der Hochschule Trier.</strong></p>

  <p>
    Browser-Erweiterung für Chrome, Firefox und Safari, die deinen
    Notenspiegel aufräumt, einfärbt und deinen Notenschnitt live berechnet.
  </p>

  <p>
   <img src="https://img.shields.io/badge/Platform-Safari_|_Chrome_|_Firefox-blue" alt="Platform">
    <img src="https://img.shields.io/badge/Safari-16.4%2B-orange" alt="Safari 16.4+">
    <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-green" alt="License: MIT"></a>
  </p>

  <p>
    <a href="https://apps.apple.com/de/app/qis/id6790536583">
      <img height="48" alt="Im App Store laden" src="apps/extension/public/badges/appstore.svg">
    </a>
    <a href="https://chromewebstore.google.com/detail/gaiaklklpgdfgiebimldbjieiamgflkn">
      <img height="48" alt="Im Chrome Web Store" src="apps/extension/public/badges/chrome.png">
    </a>
    <a href="https://addons.mozilla.org/de/firefox/addon/qis-plus/">
      <img height="48" alt="Für Firefox herunterladen" src="apps/extension/public/badges/firefox.svg">
    </a>
  </p>
</div>

---

## Inhalt

- [Features](#features)
- [Farblegende](#farblegende-standardfarben)
- [Installation](#installation)
- [Datenschutz](#datenschutz)
- [Projektstruktur](#projektstruktur)
- [Für Entwickler:innen](#für-entwicklerinnen)
- [Troubleshooting](#troubleshooting)
- [Lizenz & Hinweis](#lizenz--hinweis)

---

## Features

- **Farbcodierter Status** – Jedes Modul ist auf einen Blick erkennbar: *bestanden*, *offen*, *angemeldet* oder *durchgefallen*, inklusive Klartext-Tooltip.
- **Live-Notenschnitt** – ECTS-gewichtet direkt im Tabellenkopf (`Note (2.34)`). Wählbar aus allen Versuchen, nur dem letzten oder nur der besten Note.
- **„NEU"-Badge** – Neu eingetragene Noten werden automatisch markiert. Kein manuelles Vergleichen mehr.
- **„Warten"-Markierung** – Prüfung geschrieben, aber noch keine Note? QIS+ markiert das automatisch und ignoriert dabei Vermerke wie *„nicht zugelassen"*.
- **Individuelles Aufräumen** – Blende Detailzeilen bestandener Module, frühere Versuche, Studienleistungen oder ganze Spalten flexibel aus.
- **Eigene Farbschemata** – Alle Statusfarben lassen sich im Popup anpassen und per Klick zurücksetzen.
- **Prüfungsanmeldung** – Bereits bestandene Module werden auf der Anmeldeseite grün hervorgehoben.

> Alle Einstellungen erreichst du über das **QIS+-Symbol in der Browser-Werkzeugleiste**. Änderungen greifen nach dem Neuladen der QIS-Seite.

---

## Farblegende (Standardfarben)

| Status | Bedeutung | Farbe |
| :--- | :--- | :--- |
| `BE` | Bestanden | 🟢 Grün |
| `PV` | Prüfungen vorhanden, noch nicht bestanden | 🟠 Orange |
| `NB` / `EN` | (Endgültig) nicht bestanden | 🔴 Rot |
| `AN` | Angemeldet, Ergebnis steht aus | 🔵 Blau |
| `AN` + Datum vorbei | Geschrieben, warten auf Note | 🟣 Lila |
| Abschnitte | Kern-/Pflicht-/Wahlpflichtmodule | ⚪ Grau |

---

## Installation

### Aus dem Store (empfohlen)

| Browser | Store |
| :--- | :--- |
| **Safari** (macOS/iOS) | [App Store](https://apps.apple.com/de/app/qis/id6790536583) |
| **Chrome** | [Chrome Web Store](https://chromewebstore.google.com/detail/gaiaklklpgdfgiebimldbjieiamgflkn) |
| **Firefox** | [Firefox Add-ons](https://addons.mozilla.org/de/firefox/addon/qis-plus/) |

Nach der Installation ggf. den Zugriff auf `qis.hochschule-trier.de` erlauben.

### Selbst bauen

Voraussetzungen: [Node.js](https://nodejs.org) und [pnpm](https://pnpm.io).

```bash
# Repository klonen & Abhängigkeiten installieren
git clone https://github.com/mxsrwn23/qis-extension.git
cd qis-extension
pnpm install
```

**Chrome** (Output: `apps/extension/.output/chrome-mv3`)

```bash
pnpm build
```

`chrome://extensions` → **Entwicklermodus** aktivieren → **„Entpackte Erweiterung laden"** → Ordner `chrome-mv3` auswählen.

**Firefox** (Output: `apps/extension/.output/firefox-mv2`)

```bash
pnpm build:firefox
```

`about:debugging#/runtime/this-firefox` → **„Temporäres Add-on laden"** → `manifest.json` im Ordner `firefox-mv2` auswählen.

**Safari**

```bash
pnpm build:safari
```

1. `apps/safari/QIS Plus/QIS Plus.xcodeproj` in Xcode öffnen.
2. Scheme **„QIS Plus (macOS)"** (oder **„QIS Plus (iOS)"**) wählen und starten (`⌘R`).
3. Extension in Safari unter **Einstellungen → Erweiterungen → QIS Plus** aktivieren und Zugriff auf `qis.hochschule-trier.de` erlauben.
4. *Bei unsignierten Debug-Builds:* im Entwickler-Menü **„Nicht signierte Erweiterungen erlauben"** aktivieren.

---

## Datenschutz

QIS+ erhebt, speichert und überträgt **keinerlei persönliche Daten.** Alle Einstellungen sowie der lokale Notenstand für das *NEU-Badge* verbleiben ausschließlich auf deinem Gerät. Die Erweiterung fordert Berechtigungen nur für `qis.hochschule-trier.de` an.

---

## Projektstruktur

```text
qis-extension/
├── apps/
│   ├── extension/                     # WXT: eine Codebase → Chrome, Firefox & Safari
│   │   ├── entrypoints/
│   │   │   ├── qis-content.content/   # Kernlogik: Färben, Filtern, Schnitt, Badges
│   │   │   ├── popup/                 # Einstellungen-UI
│   │   │   └── background.js          # Service Worker
│   │   ├── utils/settings.js          # Shared Settings-API (Storage)
│   │   ├── public/                    # Icons, _locales
│   │   └── wxt.config.js
│   └── safari/                        # Xcode-Projekt (App-Wrapper + Extension)
├── package.json / turbo.json
└── .github/workflows/ci.yml           # CI: automatischer Build bei Push/PR
```

---

## Für Entwickler:innen

- **Eine Codebase für alle Browser** – Dank [WXT](https://wxt.dev) entsteht aus `apps/extension` das passende Manifest und Bundle für Chrome, Firefox und Safari.
- **Doppel-Injektions-Schutz** – Das Content Script nutzt `window.__qisPlusContentScriptLoaded`, um Mehrfachausführungen (z. B. bei BFCache-Restores) zu verhindern.
- **Modulare Settings** – `apps/extension/utils/settings.js` dient als echtes ES-Modul für Content Script und Popup.
- **Dynamic Headers** – Die Notentabelle wird über Spaltenüberschriften (`Prüfungstext`, `Status`) identifiziert und bleibt so bei studiengangspezifischen Layout-Abweichungen stabil.
- **Debugging** – `DEBUG`-Flag in `apps/extension/entrypoints/qis-content.content/index.js` auf `true` setzen für erweiterte Konsolen-Logs.

---

## Troubleshooting

| Problem | Lösung |
| :--- | :--- |
| **Extension reagiert nicht** | Extension aus-/einschalten oder Browser neu starten. Zugriff auf `qis.hochschule-trier.de` prüfen. |
| **Farben / Schnitt fehlen** | Ist die Notenspiegel-Seite geöffnet? Die Tabelle benötigt die Spalten `Prüfungstext` und `Status`. |
| **Spaltenliste im Popup leer** | Notenspiegel im Portal einmalig öffnen, damit die Spalten erkannt und gespeichert werden. |
| **Einstellungen greifen nicht** | QIS-Seite nach Änderungen im Popup neu laden. |

Bugs gefunden oder Ideen? Erstelle gerne ein [Issue](https://github.com/mxsrwn23/qis-extension/issues) oder einen Pull Request.

---

## Lizenz & Hinweis

Veröffentlicht unter der [MIT-Lizenz](LICENSE).

*QIS+ ist ein unabhängiges Open-Source-Projekt und steht in keiner offiziellen Verbindung zur Hochschule Trier.*
