const { ipcMain, app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const _IPV4_RE = /^(\d{1,3}\.){3}\d{1,3}$/;
function _isValidPeerIp(ip) {
    if (typeof ip !== 'string' || !_IPV4_RE.test(ip)) return false;
    const parts = ip.split('.');
    if (parts.some(o => { const n = parseInt(o, 10); return isNaN(n) || n < 0 || n > 255; })) return false;
    if (parseInt(parts[0], 10) === 127) return false;
    if (parseInt(parts[0], 10) === 0) return false;
    return true;
}
const authHandlers = require('../handlers/auth');
const configHandlers = require('../config');
const diagnosticsHandlers = require('../handlers/diagnostics');
const usersHandlers = require('../handlers/users');
const rbacHandlers = require('../handlers/rbac');
const anagraficaPersoneHandlers = require('../handlers/anagrafica_persone');
const anagraficaDocumentiHandlers = require('../handlers/anagrafica_documenti');
const anagraficaResidenzaHandlers = require('../handlers/anagrafica_residenza');
const anagraficaLavoroHandlers = require('../handlers/anagrafica_lavoro');
const anagraficaTitoliStudioHandlers = require('../handlers/anagrafica_titoli_studio');
const anagraficaDatiBancariHandlers = require('../handlers/anagrafica_dati_bancari');
const anagraficaContattiHandlers = require('../handlers/anagrafica_contatti');
const anagraficaFamiliariHandlers = require('../handlers/anagrafica_familiari');
const anagraficaAuditHandlers = require('../handlers/anagrafica_audit');
const anagraficaRiferimentiHandlers = require('../handlers/anagrafica_riferimenti');
const twofaHandlers = require('../handlers/twofa');
const notificationsHandlers = require('../handlers/notifications');
const storeHandlers = require('../handlers/store');
const datiAziendaHandlers = require('../handlers/dati_azienda');
const appsRegistry = require('./appsRegistry');
const accessGuard = require('./access_guard');
function withActorBackend(args) {
    try {
        const sessionManager = require('./session_manager');
        const actorUserId = sessionManager.getCurrentUserId() || '';
        if (args && typeof args === 'object') {
            return Object.assign({}, args, { actorUserId });
        }
        return { actorUserId };
    } catch (e) {
        return { actorUserId: '' };
    }
}

function registerAllIPCHandlers(windowManager) {
    try {
        ipcMain.removeHandler('adestioNative:callAppApi');
        ipcMain.handle('adestioNative:callAppApi', async (event, data) => {
            try {
                const capabilityBroker = require('../security/capabilityBroker');
                if (!data || !data.sourceApp || !data.targetApp || !data.action) {
                    throw new Error('Parametri IPC non validi');
                }
                const result = await capabilityBroker.routeIpcCall(data.sourceApp, data.targetApp, data.action, data.payload);
                return { success: true, data: result };
            } catch (err) {
                console.error('[ipcRouter adestioNative:callAppApi Error]', err);
                return { success: false, error: err.message };
            }
        });

        if (windowManager) {
            ipcMain.removeHandler('window-minimize');
            ipcMain.handle('window-minimize', () => {
                try {
                    const win = windowManager.getMainWindow();
                    if (win && !win.isDestroyed()) win.minimize();
                } catch (e) {}
            });
            ipcMain.removeHandler('window-maximize');
            ipcMain.handle('window-maximize', () => {
                try {
                    const win = windowManager.getMainWindow();
                    if (win && !win.isDestroyed()) {
                        if (win.isMaximized()) win.restore();
                        else win.maximize();
                    }
                } catch (e) {}
            });
            ipcMain.removeHandler('window-close');
            ipcMain.handle('window-close', () => {
                try {
                    const win = windowManager.getMainWindow();
                    if (win && !win.isDestroyed()) win.close();
                } catch (e) {}
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
                let activeErrs = 0;
                try {
                    const { getAllBlocks } = require('../blockchain');
                    if (typeof getAllBlocks === 'function') height = getAllBlocks().length;
                } catch(e) {}
                try {
                    const db = require('../db').getDB('auth');
                    const res = db.query("SELECT COUNT(id) as c FROM distributed_logs WHERE is_deleted = 0 AND (level = 'error' OR level = 'warn')");
                    if (res && res.length > 0) activeErrs = res[0].c;
                } catch(e) {}
                return { version: app.getVersion(), connectedNodes: nodesCount, isOk: true, syncState: sState, protocolVersion: PROTOCOL_VERSION || 2, ledgerHeight: height, activeErrors: activeErrs };
            } catch(e) { 
                return { version: app.getVersion(), connectedNodes: 0, isOk: true, syncState: 'Sincronizzato', protocolVersion: 2, ledgerHeight: 0, activeErrors: 0 };
            }
        });
        ipcMain.removeHandler('resetApp');
        ipcMain.handle('resetApp', async () => {
            try {
                let allowed = false;
                try {
                    if (accessGuard.isSuperadmin()) allowed = true;
                    else {
                        const usersRes = db.getDB('auth')?.query('SELECT COUNT(*) as c FROM users');
                        if (usersRes && usersRes[0] && usersRes[0].c === 0) allowed = true;
                    }
                } catch(e) {
                    allowed = true; 
                }
                if (!allowed) return { success: false, error: 'Permesso negato' };
                const pathsToWipe = [
                    path.join(app.getPath('appData'), 'NunzioTech', 'Adestio'), 
                    path.join(app.getPath('userData'), 'dbs'),
                    path.join(app.getPath('userData'), 'Log'),
                    path.join(app.getPath('userData'), 'backups')
                ];
                for (const p of pathsToWipe) {
                    try {
                        if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
                    } catch(rmErr) { console.error('[Reset] rmSync error:', rmErr); }
                }
                const configPath = path.join(app.getPath('userData'), 'config.enc');
                const keyPath = path.join(app.getPath('userData'), 'device.key');
                try { if (fs.existsSync(configPath)) fs.unlinkSync(configPath); } catch(_) {}
                try { if (fs.existsSync(keyPath)) fs.unlinkSync(keyPath); } catch(_) {}
                app.relaunch();
                app.exit();
            } catch(e) { console.error(e); }
        });
        ipcMain.removeHandler('dbGetBackupStatus');
        ipcMain.handle('dbGetBackupStatus', () => {
            try {
                const dbBasePath = path.join(app.getPath('userData'), 'dbs');
                const getInfo = (dir) => {
                    if (!fs.existsSync(dir)) return [];
                    return fs.readdirSync(dir)
                        .map(f => {
                            const stat = fs.statSync(path.join(dir, f));
                            if (!stat.isFile()) return null;
                            return { name: f, size: stat.size };
                        }).filter(Boolean);
                };
                let totalMainSize = 0;
                let totalBackupsCount = 0;
                if (fs.existsSync(dbBasePath)) {
                    const domains = ['config.enc', 'auth.enc', 'ledger.enc', 'app.enc', 'store.enc', 'app_anagrafica.enc'];
                    for (const d of domains) {
                        const p = path.join(dbBasePath, d);
                        if (fs.existsSync(p)) totalMainSize += fs.statSync(p).size;
                    }
                    const backupsPath = path.join(dbBasePath, 'backups');
                    if (fs.existsSync(backupsPath)) {
                        const domainsDirs = fs.readdirSync(backupsPath);
                        for (const dDir of domainsDirs) {
                            const subDirPath = path.join(backupsPath, dDir);
                            if (fs.statSync(subDirPath).isDirectory()) {
                                const bks = getInfo(subDirPath);
                                totalBackupsCount += bks.length;
                            }
                        }
                    }
                }
                return {
                    primary: {
                        appData: totalMainSize,
                        docs: null
                    },
                    totalBackups: totalBackupsCount
                };
            } catch(e) { console.error(e); return null; }
        });
        ipcMain.handle('hasConfig', configHandlers.hasConfig);
        ipcMain.handle('readConfig', configHandlers.readConfig);
        ipcMain.handle('saveConfig', configHandlers.saveConfig);
        ipcMain.handle('testSmtpConnection', async (event, smtpConfig, testEmail) => {
            try {
                const nodemailer = require('nodemailer');
                let secure = false;
                if (smtpConfig.smtp_security === 'ssl' || smtpConfig.smtp_port == 465) secure = true;
                const transportOpts = {
                    host: smtpConfig.smtp_host,
                    port: parseInt(smtpConfig.smtp_port) || 587,
                    secure: secure,
                    auth: {
                        user: smtpConfig.smtp_user,
                        pass: smtpConfig.smtp_pass
                    },
                    tls: {
                        rejectUnauthorized: !smtpConfig.smtp_allow_self_signed
                    },
                    connectionTimeout: smtpConfig.smtp_timeout || 10000,
                    debug: true,
                    logger: true
                };
                if (smtpConfig.smtp_security === 'starttls') {
                    transportOpts.secure = false;
                    transportOpts.requireTLS = true;
                } else if (smtpConfig.smtp_security === 'none') {
                    transportOpts.secure = false;
                    transportOpts.ignoreTLS = true;
                }
                let logs = [];
                const transporter = nodemailer.createTransport(transportOpts);
                transporter.on('log', (log) => {
                    logs.push(`[${log.name}] ${log.msg}`);
                });
                const fromStr = smtpConfig.smtp_sender_name 
                    ? `"${smtpConfig.smtp_sender_name}" <${smtpConfig.smtp_sender_email}>` 
                    : smtpConfig.smtp_sender_email;
                await transporter.sendMail({
                    from: fromStr,
                    to: testEmail,
                    subject: 'Adestio Enterprise - Test Configurazione SMTP',
                    text: 'Se stai leggendo questo messaggio, la configurazione del server SMTP in Adestio è funzionante.',
                    html: '<div style="font-family: sans-serif; padding: 20px;"><h2>Adestio Enterprise</h2><p>Se stai leggendo questo messaggio, la configurazione del server SMTP in Adestio è funzionante e attiva.</p></div>'
                });
                return { success: true, logs: logs.join('\\n') };
            } catch(e) {
                console.error('[SMTP Test Error]', e);
                return { success: false, error: e.message };
            }
        });
        ipcMain.handle('sendMail', async (event, mail) => {
            try {
                if (!mail || !mail.to) return { success: false, error: 'Destinatario mancante' };
                const smtpConfig = configHandlers.readConfig() || {};
                if (!smtpConfig.smtp_host || !smtpConfig.smtp_port) {
                    return { success: false, error: 'Server SMTP non configurato. Vai in Amministratore > SMTP.' };
                }
                const nodemailer = require('nodemailer');
                let secure = false;
                if (smtpConfig.smtp_security === 'ssl' || smtpConfig.smtp_port == 465) secure = true;
                const transportOpts = {
                    host: smtpConfig.smtp_host,
                    port: parseInt(smtpConfig.smtp_port) || 587,
                    secure: secure,
                    auth: { user: smtpConfig.smtp_user, pass: smtpConfig.smtp_pass },
                    tls: { rejectUnauthorized: !smtpConfig.smtp_allow_self_signed },
                    connectionTimeout: smtpConfig.smtp_timeout || 10000
                };
                if (smtpConfig.smtp_security === 'starttls') {
                    transportOpts.secure = false;
                    transportOpts.requireTLS = true;
                } else if (smtpConfig.smtp_security === 'none') {
                    transportOpts.secure = false;
                    transportOpts.ignoreTLS = true;
                }
                const transporter = nodemailer.createTransport(transportOpts);
                const fromStr = smtpConfig.smtp_sender_name
                    ? `"${smtpConfig.smtp_sender_name}" <${smtpConfig.smtp_sender_email}>`
                    : smtpConfig.smtp_sender_email;
                const attachments = Array.isArray(mail.attachments) ? mail.attachments.map(a => ({
                    filename: a.filename,
                    content: a.contentBase64 ? Buffer.from(a.contentBase64, 'base64') : undefined,
                    path: a.path || undefined
                })) : [];
                const info = await transporter.sendMail({
                    from: fromStr,
                    to: mail.to,
                    cc: mail.cc || undefined,
                    subject: mail.subject || '(nessun oggetto)',
                    text: mail.text || '',
                    html: mail.html || undefined,
                    attachments
                });
                return { success: true, messageId: info.messageId };
            } catch (e) {
                console.error('[SendMail Error]', e);
                return { success: false, error: e.message };
            }
        });
        ipcMain.handle('getAppsRegistry', appsRegistry.getAppsRegistry);
        ipcMain.handle('getUiExtensions', async (event, target) => {
            try {
                const manifests = await appsRegistry.getAppsRegistry();
                const db = require('../db').getDB('store');
                const installedIds = db.query("SELECT app_id FROM installed_apps WHERE status = 'active'").map(r => r.app_id);
                
                const extensions = [];
                for (const manifest of manifests) {
                    if (manifest.core || installedIds.includes(manifest.id)) {
                        if (manifest.ui_injections && Array.isArray(manifest.ui_injections)) {
                            for (const inj of manifest.ui_injections) {
                                if (inj.target === target) {
                                    extensions.push({
                                        appId: manifest.id,
                                        ...inj
                                    });
                                }
                            }
                        }
                    }
                }
                return { success: true, extensions };
            } catch(e) {
                return { success: false, error: e.message };
            }
        });
        ipcMain.handle('getSubAppsRegistry', appsRegistry.getSubAppsRegistry);
        ipcMain.handle('store:getAvailable', () => storeHandlers.getAvailable());
        ipcMain.handle('store:getInstalled', () => storeHandlers.getInstalled());
        ipcMain.handle('store:getCoreApps', () => storeHandlers.getCoreApps());
        ipcMain.handle('store:install', (e, appId) => storeHandlers.install(e, appId));
        ipcMain.handle('store:uninstall', (e, appId) => storeHandlers.uninstall(e, appId));
        ipcMain.handle('store:checkUpdates', () => storeHandlers.checkUpdates());
        ipcMain.handle('store:getUpdateQueue', () => {
            try {
                const AppUpdateManager = require('./AppUpdateManager');
                return { success: true, data: AppUpdateManager.getQueueStatus() };
            } catch (e) {
                return { success: false, error: e.message };
            }
        });
        ipcMain.handle('store:getAppUpdateState', (e, appId) => {
            try {
                const AppUpdateManager = require('./AppUpdateManager');
                return { success: true, data: AppUpdateManager.getAppState(appId) };
            } catch (e) {
                return { success: false, error: e.message };
            }
        });
        ipcMain.handle('store:isAppLocked', (e, appId) => {
            try {
                const AppUpdateManager = require('./AppUpdateManager');
                return { success: true, locked: AppUpdateManager.isLocked(appId) };
            } catch (e) {
                return { success: false, locked: false };
            }
        });
        ipcMain.handle('store:forceCheckUpdates', () => {
            try {
                const AppUpdateManager = require('./AppUpdateManager');
                AppUpdateManager.forceCheckNow();
                return { success: true };
            } catch (e) {
                return { success: false, error: e.message };
            }
        });
        ipcMain.handle('store:listRepositories', () => storeHandlers.listRepositories());
        ipcMain.handle('store:addRepository', (e, args) => storeHandlers.addRepository(e, args));
        ipcMain.handle('store:removeRepository', (e, id) => storeHandlers.removeRepository(e, id));
        ipcMain.handle('store:setRepositoryEnabled', (e, args) => storeHandlers.setRepositoryEnabled(e, args));
        ipcMain.handle('get_system_logs', () => storeHandlers.getSystemLogs());
        ipcMain.handle('clear_system_logs', () => storeHandlers.clearSystemLogs());
        ipcMain.handle('delete_system_log', (e, id) => storeHandlers.deleteSystemLog(id));

        ipcMain.handle('forceNetworkDatabaseSync', async (event) => {
            try {
                if (!accessGuard.isSuperadmin()) return { success: false, error: 'Permesso negato' };
                const { broadcastForceResync } = require('../p2p');
                broadcastForceResync();
                const { getDetailedNodes } = require('../sync');
                const { getNetworkCodeHash } = require('../db');
                const nodes = getDetailedNodes().filter(n => n.ip !== '127.0.0.1');
                const http = require('http');
                const { getLocalIPs } = require('../p2p/discovery/arp_scanner');
                const myIps = getLocalIPs();
                const myIp = myIps.length > 0 ? myIps[0] : '127.0.0.1';
                const networkHash = await getNetworkCodeHash();
                nodes.forEach(node => {
                    const req = http.request(`http://${node.ip}:${node.port || 34567}/sync/force-nuke`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'x-adestio-network': networkHash || '' },
                        timeout: 3000
                    });
                    req.on('error', () => {});
                    req.write(JSON.stringify({ senderIp: myIp }));
                    req.end();
                });
                return { success: true };
            } catch(e) {
                return { success: false, error: e.message };
            }
        });
        ipcMain.handle('checkIsRegistered', authHandlers.checkIsRegistered);
        ipcMain.handle('registerUser', authHandlers.registerUser);
        ipcMain.handle('loginUser', authHandlers.loginUser);
        ipcMain.handle('loginUserVerify2fa', (e, data) => authHandlers.loginUserVerify2fa(e, data));
        ipcMain.handle('loginWebauthnOptions', (e, data) => authHandlers.loginWebauthnOptions(e, data));
        ipcMain.handle('logoutUser', (e, data) => authHandlers.logoutUser(e, data));
        ipcMain.handle('getAccessLogs', async (event, requestedUserId) => {
            try {
                const sessionManager = require('./session_manager');
                const sessionUserId = sessionManager.getCurrentUserId();
                if (!sessionUserId) return { success: false, error: 'Non autenticato' };
                const { isSuperadmin } = require('./access_guard');
                const targetUserId = (isSuperadmin() && requestedUserId) ? requestedUserId : sessionUserId;
                const db = require('../db').getDB('auth');
                const logs = db.query('SELECT * FROM access_logs WHERE user_id = ? ORDER BY timestamp DESC LIMIT 50', [targetUserId]);
                return { success: true, logs };
            } catch(e) {
                return { success: false, error: 'Errore interno' };
            }
        });
        ipcMain.handle('getAllAccessLogs', (e, filters) => authHandlers.getAllAccessLogs(e, filters));
        ipcMain.handle('getAccessLogsStats', (e, actorUserId) => authHandlers.getAccessLogsStats(e, actorUserId));
        ipcMain.handle('broadcastLogin', async (event, userId) => {
            try {
                const { getNodeId, getNetworkName } = require('./node_identity');
                const os = require('os');
                let ipAddress = '127.0.0.1';
                const ifaces = os.networkInterfaces();
                for (const name of Object.keys(ifaces)) {
                    for (const iface of ifaces[name]) {
                        if (iface.family === 'IPv4' && !iface.internal) {
                            ipAddress = iface.address;
                            break;
                        }
                    }
                }
                const { broadcastToAll } = require('../p2p/protocol/rpc');
                const pool = require('../p2p/transport/connection_pool');
                broadcastToAll(pool.getAll(), 'user_logged_in', { 
                    userId, 
                    nodeId: getNodeId(), 
                    nodeName: getNetworkName(),
                    ipAddress,
                    deviceInfo: os.hostname() || 'Unknown'
                });
                return { success: true };
            } catch(e) {
                console.error('[IPC] Errore in broadcastLogin:', e.message);
                return { success: false, error: e.message };
            }
        });
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
                const mStore = require('../migrations/store');
                const mAnagrafica = require('../migrations/anagrafica');
                dbManager.deviceKey = dbManager.loadOrGenerateLocalDeviceKey(networkCode);
                if (!dbManager.deviceKey) return { success: false, error: 'Errore crittografico locale' };
                await dbManager.loadDatabase('auth', mAuth);
                await dbManager.loadDatabase('config', mConfig);
                await dbManager.loadDatabase('ledger', mLedger);
                await dbManager.loadDatabase('app', mApp);
                await dbManager.loadDatabase('store', mStore);
                await dbManager.loadDatabase('app_anagrafica', mAnagrafica);
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
                const { forceResync } = require('../sync');
                forceResync();
                return true;
            } catch(e) { console.error(e); return false; }
        });
        ipcMain.handle('openFirewallSettings', async () => {
            try {
                const { exec } = require('child_process');
                exec('control firewall.cpl');
                return true;
            } catch(e) { console.error(e); return false; }
        });
        ipcMain.handle('forceFirewallRules', async () => {
            try {
                const { exec } = require('child_process');
                const path = require('path');
                const exePath = process.execPath;
                const psScript = `
                    Remove-NetFirewallRule -DisplayName "Adestio*" -ErrorAction SilentlyContinue;
                    New-NetFirewallRule -DisplayName "Adestio" -Direction Inbound -Program "${exePath}" -Action Allow -Profile Any -Protocol TCP;
                    New-NetFirewallRule -DisplayName "Adestio UDP" -Direction Inbound -Program "${exePath}" -Action Allow -Profile Any -Protocol UDP;
                    New-NetFirewallRule -DisplayName "Adestio Out" -Direction Outbound -Program "${exePath}" -Action Allow -Profile Any -Protocol TCP;
                    New-NetFirewallRule -DisplayName "Adestio UDP Out" -Direction Outbound -Program "${exePath}" -Action Allow -Profile Any -Protocol UDP;
                `.replace(/\n/g, ' ');
                const command = `powershell.exe -WindowStyle Hidden -Command "Start-Process powershell.exe -ArgumentList '-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -Command "${psScript}"' -Verb RunAs -Wait"`;
                await new Promise((resolve, reject) => {
                    exec(command, (error, stdout, stderr) => {
                        if (error) reject(error);
                        else resolve();
                    });
                });
                return true;
            } catch(e) { console.error(e); return false; }
        });
        ipcMain.handle('ping', () => 'Pong da Electron!');
        ipcMain.removeHandler('getDetailedNodes');
        ipcMain.handle('getDetailedNodes', async () => {
            try {
                const { getDetailedNodes } = require('../sync');
                return getDetailedNodes();
            } catch(e) { return []; }
        });
        ipcMain.removeHandler('getNetworkSyncStatus');
        ipcMain.handle('getNetworkSyncStatus', async () => {
            try {
                const { getDetailedNodes } = require('../sync');
                const { getTotalBlocksCount } = require('../dag/graph/dag_store');
                const http = require('http');
                const localBlocks = getTotalBlocksCount();
                const nodes = getDetailedNodes().filter(n => n.ip !== '127.0.0.1');
                const fetchNodePing = (ip, port) => new Promise((resolve) => {
                    const req = http.get(`http://${ip}:${port}/ping`, { timeout: 2000 }, (res) => {
                        let data = '';
                        res.on('data', chunk => data += chunk);
                        res.on('end', () => {
                            try { resolve(JSON.parse(data)); } catch(e) { resolve(null); }
                        });
                    });
                    req.on('error', () => resolve(null));
                    req.on('timeout', () => { req.destroy(); resolve(null); });
                });
                const enrichedNodes = await Promise.all(nodes.map(async (node) => {
                    const pingData = await fetchNodePing(node.ip, node.port || 34567);
                    const remoteBlocks = pingData && pingData.blockCount ? pingData.blockCount : 0;
                    const syncPercentage = localBlocks > 0 ? Math.min(100, Math.round((remoteBlocks / localBlocks) * 100)) : (remoteBlocks > 0 ? 100 : 0);
                    return { ...node, remoteBlocks, syncPercentage };
                }));
                return { localBlocks, nodes: enrichedNodes };
            } catch(e) { return { localBlocks: 0, nodes: [] }; }
        });
        ipcMain.removeHandler('executeNodeAction');
        ipcMain.handle('executeNodeAction', async (event, { action, ip, port }) => {
            try {
                if (!accessGuard.isLoggedIn()) return { success: false, error: 'Permesso negato' };
                const p = port || 34567;
                if (action === 'soft_sync') {
                    const { triggerFullResync } = require('../sync_engine');
                    return { success: await triggerFullResync(ip, p) };
                } else if (action === 'hard_clone_from_remote') {
                    if (!accessGuard.isSuperadmin()) return { success: false, error: 'Permesso negato' };
                    const { forceNukeAndClone } = require('../p2p/index');
                    forceNukeAndClone(ip, p);
                    return { success: true };
                } else if (action === 'hard_clone_to_remote') {
                    if (!accessGuard.isSuperadmin()) return { success: false, error: 'Permesso negato' };
                    const http = require('http');
                    const { getLocalIPs } = require('../p2p/discovery/arp_scanner');
                    const { getNetworkCodeHash } = require('../db');
                    const myIps = getLocalIPs();
                    const myIp = myIps.length > 0 ? myIps[0] : '127.0.0.1';
                    const networkHash = await getNetworkCodeHash();
                    return new Promise((resolve) => {
                        const req = http.request(`http://${ip}:${p}/sync/force-nuke`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'x-adestio-network': networkHash || '' },
                            timeout: 3000
                        }, (res) => {
                            resolve({ success: res.statusCode === 200 });
                        });
                        req.on('error', (e) => resolve({ success: false, error: e.message }));
                        req.write(JSON.stringify({ senderIp: myIp }));
                        req.end();
                    });
                }
                return { success: false, error: 'Azione sconosciuta' };
            } catch (e) {
                return { success: false, error: e.message };
            }
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
                if (!_isValidPeerIp(host)) return { success: false, error: 'IP non valido' };
                const p = parseInt(port, 10);
                if (isNaN(p) || p < 1024 || p > 65535) return { success: false, error: 'Porta non valida' };
                const success = await triggerFullResync(host, p);
                return { success };
            } catch(e) {
                return { success: false, error: 'Errore interno' };
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
                const updaterService = require('./updaterService');
                if (updaterService.isUpdateInProgress && updaterService.isUpdateInProgress()) {
                    const win = BrowserWindow.getAllWindows()[0];
                    if (win) {
                        const pending = typeof updaterService.getPendingUpdateVersion === 'function' ? updaterService.getPendingUpdateVersion() : null;
                        if (pending) {
                            win.webContents.send('update-ready-for-install', { version: pending });
                        } else {
                            win.webContents.send('update-status', { status: 'Un aggiornamento è già in corso o in attesa di installazione.', finished: true });
                        }
                    }
                    return;
                }
                const { autoUpdater } = require('electron-updater');
                const win = BrowserWindow.getAllWindows()[0];
                let expectedSha512 = null;
                try {
                    const checkResult = await autoUpdater.checkForUpdates();
                    if (checkResult && checkResult.updateInfo && checkResult.updateInfo.version) {
                         expectedSha512 = checkResult.updateInfo.sha512;
                    }
                } catch(err) {}
                if (!expectedSha512) {
                    const updatesManager = require('../updates_manager');
                    const { getDetailedNodes } = require('../sync');
                    const nodes = getDetailedNodes().filter(n => n.ip !== '127.0.0.1');
                    const http = require('http');
                    let bestPeer = null;
                    let bestVersion = app.getVersion();
                    for (const node of nodes) {
                        try {
                            const p2pRes = await new Promise((resolve) => {
                                const req = http.get(`http://${node.ip}:${node.port || 34567}/sync/update-info`, { timeout: 2000 }, (res) => {
                                    let data = '';
                                    res.on('data', c => data += c);
                                    res.on('end', () => {
                                        try { resolve(JSON.parse(data)); } catch(e) { resolve(null); }
                                    });
                                });
                                req.on('error', () => resolve(null));
                                req.on('timeout', () => { req.destroy(); resolve(null); });
                            });
                            if (p2pRes && p2pRes.version && updatesManager.compareVersions(p2pRes.version, bestVersion) > 0 && p2pRes.sha512) {
                                bestVersion = p2pRes.version;
                                bestPeer = node;
                            }
                        } catch(e) {}
                    }
                    if (bestPeer) {
                        if (win) win.webContents.send('update-status', { status: `Trovata v${bestVersion} su LAN. Download...` });
                        require('./updaterService').maybeAdoptLanUpdate(bestVersion, bestPeer.ip, bestPeer.port || 34567);
                    } else {
                        if (win) win.webContents.send('update-status', { status: 'Sei aggiornato all\'ultima versione.', finished: true });
                    }
                }
            } catch (e) {
                console.error('[Updater IPC] Error:', e.message);
            }
        });
        ipcMain.handle('forceP2PUpdate', async (event, peerIp) => {
            try {
                if (!_isValidPeerIp(peerIp)) return { success: false, error: 'IP non valido' };
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
                    autoUpdater.checkForUpdatesAndNotify().catch(e => console.error('[Updater]', e.message));
                    return { success: false, fallback: true };
                }
                if (win) win.webContents.send('update-status', { status: 'Downloading from P2P node...' });
                return new Promise((resolve) => {
                    const req = http.get(`http://${peerIp}:34567/sync/update`, (res) => {
                        if (res.statusCode !== 200) {
                            if (win) win.webContents.send('update-status', { status: 'P2P update not found. Falling back to GitHub...' });
                            autoUpdater.checkForUpdatesAndNotify().catch(e => console.error('[Updater]', e.message));
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
                                autoUpdater.checkForUpdatesAndNotify().catch(e => console.error('[Updater]', e.message));
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
                        autoUpdater.checkForUpdatesAndNotify().catch(e => console.error('[Updater]', e.message));
                        resolve({ success: false, fallback: true });
                    });
                });
            } catch (e) {
                console.error('[P2P Updater Error]', e);
                return { success: false };
            }
        });
        ipcMain.handle('installPendingUpdate', async () => {
            try {
                const updaterService = require('./updaterService');
                return typeof updaterService.installPendingUpdateNow === 'function' ? updaterService.installPendingUpdateNow() : false;
            } catch (e) { return false; }
        });
        ipcMain.handle('forceUpdateConsensus', async () => {
            try {
                const updaterService = require('./updaterService');
                if (typeof updaterService.forceUpdateConsensus === 'function') {
                    updaterService.forceUpdateConsensus();
                    return true;
                }
                return false;
            } catch (e) { return false; }
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
                if (typeof errorMsg !== 'string') return;
                const sanitized = errorMsg.replace(/[\x00-\x08\x0b-\x0c\x0e-\x1f\x7f]/g, '').slice(0, 1024);
                const { logError } = require('../logger');
                logError('[FRONTEND] ' + sanitized);
            } catch(e) {}
        });
        ipcMain.handle('toggleDevTools', () => {
            try {
                if (app.isPackaged) return;
                const win = BrowserWindow.getFocusedWindow();
                if (win) win.webContents.toggleDevTools();
            } catch(e) {}
        });
        ipcMain.handle('exportLogs', async () => {
            try {
                const { dialog } = require('electron');
                const win = BrowserWindow.getFocusedWindow();
                const logDir = path.join(app.getPath('userData'), 'Log');
                if (!fs.existsSync(logDir)) return { success: false, error: 'Nessun log disponibile.' };
                const { canceled, filePath } = await dialog.showSaveDialog(win, {
                    title: 'Esporta Log di Sistema',
                    defaultPath: path.join(app.getPath('documents'), `Adestio_Logs_${Date.now()}.txt`),
                    filters: [{ name: 'Text Document', extensions: ['txt'] }]
                });
                if (canceled || !filePath) return { success: false, canceled: true };
                const logFiles = fs.readdirSync(logDir).filter(f => f.endsWith('.txt'));
                let combinedLogs = `--- ADESTIO ENTERPRISE LOGS (${new Date().toLocaleString()}) ---\n\n`;
                for (const file of logFiles) {
                    combinedLogs += `\n--- FILE: ${file} ---\n`;
                    combinedLogs += fs.readFileSync(path.join(logDir, file), 'utf8');
                }
                fs.writeFileSync(filePath, combinedLogs);
                return { success: true, path: filePath };
            } catch(e) {
                return { success: false, error: e.message };
            }
        });
        ipcMain.handle('runDiagnostics', (e) => diagnosticsHandlers.runDiagnostics(e));
        ipcMain.handle('fixDiagnostics', (e) => diagnosticsHandlers.fixDiagnostics(e));
        ipcMain.handle('usersGetAll', (e, args) => usersHandlers.getAll(e, args));
        ipcMain.handle('usersChangeOwnPassword', (e, args) => usersHandlers.changeOwnPassword(e, args));
        ipcMain.handle('usersChangeOwnPin', (e, args) => usersHandlers.changeOwnPin(e, args));
        ipcMain.handle('usersCreate', (e, args) => usersHandlers.create(e, withActorBackend(args)));
        ipcMain.handle('usersUpdate', (e, args) => usersHandlers.update(e, withActorBackend(args)));
        ipcMain.handle('usersDelete', (e, args) => usersHandlers.remove(e, withActorBackend(args)));
        ipcMain.handle('usersRestore', (e, args) => usersHandlers.restore(e, withActorBackend(args)));
        ipcMain.handle('usersHardDelete', (e, args) => usersHandlers.hardDelete(e, withActorBackend(args)));
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
        ipcMain.handle('twofa:getStatus', (e, userId) => twofaHandlers.getStatus(e, userId));
        ipcMain.handle('twofa:totpSetupBegin', (e, userId) => twofaHandlers.totpSetupBegin(e, userId));
        ipcMain.handle('twofa:totpSetupConfirm', (e, data) => twofaHandlers.totpSetupConfirm(e, data));
        ipcMain.handle('twofa:totpDisable', (e, data) => twofaHandlers.totpDisable(e, data));
        ipcMain.handle('twofa:webauthnRegisterBegin', (e, userId) => twofaHandlers.webauthnRegisterBegin(e, userId));
        ipcMain.handle('twofa:webauthnRegisterFinish', (e, data) => twofaHandlers.webauthnRegisterFinish(e, data));
        ipcMain.handle('twofa:webauthnRemove', (e, data) => twofaHandlers.webauthnRemove(e, data));
        ipcMain.handle('twofa:adminReset', (e, data) => twofaHandlers.adminReset(e, data));
        ipcMain.handle('twofa:setPolicy', (e, data) => twofaHandlers.setTwofaPolicy(e, data));
        ipcMain.handle('twofa:adminListStatus', (e, actorUserId) => twofaHandlers.adminListStatus(e, actorUserId));
        ipcMain.handle('notifications:getPreferences', (e, userId) => notificationsHandlers.getPreferences(e, userId));
        ipcMain.handle('notifications:setPreference', (e, data) => notificationsHandlers.setPreference(e, data));
        ipcMain.handle('notifications:list', (e, data) => notificationsHandlers.list(e, data));
        ipcMain.handle('notifications:markRead', (e, data) => notificationsHandlers.markRead(e, data));
        ipcMain.handle('notifications:create', (e, data) => notificationsHandlers.create(data));
        ipcMain.handle('anagrafica:persone:getAll', (e, args) => anagraficaPersoneHandlers.getAll(e, args));
        ipcMain.handle('anagrafica:persone:search', (e, args) => anagraficaPersoneHandlers.search(e, args));
        ipcMain.handle('anagrafica:persone:getById', (e, args) => anagraficaPersoneHandlers.getById(e, args));
        ipcMain.handle('anagrafica:persone:getByUserId', (e, args) => anagraficaPersoneHandlers.getByUserId(e, args));
        ipcMain.handle('anagrafica:persone:create', (e, args) => anagraficaPersoneHandlers.create(e, withActorBackend(args)));
        ipcMain.handle('anagrafica:persone:update', (e, args) => anagraficaPersoneHandlers.update(e, withActorBackend(args)));
        ipcMain.handle('anagrafica:persone:remove', (e, args) => anagraficaPersoneHandlers.remove(e, withActorBackend(args)));
        ipcMain.handle('anagrafica:persone:restore', (e, args) => anagraficaPersoneHandlers.restore(e, withActorBackend(args)));
        ipcMain.handle('anagrafica:persone:hardDelete', (e, args) => anagraficaPersoneHandlers.hardDelete(e, withActorBackend(args)));
        ipcMain.handle('anagrafica:persone:getScheda', (e, args) => anagraficaPersoneHandlers.getScheda(e, args));
        ipcMain.handle('anagrafica:documenti:getByPersona', (e, args) => anagraficaDocumentiHandlers.getByPersona(e, args));
        ipcMain.handle('anagrafica:documenti:create', (e, args) => anagraficaDocumentiHandlers.create(e, withActorBackend(args)));
        ipcMain.handle('anagrafica:documenti:update', (e, args) => anagraficaDocumentiHandlers.update(e, withActorBackend(args)));
        ipcMain.handle('anagrafica:documenti:remove', (e, args) => anagraficaDocumentiHandlers.remove(e, withActorBackend(args)));
        ipcMain.handle('anagrafica:residenza:getByPersona', (e, args) => anagraficaResidenzaHandlers.getByPersona(e, args));
        ipcMain.handle('anagrafica:residenza:create', (e, args) => anagraficaResidenzaHandlers.create(e, withActorBackend(args)));
        ipcMain.handle('anagrafica:residenza:update', (e, args) => anagraficaResidenzaHandlers.update(e, withActorBackend(args)));
        ipcMain.handle('anagrafica:residenza:remove', (e, args) => anagraficaResidenzaHandlers.remove(e, withActorBackend(args)));
        ipcMain.handle('anagrafica:contatti:getByPersona', (e, args) => anagraficaContattiHandlers.getByPersona(e, args));
        ipcMain.handle('anagrafica:contatti:create', (e, args) => anagraficaContattiHandlers.create(e, withActorBackend(args)));
        ipcMain.handle('anagrafica:contatti:update', (e, args) => anagraficaContattiHandlers.update(e, withActorBackend(args)));
        ipcMain.handle('anagrafica:contatti:remove', (e, args) => anagraficaContattiHandlers.remove(e, withActorBackend(args)));
        ipcMain.removeHandler('anagrafica:familiari:getByPersona');
        ipcMain.removeHandler('anagrafica:familiari:create');
        ipcMain.removeHandler('anagrafica:familiari:update');
        ipcMain.removeHandler('anagrafica:familiari:remove');
        ipcMain.handle('anagrafica:familiari:getByPersona', (e, args) => anagraficaFamiliariHandlers.getByPersona(e, args));
        ipcMain.handle('anagrafica:familiari:create', (e, args) => anagraficaFamiliariHandlers.create(e, withActorBackend(args)));
        ipcMain.handle('anagrafica:familiari:update', (e, args) => anagraficaFamiliariHandlers.update(e, withActorBackend(args)));
        ipcMain.handle('anagrafica:familiari:remove', (e, args) => anagraficaFamiliariHandlers.remove(e, withActorBackend(args)));
        ipcMain.handle('anagrafica:lavoro:getByPersona', (e, args) => anagraficaLavoroHandlers.getByPersona(e, args));
        ipcMain.handle('anagrafica:lavoro:create', (e, args) => anagraficaLavoroHandlers.create(e, withActorBackend(args)));
        ipcMain.handle('anagrafica:lavoro:update', (e, args) => anagraficaLavoroHandlers.update(e, withActorBackend(args)));
        ipcMain.handle('anagrafica:lavoro:remove', (e, args) => anagraficaLavoroHandlers.remove(e, withActorBackend(args)));
        ipcMain.handle('anagrafica:titoliStudio:getByPersona', (e, args) => anagraficaTitoliStudioHandlers.getByPersona(e, args));
        ipcMain.handle('anagrafica:titoliStudio:create', (e, args) => anagraficaTitoliStudioHandlers.create(e, withActorBackend(args)));
        ipcMain.handle('anagrafica:titoliStudio:update', (e, args) => anagraficaTitoliStudioHandlers.update(e, withActorBackend(args)));
        ipcMain.handle('anagrafica:titoliStudio:remove', (e, args) => anagraficaTitoliStudioHandlers.remove(e, withActorBackend(args)));
        ipcMain.handle('anagrafica:datiBancari:getByPersona', (e, args) => anagraficaDatiBancariHandlers.getByPersona(e, args));
        ipcMain.handle('anagrafica:datiBancari:create', (e, args) => anagraficaDatiBancariHandlers.create(e, withActorBackend(args)));
        ipcMain.handle('anagrafica:datiBancari:update', (e, args) => anagraficaDatiBancariHandlers.update(e, withActorBackend(args)));
        ipcMain.handle('anagrafica:datiBancari:remove', (e, args) => anagraficaDatiBancariHandlers.remove(e, withActorBackend(args)));
        ipcMain.handle('anagrafica:audit:getHistory', async (_, args) => anagraficaAuditHandlers.getHistory(args));

        ipcMain.handle('datiAzienda:getSedi', async () => datiAziendaHandlers.getSedi());
        ipcMain.handle('datiAzienda:getSedeById', async (_, id) => datiAziendaHandlers.getSedeById(id));
        ipcMain.handle('datiAzienda:saveSede', async (_, sede) => datiAziendaHandlers.saveSede(sede));
        ipcMain.handle('datiAzienda:deleteSede', async (_, id) => datiAziendaHandlers.deleteSede(id));
        ipcMain.handle('anagrafica:riferimenti:getProvince', (e) => anagraficaRiferimentiHandlers.getProvince());
        ipcMain.handle('anagrafica:riferimenti:getNazioni', (e) => anagraficaRiferimentiHandlers.getNazioni());
        ipcMain.handle('anagrafica:riferimenti:getAllComuni', async () => {
            try {
                if (!global.comuniData) {
                    const comuniPath = path.join(__dirname, '..', 'data', 'comuni.json');
                    global.comuniData = JSON.parse(fs.readFileSync(comuniPath, 'utf8'));
                }
                return global.comuniData;
            } catch(e) {
                console.error('Errore getAllComuni', e);
                return [];
            }
        });
        ipcMain.handle('anagrafica:riferimenti:getSuggestions', (e, args) => anagraficaRiferimentiHandlers.getSuggestions(e, args));
        ipcMain.handle('getDistributedLogs', (e) => {
            try {
                const db = require('../db').getDB('auth');
                const logs = db.query("SELECT * FROM distributed_logs WHERE is_deleted = 0 AND (level = 'error' OR level = 'warn') ORDER BY created_at DESC LIMIT 500");
                return { success: true, logs: logs || [] };
            } catch(err) {
                return { success: false, error: err.message };
            }
        });
        ipcMain.handle('deleteDistributedLog', (e, id) => {
            try {
                const db = require('../db').getDB('auth');
                db.run('DELETE FROM distributed_logs WHERE id = ?', [id]);
                const { wrapMutationWithEvent, saveDB } = require('../db');
                wrapMutationWithEvent('DELETE', 'distributed_logs', id, null);
                saveDB();
                return { success: true };
            } catch(err) {
                return { success: false, error: err.message };
            }
        });
        ipcMain.handle('clearDistributedLogs', (e) => {
            try {
                const db = require('../db').getDB('auth');
                const allLogs = db.query('SELECT id FROM distributed_logs');
                if (allLogs && allLogs.length > 0) {
                    const { wrapMutationWithEvent, saveDB } = require('../db');
                    for (const row of allLogs) {
                        wrapMutationWithEvent('DELETE', 'distributed_logs', row.id, null);
                    }
                    db.run('DELETE FROM distributed_logs');
                    saveDB();
                }
                return { success: true };
            } catch(err) {
                return { success: false, error: err.message };
            }
        });
        ipcMain.handle('appBus:registerWindow', (e, appId) => {
            try {
                const appMessageBus = require('./appMessageBus');
                appMessageBus.registerAppWindow(appId, e.sender);
                return { success: true };
            } catch(err) {
                return { success: false, error: err.message };
            }
        });
        ipcMain.handle('appBus:sendMessage', (e, senderAppId, targetAppId, payload) => {
            try {
                const appMessageBus = require('./appMessageBus');
                return appMessageBus.routeMessage(senderAppId, targetAppId, payload);
            } catch(err) {
                return { success: false, error: err.message };
            }
        });

        ipcMain.handle('license:status', async () => {
            try {
                const licenseHandlers = require('../handlers/license');
                return licenseHandlers.getLicenseStatus();
            } catch (e) {
                return { success: false, error: e.message };
            }
        });

        ipcMain.handle('license:activate', async (_, args) => {
            try {
                const licenseHandlers = require('../handlers/license');
                return licenseHandlers.activateLicense(args);
            } catch (e) {
                return { success: false, error: e.message };
            }
        });

        ipcMain.handle('gdpr:eraseSubject', async (_, args) => {
            try {
                const gdprManager = require('../security/gdprManager');
                return await gdprManager.eraseSubjectData(args?.personId, args?.tenantId);
            } catch (e) {
                return { success: false, error: e.message };
            }
        });

        ipcMain.handle('gdpr:exportSubject', async (_, args) => {
            try {
                const gdprManager = require('../security/gdprManager');
                return gdprManager.exportSubjectData(args?.personId, args?.tenantId);
            } catch (e) {
                return { success: false, error: e.message };
            }
        });

        ipcMain.handle('store:rollbackApp', async (_, args) => {
            try {
                const AppUpdateManager = require('./AppUpdateManager');
                return await AppUpdateManager.rollbackApp(args?.appId);
            } catch (e) {
                return { success: false, error: e.message };
            }
        });

        ipcMain.handle('health:getStatus', async () => {
            try {
                const HealthMonitor = require('./HealthMonitor');
                return HealthMonitor.getSystemHealth();
            } catch (e) {
                return { status: 'ERROR', error: e.message };
            }
        });

        ipcMain.handle('health:getAuditLogs', async (_, args) => {
            try {
                const auditLogger = require('../observability/auditLogger');
                return auditLogger.getAuditLogs(args?.filters || {}, args?.limit || 100);
            } catch (e) {
                return [];
            }
        });

        ipcMain.handle('health:getAppMetrics', async (_, args) => {
            try {
                const appMetrics = require('../observability/appMetrics');
                return appMetrics.getAppMetrics(args?.appId || null);
            } catch (e) {
                return {};
            }
        });

        ipcMain.handle('events:publish', async (_, args) => {
            try {
                const domainEventStore = require('./domainEventStore');
                return domainEventStore.publishEvent(args?.eventName, args?.aggregateId, args?.actorId, args?.payload);
            } catch (e) {
                return { success: false, error: e.message };
            }
        });

        ipcMain.handle('events:query', async (_, args) => {
            try {
                const domainEventStore = require('./domainEventStore');
                return domainEventStore.getEvents(args?.eventName, args?.aggregateId, args?.limit || 100);
            } catch (e) {
                return [];
            }
        });

        ipcMain.handle('flightRecorder:dump', async () => {
            try {
                const flightRecorder = require('../observability/flightRecorder');
                return flightRecorder.exportDiagnosticDump();
            } catch (e) {
                return { success: false, error: e.message };
            }
        });

        ipcMain.handle('flightRecorder:get', async (_, args) => {
            try {
                const flightRecorder = require('../observability/flightRecorder');
                return flightRecorder.getEvents(args?.limit || 100);
            } catch (e) {
                return [];
            }
        });

        ipcMain.handle('sso:authenticate', async (_, args) => {
            try {
                const ssoProvider = require('../security/ssoProvider');
                return await ssoProvider.authenticateSsoToken(args);
            } catch (e) {
                return { success: false, error: e.message };
            }
        });

        ipcMain.handle('entitlement:check', async (_, args) => {
            try {
                const entitlementEngine = require('../security/entitlementEngine');
                return entitlementEngine.checkEntitlement(args?.appId, args?.tenantId);
            } catch (e) {
                return { valid: false, error: e.message };
            }
        });
    } catch (e) {}
}
module.exports = { registerAllIPCHandlers };
