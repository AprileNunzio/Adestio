'use strict';
const bus = require('../../core/event_bus');
let BonjourClass = null;
const SERVICE_NAME = 'adestio-node';
async function _initBonjour() {
    if (!BonjourClass) {
        const mod = await import('bonjour-service');
        BonjourClass = mod.Bonjour;
    }
    return new BonjourClass();
}
function discover(timeoutMs = 2000) {
    return new Promise(async (resolve) => {
        const found = [];
        let bonjour = null;
        const done = () => { try { if (bonjour) bonjour.destroy(); } catch (_) {} resolve(found); };
        const timer = setTimeout(done, timeoutMs);
        try {
            bonjour = await _initBonjour();
            bonjour.find({ type: SERVICE_NAME }, (service) => {
                try {
                    const ip = service.addresses.find(a => /^\d+\.\d+\.\d+\.\d+$/.test(a));
                    if (!ip) return;
                    const peer = { ip, name: service.name, port: service.port, source: 'mdns' };
                    found.push(peer);
                    bus.publish('peer:discovered', peer);
                } catch (_) {}
            });
        } catch (e) {
            clearTimeout(timer);
            console.warn('[mDNS] discover unavailable:', e.message);
            done();
        }
    });
}
async function publish(name, port) {
    try {
        const b = await _initBonjour();
        const svc = b.publish({ name, type: SERVICE_NAME, port });
        if (svc && typeof svc.on === 'function') svc.on('error', e => console.warn('[mDNS] publish warning:', e.message));
        return b;
    } catch (e) {
        console.warn('[mDNS] publish failed:', e.message);
        return null;
    }
}
module.exports = { discover, publish };
