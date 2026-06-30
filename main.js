process.env.TZ = 'Europe/Rome';

// Scudo globale: impedisce il crash dell'app su errori di rete non gestiti
// (es. mDNS EHOSTUNREACH su adattatori virtuali Hyper-V/VirtualBox/VPN)
const NETWORK_ERROR_CODES = new Set(['EHOSTUNREACH', 'ENETUNREACH', 'EADDRNOTAVAIL', 'ENOBUFS', 'EINVAL', 'ENOTFOUND', 'ECONNREFUSED', 'ETIMEDOUT']);
process.on('uncaughtException', (err) => {
    if (NETWORK_ERROR_CODES.has(err.code)) {
        try { require('./backend/logger').logError('[Network] Uncaught network error (handled): ' + err.message); } catch(_) {}
        return;
    }
    try { require('./backend/logger').logError('[Uncaught Exception] ' + (err.stack || err.message)); } catch(_) {}
    console.error('[Uncaught Exception]', err);
});
process.on('unhandledRejection', (reason) => {
    const msg = reason instanceof Error ? reason.message : String(reason);
    if (reason instanceof Error && NETWORK_ERROR_CODES.has(reason.code)) return;
    try { require('./backend/logger').logError('[Unhandled Rejection] ' + msg); } catch(_) {}
    console.error('[Unhandled Rejection]', reason);
});

const { app, BrowserWindow, ipcMain, Menu, Tray, nativeImage, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { setupLogger } = require('./backend/logger');
setupLogger();
const authHandlers = require('./backend/handlers/auth');
const configHandlers = require('./backend/config');

let mainWindow;
let tray = null;
let isQuiting = false;

function createMenu() {
    try {
        const template = [
            { label: 'File', submenu: [{ role: 'quit', label: 'Esci' }] },
            { label: 'Modifica', submenu: [{ role: 'undo', label: 'Annulla' }, { role: 'redo', label: 'Ripeti' }, { type: 'separator' }, { role: 'cut', label: 'Taglia' }, { role: 'copy', label: 'Copia' }, { role: 'paste', label: 'Incolla' }] },
            { label: 'Visualizza', submenu: [{ role: 'reload', label: 'Ricarica' }, { role: 'toggledevtools', label: 'Strumenti per sviluppatori' }, { type: 'separator' }, { role: 'resetzoom', label: 'Zoom predefinito' }, { role: 'zoomin', label: 'Aumenta zoom' }, { role: 'zoomout', label: 'Riduci zoom' }, { type: 'separator' }, { role: 'togglefullscreen', label: 'Schermo intero' }] },
            { label: 'Finestra', submenu: [{ role: 'minimize', label: 'Riduci a icona' }, { role: 'zoom', label: 'Ingrandisci' }] },
            { 
                label: 'Aiuto', 
                submenu: [
                    { 
                        label: 'Verifica aggiornamenti', 
                        click: () => {
                            const { autoUpdater } = require('electron-updater');
                            autoUpdater.checkForUpdatesAndNotify();
                        }
                    },
                    { type: 'separator' },
                    { 
                        label: 'Apri pagina GitHub', 
                        click: async () => {
                            const { shell } = require('electron');
                            await shell.openExternal('https://github.com/AprileNunzio/Adestio');
                        }
                    }
                ] 
            }
        ];
        const menu = Menu.buildFromTemplate(template);
        Menu.setApplicationMenu(menu);
    } catch (e) {
        console.error(e);
    }
}

async function createWindow() {
    try {

        ipcMain.removeHandler('window-minimize');
        ipcMain.handle('window-minimize', () => mainWindow.minimize());

        ipcMain.removeHandler('window-maximize');
        ipcMain.handle('window-maximize', () => {
            if (mainWindow.isMaximized()) {
                mainWindow.restore();
            } else {
                mainWindow.maximize();
            }
        });

        ipcMain.removeHandler('window-close');
        ipcMain.handle('window-close', () => mainWindow.close());

        ipcMain.removeHandler('getLocalIPs');
        ipcMain.handle('getLocalIPs', () => {
            const os = require('os');
            const interfaces = os.networkInterfaces();
            const ips = [];
            for (const name of Object.keys(interfaces)) {
                for (const iface of interfaces[name]) {
                    if (iface.family === 'IPv4' && !iface.internal) {
                        ips.push(iface.address);
                    }
                }
            }
            return ips;
        });

        ipcMain.removeHandler('getAppStatus');
        ipcMain.handle('getAppStatus', () => {
            try {
                const { getConnectedNodesCount, PROTOCOL_VERSION } = require('./backend/sync');
                let sState = 'Sincronizzato';
                try {
                    const { getSyncState } = require('./backend/sync_engine');
                    if (typeof getSyncState === 'function') sState = getSyncState();
                } catch(e) {}
                const nodesCount = typeof getConnectedNodesCount === 'function' ? getConnectedNodesCount() : 0;
                let height = 0;
                try {
                    const { getAllBlocks } = require('./backend/blockchain');
                    if (typeof getAllBlocks === 'function') height = getAllBlocks().length;
                } catch(e) {}
                return { version: app.getVersion(), connectedNodes: nodesCount, isOk: true, syncState: sState, protocolVersion: PROTOCOL_VERSION || 2, ledgerHeight: height };
            } catch(e) { 
                return { version: app.getVersion(), connectedNodes: 0, isOk: true, syncState: 'Sincronizzato', protocolVersion: 2, ledgerHeight: 0 };
            }
        });

        ipcMain.removeHandler('resetApp');
        ipcMain.handle('resetApp', async () => {
            try {
                const fsMod = require('fs');
                const pathsToWipe = [
                    path.join(app.getPath('appData'), 'NunzioTech', 'Adestio'),
                    path.join(app.getPath('documents'), 'NunzioTech', 'Adestio')
                ];
                for (const p of pathsToWipe) {
                    try {
                        if (fsMod.existsSync(p)) fsMod.rmSync(p, { recursive: true, force: true });
                    } catch(rmErr) { console.error('[Reset] rmSync error:', rmErr); }
                }
                const configPath = path.join(app.getPath('documents'), 'NunzioTech', 'Adestio', 'config.enc');
                try { if (fsMod.existsSync(configPath)) fsMod.unlinkSync(configPath); } catch(_) {}
                app.relaunch();
                app.exit();
            } catch(e) { console.error(e); }
        });

        ipcMain.removeHandler('dbGetBackupStatus');
        ipcMain.handle('dbGetBackupStatus', () => {
            try {
                const fsMod = require('fs');
                const getInfo = (dir) => {
                    if (!fsMod.existsSync(dir)) return [];
                    return fsMod.readdirSync(dir)
                        .filter(f => f.startsWith('database_') && f.endsWith('.enc'))
                        .map(f => {
                            const ts = parseInt(f.replace('database_', '').replace('.enc', '')) || 0;
                            const stat = fsMod.statSync(path.join(dir, f));
                            return { name: f, ts, size: stat.size, date: new Date(ts).toLocaleString('it-IT') };
                        })
                        .sort((a, b) => b.ts - a.ts);
                };
                const appDataBackups = getInfo(path.join(app.getPath('appData'), 'NunzioTech', 'Adestio', 'backups'));
                const docsBackups = getInfo(path.join(app.getPath('documents'), 'NunzioTech', 'Adestio', 'backups'));
                const primaryAppData = path.join(app.getPath('appData'), 'NunzioTech', 'Adestio', 'database.enc');
                const primaryDocs = path.join(app.getPath('documents'), 'NunzioTech', 'Adestio', 'database.enc');
                return {
                    primary: {
                        appData: fsMod.existsSync(primaryAppData) ? fsMod.statSync(primaryAppData).size : null,
                        docs: fsMod.existsSync(primaryDocs) ? fsMod.statSync(primaryDocs).size : null
                    },
                    backups: { appData: appDataBackups, docs: docsBackups },
                    totalBackups: appDataBackups.length + docsBackups.length
                };
            } catch(e) { console.error(e); return null; }
        });

        const isHiddenBoot = process.argv.includes('--hidden');
        mainWindow = new BrowserWindow({
            width: 1200,
            height: 800,
            minHeight: 600,
            frame: false,
            show: !isHiddenBoot,
            webPreferences: {
                preload: path.join(__dirname, 'preload.js'),
                nodeIntegration: false,
                contextIsolation: true
            }
        });

        mainWindow.on('close', (event) => {
            if (!isQuiting) {
                event.preventDefault();
                mainWindow.hide();
                mainWindow.webContents.executeJavaScript(`
                    sessionStorage.clear();
                    if (window.Router) window.Router.navigate('auth_login');
                    else window.location.reload();
                `).catch(() => {});
                event.returnValue = false;
            }
        });

        mainWindow.setMenu(null);
        mainWindow.maximize();
        mainWindow.loadFile('src/index.html');
    } catch (e) {
        console.error(e);
    }
}

try {
    app.whenReady().then(async () => {
        try {

            ipcMain.handle('hasConfig', configHandlers.hasConfig);
            ipcMain.handle('readConfig', configHandlers.readConfig);
            ipcMain.handle('saveConfig', configHandlers.saveConfig);

            ipcMain.handle('checkIsRegistered', authHandlers.checkIsRegistered);
            ipcMain.handle('registerUser', authHandlers.registerUser);
            ipcMain.handle('loginUser', authHandlers.loginUser);
            ipcMain.handle('unlockDatabase', async (event, args) => {
                const result = await authHandlers.unlockDatabase(event, args);
                if (result && result.success) {
                    // DB ora disponibile: ricarica peer cache da DB (sovrascrive file JSON)
                    setTimeout(() => {
                        try { require('./backend/sync').loadPeerCache(); } catch(_) {}
                    }, 500);
                }
                return result;
            });
            ipcMain.handle('getUsersList', authHandlers.getUsersList);
            ipcMain.handle('getNetworkCode', authHandlers.getNetworkCode);
            ipcMain.handle('scanNodes', authHandlers.handleScanNodes);
            ipcMain.handle('cloneNetwork', authHandlers.handleCloneNetwork);
            ipcMain.handle('checkNetworkProfile', authHandlers.checkNetworkProfile);
            ipcMain.handle('pingNode', authHandlers.handlePingNode);
            ipcMain.handle('forceSync', async () => {
                const { triggerFullResync } = require('./backend/sync_engine');
                triggerFullResync();
                return true;
            });
            ipcMain.handle('ping', () => 'Pong da Electron!');

            ipcMain.removeHandler('getDetailedNodes');
            ipcMain.handle('getDetailedNodes', async () => {
                try {
                    const { getDetailedNodes } = require('./backend/sync');
                    return getDetailedNodes();
                } catch(e) { return []; }
            });

            ipcMain.removeHandler('getExtendedNodeMetrics');
            ipcMain.handle('getExtendedNodeMetrics', async () => {
                try {
                    const { getExtendedNodeMetrics } = require('./backend/handlers/nodes');
                    return getExtendedNodeMetrics();
                } catch (e) { return null; }
            });

            ipcMain.removeHandler('getNodeId');
            ipcMain.handle('getNodeId', () => {
                try {
                    const { getNodeId } = require('./backend/db');
                    return getNodeId();
                } catch(e) { return null; }
            });

            ipcMain.removeHandler('blockchainFullResync');
            ipcMain.handle('blockchainFullResync', async (event, data) => {
                try {
                    const { triggerFullResync } = require('./backend/sync_engine');
                    const { host, port } = data || {};
                    if (!host || !port) return { success: false, error: 'Parametri mancanti' };
                    const success = await triggerFullResync(host, port);
                    return { success };
                } catch(e) {
                    console.error(e);
                    return { success: false, error: e.message };
                }
            });

            ipcMain.removeHandler('blockchainRebuild');
            ipcMain.handle('blockchainRebuild', async () => {
                try {
                    const { rebuildStateFromLog } = require('./backend/blockchain');
                    const success = rebuildStateFromLog();
                    return { success };
                } catch(e) {
                    console.error(e);
                    return { success: false, error: e.message };
                }
            });

            ipcMain.handle('checkForUpdates', async () => {
                try {
                    const { autoUpdater } = require('electron-updater');
                    await autoUpdater.checkForUpdatesAndNotify();
                } catch (e) {
                    console.error('[Updater IPC] Error:', e.message);
                }
            });
            ipcMain.handle('forceP2PUpdate', async (event, peerIp) => {
                try {
                    const http = require('http');
                    const fs = require('fs');
                    const updatesDir = path.join(app.getPath('userData'), 'updates');
                    if (!fs.existsSync(updatesDir)) fs.mkdirSync(updatesDir, { recursive: true });
                    const destPath = path.join(updatesDir, 'Adestio-Setup-latest.exe');

                    const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
                    if (win) win.webContents.send('update-status', { status: 'Downloading from P2P node...' });

                    return new Promise((resolve) => {
                        const req = http.get(`http://${peerIp}:34567/sync/update`, (res) => {
                            if (res.statusCode !== 200) {
                                if (win) win.webContents.send('update-status', { status: 'P2P update not found. Falling back to GitHub...' });
                                const { autoUpdater } = require('electron-updater');
                                autoUpdater.checkForUpdatesAndNotify();
                                return resolve({ success: false, fallback: true });
                            }

                            const total = parseInt(res.headers['content-length'] || '0', 10);
                            let downloaded = 0;
                            const fileStream = fs.createWriteStream(destPath);

                            res.on('data', (chunk) => {
                                downloaded += chunk.length;
                                if (total > 0 && win) {
                                    win.webContents.send('update-download-progress', {
                                        percent: (downloaded / total) * 100,
                                        transferred: downloaded,
                                        total: total
                                    });
                                }
                            });

                            res.pipe(fileStream);

                            fileStream.on('finish', () => {
                                fileStream.close();
                                if (win) win.webContents.send('update-status', { status: 'Download completato. Riavvio in corso...' });

                                setTimeout(() => {
                                    const { exec } = require('child_process');
                                    exec(`"${destPath}" /S`, (err) => {
                                        if (!err) app.quit();
                                    });
                                }, 1000);
                                resolve({ success: true });
                            });
                        });
                        req.on('error', (err) => {
                            if (win) win.webContents.send('update-status', { status: 'P2P network error. Falling back to GitHub...' });
                            const { autoUpdater } = require('electron-updater');
                            autoUpdater.checkForUpdatesAndNotify();
                            resolve({ success: false, fallback: true });
                        });
                    });
                } catch (e) {
                    console.error('[P2P Updater Error]', e);
                    return { success: false };
                }
            });
            ipcMain.handle('announce-local-update', async () => {
                try {
                    const currentVersion = app.getVersion();
                    const distPath = path.join(__dirname, 'dist');
                    if (!fs.existsSync(distPath)) {
                        return { success: false, error: `Cartella dist/ non trovata. Esegui prima: npm run build:local` };
                    }
                    // Cerca installer con nome canonico o qualsiasi .exe Adestio nella dist/
                    const canonicalName = `Adestio-Setup-${currentVersion}.exe`;
                    let installerPath = path.join(distPath, canonicalName);
                    if (!fs.existsSync(installerPath)) {
                        const files = fs.readdirSync(distPath).filter(f => f.endsWith('.exe') && /adestio/i.test(f));
                        if (files.length === 0) {
                            return { success: false, error: `Nessun installer trovato in dist/. Esegui: npm run build:local` };
                        }
                        installerPath = path.join(distPath, files[0]);
                    }
                    const { announceLocalUpdate } = require('./backend/sync');
                    announceLocalUpdate(currentVersion, installerPath);
                    return { success: true, version: currentVersion, installer: installerPath };
                } catch(e) {
                    console.error('[IPC] announce-local-update error:', e);
                    return { success: false, error: e.message };
                }
            });

            ipcMain.handle('openGitHub', async () => {
                const { shell } = require('electron');
                await shell.openExternal('https://github.com/AprileNunzio/Adestio');
            });
            ipcMain.handle('logError', (event, errorMsg) => {
                const { logError } = require('./backend/logger');
                logError("[FRONTEND] " + errorMsg);
            });
            ipcMain.handle('toggleDevTools', () => {
                const win = BrowserWindow.getFocusedWindow();
                if (win) win.webContents.toggleDevTools();
            });

            const diagnosticsHandlers = require('./backend/handlers/diagnostics');
            ipcMain.handle('runDiagnostics', (e) => diagnosticsHandlers.runDiagnostics(e));
            ipcMain.handle('fixDiagnostics', (e) => diagnosticsHandlers.fixDiagnostics(e));

            const usersHandlers = require('./backend/handlers/users');
            ipcMain.handle('usersGetAll', (e, args) => usersHandlers.getAll(e, args));
            ipcMain.handle('usersCreate', (e, args) => usersHandlers.create(e, args));
            ipcMain.handle('usersUpdate', (e, args) => usersHandlers.update(e, args));
            ipcMain.handle('usersDelete', (e, args) => usersHandlers.remove(e, args));
            ipcMain.handle('usersRestore', (e, args) => usersHandlers.restore(e, args));
            ipcMain.handle('usersHardDelete', (e, args) => usersHandlers.hardDelete(e, args));

            const rbacHandlers = require('./backend/handlers/rbac');
            ipcMain.handle('rbac:getAllUsers', (e) => rbacHandlers.getAllUsers(e));
            ipcMain.handle('rbac:getAllRoles', (e) => rbacHandlers.getAllRoles(e));
            ipcMain.handle('rbac:createRole', (e, name, desc) => rbacHandlers.createRole(e, name, desc));
            ipcMain.handle('rbac:assignRoleToUser', (e, userId, roleId) => rbacHandlers.assignRoleToUser(e, userId, roleId));
            ipcMain.handle('rbac:removeRoleFromUser', (e, userId, roleId) => rbacHandlers.removeRoleFromUser(e, userId, roleId));

            ipcMain.handle('rbac:syncPermissionsFromManifests', (e) => rbacHandlers.syncPermissionsFromManifests(e));
            ipcMain.handle('rbac:getAllGroups', (e) => rbacHandlers.getAllGroups(e));
            ipcMain.handle('rbac:createGroup', (e, name, desc, isSuperadmin) => rbacHandlers.createGroup(e, name, desc, isSuperadmin));
            ipcMain.handle('rbac:getGroupPermissions', (e, groupId) => rbacHandlers.getGroupPermissions(e, groupId));
            ipcMain.handle('rbac:getUserPermissions', (e, userId) => rbacHandlers.getUserPermissions(e, userId));
            ipcMain.handle('rbac:getEffectiveUserPermissions', (e, userId) => rbacHandlers.getEffectiveUserPermissions(e, userId));
            ipcMain.handle('rbac:setGroupPermission', (e, groupId, permId, val) => rbacHandlers.setGroupPermission(e, groupId, permId, val));
            ipcMain.handle('rbac:setUserPermission', (e, userId, permId, val) => rbacHandlers.setUserPermission(e, userId, permId, val));
            ipcMain.handle('rbac:getGroupUsers', (e, groupId) => rbacHandlers.getGroupUsers(e, groupId));
            ipcMain.handle('rbac:updateGroupUsers', (e, groupId, userIds) => rbacHandlers.updateGroupUsers(e, groupId, userIds));
            ipcMain.handle('getAppsRegistry', async () => {
                try {
                    const appsPath = path.join(__dirname, 'src', 'apps');
                    if (!fs.existsSync(appsPath)) return [];
                    const apps = [];
                    const dirs = fs.readdirSync(appsPath, { withFileTypes: true });
                    for (const d of dirs) {
                        if (d.isDirectory()) {
                            const manifestPath = path.join(appsPath, d.name, 'manifest.json');
                            if (fs.existsSync(manifestPath)) {
                                try {
                                    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
                                    manifest.folder = d.name; 
                                    manifest.id = manifest.id || d.name; 
                                    apps.push(manifest);
                                } catch(e) { console.error("Error parsing manifest", e); }
                            }
                        }
                    }
                    return apps;
                } catch(e) {
                    console.error("Error reading apps registry", e);
                    return [];
                }
            });

            ipcMain.handle('getSubAppsRegistry', async (event, appId) => {
                try {
                    const subAppsPath = path.join(__dirname, 'src', 'apps', appId, 'subapps');
                    if (!fs.existsSync(subAppsPath)) return [];
                    const apps = [];
                    const dirs = fs.readdirSync(subAppsPath, { withFileTypes: true });
                    for (const d of dirs) {
                        if (d.isDirectory()) {
                            const manifestPath = path.join(subAppsPath, d.name, 'manifest.json');
                            if (fs.existsSync(manifestPath)) {
                                try {
                                    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
                                    manifest.folder = d.name; 
                                    manifest.id = manifest.id || d.name; 
                                    apps.push(manifest);
                                } catch(e) { console.error("Error parsing subapp manifest", e); }
                            }
                        }
                    }
                    return apps;
                } catch(e) {
                    console.error("Error reading subapps registry", e);
                    return [];
                }
            });

            try {
                const { autoUnlockDB } = require('./backend/db');
                const unlocked = await autoUnlockDB();

                const { startSyncServer, ensureFirewallRule } = require('./backend/sync');
                ensureFirewallRule();
                startSyncServer();

                if (unlocked) {
                    try {
                        const { rebuildStateFromLog } = require('./backend/blockchain');
                        rebuildStateFromLog();
                    } catch(rbErr) { console.error('[Boot] rebuildStateFromLog error:', rbErr); }
                } else {
                    const registered = require('./backend/db').checkIsRegistered();
                    if (registered) {
                        console.error('[Boot] DB irrecuperabile localmente, avvio full resync automatico...');
                        setTimeout(async () => {
                            try {
                                const { getDetailedNodes } = require('./backend/sync');
                                const { triggerFullResync } = require('./backend/sync_engine');
                                const nodes = getDetailedNodes().filter(n => n.ip !== '127.0.0.1');
                                let recovered = false;
                                for (const node of nodes) {
                                    const ok = await triggerFullResync(node.ip, node.port);
                                    if (ok) { recovered = true; break; }
                                }
                                if (!recovered) {
                                    const win = BrowserWindow.getAllWindows()[0];
                                    if (win && !win.isDestroyed()) {
                                        win.webContents.send('db-recovery-failed', {
                                            message: 'Database locale irrecuperabile. Connettiti alla rete per ripristinare i dati oppure reimposta il nodo.'
                                        });
                                    }
                                }
                            } catch(recErr) { console.error('[Boot] Auto recovery error:', recErr); }
                        }, 8000);
                    }
                }
            } catch(err) { console.error('Error async boot:', err); }

            createWindow();

            const { autoUpdater } = require('electron-updater');

            try {
                const fs = require('fs');
                const path = require('path');
                const pendingDir = path.join(app.getPath('userData'), '../adestio-updater/pending');
                if (fs.existsSync(pendingDir)) {
                    fs.rmSync(pendingDir, { recursive: true, force: true });
                }
            } catch (e) {}

            autoUpdater.autoDownload = false;
            autoUpdater.autoInstallOnAppQuit = false;
            autoUpdater.disableWebInstaller = true;

            const updatesManager = require('./backend/updates_manager');
            let isDownloadingUpdate = false;

            autoUpdater.on('checking-for-update', () => {
                const win = BrowserWindow.getAllWindows()[0];
                if (win) win.webContents.send('update-status', { status: 'Ricerca aggiornamenti...' });
            });
            
            autoUpdater.on('update-available', async (info) => {
                if (isDownloadingUpdate) return;
                isDownloadingUpdate = true;
                
                const win = BrowserWindow.getAllWindows()[0];
                const targetVersion = info.version;
                
                if (win) win.webContents.send('update-status', { status: `Trovata v${targetVersion}. Ricerca in LAN...` });
                
                // Cerca in LAN prima di scaricare da GitHub
                try {
                    const { getDetailedNodes } = require('./backend/sync');
                    const nodes = getDetailedNodes().filter(n => n.ip !== '127.0.0.1');
                    const http = require('http');
                    let p2pSource = null;
                    
                    for (const node of nodes) {
                        try {
                            const p2pRes = await new Promise((resolve) => {
                                const req = http.get(`http://${node.ip}:${node.port}/sync/update-info`, { timeout: 2000 }, (res) => {
                                    let data = '';
                                    res.on('data', c => data += c);
                                    res.on('end', () => {
                                        try {
                                            const json = JSON.parse(data);
                                            resolve(json.version);
                                        } catch(e) { resolve(null); }
                                    });
                                });
                                req.on('error', () => resolve(null));
                                req.on('timeout', () => { req.destroy(); resolve(null); });
                            });
                            
                            if (p2pRes === targetVersion) {
                                p2pSource = node;
                                break;
                            }
                        } catch(e) {}
                    }
                    
                    if (p2pSource) {
                        // Trovato in LAN! Scarica via P2P
                        if (win) win.webContents.send('update-status', { status: `Download v${targetVersion} da nodo LAN ${p2pSource.name}...` });
                        
                        const req = http.get(`http://${p2pSource.ip}:${p2pSource.port}/sync/update/download/${targetVersion}`, async (res) => {
                            if (res.statusCode === 200) {
                                const total = parseInt(res.headers['content-length'] || '0', 10);
                                let downloaded = 0;
                                res.on('data', (chunk) => {
                                    downloaded += chunk.length;
                                    if (total > 0 && win) {
                                        win.webContents.send('update-download-progress', {
                                            percent: (downloaded / total) * 100,
                                            transferred: downloaded,
                                            total: total
                                        });
                                    }
                                });
                                
                                try {
                                    await updatesManager.saveInstallerFromStream(targetVersion, res);
                                    if (win) win.webContents.send('update-status', { status: 'Installazione in corso (P2P)...', finished: true });
                                    
                                    // Avvisa gli altri in LAN
                                    const { broadcastUpdateAvailable } = require('./backend/sync');
                                    if (typeof broadcastUpdateAvailable === 'function') broadcastUpdateAvailable(targetVersion);
                                    
                                    updatesManager.runInstaller(targetVersion);
                                } catch(e) {
                                    // Fallback a github se fallisce il salvataggio P2P
                                    if (win) win.webContents.send('update-status', { status: 'Errore P2P. Fallback su GitHub...' });
                                    autoUpdater.downloadUpdate();
                                }
                            } else {
                                autoUpdater.downloadUpdate();
                            }
                        });
                        req.on('error', () => {
                            autoUpdater.downloadUpdate();
                        });
                    } else {
                        // Nessun nodo ha l'aggiornamento, scarica da GitHub
                        if (win) win.webContents.send('update-status', { status: `Download v${targetVersion} da server globale...` });
                        autoUpdater.downloadUpdate();
                    }
                } catch(e) {
                    autoUpdater.downloadUpdate();
                }
            });
            
            autoUpdater.on('update-not-available', (info) => {
                const win = BrowserWindow.getAllWindows()[0];
                if (win) win.webContents.send('update-status', { status: 'Sei aggiornato all\'ultima versione.', finished: true });
                isDownloadingUpdate = false;
            });
            
            autoUpdater.on('error', (err) => {
                const win = BrowserWindow.getAllWindows()[0];
                if (win) win.webContents.send('update-status', { status: 'Errore durante la ricerca aggiornamenti.', finished: true });
                isDownloadingUpdate = false;
            });
            
            autoUpdater.on('download-progress', (progressObj) => {
                const win = BrowserWindow.getAllWindows()[0];
                if (win) {
                    win.webContents.send('update-download-progress', {
                        percent: progressObj.percent,
                        transferred: progressObj.transferred,
                        total: progressObj.total
                    });
                }
            });

            setTimeout(() => { autoUpdater.checkForUpdatesAndNotify().catch(e => console.error('[Updater]', e.message)); }, 15000); 
            setInterval(() => { autoUpdater.checkForUpdatesAndNotify().catch(e => console.error('[Updater]', e.message)); }, 4 * 60 * 60 * 1000); 

            autoUpdater.on('update-downloaded', async (info) => {
                isDownloadingUpdate = false;
                console.log('[Updater] Aggiornamento scaricato da GitHub! Riavvio silente...');
                const win = BrowserWindow.getAllWindows()[0];
                if (win) win.webContents.send('update-status', { status: 'Download completato. Installazione in background...', finished: true });
                
                try {
                    // Copiamo il file scaricato da electron-updater in updatesDir per fare da seed
                    const fs = require('fs');
                    if (info.downloadedFile && fs.existsSync(info.downloadedFile)) {
                        const stream = fs.createReadStream(info.downloadedFile);
                        await updatesManager.saveInstallerFromStream(info.version, stream);
                    }
                } catch(e) {}
                
                // Avvisiamo la rete locale
                try {
                    const { broadcastUpdateAvailable } = require('./backend/sync');
                    if (typeof broadcastUpdateAvailable === 'function') broadcastUpdateAvailable(info.version);
                } catch(e) {}
                
                isQuiting = true;
                
                // Eseguiamo il nostro installer con flag /S oppure usiamo quitAndInstall(true, true)
                // quitAndInstall(isSilent, isForceRunAfter) -> quitAndInstall(true, true) fa /S 
                setTimeout(() => autoUpdater.quitAndInstall(true, true), 1000);
            });

            app.setLoginItemSettings({
                openAtLogin: true,
                args: ['--hidden']
            });

            const gotTheLock = app.requestSingleInstanceLock();
            if (!gotTheLock) {
                app.quit();
                return;
            } else {
                app.on('second-instance', (event, commandLine, workingDirectory) => {
                    if (mainWindow) {
                        if (mainWindow.isMinimized()) mainWindow.restore();
                        mainWindow.show();
                        mainWindow.focus();
                    }
                });
            }

            try {
                const iconPath = path.join(__dirname, 'adestio.ico');
                tray = new Tray(iconPath);
                const contextMenu = Menu.buildFromTemplate([
                    { label: 'Apri Dashboard', click: () => { if (mainWindow) mainWindow.show(); } },
                    { label: 'Verifica Aggiornamenti', click: () => { autoUpdater.checkForUpdatesAndNotify().catch(e => console.error('[Updater]', e.message)); } },
                    { type: 'separator' },
                    { label: 'Termina Nodo e Chiudi', click: () => { isQuiting = true; app.quit(); } }
                ]);
                tray.setToolTip('Adestio Nodo P2P');
                tray.setContextMenu(contextMenu);
                tray.on('double-click', () => {
                    if (mainWindow) mainWindow.show();
                });
            } catch (err) {
                console.error('[Tray] Errore creazione tray:', err);
            }

            app.on('activate', () => {
                try {
                    if (BrowserWindow.getAllWindows().length === 0) {
                        createWindow();
                    } else if (mainWindow) {
                        mainWindow.show();
                    }
                } catch (e) {
                    console.error(e);
                }
            });
        } catch (e) {
            console.error(e);
        }
    });

    app.on('window-all-closed', () => {

    });
} catch (e) {
    console.error(e);
}
