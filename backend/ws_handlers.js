const { app } = require('electron');
const { getNetworkCodeHash } = require('./db');
const { getLocalNodeId, getNetworkName, PROTOCOL_VERSION, MIN_COMPATIBLE_PROTOCOL_VERSION } = require('./sync');
const wsHandlers = {
    'handshake': async (payload, ws) => {
        const { nodeId, protocolVersion, appVersion, dagTips, networkCodeHash } = payload;
        if (!nodeId || typeof protocolVersion !== 'number') {
            throw new Error('Invalid handshake payload');
        }
        const storedHash = await getNetworkCodeHash();
        if (storedHash && networkCodeHash !== storedHash) {
            throw new Error('Network mismatch');
        }
        const myNodeId = getLocalNodeId();
        const myTips = [];
        try {
            const { getCurrentTips } = require('./blockchain');
            const tipsList = getCurrentTips(require('./db').getDB('ledger'));
            myTips.push(...tipsList);
        } catch (_) {}
        if (protocolVersion < MIN_COMPATIBLE_PROTOCOL_VERSION) {
            return {
                nodeId: myNodeId,
                protocolVersion: PROTOCOL_VERSION,
                dagTips: myTips,
                compatible: false,
                reason: 'HARD_FORK',
                minimumVersion: String(MIN_COMPATIBLE_PROTOCOL_VERSION)
            };
        }
        try {
            const db = require('./db').getDB('config');
            db.run(
                'INSERT OR REPLACE INTO node_registry (node_id, protocol_version, app_version, last_seen) VALUES (?, ?, ?, ?)',
                [nodeId, protocolVersion, appVersion || '0.0.0', Date.now()]
            );
            require('./db').saveDB('config');
        } catch (_) {}
        try {
            const { registerSocket } = require('./ws_rpc');
            registerSocket(nodeId, ws);
        } catch (_) {}
        return {
            nodeId: myNodeId,
            protocolVersion: PROTOCOL_VERSION,
            dagTips: myTips,
            compatible: true
        };
    },
    'pex_exchange': async (payload, ws) => {
        const { peers } = payload;
        if (Array.isArray(peers)) {
            const { addNodeToMemory, getPexNodes } = require('./sync');
            for (const peer of peers) {
                if (peer && typeof peer.ip === 'string' && peer.ip !== '127.0.0.1') {
                    const ipParts = peer.ip.split('.');
                    if (ipParts.length === 4) {
                        addNodeToMemory(peer.name || 'Adestio Node PEX', peer.ip, peer.port || 34567, 0, peer.protocolVersion || 0, peer.nodeId);
                    }
                }
            }
            return { peers: getPexNodes() };
        }
        return { peers: [] };
    },
    'blocks_pull': async (payload, ws) => {
        const { knownTips } = payload;
        if (!Array.isArray(knownTips)) {
            throw new Error('Invalid payload: knownTips must be an array');
        }
        const { getBlocksSince, getCurrentTips } = require('./blockchain');
        const blocks = getBlocksSince(knownTips);
        const newTips = getCurrentTips(require('./db').getDB('ledger'));
        return { blocks, newTips };
    },
    'blocks_push': async (payload, ws) => {
        const { blocks } = payload;
        if (!Array.isArray(blocks)) {
            throw new Error('Invalid payload: blocks must be an array');
        }
        const { applyBlock, topologicalSort } = require('./blockchain');
        const sorted = topologicalSort(blocks);
        let appliedCount = 0;
        for (const b of sorted) {
            if (applyBlock(b)) appliedCount++;
        }
        return { success: true, appliedCount };
    },
    'full_resync': async (payload, ws) => {
        const { getAllBlocks, getCurrentTips } = require('./blockchain');
        const blocks = getAllBlocks();
        const ledgerDb = require('./db').getDB('ledger');
        const tips = getCurrentTips(ledgerDb);
        return { blocks, tips };
    }
};
module.exports = wsHandlers;
