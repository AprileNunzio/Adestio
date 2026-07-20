'use strict';
const { app, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
function _keyPath() {
    return path.join(app.getPath('userData'), 'config.key');
}
function loadOrCreateConfigKey() {
    try {
        if (!safeStorage || !safeStorage.isEncryptionAvailable()) return null;
        const p = _keyPath();
        if (fs.existsSync(p)) {
            try {
                return safeStorage.decryptString(fs.readFileSync(p));
            } catch (e) {
                return null;
            }
        }
        const key = crypto.randomBytes(32).toString('hex');
        fs.writeFileSync(p, safeStorage.encryptString(key));
        return key;
    } catch (e) {
        return null;
    }
}
module.exports = { loadOrCreateConfigKey };
