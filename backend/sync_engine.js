'use strict';
// Thin compatibility facade — implementation is in backend/p2p/ and backend/dag/
const p2p = require('./p2p/index');
const { sweep } = require('./dag/sync/anti_entropy');
const { syncWithPeer } = require('./dag/sync/sync_coordinator');

function getSyncState()  { return p2p.getSyncState(); }
async function triggerFullResync(ip, port) { return p2p.triggerFullResync(ip, port); }
async function antiEntropySweep() { return sweep(); }
async function startSyncEngine() {}
async function triggerEventDrivenPush() {}
async function triggerLegacyPush() {}

module.exports = {
    startSyncEngine,
    triggerEventDrivenPush,
    triggerLegacyPush,
    triggerFullResync,
    antiEntropySweep,
    getSyncState,
    syncWithPeer
};
