//
//  ContentView.swift
//  Shared (App)
//
//  SwiftUI-Onboarding-Screen für die QIS Plus Safari-Erweiterung (iOS & macOS).
//  Erfüllt App-Store-Guideline 4.2 (Minimum Functionality) durch
//  eine Anleitung zur Aktivierung, Funktionsübersicht und Datenschutz-Hinweis.
//

import SwiftUI

#if os(macOS)
import SafariServices
#endif

/// Bundle-ID der Safari-Erweiterung, für Statusabfrage und das Öffnen der Safari-Einstellungen.
let extensionBundleIdentifier = "app.maxsauerwein.extensions.qis-plus.Extension"

// MARK: - Farbpalette (aus dem App-Icon)

extension Color {
    /// Warmes Off-White des Icon-Hintergrunds.
    static let qisBackground = Color(red: 0xFA / 255, green: 0xFA / 255, blue: 0xF9 / 255)
    /// Etwas dunklerer Ton für den unteren Verlauf.
    static let qisBackgroundBottom = Color(red: 0xEF / 255, green: 0xEE / 255, blue: 0xEA / 255)

    /// Petrol des oberen Balkens, primäre Marken- und Buttonfarbe.
    static let qisTeal = Color(red: 0x11 / 255, green: 0x5E / 255, blue: 0x67 / 255)
    /// Karminrot des mittleren Balkens.
    static let qisCrimson = Color(red: 0xA5 / 255, green: 0x00 / 255, blue: 0x34 / 255)
    /// Grün des unteren Balkens.
    static let qisGreen = Color(red: 0x29 / 255, green: 0x88 / 255, blue: 0x36 / 255)
    /// Orange des "+"-Zeichens, Akzentfarbe.
    static let qisOrange = Color(red: 0xCA / 255, green: 0x51 / 255, blue: 0x16 / 255)

    /// Dunkle Textfarbe auf hellem Grund.
    static let qisInk = Color(red: 0x1A / 255, green: 0x29 / 255, blue: 0x2B / 255)
}

// MARK: - Haupt-View

struct ContentView: View {

#if os(macOS)
    /// Aktueller Status der Safari-Erweiterung (nur auf macOS abfragbar).
    @State private var extensionEnabled: Bool?
#endif

    private let githubURL = URL(string: "https://github.com/mxsrwn23/qis-extension")!

    var body: some View {
        ZStack {
            backgroundGradient
                .ignoresSafeArea()

            ScrollView {
                VStack(spacing: 28) {
                    header
                    LogoBarsRow()
#if os(macOS)
                    extensionStateBadge
#endif
                    instructionCard
                    openSettingsButton
                    howItWorksCard
                    featuresCard
                    privacyCard
                    footer
                }
                .padding(.horizontal, 24)
                .padding(.vertical, 40)
                .frame(maxWidth: 540)
                .frame(maxWidth: .infinity)
            }
        }
        .tint(Color.qisTeal)
#if os(macOS)
        .frame(minWidth: 480, minHeight: 700)
        .task {
            await refreshExtensionState()
            // Status aktualisieren, wenn der Nutzer aus Safari zurückkehrt.
            for await _ in NotificationCenter.default.notifications(named: NSApplication.didBecomeActiveNotification) {
                await refreshExtensionState()
            }
        }
#endif
    }

    // MARK: Hintergrund

    private var backgroundGradient: some View {
        // Fester Marken-Look wie das Icon, unabhängig vom Systemerscheinungsbild.
        LinearGradient(
            colors: [.qisBackground, .qisBackgroundBottom],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    }

    // MARK: Header

    private var header: some View {
        VStack(spacing: 16) {
            LogoMark()

            VStack(spacing: 4) {
                // Wortmarke im Stil des Icons: dunkles Petrol mit orangem Plus.
                HStack(spacing: 2) {
                    Text("QIS")
                        .foregroundStyle(Color.qisTeal)
                    Text("+")
                        .foregroundStyle(Color.qisOrange)
                }
                .font(.system(size: 40, weight: .heavy, design: .rounded))

                Text("Bringt Übersicht in den Notenspiegel des QIS-Portals der Hochschule Trier.")
                    .font(.subheadline)
                    .multilineTextAlignment(.center)
                    .foregroundStyle(Color.qisInk.opacity(0.65))
            }
        }
        .padding(.top, 8)
    }

#if os(macOS)
    // MARK: Erweiterungs-Status (nur macOS)

    @ViewBuilder
    private var extensionStateBadge: some View {
        if let enabled = extensionEnabled {
            HStack(spacing: 8) {
                Circle()
                    .fill(enabled ? Color.qisGreen : Color.qisCrimson)
                    .frame(width: 8, height: 8)
                Text(enabled ? "Erweiterung ist aktiviert" : "Erweiterung ist noch deaktiviert")
                    .font(.footnote.weight(.medium))
                    .foregroundStyle(Color.qisInk.opacity(0.85))
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 8)
            .background(Capsule().fill(Color.qisInk.opacity(0.06)))
        }
    }
#endif

    // MARK: Anleitung: Aktivieren

    private var instructionCard: some View {
        SectionCard(title: "So aktivierst du QIS Plus") {
#if os(iOS)
            InstructionStep(
                number: 1,
                icon: "gearshape.fill",
                text: "Öffne die App **Einstellungen** auf deinem Gerät."
            )
            InstructionStep(
                number: 2,
                icon: "safari.fill",
                text: "Tippe auf **Apps**, dann auf **Safari** und anschließend auf **Erweiterungen**."
            )
            InstructionStep(
                number: 3,
                icon: "checkmark.seal.fill",
                text: "Wähle **QIS Plus** aus der Liste, aktiviere den Schalter und erlaube den Zugriff auf qis.hochschule-trier.de."
            )
#elseif os(macOS)
            InstructionStep(
                number: 1,
                icon: "safari.fill",
                text: "Öffne **Safari** und wähle in der Menüleiste **Safari → Einstellungen …**."
            )
            InstructionStep(
                number: 2,
                icon: "puzzlepiece.extension.fill",
                text: "Wechsle zum Tab **Erweiterungen**."
            )
            InstructionStep(
                number: 3,
                icon: "checkmark.seal.fill",
                text: "Setze das Häkchen bei **QIS Plus** und erlaube den Zugriff auf qis.hochschule-trier.de."
            )
#endif
        }
    }

    // MARK: Anleitung: Benutzung

    private var howItWorksCard: some View {
        SectionCard(title: "So funktioniert's") {
            InstructionStep(
                number: 1,
                icon: "person.fill",
                text: "Melde dich in Safari wie gewohnt im QIS-Portal an."
            )
            InstructionStep(
                number: 2,
                icon: "tablecells.fill",
                text: "Öffne deinen **Notenspiegel**. QIS Plus arbeitet automatisch im Hintergrund."
            )
            InstructionStep(
                number: 3,
                icon: "slider.horizontal.3",
                text: "Deine Einstellungen erreichst du jederzeit über das **QIS Plus-Symbol** in der Safari-Symbolleiste."
            )
        }
    }

    // MARK: Funktionen

    private var featuresCard: some View {
        SectionCard(title: "Funktionen") {
            FeatureRow(icon: "paintpalette.fill", text: "Farbcodierter Modul-Status im Notenspiegel")
            FeatureRow(icon: "sum", text: "ECTS-gewichteter Notenschnitt direkt im Tabellenkopf")
            FeatureRow(icon: "sparkles", text: "\u{201E}NEU\u{201C}-Badge, sobald eine neue Note eingetragen wurde")
            FeatureRow(icon: "hourglass", text: "\u{201E}Warten\u{201C}-Markierung für geschriebene Prüfungen ohne Ergebnis")
            FeatureRow(icon: "eye.slash.fill", text: "Spalten, Detailzeilen und Studienleistungen ausblendbar")
            FeatureRow(icon: "slider.horizontal.below.rectangle", text: "Alle Farben frei anpassbar")
        }
    }

    // MARK: Datenschutz

    private var privacyCard: some View {
        SectionCard(title: "Datenschutz") {
            HStack(alignment: .top, spacing: 12) {
                Image(systemName: "hand.raised.fill")
                    .font(.subheadline)
                    .foregroundStyle(Color.qisTeal)
                    .padding(.top, 2)
                Text("QIS Plus erhebt, speichert und überträgt keine persönlichen Daten. Alle Einstellungen bleiben lokal auf deinem Gerät. Die Erweiterung ist ausschließlich auf qis.hochschule-trier.de aktiv.")
                    .font(.subheadline)
                    .foregroundStyle(Color.qisInk.opacity(0.85))
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    // MARK: Aktions-Button

    private var openSettingsButton: some View {
        Button(action: openSettings) {
            HStack(spacing: 10) {
                Image(systemName: "gearshape.fill")
#if os(iOS)
                Text("Einstellungen öffnen")
#elseif os(macOS)
                Text("Safari-Erweiterungen öffnen")
#endif
            }
            .font(.headline)
            .frame(maxWidth: .infinity)
        }
        .buttonStyle(TealButtonStyle())
    }

    // MARK: Footer

    private var footer: some View {
        VStack(spacing: 20) {
            Link(destination: githubURL) {
                Label("Quellcode auf GitHub", systemImage: "chevron.left.forwardslash.chevron.right")
            }
            .font(.footnote.weight(.medium))
            .foregroundStyle(Color.qisOrange)

            Text("QIS Plus ist ein unabhängiges Open-Source-Projekt und steht in keiner Verbindung zur Hochschule Trier.")
                .font(.caption2)
                .multilineTextAlignment(.center)
                .foregroundStyle(Color.qisInk.opacity(0.45))
        }
        .padding(.top, 4)
    }

    // MARK: Aktionen

    private func openSettings() {
#if os(iOS)
        guard let url = URL(string: UIApplication.openSettingsURLString) else { return }
        UIApplication.shared.open(url)
#elseif os(macOS)
        SFSafariApplication.showPreferencesForExtension(withIdentifier: extensionBundleIdentifier)
#endif
    }

#if os(macOS)
    private func refreshExtensionState() async {
        let state: SFSafariExtensionState? = await withCheckedContinuation { continuation in
            SFSafariExtensionManager.getStateOfSafariExtension(withIdentifier: extensionBundleIdentifier) { state, _ in
                continuation.resume(returning: state)
            }
        }
        extensionEnabled = state?.isEnabled
    }
#endif
}

// MARK: - Karten-Container

/// Einheitlicher Look für alle Inhalts-Sektionen (Titel + weiße Karte).
private struct SectionCard<Content: View>: View {
    let title: String
    @ViewBuilder let content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            Text(title)
                .font(.headline)
                .foregroundStyle(Color.qisInk)

            content
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(24)
        .background(
            RoundedRectangle(cornerRadius: 24, style: .continuous)
                .fill(.white)
                .shadow(color: Color.qisInk.opacity(0.06), radius: 12, y: 6)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 24, style: .continuous)
                .stroke(Color.qisInk.opacity(0.08), lineWidth: 1)
        )
    }
}

// MARK: - Logo

/// Zeigt das echte App-Icon aus dem Asset-Katalog („LargeIcon").
private struct LogoMark: View {
    var body: some View {
        Image("LargeIcon")
            .resizable()
            .scaledToFit()
            .frame(width: 108, height: 108)
            .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 24, style: .continuous)
                    .stroke(Color.qisInk.opacity(0.08), lineWidth: 1)
            )
            .shadow(color: Color.qisInk.opacity(0.18), radius: 14, y: 8)
    }
}

// MARK: - Dekorative Balken-Reihe

/// Drei farbige Balken mit Plus wie im App-Icon, dient als dezente visuelle Trennlinie.
private struct LogoBarsRow: View {
    var body: some View {
        HStack(spacing: 8) {
            Capsule().fill(Color.qisTeal).frame(width: 56, height: 8)
            Capsule().fill(Color.qisCrimson).frame(width: 44, height: 8)
            Capsule().fill(Color.qisGreen).frame(width: 36, height: 8)
            Image(systemName: "plus")
                .font(.system(size: 13, weight: .heavy))
                .foregroundStyle(Color.qisOrange)
        }
    }
}

// MARK: - Einzelner Anleitungsschritt

private struct InstructionStep: View {
    let number: Int
    let icon: String
    let text: LocalizedStringKey

    var body: some View {
        HStack(alignment: .top, spacing: 16) {
            ZStack {
                Circle()
                    .fill(Color.qisTeal.opacity(0.12))
                    .frame(width: 40, height: 40)
                Text("\(number)")
                    .font(.headline.weight(.bold))
                    .foregroundStyle(Color.qisTeal)
            }

            VStack(alignment: .leading, spacing: 6) {
                Image(systemName: icon)
                    .font(.subheadline)
                    .foregroundStyle(Color.qisTeal)
                Text(text)
                    .font(.subheadline)
                    .foregroundStyle(Color.qisInk.opacity(0.85))
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }
}

// MARK: - Einzelne Funktion

private struct FeatureRow: View {
    let icon: String
    let text: LocalizedStringKey

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: icon)
                .font(.subheadline)
                .foregroundStyle(Color.qisTeal)
                .frame(width: 24)
                .padding(.top, 2)
            Text(text)
                .font(.subheadline)
                .foregroundStyle(Color.qisInk.opacity(0.85))
                .fixedSize(horizontal: false, vertical: true)
        }
    }
}

// MARK: - Button-Style

private struct TealButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .foregroundStyle(.white)
            .padding(.vertical, 16)
            .background(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .fill(Color.qisTeal)
            )
            .shadow(color: Color.qisTeal.opacity(0.35), radius: 12, y: 6)
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
            .animation(.easeOut(duration: 0.15), value: configuration.isPressed)
    }
}

// MARK: - Preview

#Preview {
    ContentView()
}
