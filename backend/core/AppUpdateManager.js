'use strict';

const { BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const AdmZip = require('adm-zip');

const STATES = {
    IDLE: 'idle',
    CHECKING: 'checking',
    PENDING: 'pending',
    DOWNLOADING: 'downloading',
    INSTALLING: 'installing',
    DONE: 'done',
    ERROR: 'error'
};

const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000;
const INITIAL_DELAY_MS = 15000;
const MAX_RETRIES = 3;
const RETRY_BASE_MS = 5000;

class AppUpdateManager {
    constructor() {
        this._locked = new Map();
        this._queue = [];
        this._processing = false;
        this._intervalId = null;
        this._status = {
            lastCheck: null,
            state: STATES.IDLE,
            queue: []
        };
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
            return [STATES.DOWNLOADING, STATES.INSTALLING].includes(entry.state);
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
        } catch (e) {
            console.error('[UpdateManager] startBackgroundCheck error:', e.message);
        }
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

            const toUpdate = result.data.filter(u => !this.isLocked(u.appId));
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
            console.error('[UpdateManager] _runCheck error:', e.message);
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
                    console.error('[UpdateManager] _processQueue item error:', e.message);
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
            console.error('[UpdateManager] _processQueue error:', e.message);
            this._processing = false;
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

            const { app } = require('electron');
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
            const zip = new AdmZip(zipBuffer);

            if (!fs.existsSync(appDir)) fs.mkdirSync(appDir, { recursive: true });
            zip.extractAllTo(appDir, true);

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
            } catch (reloadErr) {
                console.warn('[UpdateManager] App reload warning:', reloadErr.message);
            }

            try {
                // Un aggiornamento in background puo' introdurre permessi nuovi: sincronizzali
                // subito, senza aspettare che un admin apra manualmente Sistema RBAC.
                require('../handlers/rbac').syncPermissionsFromManifests();
            } catch (rbacErr) {
                console.warn('[UpdateManager] RBAC sync warning:', rbacErr.message);
            }

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
            console.error(`[UpdateManager] _updateApp error for ${item.appId} (attempt ${attempt}):`, e.message);
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
        } catch (e) {
            console.error('[UpdateManager] forceCheckNow error:', e.message);
        }
    }

    // Consente ad operazioni manuali (install/update dallo Store) di condividere
    // lo stesso lock/stato/broadcast usato dalla coda di aggiornamento in background,
    // cosi' da evitare che due processi tocchino la stessa app in contemporanea.
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
