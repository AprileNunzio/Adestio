'use strict';
const WebSocket = require('ws');
const pool = require('./connection_pool');
function connectToPeer(ip, port, targetNodeId) {
    return new Promise((resolve, reject) => {
        try {
            if (targetNodeId) {
                const existing = pool.getSocket(targetNodeId);
                if (existing) return resolve(existing);
            }
            const wsUrl = `ws://${ip}:${port}/p2p`;
            const ws = new WebSocket(wsUrl);
            const timeout = setTimeout(() => { try { ws.terminate(); } catch (e) {} reject(new Error(`Timeout connecting to ${wsUrl}`)); }, 5000);
            ws.on('open', () => {
                clearTimeout(timeout);
                (async () => {
                    try {
                        const { initiateKeyExchange } = require('../protocol/key_exchange');
                        await initiateKeyExchange(ws);
                        const { handleIncomingMessage } = require('../protocol/rpc');
                        const handlers = require('../protocol/handlers');
                        ws.on('message', (msg) => handleIncomingMessage(ws, msg, handlers));
                        resolve(ws);
                    } catch (e) {
                        try { ws.terminate(); } catch (_) {}
                        reject(e);
                    }
                })();
            });
            ws.on('error', (err) => { clearTimeout(timeout); reject(err); });
        } catch (e) {
            reject(e);
        }
    });
}
module.exports = { connectToPeer };
