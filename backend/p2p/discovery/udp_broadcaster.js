'use strict';
const dgram = require('dgram');
const os = require('os');
const bus = require('../../core/event_bus');
const VIRTUAL_ADAPTER_PATTERNS = [
    /hyper-v/i, /virtualbox/i, /vmware/i, /vethernet/i,
    /loopback/i, /teredo/i, /isatap/i, /6to4/i, /wsl/i,
    /tap-windows/i, /cisco/i, /nordvpn/i, /expressvpn/i, /openvpn/i
];
function getPhysicalSubnets() {
    const interfaces = os.networkInterfaces();
    const subnets = [];
    for (const [name, addrs] of Object.entries(interfaces)) {
        if (VIRTUAL_ADAPTER_PATTERNS.some(p => p.test(name))) continue;
        for (const iface of addrs) {
            if (iface.family === 'IPv4' && !iface.internal) {
                const parts = iface.address.split('.');
                parts.pop();
                subnets.push({ subnet: parts.join('.'), address: iface.address });
            }
        }
    }
    if (subnets.length === 0) {
        for (const addrs of Object.values(interfaces)) {
            for (const iface of addrs) {
                if (iface.family === 'IPv4' && !iface.internal) {
                    const parts = iface.address.split('.');
                    parts.pop();
                    subnets.push({ subnet: parts.join('.'), address: iface.address });
                }
            }
        }
    }
    return subnets;
}
function broadcast(message, udpPort, timeoutMs = 1500) {
    return new Promise((resolve) => {
        const found = [];
        let client;
        try { client = dgram.createSocket({ type: 'udp4', reuseAddr: true }); } catch (_) { return resolve(found); }
        client.on('error', () => { try { client.close(); } catch (_) {} resolve(found); });
        client.on('message', (msg, rinfo) => {
            const str = msg.toString();
            if (!str.startsWith('I_AM_ADESTIO:')) return;
            const parts = str.split(':');
            const peer = { ip: rinfo.address, name: parts[1] || 'Adestio Node', port: parseInt(parts[2]) || 34567, protocolVersion: parseInt(parts[3]) || 0, nodeId: parts[4] || null };
            found.push(peer);
            bus.publish('peer:discovered', { ...peer, source: 'udp' });
        });
        client.bind(() => {
            try {
                client.setBroadcast(true);
                const msgBuf = Buffer.from(message);
                const targets = [...new Set([...getPhysicalSubnets().map(s => `${s.subnet}.255`), '255.255.255.255'])];
                for (const target of targets) {
                    client.send(msgBuf, 0, msgBuf.length, udpPort, target, (err) => {
                        if (err && !['EACCES', 'EHOSTUNREACH', 'ENETUNREACH'].includes(err.code)) {
                            console.warn(`[UdpBroadcaster] ${target}:`, err.message);
                        }
                    });
                }
            } catch (_) { resolve(found); }
        });
        setTimeout(() => { try { client.close(); } catch (_) {} resolve(found); }, timeoutMs);
    });
}
function startUdpListener(udpPort, localNodeIdFn, localNameFn, protocolVersion, onUpdateAvailable) {
    const server = dgram.createSocket({ type: 'udp4', reuseAddr: true });
    server.on('error', (err) => { console.error('[UdpBroadcaster] Server error:', err.message); });
    server.on('message', (msg, rinfo) => {
        try {
            const str = msg.toString();
            if (str.startsWith('DISCOVER_ADESTIO')) {
                const myNodeId = localNodeIdFn();
                const reply = Buffer.from(`I_AM_ADESTIO:${localNameFn()}:34567:${protocolVersion}:${myNodeId}`);
                server.send(reply, 0, reply.length, rinfo.port, rinfo.address);
                if (str.includes(':')) {
                    const p = str.split(':');
                    bus.publish('peer:discovered', { ip: rinfo.address, name: p[1] || 'Sconosciuto', port: parseInt(p[2]) || 34567, protocolVersion: parseInt(p[3]) || 0, nodeId: p[4] || null, source: 'udp-passive' });
                }
            } else if (str.startsWith('I_AM_ADESTIO:')) {
                const p = str.split(':');
                bus.publish('peer:discovered', { ip: rinfo.address, name: p[1] || 'Adestio Node', port: parseInt(p[2]) || 34567, protocolVersion: parseInt(p[3]) || 0, nodeId: p[4] || null, source: 'udp-passive' });
            } else if (str.startsWith('UPDATE_AVAILABLE_P2P:') && onUpdateAvailable) {
                const p = str.split(':');
                onUpdateAvailable(p[1], p[2] || rinfo.address);
            }
        } catch (_) {}
    });
    server.bind(udpPort, () => console.log(`[UdpBroadcaster] Listener attivo su UDP:${udpPort}`));
    return server;
}
module.exports = { broadcast, getPhysicalSubnets, startUdpListener };
