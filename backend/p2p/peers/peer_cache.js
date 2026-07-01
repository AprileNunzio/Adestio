'use strict';
const fs = require('fs');
const { PORT } = require('../protocol/constants');
let _cacheFile = null;
function _getCacheFile() {
    if (_cacheFile) return _cacheFile;
    try { _cacheFile = require('path').join(require('electron').app.getPath('userData'), 'peer_cache.json'); } catch (_) {}
    return _cacheFile;
}
function savePeers(peers) {
    try {
        const file = _getCacheFile();
        if (file) {
            const data = {};
            for (const p of peers) {
                if (p.ip !== '127.0.0.1') data[p.ip] = { port: p.port || PORT, name: p.name, nodeId: p.nodeId, protocolVersion: p.protocolVersion, lastSeen: p.lastSeen };
            }
            fs.writeFileSync(file, JSON.stringify(data, null, 2));
        }
    } catch (_) {}
    try {
        const db = require('../../db').getDB('config');
        for (const p of peers) {
            if (p.ip === '127.0.0.1') continue;
            db.run(`INSERT INTO known_peers (ip, port, name, node_id, protocol_version, last_seen, success_count, failure_count)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(ip) DO UPDATE SET port=excluded.port, name=excluded.name,
                    node_id=COALESCE(excluded.node_id, known_peers.node_id),
                    protocol_version=excluded.protocol_version, last_seen=excluded.last_seen,
                    success_count=known_peers.success_count+excluded.success_count,
                    failure_count=known_peers.failure_count+excluded.failure_count`,
                [p.ip, p.port || PORT, p.name || 'Adestio Node', p.nodeId || null, p.protocolVersion || 0, p.lastSeen || Date.now(), 0, 0]);
        }
        require('../../db').saveDB('config');
    } catch (e) {
        if (!e.message?.includes('DB_NOT_INITIALIZED')) console.error('[PeerCache] DB error:', e.message);
    }
}
function loadPeers() {
    try {
        const db = require('../../db').getDB('config');
        const rows = db.query('SELECT ip, port, name, node_id, protocol_version, last_seen FROM known_peers ORDER BY last_seen DESC LIMIT 50');
        if (rows && rows.length > 0) {
            return rows.map(r => ({ ip: r.ip, port: r.port || PORT, name: r.name, nodeId: r.node_id, protocolVersion: r.protocol_version || 0, lastSeen: r.last_seen || 0 }));
        }
    } catch (e) {
        if (!e.message?.includes('DB_NOT_INITIALIZED')) console.error('[PeerCache] DB load error:', e.message);
    }
    try {
        const file = _getCacheFile();
        if (!file || !fs.existsSync(file)) return [];
        const cached = JSON.parse(fs.readFileSync(file, 'utf8'));
        return Object.entries(cached).map(([ip, d]) => ({ ip, port: d.port || PORT, name: d.name, nodeId: d.nodeId, protocolVersion: d.protocolVersion || 0, lastSeen: d.lastSeen || 0 }));
    } catch (_) { return []; }
}
module.exports = { savePeers, loadPeers };
