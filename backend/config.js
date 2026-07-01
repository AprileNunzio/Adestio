const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const crypto = require('crypto');
const ALGO = 'aes-256-gcm';
const STATIC_SECRET = 'AdestioEnterprisePortableSecretKey2026';
let configPath = null;
function getConfigPath() {
    if (!configPath) {
        configPath = path.join(app.getPath('documents'), 'NunzioTech', 'Adestio', 'config.enc');
    }
    return configPath;
}
function deriveStaticKey() {
    const salt = Buffer.from('AdestioSalt12345', 'utf8');
    return crypto.pbkdf2Sync(STATIC_SECRET, salt, 100000, 32, 'sha256');
}
function hasConfig(event) {
    try {
        const p = getConfigPath();
        return fs.existsSync(p);
    } catch (e) {
        return false;
    }
}
function readConfig(event) {
    try {
        const p = getConfigPath();
        if (!fs.existsSync(p)) return null;
        const fileBuffer = fs.readFileSync(p);
        const iv = fileBuffer.subarray(0, 16);
        const authTag = fileBuffer.subarray(16, 32);
        const encryptedData = fileBuffer.subarray(32);
        const key = deriveStaticKey();
        const decipher = crypto.createDecipheriv(ALGO, key, iv);
        decipher.setAuthTag(authTag);
        let decrypted = decipher.update(encryptedData);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return JSON.parse(decrypted.toString('utf8'));
    } catch (e) {
        console.error("Errore lettura config", e);
        return null;
    }
}
function saveConfig(event, dataObj) {
    try {
        const p = getConfigPath();
        const dir = path.dirname(p);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        const jsonStr = JSON.stringify(dataObj);
        const buffer = Buffer.from(jsonStr, 'utf8');
        const key = deriveStaticKey();
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv(ALGO, key, iv);
        let encryptedData = cipher.update(buffer);
        encryptedData = Buffer.concat([encryptedData, cipher.final()]);
        const authTag = cipher.getAuthTag();
        const finalBuffer = Buffer.concat([iv, authTag, encryptedData]);
        fs.writeFileSync(p, finalBuffer);
        return true;
    } catch (e) {
        console.error("Errore salvataggio config", e);
        return false;
    }
}
module.exports = { hasConfig, readConfig, saveConfig };
