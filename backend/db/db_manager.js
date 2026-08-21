const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { app } = require('electron');
const SqlJsAdapter = require('./SqlJsAdapter');
const BackupManager = require('./backup_manager');
const DeveloperVault = require('../security/developer_vault');
const { deriveKeyForPurpose } = require('../security/network_key_derivation');
const ALGO = 'aes-256-gcm';
const IV_LEN = 16;
const AUTH_TAG_LEN = 16;
class DatabaseManager {
    constructor() {
        this.databases = {
            config: null,
            auth: null,
            ledger: null,
            app: null,
            store: null,
            app_anagrafica: null,
            app_azienda: null,
            audit: null
        };
        this.deviceKey = null;
        this.basePath = null;
    }
    initPaths() {
        const activeNodeFile = path.join(app.getPath('userData'), 'active_node.json');
        let activeNode = 'default';
        if (fs.existsSync(activeNodeFile)) {
            try {
                const data = JSON.parse(fs.readFileSync(activeNodeFile, 'utf8'));
                if (data.node) activeNode = data.node;
            } catch(e) {}
        }
        this.basePath = path.join(app.getPath('userData'), 'dbs', activeNode);
        if (!fs.existsSync(this.basePath)) {
            fs.mkdirSync(this.basePath, { recursive: true });
        }
    }
    setActiveNode(nodeCode) {
        if (!nodeCode) return;
        const activeNodeFile = path.join(app.getPath('userData'), 'active_node.json');
        const safeNode = nodeCode.replace(/[^a-zA-Z0-9_-]/g, '');
        const dir = path.dirname(activeNodeFile);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(activeNodeFile, JSON.stringify({ node: safeNode }));
        const newBasePath = path.join(app.getPath('userData'), 'dbs', safeNode);
        if (this.basePath && this.basePath !== newBasePath) {
            if (fs.existsSync(this.basePath) && !fs.existsSync(newBasePath)) {
                try { fs.renameSync(this.basePath, newBasePath); } catch(e) {}
            }
        }
        this.basePath = newBasePath;
        if (!fs.existsSync(this.basePath)) {
            fs.mkdirSync(this.basePath, { recursive: true });
        }
    }
    loadOrGenerateLocalDeviceKey(networkCode = null) {
        try {
            const { safeStorage } = require('electron');
            const p = path.join(app.getPath('userData'), 'device.key');
            if (networkCode) {
                const newKey = deriveKeyForPurpose(networkCode, 'db-encryption');
                if (safeStorage && safeStorage.isEncryptionAvailable()) {
                    try {
                        const buffer = safeStorage.encryptString(newKey);
                        const dir = path.dirname(p);
                        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
                        fs.writeFileSync(p, buffer);
                    } catch (_) {}
                }
                return newKey;
            }
            if (fs.existsSync(p) && safeStorage && safeStorage.isEncryptionAvailable()) {
                try {
                    const buffer = fs.readFileSync(p);
                    const decrypted = safeStorage.decryptString(buffer);
                    if (decrypted) return decrypted;
                } catch (e) {}
            }
            const fallbackKey = crypto.randomBytes(32).toString('hex');
            if (safeStorage && safeStorage.isEncryptionAvailable()) {
                try {
                    const buffer = safeStorage.encryptString(fallbackKey);
                    const dir = path.dirname(p);
                    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
                    fs.writeFileSync(p, buffer);
                } catch (_) {}
            }
            return fallbackKey;
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
            const tmpPath = path.join(this.basePath, `${domain}.enc.tmp`);
            let decryptedData = null;
            let targetFile = dbPath;
            let fileExists = fs.existsSync(dbPath);
            if (fs.existsSync(tmpPath)) {
                if (!fileExists || fs.statSync(tmpPath).mtimeMs > fs.statSync(dbPath).mtimeMs) {
                    targetFile = tmpPath;
                    fileExists = true;
                }
            }
            if (fileExists) {
                try {
                    const fileBuffer = fs.readFileSync(targetFile);
                    decryptedData = this.decryptBuffer(fileBuffer, this.deviceKey);
                } catch (err) {}
                if (!decryptedData) {
                    const backupDir = path.join(this.basePath, 'backups', domain);
                    const fallbackPath = BackupManager.getLatestValidBackup(backupDir);
                    if (fallbackPath) {
                        try {
                            const fileBuffer = fs.readFileSync(fallbackPath);
                            decryptedData = this.decryptBuffer(fileBuffer, this.deviceKey);
                        } catch (err) {}
                    }
                }
                if (!decryptedData) {
                    throw new Error(`Impossibile decriptare il database esistente: ${domain}.enc`);
                }
            }
            const adapter = new SqlJsAdapter();
            const config = decryptedData ? { buffer: decryptedData } : null;
            await adapter.connect(config);
            try {
                const check = adapter.query('PRAGMA quick_check;');
                if (check && check.length > 0 && check[0].quick_check !== 'ok') {
                    throw new Error(`Corruzione rilevata in ${domain}`);
                }
            } catch (_) {}
            await adapter.runMigrations(migrations);
            this.databases[domain] = adapter;
            return true;
        } catch (e) {
            throw e; 
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
            try {
                const fd = fs.openSync(tmpPath, 'w');
                fs.writeSync(fd, encryptedData, 0, encryptedData.length, 0);
                try { fs.fsyncSync(fd); } catch (_) {}
                fs.closeSync(fd);
            } catch (wErr) {
                fs.writeFileSync(tmpPath, encryptedData);
            }
            let renameSuccess = false;
            let retries = 5;
            while (retries > 0 && !renameSuccess) {
                try {
                    fs.renameSync(tmpPath, dbPath);
                    renameSuccess = true;
                } catch (err) {
                    if (err.code === 'EBUSY' || err.code === 'EPERM') {
                        retries--;
                        if (retries === 0) {
                            renameSuccess = true; 
                        } else {
                            const start = Date.now();
                            while (Date.now() - start < 200) {} 
                        }
                    } else {
                        throw err;
                    }
                }
            }
            BackupManager.rotateDailyBackups(dbPath, backupDir);
            DeveloperVault.backupDatabase(domain, dbPath).catch(()=>{});
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
            const mStore = require('../migrations/store');
            const mAnagrafica = require('../migrations/anagrafica');
            const mAzienda = require('../migrations/azienda');
            const mAudit = require('../migrations/audit');
            await this.loadDatabase('auth', mAuth);
            await this.loadDatabase('config', mConfig);
            await this.loadDatabase('ledger', mLedger);
            await this.loadDatabase('app', mApp);
            await this.loadDatabase('store', mStore);
            await this.loadDatabase('app_anagrafica', mAnagrafica);
            await this.loadDatabase('app_azienda', mAzienda);
            await this.loadDatabase('audit', mAudit);
            if (this.databases['config']) {
                const res = this.databases['config'].query("SELECT key_value FROM network_config WHERE key_name = 'network_code'");
                if (res && res.length > 0) {
                    const netCode = res[0].key_value;
                    const expectedKey = deriveKeyForPurpose(netCode, 'db-encryption');
                    if (this.deviceKey !== expectedKey) {
                        this.deviceKey = this.loadOrGenerateLocalDeviceKey(netCode); 
                    }
                    const expectedHash = deriveKeyForPurpose(netCode, 'network-membership-hash');
                    const hashRes = this.databases['config'].query("SELECT key_value FROM network_config WHERE key_name = 'network_code_hash'");
                    const storedHash = (hashRes && hashRes.length > 0) ? hashRes[0].key_value : null;
                    if (storedHash !== expectedHash) {
                        this.databases['config'].execute("INSERT OR REPLACE INTO network_config (key_name, key_value) VALUES ('network_code_hash', ?)", [expectedHash]);
                    }
                }
            }
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
            this.databases = {
                config: null,
                auth: null,
                ledger: null,
                app: null,
                store: null,
                app_anagrafica: null,
                app_azienda: null,
                audit: null
            };
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
