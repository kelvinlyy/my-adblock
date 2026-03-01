//
//  SafariWebExtensionHandler.swift
//  My AdBlock Extension
//
//  Created by Lai Yung Yin on 23/2/2026.
//

import SafariServices
import os.log

class SafariWebExtensionHandler: NSObject, NSExtensionRequestHandling {

    // MARK: - NSExtensionRequestHandling

    func beginRequest(with context: NSExtensionContext) {
        let request = context.inputItems.first as? NSExtensionItem

        let profile: UUID?
        if #available(iOS 17.0, macOS 14.0, *) {
            profile = request?.userInfo?[SFExtensionProfileKey] as? UUID
        } else {
            profile = request?.userInfo?["profile"] as? UUID
        }

        let message: Any?
        if #available(iOS 15.0, macOS 11.0, *) {
            message = request?.userInfo?[SFExtensionMessageKey]
        } else {
            message = request?.userInfo?["message"]
        }

        os_log(.default, "Received message from browser.runtime.sendNativeMessage: %@ (profile: %@)",
               String(describing: message), profile?.uuidString ?? "none")

        guard let msgDict = message as? [String: Any],
              let action = msgDict["action"] as? String else {
            sendResponse(context: context, data: ["error": "Invalid message format"])
            return
        }

        switch action {
        case "exportRules":
            handleExportRules(context: context, message: msgDict)
        default:
            sendResponse(context: context, data: ["echo": message as Any])
        }
    }

    // MARK: - Export Rules to Downloads

    private func handleExportRules(context: NSExtensionContext, message: [String: Any]) {
        guard let jsonString = message["json"] as? String else {
            sendResponse(context: context, data: ["error": "Missing json data"])
            return
        }

        let filename = (message["filename"] as? String) ?? "my-adblock-rules.txt"

        // Get the Downloads folder
        let fileManager = FileManager.default
        guard let downloadsURL = fileManager.urls(for: .downloadsDirectory, in: .userDomainMask).first else {
            sendResponse(context: context, data: ["error": "Cannot access Downloads folder"])
            return
        }

        var fileURL = downloadsURL.appendingPathComponent(filename)

        // Avoid overwriting — append a number if file exists
        var counter = 1
        let name = (filename as NSString).deletingPathExtension
        let ext = (filename as NSString).pathExtension
        while fileManager.fileExists(atPath: fileURL.path) {
            let newName = "\(name) (\(counter)).\(ext)"
            fileURL = downloadsURL.appendingPathComponent(newName)
            counter += 1
        }

        do {
            try jsonString.write(to: fileURL, atomically: true, encoding: .utf8)
            os_log(.default, "Exported rules to: %@", fileURL.path)
            sendResponse(context: context, data: [
                "success": true,
                "path": fileURL.lastPathComponent
            ])
        } catch {
            os_log(.error, "Failed to export rules: %@", error.localizedDescription)
            sendResponse(context: context, data: ["error": "Failed to write file: \(error.localizedDescription)"])
        }
    }

    // MARK: - Send Response

    private func sendResponse(context: NSExtensionContext, data: [String: Any]) {
        let response = NSExtensionItem()
        if #available(iOS 15.0, macOS 11.0, *) {
            response.userInfo = [SFExtensionMessageKey: data]
        } else {
            response.userInfo = ["message": data]
        }
        context.completeRequest(returningItems: [response])
    }

}
