'use strict';
const { getDB, saveDB } = require('../db');
const accessGuard = require('../core/access_guard');
const sessionManager = require('../core/session_manager');
const appsRegistry = require('../core/appsRegistry');
const AppLoader = require('../core/AppLoader');
const DependencyResolver = require('../core/DependencyResolver');
const AppUpdateManager = require('../core/AppUpdateManager');
const path = require('path');
const fs = require('fs');
const AdmZip = require('adm-zip');

const PRIMARY_MARKETPLACE_URL = 'https://nunziotech.it/software/adestio/marketplace.json';
const FALLBACK_MARKETPLACE_URL = 'https://raw.githubusercontent.com/AprileNunzio/Adestio-Marketplace/main/marketplace.json';

let marketplaceCache = null;

function getTimestamp() {
    try {
        return Math.floor(Date.now() / 1000);
    } catch (e) {
        return Math.floor(Date.now() / 1000);
    }
}

function getStoreDB() {
    try {
        return getDB('store');
    } catch (e) {
        return null;
    }
}

function logInstallAction(db, appId, action, version, actorUserId, success, error) {
    try {
        if (!db) return;
        db.run(
            'INSERT INTO app_install_log (app_id, action, version, actor_user_id, timestamp, success, error) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [appId, action, version || null, actorUserId || null, getTimestamp(), success ? 1 : 0, error || null]
        );
    } catch (e) {
        console.error('[Store] Errore scrittura app_install_log:', e.message);
    }
}

async function getInstalledDiskApps() {
    try {
        const { app } = require('electron');
        if (!app) return [];
        const userAppsPath = path.join(app.getPath('userData'), 'installed_apps');
        const installedList = [];

        if (fs.existsSync(userAppsPath)) {
            const dirs = fs.readdirSync(userAppsPath, { withFileTypes: true });
            for (const d of dirs) {
                if (d.isDirectory()) {
                    const manifestPath = path.join(userAppsPath, d.name, 'manifest.json');
                    if (fs.existsSync(manifestPath)) {
                        try {
                            const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
                            manifest.folder = d.name;
                            manifest.id = manifest.id || d.name;
                            manifest.appPath = path.join(userAppsPath, d.name);
                            installedList.push(manifest);
                        } catch (e) {
                            console.error('[Store] Error reading installed manifest:', e);
                        }
                    }
                }
            }
        }
        return installedList;
    } catch (e) {
        console.error('[Store] Error in getInstalledDiskApps:', e);
        return [];
    }
}

async function getInstalledRows() {
    try {
        const db = getStoreDB();
        const rows = db ? db.query("SELECT * FROM installed_apps WHERE status = 'active'") : [];
        const diskApps = await getInstalledDiskApps();

        diskApps.forEach(m => {
            const existing = rows.find(r => r.app_id === m.id || r.app_id === m.folder);
            if (existing) {
                if (m.version && existing.version !== m.version && db) {
                    db.run("UPDATE installed_apps SET version = ? WHERE app_id = ?", [m.version, existing.app_id]);
                    existing.version = m.version;
                }
            } else {
                if (db) {
                    db.run("INSERT OR IGNORE INTO installed_apps (app_id, version, installed_at, status) VALUES (?, ?, ?, 'active')", [m.id, m.version || '1.0.0', getTimestamp()]);
                }
                rows.push({ app_id: m.id, version: m.version || '1.0.0', status: 'active' });
            }
        });
        return rows;
    } catch (e) {
        return [];
    }
}

async function fetchRemoteMarketplace(forceRefresh = false) {
    try {
        if (!forceRefresh && marketplaceCache) return marketplaceCache;

        const bust = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
        const noCache = { 'Cache-Control': 'no-cache, no-store, must-revalidate', 'Pragma': 'no-cache', 'Expires': '0' };
        let remoteData = null;

        try {
            const res = await fetch(`${PRIMARY_MARKETPLACE_URL}?t=${bust}`, { headers: noCache });
            if (res.ok) remoteData = await res.json();
        } catch (e) {
            console.warn('[Store] Primary marketplace fetch failed, trying fallback...', e.message);
        }

        if (!remoteData) {
            try {
                const resFallback = await fetch(`${FALLBACK_MARKETPLACE_URL}?t=${bust}`, { headers: noCache });
                if (resFallback.ok) remoteData = await resFallback.json();
            } catch (e) {
                console.warn('[Store] Fallback marketplace fetch failed:', e.message);
            }
        }

        if (remoteData && Array.isArray(remoteData)) {
            marketplaceCache = remoteData;
            return remoteData;
        }

        return marketplaceCache || [];
    } catch (e) {
        console.error('[Store] Error fetchRemoteMarketplace:', e);
        return marketplaceCache || [];
    }
}

async function getAvailable() {
    try {
        const localManifests = await appsRegistry.getAppsRegistry();
        const diskApps = await getInstalledDiskApps();
        const installedRows = await getInstalledRows();

        const diskMap = new Map();
        diskApps.forEach(a => diskMap.set(a.id, a));
        localManifests.filter(m => !m.core).forEach(m => diskMap.set(m.id, m));

        const dbMap = new Map();
        installedRows.forEach(r => dbMap.set(r.app_id, r));

        const remoteManifests = await fetchRemoteMarketplace();
        const allAppIds = new Set([
            ...Array.from(diskMap.keys()),
            ...remoteManifests.map(m => m.id)
        ]);

        const result = [];
        allAppIds.forEach(id => {
            const diskManifest = diskMap.get(id);
            const remoteManifest = remoteManifests.find(m => m.id === id);
            const dbRow = dbMap.get(id);

            const isInstalled = !!(diskManifest || dbRow);
            const installedVersion = diskManifest ? diskManifest.version : (dbRow ? dbRow.version : null);
            const remoteVersion = remoteManifest ? remoteManifest.version : null;
            const latestVersion = remoteVersion || installedVersion || '1.0.0';
            const hasUpdate = isInstalled && installedVersion && remoteVersion && (installedVersion !== remoteVersion);

            const baseApp = remoteManifest || diskManifest || {};

            result.push({
                ...baseApp,
                id,
                name: baseApp.name || id,
                version: latestVersion,
                installedVersion: installedVersion,
                installed: isInstalled,
                hasUpdate: hasUpdate
            });
        });

        return { success: true, data: result };
    } catch (e) {
        console.error('[Store] Error in getAvailable:', e);
        return { success: false, error: e.message };
    }
}

async function getInstalled() {
    try {
        const availableRes = await getAvailable();
        if (availableRes && availableRes.success) {
            const installedApps = availableRes.data.filter(a => a.installed);
            return { success: true, data: installedApps };
        }
        return { success: true, data: [] };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

async function getCoreApps() {
    try {
        const manifests = await appsRegistry.getAppsRegistry();
        const data = manifests.filter(m => m.core).map(m => ({ ...m }));
        return { success: true, data };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

async function downloadFromPeersOrFallback(appId, fallbackUrl, targetFolder) {
    try {
        const sync = require('../sync');
        const { generateNetworkHash } = require('../p2p/network_auth');
        const peers = sync.getDetailedNodes ? sync.getDetailedNodes() : [];
        let zipBuffer = null;
        let downloadedFromPeer = false;

        if (peers && peers.length > 0) {
            for (const peer of peers) {
                try {
                    const p2pUrl = `http://${peer.ip}:${peer.port}/sync/app-package/${appId}`;
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 10000);
                    const response = await fetch(p2pUrl, { signal: controller.signal });
                    clearTimeout(timeoutId);
                    if (response.ok) {
                        const arrayBuffer = await response.arrayBuffer();
                        zipBuffer = Buffer.from(arrayBuffer);
                        downloadedFromPeer = true;
                        break;
                    }
                } catch (e) {}
            }
        }

        if (!zipBuffer) {
            if (!fallbackUrl) throw new Error('Download URL non disponibile');
            const response = await fetch(`${fallbackUrl}?t=${Date.now()}`, {
                headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' }
            });
            if (!response.ok) throw new Error(`Download HTTP fallito: ${response.statusText}`);
            const arrayBuffer = await response.arrayBuffer();
            zipBuffer = Buffer.from(arrayBuffer);
        }

        const zip = new AdmZip(zipBuffer);
        zip.extractAllTo(targetFolder, true);
        return downloadedFromPeer;
    } catch (e) {
        console.error('[Store] Error in downloadFromPeersOrFallback:', e);
        throw e;
    }
}

async function install(event, appId) {
    let lockAcquired = false;
    let previousVersion = null;
    try {
        if (!accessGuard.isSuperadmin()) return { success: false, error: 'Permesso negato' };
        if (!appId) return { success: false, error: 'appId mancante' };

        // Un'installazione/aggiornamento manuale dallo Store condivide il lock con
        // AppUpdateManager: se l'app e' gia' in aggiornamento in background evitiamo
        // che due processi scrivano contemporaneamente sulla stessa cartella.
        if (AppUpdateManager.isLocked(appId)) {
            return { success: false, error: 'Applicazione già in aggiornamento in background. Riprova tra qualche istante.' };
        }

        const availableRes = await getAvailable();
        const availableApps = availableRes.success ? availableRes.data : [];
        let targetManifest = availableApps.find(m => m.id === appId);

        if (!targetManifest) {
            return { success: false, error: `App "${appId}" non trovata nel Marketplace` };
        }

        if (targetManifest.core) {
            return { success: false, error: 'Le applicazioni predefinite non possono essere installate.' };
        }

        const installedRowsBefore = await getInstalledRows();
        const previousRow = installedRowsBefore.find(r => r.app_id === appId);
        previousVersion = previousRow ? previousRow.version : null;

        AppUpdateManager.beginManualOperation(appId, targetManifest.downloadUrl ? 'downloading' : 'installing', {
            currentVersion: previousVersion,
            availableVersion: targetManifest.version
        });
        lockAcquired = true;

        if (targetManifest.downloadUrl) {
            const { app } = require('electron');
            const targetBaseDir = path.join(app.getPath('userData'), 'installed_apps');
            if (!fs.existsSync(targetBaseDir)) fs.mkdirSync(targetBaseDir, { recursive: true });
            const appDir = path.join(targetBaseDir, targetManifest.folder || appId);
            await downloadFromPeersOrFallback(appId, targetManifest.downloadUrl, appDir);
        }

        AppUpdateManager.beginManualOperation(appId, 'installing', {
            currentVersion: previousVersion,
            availableVersion: targetManifest.version
        });

        const updatedManifests = await appsRegistry.getAppsRegistry();
        const installedRows = await getInstalledRows();
        const installedIds = installedRows.map(r => r.app_id);

        let order;
        try {
            order = DependencyResolver.resolve(appId, updatedManifests, installedIds);
        } catch (e) {
            order = [appId];
        }

        const db = getStoreDB();
        const actorUserId = sessionManager.getCurrentUserId();
        const installedNow = [];

        for (const id of order) {
            const manifest = updatedManifests.find(m => m.id === id) || (id === appId ? targetManifest : null);
            if (!manifest) continue;
            const ok = await AppLoader.loadApp(manifest);
            if (!ok) {
                logInstallAction(db, id, 'install', manifest.version, actorUserId, false, 'AppLoader.loadApp fallito');
                await saveDB('store');
                AppUpdateManager.endManualOperation(appId, {
                    finalState: 'error',
                    meta: { error: `Installazione fallita per "${id}"` },
                    clearDelayMs: 10000
                });
                lockAcquired = false;
                return { success: false, error: `Installazione fallita per "${id}"` };
            }
            const ts = getTimestamp();
            if (db) {
                const existing = db.query('SELECT app_id FROM installed_apps WHERE app_id = ?', [id]);
                if (existing.length > 0) {
                    db.run('UPDATE installed_apps SET version = ?, status = ? WHERE app_id = ?', [manifest.version || '0.0.0', 'active', id]);
                } else {
                    db.run(
                        'INSERT INTO installed_apps (app_id, version, installed_at, installed_by, status) VALUES (?, ?, ?, ?, ?)',
                        [id, manifest.version || '0.0.0', ts, actorUserId, 'active']
                    );
                }
            }
            logInstallAction(db, id, 'install', manifest.version, actorUserId, true, null);
            installedNow.push(id);
        }
        await saveDB('store');

        AppUpdateManager.endManualOperation(appId, {
            finalState: 'done',
            notifyUpdated: true,
            previousVersion,
            newVersion: targetManifest.version,
            clearDelayMs: 5000
        });
        lockAcquired = false;

        return { success: true, data: { installed: installedNow } };
    } catch (e) {
        console.error('[Store] Error in install:', e);
        if (lockAcquired) {
            AppUpdateManager.endManualOperation(appId, {
                finalState: 'error',
                meta: { error: e.message },
                clearDelayMs: 10000
            });
        }
        return { success: false, error: e.message };
    }
}

async function uninstall(event, appId) {
    try {
        if (!accessGuard.isSuperadmin()) return { success: false, error: 'Permesso negato' };
        if (!appId) return { success: false, error: 'appId mancante' };

        if (AppUpdateManager.isLocked(appId)) {
            return { success: false, error: 'Applicazione in aggiornamento in background. Attendi il completamento prima di disinstallarla.' };
        }

        const manifests = await appsRegistry.getAppsRegistry();
        const targetManifest = manifests.find(m => m.id === appId);

        if (targetManifest && targetManifest.core) {
            return { success: false, error: 'Le applicazioni predefinite non possono essere disinstallate.' };
        }

        const installedRows = await getInstalledRows();
        const installedIds = installedRows.map(r => r.app_id);
        const { canUninstall, blockedBy } = DependencyResolver.canUninstall(appId, installedIds, manifests);

        if (!canUninstall) {
            return {
                success: false,
                error: `Impossibile disinstallare: richiesta da ${blockedBy.join(', ')}`,
                blockedBy
            };
        }

        AppLoader.unloadApp(appId);

        const { app } = require('electron');
        const targetBaseDir = path.join(app.getPath('userData'), 'installed_apps');
        const targetFolder = path.join(targetBaseDir, (targetManifest && targetManifest.folder) ? targetManifest.folder : appId);

        if (fs.existsSync(targetFolder)) {
            fs.rmSync(targetFolder, { recursive: true, force: true });
        }

        const db = getStoreDB();
        const actorUserId = sessionManager.getCurrentUserId();

        if (db) {
            db.run('DELETE FROM installed_apps WHERE app_id = ?', [appId]);
            db.run('DELETE FROM app_dependencies WHERE app_id = ?', [appId]);
        }

        logInstallAction(db, appId, 'uninstall', targetManifest ? targetManifest.version : null, actorUserId, true, null);
        await saveDB('store');
        return { success: true };
    } catch (e) {
        console.error('[Store] Error in uninstall:', e);
        return { success: false, error: e.message };
    }
}

async function checkUpdates() {
    try {
        marketplaceCache = null;
        const availableRes = await getAvailable();
        if (availableRes && availableRes.success) {
            const updates = availableRes.data
                .filter(a => a.installed && a.hasUpdate)
                .map(a => ({
                    appId: a.id,
                    currentVersion: a.installedVersion,
                    availableVersion: a.version
                }));
            return { success: true, data: updates };
        }
        return { success: true, data: [] };
    } catch (e) {
        console.error('[Store] Error in checkUpdates:', e);
        return { success: false, error: e.message };
    }
}

async function getSystemLogs() {
    try {
        const db = getStoreDB();
        if (!db) return [];
        return db.query('SELECT * FROM app_install_log ORDER BY timestamp DESC LIMIT 200', []);
    } catch (e) {
        return [];
    }
}

async function clearSystemLogs() {
    try {
        const db = getStoreDB();
        if (db) {
            db.run('DELETE FROM app_install_log');
            await saveDB('store');
        }
        return { success: true };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

async function deleteSystemLog(id) {
    try {
        const db = getStoreDB();
        if (db) {
            db.run('DELETE FROM app_install_log WHERE id = ?', [id]);
            await saveDB('store');
        }
        return { success: true };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

async function preloadMarketplaceCache() {
    try {
        await fetchRemoteMarketplace();
    } catch (e) {
        console.error('[Store] Error in preloadMarketplaceCache:', e);
    }
}

async function syncNetworkApps() {
    try {
        const availableRes = await getAvailable();
        if (availableRes && availableRes.success) {
            return { success: true, count: availableRes.data.length };
        }
        return { success: true, count: 0 };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

module.exports = {
    getAvailable,
    getInstalled,
    getCoreApps,
    install,
    uninstall,
    checkUpdates,
    getSystemLogs,
    clearSystemLogs,
    deleteSystemLog,
    syncNetworkApps,
    preloadMarketplaceCache
};
