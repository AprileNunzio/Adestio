'use strict';
const crypto = require('crypto');
function _db() {
    return require('../../db').getDB('ledger');
}
function _sha(s) {
    return crypto.createHash('sha256').update(s).digest('hex');
}
function summarize() {
    const rows = _db().query('SELECT block_id FROM event_log');
    const ids = rows ? rows.map(r => r.block_id) : [];
    const groups = {};
    for (const id of ids) {
        const p = String(id).slice(0, 2);
        (groups[p] = groups[p] || []).push(id);
    }
    const buckets = {};
    let material = '';
    for (const p of Object.keys(groups).sort()) {
        const sorted = groups[p].slice().sort();
        const digest = _sha(sorted.join('|'));
        buckets[p] = { count: sorted.length, digest };
        material += p + ':' + digest + ';';
    }
    return { total: ids.length, root: _sha(material), buckets };
}
function bucketIds(prefix) {
    const rows = _db().query('SELECT block_id FROM event_log WHERE substr(block_id,1,2) = ?', [String(prefix)]);
    return rows ? rows.map(r => r.block_id) : [];
}
function diffPrefixes(local, remote) {
    const out = new Set();
    const lb = (local && local.buckets) || {};
    const rb = (remote && remote.buckets) || {};
    for (const p of Object.keys(rb)) if (!lb[p] || lb[p].digest !== rb[p].digest) out.add(p);
    for (const p of Object.keys(lb)) if (!rb[p] || rb[p].digest !== lb[p].digest) out.add(p);
    return [...out];
}
module.exports = { summarize, bucketIds, diffPrefixes };
