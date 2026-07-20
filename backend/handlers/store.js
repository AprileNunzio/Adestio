'use strict';
const { getDB, saveDB } = require('../db');
const accessGuard = require('../core/access_guard');
const sessionManager = require('../core/session_manager');
const appsRegistry = require('../core/appsRegistry');
const AppLoader = require('../core/AppLoader');
const DependencyResolver = require('../core/DependencyResolver');
const path = require('path');
const fs = require('fs');
const AdmZip = require('adm-zip');
const MARKETPLACE_URL = 'https://raw.githubusercontent.com/AprileNunzio/Adestio-Marketplace/main/marketplace.json';
let marketplaceCache = null;
async function preloadMarketplaceCache() {
    try {
        console.log('[Store] Preloading marketplace cache in background...');
        const response = await fetch(MARKETPLACE_URL);
        if (response.ok) {
            marketplaceCache = await response.json();
            console.log('[Store] Marketplace cache loaded successfully.');
        }
    } catch(e) {
        console.warn('[Store] Errore preload marketplace cache:', e);
    }
}
function getTimestamp() {
    return Math.floor(Date.now() / 1000);
}
function getStoreDB() {
    return getDB('store');
}
function logInstallAction(db, appId, action, version, actorUserId, success, error) {
    try {
        db.run(
            'INSERT INTO app_install_log (app_id, action, version, actor_user_id, timestamp, success, error) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [appId, action, version || null, actorUserId || null, getTimestamp(), success ? 1 : 0, error || null]
        );
    } catch (e) {
        console.error('[Store] Errore scrittura app_install_log:', e.message);
    }
}
async function getInstalledRows() {
    try {
        const db = getStoreDB();
        const rows = db.query("SELECT * FROM installed_apps WHERE status = 'active'");
        return rows;
    } catch (e) {
        return [];
    }
}
async function syncNetworkApps() {
    console.log('[Store] Controllo Sincronizzazione App di rete...');
    try {
        const db = getStoreDB();
        const rows = db.query("SELECT * FROM installed_apps WHERE status = 'active'");
        const localManifests = await appsRegistry.getAppsRegistry();
        const physicalAppIds = new Set(localManifests.map(m => m.id));
        const missingApps = rows.filter(r => !physicalAppIds.has(r.app_id));
        if (missingApps.length === 0) return { success: true, synced: 0 };
        console.log(`[Store] Trovate ${missingApps.length} app da sincronizzare. Avvio download...`);
        let remoteManifests = marketplaceCache;
        if (!remoteManifests) {
            const response = await fetch(MARKETPLACE_URL);
            if (response.ok) {
                remoteManifests = await response.json();
                marketplaceCache = remoteManifests;
            }
        }
        let syncedCount = 0;
        for (const row of missingApps) {
            const appId = row.app_id;
            const remoteManifest = (remoteManifests || []).find(m => m.id === appId);
            if (!remoteManifest || !remoteManifest.downloadUrl) {
                console.warn(`[Store] Impossibile auto-installare ${appId}: non trovata nel marketplace remoto.`);
                continue;
            }
            console.log(`[Store] Auto-installazione P2P di ${appId}...`);
            const { app } = require('electron');
            const targetBaseDir = path.join(app.getPath('userData'), 'installed_apps');
            const fs = require('fs');
            if (!fs.existsSync(targetBaseDir)) fs.mkdirSync(targetBaseDir, { recursive: true });
            const appDir = path.join(targetBaseDir, remoteManifest.folder || appId);
            try {
                await downloadFromPeersOrFallback(appId, remoteManifest.downloadUrl, appDir);
                await AppLoader.loadApp(remoteManifest);
                syncedCount++;
                console.log(`[Store] ${appId} installata e caricata correttamente in background.`);
            } catch (e) {
                console.error(`[Store] Errore auto-installazione P2P per ${appId}:`, e);
            }
        }
        return { success: true, synced: syncedCount };
    } catch (e) {
        console.error('[Store] Errore in syncNetworkApps:', e);
        return { success: false, error: e.message };
    }
}
async function getAvailable() {
    try {
        const localManifests = await appsRegistry.getAppsRegistry();
        const installedRows = await getInstalledRows();
        const installedMap = new Map(installedRows.map(r => [r.app_id, r]));
        let remoteManifests = [];
        try {
            if (marketplaceCache) {
                remoteManifests = marketplaceCache;
            } else {
                const response = await fetch(MARKETPLACE_URL);
                if (response.ok) {
                    remoteManifests = await response.json();
                    marketplaceCache = remoteManifests;
                }
            }
        } catch (e) {
            console.error('[Store] Errore fetch marketplace remoto:', e.message);
        }
        const allMap = new Map();
        localManifests.filter(m => !m.core).forEach(m => allMap.set(m.id, m));
        remoteManifests.forEach(m => allMap.set(m.id, m)); 
        const data = Array.from(allMap.values()).map(m => ({
            ...m,
            installed: installedMap.has(m.id),
            installedVersion: installedMap.has(m.id) ? installedMap.get(m.id).version : null
        }));
        return { success: true, data };
    } catch (e) {
        return { success: false, error: e.message };
    }
}
async function getInstalled() {
    try {
        const rows = await getInstalledRows();
        return { success: true, data: rows };
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
    const sync = require('../sync');
    const { verifyNetworkHash, generateNetworkHash } = require('../p2p/network_auth');
    const peers = sync.getDetailedNodes ? sync.getDetailedNodes() : [];
    let zipBuffer = null;
    let downloadedFromPeer = false;
    if (peers && peers.length > 0) {
        console.log(`[Store] Cerco l'app ${appId} in ${peers.length} peer connessi...`);
        for (const peer of peers) {
            try {
                const p2pUrl = `http://${peer.ip}:${peer.port}/sync/app-package/${appId}`;
                const hash = await generateNetworkHash();
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 10000); 
                const response = await fetch(p2pUrl, {
                    headers: { 'x-adestio-network': hash },
                    signal: controller.signal
                });
                clearTimeout(timeoutId);
                if (response.ok) {
                    const arrayBuffer = await response.arrayBuffer();
                    zipBuffer = Buffer.from(arrayBuffer);
                    downloadedFromPeer = true;
                    console.log(`[Store] Download di ${appId} completato da P2P peer ${peer.ip}`);
                    break;
                }
            } catch (e) {
            }
        }
    }
    if (!zipBuffer) {
        if (!fallbackUrl) throw new Error('Nessun peer possiede l\'app e fallbackUrl è assente');
        console.log(`[Store] Download di ${appId} da fallback remoto: ${fallbackUrl}`);
        
        if (fallbackUrl.startsWith('ftp://')) {
            throw new Error('Download FTP non supportato: usa un link HTTP nel marketplace.json');
        } else {
            const response = await fetch(fallbackUrl);
            if (!response.ok) throw new Error(`Download fallback HTTP fallito: ${response.statusText}`);
            const arrayBuffer = await response.arrayBuffer();
            zipBuffer = Buffer.from(arrayBuffer);
        }
    }
    const AdmZip = require('adm-zip');
    const zip = new AdmZip(zipBuffer);
    zip.extractAllTo(targetFolder, true);
    return downloadedFromPeer;
}
async function install(event, appId) {
    try {
        if (!accessGuard.isSuperadmin()) return { success: false, error: 'Permesso negato' };
        if (!appId) return { success: false, error: 'appId mancante' };
        const localManifests = await appsRegistry.getAppsRegistry();
        let targetManifest = localManifests.find(m => m.id === appId);
        if (!targetManifest) {
            try {
                const response = await fetch(MARKETPLACE_URL);
                if (response.ok) {
                    const remoteManifests = await response.json();
                    targetManifest = remoteManifests.find(m => m.id === appId);
                }
            } catch (e) {
                console.error('[Store] Errore fetch marketplace durante install:', e.message);
            }
        }
        if (!targetManifest) {
            return { success: false, error: `App "${appId}" non trovata nel Marketplace` };
        }
        if (targetManifest.core) {
            return { success: false, error: 'Le applicazioni predefinite non possono essere installate: sono già parte della piattaforma.' };
        }
        if (targetManifest.downloadUrl) {
            const { app } = require('electron');
            const targetBaseDir = path.join(app.getPath('userData'), 'installed_apps');
            const fs = require('fs');
            if (!fs.existsSync(targetBaseDir)) fs.mkdirSync(targetBaseDir, { recursive: true });
            const appDir = path.join(targetBaseDir, targetManifest.folder || appId);
            await downloadFromPeersOrFallback(appId, targetManifest.downloadUrl, appDir);
        }
        const updatedManifests = await appsRegistry.getAppsRegistry();
        const installedRows = await getInstalledRows();
        const installedIds = installedRows.map(r => r.app_id);
        let order;
        try {
            order = DependencyResolver.resolve(appId, updatedManifests, installedIds);
        } catch (e) {
            return { success: false, error: e.message };
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
                return { success: false, error: `Installazione fallita per "${id}"` };
            }
            const ts = getTimestamp();
            const existing = db.query('SELECT app_id FROM installed_apps WHERE app_id = ?', [id]);
            if (existing.length > 0) {
                db.run('UPDATE installed_apps SET version = ?, status = ? WHERE app_id = ?', [manifest.version || '0.0.0', 'active', id]);
            } else {
                db.run(
                    'INSERT INTO installed_apps (app_id, version, installed_at, installed_by, status) VALUES (?, ?, ?, ?, ?)',
                    [id, manifest.version || '0.0.0', ts, actorUserId, 'active']
                );
            }
            db.run('DELETE FROM app_dependencies WHERE app_id = ?', [id]);
            const deps = Array.isArray(manifest.dependencies) ? manifest.dependencies : 
                         (typeof manifest.dependencies === 'object' && manifest.dependencies !== null ? Object.keys(manifest.dependencies) : []);
            for (const dep of deps) {
                db.run('INSERT OR IGNORE INTO app_dependencies (app_id, depends_on) VALUES (?, ?)', [id, dep]);
            }
            logInstallAction(db, id, 'install', manifest.version, actorUserId, true, null);
            installedNow.push(id);
        }
        await saveDB('store');
        return { success: true, data: { installed: installedNow } };
    } catch (e) {
        return { success: false, error: e.message };
    }
}
async function uninstall(event, appId) {
    try {
        if (!accessGuard.isSuperadmin()) return { success: false, error: 'Permesso negato' };
        if (!appId) return { success: false, error: 'appId mancante' };
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
        if (targetManifest && !targetManifest.bundled) {
            const fs = require('fs');
            const path = require('path');
            const appDir = targetManifest.appPath;
            if (appDir && fs.existsSync(appDir)) {
                fs.rmSync(appDir, { recursive: true, force: true });
            }
        }
        const db = getStoreDB();
        const actorUserId = sessionManager.getCurrentUserId();
        db.run('DELETE FROM installed_apps WHERE app_id = ?', [appId]);
        db.run('DELETE FROM app_dependencies WHERE app_id = ?', [appId]);
        logInstallAction(db, appId, 'uninstall', targetManifest ? targetManifest.version : null, actorUserId, true, null);
        await saveDB('store');
        return { success: true };
    } catch (e) {
        return { success: false, error: e.message };
    }
}
async function checkUpdates() {
    try {
        const localManifests = await appsRegistry.getAppsRegistry();
        const installedRows = await getInstalledRows();
        const updates = [];
        let remoteManifests = [];
        try {
            const response = await fetch(MARKETPLACE_URL);
            if (response.ok) {
                remoteManifests = await response.json();
            }
        } catch(e) {}
        for (const row of installedRows) {
            let latestVersion = row.version;
            const remoteManifest = remoteManifests.find(m => m.id === row.app_id);
            if (remoteManifest && remoteManifest.version) {
                latestVersion = remoteManifest.version;
            } else {
                const localManifest = localManifests.find(m => m.id === row.app_id);
                if (localManifest && localManifest.version) latestVersion = localManifest.version;
            }
            if (latestVersion !== row.version) {
                updates.push({ appId: row.app_id, currentVersion: row.version, availableVersion: latestVersion });
            }
        }
        return { success: true, data: updates };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

async function getSystemLogs() {
    try {
        const { getDB } = require('../db');
        const db = getDB('store');
        // Prendi gli ultimi 200 log, decrescente
        const logs = db.query('SELECT * FROM app_install_log ORDER BY timestamp DESC LIMIT 200', []);
        return logs;
    } catch (e) {
        console.error('[Store] Errore lettura log sistema:', e);
        return [];
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
    preloadMarketplaceCache,
    syncNetworkApps
};
