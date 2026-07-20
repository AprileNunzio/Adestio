'use strict';
const path = require('path');
const fs = require('fs');
const Module = require('module');

// --- HACK PER RISOLUZIONE MODULI APP TERZE PARTI ---
// Le app installate in %APPDATA% non trovano i moduli dell'app principale (es. xlsx).
// Quando un modulo non viene trovato localmente, aggiungiamo il path di Adestio ai paths.
// Inoltre, reindirizziamo eventuali require('../../../backend/...') verso la directory reale.
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function(request, parent, isMain, options) {
    if (request.includes('/backend/') || request.includes('\\backend\\')) {
        const parts = request.split(/[\/\\]/);
        const backendIndex = parts.indexOf('backend');
        if (backendIndex !== -1) {
            const relPath = parts.slice(backendIndex).join(path.sep);
            const adestioBackendPath = path.join(__dirname, '../../', relPath);
            if (fs.existsSync(adestioBackendPath) || fs.existsSync(adestioBackendPath + '.js') || fs.existsSync(path.join(adestioBackendPath, 'index.js'))) {
                request = adestioBackendPath;
            }
        }
    }
    
    try {
        return originalResolve(request, parent, isMain, options);
    } catch (e) {
        if (e.code === 'MODULE_NOT_FOUND' && parent && parent.paths) {
            const adestioNodeModules = path.join(__dirname, '../../node_modules');
            // Cerca in resources/app.asar/node_modules in produzione
            const asarNodeModules = path.join(__dirname, '../../../../node_modules');
            
            let patched = false;
            if (!parent.paths.includes(adestioNodeModules)) { parent.paths.push(adestioNodeModules); patched = true; }
            if (!parent.paths.includes(asarNodeModules)) { parent.paths.push(asarNodeModules); patched = true; }
            
            if (patched) {
                return originalResolve(request, parent, isMain, options);
            }
        }
        throw e;
    }
};
// ---------------------------------------------------

const PlatformContext = require('./PlatformContext');
const AppIpcBridge = require('./AppIpcBridge');
const AppDbManager = require('./AppDbManager');

/**
 * AppLoader — carica e scarica le app del marketplace a runtime.
 *
 * Lifecycle di un'app:
 *   1. loadApp(manifest)  → init DB → carica backend.js → registra IPC → marcata come loaded
 *   2. unloadApp(appId)   → deregistra IPC → rimossa dalla mappa
 *
 * Le app senza backend.js (solo frontend) vengono registrate senza IPC.
 * Le app senza db.namespace non ricevono un DB dedicato.
 *
 * Le migrations (manifest.db.migrations) devono avere lo stesso formato
 * usato in backend/migrations/*.js: array di { version: number, sql: string }.
 * SqlJsAdapter.runMigrations() esegue m.sql direttamente via db.exec(), non
 * supporta funzioni up(db).
 */

// appId → { manifest, backendModule, context }
const _loaded = new Map();

const APPS_PATH = path.join(__dirname, '../../src/apps');

async function loadApp(manifest) {
    const appId = manifest.id;

    if (_loaded.has(appId)) {
        console.warn(`[AppLoader] App "${appId}" già caricata.`);
        return true;
    }

    try {
        const appDir = manifest.appPath || path.join(APPS_PATH, manifest.folder || appId);

        // 1. Inizializza il DB dedicato se dichiarato nel manifest
        if (manifest.db && manifest.db.namespace) {
            let migrations = [];
            if (manifest.db.migrations) {
                const migrationsAbsPath = path.join(appDir, manifest.db.migrations.replace(/^\.\//, ''));
                if (fs.existsSync(migrationsAbsPath)) {
                    migrations = require(migrationsAbsPath);
                }
            }
            await AppDbManager.getOrCreate(manifest.db.namespace, migrations);
        }

        // 2. Carica il backend se esiste
        const backendPath = path.join(appDir, manifest.backend || 'backend.js');
        let backendModule = null;

        if (fs.existsSync(backendPath)) {
            try {
                backendModule = require(backendPath);
                const namespace = (manifest.ipc && manifest.ipc.namespace) || appId;
                const context = new PlatformContext(appId);

                if (typeof backendModule.register === 'function') {
                    const handlers = backendModule.register(context);
                    if (handlers && typeof handlers === 'object' && Object.keys(handlers).length > 0) {
                        AppIpcBridge.register(appId, namespace, handlers, context);
                    }
                }
                
                // Trigger onLoad lifecycle hook if present
                if (typeof backendModule.onLoad === 'function') {
                    try {
                        await backendModule.onLoad(context);
                    } catch (hookErr) {
                        console.error(`[AppLoader] App "${appId}" onLoad hook fallito (sandboxed):`, hookErr.message);
                        // Procediamo comunque o blocchiamo? Per ora logghiamo l'errore per non bloccare il core.
                    }
                }

                _loaded.set(appId, { manifest, backendModule, context });
            } catch (backendErr) {
                console.error(`[AppLoader] Crash critico nel backend dell'app "${appId}":`, backendErr.message);
                throw new Error(`Sandboxed app crash: ${backendErr.message}`);
            }
        } else {
            // App solo frontend
            _loaded.set(appId, { manifest, backendModule: null, context: null });
        }

        console.log(`[AppLoader] App "${appId}" v${manifest.version || '?'} caricata.`);
        return true;
    } catch (e) {
        console.error(`[AppLoader] Errore nel caricamento di "${appId}":`, e.message);
        return false;
    }
}

async function unloadApp(appId) {
    if (!_loaded.has(appId)) return false;

    const { backendModule, context } = _loaded.get(appId);

    try {
        if (backendModule && typeof backendModule.onUninstall === 'function') {
            try {
                await backendModule.onUninstall(context);
            } catch (hookErr) {
                console.error(`[AppLoader] App "${appId}" onUninstall hook fallito:`, hookErr.message);
            }
        }
        
        AppIpcBridge.deregister(appId);
        _loaded.delete(appId);
        console.log(`[AppLoader] App "${appId}" scaricata.`);
        return true;
    } catch (e) {
        console.error(`[AppLoader] Errore nello scaricamento di "${appId}":`, e.message);
        return false;
    }
}

/**
 * Carica tutte le app disponibili in src/apps/.
 * Chiamato all'avvio dopo che il DB core è stato sbloccato.
 * Salta silenziosamente le app senza backend.js (solo manifest/frontend).
 */
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
        } catch(e) {
            console.error('[AppLoader] Impossibile leggere il db store:', e.message);
        }

        let dbChanged = false;
        
        // Auto-Seeding per le app bundled
        for (const m of manifests) {
            if (m.bundled && !installedIds.has(m.id) && db) {
                console.log(`[AppLoader] Auto-seeding bundled app: ${m.id}`);
                try {
                    db.run(
                        'INSERT INTO installed_apps (app_id, version, installed_at, installed_by, status) VALUES (?, ?, ?, ?, ?)',
                        [m.id, m.version || '0.0.0', Math.floor(Date.now() / 1000), 'system', 'active']
                    );
                    installedIds.add(m.id);
                    dbChanged = true;
                } catch (e) {
                    console.error(`[AppLoader] Errore auto-seeding ${m.id}:`, e.message);
                }
            }
        }

        if (dbChanged) {
            await saveDB('store');
        }

        let loaded = 0;
        let considered = 0;

        for (const manifest of manifests) {
            // Strict Loading: carica solo app di sistema (core) o app installate (DB)
            if (manifest.core || installedIds.has(manifest.id)) {
                considered++;
                const ok = await loadApp(manifest);
                if (ok) loaded++;
            }
        }

        console.log(`[AppLoader] ${loaded}/${considered} app caricate (su ${manifests.length} totali trovate).`);
        return loaded;
    } catch (e) {
        console.error('[AppLoader] Errore nel caricamento delle app:', e.message);
        return 0;
    }
}

function getLoaded()         { return Array.from(_loaded.keys()); }
function isLoaded(appId)     { return _loaded.has(appId); }
function getManifest(appId)  { return _loaded.get(appId)?.manifest || null; }

module.exports = { loadApp, unloadApp, loadAllInstalledApps, getLoaded, isLoaded, getManifest };
