const { getDB, saveDB, getNetworkCodeHash, getNodeId } = require('./db');
const { getDetailedNodes, markPeerIncompatible, PROTOCOL_VERSION, PORT } = require('./sync');
const { applyBlock, getBlocksSince, getCurrentTips, fullChainResync, topologicalSort, SYNC_TABLES } = require('./blockchain');

let antiEntropyTimer = null;
let watchdogTimer = null;
let currentSyncState = 'Sincronizzato';
const pendingBlockQueue = [];
let isProcessingQueue = false;
let lastSuccessfulSyncAt = Date.now();
let consecutiveFailures = 0;
const MAX_CONSECUTIVE_FAILURES = 3;
const WATCHDOG_INTERVAL_MS = 30000;
const ANTI_ENTROPY_INTERVAL_MS = 15000;

// Per-peer backoff: ip -> { failures: number, nextRetryAt: number }
const peerBackoff = new Map();
const MAX_PEER_BACKOFF_MS = 5 * 60 * 1000; // 5 minuti massimo

function isPeerOnCooldown(ip) {
    const entry = peerBackoff.get(ip);
    if (!entry) return false;
    return Date.now() < entry.nextRetryAt;
}

function recordPeerSuccess(ip) {
    peerBackoff.delete(ip);
    try {
        const { getDetailedNodes } = require('./sync');
        const nodes = getDetailedNodes();
        const node = nodes.find(n => n.ip === ip);
        if (node) {
            const { addNodeToMemory } = require('./sync');
            // Aggiorna last_seen e resetta il flag cache
            addNodeToMemory(node.name, ip, node.port, node.pingMs || 0, node.protocolVersion || 0, node.nodeId);
            const activePeers = require('./sync').activePeers;
            if (activePeers && activePeers[ip]) {
                activePeers[ip]._fromCache = false;
                activePeers[ip]._successDelta = (activePeers[ip]._successDelta || 0) + 1;
            }
        }
    } catch(_) {}
}

function recordPeerFailure(ip) {
    const entry = peerBackoff.get(ip) || { failures: 0, nextRetryAt: 0 };
    entry.failures++;
    // Backoff esponenziale: 15s, 30s, 60s, 120s, 300s (max)
    const backoffMs = Math.min(15000 * Math.pow(2, entry.failures - 1), MAX_PEER_BACKOFF_MS);
    entry.nextRetryAt = Date.now() + backoffMs;
    peerBackoff.set(ip, entry);
    try {
        const activePeers = require('./sync').activePeers;
        if (activePeers && activePeers[ip]) {
            activePeers[ip]._failureDelta = (activePeers[ip]._failureDelta || 0) + 1;
        }
    } catch(_) {}
}

function getSyncState() {
    return currentSyncState;
}

function setSyncState(state) {
    try {
        currentSyncState = state;
        try {
            const { BrowserWindow } = require('electron');
            const wins = BrowserWindow.getAllWindows();
            if (wins.length > 0 && !wins[0].isDestroyed()) {
                wins[0].webContents.send('sync-state-changed', { state });
            }
        } catch (_) {}
    } catch (e) {
        console.error('[SyncEngine] setSyncState error:', e);
    }
}

function getNodeIdByIp(ip) {
    try {
        const { getDetailedNodes } = require('./sync');
        const node = getDetailedNodes().find(n => n.ip === ip);
        return node ? node.nodeId : null;
    } catch(e) { return null; }
}

async function performHandshake(targetIp, targetPort, networkCodeHash) {
    try {
        const { connectToPeer, sendWsRequest } = require('./ws_rpc');
        const ws = await connectToPeer(targetIp, targetPort, getNodeIdByIp(targetIp));

        const myNodeId = getNodeId();
        let myTips = ['GENESIS'];
        try { myTips = getCurrentTips(require('./db').getDB('ledger')); } catch(_) {}

        const response = await sendWsRequest(ws, 'handshake', {
            nodeId: myNodeId,
            protocolVersion: PROTOCOL_VERSION,
            appVersion: (() => { try { const { app } = require('electron'); return app.getVersion(); } catch(_) { return '0.0.0'; } })(),
            dagTips: myTips,
            networkCodeHash
        }, 5000);

        if (response && response.nodeId) {
            const { registerSocket } = require('./ws_rpc');
            registerSocket(response.nodeId, ws);
        }

        return response;
    } catch (e) {
        console.error(`[SyncEngine] performHandshake error:`, e.message);
        return null;
    }
}

async function exchangeBlocksFromPeer(targetIp, targetPort, networkCodeHash, myTips) {
    try {
        const { connectToPeer, sendWsRequest } = require('./ws_rpc');
        const ws = await connectToPeer(targetIp, targetPort, getNodeIdByIp(targetIp));

        const response = await sendWsRequest(ws, 'blocks_pull', {
            knownTips: myTips
        }, 20000);

        return response;
    } catch (e) {
        return null;
    }
}

async function syncWithPeer(peerIp, peerPort) {
    try {
        const networkCodeHash = await getNetworkCodeHash();
        if (!networkCodeHash) return false;

        setSyncState('Handshake in corso...');

        const handshakeResult = await performHandshake(peerIp, peerPort, networkCodeHash);

        if (!handshakeResult) {
            consecutiveFailures++;
            recordPeerFailure(peerIp);
            setSyncState(consecutiveFailures >= MAX_CONSECUTIVE_FAILURES ? 'Rete non raggiungibile' : 'Sincronizzato');
            return false;
        }

        if (!handshakeResult.compatible) {
            console.log(`[SyncEngine] Nodo ${peerIp} incompatibile (HARD_FORK v${handshakeResult.minimumVersion}). Isolato.`);
            markPeerIncompatible(peerIp);
            setSyncState('Versione protocollo incompatibile');

            try {
                const { BrowserWindow } = require('electron');
                const wins = BrowserWindow.getAllWindows();
                if (wins.length > 0) {
                    wins.forEach(w => {
                        if (!w.isDestroyed()) {
                            w.webContents.send('network-version-mismatch', {
                                peerIp,
                                requiredVersion: handshakeResult.minimumVersion || '?'
                            });
                        }
                    });
                }
            } catch (_) {}
            return false;
        }

        try {
            if (handshakeResult.nodeId) {
                const { getDetailedNodes, addNodeToMemory } = require('./sync');
                const nodes = getDetailedNodes();
                const nodeData = nodes.find(n => n.ip === peerIp);
                if (nodeData) {
                    addNodeToMemory(nodeData.name, peerIp, peerPort, nodeData.pingMs, handshakeResult.protocolVersion, handshakeResult.nodeId);
                }
            }
        } catch(_) {}

        consecutiveFailures = 0;
        setSyncState('Scambio blocchi DAG...');

        let myTips = ['GENESIS'];
        try { myTips = getCurrentTips(require('./db').getDB('ledger')); } catch(_) {}

        const peerTips = handshakeResult.dagTips || [];

        const blocksFromPeer = await exchangeBlocksFromPeer(peerIp, peerPort, networkCodeHash, myTips);

        let appliedCount = 0;
        if (blocksFromPeer && Array.isArray(blocksFromPeer.blocks) && blocksFromPeer.blocks.length > 0) {
            const sorted = topologicalSort(blocksFromPeer.blocks);
            for (const block of sorted) {
                try {
                    const success = applyBlock(block);
                    if (success) appliedCount++;
                } catch (blockErr) {
                    console.error(`[SyncEngine] applyBlock error (${block.block_id}):`, blockErr.message);
                }
            }
            if (appliedCount > 0) {
                console.log(`[SyncEngine] Applicati ${appliedCount}/${blocksFromPeer.blocks.length} blocchi da ${peerIp}`);
            }
        }

        const myNewBlocks = getBlocksSince(peerTips);
        if (myNewBlocks.length > 0) {
            try {
                const { sendWsRequest, connectToPeer } = require('./ws_rpc');
                const ws = await connectToPeer(peerIp, peerPort, getNodeIdByIp(peerIp));
                await sendWsRequest(ws, 'blocks_push', { blocks: myNewBlocks }, 20000);
            } catch (e) {
                console.error(`[SyncEngine] antiEntropySweep push error per ${peerIp}:`, e.message);
            }
        }
        
        lastSuccessfulSyncAt = Date.now();
        recordPeerSuccess(peerIp);
        setSyncState('Sincronizzato');

        try {
            const { getPexNodes, addNodeToMemory } = require('./sync');
            const myNodes = getPexNodes();
            const { sendWsRequest, connectToPeer } = require('./ws_rpc');
            const ws = await connectToPeer(peerIp, peerPort, getNodeIdByIp(peerIp));
            const pexRes = await sendWsRequest(ws, 'pex_exchange', { peers: myNodes }, 10000);
            
            if (pexRes && Array.isArray(pexRes.peers)) {
                for (const p of pexRes.peers) {
                    if (p && typeof p.ip === 'string' && p.ip !== '127.0.0.1') {
                        const ipParts = p.ip.split('.');
                        if (ipParts.length === 4) {
                            addNodeToMemory(p.name || 'Adestio Node PEX', p.ip, p.port || 34567, 0, p.protocolVersion || 0, p.nodeId);
                        }
                    }
                }
            }
        } catch(e) {
            // Errori nel PEX non invalidano la sync
            console.warn(`[SyncEngine] PEX error con ${peerIp}:`, e.message);
        }

        return true;
    } catch (e) {
        consecutiveFailures++;
        recordPeerFailure(peerIp);
        console.error(`[SyncEngine] syncWithPeer error (${peerIp}):`, e.message);
        setSyncState('Errore di Sincronizzazione');
        return false;
    }
}

async function antiEntropySweep() {
    try {
        const allNodes = getDetailedNodes().filter(n => n.ip !== '127.0.0.1');

        // Ordina: prima i nodi Online e non in cooldown, poi quelli in cache
        const sortedNodes = allNodes.sort((a, b) => {
            const aOnCooldown = isPeerOnCooldown(a.ip);
            const bOnCooldown = isPeerOnCooldown(b.ip);
            if (aOnCooldown !== bOnCooldown) return aOnCooldown ? 1 : -1;
            if (a.status === 'Online' && b.status !== 'Online') return -1;
            if (b.status === 'Online' && a.status !== 'Online') return 1;
            return (b.lastSeen || 0) - (a.lastSeen || 0);
        });

        let syncedWithAny = false;

        for (const node of sortedNodes) {
            try {
                if (isPeerOnCooldown(node.ip)) continue;
                const success = await syncWithPeer(node.ip, node.port || PORT);
                if (success) syncedWithAny = true;
            } catch (e) {
                console.error(`[SyncEngine] antiEntropySweep error per ${node.ip}:`, e.message);
            }
        }

        if (allNodes.length === 0) {
            setSyncState('Sincronizzato');
        }

        return syncedWithAny;
    } catch (e) {
        console.error('[SyncEngine] antiEntropySweep error:', e);
        return false;
    }
}

async function watchdog() {
    try {
        const activeNodes = getDetailedNodes().filter(n => n.ip !== '127.0.0.1');
        if (activeNodes.length === 0) {
            consecutiveFailures = 0;
            setSyncState('Sincronizzato');
            return;
        }

        const timeSinceLastSync = Date.now() - lastSuccessfulSyncAt;
        const isStale = timeSinceLastSync > ANTI_ENTROPY_INTERVAL_MS * 2;

        if (isStale || consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
            console.log(`[SyncEngine] Watchdog: rilevata possibile desincronizzazione (stale=${isStale}, failures=${consecutiveFailures}). Forzando resync...`);
            setSyncState('Riconnessione in corso...');
            consecutiveFailures = 0;

            try {
                const { scanForNodes } = require('./sync');
                await scanForNodes(null);
            } catch (_) {}

            await antiEntropySweep();

            if (currentSyncState !== 'Sincronizzato') {
                const freshNodes = getDetailedNodes().filter(n => n.ip !== '127.0.0.1');
                for (const node of freshNodes) {
                    try {
                        const networkCodeHash = await getNetworkCodeHash();
                        if (!networkCodeHash) continue;
                        const success = await fullChainResync(node.ip, node.port || PORT, networkCodeHash);
                        if (success) {
                            setSyncState('Sincronizzato');
                            console.log(`[SyncEngine] Full chain resync completato da ${node.ip}`);
                            break;
                        }
                    } catch (e) {
                        console.error(`[SyncEngine] Watchdog fullChainResync error per ${node.ip}:`, e.message);
                    }
                }
            }
        }
    } catch (e) {
        console.error('[SyncEngine] watchdog error:', e);
    }
}

async function processBlockQueue() {
    try {
        if (isProcessingQueue) return;
        if (pendingBlockQueue.length === 0) return;
        isProcessingQueue = true;

        while (pendingBlockQueue.length > 0) {
            try {
                pendingBlockQueue.shift();
                await antiEntropySweep();
            } catch (e) {
                console.error('[SyncEngine] processBlockQueue item error:', e.message);
            }
        }
    } catch (e) {
        console.error('[SyncEngine] processBlockQueue error:', e);
    } finally {
        isProcessingQueue = false;
    }
}

function triggerEventDrivenPush(block) {
    try {
        if (!block) return;
        pendingBlockQueue.push({ block });
        setImmediate(() => processBlockQueue().catch(e => console.error('[SyncEngine] triggerEventDrivenPush async error:', e)));
    } catch (e) {
        console.error('[SyncEngine] triggerEventDrivenPush error:', e);
    }
}

function triggerLegacyPush(tableName, rows) {
    try {
        setTimeout(() => antiEntropySweep().catch(() => {}), 200);
    } catch (e) {
        console.error('[SyncEngine] triggerLegacyPush error:', e);
    }
}

async function triggerFullResync(peerIp, peerPort) {
    try {
        const networkCodeHash = await getNetworkCodeHash();
        if (!networkCodeHash) return false;
        setSyncState('Full Resync in corso...');
        
        if (peerIp && peerPort) {
            const success = await fullChainResync(peerIp, peerPort, networkCodeHash);
            setSyncState(success ? 'Sincronizzato' : 'Errore Full Resync');
            return success;
        } else {
            const { getDetailedNodes } = require('./sync');
            const nodes = getDetailedNodes().filter(n => n.ip !== '127.0.0.1');
            if (nodes.length === 0) {
                setSyncState('Sincronizzato');
                return true;
            }
            let anySuccess = false;
            for (const node of nodes) {
                try {
                    const success = await fullChainResync(node.ip, node.port || PORT, networkCodeHash);
                    if (success) {
                        anySuccess = true;
                        break;
                    }
                } catch (e) {
                    console.error(`[SyncEngine] fullChainResync error su ${node.ip}:`, e);
                }
            }
            setSyncState(anySuccess ? 'Sincronizzato' : 'Errore Full Resync');
            return anySuccess;
        }
    } catch (e) {
        console.error('[SyncEngine] triggerFullResync error:', e);
        setSyncState('Errore Full Resync');
        return false;
    }
}

function startSyncEngine() {
    try {
        if (antiEntropyTimer) clearInterval(antiEntropyTimer);
        if (watchdogTimer) clearInterval(watchdogTimer);

        lastSuccessfulSyncAt = Date.now();
        consecutiveFailures = 0;

        try {
            const { applyPendingBlocks } = require('./blockchain');
            const recovered = applyPendingBlocks();
            if (recovered > 0) console.log(`[SyncEngine] Recuperati ${recovered} blocchi pendenti al riavvio.`);
        } catch (_) {}

        antiEntropyTimer = setInterval(() => {
            antiEntropySweep().catch(e => console.error('[SyncEngine] antiEntropyTimer error:', e));
        }, ANTI_ENTROPY_INTERVAL_MS);

        watchdogTimer = setInterval(() => {
            watchdog().catch(e => console.error('[SyncEngine] watchdogTimer error:', e));
        }, WATCHDOG_INTERVAL_MS);

        // Sync rapida: prova subito i peer noti dalla cache (prima del discovery completo)
        setTimeout(async () => {
            try {
                const { getDetailedNodes } = require('./sync');
                const cachedPeers = getDetailedNodes().filter(n => n.ip !== '127.0.0.1' && n.status !== 'Online');
                if (cachedPeers.length > 0) {
                    console.log(`[SyncEngine] Tentativo connessione rapida a ${cachedPeers.length} peer dalla cache...`);
                    for (const peer of cachedPeers.slice(0, 5)) {
                        await syncWithPeer(peer.ip, peer.port || PORT).catch(() => {});
                    }
                }
            } catch (_) {}
        }, 2000);

        setTimeout(() => antiEntropySweep().catch(() => {}), 8000);

        console.log('[SyncEngine] Motore di sincronizzazione blockchain V2 avviato (watchdog attivo, backoff intelligente).');
    } catch (e) {
        console.error('[SyncEngine] startSyncEngine error:', e);
    }
}

module.exports = {
    startSyncEngine,
    triggerEventDrivenPush,
    triggerLegacyPush,
    triggerFullResync,
    antiEntropySweep,
    getSyncState,
    syncWithPeer
};
