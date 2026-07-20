export class DataService {
    constructor() {
        try {
            this._localNode = null;
            this._peers = [];
            this._appStatus = null;
            this._extendedMetrics = null;
            this._lastRefresh = 0;
            this._syncEvents = [];
            this._peerHistory = new Map();
            this._bootTime = Date.now();
            this._refreshCount = 0;
        } catch (e) {
            console.error('[DataService] constructor error:', e);
        }
    }
    async refresh() {
        try {
            const promises = [
                window.electronAPI.getAppStatus(),
                window.electronAPI.getDetailedNodes(),
                window.electronAPI.getNodeId()
            ];
            if (window.electronAPI.getExtendedNodeMetrics) {
                promises.push(window.electronAPI.getExtendedNodeMetrics());
            }
            const results = await Promise.allSettled(promises);
            this._appStatus = results[0].status === 'fulfilled' ? results[0].value : this._appStatus;
            const rawPeers = results[1].status === 'fulfilled' ? (results[1].value || []) : [];
            const localId = results[2].status === 'fulfilled' ? results[2].value : 'Sconosciuto';
            this._extendedMetrics = results.length > 3 && results[3].status === 'fulfilled' ? results[3].value : this._extendedMetrics;
            this._localNode = {
                nodeId: localId,
                ip: '127.0.0.1',
                name: 'Nodo Locale (Questo PC)',
                status: 'Online',
                isLocal: true,
                pingMs: 0,
                protocolVersion: this._appStatus?.protocolVersion || 2,
                port: this._extendedMetrics?.port || 34567,
                ledgerHeight: this._appStatus?.ledgerHeight || 0,
                lastSeen: Date.now(),
                uptime: Math.floor((Date.now() - this._bootTime) / 1000)
            };
            this._peers = rawPeers.map(p => {
                try {
                    const history = this._peerHistory.get(p.ip);
                    return {
                        ...p,
                        isLocal: false,
                        reliability: history ? Math.round((history.seen / Math.max(history.total, 1)) * 100) : 100,
                        uptime: history ? Math.floor((Date.now() - history.firstSeen) / 1000) : 0,
                        ledgerHeight: p.ledgerHeight || this._extendedMetrics?.peerHeights?.[p.ip] || null
                    };
                } catch (e) {
                    return { ...p, isLocal: false, reliability: 0, uptime: 0 };
                }
            });
            for (const peer of this._peers) {
                try {
                    if (!this._peerHistory.has(peer.ip)) {
                        this._peerHistory.set(peer.ip, { seen: 0, total: 0, firstSeen: Date.now() });
                    }
                    const h = this._peerHistory.get(peer.ip);
                    h.seen++;
                    h.total++;
                } catch (e) {}
            }
            for (const [ip, h] of this._peerHistory.entries()) {
                try {
                    if (!this._peers.find(p => p.ip === ip)) {
                        h.total++;
                    }
                } catch (e) {}
            }
            this._refreshCount++;
            this._lastRefresh = Date.now();
        } catch (e) {
            console.error('[DataService] refresh error:', e);
        }
    }
    getLocalNode() {
        try {
            return this._localNode;
        } catch (e) {
            return null;
        }
    }
    getPeers() {
        try {
            return [...this._peers];
        } catch (e) {
            return [];
        }
    }
    getAllNodes() {
        try {
            const all = [];
            if (this._localNode) all.push(this._localNode);
            all.push(...this._peers);
            return all;
        } catch (e) {
            return [];
        }
    }
    getNetworkStats() {
        try {
            const peers = this._peers;
            const totalNodes = 1 + peers.length;
            const totalBlocks = this._appStatus?.ledgerHeight || 0;
            const avgLatency = peers.length > 0
                ? Math.round(peers.reduce((sum, p) => sum + (p.pingMs || 0), 0) / peers.length)
                : 0;
            const throughput = this._extendedMetrics?.throughput || 0;
            const protocolVersion = this._appStatus?.protocolVersion || 2;
            const syncState = this._appStatus?.syncState || 'Sconosciuto';
            return { totalNodes, totalBlocks, avgLatency, throughput, protocolVersion, syncState };
        } catch (e) {
            return { totalNodes: 1, totalBlocks: 0, avgLatency: 0, throughput: 0, protocolVersion: 2, syncState: 'Errore' };
        }
    }
    getLedgerMetrics() {
        try {
            const em = this._extendedMetrics || {};
            return {
                height: this._appStatus?.ledgerHeight || 0,
                lastBlockHash: em.lastBlockHash || 'N/A',
                lastBlockTime: em.lastBlockTime || null,
                pendingBlocks: em.pendingBlocks || 0,
                totalEvents: em.totalEvents || 0,
                dagTips: em.dagTips || 1,
                syncState: this._appStatus?.syncState || 'Sconosciuto'
            };
        } catch (e) {
            return { height: 0, lastBlockHash: 'N/A', lastBlockTime: null, pendingBlocks: 0, totalEvents: 0, dagTips: 1, syncState: 'Errore' };
        }
    }
    getNetworkHealthScore() {
        try {
            let score = 100;
            const peers = this._peers;
            const syncState = this._appStatus?.syncState || '';
            if (peers.length === 0) {
                score -= 40;
            }
            if (syncState.includes('Errore') || syncState.includes('non raggiungibile')) {
                score -= 30;
            } else if (syncState.includes('corso') || syncState.includes('Riconnessione')) {
                score -= 10;
            }
            const avgLatency = peers.length > 0
                ? peers.reduce((s, p) => s + (p.pingMs || 0), 0) / peers.length
                : 0;
            if (avgLatency > 500) score -= 20;
            else if (avgLatency > 200) score -= 10;
            else if (avgLatency > 100) score -= 5;
            const pendingBlocks = this._extendedMetrics?.pendingBlocks || 0;
            if (pendingBlocks > 10) score -= 15;
            else if (pendingBlocks > 0) score -= 5;
            return Math.max(0, Math.min(100, score));
        } catch (e) {
            return 0;
        }
    }
    getSyncEvents() {
        try {
            return [...this._syncEvents].slice(-20);
        } catch (e) {
            return [];
        }
    }
    addSyncEvent(type, message) {
        try {
            this._syncEvents.push({
                type,
                message,
                timestamp: Date.now()
            });
            if (this._syncEvents.length > 50) {
                this._syncEvents = this._syncEvents.slice(-30);
            }
        } catch (e) {}
    }
    getPeerReliability(ip) {
        try {
            const h = this._peerHistory.get(ip);
            if (!h) return 100;
            return Math.round((h.seen / Math.max(h.total, 1)) * 100);
        } catch (e) {
            return 0;
        }
    }
    formatUptime(seconds) {
        try {
            if (!seconds || seconds < 0) return '0s';
            const d = Math.floor(seconds / 86400);
            const h = Math.floor((seconds % 86400) / 3600);
            const m = Math.floor((seconds % 3600) / 60);
            const s = seconds % 60;
            if (d > 0) return `${d}g ${h}h`;
            if (h > 0) return `${h}h ${m}m`;
            if (m > 0) return `${m}m ${s}s`;
            return `${s}s`;
        } catch (e) {
            return '0s';
        }
    }
    destroy() {
        try {
            this._peers = [];
            this._localNode = null;
            this._appStatus = null;
            this._extendedMetrics = null;
            this._syncEvents = [];
            this._peerHistory.clear();
        } catch (e) {}
    }
}
