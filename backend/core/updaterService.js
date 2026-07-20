const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

let _adoptingLanUpdate = false;
let pendingUpdateVersion = null;
let isDownloadingUpdate = false;
const MIN_PEER_HASH_CORROBORATIONS = 2;
const CORROBORATION_TIMEOUT_MS = 3 * 60 * 1000;
const _peerHashReports = new Map();
const _firstCorroborationTs = new Map();
function _recordPeerHashReport(version, sha512, peerIp) {
    try {
        const key = `${version}:${sha512}`;
        const entry = _peerHashReports.get(key) || new Set();
        entry.add(peerIp);
        _peerHashReports.set(key, entry);
        return entry.size;
    } catch (e) {
        return 0;
    }
}

function isUpdateInProgress() {
    return isDownloadingUpdate || _adoptingLanUpdate || pendingUpdateVersion !== null;
}

function getPendingUpdateVersion() {
    return pendingUpdateVersion;
}

function installPendingUpdateNow() {
    if (!pendingUpdateVersion) return false;
    const updatesManager = require('../updates_manager');
    updatesManager.runInstaller(pendingUpdateVersion);
    return true;
}

let _consensusInterval = null;
let _consensusAttempts = 0;

function checkUpdateConsensus() {
    if (!pendingUpdateVersion) return;
    if (!_consensusInterval) {
        _consensusAttempts = 0;
        _consensusInterval = setInterval(checkUpdateConsensus, 5000);
    }
    _consensusAttempts++;
    const { getDetailedNodes } = require('../sync');
    const allNodes = getDetailedNodes().filter(n => n.ip !== '127.0.0.1');
    const activeNodes = allNodes.filter(n => n.status === 'Online');
    const nodesReady = activeNodes.filter(n => n.updateReadyVersion === pendingUpdateVersion).length;
    const allReady = (nodesReady === activeNodes.length);
    const majorityReady = (nodesReady >= Math.ceil(activeNodes.length / 2));
    if (allReady || activeNodes.length === 0 || (majorityReady && _consensusAttempts > 12) || _consensusAttempts > 24) {
        if (_consensusInterval) { clearInterval(_consensusInterval); _consensusInterval = null; }
        const win = BrowserWindow.getAllWindows()[0];
        if (win) win.webContents.send('update-ready-for-install', { version: pendingUpdateVersion });
    }
}

function forceUpdateConsensus() {
    if (!pendingUpdateVersion) return;
    if (_consensusInterval) {
        clearInterval(_consensusInterval);
        _consensusInterval = null;
    }
    const win = BrowserWindow.getAllWindows()[0];
    if (win) win.webContents.send('update-ready-for-install', { version: pendingUpdateVersion });
}

function _downloadUpdateSafe(autoUpdater, win) {
    autoUpdater.downloadUpdate().catch((err) => {
        console.error('[Updater] downloadUpdate error:', err.message);
        isDownloadingUpdate = false;
        if (win && !win.isDestroyed()) {
            win.webContents.send('update-status', { status: 'Errore durante il download dell\'aggiornamento.', finished: true });
        }
    });
}

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
        autoUpdater.on('checking-for-update', () => {
            if (isUpdateInProgress()) return;
            const win = BrowserWindow.getAllWindows()[0];
            if (win) win.webContents.send('update-status', { status: 'Ricerca aggiornamenti...' });
        });
        autoUpdater.on('update-available', async (info) => {
            if (isUpdateInProgress()) return;
            isDownloadingUpdate = true;
            const win = BrowserWindow.getAllWindows()[0];
            const targetVersion = info.version;
            if (win) win.webContents.send('update-status', { status: `Trovata v${targetVersion}. Ricerca in LAN...` });
            try {
                const { getDetailedNodes } = require('../sync');
                const nodes = getDetailedNodes().filter(n => n.ip !== '127.0.0.1');
                const http = require('http');
                
                // Trova tutti i nodi (Seeder) che hanno l'update
                const p2pSources = nodes.filter(n => n.updateReadyVersion === targetVersion);
                if (p2pSources.length === 0) {
                    for (const node of nodes) {
                        try {
                            const p2pRes = await new Promise((resolve) => {
                                const req = http.get(`http://${node.ip}:${node.port}/sync/update-info`, { timeout: 2000 }, (res) => {
                                    let data = '';
                                    res.on('data', c => data += c);
                                    res.on('end', () => {
                                        try { resolve(JSON.parse(data).version); } catch(e) { resolve(null); }
                                    });
                                });
                                req.on('error', () => resolve(null));
                                req.on('timeout', () => { req.destroy(); resolve(null); });
                            });
                            if (p2pRes === targetVersion) p2pSources.push(node);
                        } catch(e) {}
                    }
                }

                if (p2pSources.length > 0) {
                    if (win) win.webContents.send('update-status', { status: `Download a Sciame (Swarm) v${targetVersion} da ${p2pSources.length} nodi...` });
                    
                    try {
                        let totalSize = 0;
                        for(const src of p2pSources) {
                            try {
                                totalSize = await new Promise((res, rej) => {
                                    const req = http.get(`http://${src.ip}:${src.port}/sync/update/download/${targetVersion}`, { headers: { 'Range': 'bytes=0-0' } }, (r) => {
                                        if(r.statusCode === 206 || r.statusCode === 200) {
                                            const contentRange = r.headers['content-range'];
                                            if(contentRange) res(parseInt(contentRange.split('/')[1], 10));
                                            else res(parseInt(r.headers['content-length'] || 0, 10));
                                        } else rej();
                                        r.destroy();
                                    });
                                    req.on('error', rej).on('timeout', () => { req.destroy(); rej(); });
                                });
                                if(totalSize > 0) break;
                            } catch(e) {}
                        }
                        
                        if(totalSize === 0) throw new Error("Impossibile ottenere la dimensione del file");

                        const destPath = updatesManager.getInstallerPath(targetVersion);
                        const updatesDir = path.dirname(destPath);
                        if (!fs.existsSync(updatesDir)) fs.mkdirSync(updatesDir, { recursive: true });

                        const fd = fs.openSync(destPath, 'w');
                        fs.ftruncateSync(fd, totalSize);
                        fs.closeSync(fd);

                        const chunkSize = Math.ceil(totalSize / p2pSources.length);
                        let downloaded = 0;
                        
                        const downloadPromises = p2pSources.map((src, index) => {
                            return new Promise((resolve, reject) => {
                                const start = index * chunkSize;
                                const end = Math.min(start + chunkSize - 1, totalSize - 1);
                                if (start > end) return resolve();
                                
                                const req = http.get(`http://${src.ip}:${src.port}/sync/update/download/${targetVersion}`, { headers: { 'Range': `bytes=${start}-${end}` } }, (res) => {
                                    if(res.statusCode !== 206 && res.statusCode !== 200) return reject(new Error('Bad status ' + res.statusCode));
                                    
                                    const stream = fs.createWriteStream(destPath, { flags: 'r+', start });
                                    res.on('data', chunk => {
                                        downloaded += chunk.length;
                                        if (win) {
                                            win.webContents.send('update-download-progress', {
                                                percent: (downloaded / totalSize) * 100,
                                                transferred: downloaded,
                                                total: totalSize
                                            });
                                        }
                                    });
                                    res.pipe(stream);
                                    stream.on('close', resolve);
                                    stream.on('error', reject);
                                });
                                req.on('error', reject);
                            });
                        });
                        
                        await Promise.all(downloadPromises);

                        await new Promise(r => setTimeout(r, 800));
                        updatesManager.cleanOldUpdates();
                        
                        if (!updatesManager.verifyChecksum(targetVersion, info.sha512)) {
                            console.error('[Updater] Checksum P2P non valido per', targetVersion);
                            try { fs.unlinkSync(destPath); } catch(_) {}
                            throw new Error('Checksum fallito');
                        }
                        
                        if (win) win.webContents.send('update-status', { status: 'Aggiornamento scaricato. In attesa del completamento su tutti i nodi...', finished: false, waitingConsensus: true });
                        const { broadcastUpdateAvailable } = require('../sync');
                        if (typeof broadcastUpdateAvailable === 'function') broadcastUpdateAvailable(targetVersion);

                        pendingUpdateVersion = targetVersion;
                        isDownloadingUpdate = false;
                        checkUpdateConsensus();

                    } catch(e) {
                        console.error('[Updater] Swarm download failed:', e.message);
                        if (win) win.webContents.send('update-status', { status: 'Errore download sciame. Fallback su GitHub...' });
                        _downloadUpdateSafe(autoUpdater, win);
                    }
                } else {
                    if (win) win.webContents.send('update-status', { status: `Download v${targetVersion} da server globale...` });
                    _downloadUpdateSafe(autoUpdater, win);
                }
            } catch(e) {
                _downloadUpdateSafe(autoUpdater, win);
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
        setTimeout(() => { if (!isUpdateInProgress()) autoUpdater.checkForUpdatesAndNotify().catch(e => console.error('[Updater]', e.message)); }, 15000); 
        setInterval(() => { if (!isUpdateInProgress()) autoUpdater.checkForUpdatesAndNotify().catch(e => console.error('[Updater]', e.message)); }, 4 * 60 * 60 * 1000); 
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

async function maybeAdoptLanUpdate(version, peerIp, peerPort) {
    if (isUpdateInProgress() || !version || !peerIp) return;
    try {
        const updatesManager = require('../updates_manager');
        if (updatesManager.compareVersions(version, app.getVersion()) <= 0) return;
        _adoptingLanUpdate = true;
        const { autoUpdater } = require('electron-updater');
        
        let expectedSha512 = null;
        try {
            const checkResult = await autoUpdater.checkForUpdates();
            const info = checkResult && checkResult.updateInfo;
            if (info && info.version === version) expectedSha512 = info.sha512;
        } catch (_) {}

        const http = require('http');

        if (!expectedSha512) {
            try {
                const p2pRes = await new Promise((resolve) => {
                    const req = http.get(`http://${peerIp}:${peerPort}/sync/update-info`, { timeout: 3000 }, (res) => {
                        let data = '';
                        res.on('data', c => data += c);
                        res.on('end', () => {
                            try { resolve(JSON.parse(data)); } catch(e) { resolve(null); }
                        });
                    });
                    req.on('error', () => resolve(null));
                    req.on('timeout', () => { req.destroy(); resolve(null); });
                });
                if (p2pRes && p2pRes.version === version && p2pRes.sha512) {
                    const corroborations = _recordPeerHashReport(version, p2pRes.sha512, peerIp);
                    if (corroborations < MIN_PEER_HASH_CORROBORATIONS) {
                        const tsKey = `${version}:${p2pRes.sha512}`;
                        if (!_firstCorroborationTs.has(tsKey)) _firstCorroborationTs.set(tsKey, Date.now());
                        const elapsed = Date.now() - _firstCorroborationTs.get(tsKey);
                        if (elapsed < CORROBORATION_TIMEOUT_MS) {
                            console.warn(`[Updater] Checksum P2P v${version}: ${corroborations} peer, attendo conferma (o timeout fra ${Math.round((CORROBORATION_TIMEOUT_MS - elapsed) / 1000)}s).`);
                            return;
                        }
                        console.warn(`[Updater] Timeout corroboration v${version}: adozione con ${corroborations} peer dopo ${Math.round(elapsed / 1000)}s.`);
                    } else {
                        console.log(`[Updater] Checksum P2P v${version} confermato da ${corroborations} nodi distinti.`);
                    }
                    expectedSha512 = p2pRes.sha512;
                }
            } catch (_) {}
        }

        if (!expectedSha512) {
            console.error('[Updater] Impossibile recuperare il checksum per la versione LAN:', version);
            return;
        }

        // Pre-check: se abbiamo già l'installer corretto, saltiamo il download
        let needDownload = true;
        if (fs.existsSync(updatesManager.getInstallerPath(version))) {
            if (updatesManager.verifyChecksum(version, expectedSha512)) {
                needDownload = false;
                console.log(`[Updater] Installer v${version} già presente e valido localmente, salto il download via LAN.`);
            }
        }

        if (needDownload) {
            await new Promise((resolve, reject) => {
                const req = http.get(`http://${peerIp}:${peerPort}/sync/update/download/${version}`, (res) => {
                    if (res.statusCode !== 200) return reject(new Error(`P2P download failed: ${res.statusCode}`));
                    updatesManager.saveInstallerFromStream(version, res).then(resolve).catch(reject);
                });
                req.on('error', reject);
            });
        }
        
        if (!updatesManager.verifyChecksum(version, expectedSha512)) {
            try { fs.unlinkSync(updatesManager.getInstallerPath(version)); } catch (_) {}
            console.error('[Updater] Checksum non valido per aggiornamento annunciato via LAN:', version);
            return;
        }
        const win = BrowserWindow.getAllWindows()[0];
        if (win) win.webContents.send('update-status', { status: `Aggiornamento ricevuto. In attesa del completamento su tutti i nodi...`, finished: false, waitingConsensus: true });
        
        const { broadcastUpdateAvailable } = require('../sync');
        if (typeof broadcastUpdateAvailable === 'function') broadcastUpdateAvailable(version);
        
        pendingUpdateVersion = version;
        checkUpdateConsensus();
    } catch (e) {
        if (!e.message.includes('404') && !e.message.includes('aborted')) {
            console.error('[Updater] maybeAdoptLanUpdate error:', e.message);
        }
    } finally {
        _adoptingLanUpdate = false;
    }
}

module.exports = { setupUpdaterService, maybeAdoptLanUpdate, getPendingUpdateVersion, checkUpdateConsensus, installPendingUpdateNow, isUpdateInProgress, forceUpdateConsensus };
