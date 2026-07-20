'use strict';
const _backoff = new Map();
const BASE_MS = 15000;
const MAX_MS = 5 * 60 * 1000;
function isOnCooldown(ip) {
    const e = _backoff.get(ip);
    return e ? Date.now() < e.nextRetryAt : false;
}
function recordFailure(ip) {
    const e = _backoff.get(ip) || { failures: 0, nextRetryAt: 0 };
    e.failures++;
    const jitter = 1 + Math.random() * 0.3;
    e.nextRetryAt = Date.now() + Math.min(BASE_MS * Math.pow(2, e.failures - 1) * jitter, MAX_MS);
    _backoff.set(ip, e);
}
function recordSuccess(ip) { _backoff.delete(ip); }
function getRetryAt(ip) { return _backoff.get(ip)?.nextRetryAt || 0; }
function getFailures(ip) { return _backoff.get(ip)?.failures || 0; }
module.exports = { isOnCooldown, recordFailure, recordSuccess, getRetryAt, getFailures };
