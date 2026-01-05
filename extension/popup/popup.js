// popup.js
import { StorageManager } from '../lib/storage_manager.js';
import { ConfigParser } from '../lib/config.js';

// Elements
const connectBtn = document.getElementById('connectBtn');
const addConfigBtn = document.getElementById('addConfigBtn');
const clearConfigsBtn = document.getElementById('clearConfigsBtn');
const serverList = document.getElementById('serverList');
const statusText = document.getElementById('statusText');
const diffCanvas = document.getElementById('trafficGraph');
const ipDisplay = document.getElementById('ipDisplay');
const ipAddrEl = document.getElementById('ipAddr');
const flagEl = document.getElementById('flag');
const countryCodeEl = document.getElementById('countryCode');



// Speed Elements
const downEl = document.getElementById('downSpeed');
const upEl = document.getElementById('upSpeed');

// --- Custom Dialog System ---

const dialogModal = document.getElementById('dialogModal');
const dialogTitle = document.getElementById('dialogTitle');
const dialogBody = document.getElementById('dialogBody');
const dialogInputContainer = document.getElementById('dialogInputContainer');
const dialogInput = document.getElementById('dialogInput');
const dialogBtnOk = document.getElementById('dialogBtnOk');
const dialogBtnCancel = document.getElementById('dialogBtnCancel');

const CustomDialog = {
    show: (type, message, defaultValue = "") => {
        return new Promise((resolve) => {
            // Setup UI
            dialogBody.textContent = message;
            dialogModal.classList.remove('hidden');

            // Reset fields
            dialogInput.value = defaultValue;
            dialogInputContainer.classList.add('hidden');
            dialogBtnCancel.classList.add('hidden');
            dialogBtnOk.textContent = "OK";
            dialogTitle.textContent = "Message";

            if (type === 'alert') {
                dialogTitle.textContent = "⚠️ Alert";
            } else if (type === 'confirm') {
                dialogTitle.textContent = "❓ Confirm";
                dialogBtnCancel.classList.remove('hidden');
            } else if (type === 'prompt') {
                dialogTitle.textContent = "✏️ Input";
                dialogBtnCancel.classList.remove('hidden');
                dialogInputContainer.classList.remove('hidden');
                dialogInput.focus();
            }

            // Handlers
            const close = () => {
                dialogModal.classList.add('hidden');
                cleanup();
            };

            const onOk = () => {
                close();
                if (type === 'prompt') resolve(dialogInput.value);
                else resolve(true);
            };

            const onCancel = () => {
                close();
                if (type === 'prompt') resolve(null);
                else resolve(false);
            };

            const cleanup = () => {
                dialogBtnOk.removeEventListener('click', onOk);
                dialogBtnCancel.removeEventListener('click', onCancel);
            };

            dialogBtnOk.addEventListener('click', onOk);
            dialogBtnCancel.addEventListener('click', onCancel);
        });
    },
    alert: async (msg) => {
        return CustomDialog.show('alert', msg);
    },
    confirm: async (msg) => {
        return CustomDialog.show('confirm', msg);
    },
    prompt: async (msg, defaultVal) => {
        return CustomDialog.show('prompt', msg, defaultVal);
    }
};

const uiState = {
    servers: [],
    currentConfigId: null,
    status: "DISCONNECTED",
    stats: { uplink: 0, downlink: 0 },
    pings: {},
    ping: -1,
    selectedId: null,
    isTesting: false,
    sortOrder: null // 'asc' | 'desc' | null
};

// IP Logic
async function fetchIP() {
    ipAddrEl.textContent = "...";
    flagEl.style.display = 'none';
    flagEl.src = "";

    const currentContext = uiState.status === "CONNECTED" ? uiState.currentConfigId : "DIRECT";

    // 1. Try Cache
    const storageRes = await chrome.storage.local.get(['ip_cache']);
    const cache = storageRes.ip_cache;

    if (cache && cache.context === currentContext && cache.data) {
        // Use Cache
        renderIP(cache.data);
        return;
    }

    // 2. Fetch Fresh
    try {
        // Using ip-api.com
        const res = await fetch('http://ip-api.com/json');
        const data = await res.json();

        if (data.status === 'success') {
            renderIP(data);
            // Save Cache
            chrome.storage.local.set({
                ip_cache: {
                    context: currentContext,
                    data: data,
                    timestamp: Date.now()
                }
            });
        } else {
            ipAddrEl.textContent = "Error";
        }
    } catch (e) {
        ipAddrEl.textContent = "Offline?";
    }
}

function renderIP(data) {
    ipAddrEl.textContent = data.query;
    countryCodeEl.textContent = data.country;

    if (data.countryCode) {
        flagEl.src = `https://flagcdn.com/24x18/${data.countryCode.toLowerCase()}.png`;
        flagEl.style.display = 'block';
    }
}

// Modules
const storage = new StorageManager();

// Graph Context
const ctx = diffCanvas.getContext('2d');
let speedHistory = new Array(30).fill(0); // 30 seconds history

// Local State (Moved up)

// Ping Logic (Active)
async function measurePing() {
    if (uiState.status !== "CONNECTED") {
        uiState.ping = -1;
        return;
    }
    const start = Date.now();
    try {
        await fetch('http://www.gstatic.com/generate_204', { mode: 'no-cors', cache: 'no-store' });
        const rtt = Date.now() - start;
        uiState.ping = rtt;
        // Update stored ping for active
        if (uiState.currentConfigId) {
            uiState.pings[uiState.currentConfigId] = rtt;
        }
    } catch (e) {
        uiState.ping = 9999;
    }
    updateUI();
}
setInterval(measurePing, 5000);

// --- Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
    // 0. Load Subscriptions
    await loadSubscriptions();

    // 1. Load Configs
    await refreshServers();

    fetchIP(); // Check Initial IP

    // 2. Get Initial State
    chrome.runtime.sendMessage({ type: "GET_STATE" }, (state) => {
        if (state) {
            syncState(state);
            // Scroll to active on open
            if (state.connectionStatus === "CONNECTED" || state.connectionStatus === "CONNECTING") {
                scrollToActive();
            }
        }
    });

    // 3. Listen for State Updates
    chrome.runtime.onMessage.addListener((msg) => {
        if (msg.type === "STATE_UPDATE") {
            syncState(msg.payload);
        }
    });

    // 4. Start Render Loop
    requestAnimationFrame(renderLoop);
});

// --- State Sync ---
let previousStatus = "DISCONNECTED";

function syncState(remoteState) {
    uiState.status = remoteState.connectionStatus;
    uiState.currentConfigId = remoteState.currentConfigId;
    uiState.stats = remoteState.stats || { uplink: 0, downlink: 0 };

    // Check for status switch to trigger IP check
    if (uiState.status === "CONNECTED" && previousStatus !== "CONNECTED") {
        // Just connected: wait a bit for proxy to route then check
        setTimeout(fetchIP, 1500);
    } else if (uiState.status !== "CONNECTED" && previousStatus === "CONNECTED") {
        // Just disconnected: check real IP immediately
        setTimeout(fetchIP, 500);
    }

    previousStatus = uiState.status;

    // If connected, sync selection
    if (uiState.status === "CONNECTED" && uiState.currentConfigId) {
        uiState.selectedId = uiState.currentConfigId;
    }

    updateUI();
}

// --- UI Updates ---
function updateUI() {
    // Status Text & Button
    statusText.textContent = uiState.status;
    statusText.className = `status-text ${uiState.status.toLowerCase()}`;

    // Improve Button Logic
    if (uiState.status === "CONNECTED") {
        connectBtn.textContent = "DISCONNECT";
        connectBtn.classList.add("danger");
    } else if (uiState.status === "CONNECTING") {
        connectBtn.textContent = "Connecting...";
        connectBtn.classList.remove("danger");
    } else {
        connectBtn.textContent = "CONNECT";
        connectBtn.classList.remove("danger");
        // Update label to show what will be connected
        if (uiState.selectedId) {
            const srv = uiState.servers.find(s => s.id === uiState.selectedId);
            if (srv) connectBtn.textContent = `CONNECT`;
        }
    }

    // Test Button State
    if (typeof testAllBtn !== 'undefined' && testAllBtn) {
        if (uiState.isTesting) {
            testAllBtn.textContent = "🛑 Stop";
            testAllBtn.classList.add("danger");
        } else {
            testAllBtn.textContent = "⚡Test All";
            testAllBtn.classList.remove("danger");
        }
    }

    // Stats
    downEl.innerText = formatSpeed(uiState.stats.downlink);
    upEl.innerText = formatSpeed(uiState.stats.uplink);

    // Ping Display
    if (uiState.ping >= 0) {
        statusText.textContent += ` (${uiState.ping}ms)`;
    }

    // Graph Data Push
    speedHistory.shift();
    speedHistory.push(uiState.stats.downlink);

    // Highlight Active Server (Only if not interacting to avoid jumpiness? No, we need to show selection)
    renderServerList();
}

async function refreshServers() {
    uiState.servers = await storage.getServers();
    const res = await chrome.storage.local.get(['pings', 'lastSelectedId']);
    if (res.pings) uiState.pings = res.pings;

    // Persistence Selection
    if (res.lastSelectedId && uiState.servers.find(s => s.id === res.lastSelectedId)) {
        uiState.selectedId = res.lastSelectedId;
    }

    // Auto select first if still none
    if (!uiState.selectedId && uiState.servers.length > 0) {
        uiState.selectedId = uiState.servers[0].id;
    }
    renderServerList();
}

// Smart Render
function renderServerList() {
    const serversToRender = getFilteredServers(); // USE FILTERED LIST

    if (serversToRender.length === 0) {
        serverList.innerHTML = '<div class="empty-msg">No Configs found in this view.</div>';
        return;
    }

    // 1. Sync List Length (Add/Remove)
    // For simplicity, if length differs significantly or order changed, we might want to rebuild.
    // But usually we just update. Use a keyed approach.
    const presentIds = new Set(serversToRender.map(s => s.id));

    // Remove stale
    Array.from(serverList.children).forEach(child => {
        if (!presentIds.has(child.dataset.id)) {
            child.remove();
        }
    });

    serversToRender.forEach((srv, index) => {
        let div = serverList.querySelector(`.server-item[data-id="${srv.id}"]`);

        // Create if missing (or likely pure rebuild if first run)
        if (!div) {
            div = document.createElement('div');
            div.className = 'server-item';
            div.dataset.id = srv.id;

            // Initial Structure
            div.innerHTML = `
                <div class="srv-info">
                    <div class="srv-name">${srv.name}</div>
                    <div class="srv-meta">
                        <span class="srv-proto">${srv.protocol.toUpperCase()}</span>
                        <span class="srv-ping"></span>
                    </div>
                </div>
                <div class="srv-actions">
                    <button class="btn-share" title="Share">📤</button>
                    <button class="btn-del" title="Delete">🗑️</button>
                </div>
            `;

            // Events (Attached once)
            div.addEventListener('click', (e) => {
                if (e.target.tagName !== 'BUTTON') {
                    selectServer(srv.id);
                }
            });

            // Share Action
            div.querySelector('.btn-share').addEventListener('click', async (e) => {
                e.stopPropagation();
                if (srv.original) {
                    await navigator.clipboard.writeText(srv.original);
                    await CustomDialog.alert("Config copied to clipboard!");
                } else {
                    await CustomDialog.alert("Original link not available (Old config). Re-import to fix.");
                }
            });

            div.querySelector('.btn-del').addEventListener('click', async (e) => {
                e.stopPropagation();
                if (await CustomDialog.confirm('Remove server?')) {
                    await storage.removeServer(srv.id);
                    // If deleted was selected, reset
                    if (uiState.selectedId === srv.id) uiState.selectedId = null;
                    await refreshServers();
                }
            });

            // Insert in correct order? 
            // Ideally we append, and if we are careful about order...
            // For now just append. If reordering happens, we might need insertBefore.
            serverList.appendChild(div);
        }

        // Ensure Order (simple append check)
        if (serverList.children[index] !== div) {
            serverList.insertBefore(div, serverList.children[index]);
        }

        // --- Update State & Classes ---
        const isConnected = uiState.currentConfigId === srv.id && uiState.status === "CONNECTED";
        const isConnecting = (uiState.currentConfigId === srv.id || uiState.selectedId === srv.id) && uiState.status === "CONNECTING";
        const isError = (uiState.currentConfigId === srv.id || uiState.selectedId === srv.id) && uiState.status === "ERROR";
        const isSelected = uiState.selectedId === srv.id;

        let classes = `server-item`;
        if (isConnected) classes += ' connected';
        else if (isConnecting) classes += ' connecting';
        else if (isError) classes += ' item-error';

        if (isSelected && !isConnected && !isConnecting && !isError) classes += ' active';

        // Check testing state for class
        let pingVal = uiState.pings[srv.id];
        let pingClass = "srv-ping";

        if (pingVal === '...') {
            classes += ' testing';
            pingClass += ' blink';
        } else if (pingVal === -1) {
            pingVal = "Timeout";
            pingClass += ' error';
        } else if (pingVal) {
            pingVal += "ms";
            pingClass += " success";
        } else {
            pingVal = "";
        }

        // Apply Updates
        if (div.className !== classes) div.className = classes;

        // Update Ping Text
        const pingEl = div.querySelector('.srv-ping');
        if (pingEl.textContent !== pingVal) {
            pingEl.textContent = pingVal;
            pingEl.className = pingClass;
        }
    });
}

function scrollToActive() {
    setTimeout(() => {
        const active = serverList.querySelector('.server-item.connected') ||
            serverList.querySelector('.server-item.connecting');
        if (active) {
            active.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }
    }, 100);
}

// --- Actions ---
async function selectServer(id) {
    uiState.selectedId = id;
    chrome.storage.local.set({ 'lastSelectedId': id }); // Persist selection

    // Instant Switch if connected or connecting
    // User requested: "When selecting... it should immediately connect"
    if (uiState.status === "CONNECTED" || uiState.status === "CONNECTING") {
        // We trigger a start connection. Background should handle the "Stop previous, Start new" logic
        // But to be safe and forceful, we can send STOP then START?
        // Actually background.js "START_CONNECTION" doesn't automatically stop previous core carefully?
        // Let's rely on background handling reuse or restart. 
        // Based on background.js: connectCore -> native.send("START"). 
        // If core is running, main.go StartCore kills previous. So it should be fine.
        chrome.runtime.sendMessage({
            type: "START_CONNECTION",
            configId: id
        });
    }

    renderServerList();
}

connectBtn.addEventListener('click', () => {
    if (uiState.status === "CONNECTED" || uiState.status === "CONNECTING") {
        chrome.runtime.sendMessage({ type: "STOP_CONNECTION" });
    } else {
        if (!uiState.selectedId) {
            alert("No config selected!");
            return;
        }
        chrome.runtime.sendMessage({
            type: "START_CONNECTION",
            configId: uiState.selectedId
        });
    }
});

// --- Subscription & Filter Logic ---

const subsBtn = document.getElementById('subsBtn');
const subsModal = document.getElementById('subsModal');
const closeSubsBtn = document.getElementById('closeSubsBtn');
const subFilter = document.getElementById('subFilter');
const subsListContainer = document.getElementById('subsList');

let subscriptions = [];

async function loadSubscriptions() {
    subscriptions = await storage.getSubscriptions();
    await renderFilterOptions();
    renderServerList(); // Initial Render with likely 'all' or loaded filter
}

async function renderFilterOptions() {
    const res = await chrome.storage.local.get(['lastSubFilter']);
    const savedFilter = res.lastSubFilter || 'all';

    subFilter.innerHTML = `
        <option value="all">View: All Configs</option>
        <option value="manual">Manual / No Sub</option>
        ${subscriptions.map(s => `<option value="${s.id}">📚 ${s.name}</option>`).join('')}
    `;

    // Restore selection if valid
    if (subFilter.querySelector(`option[value="${savedFilter}"]`)) {
        subFilter.value = savedFilter;
    } else {
        subFilter.value = 'all';
    }
}

subFilter.addEventListener('change', (e) => {
    chrome.storage.local.set({ lastSubFilter: e.target.value });
    renderServerList();
});

// Filter Function
function getFilteredServers() {
    const filter = subFilter.value;

    // 1. Filter
    if (filter === 'all') {
        return [...uiState.servers];
    } else if (filter === 'manual') {
        return uiState.servers.filter(s => !s.subId);
    } else {
        return uiState.servers.filter(s => s.subId === filter);
    }
}

function getPingValue(id) {
    const val = uiState.pings[id];
    if (val === '...' || val === undefined) return undefined; // Treat as untested
    return val;
}

// --- Sort Button ---
const sortBtn = document.getElementById('sortBtn');
let lastSortDir = 'desc'; // Default start

if (sortBtn) {
    sortBtn.addEventListener('click', async () => {
        // Toggle Direction
        lastSortDir = (lastSortDir === 'asc') ? 'desc' : 'asc';

        // 1. Identify items to sort
        const filter = subFilter.value;
        const fullList = [...uiState.servers];
        const indices = []; // Track where they were
        const subset = [];

        fullList.forEach((s, i) => {
            let match = false;
            if (filter === 'all') match = true;
            else if (filter === 'manual') match = !s.subId;
            else match = s.subId === filter;

            if (match) {
                indices.push(i);
                subset.push(s);
            }
        });

        if (subset.length < 2) return; // Nothing to sort

        // 2. Sort Subset
        subset.sort((a, b) => {
            const pingA = getPingValue(a.id);
            const pingB = getPingValue(b.id);

            // Allow sorting by name if ping is missing? No, user asked for ping sort.
            // Put Unknowns at the end
            const valA = (pingA === -1 || pingA === undefined) ? 999999 : pingA;
            const valB = (pingB === -1 || pingB === undefined) ? 999999 : pingB;

            if (valA === valB) return 0;

            if (lastSortDir === 'asc') {
                return valA - valB;
            } else {
                return valB - valA;
            }
        });

        // 3. Re-inject
        indices.forEach((originalIndex, i) => {
            fullList[originalIndex] = subset[i];
        });

        // 4. Save & Refresh
        uiState.servers = fullList;
        await storage.updateServers(fullList);
        renderServerList();

        // Feedback
        // sortBtn.textContent = (lastSortDir === 'asc') ? "📶 Low->High" : "📶 High->Low"; 
        // User requested static text, so maybe just toast or nothing.
    });
}

// --- Subs Modal ---

subsBtn.addEventListener('click', () => {
    refreshSubsModal();
    subsModal.classList.remove('hidden');
});

const updateAllSubsBtn = document.getElementById('updateAllSubsBtn');
const quickUpdateBtn = document.getElementById('quickUpdateBtn');

async function performUpdateAllSubs() {
    if (subscriptions.length === 0) {
        await CustomDialog.alert("No subscriptions to update.");
        return;
    }

    if (!await CustomDialog.confirm("Update all subscriptions? This might take a moment.")) return;

    const statusEl = document.getElementById('statusText');
    const oldText = statusEl.textContent;
    let successCount = 0;
    let failCount = 0;

    // UI Feedback
    if (updateAllSubsBtn) {
        updateAllSubsBtn.disabled = true;
        updateAllSubsBtn.textContent = "Updating...";
    }
    if (quickUpdateBtn) {
        quickUpdateBtn.disabled = true;
        quickUpdateBtn.textContent = "⌛";
    }

    for (const sub of subscriptions) {
        statusEl.textContent = `Updating ${sub.name}...`;
        statusEl.style.color = "yellow";
        try {
            const configs = await ConfigParser.parse(sub.url);
            if (configs.length > 0) {
                await storage.replaceSubscriptionServers(sub.id, configs);
                await storage.updateSubscriptionTime(sub.id);
                successCount++;
            }
        } catch (e) {
            console.error(`Failed to update ${sub.name}:`, e);
            failCount++;
        }
    }

    statusEl.textContent = oldText;
    statusEl.style.color = "";

    // Reset UI
    if (updateAllSubsBtn) {
        updateAllSubsBtn.disabled = false;
        updateAllSubsBtn.textContent = "🔄 Update All Subscriptions";
    }
    if (quickUpdateBtn) {
        quickUpdateBtn.disabled = false;
        quickUpdateBtn.textContent = "🔄";
    }

    await loadSubscriptions();
    await refreshServers();
    refreshSubsModal();

    await CustomDialog.alert(`Update Complete.\nSuccess: ${successCount}\nFailed: ${failCount}`);
}

updateAllSubsBtn.addEventListener('click', performUpdateAllSubs);
quickUpdateBtn.addEventListener('click', performUpdateAllSubs);

closeSubsBtn.addEventListener('click', () => {
    subsModal.classList.add('hidden');
});

function refreshSubsModal() {
    subsListContainer.innerHTML = '';

    if (subscriptions.length === 0) {
        subsListContainer.innerHTML = '<div style="padding:10px; text-align:center; color:#888;">No Subscriptions</div>';
        return;
    }

    subscriptions.forEach(sub => {
        const div = document.createElement('div');
        div.className = 'sub-item';

        const dateStr = new Date(sub.updatedAt).toLocaleString();

        div.innerHTML = `
            <div class="sub-info">
                <span class="sub-name">${sub.name}</span>
                <span class="sub-date">${dateStr}</span>
            </div>
            <div class="sub-actions">
                <button class="sub-btn btn-share" title="Share">📤</button>
                <button class="sub-btn btn-update" title="Update">🔄</button>
                <button class="sub-btn btn-del" title="Delete">🗑️</button>
            </div>
        `;

        div.querySelector('.btn-share').addEventListener('click', async () => {
            await navigator.clipboard.writeText(sub.url);
            await CustomDialog.alert(`Subscription URL copied!\n"${sub.name}"`);
        });

        div.querySelector('.btn-update').addEventListener('click', () => updateSubscription(sub));
        div.querySelector('.btn-del').addEventListener('click', () => deleteSubscription(sub.id));

        subsListContainer.appendChild(div);
    });
}

async function updateSubscription(sub) {
    const statusEl = document.getElementById('statusText');
    const oldText = statusEl.textContent;
    statusEl.textContent = `Updating ${sub.name}...`;
    statusEl.style.color = "yellow";

    try {
        const configs = await ConfigParser.parse(sub.url);
        if (configs.length > 0) {
            await storage.replaceSubscriptionServers(sub.id, configs);
            await storage.updateSubscriptionTime(sub.id);
            await CustomDialog.alert(`Updated! ${configs.length} configs found.`);
            await loadSubscriptions(); // reload time
            await refreshServers();
            refreshSubsModal();
        } else {
            await CustomDialog.alert('No configs found in link.');
        }
    } catch (e) {
        await CustomDialog.alert('Update Failed: ' + e.message);
    } finally {
        statusEl.textContent = oldText; // partial reset, syncState will correct it
        statusEl.style.color = "";
    }
}

async function deleteSubscription(subId) {
    if (await CustomDialog.confirm("Delete subscription and all its servers?")) {
        await storage.removeSubscription(subId);
        await loadSubscriptions();
        await refreshServers();
        refreshSubsModal();
        // Reset filter if we deleted current view
        if (subFilter.value === subId) {
            subFilter.value = 'all';
            renderServerList();
        }
    }
}

// --- Import Override ---

document.getElementById('addConfigBtn').addEventListener('click', async () => {
    const text = await navigator.clipboard.readText();
    if (!text) {
        await CustomDialog.alert("Clipboard is empty!");
        return;
    }

    const trimmed = text.trim();

    // Check if Subscription (http/https)
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        const isSub = await CustomDialog.confirm("Detected URL. Import as Subscription?\n\nOK = Subscription (Auto-update)\nCancel = Import Configs Once");

        if (isSub) {
            // Check Duplicate
            const duplicate = subscriptions.find(s => s.url === trimmed);
            if (duplicate) {
                await CustomDialog.alert(`Duplicate Subscription!\n\nUse "Update" on existing subscription:\n"${duplicate.name}"`);
                return;
            }

            const name = await CustomDialog.prompt("Enter Subscription Name:", "My Subscription");
            if (!name) return;

            try {
                // 1. Create Sub
                const newSub = await storage.addSubscription(name, trimmed);

                // 2. Fetch & Parse
                const configs = await ConfigParser.parse(trimmed);

                // 3. Save as Linked
                await storage.replaceSubscriptionServers(newSub.id, configs);

                await CustomDialog.alert(`Subscription Added! ${configs.length} configs imported.`);
                await loadSubscriptions();
                await refreshServers();

            } catch (e) {
                await CustomDialog.alert("Subscription Import Failed: " + e.message);
            }
            return;
        }
    }

    // Normal Import
    try {
        const configs = await ConfigParser.parse(trimmed);
        if (configs.length > 0) {
            await storage.addServers(configs);
            await refreshServers();
            await CustomDialog.alert(`Imported ${configs.length} config(s).`);
        } else {
            await CustomDialog.alert("No recognizable config links found.");
        }
    } catch (e) {
        await CustomDialog.alert("Error parsing: " + e.message);
        console.error(e);
    }
});

clearConfigsBtn.addEventListener('click', async () => {
    if (await CustomDialog.confirm("Clear ALL configs?")) {
        chrome.storage.local.set({ "xray_servers": [] }, async () => {
            uiState.selectedId = null;
            uiState.pings = {};
            await refreshServers();
        });
    }
});

// --- Test All Logic (Sliding Window) ---
async function testAllConfigs() {
    if (uiState.isTesting) {
        uiState.isTesting = false;
        updateUI();
        return;
    }

    if (uiState.servers.length === 0) return;

    // Load Limit
    const res = await chrome.storage.local.get(['ping_concurrency']);
    const CONCURRENT_LIMIT = parseInt(res.ping_concurrency) || 10;

    // Start Testing
    uiState.isTesting = true;
    updateUI();

    // Reset pings for *visible* servers only? Or all?
    // User wants to ping visible ones.
    const targets = getFilteredServers();

    // Clear previous pings for these targets only
    targets.forEach(s => uiState.pings[s.id] = '...');
    renderServerList(); // Show '...' state

    // Queue
    const queue = [...targets];
    const activePromises = [];
    let stopSignal = false;

    // Save stop handler
    window.stopTestAll = () => {
        stopSignal = true;
    };
    // User said "Configs being tested right now should be yellow".
    // So we only mark active ones. reset others?
    // Let's reset old pings to be clear?
    // uiState.pings = {}; // Optional: clear old pings
    renderServerList();

    // Helper to run one test
    const runTest = async (srv) => {
        if (!uiState.isTesting) return;

        uiState.pings[srv.id] = '...';
        // Force render of single item update?
        // renderServerList() is expensive if called 50 times/sec.
        // We'll rely on periodic or batched render if needed, or just call it.
        // For 10 concurrent, it's fine.
        renderServerList();

        try {
            const res = await chrome.runtime.sendMessage({
                type: "PING_SERVER",
                config: srv
            });

            if (res && res.status === 'ok') {
                uiState.pings[srv.id] = res.data;
            } else {
                uiState.pings[srv.id] = -1;
            }
        } catch (e) {
            uiState.pings[srv.id] = -1;
        }

        // Save incrementally
        chrome.storage.local.set({ 'pings': uiState.pings });
    };

    while (queue.length > 0 && uiState.isTesting) {
        // Fill up to limit
        while (activePromises.length < CONCURRENT_LIMIT && queue.length > 0) {
            const srv = queue.shift();
            const p = runTest(srv).finally(() => {
                // Remove self from active
                const idx = activePromises.indexOf(p);
                if (idx > -1) activePromises.splice(idx, 1);
            });
            activePromises.push(p);
        }

        // Wait for at least one to finish before loop checking again
        if (activePromises.length > 0) {
            await Promise.race(activePromises);
        }
    }

    // Wait for remaining
    await Promise.all(activePromises);

    uiState.isTesting = false;
    updateUI();
    renderServerList();
}




// --- Settings Modal Logic ---
const settingsBtn = document.getElementById('settingsBtn');
const testAllBtn = document.getElementById('testAllBtn');

if (testAllBtn) {
    testAllBtn.addEventListener('click', testAllConfigs);
}
const settingsModal = document.getElementById('settingsModal');
const saveSettingsBtn = document.getElementById('saveSettingsBtn');
const closeSettingsBtn = document.getElementById('closeSettingsBtn');
const bypassInput = document.getElementById('bypassList');
const concurrencyInput = document.getElementById('concurrencyInput');

settingsBtn.addEventListener('click', async () => {
    const res = await chrome.storage.local.get(['bypass_list', 'ping_concurrency']);
    const list = res.bypass_list || ["<local>", "192.168.0.0/16", "*.ir", "ir", "geoip:ir"];
    bypassInput.value = list.join('\n');

    if (concurrencyInput) {
        concurrencyInput.value = res.ping_concurrency || 10;
    }

    settingsModal.classList.remove('hidden');
});

closeSettingsBtn.addEventListener('click', () => {
    settingsModal.classList.add('hidden');
});

saveSettingsBtn.addEventListener('click', () => {
    const raw = bypassInput.value;
    const list = raw.split('\n').map(l => l.trim()).filter(l => l);

    const limit = concurrencyInput ? parseInt(concurrencyInput.value) : 10;

    chrome.storage.local.set({
        'bypass_list': list,
        'ping_concurrency': limit
    }, () => {
        alert("Settings Saved!");
        settingsModal.classList.add('hidden');
        chrome.runtime.sendMessage({ type: "UPDATE_PROXY_SETTINGS" });
    });
});


// --- Graph Rendering ---
function renderLoop() {
    ctx.clearRect(0, 0, diffCanvas.width, diffCanvas.height);

    ctx.beginPath();
    ctx.strokeStyle = '#00f3ff';
    ctx.lineWidth = 2;

    const max = Math.max(...speedHistory, 1024 * 10); // Min scale 10KB
    const h = diffCanvas.height;
    const w = diffCanvas.width;
    const step = w / (speedHistory.length - 1);

    speedHistory.forEach((val, i) => {
        const y = h - ((val / max) * h);
        if (i === 0) ctx.moveTo(0, y);
        else ctx.lineTo(i * step, y);
    });

    ctx.stroke();

    // Fill
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.fillStyle = 'rgba(0, 243, 255, 0.2)';
    ctx.fill();

    ctx.fill();

    requestAnimationFrame(renderLoop);
}

// --- Info Modal Listeners ---
if (infoBtn) {
    infoBtn.addEventListener('click', () => {
        infoModal.classList.remove('hidden');
    });
}
if (closeInfoBtn) {
    closeInfoBtn.addEventListener('click', () => {
        infoModal.classList.add('hidden');
    });
}

// --- Smart Installer Flow ---
async function checkNativeHost() {
    try {
        const response = await chrome.runtime.sendMessage({ type: "ping" });
        if (!response || response.pong !== "pong") throw new Error("No pong");
    } catch (e) {
        console.warn("Native Host Disconnected:", e);

        // Use a small timeout to let the UI load first
        setTimeout(async () => {
            const doInstall = await CustomDialog.confirm(
                "Native Helper Disconnected!\n\nTo use Homa, you must install the helper app.\n\nDownload & Run Installer now?"
            );

            if (doInstall) {
                downloadInstaller();
            }
        }, 500);
    }
}

function downloadInstaller() {
    // Redirect to the GitHub Releases page
    // Users can choose their specific platform installer from there.
    const url = "https://github.com/Fox-Fig/homa/releases/latest/";
    window.open(url, '_blank');
}

// Start Initial Check
checkNativeHost();

// Helpers
function formatSpeed(bytes) {
    if (bytes < 1024) return bytes + ' B/s';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB/s';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB/s';
}
