process.env.TZ = 'Europe/Rome';
const { app, BrowserWindow, ipcMain, dialog, protocol } = require('electron');
const path = require('path');
const fs = require('fs');

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
    app.quit();
} else {
    try {
        app.setPath('userData', path.join(app.getPath('appData'), 'NunzioTech', 'Adestio'));
        const { setupGlobalErrorHandlers } = require('./backend/observability/globalErrorHandler');
        setupGlobalErrorHandlers();
        const { setupLogger } = require('./backend/logger');
        setupLogger();
        const windowManager = require('./backend/core/windowManager');
        const ipcRouter = require('./backend/core/ipcRouter');
        const updaterService = require('./backend/core/updaterService');

        protocol.registerSchemesAsPrivileged([
            { scheme: 'adestio-app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } },
            { scheme: 'adestio', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }
        ]);

        app.on('second-instance', (event, commandLine, workingDirectory) => {
            try {
                const win = windowManager.getMainWindow();
                if (win && !win.isDestroyed()) {
                    if (win.isMinimized()) win.restore();
                    win.show();
                    win.focus();
                } else {
                    const localAppServer = require('./backend/core/localAppServer');
                    const url = localAppServer.getLocalAppUrl();
                    if (url) {
                        windowManager.createWindow(url);
                    }
                }
            } catch (e) {
                console.error('[Second-instance Error]', e);
            }
        });

        app.whenReady().then(async () => {
            try {
                const CustomProtocol = require('./backend/core/CustomProtocol');
                CustomProtocol.registerCustomProtocol();

                ipcRouter.registerAllIPCHandlers(windowManager);
                try {
                    require('./backend/security/developer_vault').rotateVault();
                } catch (e) {
                    console.error('[Vault Rotation Error]', e);
                }

                const { session } = require('electron');
                session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
                    try {
                        callback({
                            responseHeaders: {
                                ...details.responseHeaders,
                                'Content-Security-Policy': ["default-src 'self' 'unsafe-inline' 'unsafe-eval' data: adestio-app: adestio: http: ws: wss:"]
                            }
                        });
                    } catch (cbErr) {
                        callback({ responseHeaders: details.responseHeaders });
                    }
                });

                const BootManager = require('./backend/core/BootManager');
                await BootManager.runStartupSequence();
                BootManager.runBackgroundTasks();

                const localAppServer = require('./backend/core/localAppServer');
                const appUrl = await localAppServer.startLocalAppServer();

                await windowManager.createWindow(appUrl);
                windowManager.createMenu();
                updaterService.setupUpdaterService(windowManager);
                windowManager.createTray();

                try {
                    app.setLoginItemSettings({
                        openAtLogin: true,
                        args: ['--hidden']
                    });
                } catch (loginSettingErr) {
                    console.error('[LoginItemSettings Error]', loginSettingErr);
                }

                app.on('activate', () => {
                    try {
                        if (BrowserWindow.getAllWindows().length === 0) {
                            const url = localAppServer.getLocalAppUrl();
                            if (url) windowManager.createWindow(url);
                        } else {
                            const win = windowManager.getMainWindow();
                            if (win && !win.isDestroyed()) win.show();
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
            try {
                if (process.platform !== 'darwin') {
                }
            } catch (e) {
                console.error('[Window All Closed Error]', e);
            }
        });
    } catch (e) {
        console.error('[Fatal Error]', e);
    }
}
