'use strict';
const bus = require('../core/event_bus');
const { getDB } = require('../db');
const crypto = require('crypto');
let _isInitialized = false;
let _nodeId = 'unknown';
function init() {
    if (_isInitialized) return;
    _isInitialized = true;
    try {
        const configDb = getDB('config');
        if (configDb) {
            const row = configDb.query("SELECT key_value FROM network_config WHERE key_name = 'node_id'");
            if (row && row.length > 0) {
                _nodeId = row[0].key_value;
            }
        }
    } catch(e) {}
    bus.subscribe('logger:distributed-error', (payload) => {
        try {
            if (_nodeId === 'unknown') {
                const configDb = getDB('config');
                if (configDb) {
                    const row = configDb.query("SELECT key_value FROM network_config WHERE key_name = 'node_id'");
                    if (row && row.length > 0) _nodeId = row[0].key_value;
                }
            }
            const { getNetworkName } = require('../core/node_identity');
            let finalMeta = payload.meta ? { ...payload.meta } : {};
            finalMeta.node_name = getNetworkName();
            const record = {
                id: crypto.randomUUID(),
                node_id: _nodeId,
                level: payload.level,
                message: payload.message,
                meta: Object.keys(finalMeta).length > 0 ? JSON.stringify(finalMeta) : null,
                created_at: Date.now(),
                is_deleted: 0
            };
            const authDb = getDB('auth');
            if (authDb) {
                authDb.run('INSERT INTO distributed_logs (id, node_id, level, message, meta, created_at, is_deleted) VALUES (?, ?, ?, ?, ?, ?, 0)', [
                    record.id, record.node_id, record.level, record.message, record.meta, record.created_at
                ]);
                const { wrapMutationWithEvent, saveDB } = require('../db');
                wrapMutationWithEvent('INSERT', 'distributed_logs', record.id, record);
                saveDB();
            }
        } catch(e) {}
    });
}
module.exports = { init };
