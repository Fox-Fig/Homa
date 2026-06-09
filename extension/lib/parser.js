// lib/parser.js

export class ConfigParser {
    static async parse(input) {
        input = input.trim();
        if (!input) return [];

        // 1. Check if it's Raw JSON
        if (input.startsWith("{")) {
            try {
                const jsonObj = JSON.parse(input);
                if (jsonObj.protocol) {
                    return [{
                        original: input,
                        protocol: jsonObj.protocol, // e.g., "vless", "trojan", "socks"
                        id: jsonObj.id || "custom-json-" + Date.now(),
                        name: jsonObj.name || jsonObj.tag || "Custom JSON Config",
                        rawLink: "json",
                        settings: jsonObj.settings || {},
                        streamSettings: jsonObj.streamSettings || undefined,
                        ...jsonObj
                    }];
                }
            } catch (e) {
                console.warn("Input starts with '{' but is not valid JSON.", e);
            }
        }

        // 2. Check for protocols
        if (input.startsWith("vless://")) {
            return [this._parseVless(input)];
        } else if (input.startsWith("vmess://")) {
            return [this._parseVmess(input)];
        } else if (input.startsWith("trojan://")) {
            return [this._parseTrojan(input)];
        } else if (input.startsWith("ss://")) {
            return [this._parseShadowsocks(input)];
        } else if (input.startsWith("wireguard://")) {
            return [this._parseWireGuard(input)];
        } else if (input.startsWith("socks://") || input.startsWith("socks5://")) {
            return [this._parseSocks(input)];
        } else if (input.startsWith("http://") || input.startsWith("https://")) {
            return await this._parseSubscription(input);
        }

        return [];
    }

    static async _parseSubscription(url) {
        try {
            console.log("Fetching subscription:", url);
            const response = await fetch(url);
            if (!response.ok) throw new Error("Fetch failed: " + response.status);

            const text = await response.text();
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
                    try {
                        const parsed = await this.parse(l);
                        if (parsed && parsed.length > 0) {
                            configs.push(...parsed);
                        }
                    } catch (e) {
                        console.warn("Failed to parse line in sub:", l, e);
                    }
                }
            }
            return configs;
        } catch (e) {
            try {
                 const httpConf = this._parseHttp(url);
                 if (httpConf) return [httpConf];
            } catch(proxyErr) {}

            console.error("Subscription Error:", e);
            throw e;
        }
    }

    static _parseVless(link) {
        const url = new URL(link);
        const uuid = url.username;
        const [address, port] = [url.hostname, parseInt(url.port)];
        const params = new URLSearchParams(url.search);
        const name = decodeURIComponent(url.hash.slice(1)) || "VLESS Config";

        return {
            original: link,
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
                        encryption: params.get("encryption") || "none",
                        level: 0,
                        flow: params.get("flow") || "" 
                    }]
                }]
            },
            streamSettings: this._buildStreamSettings(address, params)
        };
    }

    static _parseVmess(link) {
        const b64 = link.replace("vmess://", "");
        // Decode base64, handling URL safe variants
        const normalizedB64 = b64.replace(/-/g, '+').replace(/_/, '/');
        const jsonStr = decodeURIComponent(escape(atob(normalizedB64))); 
        const conf = JSON.parse(jsonStr);

        const params = new URLSearchParams();
        if (conf.net) params.set("type", conf.net);
        if (conf.tls) params.set("security", conf.tls);
        if (conf.sni || conf.host || conf.add) params.set("sni", conf.sni || conf.host || conf.add);
        if (conf.path) params.set("path", conf.path);
        if (conf.host) params.set("host", conf.host);

        return {
            original: link,
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
                        security: conf.scy || "auto",
                        level: 0
                    }]
                }]
            },
            streamSettings: this._buildStreamSettings(conf.add, params)
        };
    }

    static _parseTrojan(link) {
        const url = new URL(link);
        const password = url.username;
        const [address, port] = [url.hostname, parseInt(url.port)];
        const params = new URLSearchParams(url.search);
        const name = decodeURIComponent(url.hash.slice(1)) || "Trojan Config";

        if (!params.has("security")) {
            params.set("security", "tls");
        }

        return {
            original: link,
            protocol: "trojan",
            name: name,
            rawLink: link,
            settings: {
                servers: [{
                    address: address,
                    port: port,
                    password: password,
                    level: 0
                }]
            },
            streamSettings: this._buildStreamSettings(address, params)
        };
    }

    static _parseShadowsocks(link) {
        let b64part = link.replace("ss://", "").split("#")[0];
        const name = decodeURIComponent(link.split("#")[1] || "Shadowsocks Config");
        
        let method, password, address, port;

        if (b64part.includes("@")) {
            // SIP002 format: ss://base64(method:password)@hostname:port
            const parts = b64part.split("@");
            let decodedUserPass = "";
            try {
                decodedUserPass = atob(parts[0]);
            } catch(e) {
                // Not base64, maybe plain text
                decodedUserPass = parts[0];
            }
            [method, password] = decodedUserPass.split(":");
            const hostPort = parts[1].split("/")[0].split("?");
            const addrParts = hostPort[0].split(":");
            address = addrParts[0];
            port = parseInt(addrParts[1]);
        } else {
            // Legacy format: ss://base64(method:password@hostname:port)
            const decoded = atob(b64part); 
            const parts = decoded.split("@");
            [method, password] = parts[0].split(":");
            const addrParts = parts[1].split(":");
            address = addrParts[0];
            port = parseInt(addrParts[1]);
        }

        return {
            original: link,
            protocol: "shadowsocks",
            name: name,
            rawLink: link,
            settings: {
                servers: [{
                    address: address,
                    port: port,
                    method: method,
                    password: password,
                    level: 0
                }]
            }
        };
    }

    static _parseWireGuard(link) {
        const url = new URL(link);
        const name = decodeURIComponent(url.hash.slice(1)) || "WireGuard Config";
        const params = new URLSearchParams(url.search);
        
        return {
            original: link,
            protocol: "wireguard",
            name: name,
            rawLink: link,
            settings: {
                secretKey: params.get("sk") || "REQUIRED", 
                address: [params.get("ip") || "10.0.0.2/32"],
                peers: [{
                    publicKey: params.get("pk") || url.username || "",
                    endpoint: `${url.hostname}:${url.port || 51820}`
                }]
            }
        };
    }

    static _parseSocks(link) {
        const url = new URL(link);
        return {
            original: link,
            protocol: "socks",
            name: decodeURIComponent(url.hash.slice(1)) || "Socks Proxy",
            rawLink: link,
            settings: {
                servers: [{
                    address: url.hostname,
                    port: parseInt(url.port),
                    users: url.username ? [{
                        user: url.username,
                        pass: decodeURIComponent(url.password || "")
                    }] : []
                }]
            }
        };
    }

    static _parseHttp(link) {
        const url = new URL(link);
        return {
            original: link,
            protocol: "http",
            name: decodeURIComponent(url.hash.slice(1)) || "HTTP Proxy",
            rawLink: link,
            settings: {
                servers: [{
                    address: url.hostname,
                    port: parseInt(url.port),
                    users: url.username ? [{
                        user: url.username,
                        pass: decodeURIComponent(url.password || "")
                    }] : []
                }]
            }
        };
    }

    static _buildStreamSettings(address, params) {
        const network = params.get("type") || "tcp";
        const security = params.get("security") || "none";
        
        let tlsSettings;
        let realitySettings;
        let wsSettings;
        let grpcSettings;
        let tcpSettings;

        if (security === "tls") {
            tlsSettings = {
                serverName: params.get("sni") || address,
                fingerprint: params.get("fp") || "chrome",
                allowInsecure: params.get("allowInsecure") === "1" || false,
                alpn: params.get("alpn") ? params.get("alpn").split(",") : ["h2", "http/1.1"]
            };
        }

        if (security === "reality") {
            realitySettings = {
                serverName: params.get("sni") || address,
                publicKey: params.get("pbk") || "",
                fingerprint: params.get("fp") || "chrome",
                shortId: params.get("sid") || "",
                spiderX: params.get("spx") || ""
            };
        }

        if (network === "ws") {
            wsSettings = {
                path: params.get("path") || "/",
                headers: {
                    Host: params.get("host") || params.get("sni") || address
                }
            };
        }

        if (network === "grpc") {
            grpcSettings = {
                serviceName: params.get("serviceName") || "",
                multiMode: params.get("mode") === "multi"
            };
        }

        if (network === "tcp") {
            const headerType = params.get("headerType") || "none";
            if (headerType !== "none") {
                tcpSettings = {
                    header: {
                        type: headerType
                    }
                };
            }
        }

        return {
            network: network,
            security: security,
            tlsSettings,
            realitySettings,
            wsSettings,
            grpcSettings,
            tcpSettings
        };
    }
}

export function generateXrayConfig(inboundPort, outboundConfig) {
    // Generates the full Xray JSON (for testing or legacy fallback)
    return {
        log: { loglevel: "warning" },
        inbounds: [{
            port: inboundPort,
            protocol: "socks",
            settings: { auth: "noauth", udp: true },
            sniffing: { enabled: true, destOverride: ["http", "tls"] }
        }],
        outbounds: [{
            ...outboundConfig,
            tag: "proxy"
        }, {
            protocol: "freedom",
            tag: "direct"
        }],
        routing: {
            domainStrategy: "IPOnDemand",
            rules: [
                { type: "field", domain: ["geosite:cn", "geosite:ir"], outboundTag: "direct" }
            ]
        }
    };
}
