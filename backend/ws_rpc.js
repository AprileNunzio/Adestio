const WebSocket = require('ws');
const crypto = require('crypto');
const activeSockets = new Map(); 
const pendingRequests = new Map();
function getWsKey(nodeId) {
    return String(nodeId);
}
function registerSocket(nodeId, ws) {
    if (!nodeId) return;
    const key = getWsKey(nodeId);
    if (activeSockets.has(key)) {
        const oldWs = activeSockets.get(key);
        if (oldWs.readyState === WebSocket.OPEN) {
            oldWs.close();
        }
    }
    ws.on('close', () => {
        if (activeSockets.get(key) === ws) {
            activeSockets.delete(key);
        }
    });
    activeSockets.set(key, ws);
}
function getActiveSocket(nodeId) {
    if (!nodeId) return null;
    const key = getWsKey(nodeId);
    const ws = activeSockets.get(key);
    if (ws && ws.readyState === WebSocket.OPEN) {
        return ws;
    }
    return null;
}
function connectToPeer(ip, port, targetNodeId) {
    return new Promise((resolve, reject) => {
        if (targetNodeId) {
            const existing = getActiveSocket(targetNodeId);
            if (existing) return resolve(existing);
        }
        const wsUrl = `ws://${ip}:${port}/p2p`;
        const ws = new WebSocket(wsUrl);
        let timeout = setTimeout(() => {
            ws.close();
            reject(new Error('Timeout connettendo a ' + wsUrl));
        }, 5000);
        ws.on('open', () => {
            clearTimeout(timeout);
            try {
                const wsHandlers = require('./ws_handlers');
                ws.on('message', (msg) => handleIncomingMessage(ws, msg, wsHandlers));
            } catch (err) {
                console.error('[WSRPC] Errore bind handlers:', err);
            }
            resolve(ws);
        });
        ws.on('error', (err) => {
            clearTimeout(timeout);
            reject(err);
        });
    });
}
function sendWsRequest(ws, type, payload = {}, timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
        if (ws.readyState !== WebSocket.OPEN) {
            return reject(new Error('WebSocket is not open'));
        }
        const id = crypto.randomUUID();
        const reqPayload = {
            id,
            type,
            payload
        };
        const timer = setTimeout(() => {
            pendingRequests.delete(id);
            reject(new Error(`Timeout WS Request [${type}]`));
        }, timeoutMs);
        pendingRequests.set(id, { resolve, reject, timer });
        ws.send(JSON.stringify(reqPayload));
    });
}
function handleIncomingMessage(ws, messageStr, handlers) {
    try {
        let str = '';
        if (typeof messageStr === 'string') {
            str = messageStr;
        } else if (Buffer.isBuffer(messageStr)) {
            str = messageStr.toString('utf8');
        } else if (messageStr instanceof ArrayBuffer) {
            str = Buffer.from(messageStr).toString('utf8');
        } else if (Array.isArray(messageStr)) {
            str = Buffer.concat(messageStr).toString('utf8');
        } else {
            str = String(messageStr);
        }
        const data = JSON.parse(str);
        if (data.isResponse && data.id) {
            const pending = pendingRequests.get(data.id);
            if (pending) {
                clearTimeout(pending.timer);
                pendingRequests.delete(data.id);
                if (data.error) pending.reject(new Error(data.error));
                else pending.resolve(data.payload);
            }
            return;
        }
        if (data.type && data.id) {
            const respond = (payload, error = null) => {
                try {
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify({
                            id: data.id,
                            isResponse: true,
                            payload,
                            error
                        }));
                    }
                } catch(e) {
                    console.error('[WSRPC] respond error:', e);
                }
            };
            const handler = handlers[data.type];
            if (handler) {
                Promise.resolve(handler(data.payload, ws))
                    .then(res => respond(res))
                    .catch(err => respond(null, err.message || 'Internal Error'));
            } else {
                respond(null, 'Unknown request type');
            }
        }
    } catch (e) {
        console.error('[WSRPC] Error handling message:', e);
    }
}
function broadcastToAll(type, payload = {}) {
    for (const [key, ws] of activeSockets.entries()) {
        if (ws.readyState === WebSocket.OPEN) {
            sendWsRequest(ws, type, payload).catch(()=>{});
        }
    }
}
module.exports = {
    registerSocket,
    getActiveSocket,
    connectToPeer,
    sendWsRequest,
    handleIncomingMessage,
    broadcastToAll
};
