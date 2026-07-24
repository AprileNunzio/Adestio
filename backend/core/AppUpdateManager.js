'use strict';

const { BrowserWindow, app } = require('electron');
const path = require('path');
const fs = require('fs');
const AdmZip = require('adm-zip');
const cryptoVerifier = require('../security/cryptoVerifier');
const auditLogger = require('../observability/auditLogger');

const STATES = {
    IDLE: 'idle',
    CHECKING: 'checking',
    PENDING: 'pending',
    DOWNLOADING: 'downloading',
    INSTALLING: 'installing',
    ROLLING_BACK: 'rolling_back',
    DONE: 'done',
    ERROR: 'error'
};

const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000;
const INITIAL_DELAY_MS = 15000;
const MAX_RETRIES = 3;
const RETRY_BASE_MS = 5000;

class AppUpdateManager {
    constructor() {
        try {
            this._locked = new Map();
            this._queue = [];
            this._processing = false;
            this._intervalId = null;
            this._status = {
                lastCheck: null,
                state: STATES.IDLE,
                queue: []
            };
        } catch (e) {}
    }

    _broadcast(event, payload) {
        try {
            const windows = BrowserWindow.getAllWindows();
            windows.forEach(win => {
                try {
                    if (!win.isDestroyed()) {
                        win.webContents.send(event, payload);
                    }
                } catch (e) {}
            });
        } catch (e) {}
    }

    _setLock(appId, state, meta = {}) {
        try {
            this._locked.set(appId, { state, ...meta, ts: Date.now() });
            this._updateQueueStatus();
            this._broadcast('store:app-update-event', {
                appId,
                state,
                ...meta,
                ts: Date.now()
            });
        } catch (e) {}
    }

    _clearLock(appId) {
        try {
            this._locked.delete(appId);
            this._updateQueueStatus();
        } catch (e) {}
    }

    isLocked(appId) {
        try {
            const entry = this._locked.get(appId);
            if (!entry) return false;
            return [STATES.DOWNLOADING, STATES.INSTALLING, STATES.ROLLING_BACK].includes(entry.state);
        } catch (e) {
            return false;
        }
    }

    getAppState(appId) {
        try {
            return this._locked.get(appId) || { state: STATES.IDLE };
        } catch (e) {
            return { state: STATES.IDLE };
        }
    }

    getQueueStatus() {
        try {
            return {
                ...this._status,
                queue: Array.from(this._locked.entries()).map(([appId, info]) => ({
                    appId,
                    ...info
                }))
            };
        } catch (e) {
            return { state: STATES.IDLE, queue: [] };
        }
    }

    _updateQueueStatus() {
        try {
            this._status.queue = Array.from(this._locked.entries()).map(([appId, info]) => ({
                appId,
                ...info
            }));
            this._broadcast('store:update-queue-changed', this.getQueueStatus());
        } catch (e) {}
    }

    async startBackgroundCheck() {
        try {
            if (this._intervalId) return;
            setTimeout(() => {
                try { this._runCheck(); } catch (e) {}
            }, INITIAL_DELAY_MS);

            this._intervalId = setInterval(() => {
                try { this._runCheck(); } catch (e) {}
            }, CHECK_INTERVAL_MS);
        } catch (e) {}
    }

    async _runCheck() {
        try {
            if (this._status.state === STATES.CHECKING) return;
            this._status.state = STATES.CHECKING;
            this._status.lastCheck = Date.now();
            this._broadcast('store:update-queue-changed', this.getQueueStatus());

            const storeHandlers = require('../handlers/store');
            const result = await storeHandlers.checkUpdates();

            if (!result || !result.success || !Array.isArray(result.data) || result.data.length === 0) {
                this._status.state = STATES.IDLE;
                this._broadcast('store:update-queue-changed', this.getQueueStatus());
                return;
            }

            const toUpdate = result.data.filter(u => !this.isLocked(u.appId) && u.currentVersion && u.availableVersion && u.currentVersion !== u.availableVersion);
            toUpdate.forEach(u => {
                try {
                    const alreadyQueued = this._queue.find(q => q.appId === u.appId);
                    if (!alreadyQueued) {
                        this._queue.push(u);
                        this._setLock(u.appId, STATES.PENDING, {
                            currentVersion: u.currentVersion,
                            availableVersion: u.availableVersion
                        });
                    }
                } catch (e) {}
            });

            this._status.state = STATES.IDLE;
            this._processQueue();
        } catch (e) {
            this._status.state = STATES.IDLE;
        }
    }

    async _processQueue() {
        try {
            if (this._processing || this._queue.length === 0) return;
            this._processing = true;

            while (this._queue.length > 0) {
                const item = this._queue.shift();
                try {
                    await this._updateApp(item);
                } catch (e) {
                    this._setLock(item.appId, STATES.ERROR, {
                        error: e.message,
                        currentVersion: item.currentVersion,
                        availableVersion: item.availableVersion
                    });
                    setTimeout(() => { try { this._clearLock(item.appId); } catch (e2) {} }, 10000);
                }
            }
            this._processing = false;
        } catch (e) {
            this._processing = false;
        }
    }

    async _safeExtractZip(zip, destDir) {
        try {
            const entries = zip.getEntries();
            for (const entry of entries) {
                const targetPath = path.join(destDir, entry.entryName);
                const relative = path.relative(destDir, targetPath);
                if (relative.startsWith('..') || path.isAbsolute(relative)) {
                    throw new Error(`Tentativo di Zip Slip rilevato: ${entry.entryName}`);
                }
            }
            await new Promise((resolve, reject) => {
                try {
                    zip.extractAllToAsync(destDir, true, true, (err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                } catch (eZip) {
                    reject(eZip);
                }
            });
            return true;
        } catch (e) {
            throw e;
        }
    }

    async _backupAppFolder(appDir, appId) {
        try {
            if (!fs.existsSync(appDir)) return null;
            const backupsDir = path.join(app.getPath('userData'), 'app_backups', appId, String(Date.now()));
            await fs.promises.mkdir(backupsDir, { recursive: true });
            await fs.promises.cp(appDir, backupsDir, { recursive: true });
            return backupsDir;
        } catch (e) {
            return null;
        }
    }

    async rollbackApp(appId) {
        try {
            this._setLock(appId, STATES.ROLLING_BACK);
            const userAppsPath = path.join(app.getPath('userData'), 'installed_apps');
            const appDir = path.join(userAppsPath, appId);
            const backupsBase = path.join(app.getPath('userData'), 'app_backups', appId);
            
            if (!fs.existsSync(backupsBase)) {
                throw new Error('Nessun backup trovato per il rollback');
            }

            const backups = fs.readdirSync(backupsBase).sort().reverse();
            if (backups.length === 0) {
                throw new Error('Nessun backup disponibile');
            }

            const latestBackup = path.join(backupsBase, backups[0]);
            
            if (fs.existsSync(appDir)) {
                fs.rmSync(appDir, { recursive: true, force: true });
            }

            fs.mkdirSync(appDir, { recursive: true });
            const copyDirRecursive = (src, dest) => {
                try {
                    const files = fs.readdirSync(src);
                    for (const file of files) {
                        const srcFile = path.join(src, file);
                        const destFile = path.join(dest, file);
                        const stat = fs.statSync(srcFile);
                        if (stat.isDirectory()) {
                            fs.mkdirSync(destFile, { recursive: true });
                            copyDirRecursive(srcFile, destFile);
                        } else {
                            fs.copyFileSync(srcFile, destFile);
                        }
                    }
                } catch (eCopy) {}
            };
            copyDirRecursive(latestBackup, appDir);

            const AppLoader = require('./AppLoader');
            AppLoader.unloadApp(appId);
            const manifests = require('./appsRegistry');
            const allApps = await manifests.getAppsRegistry();
            const manifest = allApps.find(m => m.id === appId || m.folder === appId);
            if (manifest) await AppLoader.loadApp(manifest);

            auditLogger.logEvent('system', 'APP_ROLLBACK', 'app', appId, { backupUsed: backups[0] });
            this._setLock(appId, STATES.DONE, { rollback: true });
            setTimeout(() => { try { this._clearLock(appId); } catch (e) {} }, 5000);
            return { success: true };
        } catch (e) {
            this._setLock(appId, STATES.ERROR, { error: e.message });
            setTimeout(() => { try { this._clearLock(appId); } catch (e2) {} }, 5000);
            return { success: false, error: e.message };
        }
    }

    async _updateApp(item, attempt = 1) {
        try {
            const { appId, availableVersion, currentVersion } = item;

            this._setLock(appId, STATES.DOWNLOADING, {
                currentVersion,
                availableVersion,
                attempt
            });

            const storeHandlers = require('../handlers/store');
            const availableRes = await storeHandlers.getAvailable();
            if (!availableRes || !availableRes.success) {
                throw new Error('Impossibile recuperare lista app disponibili');
            }

            const targetApp = availableRes.data.find(a => a.id === appId);
            if (!targetApp) throw new Error(`App ${appId} non trovata nel marketplace`);
            if (!targetApp.downloadUrl) throw new Error(`URL download assente per ${appId}`);

            const currentCoreVersion = app.getVersion();
            if (targetApp.minCoreVersion && currentCoreVersion < targetApp.minCoreVersion) {
                throw new Error(`Incompatibile: richiede Adestio Core >= ${targetApp.minCoreVersion}`);
            }

            const userAppsPath = path.join(app.getPath('userData'), 'installed_apps');
            const appDir = path.join(userAppsPath, targetApp.folder || appId);

            const bust = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
            const noCache = {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            };

            const response = await fetch(`${targetApp.downloadUrl}?t=${bust}`, { headers: noCache });
            if (!response.ok) throw new Error(`Download HTTP fallito: ${response.status} ${response.statusText}`);

            this._setLock(appId, STATES.INSTALLING, {
                currentVersion,
                availableVersion
            });

            const arrayBuffer = await response.arrayBuffer();
            const zipBuffer = Buffer.from(arrayBuffer);

            if (targetApp.signature) {
                const isValidSig = cryptoVerifier.verifyBufferSignature(zipBuffer, targetApp.signature);
                if (!isValidSig) {
                    throw new Error('Firma crittografica del pacchetto non valida! Download bloccato.');
                }
            }

            const zip = new AdmZip(zipBuffer);

            await this._backupAppFolder(appDir, appId);

            if (!fs.existsSync(appDir)) await fs.promises.mkdir(appDir, { recursive: true });
            await this._safeExtractZip(zip, appDir);

            const { getDB, saveDB } = require('../db');
            const db = getDB('store');
            if (db) {
                const existing = db.query('SELECT * FROM installed_apps WHERE app_id = ?', [appId]);
                if (existing && existing.length > 0) {
                    db.run('UPDATE installed_apps SET version = ? WHERE app_id = ?', [availableVersion, appId]);
                } else {
                    db.run(
                        "INSERT INTO installed_apps (app_id, version, installed_at, status) VALUES (?, ?, ?, 'active')",
                        [appId, availableVersion, Math.floor(Date.now() / 1000)]
                    );
                }
                await saveDB('store');
            }

            const AppLoader = require('./AppLoader');
            try {
                AppLoader.unloadApp(appId);
                const manifests = require('./appsRegistry');
                const allApps = await manifests.getAppsRegistry();
                const manifest = allApps.find(m => m.id === appId || m.folder === appId);
                if (manifest) await AppLoader.loadApp(manifest);
            } catch (reloadErr) {}

            try {
                require('../handlers/rbac').syncPermissionsFromManifests();
            } catch (rbacErr) {}

            auditLogger.logEvent('system', 'APP_UPDATE', 'app', appId, { previousVersion: currentVersion, newVersion: availableVersion });

            this._setLock(appId, STATES.DONE, {
                currentVersion,
                installedVersion: availableVersion
            });

            this._broadcast('store:app-updated', {
                appId,
                previousVersion: currentVersion,
                newVersion: availableVersion
            });

            setTimeout(() => { try { this._clearLock(appId); } catch (e) {} }, 5000);
        } catch (e) {
            if (attempt < MAX_RETRIES) {
                const backoff = RETRY_BASE_MS * Math.pow(2, attempt - 1);
                this._setLock(item.appId, STATES.PENDING, {
                    currentVersion: item.currentVersion,
                    availableVersion: item.availableVersion,
                    retryIn: backoff,
                    attempt
                });
                await new Promise(resolve => setTimeout(resolve, backoff));
                await this._updateApp(item, attempt + 1);
            } else {
                throw e;
            }
        }
    }

    forceCheckNow() {
        try {
            this._runCheck();
        } catch (e) {}
    }

    beginManualOperation(appId, state, meta = {}) {
        try {
            this._setLock(appId, state, meta);
        } catch (e) {}
    }

    endManualOperation(appId, opts = {}) {
        try {
            if (opts.finalState) {
                this._setLock(appId, opts.finalState, opts.meta || {});
            }
            if (opts.notifyUpdated) {
                this._broadcast('store:app-updated', {
                    appId,
                    previousVersion: opts.previousVersion,
                    newVersion: opts.newVersion
                });
            }
            const clearDelayMs = typeof opts.clearDelayMs === 'number' ? opts.clearDelayMs : 0;
            if (clearDelayMs > 0) {
                setTimeout(() => { try { this._clearLock(appId); } catch (e2) {} }, clearDelayMs);
            } else {
                this._clearLock(appId);
            }
        } catch (e) {}
    }
}

const instance = new AppUpdateManager();
module.exports = instance;
