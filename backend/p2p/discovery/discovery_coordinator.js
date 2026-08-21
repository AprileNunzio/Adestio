'use strict';
const bus = require('../../core/event_bus');
const { broadcast, getPhysicalSubnets } = require('./udp_broadcaster');
const { discover: discoverMdns } = require('./mdns_resolver');
const { scanArpTable, getLocalIPs } = require('./arp_scanner');
const { getNodeId, getNetworkName } = require('../../core/node_identity');
const { PROTOCOL_VERSION, PORT, UDP_PORT } = require('../protocol/constants');
async function _probeHost(ip, timeoutMs = 800) {
    try {
        const controller = new AbortController();
        const tid = setTimeout(() => controller.abort(), timeoutMs);
        const t0 = Date.now();
        const res = await fetch(`http://${ip}:${PORT}/ping`, { signal: controller.signal });
        clearTimeout(tid);
        if (!res.ok) return null;
        const data = await res.json();
        if (data.status === 'ok' && data.isInitialized !== false) {
            return { ip, name: data.node || 'Adestio Node', port: PORT, pingMs: Date.now() - t0, protocolVersion: data.protocolVersion || 0, nodeId: data.nodeId || null, updateReadyVersion: data.updateReadyVersion || null };
        }
        return null;
    } catch (_) { return null; }
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
        _progress('Fase 0: ARP...');
        const arpIPs = await scanArpTable();
        await Promise.all(arpIPs.map(async ip => { const r = await _probeHost(ip, 600); if (r) addPeer(r, 'arp'); }));
        _progress('Fase 1: UDP broadcast...');
        const discoverMsg = `DISCOVER_ADESTIO:${getNetworkName()}:${PORT}:${PROTOCOL_VERSION}:${getNodeId()}`;
        await broadcast(discoverMsg, UDP_PORT);
        _progress('Fase 2: mDNS...');
        const mdnsFound = await discoverMdns(1200);
        await Promise.all(mdnsFound.map(async svc => { const r = await _probeHost(svc.ip, 600); addPeer(r || svc, 'mdns'); }));
        _progress('Fase 3: subnet sweep...');
        const subnets = getPhysicalSubnets();
        const allIPs = new Set(arpIPs);
        for (const { subnet } of subnets) { for (let i = 2; i < 255; i++) allIPs.add(`${subnet}.${i}`); }
        for (const ip of seen) allIPs.delete(ip);
        const CHUNK = 80;
        const ipList = [...allIPs];
        for (let i = 0; i < ipList.length; i += CHUNK) {
            const results = await Promise.all(ipList.slice(i, i + CHUNK).map(ip => _probeHost(ip, 600)));
            for (const r of results) if (r) addPeer(r, 'sweep');
            if (i + CHUNK < ipList.length) await new Promise(r => setTimeout(r, 20));
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
