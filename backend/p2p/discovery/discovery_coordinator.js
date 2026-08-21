'use strict';
const bus = require('../../core/event_bus');
const { broadcast, getPhysicalSubnets } = require('./udp_broadcaster');
const { discover: discoverMdns } = require('./mdns_resolver');
const { scanArpTable, getLocalIPs } = require('./arp_scanner');
const { getNodeId, getNetworkName } = require('../../core/node_identity');
const { PROTOCOL_VERSION, PORT, UDP_PORT } = require('../protocol/constants');
const http = require('http');
function _probeHost(ip, timeoutMs = 500) {
    return new Promise((resolve) => {
        try {
            const req = http.get({ host: ip, port: PORT, path: '/ping', timeout: timeoutMs }, (res) => {
                let data = '';
                res.on('data', c => data += c);
                res.on('end', () => {
                    try {
                        const json = JSON.parse(data);
                        if (json.status === 'ok' && json.isInitialized !== false) {
                            return resolve({
                                ip,
                                name: json.node || 'Adestio Node',
                                port: PORT,
                                pingMs: 1,
                                protocolVersion: json.protocolVersion || 0,
                                nodeId: json.nodeId || null,
                                updateReadyVersion: json.updateReadyVersion || null
                            });
                        }
                        resolve(null);
                    } catch (_) { resolve(null); }
                });
            });
            req.on('error', () => resolve(null));
            req.on('timeout', () => {
                try { req.destroy(); } catch (_) {}
                resolve(null);
            });
        } catch (_) {
            resolve(null);
        }
    });
}
async function runDiscovery(onProgress) {
    try {
        const myIPs = new Set(getLocalIPs());
        const seen = new Set(myIPs);
        const myNodeId = getNodeId();
        const foundNodes = [];
        const addPeer = (peer, source) => {
            if (!peer || !peer.ip || seen.has(peer.ip)) return;
            if (peer.nodeId === myNodeId || peer.ip === '127.0.0.1') {
                seen.add(peer.ip);
                return;
            }
            seen.add(peer.ip);
            const peerInfo = { ...peer, source: peer.source || source, host: peer.ip };
            foundNodes.push(peerInfo);
            bus.publish('peer:discovered', peerInfo);
        };
        const _progress = (msg) => { if (typeof onProgress === 'function') onProgress(msg); };
        _progress('Fase 0: Tabella ARP...');
        const arpIPs = await scanArpTable();
        await Promise.all(arpIPs.map(async ip => { const r = await _probeHost(ip, 500); if (r) addPeer(r, 'arp'); }));
        _progress('Fase 1: UDP broadcast...');
        const discoverMsg = `DISCOVER_ADESTIO:${getNetworkName() || 'Adestio'}:${PORT}:${PROTOCOL_VERSION}:${getNodeId()}`;
        const udpPeers = await broadcast(discoverMsg, UDP_PORT, 1200);
        if (Array.isArray(udpPeers)) {
            for (const p of udpPeers) addPeer(p, 'udp');
        }
        _progress('Fase 2: mDNS...');
        const mdnsFound = await discoverMdns(1000);
        await Promise.all(mdnsFound.map(async svc => { const r = await _probeHost(svc.ip, 500); addPeer(r || svc, 'mdns'); }));
        _progress('Fase 3: Scansione sottorete locale...');
        const subnets = getPhysicalSubnets();
        const allIPs = new Set(arpIPs);
        for (const { subnet } of subnets) {
            for (let i = 1; i < 255; i++) allIPs.add(`${subnet}.${i}`);
        }
        for (const ip of seen) allIPs.delete(ip);
        const CHUNK = 80;
        const ipList = [...allIPs];
        for (let i = 0; i < ipList.length; i += CHUNK) {
            const results = await Promise.all(ipList.slice(i, i + CHUNK).map(ip => _probeHost(ip, 500)));
            for (const r of results) if (r) addPeer(r, 'sweep');
        }
        return foundNodes;
    } catch (e) {
        return [];
    }
}
const DISCOVERY_INTERVAL_MS = 60 * 1000;
let _timer = null;
function start() {
    if (_timer) return;
    runDiscovery().catch(() => {});
    _timer = setInterval(() => runDiscovery().catch(() => {}), DISCOVERY_INTERVAL_MS);
}
function stop() { if (_timer) { clearInterval(_timer); _timer = null; } }
module.exports = { runDiscovery, start, stop };
