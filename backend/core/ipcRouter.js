const { ipcMain, app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const authHandlers = require('../handlers/auth');
const configHandlers = require('../config');
const diagnosticsHandlers = require('../handlers/diagnostics');
const usersHandlers = require('../handlers/users');
const rbacHandlers = require('../handlers/rbac');
const appsRegistry = require('./appsRegistry');
function registerAllIPCHandlers(windowManager) {
    try {
        if (windowManager) {
            ipcMain.removeHandler('window-minimize');
            ipcMain.handle('window-minimize', () => {
                const win = windowManager.getMainWindow();
                if (win) win.minimize();
            });
            ipcMain.removeHandler('window-maximize');
            ipcMain.handle('window-maximize', () => {
                const win = windowManager.getMainWindow();
                if (win) {
                    if (win.isMaximized()) win.restore();
                    else win.maximize();
                }
            });
            ipcMain.removeHandler('window-close');
            ipcMain.handle('window-close', () => {
                const win = windowManager.getMainWindow();
                if (win) win.close();
            });
        }
        ipcMain.removeHandler('getLocalIPs');
        ipcMain.handle('getLocalIPs', () => {
            try {
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
            } catch(e) { return []; }
        });
        ipcMain.removeHandler('getAppStatus');
        ipcMain.handle('getAppStatus', () => {
            try {
                const { getConnectedNodesCount, PROTOCOL_VERSION } = require('../sync');
                let sState = 'Sincronizzato';
                try {
                    const { getSyncState } = require('../sync_engine');
                    if (typeof getSyncState === 'function') sState = getSyncState();
                } catch(e) {}
                const nodesCount = typeof getConnectedNodesCount === 'function' ? getConnectedNodesCount() : 0;
                let height = 0;
                try {
                    const { getAllBlocks } = require('../blockchain');
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
                const pathsToWipe = [
                    path.join(app.getPath('appData'), 'NunzioTech', 'Adestio'),
                    path.join(app.getPath('documents'), 'NunzioTech', 'Adestio')
                ];
                for (const p of pathsToWipe) {
                    try {
                        if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
                    } catch(rmErr) { console.error('[Reset] rmSync error:', rmErr); }
                }
                const configPath = path.join(app.getPath('documents'), 'NunzioTech', 'Adestio', 'config.enc');
                try { if (fs.existsSync(configPath)) fs.unlinkSync(configPath); } catch(_) {}
                app.relaunch();
                app.exit();
            } catch(e) { console.error(e); }
        });
        ipcMain.removeHandler('dbGetBackupStatus');
        ipcMain.handle('dbGetBackupStatus', () => {
            try {
                const getInfo = (dir) => {
                    if (!fs.existsSync(dir)) return [];
                    return fs.readdirSync(dir)
                        .filter(f => f.startsWith('database_') && f.endsWith('.enc'))
                        .map(f => {
                            const ts = parseInt(f.replace('database_', '').replace('.enc', '')) || 0;
                            const stat = fs.statSync(path.join(dir, f));
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
                        appData: fs.existsSync(primaryAppData) ? fs.statSync(primaryAppData).size : null,
                        docs: fs.existsSync(primaryDocs) ? fs.statSync(primaryDocs).size : null
                    },
                    backups: { appData: appDataBackups, docs: docsBackups },
                    totalBackups: appDataBackups.length + docsBackups.length
                };
            } catch(e) { console.error(e); return null; }
        });
        ipcMain.handle('hasConfig', configHandlers.hasConfig);
        ipcMain.handle('readConfig', configHandlers.readConfig);
        ipcMain.handle('saveConfig', configHandlers.saveConfig);
        ipcMain.handle('getAppsRegistry', appsRegistry.getAppsRegistry);
        ipcMain.handle('getSubAppsRegistry', appsRegistry.getSubAppsRegistry);
        ipcMain.handle('checkIsRegistered', authHandlers.checkIsRegistered);
        ipcMain.handle('registerUser', authHandlers.registerUser);
        ipcMain.handle('loginUser', authHandlers.loginUser);
        ipcMain.handle('unlockDatabase', async (event, args) => {
            const result = await authHandlers.unlockDatabase(event, args);
            if (result && result.success) {
                setTimeout(() => {
                    try { require('../sync').loadPeerCache(); } catch(_) {}
                }, 500);
            }
            return result;
        });
        ipcMain.handle('recoverDatabase', async (event, networkCode) => {
            try {
                const dbManager = require('../db/db_manager');
                const mAuth = require('../migrations/auth');
                const mConfig = require('../migrations/config');
                const mLedger = require('../migrations/ledger');
                const mApp = require('../migrations/app_data');
                
                dbManager.deviceKey = dbManager.loadOrGenerateLocalDeviceKey(networkCode);
                if (!dbManager.deviceKey) return { success: false, error: 'Errore crittografico locale' };
                
                await dbManager.loadDatabase('auth', mAuth);
                await dbManager.loadDatabase('config', mConfig);
                await dbManager.loadDatabase('ledger', mLedger);
                await dbManager.loadDatabase('app', mApp);
                await dbManager.saveAll();
                
                setTimeout(() => {
                    try { require('../sync').loadPeerCache(); } catch(_) {}
                }, 500);
                
                return { success: true };
            } catch (e) {
                return { success: false, error: 'Codice di rete errato o database corrotto.' };
            }
        });
        ipcMain.handle('getUsersList', authHandlers.getUsersList);
        ipcMain.handle('getNetworkCode', authHandlers.getNetworkCode);
        ipcMain.handle('scanNodes', authHandlers.handleScanNodes);
        ipcMain.handle('cloneNetwork', authHandlers.handleCloneNetwork);
        ipcMain.handle('checkNetworkProfile', authHandlers.checkNetworkProfile);
        ipcMain.handle('pingNode', authHandlers.handlePingNode);
        ipcMain.handle('forceSync', async () => {
            try {
                const { triggerFullResync } = require('../sync_engine');
                triggerFullResync();
                return true;
            } catch(e) { return false; }
        });
        ipcMain.handle('ping', () => 'Pong da Electron!');
        ipcMain.removeHandler('getDetailedNodes');
        ipcMain.handle('getDetailedNodes', async () => {
            try {
                const { getDetailedNodes } = require('../sync');
                return getDetailedNodes();
            } catch(e) { return []; }
        });
        ipcMain.removeHandler('getExtendedNodeMetrics');
        ipcMain.handle('getExtendedNodeMetrics', async () => {
            try {
                const { getExtendedNodeMetrics } = require('../handlers/nodes');
                return getExtendedNodeMetrics();
            } catch (e) { return null; }
        });
        ipcMain.removeHandler('getNodeId');
        ipcMain.handle('getNodeId', () => {
            try {
                const { getNodeId } = require('../db');
                return getNodeId();
            } catch(e) { return null; }
        });
        ipcMain.removeHandler('blockchainFullResync');
        ipcMain.handle('blockchainFullResync', async (event, data) => {
            try {
                const { triggerFullResync } = require('../sync_engine');
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
                const { rebuildStateFromLog } = require('../blockchain');
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
                const { autoUpdater } = require('electron-updater');
                const updatesDir = path.join(app.getPath('userData'), 'updates');
                if (!fs.existsSync(updatesDir)) fs.mkdirSync(updatesDir, { recursive: true });
                const destPath = path.join(updatesDir, 'Adestio-Setup-latest.exe');
                const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
                let expectedSha512 = null;
                try {
                    const checkResult = await autoUpdater.checkForUpdates();
                    expectedSha512 = checkResult && checkResult.updateInfo ? checkResult.updateInfo.sha512 : null;
                } catch (e) {}
                if (!expectedSha512) {
                    if (win) win.webContents.send('update-status', { status: 'Impossibile verificare l\'integrità. Uso GitHub...' });
                    autoUpdater.checkForUpdatesAndNotify();
                    return { success: false, fallback: true };
                }
                if (win) win.webContents.send('update-status', { status: 'Downloading from P2P node...' });
                return new Promise((resolve) => {
                    const req = http.get(`http://${peerIp}:34567/sync/update`, (res) => {
                        if (res.statusCode !== 200) {
                            if (win) win.webContents.send('update-status', { status: 'P2P update not found. Falling back to GitHub...' });
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
                            const crypto = require('crypto');
                            const actual = crypto.createHash('sha512').update(fs.readFileSync(destPath)).digest('base64');
                            if (actual !== expectedSha512) {
                                try { fs.unlinkSync(destPath); } catch (_) {}
                                if (win) win.webContents.send('update-status', { status: 'Verifica integrità fallita. Fallback su GitHub...' });
                                autoUpdater.checkForUpdatesAndNotify();
                                return resolve({ success: false, fallback: true });
                            }
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
                const distPath = path.join(__dirname, '../../dist');
                if (!fs.existsSync(distPath)) {
                    return { success: false, error: `Cartella dist/ non trovata. Esegui prima: npm run build:local` };
                }
                const canonicalName = `Adestio-Setup-${currentVersion}.exe`;
                let installerPath = path.join(distPath, canonicalName);
                if (!fs.existsSync(installerPath)) {
                    const files = fs.readdirSync(distPath).filter(f => f.endsWith('.exe') && /adestio/i.test(f));
                    if (files.length === 0) {
                        return { success: false, error: `Nessun installer trovato in dist/. Esegui: npm run build:local` };
                    }
                    installerPath = path.join(distPath, files[0]);
                }
                const { announceLocalUpdate } = require('../sync');
                announceLocalUpdate(currentVersion, installerPath);
                return { success: true, version: currentVersion, installer: installerPath };
            } catch(e) {
                console.error('[IPC] announce-local-update error:', e);
                return { success: false, error: e.message };
            }
        });
        ipcMain.handle('openGitHub', async () => {
            try {
                const { shell } = require('electron');
                await shell.openExternal('https://github.com/AprileNunzio/Adestio');
            } catch(e) {}
        });
        ipcMain.handle('logError', (event, errorMsg) => {
            try {
                const { logError } = require('../logger');
                logError("[FRONTEND] " + errorMsg);
            } catch(e) {}
        });
        ipcMain.handle('toggleDevTools', () => {
            try {
                const win = BrowserWindow.getFocusedWindow();
                if (win) win.webContents.toggleDevTools();
            } catch(e) {}
        });
        ipcMain.handle('runDiagnostics', (e) => diagnosticsHandlers.runDiagnostics(e));
        ipcMain.handle('fixDiagnostics', (e) => diagnosticsHandlers.fixDiagnostics(e));
        ipcMain.handle('usersGetAll', (e, args) => usersHandlers.getAll(e, args));
        ipcMain.handle('usersCreate', (e, args) => usersHandlers.create(e, args));
        ipcMain.handle('usersUpdate', (e, args) => usersHandlers.update(e, args));
        ipcMain.handle('usersDelete', (e, args) => usersHandlers.remove(e, args));
        ipcMain.handle('usersRestore', (e, args) => usersHandlers.restore(e, args));
        ipcMain.handle('usersHardDelete', (e, args) => usersHandlers.hardDelete(e, args));
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
    } catch (e) {
        console.error('[ipcRouter] Error registering handlers:', e);
    }
}
module.exports = { registerAllIPCHandlers };
