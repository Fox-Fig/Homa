// lib/state.js

/**
 * reliable state management for the extension.
 * Syncs state between Background and Popup.
 */
export class StateManager {
    constructor() {
        this.state = {
            connectionStatus: "DISCONNECTED", // DISCONNECTED, CONNECTING, CONNECTED, ERROR
            currentConfigId: null,
            stats: {
                uplink: 0,
                downlink: 0,
                ping: 0
            },
            lastError: null
        };
        this.listeners = new Set();
    }

    // Get current state
    get() {
        return { ...this.state };
    }

    // Update state and notify listeners
    update(partialState) {
        this.state = { ...this.state, ...partialState };
        this._notify();
    }

    // Reset state on disconnect
    reset() {
        this.update({
            connectionStatus: "DISCONNECTED",
            stats: { uplink: 0, downlink: 0, ping: 0 },
            lastError: null
        });
    }

    // Listener registration
    subscribe(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    _notify() {
        // Broadcast to internal listeners
        for (const listener of this.listeners) {
            listener(this.state);
        }
        // Broadcast to Runtime (Popup)
        try {
            chrome.runtime.sendMessage({
                type: "STATE_UPDATE",
                payload: this.state
            }).catch(() => { }); // Ignore if no popup is open
        } catch (e) {
            // Ignore context invalidated
        }
    }
}
