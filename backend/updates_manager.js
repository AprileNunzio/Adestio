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
                    try {
                        const stats = fs.statSync(path.join(this.updatesDir, f));
                        return { file: f, mtime: stats.mtimeMs };
                    } catch(e) { return { file: f, mtime: 0 }; }
                })
                .filter(x => x.mtime > 0)
                .sort((a, b) => b.mtime - a.mtime);
                for (let i = 5; i < files.length; i++) {
                    const oldFilePath = path.join(this.updatesDir, files[i].file);
                    try {
                        fs.unlinkSync(oldFilePath);
                        console.log(`[UpdatesManager] Rimosso vecchio installer: ${files[i].file}`);
                    } catch(err) {
                        console.error('[UpdatesManager] Impossibile rimuovere vecchio file', err);
                    }
                }
        } catch(e) {
            console.error('[UpdatesManager] Errore pulizia vecchi update:', e);
        }
    }
        getHighestLocalVersion() {
        try {
            const systemDir = path.join(path.dirname(process.execPath), 'updates');
            const dirsToCheck = [this.updatesDir, systemDir];
            let highest = null;
            for (const dir of dirsToCheck) {
                if (!fs.existsSync(dir)) continue;
                const files = fs.readdirSync(dir).filter(f => f.startsWith('Adestio-Setup-') && f.endsWith('.exe'));
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
            }
            return highest;
        } catch(e) {
            return null;
        }
    }
        getInstallerPath(version) {
        try {
            const file = `Adestio-Setup-${version}.exe`;
            const dirsToCheck = [this.updatesDir, path.join(path.dirname(process.execPath), 'updates')];
            for (const dir of dirsToCheck) {
                const fullPath = path.join(dir, file);
                if (fs.existsSync(fullPath)) return fullPath;
            }
            return null;
        } catch(e) {
            return null;
        }
    }
        getLocalChecksum(version) {
        try {
            const filePath = this.getInstallerPath(version);
            if (!filePath) return null;
            const crypto = require('crypto');
            const buffer = fs.readFileSync(filePath);
            return crypto.createHash('sha512').update(buffer).digest('base64');
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
            const safeInstallerPath = installerPath.replace(/'/g, "''");
            const command = `powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -Command "Start-Process -FilePath '${safeInstallerPath}' -ArgumentList '/S' -Verb RunAs"`;
            exec(command, (err) => {
                if (!err) {
                    setTimeout(() => app.quit(), 500); // Give it a half second to spawn before quitting
                } else {
                    console.error('[UpdatesManager] Errore avvio setup (Elevazione):', err);
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
                const tempPath = destPath + '.tmp';
                try { if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath); } catch(_) {}
                const writeStream = fs.createWriteStream(tempPath);
                readStream.pipe(writeStream);
                writeStream.on('close', () => {
                    let renameSuccess = false;
                    try {
                        if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
                        fs.renameSync(tempPath, destPath);
                        renameSuccess = true;
                    } catch(err) {
                        return reject(new Error('Impossibile rinominare il file temp (lock di sistema): ' + err.message));
                    }
                    if (renameSuccess) {
                        setTimeout(() => {
                            this.cleanOldUpdates(); 
                            resolve(destPath);
                        }, 800); 
                    }
                });
                writeStream.on('error', (err) => {
                    fs.unlink(tempPath, () => {});
                    reject(err);
                });
                readStream.on('error', (err) => {
                    fs.unlink(tempPath, () => {});
                    reject(err);
                });
            } catch(e) {
                reject(e);
            }
        });
    }
        verifyChecksum(version, expectedSha512Base64) {
        try {
            if (!expectedSha512Base64) return false;
            const filePath = this.getInstallerPath(version);
            if (!filePath) return false;
            const crypto = require('crypto');
            const buffer = fs.readFileSync(filePath);
            const actual = crypto.createHash('sha512').update(buffer).digest('base64');
            return actual === expectedSha512Base64;
        } catch(e) {
            return false;
        }
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
