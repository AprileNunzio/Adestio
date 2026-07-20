'use strict';
const sessionCrypto = require('./session_crypto');
const wireCrypto = require('./wire_crypto');
const { encode, decode } = require('./message_codec');
const KEX_TIMEOUT_MS = 8000;
function _bindingHex() {
    try {
        return wireCrypto.getStaticKeyHex() || '';
    } catch (e) {
        return '';
    }
}
function _send(ws, payload) {
    try {
        const encrypted = wireCrypto.encrypt(encode(payload));
        if (!encrypted) throw new Error('Static key unavailable for key exchange');
        ws.send(encrypted);
        return true;
    } catch (e) {
        return false;
    }
}
function _decodeIncoming(raw) {
    try {
        const buffer = Buffer.isBuffer(raw) ? raw : Buffer.from(String(raw));
        const decrypted = wireCrypto.decrypt(buffer);
        if (!decrypted) return null;
        return decode(decrypted);
    } catch (e) {
        return null;
    }
}
function initiateKeyExchange(ws) {
    return new Promise((resolve, reject) => {
        try {
            let settled = false;
            const keyPair = sessionCrypto.generateEphemeralKeyPair();
            if (!keyPair) return reject(new Error('Unable to generate ephemeral keypair'));
            const timer = setTimeout(() => {
                if (settled) return;
                settled = true;
                ws.removeListener('message', onMessage);
                reject(new Error('Key exchange timeout'));
            }, KEX_TIMEOUT_MS);
            function onMessage(raw) {
                try {
                    const data = _decodeIncoming(raw);
                    if (!data || data.type !== 'kex_response' || settled) return;
                    const peerPub = sessionCrypto.importPublicKeyRaw(data.pub);
                    if (!peerPub) return;
                    const sessionKey = sessionCrypto.deriveSessionKey(keyPair.privateKey, peerPub, _bindingHex());
                    if (!sessionKey) return;
                    settled = true;
                    clearTimeout(timer);
                    ws.removeListener('message', onMessage);
                    sessionCrypto.setSession(ws, sessionKey);
                    resolve(true);
                } catch (e) {}
            }
            ws.on('message', onMessage);
            const pub = sessionCrypto.exportPublicKeyRaw(keyPair.publicKey);
            if (!pub || !_send(ws, { type: 'kex_init', pub })) {
                clearTimeout(timer);
                ws.removeListener('message', onMessage);
                settled = true;
                reject(new Error('Unable to send key exchange init'));
            }
        } catch (e) {
            reject(e);
        }
    });
}
function awaitKeyExchange(ws) {
    return new Promise((resolve, reject) => {
        try {
            let settled = false;
            const timer = setTimeout(() => {
                if (settled) return;
                settled = true;
                ws.removeListener('message', onMessage);
                reject(new Error('Key exchange timeout'));
            }, KEX_TIMEOUT_MS);
            function onMessage(raw) {
                try {
                    const data = _decodeIncoming(raw);
                    if (!data || data.type !== 'kex_init' || settled) return;
                    const keyPair = sessionCrypto.generateEphemeralKeyPair();
                    const peerPub = sessionCrypto.importPublicKeyRaw(data.pub);
                    if (!keyPair || !peerPub) return;
                    const sessionKey = sessionCrypto.deriveSessionKey(keyPair.privateKey, peerPub, _bindingHex());
                    if (!sessionKey) return;
                    settled = true;
                    clearTimeout(timer);
                    ws.removeListener('message', onMessage);
                    sessionCrypto.setSession(ws, sessionKey);
                    const pub = sessionCrypto.exportPublicKeyRaw(keyPair.publicKey);
                    _send(ws, { type: 'kex_response', pub });
                    resolve(true);
                } catch (e) {}
            }
            ws.on('message', onMessage);
        } catch (e) {
            reject(e);
        }
    });
}
module.exports = { initiateKeyExchange, awaitKeyExchange };
