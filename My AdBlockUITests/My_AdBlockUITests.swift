//
//  My_AdBlockUITests.swift
//  My AdBlockUITests
//
//  Created by Lai Yung Yin on 23/2/2026.
//

import XCTest

final class My_AdBlockUITests: XCTestCase {

    private var app: XCUIApplication!

    override func setUpWithError() throws {
        continueAfterFailure = false
        app = XCUIApplication()
        app.launch()
    }

    override func tearDownWithError() throws {
        app = nil
    }

    // MARK: - Launch & Window

    @MainActor
    func testAppLaunches() throws {
        #if os(macOS)
        XCTAssertTrue(app.windows.count > 0, "App should have at least one window")
        #else
        XCTAssertTrue(app.state == .runningForeground)
        #endif
    }

    // MARK: - WebView Content

    @MainActor
    func testWebViewLoadsContent() throws {
        let webView = app.webViews.firstMatch
        XCTAssertTrue(webView.waitForExistence(timeout: 5), "WKWebView should load within 5 seconds")
    }

    @MainActor
    func testAppIconImageExists() throws {
        let webView = app.webViews.firstMatch
        XCTAssertTrue(webView.waitForExistence(timeout: 5))

        let icon = webView.images["My AdBlock Icon"]
        XCTAssertTrue(icon.waitForExistence(timeout: 3), "App icon image should be visible")
    }

    @MainActor
    func testStatusTextExists() throws {
        let webView = app.webViews.firstMatch
        XCTAssertTrue(webView.waitForExistence(timeout: 5))

        // The page shows one of three states; check that relevant text is present
        let hasExtensionText = webView.staticTexts.allElementsBoundByIndex.contains { el in
            let label = el.label.lowercased()
            return label.contains("extension") || label.contains("adblock") || label.contains("safari")
        }
        XCTAssertTrue(hasExtensionText, "Status text about the extension should be visible")
    }

    @MainActor
    func testOpenPreferencesButtonExists() throws {
        let webView = app.webViews.firstMatch
        XCTAssertTrue(webView.waitForExistence(timeout: 5))

        // Main.html has a button containing "Safari" or "Settings" or "Preferences"
        let buttons = webView.buttons.allElementsBoundByIndex + webView.links.allElementsBoundByIndex
        let hasSettingsButton = buttons.contains { el in
            let label = el.label.lowercased()
            return label.contains("safari") || label.contains("settings") || label.contains("preferences")
        }
        XCTAssertTrue(hasSettingsButton, "Open preferences/settings button should be visible")
    }

    @MainActor
    func testOpenPreferencesButtonIsTappable() throws {
        let webView = app.webViews.firstMatch
        XCTAssertTrue(webView.waitForExistence(timeout: 5))

        let allInteractive = webView.buttons.allElementsBoundByIndex + webView.links.allElementsBoundByIndex
        let settingsButton = allInteractive.first { el in
            let label = el.label.lowercased()
            return label.contains("safari") || label.contains("settings") || label.contains("preferences")
        }

        if let btn = settingsButton {
            XCTAssertTrue(btn.isHittable, "Settings button should be tappable")
        }
    }

    // MARK: - Performance

    @MainActor
    func testLaunchPerformance() throws {
        measure(metrics: [XCTApplicationLaunchMetric()]) {
            XCUIApplication().launch()
        }
    }
}
