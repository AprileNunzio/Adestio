'use strict';
const { getBlocksSince } = require('./dag_store');
const { getCurrentTips } = require('./dag_tips');

function diffWithPeer(peerTips) {
    const db = require('../../db').getDB('ledger');
    const myTips = getCurrentTips(db);
    const blocksForPeer = getBlocksSince(peerTips);
    return { myTips, blocksForPeer };
}

module.exports = { diffWithPeer };
