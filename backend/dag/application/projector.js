'use strict';
const { deserializeRow } = require('../block/block_codec');
const { reapplyToTables } = require('./block_applier');
const { getDomainForTable } = require('../schema/schema_registry');
function _ledger() {
    return require('../../db').getDB('ledger');
}
function _present(blockId) {
    const r = _ledger().query('SELECT 1 AS x FROM event_log WHERE block_id = ?', [blockId]);
    return !!(r && r.length > 0);
}
function _canApply(block) {
    const parents = Array.isArray(block.parent_ids) ? block.parent_ids : JSON.parse(block.parent_ids || '[]');
    for (const p of parents) {
        if (p === 'GENESIS') continue;
        if (!_present(p)) return false;
    }
    return true;
}
function _applyOne(block) {
    const ledger = _ledger();
    const domain = getDomainForTable(block.table_name);
    const dataDb = require('../../db').getDB(domain);
    dataDb.execute('BEGIN TRANSACTION;');
    ledger.execute('BEGIN TRANSACTION;');
    try {
        const ok = reapplyToTables(block);
        if (!ok) {
            dataDb.execute('ROLLBACK;');
            ledger.execute('ROLLBACK;');
            return false;
        }
        ledger.run('UPDATE event_log SET is_applied = 1, applied_at = ? WHERE block_id = ?', [Date.now(), block.block_id]);
        dataDb.execute('COMMIT;');
        ledger.execute('COMMIT;');
        return true;
    } catch (e) {
        try { dataDb.execute('ROLLBACK;'); } catch (_) {}
        try { ledger.execute('ROLLBACK;'); } catch (_) {}
        return false;
    }
}
function drain() {
    const ledger = _ledger();
    let applied = 0;
    let progress = true;
    const touchedDomains = new Set();
    while (progress) {
        progress = false;
        const rows = ledger.query('SELECT block_id, parent_ids, event_type, table_name, record_id, payload, node_id, created_at, payload_version FROM event_log WHERE is_applied = 0 ORDER BY created_at ASC');
        if (!rows || rows.length === 0) break;
        for (const row of rows) {
            const block = deserializeRow(row);
            if (!_canApply(block)) continue;
            if (_applyOne(block)) {
                applied++;
                progress = true;
                touchedDomains.add(getDomainForTable(block.table_name));
            }
        }
    }
    if (applied > 0) {
        for (const domain of touchedDomains) {
            try { require('../../db').saveDB(domain); } catch (_) {}
        }
        require('../../db').saveDB('ledger');
    }
    return applied;
}
module.exports = { drain };
