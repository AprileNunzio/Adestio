'use strict';
const bus = require('../../core/event_bus');

const STATES = { CLOSED: 'CLOSED', OPEN: 'OPEN', HALF_OPEN: 'HALF_OPEN' };
const FAILURE_THRESHOLD = 3;
const OPEN_TIMEOUT_MS = 60000;

const _breakers = new Map();

function _get(ip) {
    if (!_breakers.has(ip)) _breakers.set(ip, { state: STATES.CLOSED, failures: 0, openSince: 0 });
    return _breakers.get(ip);
}

function isAllowed(ip) {
    const b = _get(ip);
    if (b.state === STATES.CLOSED) return true;
    if (b.state === STATES.OPEN) {
        if (Date.now() - b.openSince > OPEN_TIMEOUT_MS) {
            b.state = STATES.HALF_OPEN;
            bus.publish('circuit-breaker:half-open', { ip });
            return true;
        }
        return false;
    }
    return true;
}

function onSuccess(ip) {
    const b = _get(ip);
    b.failures = 0;
    const prev = b.state;
    b.state = STATES.CLOSED;
    if (prev !== STATES.CLOSED) bus.publish('circuit-breaker:closed', { ip });
}

function onFailure(ip) {
    const b = _get(ip);
    b.failures++;
    if (b.state === STATES.HALF_OPEN || b.failures >= FAILURE_THRESHOLD) {
        b.state = STATES.OPEN;
        b.openSince = Date.now();
        bus.publish('circuit-breaker:opened', { ip, failures: b.failures });
    }
}

function getState(ip) { return _get(ip).state; }
function reset(ip) { _breakers.delete(ip); }

module.exports = { isAllowed, onSuccess, onFailure, getState, reset, STATES };
