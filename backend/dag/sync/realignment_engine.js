'use strict';
const { getAll } = require('../../p2p/transport/connection_pool');
const reputation = require('../../p2p/peers/reputation');
const reconciler = require('./reconciler');
const outbox = require('./outbox');
let _running = false;
async function realign() {
    if (_running) return { skipped: true };
    _running = true;
    try {
        const sockets = getAll();
        const entries = [...sockets.entries()];
        if (entries.length === 0) {
            await outbox.drain().catch(() => {});
            return { peers: 0, converged: 0 };
        }
        const byNode = new Map(entries);
        const ranked = reputation.rank(entries.map(([nodeId]) => nodeId));
        let converged = 0;
        for (const nodeId of ranked) {
            const ws = byNode.get(nodeId);
            if (!ws) continue;
            const t0 = Date.now();
            try {
                const res = await reconciler.reconcileWithPeer(ws);
                if (res.converged) {
                    converged++;
                    reputation.recordSuccess(nodeId, Date.now() - t0);
                } else {
                    reputation.recordFailure(nodeId);
                }
            } catch (_) {
                reputation.recordFailure(nodeId);
            }
        }
        await outbox.drain().catch(() => {});
        return { peers: entries.length, converged };
    } finally {
        _running = false;
    }
}
module.exports = { realign };
