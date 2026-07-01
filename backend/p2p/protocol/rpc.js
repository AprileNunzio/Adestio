'use strict';
const crypto = require('crypto');
const WebSocket = require('ws');
const { encode, decode } = require('./message_codec');
const { encrypt, decrypt } = require('./wire_crypto');
const _pending = new Map();
function sendRequest(ws, type, payload = {}, timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
        if (ws.readyState !== WebSocket.OPEN) return reject(new Error(`WebSocket not open [${type}]`));
        const id = crypto.randomUUID();
        const encrypted = encrypt(encode({ id, type, payload }));
        if (!encrypted) return reject(new Error(`Wire encryption unavailable [${type}]`));
        const timer = setTimeout(() => { _pending.delete(id); reject(new Error(`Timeout WS [${type}]`)); }, timeoutMs);
        _pending.set(id, { resolve, reject, timer });
        ws.send(encrypted);
    });
}
function handleIncomingMessage(ws, rawMsg, handlers) {
    try {
        const buffer = Buffer.isBuffer(rawMsg) ? rawMsg : Buffer.from(String(rawMsg));
        const decrypted = decrypt(buffer);
        if (!decrypted) {
            console.error('[RPC] Messaggio scartato: chiave di rete non corrispondente o traffico non valido');
            return;
        }
        const data = decode(decrypted);
        if (data.isResponse && data.id) {
            const pending = _pending.get(data.id);
            if (pending) {
                clearTimeout(pending.timer);
                _pending.delete(data.id);
                data.error ? pending.reject(new Error(data.error)) : pending.resolve(data.payload);
            }
            return;
        }
        if (data.type && data.id) {
            const respond = (payload, error = null) => {
                try {
                    if (ws.readyState !== WebSocket.OPEN) return;
                    const encrypted = encrypt(encode({ id: data.id, isResponse: true, payload, error }));
                    if (encrypted) ws.send(encrypted);
                } catch (_) {}
            };
            const handler = handlers[data.type];
            if (handler) {
                Promise.resolve(handler(data.payload, ws)).then(res => respond(res)).catch(err => respond(null, err.message || 'Internal Error'));
            } else {
                respond(null, 'Unknown request type: ' + data.type);
            }
        }
    } catch (e) {
        console.error('[RPC] Message error:', e.message);
    }
}
function broadcastToAll(socketMap, type, payload = {}) {
    for (const ws of socketMap.values()) {
        if (ws.readyState === WebSocket.OPEN) sendRequest(ws, type, payload).catch(() => {});
    }
}
module.exports = { sendRequest, handleIncomingMessage, broadcastToAll };
