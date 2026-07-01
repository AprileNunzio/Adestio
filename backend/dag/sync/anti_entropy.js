'use strict';
const { getDetailedPeers } = require('../../p2p/peers/peer_registry');
const { isOnCooldown } = require('../../p2p/resilience/backoff');
const { syncWithPeer } = require('./sync_coordinator');
const { PORT } = require('../../p2p/protocol/constants');
const bus = require('../../core/event_bus');
const ANTI_ENTROPY_INTERVAL_MS = 15000;
let _timer = null;
async function sweep() {
    const peers = getDetailedPeers()
        .filter(p => p.ip !== '127.0.0.1' && !isOnCooldown(p.ip))
        .sort((a, b) => {
            if (a.status === 'Online' && b.status !== 'Online') return -1;
            if (b.status === 'Online' && a.status !== 'Online') return 1;
            return (b.lastSeen || 0) - (a.lastSeen || 0);
        });
    let syncedAny = false;
    for (const peer of peers) {
        const ok = await syncWithPeer(peer.ip, peer.port || PORT).catch(() => false);
        if (ok) syncedAny = true;
    }
    if (peers.length === 0) bus.publish('sync:state', { state: 'Sincronizzato' });
    return syncedAny;
}
function start() {
    if (_timer) return;
    setTimeout(() => sweep().catch(() => {}), 8000);
    _timer = setInterval(() => sweep().catch(e => console.error('[AntiEntropy]', e.message)), ANTI_ENTROPY_INTERVAL_MS);
}
function stop() { if (_timer) { clearInterval(_timer); _timer = null; } }
module.exports = { sweep, start, stop };
