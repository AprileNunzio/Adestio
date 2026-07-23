'use strict';

const path = require('path');
const fs = require('fs');
const AppDbManager = require('./AppDbManager');
const appProcessManager = require('./appProcessManager');

const _loaded = new Map();
const APPS_PATH = path.join(__dirname, '../../src/apps');

async function loadApp(manifest) {
    try {
        const appId = manifest.id;

        if (_loaded.has(appId)) {
            return true;
        }

        const appDir = manifest.appPath || path.join(APPS_PATH, manifest.folder || appId);

        if (manifest.db && manifest.db.namespace) {
            try {
                let migrations = [];
                if (manifest.db.migrations) {
                    const migrationsAbsPath = path.join(appDir, manifest.db.migrations.replace(/^\.\//, ''));
                    if (fs.existsSync(migrationsAbsPath)) {
                        migrations = require(migrationsAbsPath);
                    }
                }
                await AppDbManager.getOrCreate(manifest.db.namespace, migrations);
            } catch (dbErr) {
                console.error(`[AppLoader AppDbManager Error: ${appId}]`, dbErr);
            }
        }

        const backendPath = path.join(appDir, manifest.backend || 'backend.js');

        if (fs.existsSync(backendPath)) {
            try {
                const spawned = appProcessManager.spawnAppProcess(appId, manifest, appDir);
                if (spawned) {
                    _loaded.set(appId, { manifest: manifest, isProcess: true });
                } else {
                    throw new Error('Impossibile avviare il processo child');
                }
            } catch (backendErr) {
                console.error(`[AppLoader Process Spawn Error: ${appId}]`, backendErr);
                throw backendErr;
            }
        } else {
            _loaded.set(appId, { manifest: manifest, isProcess: false });
        }

        return true;
    } catch (e) {
        console.error('[AppLoader loadApp Error]', e);
        return false;
    }
}

async function unloadApp(appId) {
    try {
        if (!_loaded.has(appId)) return false;

        appProcessManager.terminateAppProcess(appId);
        _loaded.delete(appId);
        return true;
    } catch (e) {
        console.error(`[AppLoader unloadApp Error: ${appId}]`, e);
        return false;
    }
}

async function loadAllInstalledApps() {
    try {
        const { getAppsRegistry } = require('./appsRegistry');
        const { getDB, saveDB } = require('../db');
        const manifests = await getAppsRegistry();

        let db = null;
        let installedIds = new Set();
        try {
            db = getDB('store');
            const installedRows = db.query("SELECT app_id FROM installed_apps WHERE status = 'active'");
            installedIds = new Set(installedRows.map(r => r.app_id));
        } catch (e) {
            console.error('[AppLoader Read Store DB Error]', e);
        }

        let dbChanged = false;

        for (const m of manifests) {
            try {
                if (m.bundled && !installedIds.has(m.id) && db) {
                    db.run(
                        'INSERT INTO installed_apps (app_id, version, installed_at, installed_by, status) VALUES (?, ?, ?, ?, ?)',
                        [m.id, m.version || '0.0.0', Math.floor(Date.now() / 1000), 'system', 'active']
                    );
                    installedIds.add(m.id);
                    dbChanged = true;
                }
            } catch (seedErr) {
                console.error('[AppLoader Seeding Error]', seedErr);
            }
        }

        if (dbChanged) {
            try {
                await saveDB('store');
            } catch (saveErr) {
                console.error('[AppLoader saveDB Error]', saveErr);
            }
        }

        let loaded = 0;
        let considered = 0;

        for (const manifest of manifests) {
            try {
                if (manifest.core || installedIds.has(manifest.id)) {
                    considered++;
                    const ok = await loadApp(manifest);
                    if (ok) loaded++;
                }
            } catch (mErr) {
                console.error('[AppLoader Manifest Item Error]', mErr);
            }
        }

        return loaded;
    } catch (e) {
        console.error('[AppLoader loadAllInstalledApps Error]', e);
        return 0;
    }
}

function getLoaded() {
    try {
        return Array.from(_loaded.keys());
    } catch (e) {
        console.error('[AppLoader getLoaded Error]', e);
        return [];
    }
}

function isLoaded(appId) {
    try {
        return _loaded.has(appId);
    } catch (e) {
        console.error('[AppLoader isLoaded Error]', e);
        return false;
    }
}

function getManifest(appId) {
    try {
        return _loaded.get(appId)?.manifest || null;
    } catch (e) {
        console.error('[AppLoader getManifest Error]', e);
        return null;
    }
}

module.exports = { loadApp, unloadApp, loadAllInstalledApps, getLoaded, isLoaded, getManifest };
