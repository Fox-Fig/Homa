// lib/proxy_manager.js

export class ProxyManager {
    constructor() { }

    async setSocksProxy(port, bypassList = []) {
        const config = {
            mode: "fixed_servers",
            rules: {
                singleProxy: {
                    scheme: "socks5",
                    host: "127.0.0.1",
                    port: parseInt(port)
                },
                bypassList: bypassList.length > 0 ? bypassList : ["<local>", "192.168.0.0/16", "*.ir"]
            }
        };

        return new Promise((resolve) => {
            chrome.proxy.settings.set({ value: config, scope: "regular" }, () => {
                console.log(`Proxy set to SOCKS5 127.0.0.1:${port}`);
                resolve();
            });
        });
    }

    async clearProxy() {
        return new Promise((resolve) => {
            chrome.proxy.settings.clear({ scope: "regular" }, () => {
                console.log("Proxy settings cleared.");
                resolve();
            });
        });
    }
}
