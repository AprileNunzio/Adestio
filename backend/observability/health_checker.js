'use strict';
const { getSnapshot } = require('./metrics');

function check() {
    const metrics = getSnapshot();
    const peers = (() => {
        try { return require('../p2p/peers/peer_registry').getAllPeers().filter(p => p.state === 'SYNCED').length; } catch (_) { return -1; }
    })();
    const dbsOk = (() => {
        try {
            const db = require('../db');
            ['auth', 'config', 'ledger'].forEach(n => db.getDB(n));
            return true;
        } catch (_) { return false; }
    })();
    const status = dbsOk ? (peers > 0 ? 'healthy' : 'degraded') : 'unhealthy';
    return { status, peers, dbsOk, metrics, checkedAt: Date.now() };
}

module.exports = { check };
