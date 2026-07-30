<div align="center">
  <img src="apps/extension/public/icon-128.png" width="96" height="96" alt="QIS+ Icon">

  # QIS+

  **Endlich Durchblick im QIS-Portal der Hochschule Trier.**

  Eine Browser-Erweiterung für Chrome, Firefox und Safari, die deinen
  Notenspiegel aufräumt, einfärbt und deinen Schnitt live berechnet.

  ![Platform](https://img.shields.io/badge/Platform-Chrome%20%7C%20Firefox%20%7C%20Safari-blue)
  ![Safari](https://img.shields.io/badge/Safari-16.4%2B-orange)
  ![License](https://img.shields.io/badge/License-MIT-green)

  <a href='https://apps.apple.com/de/app/qis/id6790536583'><img width=190 alt='Get QIS+ for macOS' src='https://user-images.githubusercontent.com/24459435/172480858-f2631b6c-c56d-47d2-abe5-84f735edbe85.svg'/></a>
</div>

---

## Features

- **Farbcodierter Status:** Jedes Modul ist auf einen Blick erkennbar: bestanden, offen, angemeldet oder durchgefallen. Mit Tooltip in Klartext.
- **Live-Notenschnitt:** ECTS-gewichtet, direkt im Tabellenkopf (`Note (2.34)`). Wahlweise aus allen Versuchen, nur dem letzten oder nur der besten Note.
- **"NEU"-Badge:** Sobald eine neue Note eingetragen wurde, bekommt das Modul ein Badge. Kein manuelles Vergleichen mehr.
- **"Warten"-Markierung:** Prüfung geschrieben, aber noch keine Note? QIS+ markiert sie automatisch und ignoriert dabei Vermerke wie "nicht zugelassen".
- **Aufräumen nach Wunsch:** Detailzeilen bestandener Module, frühere Versuche, Studienleistungen oder ganze Spalten ausblenden.
- **Deine Farben:** Alle Statusfarben lassen sich im Popup frei anpassen und mit einem Klick zurücksetzen.
- **Prüfungsanmeldung:** Bereits bestandene Module werden auf der Anmeldeseite grün markiert.

Alle Einstellungen erreichst du über das **QIS+-Symbol in der Symbolleiste**. Änderungen wirken nach dem Neuladen der QIS-Seite.

## Farblegende (Standardfarben)

| Status | Bedeutung | Farbe |
|---|---|---|
| `BE` | Bestanden | Grün |
| `PV` | Prüfungen vorhanden, noch nicht bestanden | Orange |
| `NB` / `EN` | (Endgültig) nicht bestanden | Rot |
| `AN` | Angemeldet, Ergebnis steht noch aus | Blau |
| `AN` + Prüfungsdatum vorbei | Geschrieben, warten auf Note | Lila |
| Abschnittszeilen | Kern-/Pflicht-/Wahlpflichtmodule | Grau |

## Installation

### Safari (macOS/iOS)

QIS+ ist im App Store erhältlich:

<a href='https://apps.apple.com/de/app/qis/id6790536583'><img width=190 alt='Get QIS+ for macOS' src='https://user-images.githubusercontent.com/24459435/172480858-f2631b6c-c56d-47d2-abe5-84f735edbe85.svg'/></a>

### Chrome & Firefox

Chrome und Firefox sind noch nicht in den jeweiligen Stores veröffentlicht. Bis dahin selbst bauen:

```bash
git clone https://github.com/mxsrwn23/qis-extension.git
cd qis-extension
pnpm install
pnpm build          # Chrome  -> apps/extension/.output/chrome-mv3
pnpm build:firefox  # Firefox -> apps/extension/.output/firefox-mv2
```

**Chrome:** `chrome://extensions` → Entwicklermodus aktivieren → "Entpackte Erweiterung laden" → Ordner `chrome-mv3` auswählen.

**Firefox:** `about:debugging#/runtime/this-firefox` → "Temporäres Add-on laden" → `manifest.json` im Ordner `firefox-mv2` auswählen.

### Safari selbst bauen

```bash
pnpm build:safari
```

1. `apps/safari/QIS Plus/QIS Plus.xcodeproj` in Xcode öffnen
2. Scheme **"QIS Plus (macOS)"** (oder **"QIS Plus (iOS)"**) auswählen und mit ⌘R starten
3. In Safari: **Einstellungen → Erweiterungen → QIS Plus** aktivieren, Zugriff auf `qis.hochschule-trier.de` erlauben
4. Bei unsignierten Debug-Builds: Entwickler-Menü → **"Nicht signierte Erweiterungen erlauben"**

Danach einfach wie gewohnt im QIS einloggen und den **Notenspiegel** öffnen, der Rest passiert automatisch.

## Datenschutz

QIS+ erhebt, speichert und überträgt **keine persönlichen Daten**. Alle Einstellungen (und der Noten-Vergleichsstand für das NEU-Badge) bleiben lokal auf deinem Gerät. Die Erweiterung läuft ausschließlich auf `qis.hochschule-trier.de`, mehr Berechtigungen fordert sie gar nicht erst an.

## Projektstruktur

```
qis-extension/
├── apps/
│   ├── extension/                     # WXT: eine Codebase → Chrome + Firefox + Safari
│   │   ├── entrypoints/
│   │   │   ├── qis-content.content/   # Kernlogik: Färben, Filtern, Schnitt, Badges
│   │   │   ├── popup/                 # Einstellungs-Popup
│   │   │   └── background.js          # reserviert für künftige Features
│   │   ├── utils/settings.js          # gemeinsame Settings-API (Storage)
│   │   ├── public/                    # Icons, _locales
│   │   └── wxt.config.js
│   └── safari/                        # generiertes Xcode-Projekt (App-Wrapper + Extension)
├── package.json / pnpm-workspace.yaml / turbo.json
├── DEVELOPMENT.md                     # Lokale Dev-Workflows, Befehle
└── .github/workflows/ci.yml           # CI: baut Chrome + Firefox bei jedem Push/PR
```

## Für Entwickler:innen

Ein paar Stolpersteine, die man kennen sollte (Details und alle Befehle in [DEVELOPMENT.md](DEVELOPMENT.md)):

- **Eine Codebase, drei Browser:** [WXT](https://wxt.dev) baut aus `apps/extension` automatisch das passende Manifest/Bundle für Chrome, Firefox und Safari — browserspezifische Unterschiede (z.B. `background.service_worker` vs. `background.scripts`) übernimmt es selbst.
- **Content Script läuft mit Lade-Sperre** (`window.__qisPlusContentScriptLoaded`), da Browser Content-Scripts z. B. bei BFCache-Restore mitunter doppelt injizieren.
- **Settings sind ein echtes ES-Modul** (`apps/extension/utils/settings.js`), das Content-Script und Popup direkt importieren — kein globaler `window`-Hack mehr nötig.
- **Safari-Xcode-Projekt referenziert den WXT-Build direkt** aus `apps/extension/.output/safari-mv2`. Gehashte Popup-Dateien (`chunks/popup-*.js`) können nach einem Rebuild in Xcode rot werden und müssen neu eingebunden werden. `pnpm safari:convert` nur einmalig ausführen — es überschreibt das komplette Xcode-Projekt.
- Die Notentabelle wird **über ihre Spaltenüberschriften** gefunden (`Prüfungstext`, `Status`), nicht über die Position. Das ist robust gegen Layout-Varianten je Studiengang.
- Debugging: `DEBUG`-Flag in `apps/extension/entrypoints/qis-content.content/index.js` auf `true` setzen für Konsolen-Logs. Sonst DevTools des jeweiligen Browsers (Chrome: `chrome://extensions` → Inspect: Ansichten; Firefox: `about:debugging`; Safari: Web Inspector).

## Troubleshooting

| Problem | Lösung |
|---|---|
| Extension tut nichts | Extension aus- und einschalten oder Browser neu starten; Website-Zugriff prüfen |
| Farben/Schnitt fehlen | Notenspiegel-Seite offen? Die Tabelle braucht die Header `Prüfungstext` und `Status` |
| Spaltenliste im Popup leer | Einmal den Notenspiegel öffnen, die Spalten werden dabei erkannt |
| Einstellungen greifen nicht | QIS-Seite nach dem Ändern neu laden |

Ideen, Bugs oder Verbesserungen? Gerne als [Issue](https://github.com/mxsrwn23/qis-extension/issues) oder Pull Request.

## Lizenz & Hinweis

MIT, siehe [LICENSE](LICENSE).

QIS+ ist ein unabhängiges Projekt und steht in keiner Verbindung zur Hochschule Trier.
