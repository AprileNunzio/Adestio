'use strict';
const WebSocket = require('ws');
const pool = require('./connection_pool');

function connectToPeer(ip, port, targetNodeId) {
    return new Promise((resolve, reject) => {
        if (targetNodeId) {
            const existing = pool.getSocket(targetNodeId);
            if (existing) return resolve(existing);
        }

        const wsUrl = `ws://${ip}:${port}/p2p`;
        const ws = new WebSocket(wsUrl);
        const timeout = setTimeout(() => { ws.terminate(); reject(new Error(`Timeout connecting to ${wsUrl}`)); }, 5000);

        ws.on('open', () => {
            clearTimeout(timeout);
            try {
                const { handleIncomingMessage } = require('../protocol/rpc');
                const handlers = require('../protocol/handlers');
                ws.on('message', (msg) => handleIncomingMessage(ws, msg, handlers));
            } catch (e) { console.error('[WsClient] handlers bind error:', e.message); }
            resolve(ws);
        });

        ws.on('error', (err) => { clearTimeout(timeout); reject(err); });
    });
}

module.exports = { connectToPeer };
