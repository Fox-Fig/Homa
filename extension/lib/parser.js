// lib/parser.js

export function parseLink(link) {
    link = link.trim();
    if (link.startsWith("vless://")) {
        return parseVless(link);
    } else if (link.startsWith("vmess://")) {
        return parseVmess(link);
    }
    throw new Error("Unsupported link type");
}

function parseVless(link) {
    // Simple VLESS parser
    // vless://uuid@ip:port?params#name
    try {
        const url = new URL(link);
        const uuid = url.username;
        const [ip, port] = [url.hostname, url.port];
        const params = new URLSearchParams(url.search);

        return {
            protocol: "vless",
            settings: {
                vnext: [{
                    address: ip,
                    port: parseInt(port),
                    users: [{
                        id: uuid,
                        encryption: "none",
                        level: 0
                    }]
                }]
            },
            streamSettings: {
                network: params.get("type") || "tcp",
                security: params.get("security") || "none",
                // Add more mapping here...
            }
        };
    } catch (e) {
        console.error("VLESS Parse Error", e);
        return null;
    }
}

function parseVmess(link) {
    // VMess base64 parser
    try {
        const b64 = link.replace("vmess://", "");
        const jsonStr = atob(b64);
        const config = JSON.parse(jsonStr);

        return {
            protocol: "vmess",
            settings: {
                vnext: [{
                    address: config.add,
                    port: parseInt(config.port),
                    users: [{
                        id: config.id,
                        alterId: parseInt(config.aid) || 0,
                        security: "auto",
                        level: 0
                    }]
                }]
            },
            streamSettings: {
                network: config.net || "tcp",
                security: config.tls || "none"
                // Add more mapping here...
            }
        };
    } catch (e) {
        console.error("VMess Parse Error", e);
        return null;
    }
}

export function generateXrayConfig(inboundPort, outboundConfig) {
    // Generates the full Xray JSON
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
