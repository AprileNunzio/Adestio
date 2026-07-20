'use strict';
const crypto = require('crypto');
let _cache = null;
function _load() {
    const db = require('../db').getDB('config');
    const rows = db.query("SELECT key_name, key_value FROM network_config WHERE key_name IN ('node_private_pem','node_public_pem')");
    const map = {};
    for (const r of (rows || [])) map[r.key_name] = r.key_value;
    if (map.node_private_pem && map.node_public_pem) return { priv: map.node_private_pem, pub: map.node_public_pem };
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
    const priv = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
    const pub = publicKey.export({ type: 'spki', format: 'pem' }).toString();
    db.run("INSERT OR REPLACE INTO network_config (key_name, key_value) VALUES (?, ?)", ['node_private_pem', priv]);
    db.run("INSERT OR REPLACE INTO network_config (key_name, key_value) VALUES (?, ?)", ['node_public_pem', pub]);
    require('../db').saveDB('config');
    return { priv, pub };
}
function _keys() {
    if (!_cache) _cache = _load();
    return _cache;
}
function getPublicKeyPem() {
    return _keys().pub;
}
function sign(data) {
    const priv = crypto.createPrivateKey(_keys().priv);
    const buf = Buffer.isBuffer(data) ? data : Buffer.from(String(data), 'utf8');
    return crypto.sign(null, buf, priv).toString('base64');
}
function verify(publicKeyPem, data, signatureB64) {
    try {
        const pub = crypto.createPublicKey(publicKeyPem);
        const buf = Buffer.isBuffer(data) ? data : Buffer.from(String(data), 'utf8');
        return crypto.verify(null, buf, pub, Buffer.from(String(signatureB64), 'base64'));
    } catch (_) {
        return false;
    }
}
module.exports = { getPublicKeyPem, sign, verify };
