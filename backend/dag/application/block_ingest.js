'use strict';
const { validateStructure, validateIntegrity, validateSchema } = require('../block/block_validator');
const { normalizePayload } = require('../block/block_codec');
const { verifyBlock } = require('../block/block_signer');
const { updateTips } = require('../graph/dag_tips');
const projector = require('./projector');
const bus = require('../../core/event_bus');
function _ledger() {
    return require('../../db').getDB('ledger');
}
function _parents(block) {
    return Array.isArray(block.parent_ids) ? block.parent_ids : JSON.parse(block.parent_ids || '[]');
}
function ingestOne(block) {
    if (!validateStructure(block)) return { stored: false, reason: 'structure' };
    const norm = normalizePayload(block.payload);
    const enriched = { ...block, payload: norm };
    if (!validateIntegrity(enriched)) return { stored: false, reason: 'integrity' };
    if (!validateSchema(enriched)) {
        bus.publish('block:schema-error', { blockId: block.block_id, table: block.table_name });
        return { stored: false, reason: 'schema' };
    }
    const verdict = verifyBlock(enriched);
    if (verdict === 'invalid') {
        bus.publish('block:forged', { blockId: block.block_id, nodeId: block.node_id });
        return { stored: false, reason: 'signature' };
    }
    const ledger = _ledger();
    const known = ledger.query('SELECT block_id FROM event_log WHERE block_id = ?', [block.block_id]);
    if (known && known.length > 0) return { stored: true, duplicate: true };
    const parents = _parents(block);
    ledger.run(
        'INSERT OR IGNORE INTO event_log (block_id, parent_ids, event_type, table_name, record_id, payload, node_id, created_at, payload_version, is_applied, signature, received_at, validity) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)',
        [block.block_id, JSON.stringify(parents), block.event_type, block.table_name, String(block.record_id), JSON.stringify(norm), block.node_id, block.created_at, block.payload_version || 1, block.signature || '', Date.now(), verdict === 'valid' ? 'valid' : 'unverified']
    );
    updateTips(ledger, parents, block.block_id);
    return { stored: true, duplicate: false };
}
function ingestMany(blocks) {
    if (!Array.isArray(blocks) || blocks.length === 0) return { stored: 0, applied: 0 };
    let stored = 0;
    for (const b of blocks) {
        const r = ingestOne(b);
        if (r.stored && !r.duplicate) stored++;
    }
    if (stored > 0) require('../../db').saveDB('ledger');
    const applied = projector.drain();
    if (stored > 0) require('../../db').notifyDataChanged('event_log', stored);
    bus.publish('sync:ingested', { stored, applied });
    return { stored, applied };
}
module.exports = { ingestOne, ingestMany };
