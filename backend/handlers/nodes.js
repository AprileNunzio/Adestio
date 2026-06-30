function getExtendedNodeMetrics() {
    try {
        const { getAllBlocks, getCurrentTips, getNodeId } = require('../blockchain');
        const { getDB } = require('../db');
        const { getSyncState } = require('../sync_engine');
        const { PORT } = require('../sync');

        const ledgerDb = getDB('ledger');
        const allBlocks = getAllBlocks();
        const tips = getCurrentTips(ledgerDb);

        let lastBlockHash = 'N/A';
        let lastBlockTime = null;
        let pendingBlocks = 0;
        let totalEvents = allBlocks.length;
        let throughput = 0;

        if (allBlocks.length > 0) {
            try {
                const sorted = allBlocks.sort((a, b) => b.created_at - a.created_at);
                lastBlockHash = sorted[0].block_id || 'N/A';
                lastBlockTime = sorted[0].created_at || null;
            } catch (e) {}
        }

        try {
            const pendingRows = ledgerDb.query('SELECT COUNT(*) as cnt FROM event_log WHERE is_applied = 0');
            if (pendingRows && pendingRows.length > 0) {
                pendingBlocks = pendingRows[0].cnt || 0;
            }
        } catch (e) {}

        try {
            const fiveMinAgo = Date.now() - 300000;
            const recentBlocks = allBlocks.filter(b => b.created_at > fiveMinAgo);
            throughput = Math.round((recentBlocks.length / 5) * 10) / 10;
        } catch (e) {}

        let peerHeights = {};
        try {
            const { getDetailedNodes } = require('../sync');
            const nodes = getDetailedNodes();
            for (const n of nodes) {
                peerHeights[n.ip] = n.ledgerHeight || null;
            }
        } catch (e) {}

        let uptimeSeconds = 0;
        try {
            if (global._adestioBootTime) {
                uptimeSeconds = Math.floor((Date.now() - global._adestioBootTime) / 1000);
            }
        } catch (e) {}

        return {
            lastBlockHash,
            lastBlockTime,
            pendingBlocks,
            totalEvents,
            throughput,
            dagTips: tips.length,
            peerHeights,
            port: PORT,
            nodeId: getNodeId(),
            syncState: getSyncState(),
            uptimeSeconds
        };
    } catch (e) {
        console.error('[NodesHandler] getExtendedNodeMetrics error:', e);
        return {
            lastBlockHash: 'N/A',
            lastBlockTime: null,
            pendingBlocks: 0,
            totalEvents: 0,
            throughput: 0,
            dagTips: 1,
            peerHeights: {},
            port: 34567,
            nodeId: 'Sconosciuto',
            syncState: 'Errore',
            uptimeSeconds: 0
        };
    }
}

module.exports = { getExtendedNodeMetrics };
