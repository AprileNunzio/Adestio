const { checkIsRegistered: dbCheck, initEmptyDB, unlockDB, getDB, saveDB, importClonedDB, hashNetworkCode, wrapMutationWithEvent } = require('../db');
const { startSyncServer, scanForNodes } = require('../sync');
const crypto = require('crypto');
const passwordHasher = require('../security/password_hasher');
const twofaHandlers = require('./twofa');
const anagraficaPersone = require('./anagrafica_persone');
const sessionManager = require('../core/session_manager');

const _IPV4_RE = /^(\d{1,3}\.){3}\d{1,3}$/;
function _isValidIp(ip) {
    if (typeof ip !== 'string' || !_IPV4_RE.test(ip)) return false;
    const parts = ip.split('.');
    if (parts.some(o => { const n = parseInt(o, 10); return isNaN(n) || n < 0 || n > 255; })) return false;
    if (parseInt(parts[0], 10) === 127) return false;
    if (parseInt(parts[0], 10) === 0) return false;
    return true;
}
function _isValidPort(port) {
    const p = parseInt(port, 10);
    return !isNaN(p) && p >= 1024 && p <= 65535;
}
const LOGIN_CHALLENGE_TTL_MS = 5 * 60 * 1000;
const MAX_2FA_ATTEMPTS = 5;
const _loginChallenges = new Map();
const MAX_LOGIN_ATTEMPTS = 10;
const LOGIN_LOCKOUT_MS = 15 * 60 * 1000;
const LOGIN_BACKOFF_STEPS_MS = [0, 0, 0, 1000, 2000, 5000, 10000, 15000, 20000, 30000];
const _loginAttempts = new Map();

function _cleanupLoginChallenges() {
    const now = Date.now();
    for (const [token, val] of _loginChallenges.entries()) {
        if (val.expiresAt < now) _loginChallenges.delete(token);
    }
}
function _cleanupLoginAttempts() {
    try {
        const now = Date.now();
        for (const [id, val] of _loginAttempts.entries()) {
            if (now - val.lastAttempt > LOGIN_LOCKOUT_MS) _loginAttempts.delete(id);
        }
    } catch (e) {}
}
function _isLoginLocked(id) {
    try {
        _cleanupLoginAttempts();
        const entry = _loginAttempts.get(id);
        if (!entry) return { locked: false, waitMs: 0 };
        const elapsed = Date.now() - entry.lastAttempt;
        if (entry.count >= MAX_LOGIN_ATTEMPTS) {
            if (elapsed < LOGIN_LOCKOUT_MS) return { locked: true, waitMs: LOGIN_LOCKOUT_MS - elapsed };
            _loginAttempts.delete(id);
            return { locked: false, waitMs: 0 };
        }
        const stepIdx = Math.min(entry.count, LOGIN_BACKOFF_STEPS_MS.length - 1);
        const backoff = LOGIN_BACKOFF_STEPS_MS[stepIdx];
        if (elapsed < backoff) return { locked: true, waitMs: backoff - elapsed };
        return { locked: false, waitMs: 0 };
    } catch (e) {
        return { locked: false, waitMs: 0 };
    }
}
function _registerLoginFailure(id) {
    try {
        const entry = _loginAttempts.get(id) || { count: 0, lastAttempt: 0 };
        entry.count++;
        entry.lastAttempt = Date.now();
        _loginAttempts.set(id, entry);
    } catch (e) {}
}
function _registerLoginSuccess(id) {
    try {
        _loginAttempts.delete(id);
    } catch (e) {}
}

function _localIp() {
    const os = require('os');
    let ipAddress = '127.0.0.1';
    const ifaces = os.networkInterfaces();
    for (const name of Object.keys(ifaces)) {
        for (const iface of ifaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                ipAddress = iface.address;
                break;
            }
        }
    }
    return ipAddress;
}

function _notifySecurityEvent(userId, title, message) {
    try {
        const notificationsHandlers = require('./notifications');
        notificationsHandlers.create({ userId, category: 'security', title, message, severity: 'warning' }).catch(() => {});
    } catch (_) {}
}

const _PLATFORM_LABELS = { win32: 'Windows', darwin: 'macOS', linux: 'Linux' };
function _deviceLabel() {
    try {
        const os = require('os');
        const platform = _PLATFORM_LABELS[os.platform()] || os.platform();
        return `${platform} ${os.release()} (${os.arch()})`;
    } catch (_) {
        return 'Sconosciuto';
    }
}

function _writeAccessLog({ userId, eventType, success, authMethod }) {
    try {
        const db = getDB();
        const nodeIdentity = require('../core/node_identity');
        const nodeId = nodeIdentity.getNodeId();
        const nodeName = nodeIdentity.getNetworkName();
        const logId = crypto.randomUUID();
        const now = Date.now();
        const deviceInfo = _deviceLabel();
        const logPayload = {
            id: logId, user_id: userId, node_id: nodeId, node_name: nodeName,
            ip_address: _localIp(), device_info: deviceInfo, timestamp: now, is_deleted: 0,
            event_type: eventType, success: success ? 1 : 0, auth_method: authMethod || '', last_modified: now
        };
        db.run(
            'INSERT INTO access_logs (id, user_id, node_id, node_name, ip_address, device_info, timestamp, is_deleted, event_type, success, auth_method, last_modified) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [logId, userId, nodeId, nodeName, logPayload.ip_address, deviceInfo, now, 0, eventType, success ? 1 : 0, authMethod || '', now]
        );
        wrapMutationWithEvent('INSERT', 'access_logs', logId, logPayload);
    } catch (e) {
        console.error('[Auth] _writeAccessLog error:', e.message);
    }
}

async function _finalizeLogin(userId, authMethod) {
    const db = getDB();
    const now = Date.now();
    db.run('UPDATE users SET last_login = ? WHERE id = ?', [now, userId]);
    _writeAccessLog({ userId, eventType: 'login_success', success: true, authMethod });
    await saveDB();
    _registerLoginSuccess(userId);
    sessionManager.setSession(userId);
    const rows = db.query('SELECT * FROM users WHERE id = ?', [userId]);
    const row = rows && rows.length > 0 ? rows[0] : {};
    return { success: true, must_change_password: row.must_change_password === 1 };
}
async function checkIsRegistered() {
    try {
        return dbCheck();
    } catch (e) {
        console.error('[Auth] checkIsRegistered error:', e.message);
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
        if (!id) return { success: false };
        const lockState = _isLoginLocked(id);
        if (lockState.locked) {
            return { success: false, error: 'Troppi tentativi falliti. Riprova tra qualche istante.', retryAfterMs: lockState.waitMs };
        }
        const db = getDB();
        const field = password ? 'password' : 'pin';
        const credential = password || pin;
        const rows = db.query(`SELECT * FROM users WHERE id = ?`, [id]);
        if (!rows || rows.length === 0) { _registerLoginFailure(id); return { success: false }; }
        const row = rows[0];
        const { valid, needsRehash } = await passwordHasher.verify(credential, row[field]);
        if (!valid) {
            _registerLoginFailure(id);
            _writeAccessLog({ userId: id, eventType: 'login_failed', success: false, authMethod: field });
            _notifySecurityEvent(id, 'Tentativo di accesso fallito', `Credenziali errate (${field}) su questo dispositivo.`);
            await saveDB();
            return { success: false };
        }
        if (needsRehash) {
            try {
                const now = Date.now();
                const rehashed = await passwordHasher.hash(credential);
                db.run(`UPDATE users SET ${field} = ?, last_modified = ? WHERE id = ?`, [rehashed, now, id]);
                const updatedRows = db.query('SELECT * FROM users WHERE id = ?', [id]);
                if (updatedRows && updatedRows.length > 0) {
                    wrapMutationWithEvent('UPDATE', 'users', id, updatedRows[0]);
                }
            } catch (e) { console.error('[Auth] rehash error:', e.message); }
        }
        const hasWebauthn = (() => {
            try {
                const c = db.query('SELECT id FROM webauthn_credentials WHERE user_id = ? AND is_deleted = 0 LIMIT 1', [id]);
                return c && c.length > 0;
            } catch (_) { return false; }
        })();
        if (row.totp_enabled || hasWebauthn) {
            _cleanupLoginChallenges();
            const challengeToken = crypto.randomUUID();
            const methods = [];
            if (row.totp_enabled) methods.push('totp');
            if (hasWebauthn) methods.push('webauthn');
            _loginChallenges.set(challengeToken, { userId: id, expiresAt: Date.now() + LOGIN_CHALLENGE_TTL_MS, attempts: 0, firstFactor: field });
            return { success: true, requires2fa: true, methods, challengeToken };
        }
        return await _finalizeLogin(id, field);
    } catch (e) {
        console.error(e);
        return { success: false, error: e.message };
    }
}

async function loginWebauthnOptions(event, { challengeToken }) {
    try {
        _cleanupLoginChallenges();
        const pending = _loginChallenges.get(challengeToken);
        if (!pending) return { success: false, error: 'Sessione di verifica scaduta' };
        return await twofaHandlers.webauthnAuthBegin(pending.userId);
    } catch (e) {
        console.error('[Auth] loginWebauthnOptions error:', e.message);
        return { success: false, error: e.message };
    }
}

async function loginUserVerify2fa(event, { challengeToken, code, assertion, backupCode }) {
    try {
        _cleanupLoginChallenges();
        const pending = _loginChallenges.get(challengeToken);
        if (!pending) return { success: false, error: 'Sessione di verifica scaduta, effettua di nuovo il login.' };
        if (pending.attempts >= MAX_2FA_ATTEMPTS) {
            _loginChallenges.delete(challengeToken);
            _writeAccessLog({ userId: pending.userId, eventType: '2fa_failed', success: false, authMethod: 'lockout' });
            await saveDB();
            return { success: false, error: 'Troppi tentativi falliti, effettua di nuovo il login.' };
        }
        let ok = false;
        let authMethod = '';
        if (code) {
            ok = twofaHandlers.totpVerifyCode(pending.userId, code);
            authMethod = 'totp';
        } else if (assertion) {
            ok = await twofaHandlers.webauthnAuthVerify(pending.userId, assertion);
            authMethod = 'webauthn';
        } else if (backupCode) {
            ok = await twofaHandlers.backupCodeVerify(pending.userId, backupCode);
            authMethod = 'backup_code';
        }
        if (!ok) {
            pending.attempts++;
            _writeAccessLog({ userId: pending.userId, eventType: '2fa_failed', success: false, authMethod: authMethod || 'unknown' });
            _notifySecurityEvent(pending.userId, 'Verifica 2FA fallita', `Tentativo di verifica a due fattori (${authMethod || 'sconosciuto'}) non riuscito.`);
            await saveDB();
            return { success: false, error: 'Verifica non riuscita' };
        }
        _loginChallenges.delete(challengeToken);
        return await _finalizeLogin(pending.userId, `${pending.firstFactor}+${authMethod}`);
    } catch (e) {
        console.error('[Auth] loginUserVerify2fa error:', e.message);
        return { success: false, error: e.message };
    }
}

async function logoutUser(event, { userId }) {
    try {
        if (!userId) return { success: false };
        _writeAccessLog({ userId, eventType: 'logout', success: true, authMethod: '' });
        await saveDB();
        sessionManager.clearSession();
        return { success: true };
    } catch (e) {
        console.error('[Auth] logoutUser error:', e.message);
        return { success: false, error: e.message };
    }
}
async function registerUser(event, data) {
    try {
        const { nome, cognome, email, pin, password, networkName, codice_fiscale } = data;
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
        anagraficaPersone.linkOrCreateForUser(newId, codice_fiscale, nome, cognome, email, newId);
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
        sessionManager.setSession(newId);
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
        const { host, port, networkCode, networkName } = data;
        if (!_isValidIp(host)) return false;
        if (!_isValidPort(port)) return false;
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
                                const success = await importClonedDB(buffer, networkCode, networkName);
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
function _hasAccessLogsPermission() {
    try {
        const currentUserId = sessionManager.getCurrentUserId();
        if (!currentUserId) return false;
        const rbacHandlers = require('./rbac');
        const perms = rbacHandlers.getEffectiveUserPermissions(null, currentUserId) || [];
        return perms.includes('*') || perms.some(p => p.startsWith('impostazioni:'));
    } catch (e) {
        return false;
    }
}
async function getAllAccessLogs(event, filters = {}) {
    try {
        const { userId, eventType, success, dateFrom, dateTo, ip, page = 1, pageSize = 50 } = filters;
        if (!_hasAccessLogsPermission()) return { success: false, error: 'Permesso negato' };
        const db = getDB();
        const where = ['1=1'];
        const params = [];
        if (userId) { where.push('a.user_id = ?'); params.push(userId); }
        if (eventType) { where.push('a.event_type = ?'); params.push(eventType); }
        if (success === true || success === false) { where.push('a.success = ?'); params.push(success ? 1 : 0); }
        if (dateFrom) { where.push('a.timestamp >= ?'); params.push(Number(dateFrom)); }
        if (dateTo) { where.push('a.timestamp <= ?'); params.push(Number(dateTo)); }
        if (ip) { where.push('a.ip_address LIKE ?'); params.push(`%${ip}%`); }
        const whereSql = where.join(' AND ');
        const totalRows = db.query(`SELECT COUNT(*) as cnt FROM access_logs a WHERE ${whereSql}`, params);
        const total = totalRows && totalRows.length > 0 ? totalRows[0].cnt : 0;
        const safePageSize = Math.min(Math.max(Number(pageSize) || 50, 1), 500);
        const offset = Math.max((Number(page) || 1) - 1, 0) * safePageSize;
        const logs = db.query(
            `SELECT a.*, u.username, u.nome, u.cognome FROM access_logs a
             LEFT JOIN users u ON u.id = a.user_id
             WHERE ${whereSql}
             ORDER BY a.timestamp DESC LIMIT ? OFFSET ?`,
            [...params, safePageSize, offset]
        );
        return { success: true, logs, total, page: Number(page) || 1, pageSize: safePageSize };
    } catch (e) {
        console.error('[Auth] getAllAccessLogs error:', e.message);
        return { success: false, error: e.message };
    }
}
async function getAccessLogsStats(event) {
    try {
        if (!_hasAccessLogsPermission()) return { success: false, error: 'Permesso negato' };
        const db = getDB();
        const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
        const last7d = db.query('SELECT COUNT(*) as cnt FROM access_logs WHERE timestamp >= ? AND event_type = ?', [sevenDaysAgo, 'login_success']);
        const failed7d = db.query('SELECT COUNT(*) as cnt FROM access_logs WHERE timestamp >= ? AND success = 0', [sevenDaysAgo]);
        const devices7d = db.query('SELECT COUNT(DISTINCT device_info) as cnt FROM access_logs WHERE timestamp >= ?', [sevenDaysAgo]);
        return {
            success: true,
            logins7d: last7d[0] ? last7d[0].cnt : 0,
            failed7d: failed7d[0] ? failed7d[0].cnt : 0,
            distinctDevices7d: devices7d[0] ? devices7d[0].cnt : 0
        };
    } catch (e) {
        console.error('[Auth] getAccessLogsStats error:', e.message);
        return { success: false, error: e.message };
    }
}
module.exports = {
    checkIsRegistered,
    loginUser,
    loginUserVerify2fa,
    loginWebauthnOptions,
    logoutUser,
    registerUser,
    handleScanNodes,
    handleCloneNetwork,
    checkNetworkProfile,
    getUsersList,
    unlockDatabase,
    handlePingNode,
    getNetworkCode,
    getAllAccessLogs,
    getAccessLogsStats
};
