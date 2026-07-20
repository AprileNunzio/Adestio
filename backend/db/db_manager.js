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
            app_anagrafica: null
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
            if (!safeStorage || !safeStorage.isEncryptionAvailable()) return null;
            const p = path.join(app.getPath('userData'), 'device.key');
            if (networkCode) {
                const newKey = deriveKeyForPurpose(networkCode, 'db-encryption');
                const buffer = safeStorage.encryptString(newKey);
                const dir = path.dirname(p);
                if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
                fs.writeFileSync(p, buffer);
                return newKey;
            }
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
            const tmpPath = path.join(this.basePath, `${domain}.enc.tmp`);
            let decryptedData = null;
            let targetFile = dbPath;
            let fileExists = fs.existsSync(dbPath);
            if (fs.existsSync(tmpPath)) {
                if (!fileExists || fs.statSync(tmpPath).mtimeMs > fs.statSync(dbPath).mtimeMs) {
                    targetFile = tmpPath;
                    fileExists = true;
                    console.warn(`[DB] Rilevato file .tmp più recente per ${domain}. Eseguo recovery da Write-Aside!`);
                }
            }
            if (fileExists) {
                try {
                    const fileBuffer = fs.readFileSync(targetFile);
                    decryptedData = this.decryptBuffer(fileBuffer, this.deviceKey);
                } catch (err) {
                    console.error(`[DB] Fallita decrittazione ${domain}.enc`, err);
                }
                if (!decryptedData) {
                    const backupDir = path.join(this.basePath, 'backups', domain);
                    const fallbackPath = BackupManager.getLatestValidBackup(backupDir);
                    if (fallbackPath) {
                        try {
                            const fileBuffer = fs.readFileSync(fallbackPath);
                            decryptedData = this.decryptBuffer(fileBuffer, this.deviceKey);
                        } catch (err) {
                            console.error(`[DB] Fallita decrittazione backup per ${domain}`, err);
                        }
                    }
                }
                if (!decryptedData) {
                    throw new Error(`Impossibile decriptare il database esistente: ${domain}.enc. Chiave non valida o file corrotto.`);
                }
            }
            const adapter = new SqlJsAdapter();
            const config = decryptedData ? { buffer: decryptedData } : null;
            await adapter.connect(config);
            await adapter.runMigrations(migrations);
            this.databases[domain] = adapter;
            return true;
        } catch (e) {
            console.error(`[DB] Errore critico nel caricamento di ${domain}:`, e);
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
            fs.writeFileSync(tmpPath, encryptedData);
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
                            console.warn(`[DB] OneDrive Lock persistente su ${domain}.enc. I dati sono protetti in ${domain}.enc.tmp (Write-Aside)`);
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
            await this.loadDatabase('auth', mAuth);
            await this.loadDatabase('config', mConfig);
            await this.loadDatabase('ledger', mLedger);
            await this.loadDatabase('app', mApp);
            await this.loadDatabase('store', mStore);
            await this.loadDatabase('app_anagrafica', mAnagrafica);
            if (this.databases['config']) {
                const res = this.databases['config'].query("SELECT key_value FROM network_config WHERE key_name = 'network_code'");
                if (res && res.length > 0) {
                    const netCode = res[0].key_value;
                    const expectedKey = deriveKeyForPurpose(netCode, 'db-encryption');
                    if (this.deviceKey !== expectedKey) {
                        console.log('[Security] Eseguo migrazione silente verso Encryption deterministica...');
                        this.deviceKey = this.loadOrGenerateLocalDeviceKey(netCode); 
                    }
                    const expectedHash = deriveKeyForPurpose(netCode, 'network-membership-hash');
                    const hashRes = this.databases['config'].query("SELECT key_value FROM network_config WHERE key_name = 'network_code_hash'");
                    const storedHash = (hashRes && hashRes.length > 0) ? hashRes[0].key_value : null;
                    if (storedHash !== expectedHash) {
                        console.log('[Security] Aggiorno network_code_hash al nuovo schema di derivazione...');
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
