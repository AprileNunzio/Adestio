'use strict';
const bus = require('../../core/event_bus');
const { sendRequest } = require('./rpc');

async function exchangePeers(ws, myPeers) {
    const response = await sendRequest(ws, 'pex_exchange', { peers: myPeers }, 10000);
    if (response && Array.isArray(response.peers)) {
        for (const p of response.peers) {
            if (p && typeof p.ip === 'string' && p.ip !== '127.0.0.1' && p.ip.split('.').length === 4) {
                bus.publish('peer:discovered', { ...p, source: 'pex' });
            }
        }
    }
    return response;
}

module.exports = { exchangePeers };
