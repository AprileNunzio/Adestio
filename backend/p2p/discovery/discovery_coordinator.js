'use strict';
const bus = require('../../core/event_bus');
const { broadcast, getPhysicalSubnets } = require('./udp_broadcaster');
const { discover: discoverMdns } = require('./mdns_resolver');
const { scanArpTable, getLocalIPs } = require('./arp_scanner');
const { getNodeId, getNetworkName } = require('../../core/node_identity');
const { PROTOCOL_VERSION, PORT, UDP_PORT } = require('../protocol/constants');
async function _probeHost(ip, timeoutMs = 1200) {
    try {
        const controller = new AbortController();
        const tid = setTimeout(() => controller.abort(), timeoutMs);
        const t0 = Date.now();
        const res = await fetch(`http://${ip}:${PORT}/ping`, { signal: controller.signal });
        clearTimeout(tid);
        if (!res.ok) return null;
        const data = await res.json();
        if (data.status === 'ok' && data.isInitialized !== false) {
            return { ip, name: data.node || 'Adestio Node', port: PORT, pingMs: Date.now() - t0, protocolVersion: data.protocolVersion || 0, nodeId: data.nodeId || null };
        }
        return null;
    } catch (_) { return null; }
}
async function runDiscovery(onProgress) {
    const myIPs = new Set(getLocalIPs());
    const seen = new Set(myIPs);
    const myNodeId = getNodeId();
    const addPeer = (peer, source) => {
        if (!peer || !peer.ip || seen.has(peer.ip)) return;
        if (peer.nodeId === myNodeId || peer.ip === '127.0.0.1') {
            seen.add(peer.ip);
            return;
        }
        seen.add(peer.ip);
        bus.publish('peer:discovered', { ...peer, source: peer.source || source });
    };
    const _progress = (msg) => { if (typeof onProgress === 'function') onProgress(msg); };
    _progress('Fase 0: ARP...');
    const arpIPs = await scanArpTable();
    await Promise.all(arpIPs.map(async ip => { const r = await _probeHost(ip, 800); if (r) addPeer(r, 'arp'); }));
    _progress('Fase 1: UDP broadcast...');
    const discoverMsg = `DISCOVER_ADESTIO:${getNetworkName()}:${PORT}:${PROTOCOL_VERSION}:${getNodeId()}`;
    await broadcast(discoverMsg, UDP_PORT);
    _progress('Fase 2: mDNS...');
    const mdnsFound = await discoverMdns(1500);
    await Promise.all(mdnsFound.map(async svc => { const r = await _probeHost(svc.ip, 800); addPeer(r || svc, 'mdns'); }));
    _progress('Fase 3: subnet sweep...');
    const subnets = getPhysicalSubnets();
    const allIPs = new Set(arpIPs);
    for (const { subnet } of subnets) { for (let i = 2; i < 255; i++) allIPs.add(`${subnet}.${i}`); }
    for (const ip of seen) allIPs.delete(ip);
    const CHUNK = 50;
    const ipList = [...allIPs];
    for (let i = 0; i < ipList.length; i += CHUNK) {
        const results = await Promise.all(ipList.slice(i, i + CHUNK).map(ip => _probeHost(ip, 1000)));
        for (const r of results) if (r) addPeer(r, 'sweep');
        if (i + CHUNK < ipList.length) await new Promise(r => setTimeout(r, 50));
    }
    console.log(`[Discovery] Completato. ${seen.size - myIPs.size} peer trovati.`);
}
const DISCOVERY_INTERVAL_MS = 3 * 60 * 1000;
let _timer = null;
function start() {
    if (_timer) return;
    runDiscovery().catch(e => console.error('[Discovery] runDiscovery error:', e.message));
    _timer = setInterval(() => runDiscovery().catch(e => console.error('[Discovery]', e.message)), DISCOVERY_INTERVAL_MS);
}
function stop() { if (_timer) { clearInterval(_timer); _timer = null; } }
module.exports = { runDiscovery, start, stop };
