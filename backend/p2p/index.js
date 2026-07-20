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
const { PORT, UDP_PORT, PROTOCOL_VERSION, SERVICE_NAME, PORT_FALLBACK_ATTEMPTS } = require('./protocol/constants');
const { getNetworkName, getNodeId } = require('../core/node_identity');
const { getCurrentTips } = require('../dag/graph/dag_tips');
const bus = require('../core/event_bus');
const express = require('express');
const cors = require('cors');
const http = require('http');
let _server = null;
let _boundPort = PORT;
let _syncState = 'Sincronizzato';
const _rateLimitMap = new Map();
function _rateLimit(ip, limit, windowMs) {
    try {
        const now = Date.now();
        const e = _rateLimitMap.get(ip) || { n: 0, until: now + windowMs };
        if (now > e.until) { e.n = 0; e.until = now + windowMs; }
        e.n++;
        _rateLimitMap.set(ip, e);
        return e.n > limit;
    } catch (_) { return false; }
}
function _rlMiddleware(limit, windowMs) {
    return (req, res, next) => {
        try {
            const ip = req.ip || (req.connection && req.connection.remoteAddress) || 'unknown';
            if (_rateLimit(ip, limit, windowMs)) return res.status(429).json({ error: 'Too Many Requests' });
            next();
        } catch (_) { next(); }
    };
}
function getBoundPort() { return _boundPort; }
bus.subscribe('sync:state', ({ state }) => { _syncState = state; });
bus.subscribe('peer:discovered', (peer) => {
    if (peer && (peer.source === 'pex' || peer.source === 'manual')) {
        const { syncWithPeer } = require('../dag/sync/sync_coordinator');
        setTimeout(() => {
            syncWithPeer(peer.ip, peer.port || 34567).catch(() => {});
        }, Math.random() * 2000);
    }
});
function getSyncState() { return _syncState; }
function getConnectedNodesCount() {
    const now = Date.now();
    return getAllPeers().filter(p => p.state === 'SYNCED' && now - p.lastSeen < 45000).length;
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
        broadcast(`UPDATE_AVAILABLE_P2P:${version}`, UDP_PORT, 3000).catch(() => {});
    } catch (_) {}
}
function broadcastUpdateAvailable(version) { announceLocalUpdate(version); }

function broadcastForceResync() {
    try {
        const { computeBroadcastToken } = require('./network_auth');
        const token = computeBroadcastToken('FORCE_RESYNC_P2P');
        if (!token) { console.error('[P2P] Impossibile calcolare il token di broadcast: rete non inizializzata.'); return; }
        const { broadcast } = require('./discovery/udp_broadcaster');
        broadcast(`FORCE_RESYNC_P2P:${token}`, UDP_PORT, 2000).catch(() => {});
        console.log('[P2P] Inviato comando FORCE_RESYNC_P2P in broadcast LAN.');
    } catch (e) {
        console.error('[P2P] broadcastForceResync error:', e.message);
    }
}

async function forceNukeAndClone(ip, port) {
    if (!ip) return false;
    const { app: electronApp } = require('electron');
    const path = require('path');
    const fs = require('fs');
    const { getNetworkCodeHash } = require('../db');
    const { getNetworkName } = require('../core/node_identity');

    console.warn(`[P2P] RICEVUTO ORDINE DI OVERWRITE DATABASE DA ${ip}! Inizio procedura di backup e nuke...`);
    try {
        const networkName = getNetworkName() || 'UnknownNetwork';
        const hash = await getNetworkCodeHash();

        const dbDir = path.join(electronApp.getPath('userData'), 'dbs');
        const backupBaseDir = path.join(electronApp.getPath('userData'), 'backups', networkName);
        const dateStr = new Date().toISOString().split('T')[0];
        const timeStr = new Date().toISOString().split('T')[1].replace(/:/g, '-').split('.')[0];
        const backupDir = path.join(backupBaseDir, `${dateStr}_${timeStr}_PRE_NUKE`);

        fs.mkdirSync(backupDir, { recursive: true });

        ['ledger.db', 'auth.db'].forEach(file => {
            const src = path.join(dbDir, file);
            if (fs.existsSync(src)) {
                fs.copyFileSync(src, path.join(backupDir, file));
            }
        });
        console.log(`[P2P] Backup completato in ${backupDir}`);

        const headers = { 'x-adestio-network': hash };
        
        const fetchFile = (endpoint, targetFile) => {
            return new Promise((resolve, reject) => {
                const http = require('http');
                const req = http.get(`http://${ip}:${port}${endpoint}`, { headers }, (res) => {
                    if (res.statusCode !== 200) return reject(new Error(`Status ${res.statusCode}`));
                    const fileStream = fs.createWriteStream(path.join(dbDir, targetFile));
                    res.pipe(fileStream);
                    fileStream.on('finish', () => resolve());
                    fileStream.on('error', reject);
                });
                req.on('error', reject);
            });
        };

        await fetchFile('/sync/clone', 'ledger.db');
        await fetchFile('/sync/clone-auth', 'auth.db');

        console.warn('[P2P] Database rimpiazzati con successo. Riavvio forzato del nodo...');

        electronApp.relaunch();
        electronApp.exit(0);
    } catch (e) {
        console.error(`[P2P] Errore critico durante forceNukeAndClone:`, e.message);
    }
}

async function triggerFullResync(ip, port) {
    return fullResync(ip, port || PORT);
}
function startSyncServer() {
    if (_server) return _server;
    try {
        const app = express();
        app.use(cors({ origin: false }));
        app.use(express.json({ limit: '50mb' }));
        app.get('/ping', async (req, res) => {
            try {
                const { checkIsRegistered } = require('../handlers/auth');
                const { getTotalBlocksCount } = require('../dag/graph/dag_store');
                const { app: electronApp } = require('electron');
                const { getPendingUpdateVersion } = require('../core/updaterService');
                const isInitialized = await checkIsRegistered();
                res.json({ status: 'ok', node: getNetworkName(), protocolVersion: PROTOCOL_VERSION, appVersion: electronApp.getVersion(), nodeId: getNodeId(), isInitialized, blockCount: getTotalBlocksCount(), updateReadyVersion: typeof getPendingUpdateVersion === 'function' ? getPendingUpdateVersion() : null });
            } catch (e) {
                res.status(500).json({ error: 'Internal error' });
            }
        });

        app.get('/sync/app-package/:appId', async (req, res) => {
            try {
                const { verifyNetworkHash } = require('./network_auth');
                const providedHash = req.headers['x-adestio-network'];
                const authorized = await verifyNetworkHash(providedHash);
                if (!authorized) return res.status(403).json({ error: 'Network code mismatch' });

                const appId = req.params.appId;
                if (!appId || appId.includes('..') || appId.includes('/') || appId.includes('\\')) {
                    return res.status(400).json({ error: 'Invalid appId' });
                }

                const fs = require('fs');
                const AdmZip = require('adm-zip');
                const appsRegistry = require('../core/appsRegistry');
                
                const manifests = await appsRegistry.getAppsRegistry();
                const manifest = manifests.find(m => m.id === appId);
                if (!manifest || !manifest.appPath) {
                    return res.status(404).json({ error: 'App not found on this node' });
                }

                const appDir = manifest.appPath;
                if (!fs.existsSync(appDir)) {
                    return res.status(404).json({ error: 'App physically not found' });
                }

                const zip = new AdmZip();
                zip.addLocalFolder(appDir);
                const buffer = zip.toBuffer();

                res.set('Content-Type', 'application/zip');
                res.set('Content-Disposition', `attachment; filename=${appId}.zip`);
                res.set('Content-Length', buffer.length);
                res.send(buffer);
            } catch (e) {
                console.error('[P2P] Errore /sync/app-package:', e);
                res.status(500).json({ error: 'Internal error processing zip' });
            }
        });

        app.post('/sync/force-nuke', _rlMiddleware(5, 60000), async (req, res) => {
            try {
                const { verifyNetworkHash } = require('./network_auth');
                const providedHash = req.headers['x-adestio-network'];
                const authorized = await verifyNetworkHash(providedHash);
                if (!authorized) return res.status(403).json({ error: 'Network code mismatch' });
                const senderIp = req.body && req.body.senderIp;
                if (!senderIp || !/^\d{1,3}(\.\d{1,3}){3}$/.test(senderIp)) return res.status(400).json({ error: 'Invalid senderIp' });
                console.warn(`[P2P] Ricevuto comando di FORCE NUKE autenticato da ${senderIp}. Procedo alla distruzione del DB e al clone.`);
                res.json({ status: 'accepted', message: 'Nuke in corso...' });
                setTimeout(() => forceNukeAndClone(senderIp, PORT), 500);
            } catch (e) {
                res.status(500).json({ error: e.message });
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
        app.get('/sync/clone', _rlMiddleware(10, 60000), async (req, res) => {
            try {
                const { verifyNetworkHash } = require('./network_auth');
                const authorized = await verifyNetworkHash(req.headers['x-adestio-network']);
                if (!authorized) return res.status(403).json({ error: 'Network code mismatch' });
                const { getDB } = require('../db');
                const ledger = getDB('ledger');
                const buffer = ledger.exportData();
                res.set('Content-Type', 'application/octet-stream');
                res.send(buffer);
            } catch (e) {
                res.status(500).json({ error: e.message });
            }
        });
        app.get('/sync/clone-auth', _rlMiddleware(10, 60000), async (req, res) => {
            try {
                const { verifyNetworkHash } = require('./network_auth');
                const authorized = await verifyNetworkHash(req.headers['x-adestio-network']);
                if (!authorized) return res.status(403).json({ error: 'Network code mismatch' });
                const { getDB } = require('../db');
                const authDb = getDB('auth');
                const buffer = authDb.exportData();
                res.set('Content-Type', 'application/octet-stream');
                res.send(buffer);
            } catch (e) {
                res.status(500).json({ error: e.message });
            }
        });
        app.get('/sync/update-info', (req, res) => {
            try {
                const updatesManager = require('../updates_manager');
                const { app: electronApp } = require('electron');
                const highestLocal = updatesManager.getHighestLocalVersion();
                const currentApp = electronApp.getVersion();
                const v = highestLocal || currentApp;
                const sha512 = highestLocal ? updatesManager.getLocalChecksum(highestLocal) : null;
                res.json({ version: v, sha512: sha512 });
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
        let _listenAttempt = 0;
        const _tryListen = (port) => {
            _boundPort = port;
            _server.listen(port, '0.0.0.0');
        };
        _server.on('listening', () => {
            console.log(`[P2P] Server WebSocket in ascolto su porta ${_boundPort}`);
            startUdpListener(UDP_PORT, getNodeId, getNetworkName, PROTOCOL_VERSION, (version, senderIp) => {
                try { require('../core/updaterService').maybeAdoptLanUpdate(version, senderIp, _boundPort); } catch (_) {}
            }, (senderIp, token) => {
                try {
                    const { verifyBroadcastToken } = require('./network_auth');
                    if (!verifyBroadcastToken('FORCE_RESYNC_P2P', token)) {
                        console.warn(`[P2P] FORCE_RESYNC_P2P scartato: token non valido da ${senderIp}`);
                        return;
                    }
                    forceNukeAndClone(senderIp, _boundPort);
                } catch (e) {
                    console.error('[P2P] Errore verifica FORCE_RESYNC_P2P:', e.message);
                }
            }, () => _boundPort);
            const networkName = getNetworkName();
            publishMdns(networkName ? `${SERVICE_NAME}-${networkName}` : SERVICE_NAME, _boundPort).catch(() => {});
            startDiscovery();
        });
        _server.on('error', (e) => {
            if (e.code === 'EADDRINUSE' && _listenAttempt < PORT_FALLBACK_ATTEMPTS - 1) {
                _listenAttempt++;
                const nextPort = PORT + _listenAttempt;
                console.warn(`[P2P] Porta ${_boundPort} occupata, tentativo su ${nextPort}...`);
                setTimeout(() => _tryListen(nextPort), 200);
            } else if (e.code === 'EADDRINUSE') {
                console.error(`[P2P] Nessuna porta libera nell'intervallo ${PORT}-${PORT + PORT_FALLBACK_ATTEMPTS - 1}.`);
            } else {
                console.error('[P2P] Server error:', e.message);
            }
        });
        _tryListen(PORT);
        startAntiEntropy();
        startWatchdog();
        try { const { app: electronApp } = require('electron'); announceLocalUpdate(electronApp.getVersion()); } catch (_) {}
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
    startSyncServer,
    loadPeerCache, announceLocalUpdate, broadcastUpdateAvailable, triggerFullResync, broadcastForceResync,
    getConnectedNodesCount,
    getSyncState,
    getDetailedNodes,
    getBoundPort,
    ensureFirewallRule, ensureFirewallRules,
    scanForNodes: runDiscovery,
    PROTOCOL_VERSION, PORT
};
