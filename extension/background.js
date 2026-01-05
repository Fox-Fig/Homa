// background.js (Rewrite)
import { StateManager } from './lib/state.js';
import { NativeHost } from './lib/native.js';
import { StorageManager } from './lib/storage_manager.js';

const HOST_NAME = "com.xray.native.bridge";

// --- Singletons ---
const state = new StateManager();
const storage = new StorageManager();
let native = null;

// --- Native Host Handlers ---
function onHostMessage(msg) {
    if (msg.status === "ok" && msg.port) {
        // Connected Success
        state.update({
            connectionStatus: "CONNECTED",
            lastError: null
        });
        setBrowserProxy(msg.port);
    } else if (msg.status === "error") {
        state.update({
            connectionStatus: "ERROR",
            lastError: msg.error
        });
        disconnectCore();
    } else if (msg.status === "pong") {
        // Update ping stats?
    }
}

function onHostDisconnect(err) {
    state.update({
        connectionStatus: "DISCONNECTED",
        lastError: err || "Native Host Disconnected unexpectedly"
    });
    proxyHelper.clear();
    native = null;
}

// --- Core Control ---
function connectCore(config) {
    state.update({ connectionStatus: "CONNECTING" });

    // 1. Initialize Native Host if needed
    if (!native || !native.isConnected()) {
        try {
            native = new NativeHost(HOST_NAME, onHostMessage, onHostDisconnect);
            native.connect();
        } catch (e) {
            state.update({ connectionStatus: "ERROR", lastError: e.message });
            return;
        }
    } else {
        // Ensure the correct handlers are attached (in case PING_SERVER started it with dummy handlers)
        native.onMessage = onHostMessage;
        native.onDisconnect = onHostDisconnect;
    }

    // 2. Send Start Command with Config
    try {
        // config is the 'outbound' object stored in storage
        native.send({
            cmd: "START",
            config: config
        });
    } catch (e) {
        state.update({ connectionStatus: "ERROR", lastError: e.message });
    }
}

function disconnectCore() {
    if (native && native.isConnected()) {
        try {
            native.send({ cmd: "STOP" });
        } catch (e) {
            console.warn(e);
        }
    }
    proxyHelper.clear();
    state.reset();
}

// --- Proxy Helper ---
// --- Proxy Helper ---
// --- Proxy Helper ---
const proxyHelper = {
    set: async (port) => {
        // Load bypass list
        const res = await chrome.storage.local.get(['bypass_list']);
        // Normalize bypass list: Chrome uses array, Firefox uses string (comma-separated or specific format)
        // Default list
        const defaultBypass = ["<local>", "192.168.0.0/16", "*.ir", "ir", "geoip:ir"];
        const bypassArr = res.bypass_list || defaultBypass;

        const isFirefox = (typeof browser !== 'undefined');

        let config = {};

        if (isFirefox) {
            // FIREFOX CONFIGURATION
            // Firefox uses 'passthrough' string usually, but WebExtension API might accept array in some versions?
            // MDN says 'passthrough' is a string for privacy.network.proxy?
            // Actually `browser.proxy.settings` value object:
            // { proxyType: "manual", socks: "host:port", socksVersion: 5, passthrough: "..." }

            // Convert Array to String for Firefox passthrough if needed, or check if it accepts array.
            // Documentation says: passthrough is a string.
            const passthroughStr = bypassArr.join(", ");

            config = {
                proxyType: "manual",
                socks: `127.0.0.1:${port}`,
                socksVersion: 5,
                passthrough: passthroughStr
            };

            // Use 'browser' namespace for Firefox if available, otherwise fallback to chrome (which might be polyfilled)
            // But Firefox supports 'chrome' namespace too mostly.
            // However, 'chrome.proxy' in Firefox has differences.
            // We should use 'browser.proxy.settings.set' if possible.
            const api = (typeof browser !== 'undefined') ? browser : chrome;
            api.proxy.settings.set({ value: config });
            console.log("Firefox Proxy applied:", config);

        } else {
            // CHROME / CHROMIUM CONFIGURATION
            config = {
                mode: "fixed_servers",
                rules: {
                    singleProxy: {
                        scheme: "socks5",
                        host: "127.0.0.1",
                        port: parseInt(port)
                    },
                    bypassList: bypassArr
                }
            };
            chrome.proxy.settings.set({ value: config, scope: "regular" });
            console.log("Chrome Proxy applied:", config);
        }
    },
    clear: () => {
        const isFirefox = (typeof browser !== 'undefined');
        if (isFirefox) {
            const api = (typeof browser !== 'undefined') ? browser : chrome;
            // Firefox clear might just remain 'system' or 'none'
            // proxyType: "none" or "system"
            api.proxy.settings.set({ value: { proxyType: "system" } });
        } else {
            chrome.proxy.settings.clear({ scope: "regular" });
        }
        console.log("Proxy cleared");
    }
};

async function setBrowserProxy(port) {
    await chrome.storage.local.set({ 'active_port': port });
    proxyHelper.set(port);
}

// --- Message Listener (Popup Communication) ---
chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
    switch (req.type) {
        case "GET_STATE":
            sendResponse(state.get());
            break;

        case "START_CONNECTION":
            // req.configId is passed
            storage.getServer(req.configId).then(config => {
                if (config) {
                    state.update({ currentConfigId: config.id });
                    connectCore(config); // Send the Object directly
                } else {
                    state.update({ lastError: "Config not found" });
                }
            });
            break;

        case "STOP_CONNECTION":
            disconnectCore();
            break;

        case "PING_SERVER":
            // config is passed in req.config

            // Auto Connect if needed
            if (!native || !native.isConnected()) {
                console.log("[Background] Auto-connecting Native Host for Ping...");
                native = new NativeHost(HOST_NAME,
                    (m) => console.log("Native Message:", m),
                    (e) => {
                        console.log("Native Disconnected:", e);
                        native = null;
                        updateState('DISCONNECTED');
                    }
                );

                try {
                    native.connect();
                } catch (e) {
                    sendResponse({ error: "Failed to connect to host: " + e.message });
                    break;
                }
            }

            // We need to return true to indicate async response
            native.sendAsync({ cmd: "TEST", config: req.config })
                .then(res => sendResponse(res))
                .catch(err => {
                    console.error("Ping Error:", err);
                    sendResponse({ error: err.message });
                });
            return true; // Async wait


        case "UPDATE_PROXY_SETTINGS":
            // Re-apply proxy if connected
            chrome.storage.local.get(['active_port'], (res) => {
                if (res.active_port && state.get().connectionStatus === "CONNECTED") {
                    proxyHelper.set(res.active_port);
                }
            });
            break;

        case "ping":
            // 1. Ensure Connected
            if (!native || !native.isConnected()) {
                console.log("[Background] Auto-connecting Native Host for ping...");
                try {
                    native = new NativeHost(HOST_NAME, onHostMessage, onHostDisconnect);
                    native.connect();
                } catch (e) {
                    sendResponse({ error: "Failed to connect: " + e.message });
                    return;
                }
            }

            // 2. Send Async Ping
            native.sendAsync({ cmd: "PING" })
                .then(res => {
                    // Host replies with { status: "pong", data: "pong" }
                    // Popup expects { pong: "pong" }
                    if (res.status === "pong") {
                        sendResponse({ pong: "pong" });
                    } else {
                        sendResponse({ error: "Invalid response: " + res.status });
                    }
                })
                .catch(err => {
                    console.error("Ping Failed:", err);
                    sendResponse({ error: err.message });
                });
            return true; // Async wait
    }
    // Return true for async response if needed (not needed here essentially)
});

// --- Traffic Monitor ---
// Simple bandwidth monitor using webRequest
let trafficStats = { up: 0, down: 0 };
let lastSpeedUpdate = Date.now();

chrome.webRequest.onCompleted.addListener((details) => {
    // details.responseHeaders... content-length?
    // Accurate sizing is hard without stream filter, but we can estimate or use headers.
    const len = details.responseHeaders?.find(h => h.name.toLowerCase() === 'content-length');
    if (len) {
        trafficStats.down += parseInt(len.value) || 0;
    }
}, { urls: ["<all_urls>"] }, ["responseHeaders"]);

chrome.webRequest.onBeforeRequest.addListener((details) => {
    if (details.requestBody) {
        // Estimate upload size
        if (details.requestBody.raw) {
            details.requestBody.raw.forEach(r => {
                if (r.bytes) trafficStats.up += r.bytes.byteLength;
                if (r.file) trafficStats.up += 1024; // Rough estimate for files
            });
        }
    }
}, { urls: ["<all_urls>"] }, ["requestBody"]);

// Periodic Speed Calculation (Every 1s)
setInterval(() => {
    const now = Date.now();
    const diff = (now - lastSpeedUpdate) / 1000; // Seconds
    if (diff >= 1) {
        state.update({
            stats: {
                uplink: Math.round(trafficStats.up / diff), // B/s
                downlink: Math.round(trafficStats.down / diff) // B/s
            }
        });
        // Reset counters
        trafficStats.up = 0;
        trafficStats.down = 0;
        lastSpeedUpdate = now;
    }
}, 1000);

// Initial Cleanup
proxyHelper.clear();
