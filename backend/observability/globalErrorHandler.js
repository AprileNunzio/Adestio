const NETWORK_ERROR_CODES = new Set(['EHOSTUNREACH', 'ENETUNREACH', 'EADDRNOTAVAIL', 'ENOBUFS', 'EINVAL', 'ENOTFOUND', 'ECONNREFUSED', 'ETIMEDOUT']);
function setupGlobalErrorHandlers() {
    process.on('uncaughtException', (err) => {
        if (NETWORK_ERROR_CODES.has(err.code)) {
            try { require('./logger').logError('[Network] Uncaught network error (handled): ' + err.message); } catch(_) {}
            return;
        }
        try { require('./logger').logError('[Uncaught Exception] ' + (err.stack || err.message)); } catch(_) {}
        console.error('[Uncaught Exception]', err);
    });
    process.on('unhandledRejection', (reason) => {
        const msg = reason instanceof Error ? reason.message : String(reason);
        if (reason instanceof Error && NETWORK_ERROR_CODES.has(reason.code)) return;
        try { require('./logger').logError('[Unhandled Rejection] ' + msg); } catch(_) {}
        console.error('[Unhandled Rejection]', reason);
    });
}
module.exports = { setupGlobalErrorHandlers };
