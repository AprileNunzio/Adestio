'use strict';
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const { getDB, saveDB } = require('./db');
const { getAllBlocks, getCurrentTips, rebuildStateFromLog } = require('./blockchain');
const { requireAuth } = require('./diagnostics_auth');
const SAFE_USER_COLUMNS = ['id', 'username', 'email', 'nome', 'cognome', 'is_superadmin', 'last_login', 'last_modified', 'is_deleted', 'must_change_password'];
function getLogDir() {
    try {
        return path.join(app.getPath('userData'), 'Log');
    } catch(e) {
        return null;
    }
}
function startDiagnosticsServer(port = 34568) {
    const diagApp = express();
    diagApp.use(cors({ origin: false }));
    diagApp.use(express.json());
    diagApp.use(requireAuth);
    diagApp.get('/api/diagnostics/logs', (req, res) => {
        try {
            const dir = getLogDir();
            if (!dir) return res.json({ error: 'Log dir not found' });
            const date = new Date().toISOString().split('T')[0];
            const readLog = (f) => fs.existsSync(f) ? fs.readFileSync(f, 'utf8').split('\n').slice(-500).join('\n') : '';
            res.json({
                error_log: readLog(path.join(dir, `error_log_${date}.txt`)),
                system_log: readLog(path.join(dir, `system_log_${date}.txt`)),
                sync_audit: readLog(path.join(dir, `sync_audit_${date}.txt`))
            });
        } catch(e) {
            res.status(500).json({ error: 'Errore interno' });
        }
    });
    diagApp.get('/api/diagnostics/state', (req, res) => {
        try {
            const { getDetailedNodes } = require('./sync');
            const { getSyncState } = require('./sync_engine');
            const ledgerDb = getDB('ledger');
            res.json({
                nodes: getDetailedNodes(),
                syncState: getSyncState ? getSyncState() : 'Sconosciuto',
                tips: getCurrentTips(ledgerDb)
            });
        } catch(e) {
            res.status(500).json({ error: 'Errore interno' });
        }
    });
    diagApp.get('/api/diagnostics/blocks', (req, res) => {
        try {
            const blocks = getAllBlocks();
            res.json({ count: blocks.length, blocks });
        } catch(e) {
            res.status(500).json({ error: 'Errore interno' });
        }
    });
    diagApp.get('/api/diagnostics/users', (req, res) => {
        try {
            const authDb = getDB('auth');
            const rows = authDb.query(`SELECT ${SAFE_USER_COLUMNS.join(', ')} FROM users WHERE is_deleted = 0`);
            res.json(rows || []);
        } catch(e) {
            res.status(500).json({ error: 'Errore interno' });
        }
    });
    diagApp.post('/api/diagnostics/restart', (req, res) => {
        try {
            const { app: electronApp } = require('electron');
            electronApp.relaunch();
            electronApp.exit(0);
        } catch(e) {
            res.status(500).json({ error: 'Errore interno' });
        }
    });
    diagApp.post('/api/diagnostics/force-sync', async (req, res) => {
        try {
            const { ip } = req.body;
            if (!ip || !/^(\d{1,3}\.){3}\d{1,3}$/.test(ip)) return res.status(400).json({ error: 'IP non valido' });
            const { triggerFullResync } = require('./sync_engine');
            const result = await triggerFullResync(ip, 34567);
            res.json({ success: true, result });
        } catch(e) {
            res.status(500).json({ error: 'Errore interno' });
        }
    });
    diagApp.post('/api/diagnostics/check-updates', async (req, res) => {
        try {
            const { autoUpdater } = require('electron-updater');
            const result = await autoUpdater.checkForUpdates();
            res.json({ success: true, version: result.updateInfo.version });
        } catch(e) {
            res.status(500).json({ error: 'Errore interno' });
        }
    });
    diagApp.post('/api/diagnostics/rebuild-state', (req, res) => {
        try {
            rebuildStateFromLog();
            saveDB('auth');
            res.json({ success: true });
        } catch(e) {
            res.status(500).json({ error: 'Errore interno' });
        }
    });
    diagApp.listen(port, '127.0.0.1', () => {
        console.log(`[Diagnostics] Sidecar API in ascolto su 127.0.0.1:${port}`);
    }).on('error', (err) => {
        console.error(`[Diagnostics] Impossibile avviare il server sulla porta ${port}:`, err.message);
    });
}
module.exports = { startDiagnosticsServer };
