'use strict';
const bus = require('../core/event_bus');
const _counters = new Map();
const _gauges   = new Map();
const _histo    = new Map();
function increment(name, by = 1) { _counters.set(name, (_counters.get(name) || 0) + by); }
function gauge(name, value) { _gauges.set(name, value); }
function histogram(name, value) {
    if (!_histo.has(name)) _histo.set(name, []);
    const arr = _histo.get(name);
    arr.push(value);
    if (arr.length > 1000) arr.shift();
}
function getSnapshot() {
    const snap = { counters: {}, gauges: {}, histograms: {} };
    for (const [k, v] of _counters) snap.counters[k] = v;
    for (const [k, v] of _gauges)   snap.gauges[k] = v;
    for (const [k, arr] of _histo) {
        const sorted = [...arr].sort((a, b) => a - b);
        const p = (pct) => sorted[Math.floor(sorted.length * pct / 100)] || 0;
        snap.histograms[k] = { count: arr.length, p50: p(50), p95: p(95), p99: p(99) };
    }
    return snap;
}
bus.subscribe('block:applied',    () => increment('blocks.applied'));
bus.subscribe('block:created',    () => increment('blocks.created'));
bus.subscribe('peer:synced',      ({ latency }) => { increment('sync.success'); histogram('sync.latency_ms', latency); });
bus.subscribe('sync.error',       () => increment('sync.errors'));
bus.subscribe('circuit-breaker:opened', () => increment('circuit_breaker.opens'));
module.exports = { increment, gauge, histogram, getSnapshot };
