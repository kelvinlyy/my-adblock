//
//  ViewController.swift
//  My AdBlock
//
//  Created by Lai Yung Yin on 23/2/2026.
//

import Cocoa
import SafariServices
import WebKit

// MARK: - Constants

private let extensionBundleIdentifier = "com.lyy.My-AdBlock.Extension"

// MARK: - ViewController

class ViewController: NSViewController, WKNavigationDelegate, WKScriptMessageHandler {

    @IBOutlet var webView: WKWebView!

    // MARK: - Lifecycle

    override func viewDidLoad() {
        super.viewDidLoad()

        webView.navigationDelegate = self
        webView.configuration.userContentController.add(self, name: "controller")

        guard let fileURL = Bundle.main.url(forResource: "Main", withExtension: "html"),
              let resourceURL = Bundle.main.resourceURL else {
            return
        }
        webView.loadFileURL(fileURL, allowingReadAccessTo: resourceURL)
    }

    // MARK: - WKNavigationDelegate

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        SFSafariExtensionManager.getStateOfSafariExtension(withIdentifier: extensionBundleIdentifier) { state, error in
            guard let state, error == nil else {
                return
            }

            let usesSettings: Bool
            if #available(macOS 13, *) {
                usesSettings = true
            } else {
                usesSettings = false
            }

            DispatchQueue.main.async {
                webView.evaluateJavaScript("show(\(state.isEnabled), \(usesSettings))")
            }
        }
    }

    // MARK: - WKScriptMessageHandler

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let body = message.body as? String, body == "open-preferences" else {
            return
        }

        SFSafariApplication.showPreferencesForExtension(withIdentifier: extensionBundleIdentifier) { _ in
            DispatchQueue.main.async {
                NSApplication.shared.terminate(nil)
            }
        }
    }
}
