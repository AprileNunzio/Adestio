'use strict';

const path = require('path');
const fs = require('fs');
const { app } = require('electron');
const AppDbManager = require('./AppDbManager');
const appProcessManager = require('./appProcessManager');
const licenseManager = require('../security/licenseManager');
const cryptoVerifier = require('../security/cryptoVerifier');
const auditLogger = require('../observability/auditLogger');

const _loaded = new Map();
const APPS_PATH = path.join(__dirname, '../../src/apps');

async function loadApp(manifest) {
    try {
        const appId = manifest.id;

        if (_loaded.has(appId)) {
            return true;
        }

        const safeMode = process.env.ADESTIO_SAFE_MODE === 'true' || fs.existsSync(path.join(app.getPath('userData'), 'SAFE_MODE'));
        if (safeMode && !manifest.core && !manifest.bundled) {
            auditLogger.logEvent('system', 'APP_LOAD_SKIPPED_SAFE_MODE', 'app', appId);
            return false;
        }

        const currentCoreVersion = app.getVersion();
        if (manifest.minCoreVersion && currentCoreVersion < manifest.minCoreVersion) {
            auditLogger.logEvent('system', 'APP_LOAD_INCOMPATIBLE', 'app', appId, { minCoreVersion: manifest.minCoreVersion, currentCoreVersion });
            return false;
        }

        if (!manifest.core && !licenseManager.isModuleEnabled(appId)) {
            auditLogger.logEvent('system', 'APP_LOAD_BLOCKED_LICENSE', 'app', appId);
            return false;
        }

        const appDir = manifest.appPath || path.join(APPS_PATH, manifest.folder || appId);
        const manifestFile = path.join(appDir, 'manifest.json');

        if (fs.existsSync(manifestFile) && manifest.integrity_hash) {
            const currentHash = cryptoVerifier.computeFileHash(manifestFile);
            if (currentHash !== manifest.integrity_hash) {
                auditLogger.logEvent('system', 'MANIFEST_INTEGRITY_TAMPERED', 'app', appId);
                return false;
            }
        }

        if (manifest.db && manifest.db.namespace) {
            try {
                let migrations = [];
                if (manifest.db.migrations) {
                    const migPathStr = String(manifest.db.migrations);
                    const cleanMigPath = migPathStr.startsWith('./') ? migPathStr.slice(2) : migPathStr;
                    const migrationsAbsPath = path.join(appDir, cleanMigPath);
                    if (fs.existsSync(migrationsAbsPath)) {
                        migrations = require(migrationsAbsPath);
                    }
                }
                await AppDbManager.getOrCreate(manifest.db.namespace, migrations);
            } catch (dbErr) {}
        }

        const backendPath = path.join(appDir, manifest.backend || 'backend.js');

        if (fs.existsSync(backendPath)) {
            let directBackendModule = null;
            try {
                delete require.cache[require.resolve(backendPath)];
                directBackendModule = require(backendPath);
            } catch (requireErr) {}

            if (directBackendModule && typeof directBackendModule.registerBackendHandlers === 'function') {
                try {
                    const { app: electronApp } = require('electron');
                    const { getDB, saveDB } = require('../db');
                    const adestioConfig = require('../config');
                    const capabilityBroker = require('../security/capabilityBroker');
                    capabilityBroker.generateAppToken(appId, manifest.permissions || []);
                    const registerApi = (action, fn) => {
                        try {
                            capabilityBroker.registerApiHandler(appId, action, (sourceAppId, payload) => fn(null, payload));
                        } catch (regErr) {}
                    };
                    const ok = directBackendModule.registerBackendHandlers(registerApi, electronApp, {
                        getDB, saveDB, AppDbManager,
                        readConfig: () => adestioConfig.readConfig()
                    });
                    if (ok === false) throw new Error('registerBackendHandlers ha restituito false');
                    _loaded.set(appId, { manifest: manifest, isProcess: false, directBackend: true });
                } catch (directErr) {
                    throw directErr;
                }
            } else {
                try {
                    const spawned = appProcessManager.spawnAppProcess(appId, manifest, appDir);
                    if (spawned) {
                        _loaded.set(appId, { manifest: manifest, isProcess: true });
                    } else {
                        throw new Error('Impossibile avviare il processo child');
                    }
                } catch (backendErr) {
                    throw backendErr;
                }
            }
        } else {
            _loaded.set(appId, { manifest: manifest, isProcess: false });
        }

        auditLogger.logEvent('system', 'APP_LOADED', 'app', appId, { version: manifest.version });
        return true;
    } catch (e) {
        return false;
    }
}

async function unloadApp(appId) {
    try {
        if (!_loaded.has(appId)) return false;

        const entry = _loaded.get(appId);
        if (entry && entry.directBackend) {
            try {
                const capabilityBroker = require('../security/capabilityBroker');
                capabilityBroker.revokeAppToken(appId);
            } catch (revokeErr) {}
        }
        appProcessManager.terminateAppProcess(appId);
        _loaded.delete(appId);
        auditLogger.logEvent('system', 'APP_UNLOADED', 'app', appId);
        return true;
    } catch (e) {
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
        } catch (e) {}

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
            } catch (seedErr) {}
        }

        if (dbChanged) {
            try {
                await saveDB('store');
            } catch (saveErr) {}
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
            } catch (mErr) {}
        }

        return loaded;
    } catch (e) {
        return 0;
    }
}

function getLoaded() {
    try {
        return Array.from(_loaded.keys());
    } catch (e) {
        return [];
    }
}

function isLoaded(appId) {
    try {
        return _loaded.has(appId);
    } catch (e) {
        return false;
    }
}

function getManifest(appId) {
    try {
        return _loaded.get(appId)?.manifest || null;
    } catch (e) {
        return null;
    }
}

module.exports = { loadApp, unloadApp, loadAllInstalledApps, getLoaded, isLoaded, getManifest };
