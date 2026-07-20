'use strict';
const _stats = new Map();
function _get(ip) {
    if (!_stats.has(ip)) _stats.set(ip, { successCount: 0, failureCount: 0, latencyMs: [], lastSuccessAt: 0, lastFailureAt: 0 });
    return _stats.get(ip);
}
function recordSuccess(ip, latencyMs = 0) {
    const s = _get(ip);
    s.successCount++;
    s.latencyMs.push(latencyMs);
    if (s.latencyMs.length > 20) s.latencyMs.shift();
    s.lastSuccessAt = Date.now();
}
function recordFailure(ip) {
    const s = _get(ip);
    s.failureCount++;
    s.lastFailureAt = Date.now();
}
function getStats(ip) { return { ..._get(ip) }; }
function getAvgLatency(ip) {
    const { latencyMs } = _get(ip);
    if (latencyMs.length === 0) return 0;
    return Math.round(latencyMs.reduce((a, b) => a + b, 0) / latencyMs.length);
}
module.exports = { recordSuccess, recordFailure, getStats, getAvgLatency };
