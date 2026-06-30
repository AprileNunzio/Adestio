const fs = require('fs');
const path = require('path');

class BackupManager {
    static rotateDailyBackups(sourcePath, backupDir, maxDays = 30) {
        try {
            if (!fs.existsSync(sourcePath)) return;
            if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

            const today = new Date().toISOString().split('T')[0];
            const dailyBackupPath = path.join(backupDir, `backup_${today}.enc`);

            if (!fs.existsSync(dailyBackupPath)) {
                fs.copyFileSync(sourcePath, dailyBackupPath);
            }

            const files = fs.readdirSync(backupDir)
                .filter(f => f.startsWith('backup_') && f.endsWith('.enc'))
                .sort((a, b) => b.localeCompare(a));

            if (files.length > maxDays) {
                for (const old of files.slice(maxDays)) {
                    try { fs.unlinkSync(path.join(backupDir, old)); } catch(_) {}
                }
            }
        } catch (e) {}
    }

    static getLatestValidBackup(backupDir) {
        try {
            if (!fs.existsSync(backupDir)) return null;
            const files = fs.readdirSync(backupDir)
                .filter(f => f.startsWith('backup_') && f.endsWith('.enc'))
                .sort((a, b) => b.localeCompare(a));
            if (files.length > 0) return path.join(backupDir, files[0]);
            return null;
        } catch (e) {
            return null;
        }
    }
}
module.exports = BackupManager;
