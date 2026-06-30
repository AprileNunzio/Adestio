const { checkIsRegistered: dbCheck, initEmptyDB, unlockDB, getDB, saveDB, importClonedDB, hashNetworkCode, wrapMutationWithEvent } = require('../db');
const { startSyncServer, scanForNodes, getUUID } = require('../sync');
const crypto = require('crypto');

function hashData(data) {
    try {
        return crypto.createHash('sha256').update(data).digest('hex');
    } catch (e) {
        console.error(e);
        throw e;
    }
}

async function checkIsRegistered() {
    try {
        return dbCheck();
    } catch (e) {
        console.error(e);
        return false;
    }
}

async function unlockDatabase(event) {
    try {
        return await unlockDB();
    } catch (e) {
        console.error(e);
        return false;
    }
}

async function getUsersList() {
    try {
        const db = getDB();
        const res = db.exec("SELECT id, username, email, is_superadmin, last_login, nome, cognome FROM users WHERE is_deleted = 0");
        if (res.length === 0) return { users: [] };
        const users = res[0].values.map(row => ({
            id: row[0],
            username: row[1],
            email: row[2],
            is_superadmin: row[3] || 0,
            last_login: row[4] || 0,
            nome: row[5] || '',
            cognome: row[6] || ''
        }));
        return { users };
    } catch (e) {
        if (e.message === 'DB_NOT_INITIALIZED') {
            const { checkIsRegistered } = require('../db');
            const registered = checkIsRegistered();
            if (!registered) {
                return { users: [], virgin: true };
            }
            return { needsUnlock: true };
        }
        console.error(e);
        return { users: [], error: e.message };
    }
}

async function loginUser(event, data) {
    try {
        const { id, pin, password } = data;
        const db = getDB();

        let query, param;
        if (password) {
            query = "SELECT id, must_change_password FROM users WHERE id = ? AND password = ?";
            param = hashData(password);
        } else {
            query = "SELECT id, must_change_password FROM users WHERE id = ? AND pin = ?";
            param = hashData(pin);
        }

        const stmt = db.prepare(query);
        stmt.bind([id, param]);
        const success = stmt.step();

        let mustChange = false;
        if (success) {
            try {
                const row = stmt.getAsObject();
                if (row.must_change_password === 1) {
                    mustChange = true;
                }
            } catch(e) {}
        }

        stmt.free();

        if (success) {
            try {
                db.run('UPDATE users SET last_login = ? WHERE id = ?', [Date.now(), id]);
                const { saveDB } = require('../db');
                saveDB();
            } catch(e) { console.error("Error updating last_login", e); }
            return { success: true, must_change_password: mustChange };
        }
        return { success: false };
    } catch (e) {
        console.error(e);
        return { success: false, error: e.message };
    }
}

async function registerUser(event, data) {
    try {
        const { nome, cognome, email, pin, password, networkName } = data;
        const username = `${cognome} ${nome}`.trim();

        const networkCode = await initEmptyDB(networkName);
        if (!networkCode) return { success: false };

        const db = getDB();
        const hashedPw = hashData(password);
        const hashedPin = hashData(pin);
        const newId = await getUUID();
        const ts = Math.floor(Date.now() / 1000);

        db.run(
            "INSERT INTO users (id, username, email, password, passkey, pin, last_modified, is_deleted, is_superadmin, nome, cognome) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [newId, username, email, hashedPw, '', hashedPin, ts, 0, 1, nome || '', cognome || '']
        );
        saveDB();

        const payload = {
            id: newId,
            username,
            email,
            password: hashedPw,
            passkey: '',
            pin: hashedPin,
            last_modified: ts,
            is_deleted: 0,
            is_superadmin: 1,
            nome: nome || '',
            cognome: cognome || ''
        };
        wrapMutationWithEvent('INSERT', 'users', newId, payload);
        startSyncServer();
        return { success: true, networkCode, id: newId };
    } catch (e) {
        console.error(e);
        return { success: false };
    }
}

async function handleScanNodes(event) {
    try {
        return await scanForNodes(event);
    } catch (e) {
        console.error(e);
        return [];
    }
}

async function handleCloneNetwork(event, data) {
    try {
        const { host, port, networkCode } = data;
        const http = require('http');
        const hashedCode = hashNetworkCode(networkCode);

        return new Promise((resolve) => {
            try {
                const req = http.get(`http://${host}:${port}/sync/clone`, {
                    headers: { 'x-adestio-network': hashedCode }
                }, (res) => {
                    try {
                        if (res.statusCode !== 200) {
                            return resolve(false);
                        }

                        const dataChunks = [];
                        res.on('data', (chunk) => dataChunks.push(chunk));
                        res.on('end', async () => {
                            try {
                                const buffer = Buffer.concat(dataChunks);
                                const success = await importClonedDB(buffer, networkCode);
                                if (success) {
                                    startSyncServer();
                                }
                                resolve(success);
                            } catch (err) {
                                console.error(err);
                                resolve(false);
                            }
                        });
                    } catch (e) {
                        console.error(e);
                        resolve(false);
                    }
                });
                req.on('error', () => resolve(false));
            } catch (e) {
                console.error(e);
                resolve(false);
            }
        });
    } catch (e) {
        console.error(e);
        return false;
    }
}

async function checkNetworkProfile() {
    try {
        if (process.platform !== 'win32') return 'Private';
        const { exec } = require('child_process');
        return new Promise((resolve) => {
            try {
                exec('powershell -Command "Get-NetConnectionProfile | Select-Object -ExpandProperty NetworkCategory"', (error, stdout) => {
                    try {
                        if (error) {
                            console.error(error);
                            return resolve('Unknown');
                        }
                        if (stdout.includes('Public')) {
                            return resolve('Public');
                        }
                        resolve('Private');
                    } catch (e) {
                        console.error(e);
                        resolve('Unknown');
                    }
                });
            } catch (e) {
                console.error(e);
                resolve('Unknown');
            }
        });
    } catch (e) {
        console.error(e);
        return 'Unknown';
    }
}

async function handlePingNode(event, data) {
    try {
        const { host, port } = data;
        const pingUrl = `http://${host}:${port}/ping`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);

        const response = await fetch(pingUrl, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (response.ok) {
            const result = await response.json();
            return { success: true, data: result };
        }
        return { success: false, error: 'Nodo non risponde' };
    } catch (e) {
        console.error('Errore fetch ping:', e);
        return { success: false, error: e.message || 'Ping fallito' };
    }
}
async function getNetworkCode() {
    try {
        const db = require('../db').getDB('config');
        const res = db.query("SELECT key_value FROM network_config WHERE key_name = 'network_code'");
        if (res && res.length > 0) {
            return { success: true, code: res[0].key_value };
        }
        return { success: false, error: 'Non disponibile sui vecchi database' };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

module.exports = {
    checkIsRegistered,
    loginUser,
    registerUser,
    handleScanNodes,
    handleCloneNetwork,
    checkNetworkProfile,
    getUsersList,
    unlockDatabase,
    handlePingNode,
    getNetworkCode
};
