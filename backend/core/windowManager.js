const { BrowserWindow, Menu, ipcMain, app, Tray } = require('electron');
const path = require('path');
const fs = require('fs');
class WindowManager {
    constructor() {
        this.mainWindow = null;
        this.tray = null;
        this.isQuiting = false;
    }
    setQuiting(value) {
        this.isQuiting = value;
    }
    getMainWindow() {
        return this.mainWindow;
    }
    createMenu() {
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
    async createWindow() {
        try {
            const isHiddenBoot = process.argv.includes('--hidden');
            this.mainWindow = new BrowserWindow({
                width: 1200,
                height: 800,
                minHeight: 600,
                frame: false,
                show: !isHiddenBoot,
                webPreferences: {
                    preload: path.join(__dirname, '../../preload.js'),
                    nodeIntegration: false,
                    contextIsolation: true
                }
            });
            this.mainWindow.on('close', (event) => {
                if (!this.isQuiting) {
                    event.preventDefault();
                    this.mainWindow.hide();
                    this.mainWindow.webContents.executeJavaScript(`
                        sessionStorage.clear();
                        if (window.Router) window.Router.navigate('auth_login');
                        else window.location.reload();
                    `).catch(() => {});
                    event.returnValue = false;
                }
            });
            this.mainWindow.setMenu(null);
            this.mainWindow.maximize();
            this.mainWindow.loadFile(path.join(__dirname, '../../src/index.html'));
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
                    { label: 'Termina Nodo e Chiudi', click: () => { this.setQuiting(true); app.quit(); } }
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
