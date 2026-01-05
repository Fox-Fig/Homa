// lib/config.js

/**
 * Parses vless:// or vmess:// links into Xray Outbound objects.
 */
export class ConfigParser {
    static async parse(link) {
        link = link.trim();
        if (link.startsWith("vless://")) {
            return [this._parseVless(link)];
        } else if (link.startsWith("vmess://")) {
            return [this._parseVmess(link)];
        } else if (link.startsWith("http://") || link.startsWith("https://")) {
            return await this._parseSubscription(link);
        }
        return [];
    }

    static async _parseSubscription(url) {
        try {
            console.log("Fetching subscription:", url);
            const response = await fetch(url);
            if (!response.ok) throw new Error("Fetch failed: " + response.status);

            const text = await response.text();
            // Try Base64 decode
            let decoded = text;
            try {
                decoded = atob(text.trim());
            } catch (e) {
                // Might be plain text
            }

            const lines = decoded.split(/\r?\n/);
            const configs = [];

            for (const line of lines) {
                const l = line.trim();
                if (l) {
                    if (l.startsWith("vless://")) configs.push(this._parseVless(l));
                    else if (l.startsWith("vmess://")) configs.push(this._parseVmess(l));
                }
            }
            return configs;
        } catch (e) {
            console.error("Subscription Error:", e);
            throw e;
        }
    }

    static _parseVless(link) {
        try {
            const url = new URL(link);
            const uuid = url.username;
            const [address, port] = [url.hostname, parseInt(url.port)];
            const params = new URLSearchParams(url.search);
            const name = decodeURIComponent(url.hash.slice(1)) || "VLESS Config";

            // Construct Xray Outbound for VLESS
            return {
                original: link, // Save original link
                protocol: "vless",
                id: uuid,
                name: name,
                rawLink: link,
                settings: {
                    vnext: [{
                        address: address,
                        port: port,
                        users: [{
                            id: uuid,
                            encryption: "none",
                            level: 0,
                            flow: params.get("flow") || "" // xtls-rprx-vision support
                        }]
                    }]
                },
                streamSettings: {
                    network: params.get("type") || "tcp",
                    security: params.get("security") || "none",
                    tlsSettings: params.get("security") === "tls" ? {
                        serverName: params.get("sni") || address,
                        fingerprint: params.get("fp") || "chrome",
                        allowInsecure: false
                    } : undefined,
                    realitySettings: params.get("security") === "reality" ? {
                        serverName: params.get("sni") || address,
                        publicKey: params.get("pbk") || "",
                        fingerprint: params.get("fp") || "chrome",
                        shortId: params.get("sid") || ""
                    } : undefined,
                    wsSettings: params.get("type") === "ws" ? {
                        path: params.get("path") || "/",
                        headers: { Host: params.get("host") || address }
                    } : undefined,
                    grpcSettings: params.get("type") === "grpc" ? {
                        serviceName: params.get("serviceName") || ""
                    } : undefined
                }
            };
        } catch (e) {
            console.error("VLESS Parse Error:", e);
            throw e;
        }
    }

    static _parseVmess(link) {
        try {
            const b64 = link.replace("vmess://", "");
            const jsonStr = atob(b64);
            const conf = JSON.parse(jsonStr);

            return {
                protocol: "vmess",
                name: conf.ps || "VMess Config",
                rawLink: link,
                settings: {
                    vnext: [{
                        address: conf.add,
                        port: parseInt(conf.port),
                        users: [{
                            id: conf.id,
                            alterId: parseInt(conf.aid) || 0,
                            security: "auto",
                            level: 0
                        }]
                    }]
                },
                streamSettings: {
                    network: conf.net || "tcp",
                    security: conf.tls || "none",
                    tlsSettings: conf.tls === "tls" ? {
                        serverName: conf.sni || conf.host || conf.add,
                        allowInsecure: false
                    } : undefined,
                    wsSettings: conf.net === "ws" ? {
                        path: conf.path || "/",
                        headers: { Host: conf.host || conf.add }
                    } : undefined
                }
            };
        } catch (e) {
            console.error("VMess Parse Error:", e);
            throw e;
        }
    }
}
