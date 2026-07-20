'use strict';
const REPLICATION_FACTOR = 2;
const MAX_ATTEMPTS = 50;
function _ledger() {
    return require('../../db').getDB('ledger');
}
function _acks(raw) {
    try { return JSON.parse(raw || '[]'); } catch (_) { return []; }
}
function enqueue(block) {
    if (!block || !block.block_id) return;
    try {
        const self = require('../../core/node_identity').getNodeId();
        _ledger().run('INSERT OR IGNORE INTO sync_outbox (block_id, created_at, attempts, next_attempt, acks, durable) VALUES (?, ?, 0, 0, ?, 0)', [block.block_id, Date.now(), JSON.stringify([self])]);
        require('../../db').saveDB('ledger');
    } catch (_) {}
}
function markAck(blockId, nodeId) {
    if (!blockId || !nodeId) return;
    const db = _ledger();
    const r = db.query('SELECT acks FROM sync_outbox WHERE block_id = ?', [blockId]);
    if (!r || r.length === 0) return;
    const set = new Set(_acks(r[0].acks));
    set.add(nodeId);
    const acks = [...set];
    const durable = (acks.length - 1) >= REPLICATION_FACTOR ? 1 : 0;
    db.run('UPDATE sync_outbox SET acks = ?, durable = ? WHERE block_id = ?', [JSON.stringify(acks), durable, blockId]);
}
async function drain() {
    const db = _ledger();
    const now = Date.now();
    const rows = db.query('SELECT block_id, acks, attempts FROM sync_outbox WHERE durable = 0 AND next_attempt <= ? ORDER BY created_at ASC', [now]);
    if (!rows || rows.length === 0) return { delivered: 0 };
    const { getAll } = require('../../p2p/transport/connection_pool');
    const { sendRequest } = require('../../p2p/protocol/rpc');
    const { getBlockById } = require('../graph/dag_store');
    const hinted = require('./hinted_handoff');
    const sockets = getAll();
    let delivered = 0;
    for (const row of rows) {
        const block = getBlockById(row.block_id);
        if (!block) {
            db.run('DELETE FROM sync_outbox WHERE block_id = ?', [row.block_id]);
            continue;
        }
        const acked = new Set(_acks(row.acks));
        for (const [nodeId, ws] of sockets.entries()) {
            if (acked.has(nodeId)) continue;
            try {
                await sendRequest(ws, 'blocks_push', { blocks: [block] }, 15000);
                markAck(row.block_id, nodeId);
                delivered++;
            } catch (_) {
                hinted.addHint(nodeId, row.block_id);
            }
        }
        db.run('UPDATE sync_outbox SET attempts = attempts + 1, next_attempt = ? WHERE block_id = ?', [now + Math.min(60000, 2000 * (row.attempts + 1)), row.block_id]);
    }
    db.run('DELETE FROM sync_outbox WHERE attempts > ?', [MAX_ATTEMPTS]);
    require('../../db').saveDB('ledger');
    return { delivered };
}
module.exports = { enqueue, markAck, drain, REPLICATION_FACTOR };
