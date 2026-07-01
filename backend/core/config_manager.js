'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');
const ALGO = 'aes-256-gcm';
let _path = null;
function _configPath() {
    if (_path) return _path;
    try {
        const { app } = require('electron');
        _path = path.join(app.getPath('documents'), 'NunzioTech', 'Adestio', 'config.enc');
    } catch (_) {
        _path = path.join(process.cwd(), 'config.enc');
    }
    return _path;
}
function _deriveKey() {
    try {
        const { getDeviceKey } = require('../db/db_manager');
        return getDeviceKey();
    } catch (_) {
        const id = os.hostname() + (os.cpus()[0]?.model || '');
        return crypto.pbkdf2Sync(id, Buffer.from('AdestioConfigSalt2026'), 100000, 32, 'sha256');
    }
}
function hasConfig() {
    return fs.existsSync(_configPath());
}
function readConfig() {
    try {
        const p = _configPath();
        if (!fs.existsSync(p)) return null;
        const buf = fs.readFileSync(p);
        const decipher = crypto.createDecipheriv(ALGO, _deriveKey(), buf.subarray(0, 16));
        decipher.setAuthTag(buf.subarray(16, 32));
        return JSON.parse(Buffer.concat([decipher.update(buf.subarray(32)), decipher.final()]).toString('utf8'));
    } catch (_) { return null; }
}
function saveConfig(dataObj) {
    try {
        const p = _configPath();
        const dir = path.dirname(p);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv(ALGO, _deriveKey(), iv);
        const enc = Buffer.concat([cipher.update(Buffer.from(JSON.stringify(dataObj))), cipher.final()]);
        fs.writeFileSync(p, Buffer.concat([iv, cipher.getAuthTag(), enc]));
        return true;
    } catch (_) { return false; }
}
module.exports = { hasConfig, readConfig, saveConfig };
