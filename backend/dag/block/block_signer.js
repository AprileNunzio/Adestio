'use strict';
const keypair = require('../../security/node_keypair');
function _message(block) {
    return Buffer.from(String(block.block_id), 'utf8');
}
function signBlock(block) {
    return keypair.sign(_message(block));
}
function learnKey(nodeId, publicKeyPem) {
    if (!nodeId || !publicKeyPem) return false;
    const db = require('../../db').getDB('ledger');
    const now = Date.now();
    const rows = db.query('SELECT public_key FROM node_keys WHERE node_id = ?', [nodeId]);
    if (rows && rows.length > 0) {
        if (rows[0].public_key !== publicKeyPem) return false;
        db.run('UPDATE node_keys SET last_seen = ? WHERE node_id = ?', [now, nodeId]);
        return true;
    }
    db.run('INSERT OR IGNORE INTO node_keys (node_id, public_key, first_seen, last_seen) VALUES (?, ?, ?, ?)', [nodeId, publicKeyPem, now, now]);
    require('../../db').saveDB('ledger');
    return true;
}
function getKey(nodeId) {
    const db = require('../../db').getDB('ledger');
    const r = db.query('SELECT public_key FROM node_keys WHERE node_id = ?', [nodeId]);
    return (r && r.length > 0) ? r[0].public_key : null;
}
function ensureSelfKey() {
    const { getNodeId } = require('../../core/node_identity');
    return learnKey(getNodeId(), keypair.getPublicKeyPem());
}
function verifyBlock(block) {
    if (!block || !block.signature) return 'unsigned';
    const pub = getKey(block.node_id);
    if (!pub) return 'unknown_key';
    return keypair.verify(pub, _message(block), block.signature) ? 'valid' : 'invalid';
}
module.exports = { signBlock, verifyBlock, learnKey, getKey, ensureSelfKey };
