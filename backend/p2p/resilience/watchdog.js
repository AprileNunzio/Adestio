'use strict';
const bus = require('../../core/event_bus');
const WATCHDOG_INTERVAL_MS = 30000;
const STALE_THRESHOLD_MS = 60000;
const ISOLATED_THRESHOLD_MS = 5 * 60 * 1000;
let _timer = null;
let _lastSuccessAt = Date.now();
let _isolatedNotified = false;
bus.subscribe('peer:synced', () => { _lastSuccessAt = Date.now(); _isolatedNotified = false; });
function _notifyIsolated(staleSinceMs) {
    bus.publish('network:isolated', { staleSinceMs });
    try {
        const { BrowserWindow } = require('electron');
        BrowserWindow.getAllWindows().forEach(w => { if (!w.isDestroyed()) w.webContents.send('network-isolated', { staleSinceMs }); });
    } catch (_) {}
}
function start() {
    if (_timer) return;
    _timer = setInterval(() => {
        const staleSinceMs = Date.now() - _lastSuccessAt;
        const stale = staleSinceMs > STALE_THRESHOLD_MS;
        if (stale) {
            console.warn('[Watchdog] Rete non sincronizzata da', Math.round(staleSinceMs / 1000) + 's. Trigger resync.');
            bus.publish('watchdog:stale', { lastSuccessAt: _lastSuccessAt, staleSinceMs });
        }
        if (!_isolatedNotified && staleSinceMs > ISOLATED_THRESHOLD_MS) {
            try {
                const { getAllPeers } = require('../peers/peer_registry');
                if (getAllPeers().length > 0) {
                    _isolatedNotified = true;
                    _notifyIsolated(staleSinceMs);
                }
            } catch (_) {}
        }
    }, WATCHDOG_INTERVAL_MS);
}
function stop() { if (_timer) { clearInterval(_timer); _timer = null; } }
function reset() { _lastSuccessAt = Date.now(); _isolatedNotified = false; }
module.exports = { start, stop, reset };
