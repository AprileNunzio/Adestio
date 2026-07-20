'use strict';
const crypto = require('crypto');
const sessionCrypto = require('./session_crypto');
const ALGO = 'aes-256-gcm';
const IV_LEN = 12;
const AUTH_TAG_LEN = 16;
let _cachedStaticKey = null;
function _getStaticKey() {
    if (_cachedStaticKey) return _cachedStaticKey;
    try {
        const { deriveKeyForPurpose } = require('../../security/network_key_derivation');
        const configDb = require('../../db').getDB('config');
        const res = configDb.query("SELECT key_value FROM network_config WHERE key_name = 'network_code'");
        if (!res || res.length === 0) return null;
        _cachedStaticKey = deriveKeyForPurpose(res[0].key_value, 'wire-transport');
        return _cachedStaticKey;
    } catch (e) {
        return null;
    }
}
function getStaticKeyHex() {
    return _getStaticKey();
}
function _encryptWith(plaintext, keyHex) {
    try {
        if (!keyHex) return null;
        const iv = crypto.randomBytes(IV_LEN);
        const cipher = crypto.createCipheriv(ALGO, Buffer.from(keyHex, 'hex'), iv);
        const encrypted = Buffer.concat([cipher.update(Buffer.from(plaintext, 'utf8')), cipher.final()]);
        const authTag = cipher.getAuthTag();
        return Buffer.concat([iv, authTag, encrypted]);
    } catch (e) {
        return null;
    }
}
function _decryptWith(buffer, keyHex) {
    try {
        if (!keyHex) return null;
        if (!Buffer.isBuffer(buffer) || buffer.length < IV_LEN + AUTH_TAG_LEN) return null;
        const iv = buffer.subarray(0, IV_LEN);
        const authTag = buffer.subarray(IV_LEN, IV_LEN + AUTH_TAG_LEN);
        const data = buffer.subarray(IV_LEN + AUTH_TAG_LEN);
        const decipher = crypto.createDecipheriv(ALGO, Buffer.from(keyHex, 'hex'), iv);
        decipher.setAuthTag(authTag);
        return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
    } catch (e) {
        return null;
    }
}
function encrypt(plaintext, ws) {
    const sessionKey = ws ? sessionCrypto.getSession(ws) : null;
    return _encryptWith(plaintext, sessionKey || _getStaticKey());
}
function decrypt(buffer, ws) {
    const sessionKey = ws ? sessionCrypto.getSession(ws) : null;
    if (sessionKey) {
        const viaSession = _decryptWith(buffer, sessionKey);
        if (viaSession !== null) return viaSession;
    }
    return _decryptWith(buffer, _getStaticKey());
}
module.exports = { encrypt, decrypt, getStaticKeyHex };
