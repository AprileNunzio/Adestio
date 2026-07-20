'use strict';
const { connectToPeer } = require('../../p2p/transport/ws_client');
const { sendRequest } = require('../../p2p/protocol/rpc');
const { getBlocksSince } = require('../graph/dag_store');
async function pushTo(ip, port, peerNodeId, peerTips) {
    const blocks = getBlocksSince(peerTips);
    if (blocks.length === 0) return { pushed: 0 };
    const ws = await connectToPeer(ip, port, peerNodeId);
    await sendRequest(ws, 'blocks_push', { blocks }, 20000);
    return { pushed: blocks.length };
}
module.exports = { pushTo };
