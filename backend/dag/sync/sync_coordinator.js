'use strict';
const { connectToPeer } = require('../../p2p/transport/ws_client');
const { performHandshake } = require('../../p2p/protocol/handshake');
const { pullFrom } = require('./block_puller');
const { pushTo } = require('./block_pusher');
const { applyBlock } = require('../application/block_applier');
const { topologicalSort } = require('../graph/dag_traversal');
const { exchangePeers } = require('../../p2p/protocol/pex');
const { getPexPeers, getPeerFSM, updatePeerMeta, markPeerIncompatible, STATES } = require('../../p2p/peers/peer_registry');
const { isAllowed, onSuccess: cbSuccess, onFailure: cbFailure } = require('../../p2p/resilience/circuit_breaker');
const { recordFailure, recordSuccess } = require('../../p2p/resilience/backoff');
const { recordSuccess: statSuccess, recordFailure: statFailure } = require('../../p2p/peers/peer_stats');
const { getCurrentTips } = require('../graph/dag_tips');
const bus = require('../../core/event_bus');
const _inFlight = new Set();
function _setState(state) {
    bus.publish('sync:state', { state });
    try {
        const { BrowserWindow } = require('electron');
        BrowserWindow.getAllWindows().forEach(w => { if (!w.isDestroyed()) w.webContents.send('sync-state-changed', { state }); });
    } catch (_) {}
}
async function syncWithPeer(ip, port) {
    if (!ip) return false;
    if (!isAllowed(ip)) return false;
    if (_inFlight.has(ip)) return false;
    _inFlight.add(ip);
    const fsm = getPeerFSM(ip);
    try {
        if (fsm) fsm.transition(STATES.CONNECTING);
        const t0 = Date.now();
        let appVersion = '0.0.0';
        try { appVersion = require('electron').app.getVersion(); } catch (_) {}
        const db = require('../../db').getDB('ledger');
        const myTips = getCurrentTips(db);
        if (fsm) fsm.transition(STATES.HANDSHAKING);
        _setState('Handshake in corso...');
        const ws = await connectToPeer(ip, port, null);
        const handshake = await performHandshake(ws, appVersion, myTips);
        if (!handshake) {
            if (fsm) fsm.transition(STATES.DEGRADED);
            _fail(ip); _setState('Errore di Sincronizzazione');
            return false;
        }
        if (!handshake.compatible) {
            console.warn(`[SyncCoordinator] ${ip}: incompatibile (HARD_FORK v${handshake.minimumVersion})`);
            markPeerIncompatible(ip);
            bus.publish('peer:incompatible', { ip, minimumVersion: handshake.minimumVersion });
            _setState('Versione protocollo incompatibile');
            return false;
        }
        if (handshake.nodeId) updatePeerMeta(ip, { nodeId: handshake.nodeId, protocolVersion: handshake.protocolVersion });
        if (fsm) fsm.transition(STATES.SYNCED);
        _setState('Scambio blocchi DAG...');
        try {
            const { sendRequest } = require('../../p2p/protocol/rpc');
            const kp = require('../../security/node_keypair');
            const { getNodeId } = require('../../core/node_identity');
            const keyRes = await sendRequest(ws, 'key_announce', { nodeId: getNodeId(), publicKey: kp.getPublicKeyPem() }, 10000).catch(() => null);
            if (keyRes && keyRes.nodeId && keyRes.publicKey) require('../block/block_signer').learnKey(keyRes.nodeId, keyRes.publicKey);
        } catch (_) {}
        const pullResult = await pullFrom(ip, port, handshake.nodeId).catch(() => null);
        let applied = 0;
        if (pullResult && Array.isArray(pullResult.blocks) && pullResult.blocks.length > 0) {
            applied = require('../application/block_ingest').ingestMany(pullResult.blocks).applied;
        }
        await pushTo(ip, port, handshake.nodeId, handshake.dagTips || []).catch(() => {});
        try { require('../../p2p/peers/reputation').recordSuccess(handshake.nodeId, Date.now() - t0); } catch (_) {}
        await exchangePeers(ws, getPexPeers()).catch(() => {});
        const latency = Date.now() - t0;
        statSuccess(ip, latency);
        cbSuccess(ip);
        recordSuccess(ip);
        _setState('Sincronizzato');
        bus.publish('peer:synced', { ip, applied, latency });
        return true;
    } catch (e) {
        if (e.message && (
            e.message.includes('DB_NOT_INITIALIZED') || 
            e.message.includes('Wire encryption unavailable') ||
            e.message.includes('ECONNREFUSED') ||
            e.message.includes('Timeout') ||
            e.message.includes('EHOSTUNREACH') ||
            e.message.includes('EHOSTDOWN')
        )) {
            if (!e.message.includes('DB_NOT_INITIALIZED')) {
                console.warn(`[SyncCoordinator] Nodo ${ip} irraggiungibile: ${e.message}`);
            }
            return false; 
        }
        if (fsm) fsm.transition(STATES.DEGRADED);
        _fail(ip); _setState('Errore di Sincronizzazione');
        bus.publish('sync.error', { ip, message: e.message });
        console.error(`[SyncCoordinator] syncWithPeer ${ip}:`, e.message);
        return false;
    } finally {
        _inFlight.delete(ip);
    }
}
async function fullResync(ip, port) {
    if (!ip) return false;
    try {
        const ws = await connectToPeer(ip, port, null);
        const { sendRequest } = require('../../p2p/protocol/rpc');
        _setState('Full Resync in corso...');
        const data = await sendRequest(ws, 'full_resync', {}, 30000);
        if (!data || !Array.isArray(data.blocks)) return false;
        require('../application/block_ingest').ingestMany(data.blocks);
        _setState('Sincronizzato');
        return true;
    } catch (e) {
        console.error(`[SyncCoordinator] fullResync ${ip}:`, e.message);
        _setState('Errore Full Resync');
        return false;
    }
}
function _fail(ip) {
    statFailure(ip);
    cbFailure(ip);
    recordFailure(ip);
}
module.exports = { syncWithPeer, fullResync };
