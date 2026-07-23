'use strict';

const dgram = require('dgram');
const os = require('os');
const EventEmitter = require('events');

class PeerDiscovery extends EventEmitter {
    constructor() {
        super();
        try {
            this.port = 45890;
            this.socket = null;
            this.activePeers = new Map();
            this.nodeId = '';
            this.broadcastTimer = null;
        } catch (error) {
            console.error('[PeerDiscovery constructor Error]', error);
        }
    }

    start(nodeId) {
        try {
            this.nodeId = nodeId;
            this.socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

            this.socket.on('error', (err) => {
                try {
                    console.error('[PeerDiscovery Socket Error]', err);
                } catch (e) {
                    console.error('[PeerDiscovery Socket Error Print Fail]', e);
                }
            });

            this.socket.on('message', (msg, rinfo) => {
                try {
                    this.handleMessage(msg, rinfo);
                } catch (e) {
                    console.error('[PeerDiscovery Message Error]', e);
                }
            });

            this.socket.bind(this.port, () => {
                try {
                    this.socket.setBroadcast(true);
                    this.sendBeacon();
                    this.broadcastTimer = setInterval(() => {
                        try {
                            this.sendBeacon();
                            this.cleanupStalePeers();
                        } catch (timerErr) {
                            console.error('[PeerDiscovery Interval Error]', timerErr);
                        }
                    }, 5000);
                } catch (bindErr) {
                    console.error('[PeerDiscovery Bind Callback Error]', bindErr);
                }
            });
        } catch (error) {
            console.error('[PeerDiscovery start Error]', error);
        }
    }

    sendBeacon() {
        try {
            if (!this.socket || !this.nodeId) return;
            const payload = JSON.stringify({
                type: 'ADESTIO_BEACON',
                nodeId: this.nodeId,
                addresses: this.getLocalAddresses(),
                timestamp: Date.now()
            });
            const buffer = Buffer.from(payload);
            this.socket.send(buffer, 0, buffer.length, this.port, '255.255.255.255');
        } catch (error) {
            console.error('[PeerDiscovery sendBeacon Error]', error);
        }
    }

    handleMessage(msg, rinfo) {
        try {
            const data = JSON.parse(msg.toString());
            if (!data || data.type !== 'ADESTIO_BEACON') return;
            if (data.nodeId === this.nodeId) return;

            const peerKey = data.nodeId;
            const existing = this.activePeers.get(peerKey);

            const peerInfo = {
                nodeId: data.nodeId,
                address: rinfo.address,
                addresses: data.addresses || [rinfo.address],
                lastSeen: Date.now()
            };

            this.activePeers.set(peerKey, peerInfo);

            if (!existing) {
                this.emit('peerDiscovered', peerInfo);
            }
        } catch (error) {
            console.error('[PeerDiscovery handleMessage Parse Error]', error);
        }
    }

    cleanupStalePeers() {
        try {
            const now = Date.now();
            for (const [id, peer] of this.activePeers.entries()) {
                if (now - peer.lastSeen > 15000) {
                    this.activePeers.delete(id);
                    this.emit('peerLost', id);
                }
            }
        } catch (error) {
            console.error('[PeerDiscovery cleanupStalePeers Error]', error);
        }
    }

    getLocalAddresses() {
        try {
            const interfaces = os.networkInterfaces();
            const addresses = [];
            for (const name of Object.keys(interfaces)) {
                for (const iface of interfaces[name]) {
                    if (iface.family === 'IPv4' && !iface.internal) {
                        addresses.push(iface.address);
                    }
                }
            }
            return addresses;
        } catch (error) {
            console.error('[PeerDiscovery getLocalAddresses Error]', error);
            return [];
        }
    }

    getPeers() {
        try {
            return Array.from(this.activePeers.values());
        } catch (error) {
            console.error('[PeerDiscovery getPeers Error]', error);
            return [];
        }
    }

    stop() {
        try {
            if (this.broadcastTimer) {
                clearInterval(this.broadcastTimer);
                this.broadcastTimer = null;
            }
            if (this.socket) {
                this.socket.close();
                this.socket = null;
            }
            this.activePeers.clear();
        } catch (error) {
            console.error('[PeerDiscovery stop Error]', error);
        }
    }
}

module.exports = new PeerDiscovery();
