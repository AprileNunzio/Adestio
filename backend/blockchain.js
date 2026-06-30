const { adaptPayload, validatePayloadSchema, computeBlockId, CURRENT_PAYLOAD_VERSION, SYNC_TABLES } = require('./payload_adapters');

function getLedgerDB() {
    return require('./db').getDB('ledger');
}

function getAuthDB() {
    return require('./db').getDB('auth');
}

function saveDB() {
    return require('./db').saveDB();
}

function normalizePayload(p) {
    try {
        let res = p;
        if (typeof res === 'string') {
            try { res = JSON.parse(res); } catch (_) {}
            if (typeof res === 'string') {
                try { res = JSON.parse(res); } catch (_) {}
            }
        }
        return res;
    } catch (_) {
        return p;
    }
}

function getCurrentTips(db) {
    try {
        const res = db.query('SELECT block_id FROM dag_tips');
        if (!res || res.length === 0) return ['GENESIS'];
        return res.map(r => r.block_id);
    } catch (e) {
        return ['GENESIS'];
    }
}

function updateTips(db, parentIds, newBlockId) {
    try {
        for (const pid of parentIds) {
            db.run('DELETE FROM dag_tips WHERE block_id = ?', [pid]);
        }
        db.run('INSERT OR REPLACE INTO dag_tips (block_id) VALUES (?)', [newBlockId]);
    } catch (e) {
        throw e;
    }
}

function getNodeId() {
    try {
        const db = require('./db').getDB('config');
        const res = db.query("SELECT key_value FROM network_config WHERE key_name = 'node_id'");
        if (res && res.length > 0) {
            return res[0].key_value;
        }
        const { v4: uuidv4 } = require('uuid');
        const newId = uuidv4 ? uuidv4() : require('crypto').randomBytes(16).toString('hex');
        db.run("INSERT OR REPLACE INTO network_config (key_name, key_value) VALUES (?, ?)", ['node_id', newId]);
        require('./db').saveDB('config');
        return newId;
    } catch (e) {
        return require('crypto').randomBytes(16).toString('hex');
    }
}

function createBlock(eventType, tableName, recordId, payload) {
    try {
        const normPayload = normalizePayload(payload);
        if (!validatePayloadSchema(tableName, eventType, normPayload)) {
            try {
                const { logSyncAnomaly } = require('./logger');
                logSyncAnomaly('CREATE_BLOCK_INVALID_SCHEMA', `Schema non valido per la tabella ${tableName}`, normPayload);
            } catch(e) {}
            return null;
        }

        const db = getLedgerDB();
        const nodeId = getNodeId();
        const createdAt = Date.now();
        const parentIds = getCurrentTips(db);
        const blockId = computeBlockId(parentIds, nodeId, createdAt, eventType, tableName, recordId, normPayload, CURRENT_PAYLOAD_VERSION);

        const existingCheck = db.query(`SELECT block_id FROM event_log WHERE block_id = ?`, [blockId]);
        if (existingCheck && existingCheck.length > 0) {
            return null;
        }

        db.run(
            'INSERT INTO event_log (block_id, parent_ids, event_type, table_name, record_id, payload, node_id, created_at, payload_version, is_applied) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)',
            [
                blockId,
                JSON.stringify(parentIds),
                eventType,
                tableName,
                String(recordId),
                JSON.stringify(normPayload),
                nodeId,
                createdAt,
                CURRENT_PAYLOAD_VERSION
            ]
        );

        updateTips(db, parentIds, blockId);
        require('./db').saveDB('ledger');

        return {
            block_id: blockId,
            parent_ids: parentIds,
            event_type: eventType,
            table_name: tableName,
            record_id: String(recordId),
            payload: normPayload,
            node_id: nodeId,
            created_at: createdAt,
            payload_version: CURRENT_PAYLOAD_VERSION
        };
    } catch (e) {
        return null;
    }
}

function validateBlockIntegrity(block) {
    try {
        const normPayload = normalizePayload(block.payload);
        const expectedId = computeBlockId(
            block.parent_ids,
            block.node_id,
            block.created_at,
            block.event_type,
            block.table_name,
            block.record_id,
            normPayload,
            block.payload_version
        );
        return expectedId === block.block_id;
    } catch (e) {
        return false;
    }
}

function applyEventToLocalDB(db, eventType, tableName, recordId, adaptedPayload, createdAt) {
    try {
        if (!SYNC_TABLES.includes(tableName)) return false;

        if (eventType === 'DELETE') {
            const existingRes = db.query(`SELECT last_modified FROM ${tableName} WHERE id = ?`, [recordId]);
            if (!existingRes || existingRes.length === 0) return true;
            const localTs = existingRes[0].last_modified;
            if (createdAt > localTs) {
                db.run(`DELETE FROM ${tableName} WHERE id = ?`, [recordId]);
            }
            return true;
        }

        if (eventType === 'INSERT') {
            const existingRes = db.query(`SELECT id, last_modified FROM ${tableName} WHERE id = ?`, [recordId]);
            if (!adaptedPayload) adaptedPayload = {};
            if (!adaptedPayload.id) adaptedPayload.id = recordId;

            const tableInfo = db.query(`PRAGMA table_info(${tableName})`);
            const validColumns = tableInfo ? tableInfo.map(c => c.name) : [];
            if (validColumns.length > 0) {
                const filtered = {};
                for (const key of Object.keys(adaptedPayload)) {
                    if (validColumns.includes(key)) filtered[key] = adaptedPayload[key];
                }
                adaptedPayload = filtered;
            }

            if (existingRes && existingRes.length > 0) {
                const localTs = existingRes[0].last_modified;
                if (createdAt <= localTs) return true;
                const columns = Object.keys(adaptedPayload);
                const setClause = columns.map(c => `${c} = ?`).join(', ');
                db.run(`UPDATE ${tableName} SET ${setClause} WHERE id = ?`, [...Object.values(adaptedPayload), recordId]);
                return true;
            }
            const columns = Object.keys(adaptedPayload);
            const placeholders = columns.map(() => '?').join(', ');
            db.run(`INSERT OR IGNORE INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`, Object.values(adaptedPayload));
            return true;
        }

        if (eventType === 'UPDATE') {
            const existingRes = db.query(`SELECT last_modified FROM ${tableName} WHERE id = ?`, [recordId]);
            if (!adaptedPayload) adaptedPayload = {};
            if (!adaptedPayload.id) adaptedPayload.id = recordId;

            const tableInfo = db.query(`PRAGMA table_info(${tableName})`);
            const validColumns = tableInfo ? tableInfo.map(c => c.name) : [];
            if (validColumns.length > 0) {
                const filtered = {};
                for (const key of Object.keys(adaptedPayload)) {
                    if (validColumns.includes(key)) filtered[key] = adaptedPayload[key];
                }
                adaptedPayload = filtered;
            }

            if (!existingRes || existingRes.length === 0) {
                const columns = Object.keys(adaptedPayload);
                const placeholders = columns.map(() => '?').join(', ');
                db.run(`INSERT OR IGNORE INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`, Object.values(adaptedPayload));
                return true;
            }
            const localTs = existingRes[0].last_modified;
            if (createdAt <= localTs) return true;
            const columns = Object.keys(adaptedPayload);
            const setClause = columns.map(c => `${c} = ?`).join(', ');
            db.run(`UPDATE ${tableName} SET ${setClause} WHERE id = ?`, [...Object.values(adaptedPayload), recordId]);
            return true;
        }

        return false;
    } catch (e) {
        return false;
    }
}

function applyBlock(block) {
    try {
        if (!block || !block.block_id || !block.parent_ids || !block.event_type || !block.table_name || !block.record_id) {
            return false;
        }

        const normPayload = normalizePayload(block.payload);

        if (!validatePayloadSchema(block.table_name, block.event_type, normPayload)) {
            try {
                const { logSyncAnomaly } = require('./logger');
                logSyncAnomaly('APPLY_BLOCK_INVALID_SCHEMA', `Ricevuto blocco con schema non valido per la tabella ${block.table_name} dal nodo ${block.node_id}`, normPayload);
                const { BrowserWindow } = require('electron');
                const wins = BrowserWindow.getAllWindows();
                if (wins.length > 0) {
                    wins.forEach(w => {
                        if (!w.isDestroyed()) {
                            w.webContents.send('sync-anomaly', { message: `Anomalia nei dati ricevuti (Tabella: ${block.table_name})` });
                        }
                    });
                }
            } catch(e) {}
            return false;
        }

        if (!validateBlockIntegrity(block)) {
            return false;
        }

        if (!SYNC_TABLES.includes(block.table_name)) {
            return false;
        }

        const db = getLedgerDB();
        const authDb = getAuthDB();
        const configDb = require('./db').getDB('config');

        const existingRes = db.query(`SELECT is_applied FROM event_log WHERE block_id = ?`, [block.block_id]);
        if (existingRes && existingRes.length > 0) {
            return true;
        }

        const adaptedPayload = adaptPayload(block.table_name, block.payload_version || 1, normPayload);

        db.execute('BEGIN TRANSACTION;');
        authDb.execute('BEGIN TRANSACTION;');
        configDb.execute('BEGIN TRANSACTION;');
        try {
            db.run(
                'INSERT OR IGNORE INTO event_log (block_id, parent_ids, event_type, table_name, record_id, payload, node_id, created_at, payload_version, is_applied) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)',
                [
                    block.block_id,
                    JSON.stringify(block.parent_ids),
                    block.event_type,
                    block.table_name,
                    String(block.record_id),
                    JSON.stringify(normPayload),
                    block.node_id,
                    block.created_at,
                    block.payload_version || 1
                ]
            );

            const applied = applyEventToLocalDB(authDb, block.event_type, block.table_name, block.record_id, adaptedPayload, block.created_at);
            if (applied) {
                db.run(`UPDATE event_log SET is_applied = 1 WHERE block_id = ?`, [block.block_id]);
                try {
                    const { BrowserWindow } = require('electron');
                    const wins = BrowserWindow.getAllWindows();
                    if (wins.length > 0) {
                        wins.forEach(w => {
                            if (!w.isDestroyed()) {
                                if (block.table_name === 'users') {
                                    w.webContents.send('user-kicked', { userId: block.record_id });
                                }
                                w.webContents.send('sync-updated', { table: block.table_name });
                            }
                        });
                    }
                } catch(e) {}
            }

            const parentIds = Array.isArray(block.parent_ids) ? block.parent_ids : JSON.parse(block.parent_ids);
            updateTips(db, parentIds, block.block_id);

            try {
                const nodeId = block.node_id;
                configDb.run(
                    'INSERT OR REPLACE INTO node_registry (node_id, protocol_version, app_version, last_seen) VALUES (?, ?, ?, ?)',
                    [nodeId, block.payload_version || 1, '0.0.0', Date.now()]
                );
            } catch (_) {}

            db.execute('COMMIT;');
            authDb.execute('COMMIT;');
            configDb.execute('COMMIT;');
        } catch (innerE) {
            try { db.execute('ROLLBACK;'); } catch(_) {}
            try { authDb.execute('ROLLBACK;'); } catch(_) {}
            try { configDb.execute('ROLLBACK;'); } catch(_) {}
            throw innerE;
        }

        require('./db').saveDB('ledger');
        require('./db').saveDB('auth');
        require('./db').saveDB('config');
        return true;
    } catch (e) {
        return false;
    }
}

function getBlocksSince(knownBlockIds) {
    try {
        const db = getLedgerDB();

        if (!knownBlockIds || knownBlockIds.length === 0) {
            const res = db.query('SELECT block_id, parent_ids, event_type, table_name, record_id, payload, node_id, created_at, payload_version FROM event_log ORDER BY created_at ASC');
            if (!res || res.length === 0) return [];
            return res.map(row => ({
                block_id: row.block_id,
                parent_ids: JSON.parse(row.parent_ids),
                event_type: row.event_type,
                table_name: row.table_name,
                record_id: row.record_id,
                payload: normalizePayload(JSON.parse(row.payload)),
                node_id: row.node_id,
                created_at: row.created_at,
                payload_version: row.payload_version
            }));
        }

        // Recuperiamo tutti i blocchi per la topologia
        const allRes = db.query('SELECT block_id, parent_ids FROM event_log');
        if (!allRes || allRes.length === 0) return [];

        const parentMap = new Map();
        const allBlocks = new Set();
        for (const row of allRes) {
            parentMap.set(row.block_id, JSON.parse(row.parent_ids));
            allBlocks.add(row.block_id);
        }

        // DFS per trovare tutti gli antenati dei knownTips
        const knownByPeer = new Set();
        const stack = [...knownBlockIds];
        while (stack.length > 0) {
            const current = stack.pop();
            if (knownByPeer.has(current)) continue;
            if (current !== 'GENESIS') knownByPeer.add(current);
            
            const parents = parentMap.get(current);
            if (parents) {
                for (const pid of parents) {
                    if (!knownByPeer.has(pid)) stack.push(pid);
                }
            }
        }

        // Tutti i blocchi non conosciuti dal peer
        const toSend = [];
        for (const bid of allBlocks) {
            if (!knownByPeer.has(bid)) toSend.push(bid);
        }

        if (toSend.length === 0) return [];

        // Recuperiamo solo i blocchi necessari, divisi in chunk per evitare limiti di SQLite (max 999 variabili)
        const result = [];
        const chunkSize = 900;
        for (let i = 0; i < toSend.length; i += chunkSize) {
            const chunk = toSend.slice(i, i + chunkSize);
            const placeholders = chunk.map(() => '?').join(',');
            const res = db.query(`SELECT block_id, parent_ids, event_type, table_name, record_id, payload, node_id, created_at, payload_version FROM event_log WHERE block_id IN (${placeholders}) ORDER BY created_at ASC`, chunk);
            if (res) {
                for (const row of res) {
                    result.push({
                        block_id: row.block_id,
                        parent_ids: JSON.parse(row.parent_ids),
                        event_type: row.event_type,
                        table_name: row.table_name,
                        record_id: row.record_id,
                        payload: normalizePayload(JSON.parse(row.payload)),
                        node_id: row.node_id,
                        created_at: row.created_at,
                        payload_version: row.payload_version
                    });
                }
            }
        }
        
        result.sort((a, b) => a.created_at - b.created_at);
        return result;
    } catch (e) {
        console.error('[Blockchain] getBlocksSince error:', e);
        return [];
    }
}

function getAllBlocks() {
    try {
        const db = getLedgerDB();
        const res = db.query('SELECT block_id, parent_ids, event_type, table_name, record_id, payload, node_id, created_at, payload_version FROM event_log ORDER BY created_at ASC');
        if (!res || res.length === 0) return [];
        return res.map(row => ({
            block_id: row.block_id,
            parent_ids: JSON.parse(row.parent_ids),
            event_type: row.event_type,
            table_name: row.table_name,
            record_id: row.record_id,
            payload: normalizePayload(JSON.parse(row.payload)),
            node_id: row.node_id,
            created_at: row.created_at,
            payload_version: row.payload_version
        }));
    } catch (e) {
        return [];
    }
}

function topologicalSort(blocks) {
    try {
        const blockMap = new Map();
        for (const b of blocks) {
            blockMap.set(b.block_id, b);
        }

        const inDegree = new Map();
        const children = new Map();

        for (const b of blocks) {
            if (!inDegree.has(b.block_id)) inDegree.set(b.block_id, 0);
            if (!children.has(b.block_id)) children.set(b.block_id, []);
            const parentIds = Array.isArray(b.parent_ids) ? b.parent_ids : JSON.parse(b.parent_ids);
            for (const pid of parentIds) {
                if (pid === 'GENESIS') continue;
                if (!blockMap.has(pid)) continue;
                inDegree.set(b.block_id, (inDegree.get(b.block_id) || 0) + 1);
                if (!children.has(pid)) children.set(pid, []);
                children.get(pid).push(b.block_id);
            }
        }

        const queue = [];
        for (const [id, deg] of inDegree.entries()) {
            if (deg === 0) queue.push(id);
        }

        queue.sort((a, b) => {
            const ba = blockMap.get(a);
            const bb = blockMap.get(b);
            if (!ba || !bb) return 0;
            return ba.created_at - bb.created_at;
        });

        const sorted = [];
        while (queue.length > 0) {
            const current = queue.shift();
            const block = blockMap.get(current);
            if (block) sorted.push(block);

            const childList = children.get(current) || [];
            childList.sort((a, b) => {
                const ba = blockMap.get(a);
                const bb = blockMap.get(b);
                if (!ba || !bb) return 0;
                return ba.created_at - bb.created_at;
            });
            for (const child of childList) {
                inDegree.set(child, (inDegree.get(child) || 1) - 1);
                if (inDegree.get(child) === 0) {
                    queue.push(child);
                    queue.sort((a, b) => {
                        const ba = blockMap.get(a);
                        const bb = blockMap.get(b);
                        if (!ba || !bb) return 0;
                        return ba.created_at - bb.created_at;
                    });
                }
            }
        }

        return sorted;
    } catch (e) {
        return blocks;
    }
}

function rebuildStateFromLog() {
    try {
        const db = getLedgerDB();
        const authDb = getAuthDB();

        for (const table of SYNC_TABLES) {
            try {
                authDb.run(`UPDATE ${table} SET is_deleted = 1`);
            } catch (_) {}
        }

        db.run('UPDATE event_log SET is_applied = 0');

        const blocks = getAllBlocks();
        const sorted = topologicalSort(blocks);

        db.execute('BEGIN TRANSACTION;');
        authDb.execute('BEGIN TRANSACTION;');
        try {
            for (const block of sorted) {
                const adaptedPayload = adaptPayload(block.table_name, block.payload_version || 1, normalizePayload(block.payload));
                const applied = applyEventToLocalDB(authDb, block.event_type, block.table_name, block.record_id, adaptedPayload, block.created_at);
                if (applied) {
                    db.run(`UPDATE event_log SET is_applied = 1 WHERE block_id = ?`, [block.block_id]);
                }
            }
            db.execute('COMMIT;');
            authDb.execute('COMMIT;');
        } catch (innerE) {
            try { db.execute('ROLLBACK;'); } catch(_) {}
            try { authDb.execute('ROLLBACK;'); } catch(_) {}
            throw innerE;
        }

        require('./db').saveDB('ledger');
        require('./db').saveDB('auth');
        return true;
    } catch (e) {
        return false;
    }
}

function getNodeIdByIp(ip) {
    try {
        const { getDetailedNodes } = require('./sync');
        const node = getDetailedNodes().find(n => n.ip === ip);
        return node ? node.nodeId : null;
    } catch(e) { return null; }
}

async function fullChainResync(peerIp, peerPort, networkCodeHash) {
    try {
        const { connectToPeer, sendWsRequest } = require('./ws_rpc');
        const ws = await connectToPeer(peerIp, peerPort, getNodeIdByIp(peerIp));

        const data = await sendWsRequest(ws, 'full_resync', {}, 30000);

        if (!data || !Array.isArray(data.blocks)) {
            console.error(`[Blockchain] fullChainResync failed: invalid response data from ${peerIp}`);
            return false;
        }

        let appliedCount = 0;
        const sorted = topologicalSort(data.blocks);
        for (const block of sorted) {
            const success = applyBlock(block);
            if (success) appliedCount++;
        }

        return true;
    } catch (e) {
        console.error(`[Blockchain] fullChainResync exception for ${peerIp}:`, e);
        return false;
    }
}

function applyPendingBlocks() {
    try {
        const db = getLedgerDB();
        const authDb = getAuthDB();
        const res = db.query('SELECT block_id, parent_ids, event_type, table_name, record_id, payload, node_id, created_at, payload_version FROM event_log WHERE is_applied = 0 ORDER BY created_at ASC');
        if (!res || res.length === 0) return 0;
        
        let appliedCount = 0;
        for (const row of res) {
            const adaptedPayload = adaptPayload(row.table_name, row.payload_version || 1, normalizePayload(JSON.parse(row.payload)));
            const applied = applyEventToLocalDB(authDb, row.event_type, row.table_name, row.record_id, adaptedPayload, row.created_at);
            if (applied) {
                db.run(`UPDATE event_log SET is_applied = 1 WHERE block_id = ?`, [row.block_id]);
                appliedCount++;
            }
        }
        
        if (appliedCount > 0) {
            require('./db').saveDB('ledger');
            require('./db').saveDB('auth');
        }
        return appliedCount;
    } catch (e) {
        return 0;
    }
}

module.exports = {
    createBlock,
    applyBlock,
    getBlocksSince,
    getAllBlocks,
    rebuildStateFromLog,
    applyPendingBlocks,
    fullChainResync,
    getNodeId,
    getCurrentTips,
    topologicalSort,
    SYNC_TABLES
};
