'use strict';
const { getNodeId, getNetworkName } = require('../../core/node_identity');
const { getNetworkCodeHash } = require('../../db');
const { PROTOCOL_VERSION } = require('./constants');
const pool = require('../transport/connection_pool');
const { sendRequest } = require('./rpc');

async function performHandshake(ws, appVersion, dagTips) {
    const networkCodeHash = await getNetworkCodeHash();
    const response = await sendRequest(ws, 'handshake', {
        nodeId: getNodeId(),
        protocolVersion: PROTOCOL_VERSION,
        appVersion: appVersion || '0.0.0',
        dagTips: dagTips || ['GENESIS'],
        networkCodeHash
    }, 15000);

    if (response && response.nodeId) {
        pool.registerSocket(response.nodeId, ws);
    }
    return response;
}

module.exports = { performHandshake };
