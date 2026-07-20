'use strict';
const { deserializeRow } = require('../block/block_codec');
function getLedgerDB() { return require('../../db').getDB('ledger'); }
function getBlockById(blockId) {
    const db = getLedgerDB();
    const res = db.query('SELECT * FROM event_log WHERE block_id = ?', [blockId]);
    return (res && res.length > 0) ? deserializeRow(res[0]) : null;
}
function getAllBlocks() {
    const db = getLedgerDB();
    const res = db.query('SELECT block_id, parent_ids, event_type, table_name, record_id, payload, node_id, created_at, payload_version, signature FROM event_log ORDER BY created_at ASC');
    return res ? res.map(deserializeRow) : [];
}
function getBlocksSince(knownBlockIds) {
    const db = getLedgerDB();
    if (!knownBlockIds || knownBlockIds.length === 0) return getAllBlocks();
    const allRes = db.query('SELECT block_id, parent_ids FROM event_log');
    if (!allRes || allRes.length === 0) return [];
    const parentMap = new Map();
    const allIds = new Set();
    for (const row of allRes) {
        parentMap.set(row.block_id, JSON.parse(row.parent_ids));
        allIds.add(row.block_id);
    }
    const known = new Set();
    const stack = [...knownBlockIds];
    while (stack.length > 0) {
        const cur = stack.pop();
        if (known.has(cur) || cur === 'GENESIS') continue;
        known.add(cur);
        const parents = parentMap.get(cur);
        if (parents) for (const pid of parents) if (!known.has(pid)) stack.push(pid);
    }
    const toSend = [...allIds].filter(id => !known.has(id));
    if (toSend.length === 0) return [];
    const result = [];
    const CHUNK = 900;
    for (let i = 0; i < toSend.length; i += CHUNK) {
        const chunk = toSend.slice(i, i + CHUNK);
        const rows = db.query(
            `SELECT block_id, parent_ids, event_type, table_name, record_id, payload, node_id, created_at, payload_version, signature FROM event_log WHERE block_id IN (${chunk.map(() => '?').join(',')}) ORDER BY created_at ASC`,
            chunk
        );
        if (rows) result.push(...rows.map(deserializeRow));
    }
    result.sort((a, b) => a.created_at - b.created_at);
    return result;
}
function isBlockKnown(blockId) {
    const db = getLedgerDB();
    const res = db.query('SELECT block_id FROM event_log WHERE block_id = ?', [blockId]);
    return !!(res && res.length > 0);
}
function getPendingBlocks() {
    const db = getLedgerDB();
    const res = db.query('SELECT block_id, parent_ids, event_type, table_name, record_id, payload, node_id, created_at, payload_version FROM event_log WHERE is_applied = 0 ORDER BY created_at ASC');
    return res ? res.map(deserializeRow) : [];
}

function getTotalBlocksCount() {
    try {
        const db = getLedgerDB();
        const res = db.query('SELECT COUNT(*) as cnt FROM event_log');
        return res && res.length > 0 ? res[0].cnt : 0;
    } catch (e) {
        return 0;
    }
}

module.exports = { getLedgerDB, getBlockById, getAllBlocks, getBlocksSince, isBlockKnown, getPendingBlocks, getTotalBlocksCount };
