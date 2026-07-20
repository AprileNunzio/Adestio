'use strict';
const crypto = require('crypto');
const _sessions = new WeakMap();
function generateEphemeralKeyPair() {
    try {
        return crypto.generateKeyPairSync('x25519');
    } catch (e) {
        return null;
    }
}
function exportPublicKeyRaw(publicKey) {
    try {
        return publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
    } catch (e) {
        return null;
    }
}
function importPublicKeyRaw(b64) {
    try {
        const der = Buffer.from(b64, 'base64');
        return crypto.createPublicKey({ key: der, format: 'der', type: 'spki' });
    } catch (e) {
        return null;
    }
}
function deriveSessionKey(privateKey, peerPublicKey, bindingHex) {
    try {
        const shared = crypto.diffieHellman({ privateKey, publicKey: peerPublicKey });
        const binding = Buffer.from(bindingHex || '', 'hex');
        const okm = crypto.hkdfSync('sha256', shared, binding, Buffer.from('adestio-wire-session'), 32);
        return Buffer.from(okm).toString('hex');
    } catch (e) {
        return null;
    }
}
function setSession(ws, keyHex) {
    try {
        if (!ws || !keyHex) return false;
        _sessions.set(ws, { key: keyHex, createdAt: Date.now() });
        return true;
    } catch (e) {
        return false;
    }
}
function getSession(ws) {
    try {
        if (!ws) return null;
        const entry = _sessions.get(ws);
        return entry ? entry.key : null;
    } catch (e) {
        return null;
    }
}
function clearSession(ws) {
    try {
        _sessions.delete(ws);
        return true;
    } catch (e) {
        return false;
    }
}
module.exports = { generateEphemeralKeyPair, exportPublicKeyRaw, importPublicKeyRaw, deriveSessionKey, setSession, getSession, clearSession };
