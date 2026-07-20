'use strict';
const bus = require('../../core/event_bus');
const STATES = {
    UNKNOWN:      'UNKNOWN',
    DISCOVERED:   'DISCOVERED',
    CONNECTING:   'CONNECTING',
    HANDSHAKING:  'HANDSHAKING',
    SYNCED:       'SYNCED',
    DEGRADED:     'DEGRADED',
    DISCONNECTED: 'DISCONNECTED'
};
const VALID_TRANSITIONS = {
    UNKNOWN:      ['DISCOVERED'],
    DISCOVERED:   ['CONNECTING', 'DISCONNECTED'],
    CONNECTING:   ['CONNECTING', 'HANDSHAKING', 'DEGRADED', 'DISCONNECTED'],
    HANDSHAKING:  ['SYNCED', 'DEGRADED', 'DISCONNECTED'],
    SYNCED:       ['SYNCED', 'CONNECTING', 'DEGRADED', 'DISCONNECTED'],
    DEGRADED:     ['CONNECTING', 'SYNCED', 'DISCONNECTED'],
    DISCONNECTED: ['DISCOVERED', 'CONNECTING']
};
class PeerFSM {
    constructor(ip) {
        this.ip = ip;
        this.state = STATES.UNKNOWN;
        this.since = Date.now();
    }
    transition(newState) {
        const allowed = VALID_TRANSITIONS[this.state] || [];
        if (!allowed.includes(newState)) {
            console.warn(`[PeerFSM] ${this.ip}: invalid transition ${this.state} → ${newState}`);
            return false;
        }
        const prev = this.state;
        this.state = newState;
        this.since = Date.now();
        bus.publish('peer:state-changed', { ip: this.ip, from: prev, to: newState, at: this.since });
        return true;
    }
    is(state) { return this.state === state; }
    isOneOf(...states) { return states.includes(this.state); }
}
module.exports = { PeerFSM, STATES };
