'use strict';
const bus = require('../../core/event_bus');
const WATCHDOG_INTERVAL_MS = 30000;
const STALE_THRESHOLD_MS = 60000;
let _timer = null;
let _lastSuccessAt = Date.now();
bus.subscribe('peer:synced', () => { _lastSuccessAt = Date.now(); });
function start() {
    if (_timer) return;
    _timer = setInterval(() => {
        const stale = Date.now() - _lastSuccessAt > STALE_THRESHOLD_MS;
        if (stale) {
            console.warn('[Watchdog] Rete non sincronizzata da', Math.round((Date.now() - _lastSuccessAt) / 1000) + 's. Trigger resync.');
            bus.publish('watchdog:stale', { lastSuccessAt: _lastSuccessAt, staleSinceMs: Date.now() - _lastSuccessAt });
        }
    }, WATCHDOG_INTERVAL_MS);
}
function stop() { if (_timer) { clearInterval(_timer); _timer = null; } }
function reset() { _lastSuccessAt = Date.now(); }
module.exports = { start, stop, reset };
