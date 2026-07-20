'use strict';
const fs = require('fs');
const path = require('path');
class DeveloperVault {
    constructor() {
        this.vaultPath = null;
        this.dbBackupPath = null;
        this.changelogPath = null;
        this.retentionDays = 30;
    }
    _ensurePaths() {
        if (this.vaultPath) return;
        try {
            const { app } = require('electron');
            this.vaultPath = path.join(app.getPath('userData'), 'vault');
            this.dbBackupPath = path.join(this.vaultPath, 'databases');
            this.changelogPath = path.join(this.vaultPath, 'changelog');
            fs.mkdirSync(this.dbBackupPath, { recursive: true });
            fs.mkdirSync(this.changelogPath, { recursive: true });
        } catch (e) {}
    }
    setRetentionDays(days) {
        if (Number.isInteger(days) && days > 0) this.retentionDays = days;
    }
    getTodayString() {
        return new Date().toISOString().split('T')[0];
    }
    async backupDatabase(domain, sourceFilePath) {
        this._ensurePaths();
        try {
            if (!fs.existsSync(sourceFilePath)) return;
            const destName = `${domain}_${this.getTodayString()}.enc`;
            fs.copyFileSync(sourceFilePath, path.join(this.dbBackupPath, destName));
        } catch (e) {
            console.error(`[Vault] Errore nel backup del DB ${domain}:`, e.message);
        }
    }
    async logMutation(block) {
        this._ensurePaths();
        try {
            const dbManager = require('../db/db_manager');
            if (!dbManager.deviceKey) return;
            const logFile = path.join(this.changelogPath, `mutations_${this.getTodayString()}.jsonl`);
            const entry = JSON.stringify({ timestamp: Date.now(), block });
            const encrypted = dbManager.encryptBuffer(Buffer.from(entry, 'utf8'), dbManager.deviceKey);
            if (!encrypted) return;
            fs.appendFileSync(logFile, encrypted.toString('base64') + '\n');
        } catch (e) {
            console.error('[Vault] Errore salvataggio changelog:', e.message);
        }
    }
    _readChangelogEntries(filePath) {
        const dbManager = require('../db/db_manager');
        const lines = fs.readFileSync(filePath, 'utf8').split('\n').filter(Boolean);
        const entries = [];
        for (const line of lines) {
            try {
                const decrypted = dbManager.decryptBuffer(Buffer.from(line, 'base64'), dbManager.deviceKey);
                if (decrypted) entries.push({ raw: line, data: JSON.parse(decrypted.toString('utf8')) });
            } catch (e) {}
        }
        return entries;
    }
    async deleteRecordMutations(tableName, recordId) {
        this._ensurePaths();
        try {
            if (!fs.existsSync(this.changelogPath)) return;
            const files = fs.readdirSync(this.changelogPath).filter(f => f.startsWith('mutations_'));
            for (const f of files) {
                const filePath = path.join(this.changelogPath, f);
                const entries = this._readChangelogEntries(filePath);
                const kept = entries.filter(e => !(e.data.block && e.data.block.table_name === tableName && String(e.data.block.record_id) === String(recordId)));
                if (kept.length !== entries.length) {
                    fs.writeFileSync(filePath, kept.map(e => e.raw).join('\n') + (kept.length ? '\n' : ''));
                }
            }
        } catch (e) {
            console.error('[Vault] Errore cancellazione selettiva:', e.message);
        }
    }
    async rotateVault(maxDays = null) {
        this._ensurePaths();
        try {
            const days = maxDays || this.retentionDays;
            const maxAgeMs = days * 24 * 60 * 60 * 1000;
            const now = Date.now();
            for (const dir of [this.dbBackupPath, this.changelogPath]) {
                if (!fs.existsSync(dir)) continue;
                for (const f of fs.readdirSync(dir)) {
                    const fp = path.join(dir, f);
                    try {
                        if (now - fs.statSync(fp).mtimeMs > maxAgeMs) fs.unlinkSync(fp);
                    } catch (e) {}
                }
            }
        } catch (e) {
            console.error('[Vault] Errore durante la rotazione:', e.message);
        }
    }
}
module.exports = new DeveloperVault();
