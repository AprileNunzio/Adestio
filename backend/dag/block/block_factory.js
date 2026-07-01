'use strict';
const { computeBlockId } = require('./block_hasher');
const { normalizePayload } = require('./block_codec');
const { validatePayloadSchema } = require('../schema/payload_validator');
const { getCurrentTips, updateTips } = require('../graph/dag_tips');
const { getNodeId } = require('../../core/node_identity');
const { CURRENT_PAYLOAD_VERSION } = require('../schema/schema_registry');
const bus = require('../../core/event_bus');
const DeveloperVault = require('../../security/developer_vault');

function createBlock(eventType, tableName, recordId, payload) {
    try {
        const norm = normalizePayload(payload);
        if (!validatePayloadSchema(tableName, eventType, norm)) {
            console.warn(`[BlockFactory] Schema non valido per ${tableName}`);
            return null;
        }
        const db = require('../../db').getDB('ledger');
        const nodeId = getNodeId();
        const createdAt = Date.now();
        const parentIds = getCurrentTips(db);
        const blockId = computeBlockId(parentIds, nodeId, createdAt, eventType, tableName, recordId, norm, CURRENT_PAYLOAD_VERSION);
        const existing = db.query('SELECT block_id FROM event_log WHERE block_id = ?', [blockId]);
        if (existing && existing.length > 0) return null;
        db.run(
            'INSERT INTO event_log (block_id, parent_ids, event_type, table_name, record_id, payload, node_id, created_at, payload_version, is_applied) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)',
            [blockId, JSON.stringify(parentIds), eventType, tableName, String(recordId), JSON.stringify(norm), nodeId, createdAt, CURRENT_PAYLOAD_VERSION]
        );
        updateTips(db, parentIds, blockId);
        require('../../db').saveDB('ledger');
        const block = { block_id: blockId, parent_ids: parentIds, event_type: eventType, table_name: tableName, record_id: String(recordId), payload: norm, node_id: nodeId, created_at: createdAt, payload_version: CURRENT_PAYLOAD_VERSION };
        DeveloperVault.logMutation(block).catch(()=>{});
        bus.publish('block:created', block);
        return block;
    } catch (e) {
        console.error('[BlockFactory] createBlock error:', e.message);
        return null;
    }
}
module.exports = { createBlock };
