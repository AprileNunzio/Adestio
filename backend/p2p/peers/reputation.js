'use strict';
const WEEK_MS = 7 * 24 * 3600 * 1000;
function _db() {
    return require('../../db').getDB('ledger');
}
function _row(nodeId) {
    const r = _db().query('SELECT * FROM peer_reputation WHERE node_id = ?', [nodeId]);
    return (r && r.length > 0) ? r[0] : null;
}
function _ensure(nodeId) {
    if (_row(nodeId)) return;
    const now = Date.now();
    _db().run('INSERT OR IGNORE INTO peer_reputation (node_id, successes, failures, latency_sum, samples, first_seen, last_seen, last_success, score, updated_at) VALUES (?, 0, 0, 0, 0, ?, ?, 0, 0.5, ?)', [nodeId, now, now, now]);
}
function _score(r) {
    const now = Date.now();
    const total = r.successes + r.failures;
    const reliability = total > 0 ? r.successes / total : 0.5;
    const recencyMs = now - (r.last_success || r.last_seen || now);
    const availability = Math.max(0, 1 - recencyMs / WEEK_MS);
    const avgLatency = r.samples > 0 ? r.latency_sum / r.samples : 1000;
    const latencyScore = Math.max(0, 1 - avgLatency / 2000);
    const experience = Math.min(1, total / 20);
    const s = 0.5 * reliability + 0.25 * availability + 0.15 * latencyScore + 0.10 * experience;
    return Math.max(0, Math.min(1, s));
}
function recordSuccess(nodeId, latencyMs) {
    if (!nodeId) return;
    _ensure(nodeId);
    const now = Date.now();
    const r = _row(nodeId);
    const score = _score({ ...r, successes: r.successes + 1, samples: r.samples + 1, latency_sum: r.latency_sum + (latencyMs || 0), last_seen: now, last_success: now });
    _db().run('UPDATE peer_reputation SET successes = successes + 1, samples = samples + 1, latency_sum = latency_sum + ?, last_seen = ?, last_success = ?, score = ?, updated_at = ? WHERE node_id = ?', [latencyMs || 0, now, now, score, now, nodeId]);
    require('../../db').saveDB('ledger');
}
function recordFailure(nodeId) {
    if (!nodeId) return;
    _ensure(nodeId);
    const now = Date.now();
    const r = _row(nodeId);
    const score = _score({ ...r, failures: r.failures + 1, last_seen: now });
    _db().run('UPDATE peer_reputation SET failures = failures + 1, last_seen = ?, score = ?, updated_at = ? WHERE node_id = ?', [now, score, now, nodeId]);
    require('../../db').saveDB('ledger');
}
function getScore(nodeId) {
    const r = _row(nodeId);
    return r ? r.score : 0.5;
}
function rank(nodeIds) {
    return (nodeIds || []).slice().sort((a, b) => getScore(b) - getScore(a));
}
module.exports = { recordSuccess, recordFailure, getScore, rank };
