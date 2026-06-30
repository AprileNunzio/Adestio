const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { app } = require('electron');
const SqlJsAdapter = require('./SqlJsAdapter');
const BackupManager = require('./backup_manager');

const ALGO = 'aes-256-gcm';
const IV_LEN = 16;
const AUTH_TAG_LEN = 16;

class DatabaseManager {
    constructor() {
        this.databases = {
            config: null,
            auth: null,
            ledger: null,
            app: null
        };
        this.deviceKey = null;
        this.basePath = null;
    }

    initPaths() {
        try {
            if (!this.basePath) {
                this.basePath = path.join(app.getPath('appData'), 'NunzioTech', 'Adestio', 'dbs');
                if (!fs.existsSync(this.basePath)) {
                    fs.mkdirSync(this.basePath, { recursive: true });
                }
            }
        } catch (e) {}
    }

    loadOrGenerateLocalDeviceKey() {
        try {
            const { safeStorage } = require('electron');
            if (!safeStorage || !safeStorage.isEncryptionAvailable()) return null;

            const p = path.join(app.getPath('appData'), 'NunzioTech', 'Adestio', 'device.key');
            if (fs.existsSync(p)) {
                try {
                    const buffer = fs.readFileSync(p);
                    return safeStorage.decryptString(buffer);
                } catch (e) {
                    return null;
                }
            } else {
                const newKey = crypto.randomBytes(32).toString('hex');
                const buffer = safeStorage.encryptString(newKey);
                const dir = path.dirname(p);
                if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
                fs.writeFileSync(p, buffer);
                return newKey;
            }
        } catch (e) {
            return null;
        }
    }

    decryptBuffer(fileBuffer, keyHex) {
        try {
            if (fileBuffer.length < IV_LEN + AUTH_TAG_LEN) throw new Error('Buffer too short');
            const key = Buffer.from(keyHex, 'hex');
            const iv = fileBuffer.subarray(0, IV_LEN);
            const authTag = fileBuffer.subarray(IV_LEN, IV_LEN + AUTH_TAG_LEN);
            const encryptedData = fileBuffer.subarray(IV_LEN + AUTH_TAG_LEN);
            const decipher = crypto.createDecipheriv(ALGO, key, iv);
            decipher.setAuthTag(authTag);
            let decrypted = decipher.update(encryptedData);
            return Buffer.concat([decrypted, decipher.final()]);
        } catch (e) {
            return null;
        }
    }

    encryptBuffer(dataBuffer, keyHex) {
        try {
            const key = Buffer.from(keyHex, 'hex');
            const iv = crypto.randomBytes(IV_LEN);
            const cipher = crypto.createCipheriv(ALGO, key, iv);
            let encryptedData = cipher.update(dataBuffer);
            encryptedData = Buffer.concat([encryptedData, cipher.final()]);
            const authTag = cipher.getAuthTag();
            return Buffer.concat([iv, authTag, encryptedData]);
        } catch (e) {
            return null;
        }
    }

    async loadDatabase(domain, migrations) {
        try {
            this.initPaths();
            const dbPath = path.join(this.basePath, `${domain}.enc`);
            const backupDir = path.join(this.basePath, 'backups', domain);

            let decryptedData = null;

            if (fs.existsSync(dbPath)) {
                const fileBuffer = fs.readFileSync(dbPath);
                decryptedData = this.decryptBuffer(fileBuffer, this.deviceKey);
            }

            if (!decryptedData) {
                const fallbackPath = BackupManager.getLatestValidBackup(backupDir);
                if (fallbackPath) {
                    const fileBuffer = fs.readFileSync(fallbackPath);
                    decryptedData = this.decryptBuffer(fileBuffer, this.deviceKey);
                }
            }

            const adapter = new SqlJsAdapter();
            const config = decryptedData ? { buffer: decryptedData } : null;

            await adapter.connect(config);
            await adapter.runMigrations(migrations);

            this.databases[domain] = adapter;
            return true;
        } catch (e) {
            return false;
        }
    }

    async saveDatabase(domain) {
        try {
            if (!this.databases[domain]) return false;
            if (!this.deviceKey) return false;

            const dataBuffer = await this.databases[domain].exportData();
            const encryptedData = this.encryptBuffer(dataBuffer, this.deviceKey);

            if (!encryptedData) return false;

            const dbPath = path.join(this.basePath, `${domain}.enc`);
            const tmpPath = path.join(this.basePath, `${domain}.enc.tmp`);
            const backupDir = path.join(this.basePath, 'backups', domain);

            fs.writeFileSync(tmpPath, encryptedData);
            fs.renameSync(tmpPath, dbPath);

            BackupManager.rotateDailyBackups(dbPath, backupDir);

            return true;
        } catch (e) {
            return false;
        }
    }

    async saveAll() {
        try {
            for (const domain of Object.keys(this.databases)) {
                if (this.databases[domain]) {
                    await this.saveDatabase(domain);
                }
            }
            return true;
        } catch (e) {
            return false;
        }
    }

    getDB(domain) {
        if (!this.databases[domain]) {
            const err = new Error('DB_NOT_INITIALIZED');
            err.isExpected = true;
            throw err;
        }
        return this.databases[domain];
    }

    async unlock() {
        try {
            this.deviceKey = this.loadOrGenerateLocalDeviceKey();
            if (!this.deviceKey) return false;

            const mAuth = require('../migrations/auth');
            const mConfig = require('../migrations/config');
            const mLedger = require('../migrations/ledger');
            const mApp = require('../migrations/app_data');

            await this.loadDatabase('auth', mAuth);
            await this.loadDatabase('config', mConfig);
            await this.loadDatabase('ledger', mLedger);
            await this.loadDatabase('app', mApp);

            await this.saveAll();
            return true;
        } catch (e) {
            return false;
        }
    }

    async reset() {
        try {
            this.initPaths();
            const files = fs.readdirSync(this.basePath);
            for (const f of files) {
                if (f.endsWith('.enc') || f.endsWith('.tmp')) {
                    fs.unlinkSync(path.join(this.basePath, f));
                }
            }
            this.databases = { config: null, auth: null, ledger: null, app: null };
            return true;
        } catch (e) {
            return false;
        }
    }

    isRegistered() {
        try {
            this.initPaths();
            return fs.existsSync(path.join(this.basePath, 'auth.enc')) || fs.existsSync(path.join(this.basePath, 'config.enc'));
        } catch (e) {
            return false;
        }
    }
}

const instance = new DatabaseManager();
module.exports = instance;
