'use strict';
const { attachToServer } = require('./transport/ws_server');
const { startUdpListener } = require('./discovery/udp_broadcaster');
const { publish: publishMdns } = require('./discovery/mdns_resolver');
const { start: startDiscovery, runDiscovery } = require('./discovery/discovery_coordinator');
const { start: startAntiEntropy, stop: stopAntiEntropy } = require('../dag/sync/anti_entropy');
const { start: startWatchdog, stop: stopWatchdog } = require('./resilience/watchdog');
const { ensureFirewallRules } = require('./firewall/windows_firewall');
const { loadPeers, savePeers } = require('./peers/peer_cache');
const { loadFromCache, getAllPeers, getDetailedPeers, getPexPeers } = require('./peers/peer_registry');
const { syncWithPeer, fullResync } = require('../dag/sync/sync_coordinator');
const { PORT, UDP_PORT, PROTOCOL_VERSION, SERVICE_NAME } = require('./protocol/constants');
const { getNetworkName, getNodeId } = require('../core/node_identity');
const { getCurrentTips } = require('../dag/graph/dag_tips');
const bus = require('../core/event_bus');
const express = require('express');
const cors = require('cors');
const http = require('http');
let _server = null;
let _syncState = 'Sincronizzato';
bus.subscribe('sync:state', ({ state }) => { _syncState = state; });
function getSyncState() { return _syncState; }
function getConnectedNodesCount() {
    return getAllPeers().filter(p => p.state === 'SYNCED').length;
}
function getDetailedNodes() {
    return getDetailedPeers();
}
function loadPeerCache() {
    try {
        const peers = loadPeers();
        if (peers && peers.length > 0) loadFromCache(peers);
    } catch (e) {
        console.error('[P2P] loadPeerCache error:', e.message);
    }
}
function announceLocalUpdate(version) {
    try {
        const { broadcast } = require('./discovery/udp_broadcaster');
        broadcast(`UPDATE_AVAILABLE:${version}`, UDP_PORT, 3000).catch(() => {});
    } catch (_) {}
}
function broadcastUpdateAvailable(version) { announceLocalUpdate(version); }
async function triggerFullResync(ip, port) {
    return fullResync(ip, port || PORT);
}
function startSyncServer() {
    if (_server) return _server;
    try {
        const app = express();
        app.use(cors());
        app.use(express.json({ limit: '50mb' }));
        app.get('/ping', async (req, res) => {
            try {
                const { checkIsRegistered } = require('../handlers/auth');
                const isInitialized = await checkIsRegistered();
                res.json({ status: 'ok', node: getNetworkName(), protocolVersion: PROTOCOL_VERSION, nodeId: getNodeId(), isInitialized });
            } catch (e) {
                res.status(500).json({ error: 'Internal error' });
            }
        });
        app.get('/health', (req, res) => {
            try {
                const { check } = require('../observability/health_checker');
                res.json(check());
            } catch (_) {
                res.json({ status: 'degraded' });
            }
        });
        app.use('/api/network-test', require('../network_test_api').createRouter());
        app.get('/sync/update-info', (req, res) => {
            try {
                const updatesManager = require('../updates_manager');
                const { app: electronApp } = require('electron');
                res.json({ version: updatesManager.getHighestLocalVersion() || electronApp.getVersion() });
            } catch (e) {
                res.status(500).json({ error: e.message });
            }
        });
        app.get('/sync/update/download/:version', (req, res) => {
            try {
                if (!/^\d+\.\d+\.\d+$/.test(req.params.version)) return res.status(400).json({ error: 'Invalid version' });
                const updatesManager = require('../updates_manager');
                const filePath = updatesManager.getInstallerPath(req.params.version);
                if (!filePath) return res.status(404).json({ error: 'Not found' });
                res.sendFile(filePath);
            } catch (e) {
                res.status(500).json({ error: e.message });
            }
        });
        app.get('/sync/update', (req, res) => {
            try {
                const updatesManager = require('../updates_manager');
                const version = updatesManager.getHighestLocalVersion();
                const filePath = version ? updatesManager.getInstallerPath(version) : null;
                if (!filePath) return res.status(404).json({ error: 'Not found' });
                res.sendFile(filePath);
            } catch (e) {
                res.status(500).json({ error: e.message });
            }
        });
        _server = http.createServer(app);
        attachToServer(_server);
        _server.listen(PORT, '0.0.0.0', () => {
            console.log(`[P2P] Server WebSocket in ascolto su porta ${PORT}`);
        });
        _server.on('error', (e) => {
            if (e.code === 'EADDRINUSE') console.error(`[P2P] Porta ${PORT} occupata.`);
            else console.error('[P2P] Server error:', e.message);
        });
        startUdpListener(UDP_PORT, getNodeId, getNetworkName, PROTOCOL_VERSION, null);
        const networkName = getNetworkName();
        publishMdns(networkName ? `${SERVICE_NAME}-${networkName}` : SERVICE_NAME, PORT).catch(() => {});
        startDiscovery();
        startAntiEntropy();
        startWatchdog();
        bus.subscribe('watchdog:stale', () => {
            const peers = getDetailedNodes().filter(p => p.ip !== '127.0.0.1');
            for (const peer of peers.slice(0, 3)) {
                syncWithPeer(peer.ip, peer.port || PORT).catch(() => {});
            }
        });
        loadPeerCache();
        setInterval(() => savePeers(getAllPeers()), 60000);
        return _server;
    } catch (e) {
        console.error('[P2P] startSyncServer error:', e.message);
        return null;
    }
}
function stopSyncServer() {
    stopAntiEntropy();
    stopWatchdog();
    if (_server) {
        try { _server.close(); } catch (_) {}
        _server = null;
    }
    savePeers(getAllPeers());
}
const ensureFirewallRule = ensureFirewallRules;
module.exports = {
    startSyncServer, stopSyncServer,
    getConnectedNodesCount, getDetailedNodes, getSyncState,
    loadPeerCache, announceLocalUpdate, broadcastUpdateAvailable, triggerFullResync,
    ensureFirewallRule, ensureFirewallRules,
    scanForNodes: runDiscovery,
    PROTOCOL_VERSION, PORT
};
