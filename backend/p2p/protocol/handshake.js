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
    if (response && response.compatible === false) {
        try {
            let ip = ws._socket.remoteAddress;
            if (ip && ip.includes('::ffff:')) ip = ip.split('::ffff:')[1];
            const { BrowserWindow } = require('electron');
            const win = BrowserWindow.getAllWindows()[0];
            if (win) win.webContents.send('network-version-mismatch', { peerIp: ip, minimumVersion: response.minimumVersion });
        } catch (_) {}
        return response;
    }
    if (response && response.nodeId) {
        pool.registerSocket(response.nodeId, ws);
        if (response.appVersion) {
            try {
                const { app } = require('electron');
                const updatesManager = require('../../updates_manager');
                if (updatesManager.compareVersions(response.appVersion, app.getVersion()) > 0) {
                    let ip = ws._socket.remoteAddress;
                    if (ip && ip.includes('::ffff:')) ip = ip.split('::ffff:')[1];
                    if (ip && ip !== '127.0.0.1') {
                        require('../../core/updaterService').maybeAdoptLanUpdate(response.appVersion, ip, 34567);
                    }
                }
            } catch(e) {}
        }
    }
    return response;
}
module.exports = { performHandshake };
