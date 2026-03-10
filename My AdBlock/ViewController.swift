//
//  ViewController.swift
//  My AdBlock
//
//  Created by Lai Yung Yin on 23/2/2026.
//

import SafariServices
import WebKit

private let extensionBundleIdentifier = "com.lyy.My-AdBlock.Extension"

// MARK: - macOS

#if os(macOS)
import Cocoa

class ViewController: NSViewController, WKNavigationDelegate, WKScriptMessageHandler {

    var webView: WKWebView!

    override func loadView() {
        let config = WKWebViewConfiguration()
        config.userContentController.add(self, name: "controller")

        webView = WKWebView(frame: NSRect(x: 0, y: 0, width: 425, height: 325), configuration: config)
        webView.navigationDelegate = self
        self.view = webView
    }

    override func viewDidLoad() {
        super.viewDidLoad()

        guard let fileURL = Bundle.main.url(forResource: "Main", withExtension: "html"),
              let resourceURL = Bundle.main.resourceURL else {
            return
        }
        webView.loadFileURL(fileURL, allowingReadAccessTo: resourceURL)
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        SFSafariExtensionManager.getStateOfSafariExtension(withIdentifier: extensionBundleIdentifier) { state, error in
            guard let state, error == nil else { return }

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

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let body = message.body as? String, body == "open-preferences" else { return }

        SFSafariApplication.showPreferencesForExtension(withIdentifier: extensionBundleIdentifier) { _ in
            DispatchQueue.main.async {
                NSApplication.shared.terminate(nil)
            }
        }
    }
}

// MARK: - iOS

#elseif os(iOS)
import UIKit

class ViewController: UIViewController, WKNavigationDelegate, WKScriptMessageHandler {

    var webView: WKWebView!

    override func viewDidLoad() {
        super.viewDidLoad()

        view.backgroundColor = .systemBackground

        let config = WKWebViewConfiguration()
        config.userContentController.add(self, name: "controller")

        webView = WKWebView(frame: .zero, configuration: config)
        webView.translatesAutoresizingMaskIntoConstraints = false
        webView.isOpaque = false
        webView.backgroundColor = .systemBackground
        webView.scrollView.backgroundColor = .systemBackground
        webView.navigationDelegate = self
        view.addSubview(webView)

        NSLayoutConstraint.activate([
            webView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            webView.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor),
            webView.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor),
        ])

        guard let fileURL = Bundle.main.url(forResource: "Main", withExtension: "html"),
              let resourceURL = Bundle.main.resourceURL else {
            return
        }
        webView.loadFileURL(fileURL, allowingReadAccessTo: resourceURL)
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        #if compiler(>=6.2)
        if #available(iOS 26.2, *) {
            SFSafariExtensionManager.getStateOfExtension(withIdentifier: extensionBundleIdentifier) { state, error in
                guard let state, error == nil else { return }

                DispatchQueue.main.async {
                    webView.evaluateJavaScript("show(\(state.isEnabled), false)")
                }
            }
            return
        }
        #endif
        DispatchQueue.main.async {
            webView.evaluateJavaScript("show(undefined, false)")
        }
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let body = message.body as? String, body == "open-preferences" else { return }

        // On iOS, open Settings app
        if let url = URL(string: UIApplication.openSettingsURLString) {
            UIApplication.shared.open(url)
        }
    }
}
#endif
