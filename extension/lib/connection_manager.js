// lib/connection_manager.js

export class ConnectionManager {
    constructor(hostName) {
        this.hostName = hostName;
        this.port = null;
        this.onMessageCallback = null;
        this.onDisconnectCallback = null;
    }

    connect() {
        console.log("Attempting to connect to native host:", this.hostName);
        try {
            this.port = chrome.runtime.connectNative(this.hostName);

            this.port.onMessage.addListener((msg) => {
                if (this.onMessageCallback) this.onMessageCallback(msg);
            });

            this.port.onDisconnect.addListener(() => {
                console.warn("Native port disconnected:", chrome.runtime.lastError);
                this.port = null;
                if (this.onDisconnectCallback) this.onDisconnectCallback();
            });
        } catch (e) {
            console.error("Connection failed:", e);
            throw e;
        }
    }

    send(msg) {
        if (!this.port) {
            console.warn("Cannot send message, port disconnected.");
            // Try reconnecting? For now, just error.
            return;
        }
        this.port.postMessage(msg);
    }

    isConnected() {
        return this.port !== null;
    }

    setMessageHandler(handler) {
        this.onMessageCallback = handler;
    }

    setDisconnectHandler(handler) {
        this.onDisconnectCallback = handler;
    }
}
