'use strict';
const fs = require('fs');
const path = require('path');

let _logDir = null;

function _getLogDir() {
    if (_logDir) return _logDir;
    try {
        _logDir = path.join(require('electron').app.getPath('userData'), 'logs');
        fs.mkdirSync(_logDir, { recursive: true });
    } catch (_) {
        _logDir = path.join(require('os').tmpdir(), 'adestio-logs');
        fs.mkdirSync(_logDir, { recursive: true });
    }
    return _logDir;
}

function _rotate() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function _write(filename, data) {
    try { fs.appendFileSync(path.join(_getLogDir(), filename), data + '\n'); } catch (_) {}
}

function log(level, message, meta) {
    const entry = JSON.stringify({ ts: new Date().toISOString(), level, message, ...(meta || {}) });
    const date = _rotate();
    if (level === 'error') _write(`error_${date}.log`, entry);
    _write(`system_${date}.log`, entry);
    if (level === 'error' || level === 'warn') console.error(`[${level.toUpperCase()}] ${message}`, meta || '');
}

function info(msg, meta)  { log('info',  msg, meta); }
function warn(msg, meta)  { log('warn',  msg, meta); }
function error(msg, meta) { log('error', msg, meta); }
function debug(msg, meta) { if (process.env.ADESTIO_DEBUG) log('debug', msg, meta); }

function logSyncAnomaly(type, detail, context) {
    const date = _rotate();
    _write(`sync_audit_${date}.log`, JSON.stringify({ ts: new Date().toISOString(), type, detail, context: context || null }));
}

function getLogDir() { return _getLogDir(); }

module.exports = { log, info, warn, error, debug, logSyncAnomaly, getLogDir };
