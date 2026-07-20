'use strict';
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const BCRYPT_COST = 10;
const LEGACY_SHA256_RE = /^[a-f0-9]{64}$/i;
function _legacyHash(value) {
    return crypto.createHash('sha256').update(value).digest('hex');
}
async function hash(value) {
    return bcrypt.hash(value, BCRYPT_COST);
}
async function verify(value, stored) {
    if (!stored) return { valid: false, needsRehash: false };
    if (LEGACY_SHA256_RE.test(stored)) {
        return { valid: _legacyHash(value) === stored, needsRehash: true };
    }
    return { valid: await bcrypt.compare(value, stored), needsRehash: false };
}
module.exports = { hash, verify };
