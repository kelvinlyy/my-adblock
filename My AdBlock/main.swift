//
//  main.swift
//  My AdBlock
//
//  Created by Lai Yung Yin on 10/3/2026.
//

#if os(macOS)
import Cocoa

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.run()

#elseif os(iOS)
import UIKit

UIApplicationMain(
    CommandLine.argc,
    CommandLine.unsafeArgv,
    nil,
    NSStringFromClass(AppDelegate.self)
)
#endif
