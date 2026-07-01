const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
function setupUpdaterService(windowManager) {
    try {
        const { autoUpdater } = require('electron-updater');
        try {
            const pendingDir = path.join(app.getPath('userData'), '../adestio-updater/pending');
            if (fs.existsSync(pendingDir)) {
                fs.rmSync(pendingDir, { recursive: true, force: true });
            }
        } catch (e) {}
        autoUpdater.autoDownload = false;
        autoUpdater.autoInstallOnAppQuit = false;
        autoUpdater.disableWebInstaller = true;
        const updatesManager = require('../updates_manager');
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
            try {
                const { getDetailedNodes } = require('../sync');
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
                                if (!updatesManager.verifyChecksum(targetVersion, info.sha512)) {
                                    console.error('[Updater] Checksum P2P non valido per', targetVersion);
                                    try { fs.unlinkSync(updatesManager.getInstallerPath(targetVersion)); } catch(_) {}
                                    if (win) win.webContents.send('update-status', { status: 'Verifica integrità fallita. Fallback su GitHub...' });
                                    autoUpdater.downloadUpdate();
                                    return;
                                }
                                if (win) win.webContents.send('update-status', { status: 'Installazione in corso (P2P)...', finished: true });
                                const { broadcastUpdateAvailable } = require('../sync');
                                if (typeof broadcastUpdateAvailable === 'function') broadcastUpdateAvailable(targetVersion);
                                updatesManager.runInstaller(targetVersion);
                            } catch(e) {
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
                if (info.downloadedFile && fs.existsSync(info.downloadedFile)) {
                    const stream = fs.createReadStream(info.downloadedFile);
                    await updatesManager.saveInstallerFromStream(info.version, stream);
                }
            } catch(e) {}
            try {
                const { broadcastUpdateAvailable } = require('../sync');
                if (typeof broadcastUpdateAvailable === 'function') broadcastUpdateAvailable(info.version);
            } catch(e) {}
            if (windowManager) {
                windowManager.setQuiting(true);
            }
            setTimeout(() => autoUpdater.quitAndInstall(true, true), 1000);
        });
    } catch(e) {
        console.error('[UpdaterService] Error setting up updater:', e);
    }
}
let _adoptingLanUpdate = false;
async function maybeAdoptLanUpdate(version, peerIp, peerPort) {
    if (_adoptingLanUpdate || !version || !peerIp) return;
    try {
        const updatesManager = require('../updates_manager');
        if (updatesManager.compareVersions(version, app.getVersion()) <= 0) return;
        _adoptingLanUpdate = true;
        const { autoUpdater } = require('electron-updater');
        const checkResult = await autoUpdater.checkForUpdates();
        const info = checkResult && checkResult.updateInfo;
        if (!info || info.version !== version) return;
        const http = require('http');
        await new Promise((resolve, reject) => {
            const req = http.get(`http://${peerIp}:${peerPort}/sync/update/download/${version}`, (res) => {
                if (res.statusCode !== 200) return reject(new Error(`P2P download failed: ${res.statusCode}`));
                updatesManager.saveInstallerFromStream(version, res).then(resolve).catch(reject);
            });
            req.on('error', reject);
        });
        if (!updatesManager.verifyChecksum(version, info.sha512)) {
            try { fs.unlinkSync(updatesManager.getInstallerPath(version)); } catch (_) {}
            console.error('[Updater] Checksum non valido per aggiornamento annunciato via LAN:', version);
            return;
        }
        const win = BrowserWindow.getAllWindows()[0];
        if (win) win.webContents.send('update-status', { status: `Aggiornamento v${version} ricevuto dalla rete locale. Installazione...`, finished: true });
        updatesManager.runInstaller(version);
    } catch (e) {
        console.error('[Updater] maybeAdoptLanUpdate error:', e.message);
    } finally {
        _adoptingLanUpdate = false;
    }
}
module.exports = { setupUpdaterService, maybeAdoptLanUpdate };
