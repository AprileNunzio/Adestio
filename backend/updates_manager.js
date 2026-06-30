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

    /**
     * Mantiene solo gli ultimi 5 setup
     */
    cleanOldUpdates() {
        try {
            if (!fs.existsSync(this.updatesDir)) return;
            const files = fs.readdirSync(this.updatesDir)
                .filter(f => f.startsWith('Adestio-Setup-') && f.endsWith('.exe'))
                .map(f => {
                    const stats = fs.statSync(path.join(this.updatesDir, f));
                    return { file: f, mtime: stats.mtimeMs };
                })
                .sort((a, b) => b.mtime - a.mtime); // Più recenti prima

            // Se ci sono più di 5 file, elimina i più vecchi
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

    /**
     * Ritorna la versione più alta disponibile localmente
     */
    getHighestLocalVersion() {
        try {
            if (!fs.existsSync(this.updatesDir)) return null;
            const files = fs.readdirSync(this.updatesDir)
                .filter(f => f.startsWith('Adestio-Setup-') && f.endsWith('.exe'));
            
            let highest = null;
            for (const file of files) {
                // Estrae la versione dal nome del file (es: Adestio-Setup-2.1.11.exe)
                const match = file.match(/Adestio-Setup-(.+)\.exe/);
                if (match && match[1]) {
                    const version = match[1];
                    if (version !== 'latest') { // ignoriamo se si chiama latest
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

    /**
     * Restituisce il path completo dell'installer per una certa versione
     */
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

    /**
     * Esegue l'installer e forza la chiusura dell'app
     */
    runInstaller(version) {
        try {
            const installerPath = this.getInstallerPath(version);
            if (!installerPath) return false;
            
            const { exec } = require('child_process');
            console.log(`[UpdatesManager] Avvio aggiornamento silente: ${installerPath}`);
            
            // Parametro /S indica a NSIS di eseguire installazione silente (background)
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

    /**
     * Salva un installer prelevato dalla rete locale o GitHub e pulisce quelli vecchi
     */
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
                    this.cleanOldUpdates(); // Mantiene la coda pulita
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

    /**
     * Utility: Compara due versioni SemVer.
     * Ritorna 1 se v1 > v2, -1 se v1 < v2, 0 se uguali
     */
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
