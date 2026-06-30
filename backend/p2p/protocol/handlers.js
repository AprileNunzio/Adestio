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
        } catch (_) {}

        pool.registerSocket(nodeId, ws);
        bus.publish('peer:handshaked', { nodeId, protocolVersion, dagTips });

        return { nodeId: myNodeId, protocolVersion: PROTOCOL_VERSION, dagTips: myTips, compatible: true };
    },

    async pex_exchange(payload) {
        const { peers } = payload;
        const myPeers = [];
        try { myPeers.push(...require('../../p2p/peers/peer_registry').getPexPeers()); } catch (_) {}
        if (Array.isArray(peers)) {
            for (const p of peers) {
                if (p && typeof p.ip === 'string' && p.ip !== '127.0.0.1' && p.ip.split('.').length === 4) {
                    bus.publish('peer:discovered', { ...p, source: 'pex' });
                }
            }
        }
        return { peers: myPeers };
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
        const { applyBlock } = require('../../dag/application/block_applier');
        const { topologicalSort } = require('../../dag/graph/dag_traversal');
        let applied = 0;
        for (const b of topologicalSort(blocks)) { if (await applyBlock(b)) applied++; }
        return { success: true, appliedCount: applied };
    },

    async full_resync() {
        const { getAllBlocks } = require('../../dag/graph/dag_store');
        const { getCurrentTips } = require('../../dag/graph/dag_tips');
        const db = require('../../db').getDB('ledger');
        return { blocks: getAllBlocks(), tips: getCurrentTips(db) };
    }
};

module.exports = handlers;
