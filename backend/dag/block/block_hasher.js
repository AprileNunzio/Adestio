'use strict';
const crypto = require('crypto');

function computeBlockId(parentIds, nodeId, createdAt, eventType, tableName, recordId, payload, payloadVersion) {
    const canonical =
        JSON.stringify(parentIds.slice().sort()) +
        nodeId +
        String(createdAt) +
        eventType +
        tableName +
        recordId +
        JSON.stringify(payload) +
        String(payloadVersion);
    return crypto.createHash('sha256').update(canonical).digest('hex');
}

module.exports = { computeBlockId };
