const crypto = require('crypto');
const dbManager = require('./db/db_manager');

function hashNetworkCode(code) {
    try {
        return crypto.createHash('sha256').update(code.replace(/-/g, '').toUpperCase()).digest('hex');
    } catch (e) {
        return '';
    }
}

function generateNetworkCode() {
    try {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < 9; i++) code += chars.charAt(crypto.randomInt(0, chars.length));
        return `${code.slice(0,3)}-${code.slice(3,6)}-${code.slice(6)}`;
    } catch (e) {
        return '';
    }
}

function checkIsRegistered() {
    try {
        return dbManager.isRegistered();
    } catch (e) {
        return false;
    }
}

async function unlockDB() {
    try {
        return await dbManager.unlock();
    } catch (e) {
        return false;
    }
}

async function autoUnlockDB() {
    try {
        if (checkIsRegistered()) {
            return await unlockDB();
        }
        return false;
    } catch (e) {
        return false;
    }
}

async function initEmptyDB(networkName) {
    try {
        dbManager.deviceKey = dbManager.loadOrGenerateLocalDeviceKey();
        if (!dbManager.deviceKey) throw new Error('DPAPI error');

        const mAuth = require('./migrations/auth');
        const mConfig = require('./migrations/config');
        const mLedger = require('./migrations/ledger');
        const mApp = require('./migrations/app_data');

        await dbManager.loadDatabase('auth', mAuth);
        await dbManager.loadDatabase('config', mConfig);
        await dbManager.loadDatabase('ledger', mLedger);
        await dbManager.loadDatabase('app', mApp);

        const networkCode = generateNetworkCode();
        const hashedCode = hashNetworkCode(networkCode);
        const nodeId = crypto.randomBytes(16).toString('hex');

        const configDb = dbManager.getDB('config');
        await configDb.execute("INSERT OR REPLACE INTO network_config (key_name, key_value) VALUES (?, ?)", ['network_name', networkName]);
        await configDb.execute("INSERT OR REPLACE INTO network_config (key_name, key_value) VALUES (?, ?)", ['network_code_hash', hashedCode]);
        await configDb.execute("INSERT OR REPLACE INTO network_config (key_name, key_value) VALUES (?, ?)", ['network_code', networkCode]);
        await configDb.execute("INSERT OR REPLACE INTO network_config (key_name, key_value) VALUES (?, ?)", ['node_id', nodeId]);

        await dbManager.saveAll();
        return networkCode;
    } catch (e) {
        throw e;
    }
}

function getDB(domain = 'auth') {
    try {
        return dbManager.getDB(domain);
    } catch (e) {
        throw e;
    }
}

async function saveDB(domain = null) {
    try {
        if (domain) {
            await dbManager.saveDatabase(domain);
        } else {
            await dbManager.saveAll();
        }
        return true;
    } catch (e) {
        return false;
    }
}

async function forceResetDB() {
    try {
        return await dbManager.reset();
    } catch (e) {
        return false;
    }
}

async function verifyNetworkCodeLocally(code) {
    try {
        const configDb = dbManager.getDB('config');
        const res = await configDb.query("SELECT key_value FROM network_config WHERE key_name = 'network_code_hash'");
        if (res && res.length > 0) {
            return hashNetworkCode(code) === res[0].key_value;
        }
        return false;
    } catch(e) {
        return false;
    }
}

async function importClonedDB(buffer, networkCode) {
    try {
        dbManager.deviceKey = dbManager.loadOrGenerateLocalDeviceKey();
        if (!dbManager.deviceKey) return false;

        const mAuth = require('./migrations/auth');
        const mConfig = require('./migrations/config');
        const mLedger = require('./migrations/ledger');
        const mApp = require('./migrations/app_data');

        await dbManager.loadDatabase('auth', mAuth);
        await dbManager.loadDatabase('config', mConfig);
        await dbManager.loadDatabase('app', mApp);

        const SqlJsAdapter = require('./db/SqlJsAdapter');
        const ledgerAdapter = new SqlJsAdapter();
        await ledgerAdapter.connect({ buffer });
        await ledgerAdapter.runMigrations(mLedger);
        dbManager.databases['ledger'] = ledgerAdapter;

        const hashedCode = hashNetworkCode(networkCode);
        const nodeId = crypto.randomBytes(16).toString('hex');

        const configDb = dbManager.getDB('config');
        await configDb.execute("INSERT OR REPLACE INTO network_config (key_name, key_value) VALUES (?, ?)", ['network_code_hash', hashedCode]);
        await configDb.execute("INSERT OR REPLACE INTO network_config (key_name, key_value) VALUES (?, ?)", ['network_code', networkCode]);
        await configDb.execute("INSERT OR REPLACE INTO network_config (key_name, key_value) VALUES (?, ?)", ['node_id', nodeId]);

        await dbManager.saveAll();

        const { rebuildStateFromLog } = require('./blockchain');
        rebuildStateFromLog();

        return true;
    } catch(e) {
        return false;
    }
}

async function getNodeId() {
    try {
        const configDb = dbManager.getDB('config');
        const res = await configDb.query("SELECT key_value FROM network_config WHERE key_name = 'node_id'");
        if (res && res.length > 0) return res[0].key_value;
        return null;
    } catch (e) {
        return null;
    }
}

async function getNetworkCodeHash() {
    try {
        const configDb = dbManager.getDB('config');
        const res = await configDb.query("SELECT key_value FROM network_config WHERE key_name = 'network_code_hash'");
        if (res && res.length > 0) return res[0].key_value;
        return null;
    } catch (e) {
        return null;
    }
}

async function getRowsSince(domain, tableName, timestamp) {
    try {
        const db = dbManager.getDB(domain);
        return await db.query(`SELECT * FROM ${tableName} WHERE last_modified > ?`, [timestamp]);
    } catch(e) {
        return [];
    }
}

async function upsertRows(domain, tableName, rows) {
    try {
        if (!rows || rows.length === 0) return;
        const db = dbManager.getDB(domain);
        await db.execute('BEGIN TRANSACTION;');
        let changesMade = false;

        for (const row of rows) {
            try {
                const id = row.id;
                const res = await db.query(`SELECT last_modified FROM ${tableName} WHERE id = ?`, [id]);
                let shouldInsert = false;
                let shouldUpdate = false;

                if (res.length > 0) {
                    if (row.last_modified > res[0].last_modified) shouldUpdate = true;
                } else {
                    shouldInsert = true;
                }

                if (shouldInsert || shouldUpdate) {
                    const columns = Object.keys(row);
                    const values = Object.values(row);
                    const placeholders = columns.map(() => '?').join(', ');

                    if (shouldInsert) {
                        await db.execute(`INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`, values);
                    } else {
                        const setClause = columns.map(c => `${c} = ?`).join(', ');
                        await db.execute(`UPDATE ${tableName} SET ${setClause} WHERE id = ?`, [...values, id]);
                    }
                    changesMade = true;
                }
            } catch (err) {}
        }
        await db.execute('COMMIT;');
        if (changesMade) await dbManager.saveDatabase(domain);
    } catch(e) {
        try { const db = dbManager.getDB(domain); await db.execute('ROLLBACK;'); } catch(_) {}
    }
}

function notifyDataChanged(tableName, modifiedRows) {
    try {
        const { triggerLegacyPush } = require('./sync_engine');
        if (typeof triggerLegacyPush === 'function') triggerLegacyPush(tableName, modifiedRows);
    } catch(e) {}
}

function wrapMutationWithEvent(eventType, tableName, recordId, payload) {
    try {
        const { createBlock } = require('./blockchain');
        const block = createBlock(eventType, tableName, String(recordId), payload);
        if (!block) return;
        try {
            const { triggerEventDrivenPush } = require('./sync_engine');
            triggerEventDrivenPush(block);
        } catch (_) {}
    } catch (e) {}
}

module.exports = {
    checkIsRegistered,
    initEmptyDB,
    unlockDB,
    getDB,
    saveDB,
    autoUnlockDB,
    hashNetworkCode,
    forceResetDB,
    verifyNetworkCodeLocally,
    importClonedDB,
    getRowsSince,
    upsertRows,
    notifyDataChanged,
    wrapMutationWithEvent,
    getNodeId,
    getNetworkCodeHash
};
