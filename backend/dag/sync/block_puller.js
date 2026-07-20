'use strict';
const { connectToPeer } = require('../../p2p/transport/ws_client');
const { sendRequest } = require('../../p2p/protocol/rpc');
const { getCurrentTips } = require('../graph/dag_tips');
async function pullFrom(ip, port, peerNodeId) {
    const db = require('../../db').getDB('ledger');
    const myTips = getCurrentTips(db);
    const ws = await connectToPeer(ip, port, peerNodeId);
    return sendRequest(ws, 'blocks_pull', { knownTips: myTips }, 20000);
}
module.exports = { pullFrom };
