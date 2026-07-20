'use strict';
const crypto = require('crypto');
const SCRYPT_SALT = 'adestio-network-key-v1';
const SCRYPT_OPTS = { N: 16384, r: 8, p: 1 };
function _normalize(networkCode) {
    return networkCode.replace(/-/g, '').toUpperCase();
}
function deriveMasterKey(networkCode) {
    return crypto.scryptSync(_normalize(networkCode), SCRYPT_SALT, 32, SCRYPT_OPTS).toString('hex');
}
function deriveSubkey(masterKeyHex, purpose) {
    return Buffer.from(crypto.hkdfSync('sha256', Buffer.from(masterKeyHex, 'hex'), Buffer.alloc(0), Buffer.from(purpose), 32)).toString('hex');
}
function deriveKeyForPurpose(networkCode, purpose) {
    return deriveSubkey(deriveMasterKey(networkCode), purpose);
}
module.exports = { deriveMasterKey, deriveSubkey, deriveKeyForPurpose };
