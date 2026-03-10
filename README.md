# My AdBlock

A native **Safari Web Extension** for **macOS and iOS** that blocks ads and tracking requests using user-defined custom rules, with a real-time popup dashboard showing blocked-request statistics.

> All filtering happens locally inside the browser — no third-party proxy, no external server.

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| **Custom Rules** | Add your own hosts or URL patterns directly from the popup — no code changes or restarts needed. |
| **Network-level Blocking** | Uses the Manifest V3 `declarativeNetRequest` API to block matching requests before any data is sent. |
| **Cosmetic Filtering** | Hides common ad containers (Google Ads, Taboola, Outbrain, etc.) via injected CSS and DOM removal. |
| **Blocked-Request Dashboard** | Popup shows a live per-site counter, per-session counter, and a searchable list of blocked URLs. |
| **Right-Click Blocking** | Right-click any element on a page to block its hostname — an in-page confirmation dialog lets you review and edit before adding. |
| **Import / Export** | Export custom rules as an EasyList-format text file; import rules from EasyList / Adblock Plus filter lists (`.txt`, `.list`). |
| **Modular Architecture** | Each file has a single responsibility — background, content, popup, and shared modules are cleanly separated into folders. |
| **Multiplatform** | Runs on both macOS Safari and iOS Safari from a single codebase. |

---

## 📸 How It Works

```
Browser makes a request
        │
        ▼
┌──────────────────────────────┐
│  declarativeNetRequest       │  ◄── Dynamic custom rules
│  Rule Engine (browser-level) │      (registered via rule-manager.js)
└──────────┬───────────────────┘
           │  Match → Block (no network call)
           │  No match ↓
┌──────────────────────────────┐
│  content scripts             │  ◄── Cosmetic filtering
│  blocklist-matcher.js        │      (cosmetic-filter.js)
│  cosmetic-filter.js          │  ◄── Custom rule matching
│  resource-scanner.js         │      reports to background
└──────────┬───────────────────┘
           │
┌──────────────────────────────┐
│  background scripts          │  Increments blocked count,
│  session-tracker.js          │  logs URL + matched rule
│  rule-manager.js             │  manages custom rule CRUD
└──────────────────────────────┘
           │
           ▼
    popup scripts read stats
    and render dashboard
```

1. **Dynamic rules** (user-added via popup or right-click context menu) are registered with `declarativeNetRequest.updateDynamicRules` and persisted in `browser.storage.local`.
2. **Content scripts** inject CSS to hide ad containers (`cosmetic-filter.js`), monitor resource loads via `PerformanceObserver` + `MutationObserver` (`resource-scanner.js`), match URLs against custom rules (`blocklist-matcher.js`), and report blocked URLs to the background.
3. **Background scripts** maintain session and all-time counters (`session-tracker.js`), manage custom rule CRUD (`rule-manager.js`), handle DNR registration (`dnr.js`), and route messages (`background.js`).
4. **Popup scripts** fetch stats and render the dashboard with auto-refresh.

---

## 🗂 Project Structure

```
My AdBlock/
├── My AdBlock/                         # App wrapper (Swift / AppKit + UIKit)
│   ├── AppDelegate.swift               # App lifecycle
│   ├── ViewController.swift            # WebView showing extension status
│   ├── SceneDelegate.swift             # iOS scene lifecycle
│   ├── main.swift                      # App entry point (macOS / iOS)
│   ├── Assets.xcassets/                # App icons and colors
│   └── Resources/
│       ├── Base.lproj/Main.html        # Status page HTML
│       ├── Script.js                   # Status page logic
│       ├── Style.css                   # Status page styles
│       └── icon-master.png             # App icon
│
├── My AdBlock Extension/               # Safari Web Extension
│   ├── SafariWebExtensionHandler.swift # Native messaging handler (export to Downloads)
│   ├── Info.plist                      # Extension point config
│   ├── My_AdBlock_Extension.entitlements
│   └── Resources/
│       ├── manifest.json               # Extension manifest (Manifest V3)
│       ├── background/                 # Background service worker scripts
│       │   ├── storage.js              #   Storage read/write helpers
│       │   ├── dnr.js                  #   declarativeNetRequest helpers
│       │   ├── rule-manager.js         #   Rule CRUD, import/export
│       │   ├── session-tracker.js      #   Blocked request session tracking
│       │   ├── context-menu.js         #   Right-click "Block hostname" menu
│       │   └── background.js           #   Message router & init
│       ├── content/                    # Content scripts (injected into pages)
│       │   ├── blocklist-matcher.js    #   Custom rule URL matching & reporting
│       │   ├── cosmetic-filter.js      #   Ad element CSS hiding & DOM removal
│       │   ├── resource-scanner.js     #   PerformanceObserver & DOM scanning
│       │   └── content.js             #   Context menu handler & init
│       ├── popup/                      # Extension popup UI
│       │   ├── popup.html              #   Popup markup
│       │   ├── popup.css               #   Popup styles (light/dark mode)
│       │   ├── popup-ui.js             #   Toggle/toast/formatting utilities
│       │   ├── popup-stats.js          #   Stats loading & rendering
│       │   ├── popup-blocked.js        #   Blocked requests list
│       │   ├── popup-rules.js          #   Custom rules management
│       │   └── popup.js                #   Init & orchestration
│       ├── shared/                     # Shared modules
│       │   └── easylist-parser.js      #   EasyList / Adblock Plus filter parser
│       ├── images/                     # Extension icons (48–512px + toolbar)
│       └── _locales/en/messages.json   # Localization strings
│
├── My AdBlockTests/                    # Unit tests
├── My AdBlockUITests/                  # UI tests
├── My AdBlock.xcodeproj/               # Xcode project
└── README.md                           # ← You are here
```

---

## 🔧 Tech Stack

| Layer | Technology |
|-------|-----------|
| Platform | macOS + iOS Safari Web Extension (Xcode, multiplatform) |
| Manifest | Manifest V3 |
| Request Blocking | `declarativeNetRequest` API (dynamic rules) |
| Background Scripts | `background/` — storage, DNR, rule manager, session tracker, context menu, message router |
| Content Scripts | `content/` — custom rule matcher, cosmetic filter, resource scanner, init |
| Popup UI | `popup/` — HTML, CSS, stats, blocked list, rules management, orchestration |
| Shared | `shared/easylist-parser.js` — EasyList / Adblock Plus filter parser |
| Persistence | `browser.storage.local` |
| Native Messaging | `SafariWebExtensionHandler.swift` (file export) |
| Native Wrapper | Swift / AppKit (macOS) + UIKit (iOS) |
| Build | Xcode |

---

## 🚀 Getting Started

### Prerequisites

- **macOS 12+** (for macOS Safari) or **iOS 15+** (for iOS Safari)
- **Xcode 14+**
- **Safari 16+** with developer mode enabled (macOS)

### Build & Run

1. Open `My AdBlock.xcodeproj` in Xcode.
2. Select the **My AdBlock** scheme.
3. Choose your run destination — **My Mac** (macOS) or an **iPhone / iPad** simulator or device (iOS).
4. Press **⌘R** to build and run.
5. **macOS**: In Safari, go to **Settings → Extensions** and enable **My AdBlock**.
6. **iOS**: Go to **Settings → Safari → Extensions** and enable **My AdBlock**.
7. Click the **My AdBlock** icon in the Safari toolbar (macOS) or tap the puzzle icon in Safari's address bar (iOS) to open the popup.

### Enable Developer Mode (required for unsigned extensions)

**macOS:**
```
Safari → Settings → Advanced → ✅ Show features for web developers
Safari → Develop → Allow Unsigned Extensions
```

**iOS:**
```
Settings → Safari → Advanced → Web Extensions → Developer Mode → On
```

---

## 🛡 Cosmetic Filtering

Even without custom rules, the content script automatically hides common ad elements via CSS injection and DOM removal. Targeted selectors include:

- **Google Ads** — `ins.adsbygoogle`, `[id^="google_ads"]`, `[id^="div-gpt-ad"]`
- **Third-party widgets** — Taboola, Outbrain (`[class*="taboola"]`, `[class*="outbrain"]`)
- **Common ad containers** — `.ad-container`, `.ad-wrapper`, `.ad-banner`, `.advertisement`, `.sponsored-content`, etc.
- **Data attributes** — `[data-ad]`, `[data-ad-slot]`, `[data-google-query-id]`
- **ARIA labels** — `[aria-label="advertisement"]`, `[aria-label="Sponsored"]`

---

## ➕ Custom Rules

1. Open the **My AdBlock** popup from the Safari toolbar.
2. Expand the **Custom Rules** section.
3. Select **Host** or **URL Pattern** from the dropdown.
4. Enter the value (e.g., `ads.example.com` or `/promo/`).
5. Click **Add** — the rule is immediately active.

Custom rules are persisted across browser sessions and registered as dynamic `declarativeNetRequest` rules.

### Right-Click Blocking (macOS only)

You can also add rules directly from any web page on macOS:

1. **Right-click** any element (ad image, iframe, link, etc.) on a page.
2. Select **"My AdBlock — Block this hostname"** from the context menu.
3. An in-page confirmation dialog appears pre-filled with the element's hostname (e.g. `ads.example.com`).
4. Review or edit the hostname, then press **Block** to confirm (or **Cancel** / Escape to dismiss).
5. The hostname is instantly added as a custom blocking rule and takes effect on the current page.

### Import / Export

- **Export**: Click ⬇ Export to save your custom rules as an EasyList-format text file to your Downloads folder.
- **Import**: Click ⬆ Import to load rules from an EasyList / Adblock Plus filter list (`.txt` or `.list` files).

---

## 📊 Dashboard

The popup (toolbar icon) serves as the main dashboard:

- **Blocked on this site** — large counter showing blocks on the current page since its last navigation.
- **Blocked this session** — counter showing blocks for the current tab across navigations.
- **Active rules** — total count of custom rules.
- **Blocked Requests** — expandable, searchable list with timestamps and matched rules.
- **Clear** — resets the session counter and list.

Stats auto-refresh every 3 seconds while the popup is open.

---

## 🗺 Roadmap

- [x] Background service worker — block event logging & counters
- [x] Popup dashboard — stats summary & blocked-request list
- [x] Custom rules — add/remove host or URL pattern rules
- [x] Persist custom rules & register as dynamic DNR rules
- [x] Import/export custom rules (EasyList text format)
- [x] Right-click context menu to block hostname from any page
- [x] Cosmetic filtering — CSS injection & DOM removal
- [x] Modular SRP architecture — background, content, popup, shared folders
- [x] Multiplatform support — macOS and iOS from a single codebase

---

## 📄 License

This project is for personal/educational use.
