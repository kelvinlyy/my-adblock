# My AdBlock

> A Safari Web Extension (macOS) that blocks ad and tracking requests using a built-in blocklist and user-defined custom rules, with a popup dashboard showing blocked-request statistics.

---

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [How It Works](#how-it-works)
- [Built-in Blocklist](#built-in-blocklist)
- [Custom Rules](#custom-rules)
- [Dashboard & Reporting](#dashboard--reporting)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Roadmap](#roadmap)

---

## Overview

**My AdBlock** is a Safari Web Extension built with Xcode for macOS. It intercepts outgoing network requests at the browser level using the WebExtensions `declarativeNetRequest` API (Manifest v3). Requests matching a hardcoded list of known ad/tracking hosts and URL patterns — or any user-defined custom rules — are blocked before they reach the network.

A popup UI (accessible from the Safari toolbar) shows a real-time counter of how many requests have been blocked, along with an expandable list of every blocked request for the current session.

---

## Key Features

| # | Feature | Description |
|---|---------|-------------|
| 1 | **Hardcoded Blocklist** | Ships with a curated set of well-known ad hosts and URL prefixes (e.g. `doubleclick.net`, `googlesyndication.com`, `/ads/`, `/tracking/`). |
| 2 | **Custom Rules** | Users can add their own ad hosts and URL patterns directly from the popup UI — no code changes or app restarts required. |
| 3 | **Traffic Blocking** | Uses `declarativeNetRequest` to block matching requests at the browser engine level before any data is sent. |
| 4 | **Blocked-Request Dashboard** | Popup shows a live blocked-request counter (session total). An expandable list shows every blocked URL, timestamp, and the rule that triggered the block. |

---

## How It Works

```
Browser makes a request
        │
        ▼
 ┌──────────────────────────┐
 │  declarativeNetRequest   │  ◄── Static rules (rules.json)
 │  Rule Engine (built-in)  │      built-in hosts + patterns
 └────────┬─────────────────┘
          │ Match found → Block (no network call)
          │ No match ↓
 ┌──────────────────────────┐
 │  content.js              │  ◄── Dynamic rules (custom rules
 │  Dynamic Rule Check      │      stored in extension storage)
 └────────┬─────────────────┘
          │ Match found → Block
          │ No match ↓
   Request proceeds normally
          │
 ┌──────────────────────────┐
 │  background.js           │  Listens for block events,
 │  Event Logger            │  updates blocked count + log
 └──────────────────────────┘
          │
          ▼
   popup.js reads stats
   and renders dashboard
```

**Request lifecycle:**

1. Browser initiates a network request.
2. `declarativeNetRequest` checks the request against static rules (built-in blocklist in `rules.json`).
3. Dynamic custom rules (added by the user) are checked via `declarativeNetRequest.updateDynamicRules`.
4. **Blocked:** request is cancelled by the browser engine; `background.js` increments the counter and logs the URL.
5. **Allowed:** request proceeds; no action taken.
6. Opening the popup fetches stats from `background.js` via `browser.runtime.sendMessage` and renders the dashboard.

---

## Built-in Blocklist

Hardcoded in `rules.json` as `declarativeNetRequest` static rules.

### Blocked Hosts (exact domain + all subdomains)

```
doubleclick.net
googleadservices.com
googlesyndication.com
adservice.google.com
ads.yahoo.com
adnxs.com
adsafeprotected.com
moatads.com
outbrain.com
taboola.com
scorecardresearch.com
quantserve.com
adzerk.net
rubiconproject.com
pubmatic.com
openx.net
criteo.com
bluekai.com
exelate.com
zergnet.com
```

### Blocked URL Path Patterns

```
/ads/
/ad/
/adserver/
/advertising/
/tracking/
/tracker/
/analytics/
/pixel/
/beacon/
/telemetry/
/pagead/
/adsense/
/adclick/
/sponsored/
```

---

## Custom Rules

Users can extend the blocklist without editing any code, directly from the popup:

1. Open the **My AdBlock** popup from the Safari toolbar.
2. Navigate to the **Custom Rules** section.
3. Enter a hostname (e.g. `ads.example.com`) or a URL pattern (e.g. `*/promo/*`).
4. Click **Add Rule** — the rule is saved to `browser.storage.local` and registered as a dynamic `declarativeNetRequest` rule immediately.
5. Existing custom rules are listed with a **Remove** button for easy management.

Custom rules persist across browser sessions via `browser.storage.local`.

---

## Dashboard & Reporting

The popup (toolbar icon) serves as the main dashboard.

### Summary Panel

```
┌──────────────────────────────────────┐
│  🛡 My AdBlock                       │
│                                      │
│  Blocked this session                │
│  ┌─────────────────────────────────┐ │
│  │            1,247                │ │
│  └─────────────────────────────────┘ │
│                                      │
│  All-time blocked:  48,391           │
│  Active rules: 34 (20 built-in       │
│                   + 14 custom)       │
└──────────────────────────────────────┘
```

### Blocked Requests List (Expandable)

A collapsible section below the summary shows all blocked requests for the current session:

| Timestamp | URL | Matched Rule |
|-----------|-----|-------------|
| 14:32:01 | `https://doubleclick.net/ads/…` | `doubleclick.net` |
| 14:32:03 | `https://cdn.adnxs.com/pixel` | `adnxs.com` |
| 14:32:07 | `https://site.com/tracking/click` | `/tracking/` |

- Click **"Show Blocked Requests ▼"** to expand/collapse the list.
- Each row shows the full URL, timestamp, and the rule that matched.
- **Clear Log** button resets the session counter and list.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Platform** | macOS Safari Web Extension (Xcode) |
| **Manifest** | Manifest V3 |
| **Request Blocking** | `declarativeNetRequest` API (static + dynamic rules) |
| **Background Logic** | `background.js` (ES Module, Service Worker) |
| **Popup UI** | `popup.html` + `popup.js` + `popup.css` |
| **Content Script** | `content.js` |
| **Persistence** | `browser.storage.local` |
| **Native Wrapper** | Swift / AppKit (`AppDelegate.swift`, `ViewController.swift`) |
| **Build** | Xcode (`.xcodeproj`) |

---

## Project Structure

```
My AdBlock/
├── My AdBlock/                        # macOS app wrapper (Swift)
│   ├── AppDelegate.swift
│   ├── ViewController.swift
│   ├── Assets.xcassets/
│   ├── Base.lproj/
│   └── Resources/
│
├── My AdBlock Extension/              # Safari Web Extension
│   ├── Info.plist
│   └── Resources/
│       ├── manifest.json              # Extension manifest (MV3)
│       ├── background.js              # Service worker — block event logger
│       ├── content.js                 # Content script (per-page logic)
│       ├── popup.html                 # Toolbar popup UI
│       ├── popup.js                   # Popup logic — stats + custom rules
│       ├── popup.css                  # Popup styles
│       ├── rules.json                 # Static declarativeNetRequest rules
│       ├── images/                    # Extension icons
│       └── _locales/
│           └── en/
│               └── messages.json
│
├── My AdBlockTests/                   # Unit tests
├── My AdBlockUITests/                 # UI tests
├── My AdBlock.xcodeproj/
├── PROJECT_SUMMARY.md
└── README.md
```

---

## Getting Started

### Prerequisites

- macOS 12+
- Xcode 14+
- Safari 16+ with developer mode enabled

### Build & Run

1. Open `My AdBlock.xcodeproj` in Xcode.
2. Select the **My AdBlock** scheme and your Mac as the target.
3. Press **⌘R** to build and run.
4. In Safari, go to **Settings → Extensions** and enable **My AdBlock**.
5. Click the **My AdBlock** icon in the Safari toolbar to open the popup.

### Enable Safari Extension Developer Mode

```
Safari → Settings → Advanced → ✅ Show features for web developers
Safari → Develop → Allow Unsigned Extensions
```

---

## Roadmap

- [ ] Implement `rules.json` with full built-in blocklist (`declarativeNetRequest` static rules)
- [ ] `background.js` — log blocked requests and maintain session + all-time counters
- [ ] `popup.html/js/css` — blocked count summary and expandable blocked-request list
- [ ] Custom rules UI in popup — add/remove host or URL pattern rules
- [ ] Persist custom rules via `browser.storage.local` and register as dynamic rules
- [ ] Subscribe to external filter lists (EasyList format)
- [ ] Per-site allow-list (pause blocking for a specific domain)
- [ ] Block statistics chart (requests over time)

---

*Built as a native Safari Web Extension — no third-party proxy, no external server. All filtering happens locally inside the browser.*
