'use strict';
const crypto = require('crypto');
const os = require('os');
let _nodeId = null;
function getNodeId() {
    if (_nodeId) return _nodeId;
    try {
        const db = require('../db').getDB('config');
        const res = db.query("SELECT key_value FROM network_config WHERE key_name = 'node_id'");
        if (res && res.length > 0) { _nodeId = res[0].key_value; return _nodeId; }
        const newId = _generate();
        db.run("INSERT OR REPLACE INTO network_config (key_name, key_value) VALUES (?, ?)", ['node_id', newId]);
        require('../db').saveDB('config');
        _nodeId = newId;
        return _nodeId;
    } catch (_) {
        _nodeId = _generate();
        return _nodeId;
    }
}

function getNetworkName() {
    return os.hostname() || 'Unknown-PC';
}

function _generate() {
    try { return require('uuid').v4(); } catch (_) { return crypto.randomBytes(16).toString('hex'); }
}
module.exports = { getNodeId, getNetworkName };
