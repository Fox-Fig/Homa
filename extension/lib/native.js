// lib/native.js

export class NativeHost {
    constructor(hostName, messageHandler, disconnectHandler) {
        this.hostName = hostName;
        this.port = null;
        this.onMessage = messageHandler;
        this.onDisconnect = disconnectHandler;
        this.pendingRequests = new Map(); // id -> {resolve, reject}
    }

    connect() {
        console.log(`[NativeHost] Connecting to ${this.hostName}...`);
        try {
            this.port = chrome.runtime.connectNative(this.hostName);

            this.port.onMessage.addListener((msg) => {
                console.log("[NativeHost] RX:", msg);

                // 1. Check if it's a response to an async request
                if (msg.id && this.pendingRequests.has(msg.id)) {
                    const { resolve, reject } = this.pendingRequests.get(msg.id);
                    this.pendingRequests.delete(msg.id);
                    resolve(msg);
                    return;
                }

                // 2. Otherwise, valid global event
                if (this.onMessage) this.onMessage(msg);
            });

            this.port.onDisconnect.addListener(() => {
                const err = chrome.runtime.lastError;
                console.log("[NativeHost] Disconnected.", err);
                this.port = null;

                // Reject all pending
                for (const [id, req] of this.pendingRequests) {
                    req.reject(new Error("Host Disconnected"));
                }
                this.pendingRequests.clear();

                if (this.onDisconnect) this.onDisconnect(err ? err.message : null);
            });

            return true;
        } catch (e) {
            console.error("[NativeHost] Connection Failed:", e);
            throw e;
        }
    }

    disconnect() {
        if (this.port) {
            try {
                this.port.disconnect();
            } catch (e) {
                console.warn("Error disconnecting:", e);
            }
            this.port = null;
        }
    }

    send(message) {
        if (!this.port) {
            throw new Error("Host not connected");
        }
        console.log("[NativeHost] TX:", message);
        this.port.postMessage(message);
    }

    // Returns Promise<Message>
    sendAsync(msg) {
        if (!this.port) return Promise.reject(new Error("Not connected"));

        const id = crypto.randomUUID();
        msg.id = id;

        return new Promise((resolve, reject) => {
            this.pendingRequests.set(id, { resolve, reject });
            this.send(msg);

            // Timeout 10s
            setTimeout(() => {
                if (this.pendingRequests.has(id)) {
                    this.pendingRequests.delete(id);
                    reject(new Error("Timeout"));
                }
            }, 10000);
        });
    }

    isConnected() {
        return !!this.port;
    }
}
