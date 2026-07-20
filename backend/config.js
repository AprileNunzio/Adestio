'use strict';
const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const crypto = require('crypto');
const ALGO = 'aes-256-gcm';
const _LEGACY_SECRET = 'AdestioEnterprisePortableSecretKey2026';
const _LEGACY_SALT = Buffer.from('AdestioSalt12345', 'utf8');
function _legacyKey() {
    return crypto.pbkdf2Sync(_LEGACY_SECRET, _LEGACY_SALT, 100000, 32, 'sha256');
}
function _getConfigPath() {
    return path.join(app.getPath('userData'), 'config.enc');
}
function _decrypt(fileBuffer, key) {
    const iv = fileBuffer.subarray(0, 16);
    const authTag = fileBuffer.subarray(16, 32);
    const encData = fileBuffer.subarray(32);
    const decipher = crypto.createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(authTag);
    let dec = decipher.update(encData);
    dec = Buffer.concat([dec, decipher.final()]);
    return JSON.parse(dec.toString('utf8'));
}
function _encrypt(dataObj, key) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGO, key, iv);
    const jsonBuf = Buffer.from(JSON.stringify(dataObj), 'utf8');
    let enc = cipher.update(jsonBuf);
    enc = Buffer.concat([enc, cipher.final()]);
    const authTag = cipher.getAuthTag();
    return Buffer.concat([iv, authTag, enc]);
}
function _getActiveKey() {
    try {
        const { loadOrCreateConfigKey } = require('./security/config_key');
        const hex = loadOrCreateConfigKey();
        return hex ? Buffer.from(hex, 'hex') : null;
    } catch (e) {
        return null;
    }
}
function hasConfig(event) {
    try {
        return fs.existsSync(_getConfigPath());
    } catch (e) {
        return false;
    }
}
function readConfig(event) {
    try {
        const p = _getConfigPath();
        if (!fs.existsSync(p)) return null;
        const fileBuffer = fs.readFileSync(p);
        const activeKey = _getActiveKey();
        if (activeKey) {
            try {
                return _decrypt(fileBuffer, activeKey);
            } catch (_) {
                try {
                    const parsed = _decrypt(fileBuffer, _legacyKey());
                    const newBuf = _encrypt(parsed, activeKey);
                    fs.writeFileSync(p, newBuf);
                    return parsed;
                } catch (_2) {
                    return null;
                }
            }
        }
        try {
            return _decrypt(fileBuffer, _legacyKey());
        } catch (_) {
            return null;
        }
    } catch (e) {
        console.error('[Config] readConfig error:', e.message);
        return null;
    }
}
function saveConfig(event, dataObj) {
    try {
        const p = _getConfigPath();
        fs.mkdirSync(path.dirname(p), { recursive: true });
        const activeKey = _getActiveKey();
        const key = activeKey || _legacyKey();
        const buf = _encrypt(dataObj, key);
        fs.writeFileSync(p, buf);
        return true;
    } catch (e) {
        console.error('[Config] saveConfig error:', e.message);
        return false;
    }
}
module.exports = { hasConfig, readConfig, saveConfig };
