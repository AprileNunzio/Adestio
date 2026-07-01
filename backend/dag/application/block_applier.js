'use strict';
const { validateStructure, validateIntegrity, validateSchema } = require('../block/block_validator');
const { normalizePayload } = require('../block/block_codec');
const { updateTips } = require('../graph/dag_tips');
const { isBlockKnown } = require('../graph/dag_store');
const { adaptPayload } = require('../schema/schema_migrator');
const { SYNC_TABLES } = require('../schema/schema_registry');
const { shouldApply } = require('./conflict_resolver');
const bus = require('../../core/event_bus');
function _applyToTable(db, eventType, tableName, recordId, payload, createdAt) {
    if (!SYNC_TABLES.includes(tableName)) return false;
    const tableInfo = db.query(`PRAGMA table_info(${tableName})`);
    const validCols = tableInfo ? new Set(tableInfo.map(c => c.name)) : null;
    let filtered = validCols ? Object.fromEntries(Object.entries(payload).filter(([k]) => validCols.has(k))) : { ...payload };
    if (!filtered.id) filtered.id = recordId;
    if (eventType === 'DELETE') {
        const ex = db.query(`SELECT last_modified FROM ${tableName} WHERE id = ?`, [recordId]);
        if (ex && ex.length > 0 && createdAt > ex[0].last_modified) {
            db.run(`DELETE FROM ${tableName} WHERE id = ?`, [recordId]);
        }
        return true;
    }
    const existing = db.query(`SELECT last_modified FROM ${tableName} WHERE id = ?`, [recordId]);
    if (existing && existing.length > 0) {
        if (!shouldApply(createdAt, '', existing[0].last_modified, '')) return true;
        const cols = Object.keys(filtered);
        db.run(`UPDATE ${tableName} SET ${cols.map(c => `${c} = ?`).join(', ')} WHERE id = ?`, [...Object.values(filtered), recordId]);
    } else {
        const cols = Object.keys(filtered);
        db.run(`INSERT OR IGNORE INTO ${tableName} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`, Object.values(filtered));
    }
    return true;
}
function applyBlock(block) {
    try {
        if (!validateStructure(block)) return false;
        const norm = normalizePayload(block.payload);
        const enriched = { ...block, payload: norm };
        if (!validateSchema(enriched)) {
            bus.publish('block:schema-error', { blockId: block.block_id, table: block.table_name, nodeId: block.node_id });
            return false;
        }
        if (!validateIntegrity(enriched)) return false;
        if (!SYNC_TABLES.includes(block.table_name)) return false;
        if (isBlockKnown(block.block_id)) return true;
        const ledger = require('../../db').getDB('ledger');
        const auth   = require('../../db').getDB('auth');
        const config = require('../../db').getDB('config');
        const adapted = adaptPayload(block.table_name, block.payload_version || 1, norm);
        ledger.execute('BEGIN TRANSACTION;');
        auth.execute('BEGIN TRANSACTION;');
        config.execute('BEGIN TRANSACTION;');
        try {
            ledger.run(
                'INSERT OR IGNORE INTO event_log (block_id, parent_ids, event_type, table_name, record_id, payload, node_id, created_at, payload_version, is_applied) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)',
                [block.block_id, JSON.stringify(block.parent_ids), block.event_type, block.table_name, String(block.record_id), JSON.stringify(norm), block.node_id, block.created_at, block.payload_version || 1]
            );
            const applied = _applyToTable(auth, block.event_type, block.table_name, block.record_id, adapted, block.created_at);
            if (applied) ledger.run('UPDATE event_log SET is_applied = 1 WHERE block_id = ?', [block.block_id]);
            const parentIds = Array.isArray(block.parent_ids) ? block.parent_ids : JSON.parse(block.parent_ids);
            updateTips(ledger, parentIds, block.block_id);
            try { config.run('INSERT OR REPLACE INTO node_registry (node_id, protocol_version, app_version, last_seen) VALUES (?, ?, ?, ?)', [block.node_id, block.payload_version || 1, '0.0.0', Date.now()]); } catch (_) {}
            ledger.execute('COMMIT;');
            auth.execute('COMMIT;');
            config.execute('COMMIT;');
        } catch (e) {
            try { ledger.execute('ROLLBACK;'); } catch (_) {}
            try { auth.execute('ROLLBACK;'); } catch (_) {}
            try { config.execute('ROLLBACK;'); } catch (_) {}
            throw e;
        }
        require('../../db').saveDB('ledger');
        require('../../db').saveDB('auth');
        require('../../db').saveDB('config');
        bus.publish('block:applied', { blockId: block.block_id, table: block.table_name, event: block.event_type, recordId: block.record_id, nodeId: block.node_id });
        return true;
    } catch (e) {
        console.error('[BlockApplier] applyBlock error:', e.message);
        return false;
    }
}
module.exports = { applyBlock };
