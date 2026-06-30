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

function _setState(state) {
    bus.publish('sync:state', { state });
    try {
        const { BrowserWindow } = require('electron');
        BrowserWindow.getAllWindows().forEach(w => { if (!w.isDestroyed()) w.webContents.send('sync-state-changed', { state }); });
    } catch (_) {}
}

async function syncWithPeer(ip, port) {
    if (!isAllowed(ip)) return false;

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

        const pullResult = await pullFrom(ip, port, handshake.nodeId).catch(() => null);
        let applied = 0;
        if (pullResult && Array.isArray(pullResult.blocks) && pullResult.blocks.length > 0) {
            for (const block of topologicalSort(pullResult.blocks)) {
                if (applyBlock(block)) applied++;
            }
        }

        await pushTo(ip, port, handshake.nodeId, handshake.dagTips || []).catch(() => {});
        await exchangePeers(ws, getPexPeers()).catch(() => {});

        const latency = Date.now() - t0;
        statSuccess(ip, latency);
        cbSuccess(ip);
        recordSuccess(ip);
        _setState('Sincronizzato');
        bus.publish('peer:synced', { ip, applied, latency });
        return true;

    } catch (e) {
        if (fsm) fsm.transition(STATES.DEGRADED);
        _fail(ip); _setState('Errore di Sincronizzazione');
        console.error(`[SyncCoordinator] syncWithPeer ${ip}:`, e.message);
        return false;
    }
}

async function fullResync(ip, port) {
    try {
        const ws = await connectToPeer(ip, port, null);
        const { sendRequest } = require('../../p2p/protocol/rpc');
        _setState('Full Resync in corso...');
        const data = await sendRequest(ws, 'full_resync', {}, 30000);
        if (!data || !Array.isArray(data.blocks)) return false;
        for (const block of topologicalSort(data.blocks)) applyBlock(block);
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
