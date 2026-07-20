'use strict';
const { WebSocketServer } = require('ws');
let _wss = null;
function attachToServer(httpServer) {
    if (_wss) return _wss;
    try {
        const { handleIncomingMessage } = require('../protocol/rpc');
        const { awaitKeyExchange } = require('../protocol/key_exchange');
        const handlers = require('../protocol/handlers');
        _wss = new WebSocketServer({ server: httpServer, path: '/p2p' });
        _wss.on('connection', (ws) => {
            (async () => {
                try {
                    await awaitKeyExchange(ws);
                    ws.on('message', (msg) => handleIncomingMessage(ws, msg, handlers));
                } catch (e) {
                    try { ws.terminate(); } catch (_) {}
                }
            })();
        });
        console.log('[WsServer] WebSocket attivo su /p2p');
        return _wss;
    } catch (e) {
        console.error('[WsServer] attachToServer error:', e.message);
        return null;
    }
}
function getServer() { return _wss; }
module.exports = { attachToServer, getServer };
