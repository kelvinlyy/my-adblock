# 🛡 My AdBlock

A native **Safari Web Extension** for macOS that blocks ads and tracking requests using a built-in blocklist and user-defined custom rules, with a real-time popup dashboard showing blocked-request statistics.

> All filtering happens locally inside the browser — no third-party proxy, no external server.

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| **Built-in Blocklist** | Ships with 30 known ad/tracking hosts and 14 URL path patterns blocked via `declarativeNetRequest` static rules. |
| **Custom Rules** | Add your own hosts or URL patterns directly from the popup — no code changes or restarts needed. |
| **Network-level Blocking** | Uses the Manifest V3 `declarativeNetRequest` API to block matching requests before any data is sent. |
| **Cosmetic Filtering** | Hides common ad containers (Google Ads, Taboola, Outbrain, etc.) via injected CSS and DOM removal. |
| **Blocked-Request Dashboard** | Popup shows a live session counter, all-time total, and a searchable list of blocked URLs. |
| **Import / Export** | Export custom rules as JSON to your Downloads folder; import rules from a JSON file. |

---

## 📸 How It Works

```
Browser makes a request
        │
        ▼
┌──────────────────────────────┐
│  declarativeNetRequest       │  ◄── Static rules (rules.json)
│  Rule Engine (browser-level) │      + dynamic custom rules
└──────────┬───────────────────┘
           │  Match → Block (no network call)
           │  No match ↓
┌──────────────────────────────┐
│  content.js                  │  ◄── Cosmetic filtering
│  Hide ad elements + detect   │      + PerformanceObserver
│  blocked resource loads      │      reports to background.js
└──────────┬───────────────────┘
           │
┌──────────────────────────────┐
│  background.js               │  Increments blocked count,
│  Event Logger                │  logs URL + matched rule
└──────────────────────────────┘
           │
           ▼
    popup.js reads stats
    and renders dashboard
```

1. **Static rules** (`rules.json`) block known ad hosts and URL patterns at the browser engine level.
2. **Dynamic rules** (user-added via popup) are registered with `declarativeNetRequest.updateDynamicRules` and persisted in `browser.storage.local`.
3. **content.js** injects CSS to hide ad containers, monitors resource loads via `PerformanceObserver` + `MutationObserver`, and reports blocked URLs to the background service worker.
4. **background.js** maintains session and all-time counters, manages custom rule CRUD, and handles import/export.
5. **popup.js** fetches stats and renders the dashboard with auto-refresh.

---

## 🗂 Project Structure

```
My AdBlock/
├── My AdBlock/                         # macOS app wrapper (Swift / AppKit)
│   ├── AppDelegate.swift               # App lifecycle
│   ├── ViewController.swift            # WebView showing extension status
│   ├── Assets.xcassets/                # App icons and colors
│   ├── Base.lproj/
│   │   └── Main.storyboard            # Storyboard UI
│   └── Resources/
│       ├── Base.lproj/Main.html        # Status page HTML
│       ├── Script.js                   # Status page logic
│       ├── Style.css                   # Status page styles
│       └── Icon.png                    # App icon
│
├── My AdBlock Extension/               # Safari Web Extension
│   ├── SafariWebExtensionHandler.swift # Native messaging handler (export to Downloads)
│   ├── Info.plist                      # Extension point config
│   ├── My_AdBlock_Extension.entitlements
│   └── Resources/
│       ├── manifest.json               # Extension manifest (Manifest V3)
│       ├── background.js               # Service worker — blocking logic & stats
│       ├── content.js                  # Content script — cosmetic filtering & detection
│       ├── popup.html                  # Toolbar popup UI
│       ├── popup.js                    # Popup logic — stats & custom rule management
│       ├── popup.css                   # Popup styles (light/dark mode)
│       ├── rules.json                  # Static declarativeNetRequest rules (43 rules)
│       ├── images/                     # Extension icons (48–512px + toolbar SVG)
│       └── _locales/en/messages.json   # Localization strings
│
├── My AdBlockTests/                    # Unit tests
├── My AdBlockUITests/                  # UI tests
├── My AdBlock.xcodeproj/               # Xcode project
├── PROJECT_SUMMARY.md                  # Detailed project design document
└── README.md                           # ← You are here
```

---

## 🔧 Tech Stack

| Layer | Technology |
|-------|-----------|
| Platform | macOS Safari Web Extension (Xcode) |
| Manifest | Manifest V3 |
| Request Blocking | `declarativeNetRequest` API (static + dynamic rules) |
| Background Logic | `background.js` (Service Worker) |
| Content Script | `content.js` (PerformanceObserver, MutationObserver, CSS injection) |
| Popup UI | `popup.html` / `popup.js` / `popup.css` |
| Persistence | `browser.storage.local` |
| Native Messaging | `SafariWebExtensionHandler.swift` (file export) |
| Native Wrapper | Swift / AppKit |
| Build | Xcode |

---

## 🚀 Getting Started

### Prerequisites

- **macOS 12+**
- **Xcode 14+**
- **Safari 16+** with developer mode enabled

### Build & Run

1. Open `My AdBlock.xcodeproj` in Xcode.
2. Select the **My AdBlock** scheme and your Mac as the run destination.
3. Press **⌘R** to build and run.
4. In Safari, go to **Settings → Extensions** and enable **My AdBlock**.
5. Click the 🛡 **My AdBlock** icon in the Safari toolbar to open the popup.

### Enable Developer Mode (required for unsigned extensions)

```
Safari → Settings → Advanced → ✅ Show features for web developers
Safari → Develop → Allow Unsigned Extensions
```

---

## 🛡 Built-in Blocklist

### Blocked Hosts (30 domains)

Requests to these domains (and all subdomains) are blocked:

| | | |
|---|---|---|
| doubleclick.net | googleadservices.com | googlesyndication.com |
| adservice.google.com | ads.yahoo.com | adnxs.com |
| adsafeprotected.com | moatads.com | outbrain.com |
| taboola.com | scorecardresearch.com | quantserve.com |
| adzerk.net | rubiconproject.com | pubmatic.com |
| openx.net | criteo.com | bluekai.com |
| exelate.com | zergnet.com | amazon-adsystem.com |
| advertising.com | bidswitch.net | casalemedia.com |
| demdex.net | mathtag.com | serving-sys.com |
| turn.com | medianet.com | sharethrough.com |

### Blocked URL Path Patterns (13 patterns)

| Pattern | Pattern | Pattern |
|---------|---------|---------|
| `/ads/` | `/ad/` | `/adserver/` |
| `/advertising/` | `/tracking/` | `/tracker/` |
| `/analytics/` | `/pixel/` | `/beacon/` |
| `/telemetry/` | `/pagead/` | `/adsense/` |
| `/adclick/` | `/sponsored/` | |

---

## ➕ Custom Rules

1. Open the **My AdBlock** popup from the Safari toolbar.
2. Expand the **Custom Rules** section.
3. Select **Host** or **URL Pattern** from the dropdown.
4. Enter the value (e.g., `ads.example.com` or `/promo/`).
5. Click **Add** — the rule is immediately active.

Custom rules are persisted across browser sessions and registered as dynamic `declarativeNetRequest` rules.

### Import / Export

- **Export**: Click ⬇ Export to save your custom rules as a JSON file in your Downloads folder.
- **Import**: Click ⬆ Import to load rules from a previously exported JSON file.

---

## 📊 Dashboard

The popup (toolbar icon) serves as the main dashboard:

- **Session blocked count** — large counter showing blocks since Safari launched.
- **All-time blocked** — persistent counter across all sessions.
- **Active rules** — total count (built-in + custom).
- **Blocked Requests** — expandable, searchable list with timestamps and matched rules.
- **Clear** — resets the session counter and list.

Stats auto-refresh every 3 seconds while the popup is open.

---

## 🗺 Roadmap

- [x] Static blocklist via `declarativeNetRequest` (`rules.json`)
- [x] Background service worker — block event logging & counters
- [x] Popup dashboard — stats summary & blocked-request list
- [x] Custom rules — add/remove host or URL pattern rules
- [x] Persist custom rules & register as dynamic DNR rules
- [x] Import/export custom rules (JSON)
- [ ] Subscribe to external filter lists (EasyList format)
- [ ] Per-site allowlist (pause blocking for a specific domain)
- [ ] Block statistics chart (requests over time)

---

## 📄 License

This project is for personal/educational use.
