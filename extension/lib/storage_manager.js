// lib/storage_manager.js

export class StorageManager {
    constructor() {
        this.STORAGE_KEY = "xray_servers";
        this.SUBS_KEY = "xray_subs";
    }

    // --- Servers ---

    async getServers() {
        return new Promise((resolve) => {
            chrome.storage.local.get([this.STORAGE_KEY], (result) => {
                resolve(result[this.STORAGE_KEY] || []);
            });
        });
    }

    async addServer(serverConfig) {
        const servers = await this.getServers();
        if (!serverConfig.id) {
            serverConfig.id = crypto.randomUUID();
        }
        servers.push(serverConfig);
        return this._save(servers);
    }

    async addServers(newServers) {
        const servers = await this.getServers();
        newServers.forEach(s => {
            if (!s.id) s.id = crypto.randomUUID();
        });
        const combined = servers.concat(newServers);
        return this._save(combined);
    }

    async removeServer(serverId) {
        const servers = await this.getServers();
        const filtered = servers.filter(s => s.id !== serverId);
        return this._save(filtered);
    }

    async updateServers(servers) {
        return this._save(servers);
    }

    async _save(servers) {
        return new Promise((resolve) => {
            chrome.storage.local.set({ [this.STORAGE_KEY]: servers }, () => {
                resolve(servers);
            });
        });
    }

    async getServer(serverId) {
        const servers = await this.getServers();
        return servers.find(s => s.id === serverId);
    }

    // --- Subscriptions ---

    async getSubscriptions() {
        return new Promise((resolve) => {
            chrome.storage.local.get([this.SUBS_KEY], (result) => {
                resolve(result[this.SUBS_KEY] || []);
            });
        });
    }

    async addSubscription(subName, url) {
        const subs = await this.getSubscriptions();
        const newSub = {
            id: crypto.randomUUID(),
            name: subName,
            url: url,
            updatedAt: Date.now()
        };
        subs.push(newSub);
        await this._saveSubs(subs);
        return newSub;
    }

    async removeSubscription(subId) {
        const subs = await this.getSubscriptions();
        const filtered = subs.filter(s => s.id !== subId);
        await this._saveSubs(filtered);

        // Also remove linked servers
        const servers = await this.getServers();
        const remainingServers = servers.filter(s => s.subId !== subId);
        await this._save(remainingServers);
    }

    async updateSubscriptionTime(subId) {
        const subs = await this.getSubscriptions();
        const sub = subs.find(s => s.id === subId);
        if (sub) {
            sub.updatedAt = Date.now();
            await this._saveSubs(subs);
        }
    }

    async _saveSubs(subs) {
        return new Promise((resolve) => {
            chrome.storage.local.set({ [this.SUBS_KEY]: subs }, resolve);
        });
    }

    // Replace servers for a specific subscription
    async replaceSubscriptionServers(subId, newConfigs) {
        let servers = await this.getServers();
        // Remove old ones
        servers = servers.filter(s => s.subId !== subId);

        // Add new ones with subId
        newConfigs.forEach(c => {
            c.id = crypto.randomUUID();
            c.subId = subId;
        });

        servers = servers.concat(newConfigs);
        return this._save(servers);
    }
}
