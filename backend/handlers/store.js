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
const crypto = require('crypto');
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

async function fetchWithTimeout(url, options, timeoutMs) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { ...options, signal: controller.signal });
    } finally {
        clearTimeout(timeoutId);
    }
}



async function validateMarketplaceSource(url) {
    try {
        if (!/^https:\/\//i.test(url)) {
            return { ok: false, error: 'Solo URL HTTPS sono ammessi per motivi di sicurezza' };
        }
        const bust = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
        const res = await fetchWithTimeout(`${url}?t=${bust}`, {
            headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' }
        }, 10000);
        if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
        const data = await res.json();
        if (!Array.isArray(data)) return { ok: false, error: 'Il file non contiene un array JSON' };
        if (data.length === 0) return { ok: false, error: 'Il marketplace.json è vuoto' };
        const hasInvalidEntry = data.some(app => !app || typeof app !== 'object' || !app.id);
        if (hasInvalidEntry) return { ok: false, error: 'Una o più voci non hanno un campo "id" valido' };
        return { ok: true, count: data.length };
    } catch (e) {
        return { ok: false, error: e.message };
    }
}

async function fetchRemoteMarketplace(forceRefresh = false) {
    try {
        if (!forceRefresh && marketplaceCache) return marketplaceCache;

        const bust = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
        const noCache = { 'Cache-Control': 'no-cache, no-store, must-revalidate', 'Pragma': 'no-cache', 'Expires': '0' };
        let officialData = null;

        try {
            const res = await fetch(`${PRIMARY_MARKETPLACE_URL}?t=${bust}`, { headers: noCache });
            if (res.ok) officialData = await res.json();
        } catch (e) {
            console.warn('[Store] Primary marketplace fetch failed, trying fallback...', e.message);
        }

        if (!officialData) {
            try {
                const resFallback = await fetch(`${FALLBACK_MARKETPLACE_URL}?t=${bust}`, { headers: noCache });
                if (resFallback.ok) officialData = await resFallback.json();
            } catch (e) {
                console.warn('[Store] Fallback marketplace fetch failed:', e.message);
            }
        }

        if (!officialData || !Array.isArray(officialData)) {
            
            
            return marketplaceCache || [];
        }

        officialData.forEach(app => { app.__source = 'official'; });
        const officialIds = new Set(officialData.map(a => a.id));
        const mergedApps = [...officialData];

        try {
            const db = getStoreDB();
            const customRepos = db ? db.query('SELECT * FROM custom_repositories WHERE enabled = 1') : [];
            if (customRepos.length > 0) {
                const results = await Promise.allSettled(customRepos.map(async (repo) => {
                    const res = await fetchWithTimeout(`${repo.url}?t=${bust}`, { headers: noCache }, 10000);
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                    const data = await res.json();
                    if (!Array.isArray(data)) throw new Error('Formato non valido: atteso un array JSON');
                    return data;
                }));

                results.forEach((result, idx) => {
                    const repo = customRepos[idx];
                    if (result.status === 'fulfilled') {
                        if (db) db.run('UPDATE custom_repositories SET last_checked = ?, last_status = ?, last_error = NULL WHERE id = ?', [getTimestamp(), 'ok', repo.id]);
                        result.value.forEach(app => {
                            if (!app || !app.id) return;
                            if (officialIds.has(app.id)) {
                                console.warn(`[Store] Repository "${repo.label}" ha tentato di sovrascrivere l'app ufficiale "${app.id}": voce ignorata.`);
                                return;
                            }
                            if (mergedApps.some(a => a.id === app.id)) return;
                            mergedApps.push({ ...app, __source: 'custom', __sourceLabel: repo.label, __sourceId: repo.id });
                        });
                    } else {
                        const errMsg = String((result.reason && result.reason.message) || result.reason || 'Errore sconosciuto');
                        console.warn(`[Store] Repository custom "${repo.label}" non raggiungibile:`, errMsg);
                        if (db) db.run('UPDATE custom_repositories SET last_checked = ?, last_status = ?, last_error = ? WHERE id = ?', [getTimestamp(), 'error', errMsg, repo.id]);
                    }
                });
                if (db) await saveDB('store');
            }
        } catch (e) {
            console.error('[Store] Error merging custom repositories:', e);
        }

        marketplaceCache = mergedApps;
        return mergedApps;
    } catch (e) {
        console.error('[Store] Error fetchRemoteMarketplace:', e);
        return marketplaceCache || [];
    }
}

async function listRepositories() {
    try {
        const db = getStoreDB();
        const rows = db ? db.query('SELECT * FROM custom_repositories ORDER BY added_at ASC') : [];
        const official = {
            id: 'official',
            label: 'NunzioTech Ufficiale',
            type: 'official',
            url: PRIMARY_MARKETPLACE_URL,
            enabled: true,
            locked: true,
            last_status: 'ok'
        };
        const custom = rows.map(r => ({
            id: r.id,
            label: r.label,
            type: r.type,
            url: r.url,
            enabled: !!r.enabled,
            locked: false,
            added_at: r.added_at,
            last_checked: r.last_checked,
            last_status: r.last_status,
            last_error: r.last_error
        }));
        return { success: true, data: [official, ...custom] };
    } catch (e) {
        console.error('[Store] Error in listRepositories:', e);
        return { success: false, error: e.message };
    }
}





function resolveRepositoryInput(rawUrl) {
    try {
        const url = String(rawUrl).trim();

        const rawContentMatch = url.match(/^https:\/\/raw\.githubusercontent\.com\/([^\/]+)\/([^\/]+)\/[^\/]+\/.+$/i);
        if (rawContentMatch) {
            return { candidates: [url], label: `${rawContentMatch[1]}/${rawContentMatch[2]}`, type: 'github' };
        }

        const blobMatch = url.match(/^https:\/\/github\.com\/([^\/]+)\/([^\/]+)\/blob\/([^\/]+)\/(.+)$/i);
        if (blobMatch) {
            const [, owner, repoName, branch, filePath] = blobMatch;
            return {
                candidates: [`https://raw.githubusercontent.com/${owner}/${repoName}/${branch}/${filePath}`],
                label: `${owner}/${repoName}`,
                type: 'github'
            };
        }

        const bareRepoMatch = url.match(/^https:\/\/github\.com\/([^\/]+)\/([^\/]+?)(?:\.git)?\/?$/i);
        if (bareRepoMatch) {
            const [, owner, repoName] = bareRepoMatch;
            return {
                candidates: [
                    `https://raw.githubusercontent.com/${owner}/${repoName}/main/marketplace.json`,
                    `https://raw.githubusercontent.com/${owner}/${repoName}/master/marketplace.json`
                ],
                label: `${owner}/${repoName}`,
                type: 'github'
            };
        }

        let label;
        try { label = new URL(url).hostname; } catch (e) { label = url; }
        return { candidates: [url], label, type: 'url' };
    } catch (e) {
        return null;
    }
}

async function addRepository(event, args) {
    try {
        if (!accessGuard.isSuperadmin()) return { success: false, error: 'Permesso negato' };

        const { url } = args || {};
        if (!url || !String(url).trim()) return { success: false, error: 'URL obbligatorio' };
        const trimmedUrl = String(url).trim();
        if (!/^https:\/\//i.test(trimmedUrl)) {
            return { success: false, error: 'Solo URL HTTPS sono ammessi per motivi di sicurezza' };
        }

        const resolved = resolveRepositoryInput(trimmedUrl);
        if (!resolved || !resolved.candidates || resolved.candidates.length === 0) {
            return { success: false, error: 'URL non valido' };
        }

        const db = getStoreDB();
        if (!db) return { success: false, error: 'Database Store non disponibile' };

        let finalUrl = null;
        let finalValidation = null;
        let lastError = null;
        for (const candidateUrl of resolved.candidates) {
            const existing = db.query('SELECT id FROM custom_repositories WHERE url = ?', [candidateUrl]);
            if (existing.length > 0) return { success: false, error: 'Questo repository è già stato aggiunto' };

            const validation = await validateMarketplaceSource(candidateUrl);
            if (validation.ok) {
                finalUrl = candidateUrl;
                finalValidation = validation;
                break;
            }
            lastError = validation.error;
        }

        if (!finalUrl) {
            return { success: false, error: `Impossibile trovare un marketplace.json valido a questo URL: ${lastError}` };
        }

        const id = crypto.randomUUID();
        const ts = getTimestamp();
        const actorUserId = sessionManager.getCurrentUserId();
        db.run(
            'INSERT INTO custom_repositories (id, label, type, url, added_at, added_by, enabled, last_checked, last_status, last_error) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, NULL)',
            [id, resolved.label, resolved.type, finalUrl, ts, actorUserId, ts, 'ok']
        );
        await saveDB('store');
        marketplaceCache = null;

        return { success: true, data: { id, label: resolved.label, type: resolved.type, url: finalUrl, enabled: true, appCount: finalValidation.count } };
    } catch (e) {
        console.error('[Store] Error in addRepository:', e);
        return { success: false, error: e.message };
    }
}

async function removeRepository(event, id) {
    try {
        if (!accessGuard.isSuperadmin()) return { success: false, error: 'Permesso negato' };
        if (!id || id === 'official') return { success: false, error: 'Il repository ufficiale NunzioTech non può essere rimosso' };

        const db = getStoreDB();
        if (db) {
            db.run('DELETE FROM custom_repositories WHERE id = ?', [id]);
            await saveDB('store');
        }
        marketplaceCache = null;
        return { success: true };
    } catch (e) {
        console.error('[Store] Error in removeRepository:', e);
        return { success: false, error: e.message };
    }
}

async function setRepositoryEnabled(event, args) {
    try {
        if (!accessGuard.isSuperadmin()) return { success: false, error: 'Permesso negato' };
        const { id, enabled } = args || {};
        if (!id || id === 'official') return { success: false, error: 'Il repository ufficiale NunzioTech non può essere modificato' };

        const db = getStoreDB();
        if (db) {
            db.run('UPDATE custom_repositories SET enabled = ? WHERE id = ?', [enabled ? 1 : 0, id]);
            await saveDB('store');
        }
        marketplaceCache = null;
        return { success: true };
    } catch (e) {
        console.error('[Store] Error in setRepositoryEnabled:', e);
        return { success: false, error: e.message };
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
        await new Promise((resolve, reject) => {
            try {
                zip.extractAllToAsync(targetFolder, true, true, (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            } catch (eZip) {
                reject(eZip);
            }
        });
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

        try {
            
            
            require('./rbac').syncPermissionsFromManifests();
        } catch (rbacErr) {
            console.error('[Store] Errore sync permessi RBAC post-install:', rbacErr);
        }

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
    preloadMarketplaceCache,
    listRepositories,
    addRepository,
    removeRepository,
    setRepositoryEnabled
};
