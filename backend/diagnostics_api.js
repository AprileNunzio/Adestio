const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const { getDB, saveDB } = require('./db');
const { getAllBlocks, getCurrentTips, rebuildStateFromLog } = require('./blockchain');

function getLogDir() {
    try {
        const dir = path.join(app.getPath('documents'), 'NunzioTech', 'Adestio', 'Log');
        return dir;
    } catch(e) {
        return null;
    }
}

function startDiagnosticsServer(port = 34568) {
    const diagApp = express();
    diagApp.use(cors());
    diagApp.use(express.json());

    // 1. Logs
    diagApp.get('/api/diagnostics/logs', (req, res) => {
        try {
            const dir = getLogDir();
            if (!dir) return res.json({ error: 'Log dir not found' });
            const date = new Date().toISOString().split('T')[0];
            const errorFile = path.join(dir, `error_log_${date}.txt`);
            const sysFile = path.join(dir, `system_log_${date}.txt`);
            const syncFile = path.join(dir, `sync_audit_${date}.txt`);
            
            const readLog = (f) => fs.existsSync(f) ? fs.readFileSync(f, 'utf8').split('\n').slice(-500).join('\n') : '';
            
            res.json({
                error_log: readLog(errorFile),
                system_log: readLog(sysFile),
                sync_audit: readLog(syncFile)
            });
        } catch(e) {
            res.status(500).json({ error: e.message });
        }
    });

    // 2. State & active nodes
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
            res.status(500).json({ error: e.message });
        }
    });

    // 3. Blocks in Ledger
    diagApp.get('/api/diagnostics/blocks', (req, res) => {
        try {
            const blocks = getAllBlocks();
            res.json({ count: blocks.length, blocks });
        } catch(e) {
            res.status(500).json({ error: e.message });
        }
    });

    // 4. Raw Database View (Users)
    diagApp.get('/api/diagnostics/users', (req, res) => {
        try {
            const authDb = getDB('auth');
            const users = authDb.exec("SELECT * FROM users");
            res.json(users.length ? users[0] : []);
        } catch(e) {
            res.status(500).json({ error: e.message });
        }
    });

    // 5. Force Restart Networking
    diagApp.post('/api/diagnostics/restart', (req, res) => {
        try {
            const { app } = require('electron');
            app.relaunch();
            app.exit(0);
        } catch(e) {
            res.status(500).json({ error: e.message });
        }
    });

    // 6. Force Full Sync with specific IP
    diagApp.post('/api/diagnostics/force-sync', async (req, res) => {
        try {
            const { ip } = req.body;
            if (!ip) return res.status(400).json({ error: 'IP required' });
            const { triggerFullResync } = require('./sync_engine');
            const result = await triggerFullResync(ip, 34567);
            res.json({ success: true, result });
        } catch(e) {
            res.status(500).json({ error: e.message });
        }
    });

    // 7. Check for Updates
    diagApp.post('/api/diagnostics/check-updates', async (req, res) => {
        try {
            const { autoUpdater } = require('electron-updater');
            const result = await autoUpdater.checkForUpdates();
            res.json({ success: true, version: result.updateInfo.version });
        } catch(e) {
            res.status(500).json({ error: e.message });
        }
    });

    // 8. Rebuild State from Event Log
    diagApp.post('/api/diagnostics/rebuild-state', (req, res) => {
        try {
            rebuildStateFromLog();
            saveDB('auth');
            res.json({ success: true });
        } catch(e) {
            res.status(500).json({ error: e.message });
        }
    });

    diagApp.listen(port, '0.0.0.0', () => {
        console.log(`[Diagnostics] Sidecar API in ascolto sulla porta ${port}`);
    }).on('error', (err) => {
        console.error(`[Diagnostics] Impossibile avviare il server sulla porta ${port}:`, err.message);
    });
}

module.exports = { startDiagnosticsServer };
