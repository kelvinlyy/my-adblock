// ============================================================
// My AdBlock — test-harness.js
// Lightweight test runner + browser API mocks for Node.js
// ============================================================

// ---------------------
// Minimal test runner
// ---------------------
let _totalTests = 0;
let _passedTests = 0;
let _failedTests = 0;
let _currentSuite = "";
let _testQueue = [];

function describe(name, fn) {
    _testQueue.push({ type: "suite", name });
    fn();
}

function it(name, fn) {
    _testQueue.push({ type: "test", name, fn });
}

async function runTests() {
    for (const item of _testQueue) {
        if (item.type === "suite") {
            _currentSuite = item.name;
            console.log(`\n  ${item.name}`);
            continue;
        }

        _totalTests++;
        try {
            const result = item.fn();
            if (result && typeof result.then === "function") {
                await result;
            }
            _passedTests++;
            console.log(`    ✓ ${item.name}`);
        } catch (e) {
            _failedTests++;
            console.log(`    ✗ ${item.name}`);
            console.log(`      ${e.message}`);
        }
    }
}

function assert(condition, message) {
    if (!condition) {
        throw new Error(message || "Assertion failed");
    }
}

function assertEqual(actual, expected, message) {
    if (actual !== expected) {
        throw new Error(message || `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    }
}

function assertDeepEqual(actual, expected, message) {
    const a = JSON.stringify(actual);
    const e = JSON.stringify(expected);
    if (a !== e) {
        throw new Error(message || `Expected ${e}, got ${a}`);
    }
}

function assertNull(value, message) {
    if (value !== null) {
        throw new Error(message || `Expected null, got ${JSON.stringify(value)}`);
    }
}

function assertTrue(value, message) {
    if (value !== true) {
        throw new Error(message || `Expected true, got ${JSON.stringify(value)}`);
    }
}

function assertFalse(value, message) {
    if (value !== false) {
        throw new Error(message || `Expected false, got ${JSON.stringify(value)}`);
    }
}

function assertContains(str, substr, message) {
    if (typeof str !== "string" || !str.includes(substr)) {
        throw new Error(message || `Expected "${str}" to contain "${substr}"`);
    }
}

function assertThrows(fn, message) {
    try {
        fn();
        throw new Error(message || "Expected function to throw");
    } catch (e) {
        if (e.message === (message || "Expected function to throw")) throw e;
    }
}

function printResults() {
    runTests().then(() => {
        console.log(`\n  ─────────────────────────────`);
        console.log(`  ${_passedTests} passing, ${_failedTests} failing, ${_totalTests} total`);
        process.exit(_failedTests > 0 ? 1 : 0);
    });
}

// ---------------------
// Browser API mock
// ---------------------

function createBrowserMock() {
    const store = {};

    const browser = {
        storage: {
            local: {
                get(defaults) {
                    return Promise.resolve(
                        typeof defaults === "object"
                            ? { ...defaults, ...store }
                            : { [defaults]: store[defaults] }
                    );
                },
                set(items) {
                    Object.assign(store, items);
                    return Promise.resolve();
                },
                _store: store,
                _reset() {
                    for (const key of Object.keys(store)) delete store[key];
                },
            },
        },
        declarativeNetRequest: {
            _dynamicRules: [],
            getDynamicRules() {
                return Promise.resolve([...this._dynamicRules]);
            },
            updateDynamicRules({ addRules = [], removeRuleIds = [] } = {}) {
                this._dynamicRules = this._dynamicRules.filter(
                    (r) => !removeRuleIds.includes(r.id)
                );
                this._dynamicRules.push(...addRules);
                return Promise.resolve();
            },
            _reset() {
                this._dynamicRules = [];
            },
        },
        runtime: {
            _messageListeners: [],
            onMessage: {
                addListener(fn) {
                    browser.runtime._messageListeners.push(fn);
                },
            },
            sendMessage(msg) {
                // Simulate sending to the first registered listener
                if (browser.runtime._messageListeners.length > 0) {
                    return browser.runtime._messageListeners[0](msg, { tab: { id: 1 } });
                }
                return Promise.resolve();
            },
            sendNativeMessage(appId, msg) {
                return Promise.resolve({ success: true, path: "test-export.txt" });
            },
            getURL(path) {
                return `safari-web-extension://fake-id/${path}`;
            },
        },
        tabs: {
            _tabs: [{ id: 1, url: "https://example.com", active: true }],
            query(opts) {
                return Promise.resolve(this._tabs.filter((t) => !opts.active || t.active));
            },
            sendMessage(tabId, msg) {
                return Promise.resolve({ ok: true });
            },
            create(opts) {
                return Promise.resolve({ id: 999 });
            },
            onRemoved: {
                addListener(fn) {},
            },
        },
        contextMenus: {
            _created: [],
            create(opts) {
                this._created.push(opts);
            },
            onClicked: {
                _listeners: [],
                addListener(fn) {
                    this._listeners.push(fn);
                },
            },
            _reset() {
                this._created = [];
                this._listeners = [];
            },
        },
        webNavigation: {
            onCommitted: {
                addListener(fn) {},
            },
        },
    };

    // Alias: Safari uses browser.menus sometimes
    browser.menus = browser.contextMenus;

    return browser;
}

// ---------------------
// DOM mock (minimal JSDOM-like)
// ---------------------

function createDOMMock() {
    const elements = {};

    const document = {
        _elements: elements,
        createElement(tag) {
            const el = {
                tagName: tag.toUpperCase(),
                className: "",
                id: "",
                textContent: "",
                innerHTML: "",
                title: "",
                type: "",
                value: "",
                placeholder: "",
                disabled: false,
                src: "",
                href: "",
                data: "",
                style: {},
                children: [],
                attributes: [],
                _eventListeners: {},
                _classList: new Set(),
                classList: {
                    add(...cls) { cls.forEach((c) => el._classList.add(c)); },
                    remove(...cls) { cls.forEach((c) => el._classList.delete(c)); },
                    toggle(cls, force) {
                        if (force === undefined) {
                            el._classList.has(cls) ? el._classList.delete(cls) : el._classList.add(cls);
                        } else {
                            force ? el._classList.add(cls) : el._classList.delete(cls);
                        }
                    },
                    contains(cls) { return el._classList.has(cls); },
                },
                addEventListener(event, fn) {
                    if (!el._eventListeners[event]) el._eventListeners[event] = [];
                    el._eventListeners[event].push(fn);
                },
                dispatchEvent(event) {
                    const listeners = el._eventListeners[event.type || event] || [];
                    listeners.forEach((fn) => fn(event));
                },
                append(...nodes) { el.children.push(...nodes); },
                appendChild(node) { el.children.push(node); return node; },
                remove() { /* no-op for mock */ },
                focus() {},
                select() {},
                click() {
                    const listeners = el._eventListeners["click"] || [];
                    listeners.forEach((fn) => fn({ type: "click" }));
                },
                querySelectorAll(sel) { return []; },
                querySelector(sel) { return null; },
                getAttribute(name) { return null; },
            };
            return el;
        },
        getElementById(id) {
            return elements[id] || null;
        },
        /**
         * Register a mock element by ID so getElementById can find it.
         */
        _registerElement(id) {
            if (!elements[id]) {
                elements[id] = this.createElement("div");
                elements[id].id = id;
            }
            return elements[id];
        },
        querySelectorAll(sel) { return []; },
        querySelector(sel) { return null; },
        head: { appendChild(node) {} },
        body: {
            appendChild(node) {},
            append(...nodes) {},
            querySelectorAll(sel) { return []; },
        },
        documentElement: {
            appendChild(node) {},
            append(...nodes) {},
        },
        createDocumentFragment() {
            return {
                children: [],
                appendChild(node) { this.children.push(node); return node; },
            };
        },
        addEventListener(event, fn) {},
    };

    return document;
}

// ---------------------
// Exports
// ---------------------

/**
 * Load a JS source file into the global scope (like a browser <script> tag).
 * Browser <script> tags put all top-level bindings into the global scope.
 * Node.js vm scopes const/let to the script. We convert them to var so
 * they become sandbox (globalThis) properties for testability.
 */
function loadScript(relativePath) {
    const path = require("path");
    const fs = require("fs");
    const vm = require("vm");
    const filePath = path.resolve(__dirname, relativePath);
    let code = fs.readFileSync(filePath, "utf-8");
    // Convert top-level const/let to var to match browser <script> behavior
    code = code.replace(/^(const |let )/gm, "var ");
    vm.runInNewContext(code, globalThis, { filename: filePath });
}

if (typeof module !== "undefined") {
    module.exports = {
        describe, it, assert, assertEqual, assertDeepEqual,
        assertNull, assertTrue, assertFalse, assertContains, assertThrows,
        printResults,
        createBrowserMock, createDOMMock,
        loadScript,
    };
}
