process.env.TZ = 'Europe/Rome';
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
    app.quit();
} else {
    app.setPath('userData', path.join(app.getPath('appData'), 'NunzioTech', 'Adestio'));
    const { setupGlobalErrorHandlers } = require('./backend/observability/globalErrorHandler');
    setupGlobalErrorHandlers();
    const { setupLogger } = require('./backend/logger');
    setupLogger();
    const windowManager = require('./backend/core/windowManager');
    const ipcRouter = require('./backend/core/ipcRouter');
    const updaterService = require('./backend/core/updaterService');
    try {
        app.on('second-instance', (event, commandLine, workingDirectory) => {
            try {
                const win = windowManager.getMainWindow();
                if (win) {
                    if (win.isMinimized()) win.restore();
                    win.show();
                    win.focus();
                }
            } catch (e) {}
        });
        app.whenReady().then(async () => {
            try {
                ipcRouter.registerAllIPCHandlers(windowManager);
                try { require('./backend/security/developer_vault').rotateVault(); } catch(e) {}
                const BootManager = require('./backend/core/BootManager');
                await BootManager.runStartupSequence();
                BootManager.runBackgroundTasks();
                await windowManager.createWindow();
                windowManager.createMenu();
                updaterService.setupUpdaterService(windowManager);
                windowManager.createTray();
                app.setLoginItemSettings({
                    openAtLogin: true,
                    args: ['--hidden']
                });
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
}
