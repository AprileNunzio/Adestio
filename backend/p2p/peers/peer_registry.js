'use strict';
const { PeerFSM, STATES } = require('./peer_fsm');
const bus = require('../../core/event_bus');
const { PORT } = require('../protocol/constants');
const _peers = new Map();
bus.subscribe('peer:discovered', ({ ip, name, port, nodeId, protocolVersion, pingMs }) => {
    if (!ip || ip === '127.0.0.1') return;
    if (!_peers.has(ip)) {
        const fsm = new PeerFSM(ip);
        fsm.transition(STATES.DISCOVERED);
        _peers.set(ip, { fsm, meta: { name: name || 'Adestio Node', port: port || PORT, nodeId: nodeId || null, protocolVersion: protocolVersion || 0, pingMs: pingMs || 0, lastSeen: Date.now() } });
    } else {
        const p = _peers.get(ip);
        if (name) p.meta.name = name;
        if (port) p.meta.port = port;
        if (nodeId) p.meta.nodeId = nodeId;
        if (protocolVersion) p.meta.protocolVersion = protocolVersion;
        p.meta.lastSeen = Date.now();
    }
});
function getAllPeers() {
    return Array.from(_peers.entries()).map(([ip, { fsm, meta }]) => ({ ip, state: fsm.state, since: fsm.since, ...meta }));
}
function getPeer(ip) {
    const p = _peers.get(ip);
    return p ? { ip, state: p.fsm.state, ...p.meta } : null;
}
function getPeerFSM(ip) { return _peers.get(ip)?.fsm || null; }
function updatePeerMeta(ip, updates) {
    const p = _peers.get(ip);
    if (p) Object.assign(p.meta, updates, { lastSeen: Date.now() });
}
function removePeer(ip) { _peers.delete(ip); }
function markPeerIncompatible(ip) {
    const fsm = getPeerFSM(ip);
    if (fsm) fsm.transition(STATES.DISCONNECTED);
    removePeer(ip);
}
function getPexPeers() {
    const now = Date.now();
    return getAllPeers()
        .filter(p => p.state === STATES.SYNCED && now - p.lastSeen < 45000)
        .map(({ ip, name, port, nodeId, protocolVersion }) => ({ ip, name, port, nodeId, protocolVersion }));
}
function getDetailedPeers() {
    const now = Date.now();
    return getAllPeers().map(p => ({
        ...p,
        status: p.state === STATES.SYNCED && now - p.lastSeen < 45000 ? 'Online'
              : p.state === STATES.DISCONNECTED ? 'Offline'
              : p.state
    }));
}
function loadFromCache(cachedPeers) {
    const { getLocalIPs } = require('../discovery/arp_scanner');
    const myIPs = new Set(getLocalIPs());
    for (const p of cachedPeers) {
        if (myIPs.has(p.ip) || _peers.has(p.ip)) continue;
        const fsm = new PeerFSM(p.ip);
        fsm.transition(STATES.DISCOVERED);
        _peers.set(p.ip, { fsm, meta: { ...p, lastSeen: p.lastSeen || 0 } });
    }
}
module.exports = { getAllPeers, getPeer, getPeerFSM, updatePeerMeta, removePeer, markPeerIncompatible, getPexPeers, getDetailedPeers, loadFromCache, STATES };
