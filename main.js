process.env.TZ = 'Europe/Rome';
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
app.setPath('userData', path.join(app.getPath('appData'), 'NunzioTech', 'Adestio'));
const { setupGlobalErrorHandlers } = require('./backend/observability/globalErrorHandler');
setupGlobalErrorHandlers();
const { setupLogger } = require('./backend/logger');
setupLogger();
const windowManager = require('./backend/core/windowManager');
const ipcRouter = require('./backend/core/ipcRouter');
const updaterService = require('./backend/core/updaterService');
try {
    app.whenReady().then(async () => {
        try {
            ipcRouter.registerAllIPCHandlers(windowManager);
            try { require('./backend/security/developer_vault').rotateVault(); } catch(e) {}
            try {
                const { autoUnlockDB } = require('./backend/db');
                const unlocked = await autoUnlockDB();
                const { startSyncServer, ensureFirewallRule } = require('./backend/sync');
                ensureFirewallRule();
                startSyncServer();
                try { require('./backend/diagnostics_api').startDiagnosticsServer(); } catch(e) { console.error('Sidecar Error:', e); }
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
            await windowManager.createWindow();
            windowManager.createMenu();
            updaterService.setupUpdaterService(windowManager);
            windowManager.createTray();
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
                    const win = windowManager.getMainWindow();
                    if (win) {
                        if (win.isMinimized()) win.restore();
                        win.show();
                        win.focus();
                    }
                });
            }
            app.on('activate', () => {
                try {
                    if (BrowserWindow.getAllWindows().length === 0) {
                        windowManager.createWindow();
                    } else {
                        const win = windowManager.getMainWindow();
                        if (win) win.show();
                    }
                } catch (e) {
                    console.error('[Activate Error]', e);
                }
            });
        } catch (e) {
            console.error('[Boot Main Error]', e);
        }
    });
    app.on('window-all-closed', () => {
    });
} catch (e) {
    console.error('[Fatal Error]', e);
}
