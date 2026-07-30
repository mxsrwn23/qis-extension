//
//  AppDelegate.swift
//  macOS (App)
//
//  Created by Max Sauerwein on 30.07.26.
//

import Cocoa
import SwiftUI

@main
class AppDelegate: NSObject, NSApplicationDelegate {

    func applicationDidFinishLaunching(_ notification: Notification) {
        // Ersetzt den Storyboard-Platzhalter durch den SwiftUI-Screen.
        if let window = NSApp.windows.first {
            window.contentViewController = NSHostingController(rootView: ContentView())
            window.setContentSize(NSSize(width: 500, height: 760))
            window.center()
        }
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        return true
    }

}
