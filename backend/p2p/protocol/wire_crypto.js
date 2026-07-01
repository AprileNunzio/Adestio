'use strict';
const crypto = require('crypto');
const ALGO = 'aes-256-gcm';
const IV_LEN = 12;
const AUTH_TAG_LEN = 16;
let _cachedKey = null;
function _getKey() {
    if (_cachedKey) return _cachedKey;
    try {
        const { deriveKeyForPurpose } = require('../../security/network_key_derivation');
        const configDb = require('../../db').getDB('config');
        const res = configDb.query("SELECT key_value FROM network_config WHERE key_name = 'network_code'");
        if (!res || res.length === 0) return null;
        _cachedKey = deriveKeyForPurpose(res[0].key_value, 'wire-transport');
        return _cachedKey;
    } catch (e) {
        return null;
    }
}
function encrypt(plaintext) {
    const key = _getKey();
    if (!key) return null;
    try {
        const iv = crypto.randomBytes(IV_LEN);
        const cipher = crypto.createCipheriv(ALGO, Buffer.from(key, 'hex'), iv);
        const encrypted = Buffer.concat([cipher.update(Buffer.from(plaintext, 'utf8')), cipher.final()]);
        const authTag = cipher.getAuthTag();
        return Buffer.concat([iv, authTag, encrypted]);
    } catch (e) {
        return null;
    }
}
function decrypt(buffer) {
    const key = _getKey();
    if (!key) return null;
    try {
        if (!Buffer.isBuffer(buffer) || buffer.length < IV_LEN + AUTH_TAG_LEN) return null;
        const iv = buffer.subarray(0, IV_LEN);
        const authTag = buffer.subarray(IV_LEN, IV_LEN + AUTH_TAG_LEN);
        const data = buffer.subarray(IV_LEN + AUTH_TAG_LEN);
        const decipher = crypto.createDecipheriv(ALGO, Buffer.from(key, 'hex'), iv);
        decipher.setAuthTag(authTag);
        return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
    } catch (e) {
        return null;
    }
}
module.exports = { encrypt, decrypt };
