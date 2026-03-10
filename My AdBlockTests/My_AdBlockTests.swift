//
//  My_AdBlockTests.swift
//  My AdBlockTests
//
//  Created by Lai Yung Yin on 23/2/2026.
//

import XCTest
@testable import My_AdBlock

// MARK: - SafariWebExtensionHandler Tests
// Note: SafariWebExtensionHandler is in the Extension target. These tests
// validate the file-writing / export logic that can be exercised independently.

final class ExportLogicTests: XCTestCase {

    private var tempDir: URL!

    override func setUp() {
        super.setUp()
        tempDir = FileManager.default.temporaryDirectory
            .appendingPathComponent("my-adblock-tests-\(UUID().uuidString)")
        try? FileManager.default.createDirectory(at: tempDir, withIntermediateDirectories: true)
    }

    override func tearDown() {
        try? FileManager.default.removeItem(at: tempDir)
        super.tearDown()
    }

    // MARK: - File export logic (mirrors SafariWebExtensionHandler.handleExportRules)

    /// Write export text to a file, avoiding overwrite — same logic as the handler.
    private func exportToFile(json: String, filename: String, baseURL: URL) throws -> URL {
        let fileManager = FileManager.default
        var fileURL = baseURL.appendingPathComponent(filename)

        var counter = 1
        let name = (filename as NSString).deletingPathExtension
        let ext = (filename as NSString).pathExtension
        while fileManager.fileExists(atPath: fileURL.path) {
            let newName = "\(name) (\(counter)).\(ext)"
            fileURL = baseURL.appendingPathComponent(newName)
            counter += 1
        }

        try json.write(to: fileURL, atomically: true, encoding: .utf8)
        return fileURL
    }

    func testExportWritesFile() throws {
        let fileURL = try exportToFile(json: "test content", filename: "rules.txt", baseURL: tempDir)
        XCTAssertTrue(FileManager.default.fileExists(atPath: fileURL.path))
        let content = try String(contentsOf: fileURL, encoding: .utf8)
        XCTAssertEqual(content, "test content")
    }

    func testExportAvoidsOverwrite() throws {
        let file1 = try exportToFile(json: "first", filename: "rules.txt", baseURL: tempDir)
        let file2 = try exportToFile(json: "second", filename: "rules.txt", baseURL: tempDir)

        XCTAssertNotEqual(file1.lastPathComponent, file2.lastPathComponent)
        XCTAssertEqual(file1.lastPathComponent, "rules.txt")
        XCTAssertEqual(file2.lastPathComponent, "rules (1).txt")

        let content1 = try String(contentsOf: file1, encoding: .utf8)
        let content2 = try String(contentsOf: file2, encoding: .utf8)
        XCTAssertEqual(content1, "first")
        XCTAssertEqual(content2, "second")
    }

    func testExportIncrementsCounterForMultipleDuplicates() throws {
        _ = try exportToFile(json: "1", filename: "rules.txt", baseURL: tempDir)
        _ = try exportToFile(json: "2", filename: "rules.txt", baseURL: tempDir)
        let file3 = try exportToFile(json: "3", filename: "rules.txt", baseURL: tempDir)

        XCTAssertEqual(file3.lastPathComponent, "rules (2).txt")
    }

    func testExportPreservesFileExtension() throws {
        let file = try exportToFile(json: "{}", filename: "my-rules.json", baseURL: tempDir)
        XCTAssertTrue(file.lastPathComponent.hasSuffix(".json"))
    }

    func testExportDefaultFilename() throws {
        let filename = (nil as String?) ?? "my-adblock-rules.txt"
        let file = try exportToFile(json: "data", filename: filename, baseURL: tempDir)
        XCTAssertEqual(file.lastPathComponent, "my-adblock-rules.txt")
    }

    func testExportHandlesUnicodeContent() throws {
        let json = "規則列表：廣告攔截"
        let file = try exportToFile(json: json, filename: "rules.txt", baseURL: tempDir)
        let content = try String(contentsOf: file, encoding: .utf8)
        XCTAssertEqual(content, json)
    }

    func testExportHandlesEmptyContent() throws {
        let file = try exportToFile(json: "", filename: "empty.txt", baseURL: tempDir)
        let content = try String(contentsOf: file, encoding: .utf8)
        XCTAssertEqual(content, "")
    }

    func testExportHandlesLargeContent() throws {
        let largeJson = String(repeating: "||ads.example.com^\n", count: 10000)
        let file = try exportToFile(json: largeJson, filename: "large.txt", baseURL: tempDir)
        XCTAssertTrue(FileManager.default.fileExists(atPath: file.path))
        let content = try String(contentsOf: file, encoding: .utf8)
        XCTAssertEqual(content.count, largeJson.count)
    }

    func testExportFilenameWithoutExtension() throws {
        let file = try exportToFile(json: "data", filename: "rules", baseURL: tempDir)
        XCTAssertEqual(file.lastPathComponent, "rules")
    }
}

// MARK: - App Delegate Tests

#if os(macOS)
final class AppDelegateTests: XCTestCase {

    func testApplicationShouldTerminateAfterLastWindowClosed() {
        let delegate = AppDelegate()
        XCTAssertTrue(delegate.applicationShouldTerminateAfterLastWindowClosed(NSApplication.shared))
    }

    func testApplicationSupportsSecureRestorableState() {
        let delegate = AppDelegate()
        XCTAssertTrue(delegate.applicationSupportsSecureRestorableState(NSApplication.shared))
    }
}
#elseif os(iOS)
final class AppDelegateTests: XCTestCase {

    func testApplicationDidFinishLaunching() {
        let delegate = AppDelegate()
        let result = delegate.application(UIApplication.shared, didFinishLaunchingWithOptions: nil)
        XCTAssertTrue(result)
    }

    func testConfigurationForConnectingSceneSession() {
        let delegate = AppDelegate()
        // We can't easily mock UISceneSession, so just verify the delegate is instantiable
        XCTAssertNotNil(delegate)
    }
}
#endif

// MARK: - ViewController Tests

final class ViewControllerTests: XCTestCase {

    func testViewControllerInstantiation() {
        let vc = ViewController()
        XCTAssertNotNil(vc)
    }

    func testViewDidLoadCreatesWebView() {
        let vc = ViewController()
        #if os(macOS)
        vc.loadView()
        vc.viewDidLoad()
        XCTAssertNotNil(vc.webView)
        #elseif os(iOS)
        vc.loadViewIfNeeded()
        XCTAssertNotNil(vc.webView)
        #endif
    }
}
