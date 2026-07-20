const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const RATE_LIMIT_WINDOW = 60000;
const MAX_LOGS_PER_WINDOW = 10;
let _logTimestamps = [];
function _canPublishLogToDag() {
    const now = Date.now();
    _logTimestamps = _logTimestamps.filter(t => now - t < RATE_LIMIT_WINDOW);
    if (_logTimestamps.length >= MAX_LOGS_PER_WINDOW) return false;
    _logTimestamps.push(now);
    return true;
}
function _publishToDag(level, message, meta) {
    if (!_canPublishLogToDag()) return;
    try {
        const bus = require('./core/event_bus');
        bus.publish('logger:distributed-error', { level, message, meta });
    } catch(e) {}
}
function getLogDir() {
    try {
        const dir = path.join(app.getPath('userData'), 'Log');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        return dir;
    } catch(e) {
        return null;
    }
}
function getLogFile(prefix = 'error_log') {
    const dir = getLogDir();
    if (!dir) return null;
    const date = new Date().toISOString().split('T')[0];
    return path.join(dir, `${prefix}_${date}.txt`);
}
function writeLog(level, message, meta = null, prefix = 'error_log') {
    try {
        const file = getLogFile(prefix);
        if (!file) return;
        const time = new Date().toISOString();
        let formattedMeta = '';
        if (meta) {
            formattedMeta = typeof meta === 'object' ? JSON.stringify(meta) : String(meta);
            formattedMeta = ` | Meta: ${formattedMeta}`;
        }
        const logLine = `[${time}] [${level}] ${message}${formattedMeta}\n`;
        fs.appendFileSync(file, logLine);
    } catch(e) {}
}
function logError(error, meta = null) {
    const msg = error && error.stack ? error.stack : (typeof error === 'object' ? JSON.stringify(error) : error);
    writeLog('ERROR', msg, meta);
    _publishToDag('ERROR', msg, meta);
}
function logInfo(message, meta = null) {
    writeLog('INFO', message, meta, 'system_log');
}
function logWarn(message, meta = null) {
    writeLog('WARN', message, meta, 'system_log');
}
function logSyncAnomaly(code, message, payload) {
    writeLog('SYNC_ANOMALY', `[${code}] ${message}`, payload, 'sync_audit');
    _publishToDag('SYNC_ANOMALY', `[${code}] ${message}`, payload);
}
function setupLogger() {
    const originalConsoleError = console.error;
    console.error = function(...args) {
        originalConsoleError.apply(console, args);
        try {
            const msg = args.map(a => (a && a.stack ? a.stack : (typeof a === 'object' ? JSON.stringify(a) : a))).join(' ');
            logError(msg);
        } catch(e) {}
    };
}
module.exports = { setupLogger, logError, logInfo, logWarn, logSyncAnomaly };
