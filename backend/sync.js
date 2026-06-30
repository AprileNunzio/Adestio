const express = require('express');
const cors = require('cors');
const os = require('os');
const dgram = require('dgram');
const crypto = require('crypto');
const { getDB, saveDB, getNetworkCodeHash } = require('./db');

const PROTOCOL_VERSION = 2;
const MIN_COMPATIBLE_PROTOCOL_VERSION = 2;

let peerCacheSaveTimer = null;

let serverInstance = null;
let bonjourInstance = null;
const PORT = 34567;
const SERVICE_NAME = 'adestio-node';

let BonjourClass = null;
let uuidv4 = null;
const activePeers = {};
const incompatiblePeers = new Set();
let udpServer = null;

function broadcastUpdateAvailable(version) {
    try {
        if (!udpServer) return;
        const msg = Buffer.from(`UPDATE_AVAILABLE:${version}`);
        // Invia su broadcast LAN o indirizzo di multicast
        udpServer.send(msg, 0, msg.length, UDP_PORT, '255.255.255.255');
    } catch (e) {
        console.error('[Sync] Errore invio UDP UPDATE_AVAILABLE', e);
    }
}
let bgDiscoveryTimer = null;
let pruneTimer = null;
const UDP_PORT = 34568;

async function initBonjour() {
    try {
        if (!BonjourClass) {
            const mod = await import('bonjour-service');
            BonjourClass = mod.Bonjour;
        }
        return new BonjourClass();
    } catch (e) {
        console.error(e);
        throw e;
    }
}

async function getUUID() {
    try {
        if (!uuidv4) {
            const mod = await import('uuid');
            uuidv4 = mod.v4;
        }
        return uuidv4();
    } catch (e) {
        console.error(e);
        return null;
    }
}

function getLocalIPs() {
    const interfaces = os.networkInterfaces();
    const ips = ['127.0.0.1', 'localhost', '::1'];
    try {
        for (const name of Object.keys(interfaces)) {
            for (const iface of interfaces[name]) {
                if (!iface.internal) {
                    ips.push(iface.address);
                }
            }
        }
    } catch (e) {}
    return ips;
}

function savePeerCache() {
    try {
        const db = require('./db').getDB('config');
        for (const [ip, data] of Object.entries(activePeers)) {
            if (ip === '127.0.0.1') continue;
            try {
                db.run(
                    `INSERT INTO known_peers (ip, port, name, node_id, protocol_version, last_seen, success_count, failure_count)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                     ON CONFLICT(ip) DO UPDATE SET
                         port = excluded.port,
                         name = excluded.name,
                         node_id = COALESCE(excluded.node_id, known_peers.node_id),
                         protocol_version = excluded.protocol_version,
                         last_seen = excluded.last_seen,
                         success_count = known_peers.success_count + excluded.success_count,
                         failure_count = known_peers.failure_count + excluded.failure_count`,
                    [ip, data.port || PORT, data.name || 'Adestio Node', data.nodeId || null,
                     data.protocolVersion || 0, data.lastSeen || Date.now(),
                     data._successDelta || 0, data._failureDelta || 0]
                );
                if (data._successDelta) data._successDelta = 0;
                if (data._failureDelta) data._failureDelta = 0;
            } catch (_) {}
        }
        require('./db').saveDB('config');
    } catch (e) {
        console.error('[Sync] savePeerCache error:', e);
    }
}

function loadPeerCache() {
    try {
        const db = require('./db').getDB('config');
        const rows = db.query('SELECT ip, port, name, node_id, protocol_version, last_seen FROM known_peers ORDER BY last_seen DESC LIMIT 50');
        if (!rows || rows.length === 0) return;
        const myIPs = getLocalIPs();
        for (const row of rows) {
            if (myIPs.includes(row.ip)) continue;
            if (incompatiblePeers.has(row.ip)) continue;
            activePeers[row.ip] = {
                name: row.name || 'Adestio Node',
                port: row.port || PORT,
                lastSeen: row.last_seen || 0,
                pingMs: 0,
                protocolVersion: row.protocol_version || 0,
                nodeId: row.node_id || null,
                _fromCache: true
            };
        }
        console.log(`[Sync] Caricati ${rows.length} peer dalla cache.`);
    } catch (e) {
        console.error('[Sync] loadPeerCache error:', e);
    }
}

function addNodeToMemory(name, host, port, pingMs = 0, peerProtocolVersion = 0, nodeId = null) {
    try {
        const myIPs = getLocalIPs();
        if (myIPs.includes(host)) return;

        if (nodeId && nodeId === getLocalNodeId()) return;

        if (incompatiblePeers.has(host)) return;
        let finalName = name;
        if (name === 'Sconosciuto' && activePeers[host] && activePeers[host].name && activePeers[host].name !== 'Sconosciuto') {
            finalName = activePeers[host].name;
        }

        activePeers[host] = {
            name: finalName,
            port,
            lastSeen: Date.now(),
            pingMs,
            protocolVersion: peerProtocolVersion,
            nodeId: nodeId || (activePeers[host] ? activePeers[host].nodeId : null)
        };

        if (!peerCacheSaveTimer) {
            peerCacheSaveTimer = setTimeout(() => {
                peerCacheSaveTimer = null;
                savePeerCache();
            }, 10000);
        }
    } catch (e) {
        console.error('[Sync] addNodeToMemory error:', e);
    }
}

function getLocalNodeId() {
    try {
        const db = require('./db').getDB('config');
        const res = db.query("SELECT key_value FROM network_config WHERE key_name = 'node_id'");
        if (res && res.length > 0) {
            return res[0].key_value;
        }
        return crypto.randomBytes(16).toString('hex');
    } catch (e) {
        return crypto.randomBytes(16).toString('hex');
    }
}

function getNetworkName() {
    try {
        const db = require('./db').getDB('config');
        const res = db.query("SELECT key_value FROM network_config WHERE key_name = 'network_name'");
        const hostname = os.hostname();
        let netName = 'Adestio Node';
        if (res && res.length > 0) netName = res[0].key_value;
        return `${netName} (${hostname})`;
    } catch (e) {
        return `Adestio Node (${os.hostname()})`;
    }
}

function startSyncServer() {
    try {
        if (serverInstance) return;

        try {
            require('./diagnostics_api').startDiagnosticsServer(34568);
        } catch(e) {
            console.error('[Diagnostics] failed to start sidecar', e);
        }

        let db = null;
        try { db = require('./db').getDB('config'); } catch(e) {}

        let networkName = 'Adestio Node';
        let storedHash = null;
        if (db) {
            try {
                const resName = db.query("SELECT key_value FROM network_config WHERE key_name = 'network_name'");
                if (resName && resName.length > 0) networkName = resName[0].key_value;
                getNetworkCodeHash().then(h => storedHash = h).catch(e => console.error(e));
            } catch(e) {}
        }

        const app = express();
        app.use(cors({ origin: false }));
        app.use(express.json({ limit: '50mb' }));

        app.use(async (req, res, next) => {
            try {
                const openPaths = ['/sync/auth', '/ping', '/sync/handshake', '/p2p'];
                if (openPaths.includes(req.path)) return next();

                storedHash = await getNetworkCodeHash();

                const clientPinHash = req.headers['x-adestio-network'];
                if (!storedHash || clientPinHash !== storedHash) {
                    return res.status(401).json({ error: 'Unauthorized' });
                }
                next();
            } catch (e) {
                res.status(500).json({ error: 'Internal error' });
            }
        });

        app.post('/sync/auth', async (req, res) => {
            try {
                const { networkCodeHash } = req.body;
                if (!networkCodeHash || typeof networkCodeHash !== 'string' || networkCodeHash.length !== 64) {
                    return res.status(400).json({ error: 'Invalid payload' });
                }
                storedHash = await getNetworkCodeHash();
                if (storedHash && networkCodeHash === storedHash) {
                    return res.json({ success: true });
                }
                return res.status(401).json({ error: 'Invalid Network Code' });
            } catch (e) {
                console.error(e);
                res.status(500).json({ error: 'Internal error' });
            }
        });

        app.get('/ping', async (req, res) => {
            try {
                const { checkIsRegistered } = require('./handlers/auth');
                const isInitialized = await checkIsRegistered();
                res.json({
                    status: 'ok',
                    node: getNetworkName(),
                    protocolVersion: PROTOCOL_VERSION,
                    nodeId: getLocalNodeId(),
                    isInitialized
                });
            } catch (e) {
                res.status(500).json({ error: 'Internal error' });
            }
        });

        app.post('/sync/handshake', async (req, res) => {
            try {
                const { nodeId, protocolVersion, appVersion, dagTips, networkCodeHash } = req.body;

                if (!nodeId || typeof protocolVersion !== 'number') {
                    return res.status(400).json({ error: 'Invalid handshake payload' });
                }

                storedHash = await getNetworkCodeHash();

                if (storedHash && networkCodeHash !== storedHash) {
                    return res.status(401).json({ error: 'Network mismatch' });
                }

                const myNodeId = getLocalNodeId();
                const myTips = [];
                try {
                    const { getCurrentTips } = require('./blockchain');
                    const tipsList = getCurrentTips(getDB('ledger'));
                    myTips.push(...tipsList);
                } catch (_) {}

                if (protocolVersion < MIN_COMPATIBLE_PROTOCOL_VERSION) {
                    return res.json({
                        nodeId: myNodeId,
                        protocolVersion: PROTOCOL_VERSION,
                        dagTips: myTips,
                        compatible: false,
                        reason: 'HARD_FORK',
                        minimumVersion: String(MIN_COMPATIBLE_PROTOCOL_VERSION)
                    });
                }

                try {
                    const db = require('./db').getDB('config');
        db.run(
                        'INSERT OR REPLACE INTO node_registry (node_id, protocol_version, app_version, last_seen) VALUES (?, ?, ?, ?)',
                        [nodeId, protocolVersion, appVersion || '0.0.0', Date.now()]
                    );
                    require('./db').saveDB('config');
                } catch (_) {}

                return res.json({
                    nodeId: myNodeId,
                    protocolVersion: PROTOCOL_VERSION,
                    dagTips: myTips,
                    compatible: true
                });
            } catch (e) {
                console.error('[Sync] /sync/handshake error:', e);
                res.status(500).json({ error: 'Internal error' });
            }
        });

        app.post('/sync/blocks', (req, res) => {
            try {
                const { knownTips } = req.body;
                if (!Array.isArray(knownTips)) {
                    return res.status(400).json({ error: 'Invalid payload: knownTips must be an array' });
                }

                const { getBlocksSince, getCurrentTips } = require('./blockchain');
                const blocks = getBlocksSince(knownTips);
                const newTips = getCurrentTips(require('./db').getDB('ledger'));

                return res.json({ blocks, newTips });
            } catch (e) {
                console.error('[Sync] /sync/blocks error:', e);
                res.status(500).json({ error: 'Internal error' });
            }
        });

        app.post('/sync/blocks/push', (req, res) => {
            try {
                const { blocks } = req.body;
                if (!Array.isArray(blocks)) {
                    return res.status(400).json({ error: 'Invalid payload: blocks must be an array' });
                }
                const { applyBlock, topologicalSort } = require('./blockchain');
                const sorted = topologicalSort(blocks);
                let appliedCount = 0;
                for (const b of sorted) {
                    if (applyBlock(b)) appliedCount++;
                }
                return res.json({ success: true, appliedCount });
            } catch (e) {
                console.error('[Sync] /sync/blocks/push error:', e);
                res.status(500).json({ error: 'Internal error' });
            }
        });

        app.get('/sync/full-resync', (req, res) => {
            try {
                const { getAllBlocks, getCurrentTips } = require('./blockchain');
                const blocks = getAllBlocks();
                const ledgerDb = require('./db').getDB('ledger');
                const tips = getCurrentTips(ledgerDb);
                return res.json({ blocks, tips });
            } catch (e) {
                console.error('[Sync] /sync/full-resync error:', e);
                res.status(500).json({ error: 'Internal error' });
            }
        });

        app.get('/sync/update-info', (req, res) => {
            try {
                const updatesManager = require('./updates_manager');
                const highest = updatesManager.getHighestLocalVersion();
                res.json({ version: highest });
            } catch (e) {
                console.error('[Sync] /sync/update-info error:', e);
                res.status(500).json({ error: 'Internal error' });
            }
        });

        app.get('/sync/update/download/:version', (req, res) => {
            try {
                const updatesManager = require('./updates_manager');
                const version = req.params.version;
                const updatePath = updatesManager.getInstallerPath(version);

                if (updatePath) {
                    return res.download(updatePath, `Adestio-Setup-${version}.exe`);
                } else {
                    return res.status(404).json({ error: 'Update not cached on this node' });
                }
            } catch (e) {
                console.error('[Sync] /sync/update/download error:', e);
                res.status(500).json({ error: 'Internal error' });
            }
        });

        app.post('/sync/pull', async (req, res) => {
            try {
                const { getRowsSince } = require('./db');
                const { tableName, since } = req.body;
                const allowedTables = ['users'];
                if (!allowedTables.includes(tableName)) return res.status(400).json({ error: 'Table not allowed' });
                const rows = await getRowsSince('auth', tableName, parseInt(since || 0));
                res.json({ tableName, rows });
            } catch (err) {
                console.error(err);
                res.status(500).json({ error: err.message });
            }
        });

        app.post('/sync/push', async (req, res) => {
            try {
                const { upsertRows } = require('./db');
                const { tableName, rows } = req.body;
                const allowedTables = ['users'];
                if (!allowedTables.includes(tableName)) return res.status(400).json({ error: 'Table not allowed' });
                if (rows && rows.length > 0) {
                    await upsertRows('auth', tableName, rows);
                }
                res.json({ success: true, updated: true });
            } catch (err) {
                console.error(err);
                res.status(500).json({ error: err.message });
            }
        });

        app.get('/sync/clone', (req, res) => {
            try {
                const localDb = require('./db').getDB('ledger');
                const data = localDb.exportData();
                res.send(Buffer.from(data));
            } catch (err) {
                res.status(500).send('Error exporting DB');
            }
        });

        try { loadPeerCache(); } catch(e) {}

        serverInstance = app.listen(PORT, '0.0.0.0', async () => {
            console.log(`[Sync] Server P2P in ascolto sulla porta ${PORT} (Protocol v${PROTOCOL_VERSION})`);
            
            try {
                const { WebSocketServer } = require('ws');
                const { handleIncomingMessage, registerSocket } = require('./ws_rpc');
                const wsHandlers = require('./ws_handlers');

                const wss = new WebSocketServer({ server: serverInstance, path: '/p2p' });
                wss.on('connection', (ws, req) => {
                    ws.on('message', (msg) => handleIncomingMessage(ws, msg, wsHandlers));
                });
            } catch (err) {
                console.error('[Sync] Errore inizializzazione WebSocketServer:', err);
            }
            try {
                const { checkIsRegistered } = require('./handlers/auth');
                const isInitialized = await checkIsRegistered();
                if (isInitialized) {
                    bonjourInstance = await initBonjour();
                    bonjourInstance.publish({ name: getNetworkName(), type: SERVICE_NAME, port: PORT });
                }
            } catch(e) {
                console.error('Errore avvio Bonjour', e);
            }

            try {
                udpServer = dgram.createSocket({ type: 'udp4', reuseAddr: true });
                udpServer.on('error', (err) => {
                    console.error('[Sync] UDP Server error:', err.message);
                    udpServer = null;
                });
                udpServer.on('message', (msg, rinfo) => {
                    try {
                        const message = msg.toString();
                        if (message.startsWith('DISCOVER_ADESTIO')) {
                            const { checkIsRegistered } = require('./handlers/auth');
                            checkIsRegistered().then(isInitialized => {
                                if (!isInitialized) return;
                                const myNodeId = getLocalNodeId();
                                const reply = Buffer.from(`I_AM_ADESTIO:${getNetworkName()}:${PORT}:${PROTOCOL_VERSION}:${myNodeId}`);
                                udpServer.send(reply, 0, reply.length, rinfo.port, rinfo.address);
                                
                                // Parse discover payload to extract name if provided
                                let senderName = 'Sconosciuto';
                                let senderPort = PORT;
                                let senderPv = 0;
                                let senderNid = null;
                                if (message.includes(':')) {
                                    const p = message.split(':');
                                    senderName = p[1] || 'Sconosciuto';
                                    senderPort = parseInt(p[2]) || PORT;
                                    senderPv = parseInt(p[3]) || 0;
                                    senderNid = p[4] || null;
                                }
                                addNodeToMemory(senderName, rinfo.address, senderPort, 0, senderPv, senderNid);
                            }).catch(() => {});
                        } else if (message.startsWith('I_AM_ADESTIO:')) {
                            const parts = message.split(':');
                            const name = parts[1] || 'Adestio Node';
                            const port = parseInt(parts[2]) || PORT;
                            const pv = parseInt(parts[3]) || 0;
                            const nid = parts[4] || null;
                            addNodeToMemory(name, rinfo.address, port, 0, pv, nid);
                        } else if (message.startsWith('UPDATE_AVAILABLE:')) {
                            const parts = message.split(':');
                            const version = parts[1];
                            if (version) {
                                const { autoUpdater } = require('electron-updater');
                                // Se la rete segnala un aggiornamento, innesca un controllo esplicito.
                                // Il main.js intercetterà l'evento e cercherà in LAN il file.
                                setTimeout(() => {
                                    try { autoUpdater.checkForUpdatesAndNotify(); } catch(e){}
                                }, 2000);
                            }
                        }
                    } catch (e) {
                        console.error('[Sync] UDP message handler error:', e);
                    }
                });
                udpServer.bind(UDP_PORT, () => {
                    console.log(`[Sync] UDP Discovery in ascolto sulla porta ${UDP_PORT}`);
                });
            } catch(e) {
                console.error('[Sync] UDP Server error:', e);
            }

            if (!pruneTimer) {
                let cacheFlushCounter = 0;
                pruneTimer = setInterval(() => {
                    try {
                        const now = Date.now();
                        for (const ip in activePeers) {
                            if (now - activePeers[ip].lastSeen > 180000 && !activePeers[ip]._fromCache) {
                                delete activePeers[ip];
                            }
                        }
                        cacheFlushCounter++;
                        if (cacheFlushCounter >= 10) {
                            cacheFlushCounter = 0;
                            savePeerCache();
                        }
                    } catch (e) {
                        console.error('[Sync] pruneTimer error:', e);
                    }
                }, 30000);
            }

            if (!bgDiscoveryTimer) {
                setTimeout(() => scanForNodes(null).catch(() => {}), 2000);
                bgDiscoveryTimer = setInterval(() => {
                    scanForNodes(null).catch(() => {});
                }, 60000);
            }

            const { startSyncEngine } = require('./sync_engine');
            startSyncEngine();
        });

    } catch (e) {
        if (!e.isExpected) console.error('[Sync] startSyncServer error:', e);
    }
}

function getLocalSubnets() {
    const interfaces = os.networkInterfaces();
    const subnets = [];
    try {
        for (const name of Object.keys(interfaces)) {
            for (const iface of interfaces[name]) {
                if (iface.family === 'IPv4' && !iface.internal) {
                    const parts = iface.address.split('.');
                    parts.pop();
                    subnets.push(parts.join('.'));
                }
            }
        }
    } catch (e) {
        console.error('[Sync] getLocalSubnets error:', e);
    }
    return subnets;
}

function scanForNodes(event = null) {
    return new Promise(async (resolve) => {
        try {
            const nodes = [];
            const seenHosts = new Set();

            const emitProgress = (msg) => {
                if (event && event.sender) {
                    try { event.sender.send('scan-progress', msg); } catch(e){}
                }
            };

            const addNode = (node) => {
                try {
                    if (!seenHosts.has(node.host)) {
                        seenHosts.add(node.host);
                        nodes.push(node);
                        addNodeToMemory(node.name, node.host, node.port, node.pingMs || 0, node.protocolVersion || 0, node.nodeId);
                    } else {
                        if (node.nodeId) {
                            addNodeToMemory(node.name, node.host, node.port, node.pingMs || 0, node.protocolVersion || 0, node.nodeId);
                        }
                    }
                } catch (e) {
                    console.error('[Sync] addNode error:', e);
                }
            };

            emitProgress('Fase 1: Scansione istantanea UDP in corso...');
            await new Promise((resUdp) => {
                try {
                    const client = dgram.createSocket('udp4');
                    client.on('message', (msg, rinfo) => {
                        try {
                            const str = msg.toString();
                            if (str.startsWith('I_AM_ADESTIO:')) {
                                const parts = str.split(':');
                                const name = parts[1] || 'Adestio Node';
                                const port = parseInt(parts[2]) || PORT;
                                const pv = parseInt(parts[3]) || 0;
                                const nid = parts[4] || null;
                                addNode({ name, host: rinfo.address, port, protocolVersion: pv, nodeId: nid });
                            }
                        } catch (e) {
                            console.error('[Sync] UDP message parse error:', e);
                        }
                    });
                    client.bind(() => {
                        try {
                            client.setBroadcast(true);
                            const myNodeId = getLocalNodeId();
                            const msg = Buffer.from(`DISCOVER_ADESTIO:${getNetworkName()}:${PORT}:${PROTOCOL_VERSION}:${myNodeId}`);
                            
                            // Trasmettiamo su tutte le sottoreti attive per evitare che Windows usi solo l'adattatore virtuale
                            const subnets = getLocalSubnets();
                            const broadcastTargets = ['255.255.255.255'];
                            for (const sub of subnets) broadcastTargets.push(`${sub}.255`);
                            
                            for (const target of broadcastTargets) {
                                client.send(msg, 0, msg.length, UDP_PORT, target, (err) => {
                                    if (err && err.code !== 'EACCES') console.error(`[Sync] UDP broadcast error on ${target}:`, err.message);
                                });
                            }
                        } catch (e) {
                            console.error('[Sync] UDP bind callback error:', e);
                        }
                    });
                    setTimeout(() => {
                        try { client.close(); } catch(e){}
                        resUdp();
                    }, 1500);
                } catch(e) { resUdp(); }
            });

            emitProgress('Fase 2: Ricerca mDNS (Bonjour) in corso...');
            await new Promise(async (resMdns) => {
                try {
                    const bonjour = await initBonjour();
                    const browser = bonjour.find({ type: SERVICE_NAME }, (service) => {
                        try {
                            const mySubnets = getLocalSubnets();
                            let bestIp = service.addresses.find(ip => mySubnets.some(sub => ip.startsWith(sub + '.'))) 
                                      || service.addresses.find(ip => ip.includes('.')) 
                                      || service.addresses[0];
                            addNode({
                                name: service.name,
                                host: bestIp,
                                port: service.port,
                                protocolVersion: 0
                            });
                        } catch (e) {}
                    });
                    setTimeout(() => {
                        try { browser.stop(); } catch(e){}
                        resMdns();
                    }, 1500);
                } catch(e) { resMdns(); }
            });

            emitProgress('Fase 3: Scansione HTTP Avanzata di tutte le sottoreti...');
            const subnets = getLocalSubnets();
            const sweepPromises = [];

            for (const subnet of subnets) {
                for (let i = 1; i < 255; i++) {
                    const targetIp = `${subnet}.${i}`;
                    const p = new Promise(async (resSweep) => {
                        try {
                            const controller = new AbortController();
                            const timeoutId = setTimeout(() => controller.abort(), 1500);
                            const startMs = Date.now();
                            const fetchReq = await fetch(`http://${targetIp}:${PORT}/ping`, { signal: controller.signal });
                            const endMs = Date.now();
                            clearTimeout(timeoutId);

                            if (fetchReq.ok) {
                                const data = await fetchReq.json();
                                if (data.status === 'ok' && data.node && data.isInitialized !== false) {
                                    addNode({
                                        name: data.node,
                                        host: targetIp,
                                        port: PORT,
                                        pingMs: endMs - startMs,
                                        protocolVersion: data.protocolVersion || 0,
                                        nodeId: data.nodeId
                                    });
                                }
                            }
                        } catch(e) {}
                        resSweep();
                    });
                    sweepPromises.push(p);
                }
            }
            await Promise.all(sweepPromises);

            resolve(nodes);
        } catch (e) {
            console.error('[Sync] scanForNodes error:', e);
            resolve([]);
        }
    });
}

function getConnectedNodesCount() {
    try {
        return activePeers ? Object.keys(activePeers).length : 0;
    } catch (e) {
        return 0;
    }
}

function getDetailedNodes() {
    try {
        const list = [];
        for (const [ip, data] of Object.entries(activePeers)) {
            if (ip === '127.0.0.1') continue;
            
            const isOffline = (Date.now() - (data.lastSeen || 0)) > 45000;
            
            list.push({
                ip,
                name: data.name || 'Adestio Node',
                lastSeen: data.lastSeen || Date.now(),
                status: isOffline ? 'Offline' : 'Online',
                pingMs: data.pingMs || 0,
                protocolVersion: data.protocolVersion || 0,
                port: data.port || PORT,
                nodeId: data.nodeId || 'Sconosciuto'
            });
        }
        
        // Aggiungi sempre il nodo locale in cima
        list.unshift({
            ip: '127.0.0.1',
            name: 'Nodo Locale (Questo PC)',
            lastSeen: Date.now(),
            status: 'Locale',
            pingMs: 0,
            protocolVersion: PROTOCOL_VERSION,
            port: PORT,
            nodeId: getLocalNodeId()
        });
        return list;
    } catch (e) {
        console.error('[Sync] getDetailedNodes error:', e);
        return [];
    }
}

function getPexNodes() {
    try {
        const list = [];
        for (const [ip, data] of Object.entries(activePeers)) {
            if (ip === '127.0.0.1') continue;
            const isOffline = (Date.now() - (data.lastSeen || 0)) > 45000;
            if (isOffline) continue; // Don't gossip offline nodes
            list.push({
                ip,
                name: data.name,
                port: data.port || PORT,
                nodeId: data.nodeId,
                protocolVersion: data.protocolVersion
            });
        }
        return list;
    } catch (e) {
        return [];
    }
}

function markPeerIncompatible(ip) {
    try {
        incompatiblePeers.add(ip);
        delete activePeers[ip];
    } catch (e) {
        console.error('[Sync] markPeerIncompatible error:', e);
    }
}

module.exports = {
    startSyncServer,
    scanForNodes,
    getUUID,
    getConnectedNodesCount,
    getDetailedNodes,
    getPexNodes,
    markPeerIncompatible,
    PROTOCOL_VERSION,
    MIN_COMPATIBLE_PROTOCOL_VERSION,
    PORT,
    addNodeToMemory,
    savePeerCache,
    loadPeerCache,
    broadcastUpdateAvailable,
    getLocalNodeId,
    getNetworkName
};
