//
//  AppDelegate.swift
//  My AdBlock
//
//  Created by Lai Yung Yin on 23/2/2026.
//

#if os(macOS)
import Cocoa

@main
class AppDelegate: NSObject, NSApplicationDelegate {

    var window: NSWindow!

    func applicationDidFinishLaunching(_ notification: Notification) {
        let viewController = ViewController()

        window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 425, height: 325),
            styleMask: [.titled, .closable],
            backing: .buffered,
            defer: false
        )
        window.title = "My AdBlock"
        window.contentViewController = viewController
        window.center()
        window.makeKeyAndOrderFront(nil)
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        true
    }
}

#elseif os(iOS)
import UIKit

@main
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication,
                     didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        let window = UIWindow(frame: UIScreen.main.bounds)
        window.rootViewController = ViewController()
        window.makeKeyAndVisible()
        self.window = window
        return true
    }
}
#endif
