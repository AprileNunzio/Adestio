'use strict';
const { WebSocketServer } = require('ws');
let _wss = null;
function attachToServer(httpServer) {
    if (_wss) return _wss;
    const { handleIncomingMessage } = require('../protocol/rpc');
    const handlers = require('../protocol/handlers');
    _wss = new WebSocketServer({ server: httpServer, path: '/p2p' });
    _wss.on('connection', (ws) => {
        ws.on('message', (msg) => handleIncomingMessage(ws, msg, handlers));
    });
    console.log('[WsServer] WebSocket attivo su /p2p');
    return _wss;
}
function getServer() { return _wss; }
module.exports = { attachToServer, getServer };
