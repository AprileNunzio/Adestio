'use strict';
const { computeBlockId } = require('./block_hasher');
const { normalizePayload } = require('./block_codec');
const { validatePayloadSchema } = require('../schema/payload_validator');
function validateStructure(block) {
    return !!(block && block.block_id && Array.isArray(block.parent_ids) && block.event_type && block.table_name && block.record_id);
}
function validateIntegrity(block) {
    try {
        const payload = normalizePayload(block.payload);
        const expected = computeBlockId(block.parent_ids, block.node_id, block.created_at, block.event_type, block.table_name, block.record_id, payload, block.payload_version);
        return expected === block.block_id;
    } catch (_) { return false; }
}
function validateSchema(block) {
    return validatePayloadSchema(block.table_name, block.event_type, normalizePayload(block.payload));
}
module.exports = { validateStructure, validateIntegrity, validateSchema };
