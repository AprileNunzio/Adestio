'use strict';
const { PeerFSM, STATES } = require('./peer_fsm');
const bus = require('../../core/event_bus');
const { PORT } = require('../protocol/constants');
const _peers = new Map();
bus.subscribe('peer:discovered', ({ ip, name, port, nodeId, protocolVersion, pingMs, updateReadyVersion }) => {
    if (!ip || ip === '127.0.0.1') return;
    if (!_peers.has(ip)) {
        const fsm = new PeerFSM(ip);
        fsm.transition(STATES.DISCOVERED);
        _peers.set(ip, { fsm, meta: { name: name || 'Adestio Node', port: port || PORT, nodeId: nodeId || null, protocolVersion: protocolVersion || 0, pingMs: pingMs || 0, updateReadyVersion: updateReadyVersion || null, lastSeen: Date.now() } });
    } else {
        const p = _peers.get(ip);
        if (name) p.meta.name = name;
        if (port) p.meta.port = port;
        if (nodeId) p.meta.nodeId = nodeId;
        if (protocolVersion) p.meta.protocolVersion = protocolVersion;
        p.meta.updateReadyVersion = updateReadyVersion || null;
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
    const { PEER_HEARTBEAT_TTL_MS } = require('../protocol/constants');
    const now = Date.now();
    return getAllPeers()
        .filter(p => p.state === STATES.SYNCED && now - p.lastSeen < PEER_HEARTBEAT_TTL_MS)
        .map(({ ip, name, port, nodeId, protocolVersion }) => ({ ip, name, port, nodeId, protocolVersion }));
}
setInterval(() => {
    const { PEER_EXPIRY_MS } = require('../protocol/constants');
    const now = Date.now();
    for (const [ip, p] of _peers.entries()) {
        if (now - p.meta.lastSeen > PEER_EXPIRY_MS) {
            _peers.delete(ip);
        }
    }
}, 30000);
function getDetailedPeers() {
    try {
        const { getNodeId } = require('../../core/node_identity');
        const { PEER_HEARTBEAT_TTL_MS, PEER_EXPIRY_MS } = require('../protocol/constants');
        const myNodeId = getNodeId();
        const now = Date.now();
        return getAllPeers()
            .filter(p => p.ip !== '127.0.0.1' && (!myNodeId || p.nodeId !== myNodeId))
            .filter(p => now - p.lastSeen <= PEER_EXPIRY_MS)
            .map(p => {
                try {
                    const isRecentlySeen = (now - p.lastSeen < PEER_HEARTBEAT_TTL_MS);
                    let status = 'Offline';
                    if (isRecentlySeen) {
                        if (p.state === STATES.DISCONNECTED) {
                            status = 'Offline';
                        } else {
                            status = 'Online';
                        }
                    }
                    return {
                        ...p,
                        status
                    };
                } catch (_) {
                    return { ...p, status: 'Online' };
                }
            });
    } catch (e) {
        return [];
    }
}
function loadFromCache(cachedPeers) {
    const { getLocalIPs } = require('../discovery/arp_scanner');
    const { getNodeId } = require('../../core/node_identity');
    const myIPs = new Set(getLocalIPs());
    const myNodeId = getNodeId();
    for (const p of cachedPeers) {
        if (p.ip === '127.0.0.1' || myIPs.has(p.ip) || _peers.has(p.ip)) continue;
        if (myNodeId && p.nodeId === myNodeId) continue;
        const fsm = new PeerFSM(p.ip);
        fsm.transition(STATES.DISCOVERED);
        _peers.set(p.ip, { fsm, meta: { ...p, lastSeen: p.lastSeen || 0 } });
    }
}
module.exports = { getAllPeers, getPeer, getPeerFSM, updatePeerMeta, removePeer, markPeerIncompatible, getPexPeers, getDetailedPeers, loadFromCache, STATES };
