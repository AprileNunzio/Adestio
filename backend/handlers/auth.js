const { checkIsRegistered: dbCheck, initEmptyDB, unlockDB, getDB, saveDB, importClonedDB, hashNetworkCode, wrapMutationWithEvent } = require('../db');
const { startSyncServer, scanForNodes } = require('../sync');
const crypto = require('crypto');
const passwordHasher = require('../security/password_hasher');
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
        const field = password ? 'password' : 'pin';
        const credential = password || pin;
        const rows = db.query(`SELECT * FROM users WHERE id = ?`, [id]);
        if (!rows || rows.length === 0) return { success: false };
        const row = rows[0];
        const { valid, needsRehash } = await passwordHasher.verify(credential, row[field]);
        if (!valid) return { success: false };
        const now = Date.now();
        db.run('UPDATE users SET last_login = ? WHERE id = ?', [now, id]);
        if (needsRehash) {
            try {
                const rehashed = await passwordHasher.hash(credential);
                db.run(`UPDATE users SET ${field} = ?, last_modified = ? WHERE id = ?`, [rehashed, now, id]);
                const updatedRows = db.query('SELECT * FROM users WHERE id = ?', [id]);
                if (updatedRows && updatedRows.length > 0) {
                    wrapMutationWithEvent('UPDATE', 'users', id, updatedRows[0]);
                }
            } catch (e) { console.error('[Auth] rehash error:', e.message); }
        }
        await saveDB();
        return { success: true, must_change_password: row.must_change_password === 1 };
    } catch (e) {
        console.error(e);
        return { success: false, error: e.message };
    }
}
async function registerUser(event, data) {
    try {
        const { nome, cognome, email, pin, password, networkName } = data;
        const networkCode = await initEmptyDB(networkName);
        if (!networkCode) return { success: false };
        const baseUsername = `${cognome} ${nome}`.trim() || 'User';
        let username = baseUsername;
        const db = getDB();
        let counter = 1;
        while (true) {
            const res = db.query("SELECT id FROM users WHERE username = ?", [username]);
            if (res.length === 0) break;
            username = `${baseUsername}${counter}`;
            counter++;
        }
        const hashedPw = await passwordHasher.hash(password);
        const hashedPin = await passwordHasher.hash(pin);
        const newId = crypto.randomUUID();
        const ts = Date.now();
        db.run(
            "INSERT INTO users (id, username, email, password, passkey, pin, last_modified, is_deleted, is_superadmin, nome, cognome) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [newId, username, email, hashedPw, '', hashedPin, ts, 0, 1, nome || '', cognome || '']
        );
        await saveDB();
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
