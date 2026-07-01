'use strict';
function normalizePayload(p) {
    try {
        let r = p;
        if (typeof r === 'string') { try { r = JSON.parse(r); } catch (_) {} }
        return r;
    } catch (_) { return p; }
}
function deserializeRow(row) {
    return {
        block_id:        row.block_id,
        parent_ids:      Array.isArray(row.parent_ids) ? row.parent_ids : JSON.parse(row.parent_ids),
        event_type:      row.event_type,
        table_name:      row.table_name,
        record_id:       row.record_id,
        payload:         normalizePayload(typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload),
        node_id:         row.node_id,
        created_at:      row.created_at,
        payload_version: row.payload_version
    };
}
function serializeForStorage(block) {
    return {
        block_id:        block.block_id,
        parent_ids:      JSON.stringify(block.parent_ids),
        event_type:      block.event_type,
        table_name:      block.table_name,
        record_id:       String(block.record_id),
        payload:         JSON.stringify(block.payload),
        node_id:         block.node_id,
        created_at:      block.created_at,
        payload_version: block.payload_version
    };
}
module.exports = { normalizePayload, deserializeRow, serializeForStorage };
