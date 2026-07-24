'use strict';

const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const RATE_LIMIT_WINDOW = 60000;
const MAX_LOGS_PER_WINDOW = 10;
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
let _logTimestamps = [];

function _sanitizePii(obj) {
    try {
        if (!obj) return obj;
        if (typeof obj === 'string') {
            return obj.replace(/(password|secret|token|credit_card|iban|codice_fiscale)=[^&,\s]+/gi, '$1=[GDPR_MASKED]');
        }
        if (typeof obj !== 'object') return obj;

        const masked = Array.isArray(obj) ? [] : {};
        for (const [key, val] of Object.entries(obj)) {
            try {
                if (/password|pass|secret|token|credit_card|card_number|cvv|iban|codice_fiscale|tax_code/i.test(key)) {
                    masked[key] = '[GDPR_MASKED]';
                } else if (val && typeof val === 'object') {
                    masked[key] = _sanitizePii(val);
                } else if (typeof val === 'string') {
                    masked[key] = val.replace(/(password|secret|token|credit_card|iban|codice_fiscale)=[^&,\s]+/gi, '$1=[GDPR_MASKED]');
                } else {
                    masked[key] = val;
                }
            } catch (eKey) {
                masked[key] = val;
            }
        }
        return masked;
    } catch (e) {
        return obj;
    }
}

function _canPublishLogToDag() {
    try {
        const now = Date.now();
        _logTimestamps = _logTimestamps.filter(t => now - t < RATE_LIMIT_WINDOW);
        if (_logTimestamps.length >= MAX_LOGS_PER_WINDOW) return false;
        _logTimestamps.push(now);
        return true;
    } catch (e) {
        return false;
    }
}

function _publishToDag(level, message, meta) {
    try {
        if (!_canPublishLogToDag()) return;
        const bus = require('./core/event_bus');
        bus.publish('logger:distributed-error', { level, message, meta: _sanitizePii(meta) });
    } catch (e) {}
}

function getLogDir() {
    try {
        const dir = path.join(app.getPath('userData'), 'Log');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        return dir;
    } catch (e) {
        return null;
    }
}

function getLogFile(prefix = 'system_log') {
    try {
        const dir = getLogDir();
        if (!dir) return null;
        const date = new Date().toISOString().split('T')[0];
        const filePath = path.join(dir, `${prefix}_${date}.jsonl`);
        if (fs.existsSync(filePath)) {
            const stats = fs.statSync(filePath);
            if (stats.size > MAX_FILE_SIZE_BYTES) {
                const rotatedPath = path.join(dir, `${prefix}_${date}_${Date.now()}.jsonl`);
                fs.renameSync(filePath, rotatedPath);
            }
        }
        return filePath;
    } catch (e) {
        return null;
    }
}

function writeStructuredLog(level, message, meta = null, prefix = 'system_log') {
    try {
        const file = getLogFile(prefix);
        if (!file) return;
        const entry = {
            ts: new Date().toISOString(),
            level: String(level).toUpperCase(),
            msg: typeof message === 'object' ? JSON.stringify(_sanitizePii(message)) : _sanitizePii(String(message)),
            meta: _sanitizePii(meta) || null
        };
        fs.appendFileSync(file, JSON.stringify(entry) + '\n');
    } catch (e) {}
}

function logDebug(message, meta = null) {
    try {
        writeStructuredLog('DEBUG', message, meta, 'debug_log');
    } catch (e) {}
}

function logInfo(message, meta = null) {
    try {
        writeStructuredLog('INFO', message, meta, 'system_log');
    } catch (e) {}
}

function logWarn(message, meta = null) {
    try {
        writeStructuredLog('WARN', message, meta, 'system_log');
    } catch (e) {}
}

function logError(error, meta = null) {
    try {
        const msg = error && error.stack ? error.stack : (typeof error === 'object' ? JSON.stringify(error) : error);
        writeStructuredLog('ERROR', msg, meta, 'error_log');
        _publishToDag('ERROR', msg, meta);
    } catch (e) {}
}

function logSyncAnomaly(code, message, payload) {
    try {
        writeStructuredLog('SYNC_ANOMALY', `[${code}] ${message}`, payload, 'sync_audit');
        _publishToDag('SYNC_ANOMALY', `[${code}] ${message}`, payload);
    } catch (e) {}
}

function queryLogs(prefix = 'system_log', limit = 100) {
    try {
        const dir = getLogDir();
        if (!dir) return [];
        const files = fs.readdirSync(dir).filter(f => f.startsWith(prefix) && f.endsWith('.jsonl')).sort().reverse();
        const results = [];
        for (const file of files) {
            const content = fs.readFileSync(path.join(dir, file), 'utf8');
            const lines = content.trim().split('\n').filter(Boolean);
            for (let i = lines.length - 1; i >= 0; i--) {
                try {
                    results.push(JSON.parse(lines[i]));
                    if (results.length >= limit) return results;
                } catch (eLine) {}
            }
        }
        return results;
    } catch (e) {
        return [];
    }
}

function setupLogger() {
    try {
        const originalConsoleError = console.error;
        console.error = function(...args) {
            try { originalConsoleError.apply(console, args); } catch (e) {}
            try {
                const msg = args.map(a => (a && a.stack ? a.stack : (typeof a === 'object' ? JSON.stringify(a) : a))).join(' ');
                logError(msg);
            } catch (e) {}
        };
    } catch (e) {}
}

module.exports = { setupLogger, logDebug, logInfo, logWarn, logError, logSyncAnomaly, queryLogs };
