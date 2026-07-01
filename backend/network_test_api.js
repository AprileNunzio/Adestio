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
