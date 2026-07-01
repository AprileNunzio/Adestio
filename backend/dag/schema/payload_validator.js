'use strict';
const { getSchema } = require('./schema_registry');
function validatePayloadSchema(tableName, eventType, payload) {
    if (eventType === 'DELETE' || !payload) return true;
    const schema = getSchema(tableName);
    if (!schema) return true;
    for (const key of schema.required || []) {
        if (!(key in payload)) {
            try { require('../../observability/logger').logSyncAnomaly('SCHEMA_MISMATCH', `Manca campo '${key}' in '${tableName}'`, payload); } catch (_) {}
            return false;
        }
    }
    return true;
}
module.exports = { validatePayloadSchema };
