'use strict';
const crypto = require('crypto');
function timingSafeEqualHex(a, b) {
    try {
        if (typeof a !== 'string' || typeof b !== 'string' || a.length === 0 || b.length === 0) return false;
        const bufA = Buffer.from(a, 'utf8');
        const bufB = Buffer.from(b, 'utf8');
        if (bufA.length !== bufB.length) return false;
        return crypto.timingSafeEqual(bufA, bufB);
    } catch (e) {
        return false;
    }
}
async function verifyNetworkHash(providedHash) {
    try {
        const { getNetworkCodeHash } = require('../db');
        const storedHash = await getNetworkCodeHash();
        if (!storedHash || !providedHash) return false;
        return timingSafeEqualHex(String(providedHash), String(storedHash));
    } catch (e) {
        return false;
    }
}
function computeBroadcastToken(message) {
    try {
        const configDb = require('../db').getDB('config');
        const res = configDb.query("SELECT key_value FROM network_config WHERE key_name = 'network_code'");
        if (!res || res.length === 0) return null;
        const { deriveKeyForPurpose } = require('../security/network_key_derivation');
        const key = deriveKeyForPurpose(res[0].key_value, 'udp-broadcast-auth');
        return crypto.createHmac('sha256', Buffer.from(key, 'hex')).update(message).digest('hex');
    } catch (e) {
        return null;
    }
}
function verifyBroadcastToken(message, providedToken) {
    try {
        const expected = computeBroadcastToken(message);
        if (!expected) return false;
        return timingSafeEqualHex(String(providedToken || ''), expected);
    } catch (e) {
        return false;
    }
}
module.exports = { timingSafeEqualHex, verifyNetworkHash, computeBroadcastToken, verifyBroadcastToken };
