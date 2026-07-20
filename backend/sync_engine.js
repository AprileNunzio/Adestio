'use strict';
const p2p = require('./p2p/index');
const { sweep } = require('./dag/sync/anti_entropy');
const { syncWithPeer } = require('./dag/sync/sync_coordinator');
const { getAll } = require('./p2p/transport/connection_pool');
const { broadcastToAll } = require('./p2p/protocol/rpc');
function getSyncState()  { return p2p.getSyncState(); }
async function triggerFullResync(ip, port) { return p2p.triggerFullResync(ip, port); }
async function antiEntropySweep() { return sweep(); }
async function startSyncEngine() {}
async function triggerEventDrivenPush(block) {
    if (!block) return;
    broadcastToAll(getAll(), 'blocks_push', { blocks: [block] });
}
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
