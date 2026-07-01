const fs = require('fs');
const path = require('path');
const { app } = require('electron');
class UpdatesManager {
    constructor() {
        try {
            this.updatesDir = path.join(app.getPath('userData'), 'updates');
            if (!fs.existsSync(this.updatesDir)) {
                fs.mkdirSync(this.updatesDir, { recursive: true });
            }
        } catch(e) {
            console.error('[UpdatesManager] Error creating dir:', e);
        }
    }
        cleanOldUpdates() {
        try {
            if (!fs.existsSync(this.updatesDir)) return;
            const files = fs.readdirSync(this.updatesDir)
                .filter(f => f.startsWith('Adestio-Setup-') && f.endsWith('.exe'))
                .map(f => {
                    const stats = fs.statSync(path.join(this.updatesDir, f));
                    return { file: f, mtime: stats.mtimeMs };
                })
                .sort((a, b) => b.mtime - a.mtime); 
            if (files.length > 5) {
                for (let i = 5; i < files.length; i++) {
                    const oldFilePath = path.join(this.updatesDir, files[i].file);
                    try {
                        fs.unlinkSync(oldFilePath);
                        console.log(`[UpdatesManager] Rimosso vecchio installer: ${files[i].file}`);
                    } catch(err) {
                        console.error('[UpdatesManager] Impossibile rimuovere vecchio file', err);
                    }
                }
            }
        } catch(e) {
            console.error('[UpdatesManager] Errore pulizia vecchi update:', e);
        }
    }
        getHighestLocalVersion() {
        try {
            if (!fs.existsSync(this.updatesDir)) return null;
            const files = fs.readdirSync(this.updatesDir)
                .filter(f => f.startsWith('Adestio-Setup-') && f.endsWith('.exe'));
            let highest = null;
            for (const file of files) {
                const match = file.match(/Adestio-Setup-(.+)\.exe/);
                if (match && match[1]) {
                    const version = match[1];
                    if (version !== 'latest') { 
                        if (!highest || this.compareVersions(version, highest) > 0) {
                            highest = version;
                        }
                    }
                }
            }
            return highest;
        } catch(e) {
            return null;
        }
    }
        getInstallerPath(version) {
        try {
            const file = `Adestio-Setup-${version}.exe`;
            const fullPath = path.join(this.updatesDir, file);
            if (fs.existsSync(fullPath)) return fullPath;
            return null;
        } catch(e) {
            return null;
        }
    }
        runInstaller(version) {
        try {
            const installerPath = this.getInstallerPath(version);
            if (!installerPath) return false;
            const { exec } = require('child_process');
            console.log(`[UpdatesManager] Avvio aggiornamento silente: ${installerPath}`);
            exec(`"${installerPath}" /S`, (err) => {
                if (!err) {
                    app.quit();
                } else {
                    console.error('[UpdatesManager] Errore avvio setup:', err);
                }
            });
            return true;
        } catch(e) {
            console.error('[UpdatesManager] runInstaller exception', e);
            return false;
        }
    }
        async saveInstallerFromStream(version, readStream) {
        return new Promise((resolve, reject) => {
            try {
                if (!fs.existsSync(this.updatesDir)) fs.mkdirSync(this.updatesDir, { recursive: true });
                const file = `Adestio-Setup-${version}.exe`;
                const destPath = path.join(this.updatesDir, file);
                const writeStream = fs.createWriteStream(destPath);
                readStream.pipe(writeStream);
                writeStream.on('finish', () => {
                    writeStream.close();
                    this.cleanOldUpdates(); 
                    resolve(destPath);
                });
                writeStream.on('error', (err) => {
                    fs.unlink(destPath, () => {});
                    reject(err);
                });
                readStream.on('error', (err) => {
                    fs.unlink(destPath, () => {});
                    reject(err);
                });
            } catch(e) {
                reject(e);
            }
        });
    }
        compareVersions(v1, v2) {
        const parts1 = v1.split('.').map(Number);
        const parts2 = v2.split('.').map(Number);
        for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
            const a = parts1[i] || 0;
            const b = parts2[i] || 0;
            if (a > b) return 1;
            if (a < b) return -1;
        }
        return 0;
    }
}
const instance = new UpdatesManager();
module.exports = instance;
