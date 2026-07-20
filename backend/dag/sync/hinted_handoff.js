'use strict';
function _ledger() {
    return require('../../db').getDB('ledger');
}
function addHint(targetNode, blockId) {
    if (!targetNode || !blockId) return;
    try {
        _ledger().run('INSERT OR IGNORE INTO hinted_hints (id, target_node, block_id, created_at) VALUES (?, ?, ?, ?)', [targetNode + '|' + blockId, targetNode, blockId, Date.now()]);
        require('../../db').saveDB('ledger');
    } catch (_) {}
}
async function flushFor(targetNode, ws) {
    if (!targetNode || !ws) return { flushed: 0 };
    const db = _ledger();
    const rows = db.query('SELECT id, block_id FROM hinted_hints WHERE target_node = ? ORDER BY created_at ASC', [targetNode]);
    if (!rows || rows.length === 0) return { flushed: 0 };
    const { sendRequest } = require('../../p2p/protocol/rpc');
    const { getBlockById } = require('../graph/dag_store');
    const outbox = require('./outbox');
    let flushed = 0;
    for (const row of rows) {
        const block = getBlockById(row.block_id);
        if (!block) {
            db.run('DELETE FROM hinted_hints WHERE id = ?', [row.id]);
            continue;
        }
        try {
            await sendRequest(ws, 'blocks_push', { blocks: [block] }, 15000);
            db.run('DELETE FROM hinted_hints WHERE id = ?', [row.id]);
            outbox.markAck(row.block_id, targetNode);
            flushed++;
        } catch (_) {
            break;
        }
    }
    require('../../db').saveDB('ledger');
    return { flushed };
}
module.exports = { addHint, flushFor };
