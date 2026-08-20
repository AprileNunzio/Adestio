const { BrowserWindow, Menu, ipcMain, app, Tray, screen } = require('electron');
const path = require('path');
const fs = require('fs');

class WindowManager {
    constructor() {
        this.mainWindow = null;
        this.tray = null;
        this.isQuiting = false;
        this.saveTimeout = null;
        try {
            this.stateFilePath = path.join(app.getPath('userData'), 'window-state.json');
        } catch (e) {
            this.stateFilePath = null;
        }
    }

    setQuiting(value) {
        try {
            this.isQuiting = value;
        } catch (e) {}
    }

    getMainWindow() {
        try {
            return this.mainWindow;
        } catch (e) {
            return null;
        }
    }

    loadSavedState() {
        try {
            if (this.stateFilePath && fs.existsSync(this.stateFilePath)) {
                const raw = fs.readFileSync(this.stateFilePath, 'utf8');
                const data = JSON.parse(raw);
                if (data && typeof data === 'object') return data;
            }
        } catch (e) {}
        return null;
    }

    saveState() {
        try {
            if (!this.mainWindow || this.mainWindow.isDestroyed() || !this.stateFilePath) return;
            const isMaximized = this.mainWindow.isMaximized();
            const isFullScreen = this.mainWindow.isFullScreen();
            let bounds;
            try {
                bounds = isMaximized ? this.mainWindow.getNormalBounds() : this.mainWindow.getBounds();
            } catch (e) {
                bounds = this.mainWindow.getBounds();
            }
            const state = {
                x: bounds.x,
                y: bounds.y,
                width: bounds.width,
                height: bounds.height,
                isMaximized,
                isFullScreen
            };
            fs.writeFileSync(this.stateFilePath, JSON.stringify(state, null, 2), 'utf8');
        } catch (e) {}
    }

    scheduleSaveState() {
        try {
            if (this.saveTimeout) clearTimeout(this.saveTimeout);
            this.saveTimeout = setTimeout(() => {
                this.saveState();
            }, 250);
        } catch (e) {}
    }

    getValidatedBounds(savedState) {
        try {
            const fallback = { width: 1200, height: 800, minWidth: 900, minHeight: 600, isMaximized: true };
            if (!savedState) return fallback;

            const displays = screen.getAllDisplays();
            if (!displays || displays.length === 0) {
                return {
                    width: savedState.width || 1200,
                    height: savedState.height || 800,
                    minWidth: 900,
                    minHeight: 600,
                    isMaximized: !!savedState.isMaximized,
                    isFullScreen: !!savedState.isFullScreen
                };
            }

            const isVisible = displays.some(d => {
                const b = d.bounds;
                const margin = 50;
                return (
                    savedState.x >= (b.x - margin) &&
                    savedState.y >= (b.y - margin) &&
                    (savedState.x + 100) <= (b.x + b.width + margin) &&
                    (savedState.y + 100) <= (b.y + b.height + margin)
                );
            });

            if (isVisible) {
                return {
                    x: savedState.x,
                    y: savedState.y,
                    width: Math.max(900, savedState.width || 1200),
                    height: Math.max(600, savedState.height || 800),
                    minWidth: 900,
                    minHeight: 600,
                    isMaximized: !!savedState.isMaximized,
                    isFullScreen: !!savedState.isFullScreen
                };
            }

            const primary = screen.getPrimaryDisplay();
            const workArea = primary.workArea;
            return {
                x: workArea.x + Math.max(0, Math.floor((workArea.width - 1200) / 2)),
                y: workArea.y + Math.max(0, Math.floor((workArea.height - 800) / 2)),
                width: Math.min(1200, workArea.width),
                height: Math.min(800, workArea.height),
                minWidth: 900,
                minHeight: 600,
                isMaximized: !!savedState.isMaximized,
                isFullScreen: !!savedState.isFullScreen
            };
        } catch (e) {
            return { width: 1200, height: 800, minWidth: 900, minHeight: 600, isMaximized: true };
        }
    }

    createMenu() {
        try {
            const viewSubmenu = [{ role: 'reload', label: 'Ricarica' }];
            if (!app.isPackaged) viewSubmenu.push({ role: 'toggledevtools', label: 'Strumenti per sviluppatori' });
            viewSubmenu.push({ type: 'separator' }, { role: 'resetzoom', label: 'Zoom predefinito' }, { role: 'zoomin', label: 'Aumenta zoom' }, { role: 'zoomout', label: 'Riduci zoom' }, { type: 'separator' }, { role: 'togglefullscreen', label: 'Schermo intero' });
            const template = [
                { label: 'File', submenu: [{ role: 'quit', label: 'Esci' }] },
                { label: 'Modifica', submenu: [{ role: 'undo', label: 'Annulla' }, { role: 'redo', label: 'Ripeti' }, { type: 'separator' }, { role: 'cut', label: 'Taglia' }, { role: 'copy', label: 'Copia' }, { role: 'paste', label: 'Incolla' }] },
                { label: 'Visualizza', submenu: viewSubmenu },
                { label: 'Finestra', submenu: [{ role: 'minimize', label: 'Riduci a icona' }, { role: 'zoom', label: 'Ingrandisci' }] },
                { 
                    label: 'Aiuto', 
                    submenu: [
                        { 
                            label: 'Verifica aggiornamenti', 
                            click: () => {
                                try {
                                    const { autoUpdater } = require('electron-updater');
                                    autoUpdater.checkForUpdatesAndNotify();
                                } catch(e) { console.error(e); }
                            }
                        },
                        { type: 'separator' },
                        { 
                            label: 'Apri pagina GitHub', 
                            click: async () => {
                                try {
                                    const { shell } = require('electron');
                                    await shell.openExternal('https://github.com/AprileNunzio/Adestio');
                                } catch(e) { console.error(e); }
                            }
                        }
                    ] 
                }
            ];
            const menu = Menu.buildFromTemplate(template);
            Menu.setApplicationMenu(menu);
        } catch (e) {
            console.error('[WindowManager] createMenu error:', e);
        }
    }

    async createWindow(loadUrl) {
        try {
            const isHiddenBoot = process.argv.includes('--hidden');
            const savedState = this.loadSavedState();
            const bounds = this.getValidatedBounds(savedState);

            const winConfig = {
                width: bounds.width,
                height: bounds.height,
                minWidth: bounds.minWidth,
                minHeight: bounds.minHeight,
                frame: false,
                show: !isHiddenBoot,
                webPreferences: {
                    preload: path.join(__dirname, '../../preload.js'),
                    nodeIntegration: false,
                    contextIsolation: true
                }
            };

            if (bounds.x !== undefined && bounds.y !== undefined) {
                winConfig.x = bounds.x;
                winConfig.y = bounds.y;
            }

            this.mainWindow = new BrowserWindow(winConfig);

            this.mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
                const logger = require('../observability/logger');
                if (level >= 2) {
                    logger.error(`[Frontend Error] ${message}`, { line, source: sourceId });
                } else if (level === 1) {
                    logger.warn(`[Frontend Warn] ${message}`, { line, source: sourceId });
                }
            });

            this.mainWindow.webContents.on('render-process-gone', (event, details) => {
                const logger = require('../observability/logger');
                logger.error(`[Frontend Crash] Il processo di rendering è terminato in modo anomalo`, details);
            });

            this.mainWindow.on('close', (event) => {
                if (!this.isQuiting) {
                    event.preventDefault();
                    this.saveState();
                    try { require('./session_manager').clearSession(); } catch (e) {}
                    this.mainWindow.hide();
                    this.mainWindow.webContents.executeJavaScript(`
                        sessionStorage.clear();
                        if (window.Router) window.Router.navigate('auth_login');
                        else window.location.reload();
                    `).catch(() => {});
                    event.returnValue = false;
                } else {
                    this.saveState();
                }
            });

            this.mainWindow.setMenu(null);
            this.mainWindow.webContents.on('before-input-event', (event, input) => {
                try {
                    if (input.type === 'keyDown') {
                        if (input.key === 'F12' || (input.control && input.shift && (input.key === 'I' || input.key === 'i'))) {
                            this.mainWindow.webContents.toggleDevTools();
                            event.preventDefault();
                        }
                    }
                } catch (e) {}
            });

            if (!isHiddenBoot) {
                if (bounds.isFullScreen) {
                    this.mainWindow.setFullScreen(true);
                } else if (bounds.isMaximized) {
                    this.mainWindow.maximize();
                }
            }

            this.mainWindow.on('resize', () => this.scheduleSaveState());
            this.mainWindow.on('move', () => this.scheduleSaveState());
            this.mainWindow.on('maximize', () => this.scheduleSaveState());
            this.mainWindow.on('unmaximize', () => this.scheduleSaveState());
            this.mainWindow.on('enter-full-screen', () => this.scheduleSaveState());
            this.mainWindow.on('leave-full-screen', () => this.scheduleSaveState());

            if (loadUrl) {
                this.mainWindow.loadURL(loadUrl);
            } else {
                console.log('[WindowManager] Caricamento tramite protocollo adestio:// per abilitare WebAuthn/Passkey.');
                this.mainWindow.loadURL('adestio://core/index.html');
            }
            return this.mainWindow;
        } catch (e) {
            console.error('[WindowManager] createWindow error:', e);
        }
    }

    createTray() {
        try {
            const iconPath = path.join(__dirname, '../../adestio.ico');
            if (fs.existsSync(iconPath)) {
                this.tray = new Tray(iconPath);
                const contextMenu = Menu.buildFromTemplate([
                    { label: 'Apri Dashboard', click: () => { if (this.mainWindow) this.mainWindow.show(); } },
                    { label: 'Verifica Aggiornamenti', click: () => { 
                        try {
                            const { autoUpdater } = require('electron-updater');
                            autoUpdater.checkForUpdatesAndNotify().catch(e => console.error('[Updater]', e.message)); 
                        } catch(e) {}
                    } },
                    { type: 'separator' },
                    { label: 'Termina Nodo e Chiudi', click: () => { this.setQuiting(true); this.saveState(); app.quit(); } }
                ]);
                this.tray.setToolTip('Adestio Nodo P2P');
                this.tray.setContextMenu(contextMenu);
                this.tray.on('double-click', () => {
                    if (this.mainWindow) this.mainWindow.show();
                });
            }
        } catch (err) {
            console.error('[WindowManager] Errore creazione tray:', err);
        }
    }
}

const instance = new WindowManager();
module.exports = instance;
