'use strict';
const express = require('express');
const SENSITIVE_FIELDS = ['password', 'passkey', 'pin'];
function _redact(payload) {
    if (!payload || typeof payload !== 'object') return payload;
    const clone = { ...payload };
    for (const f of SENSITIVE_FIELDS) delete clone[f];
    return clone;
}
function _requireNetworkCode(req, res, next) {
    const provided = req.headers['x-network-code'];
    if (!provided) return res.status(401).json({ error: 'Unauthorized' });
    const { hashNetworkCode, getNetworkCodeHash } = require('./db');
    getNetworkCodeHash().then(stored => {
        if (!stored || hashNetworkCode(provided) !== stored) return res.status(401).json({ error: 'Unauthorized' });
        next();
    }).catch(() => res.status(401).json({ error: 'Unauthorized' }));
}
function createRouter() {
    const router = express.Router();
    router.use(_requireNetworkCode);
    router.get('/state', (req, res) => {
        try {
            const { getDetailedNodes, getSyncState } = require('./p2p/index');
            const { getCurrentTips } = require('./dag/graph/dag_tips');
            const db = require('./db').getDB('ledger');
            res.json({
                syncState: getSyncState(),
                peers: getDetailedNodes().map(p => ({ ip: p.ip, port: p.port, state: p.state, status: p.status, lastSeen: p.lastSeen })),
                tips: getCurrentTips(db)
            });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    router.get('/users', (req, res) => {
        try {
            const db = require('./db').getDB('auth');
            const rows = db.query('SELECT id, username, nome, cognome, email, is_superadmin, last_login FROM users WHERE is_deleted = 0');
            res.json({ users: rows });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    router.get('/version', (req, res) => {
        try {
            const { app: electronApp } = require('electron');
            const { PROTOCOL_VERSION } = require('./p2p/protocol/constants');
            const updatesManager = require('./updates_manager');
            res.json({
                appVersion: electronApp.getVersion(),
                protocolVersion: PROTOCOL_VERSION,
                highestLocalInstaller: updatesManager.getHighestLocalVersion()
            });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    router.post('/scan', (req, res) => {
        try {
            const { runDiscovery } = require('./p2p/discovery/discovery_coordinator');
            runDiscovery().catch(() => {});
            res.json({ started: true });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    router.post('/sync', async (req, res) => {
        try {
            const { ip, port } = req.body || {};
            if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(ip || '')) return res.status(400).json({ error: 'Invalid ip' });
            const { syncWithPeer } = require('./dag/sync/sync_coordinator');
            const ok = await syncWithPeer(ip, port || 34567);
            res.json({ success: ok });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    router.post('/manual-peer', async (req, res) => {
        try {
            const { ip, port } = req.body || {};
            if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(ip || '')) return res.status(400).json({ error: 'Invalid ip format' });
            
            const pPort = parseInt(port) || 34567;
            const bus = require('./core/event_bus');
            
            // 1. Forziamo la registrazione nel Peer Registry emettendo l'evento di discovery
            bus.publish('peer:discovered', { 
                ip, 
                name: 'Nodo Manuale', 
                port: pPort, 
                source: 'manual' 
            });
            
            // 2. Lanciamo un sync immediato per verificare e attivare il PEX
            const { syncWithPeer } = require('./dag/sync/sync_coordinator');
            const ok = await syncWithPeer(ip, pPort);
            
            res.json({ success: true, synced: ok, message: ok ? 'Connesso e Sincronizzato' : 'Aggiunto alla coda, tentativo di connessione in background' });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    router.post('/ensure-firewall', (req, res) => {
        try {
            const { ensureFirewallRules } = require('./p2p/firewall/windows_firewall');
            ensureFirewallRules();
            res.json({ started: true });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    router.post('/check-update', async (req, res) => {
        try {
            const { autoUpdater } = require('electron-updater');
            const result = await autoUpdater.checkForUpdatesAndNotify();
            res.json({ started: true, updateInfo: result && result.updateInfo ? { version: result.updateInfo.version } : null });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    router.get('/blocks', (req, res) => {
        try {
            const { getAllBlocks } = require('./dag/graph/dag_store');
            const blocks = getAllBlocks().map(b => ({
                block_id: b.block_id,
                event_type: b.event_type,
                table_name: b.table_name,
                record_id: b.record_id,
                node_id: b.node_id,
                created_at: b.created_at,
                payload: _redact(b.payload)
            }));
            res.json({ count: blocks.length, blocks });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    return router;
}
module.exports = { createRouter };
