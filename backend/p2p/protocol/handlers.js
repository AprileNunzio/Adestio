'use strict';
const { getNetworkCodeHash } = require('../../db');
const { getNodeId } = require('../../core/node_identity');
const { PROTOCOL_VERSION, MIN_COMPATIBLE_PROTOCOL_VERSION } = require('./constants');
const pool = require('../transport/connection_pool');
const bus = require('../../core/event_bus');
const handlers = {
    async handshake(payload, ws) {
        const { nodeId, protocolVersion, appVersion, dagTips, networkCodeHash } = payload;
        if (!nodeId || typeof protocolVersion !== 'number') throw new Error('Invalid handshake payload');
        const storedHash = await getNetworkCodeHash();
        if (storedHash && networkCodeHash !== storedHash) throw new Error('Network mismatch');
        const myNodeId = getNodeId();
        const myTips = [];
        try {
            const { getCurrentTips } = require('../../dag/graph/dag_tips');
            myTips.push(...getCurrentTips(require('../../db').getDB('ledger')));
        } catch (_) {}
        if (protocolVersion < MIN_COMPATIBLE_PROTOCOL_VERSION) {
            return { nodeId: myNodeId, protocolVersion: PROTOCOL_VERSION, dagTips: myTips, compatible: false, reason: 'HARD_FORK', minimumVersion: String(MIN_COMPATIBLE_PROTOCOL_VERSION) };
        }
        try {
            const db = require('../../db').getDB('config');
            db.run('INSERT OR REPLACE INTO node_registry (node_id, protocol_version, app_version, last_seen) VALUES (?, ?, ?, ?)', [nodeId, protocolVersion, appVersion || '0.0.0', Date.now()]);
            require('../../db').saveDB('config');
            
            if (appVersion) {
                const { app } = require('electron');
                const updatesManager = require('../../updates_manager');
                if (updatesManager.compareVersions(appVersion, app.getVersion()) > 0) {
                    let ip = ws._socket.remoteAddress;
                    if (ip && ip.includes('::ffff:')) ip = ip.split('::ffff:')[1];
                    if (ip && ip !== '127.0.0.1') {
                        require('../../core/updaterService').maybeAdoptLanUpdate(appVersion, ip, 34567);
                    }
                }
            }
        } catch (_) {}
        pool.registerSocket(nodeId, ws);
        if (payload.publicKey) { try { require('../../dag/block/block_signer').learnKey(nodeId, payload.publicKey); } catch (_) {} }
        try { require('../../dag/sync/hinted_handoff').flushFor(nodeId, ws).catch(() => {}); } catch (_) {}
        bus.publish('peer:handshaked', { nodeId, protocolVersion, dagTips });
        const myAppVersion = require('electron').app.getVersion();
        return { nodeId: myNodeId, protocolVersion: PROTOCOL_VERSION, dagTips: myTips, compatible: true, appVersion: myAppVersion };
    },
    async pex_exchange(payload) {
        const { peers } = payload;
        const myPeers = [];
        try { myPeers.push(...require('../../p2p/peers/peer_registry').getPexPeers()); } catch (_) {}
        if (Array.isArray(peers)) {
            for (const p of peers) {
                if (!p || typeof p.ip !== 'string') continue;
                const octets = p.ip.split('.');
                if (octets.length !== 4) continue;
                if (octets.some(o => { const n = parseInt(o, 10); return isNaN(n) || n < 0 || n > 255; })) continue;
                if (parseInt(octets[0], 10) === 127) continue;
                bus.publish('peer:discovered', { ...p, source: 'pex' });
            }
        }
        return { peers: myPeers };
    },
    async user_logged_in(payload) {
        const { userId, nodeId, nodeName, ipAddress, deviceInfo } = payload;
        try {
            const myNodeId = require('../../core/node_identity').getNodeId();
            if (nodeId !== myNodeId) {
                const { BrowserWindow } = require('electron');
                const wins = BrowserWindow.getAllWindows();
                wins.forEach(w => w.webContents.send('force-logout-if-user', { userId, nodeId, nodeName, ipAddress, deviceInfo }));
            }
        } catch(e) {
            console.error('[P2P] Errore handler user_logged_in:', e.message);
        }
        return { success: true };
    },
    async blocks_pull(payload) {
        const { knownTips } = payload;
        if (!Array.isArray(knownTips)) throw new Error('knownTips must be an array');
        const { getBlocksSince } = require('../../dag/graph/dag_store');
        const { getCurrentTips } = require('../../dag/graph/dag_tips');
        return { blocks: getBlocksSince(knownTips), newTips: getCurrentTips(require('../../db').getDB('ledger')) };
    },
    async blocks_push(payload) {
        const { blocks } = payload;
        if (!Array.isArray(blocks)) throw new Error('blocks must be an array');
        const { ingestMany } = require('../../dag/application/block_ingest');
        const res = ingestMany(blocks);
        return { success: true, appliedCount: res.applied, storedCount: res.stored };
    },
    async full_resync() {
        const { getAllBlocks } = require('../../dag/graph/dag_store');
        const { getCurrentTips } = require('../../dag/graph/dag_tips');
        const db = require('../../db').getDB('ledger');
        return { blocks: getAllBlocks(), tips: getCurrentTips(db) };
    }
};
Object.assign(handlers, require('./sync_handlers'));
module.exports = handlers;
