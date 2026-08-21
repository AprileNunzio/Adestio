const { checkIsRegistered: dbCheck, initEmptyDB, unlockDB, getDB, saveDB, importClonedDB, hashNetworkCode, wrapMutationWithEvent } = require('../db');
const { startSyncServer, scanForNodes } = require('../sync');
const crypto = require('crypto');
const passwordHasher = require('../security/password_hasher');
const twofaHandlers = require('./twofa');
const anagraficaPersone = require('./anagrafica_persone');
const sessionManager = require('../core/session_manager');

const _IPV4_RE = /^(\d{1,3}\.){3}\d{1,3}$/;

function _isValidIp(ip) {
    try {
        if (typeof ip !== 'string' || !_IPV4_RE.test(ip)) return false;
        const parts = ip.split('.');
        if (parts.some(o => { const n = parseInt(o, 10); return isNaN(n) || n < 0 || n > 255; })) return false;
        if (parseInt(parts[0], 10) === 127) return false;
        if (parseInt(parts[0], 10) === 0) return false;
        return true;
    } catch (e) {
        return false;
    }
}

function _isValidPort(port) {
    try {
        const p = parseInt(port, 10);
        return !isNaN(p) && p >= 1024 && p <= 65535;
    } catch (e) {
        return false;
    }
}

const { isLoginLocked, registerLoginFailure, registerLoginSuccess, setChallenge, getChallenge, deleteChallenge, MAX_2FA_ATTEMPTS, LOGIN_CHALLENGE_TTL_MS } = require('../security/auth_rate_limiter');

const { getAllAccessLogs, getAccessLogsStats, writeAccessLog, notifySecurityEvent } = require('./access_logs');

async function _finalizeLogin(userId, authMethod) {
    try {
        const db = getDB();
        const now = Date.now();
        db.run('UPDATE users SET last_login = ? WHERE id = ?', [now, userId]);
        writeAccessLog({ userId, eventType: 'login_success', success: true, authMethod });
        await saveDB();
        registerLoginSuccess(userId);
        sessionManager.setSession(userId);
        const rows = db.query('SELECT * FROM users WHERE id = ?', [userId]);
        const row = rows && rows.length > 0 ? rows[0] : {};
        return { success: true, must_change_password: row.must_change_password === 1 };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

async function checkIsRegistered() {
    try {
        return dbCheck();
    } catch (e) {
        return false;
    }
}

async function unlockDatabase(event) {
    try {
        return await unlockDB();
    } catch (e) {
        return false;
    }
}

async function getUsersList() {
    try {
        const db = getDB();
        const users = db.query("SELECT id, username, email, is_superadmin, last_login, nome, cognome FROM users WHERE is_deleted = 0");
        return { users: users || [] };
    } catch (e) {
        if (e.message === 'DB_NOT_INITIALIZED') {
            const { checkIsRegistered } = require('../db');
            const registered = checkIsRegistered();
            if (!registered) {
                return { users: [], virgin: true };
            }
            return { needsUnlock: true };
        }
        return { users: [], error: e.message };
    }
}

async function loginUser(event, data) {
    try {
        const { id, pin, password, passkey } = data;
        if (!id) return { success: false };
        const lockState = isLoginLocked(id);
        if (lockState.locked) {
            return { success: false, error: 'Troppi tentativi falliti. Riprova tra qualche istante.', retryAfterMs: lockState.waitMs };
        }
        const db = getDB();
        const hasWebauthn = (() => {
            try {
                const c = db.query('SELECT id FROM webauthn_credentials WHERE user_id = ? AND is_deleted = 0 LIMIT 1', [id]);
                return c && c.length > 0;
            } catch (_) { return false; }
        })();
        if (passkey) {
            if (!hasWebauthn) {
                registerLoginFailure(id);
                return { success: false, error: "Passkey non configurata per questo utente." };
            }
            const challengeToken = crypto.randomUUID();
            setChallenge(challengeToken, { userId: id, expiresAt: Date.now() + LOGIN_CHALLENGE_TTL_MS, attempts: 0, firstFactor: 'passkey' });
            return { success: true, requires2fa: true, methods: ['webauthn'], challengeToken };
        }
        const field = password ? 'password' : 'pin';
        const credential = password || pin;
        const rows = db.query(`SELECT * FROM users WHERE id = ?`, [id]);
        if (!rows || rows.length === 0) { registerLoginFailure(id); return { success: false }; }
        const row = rows[0];
        const { valid, needsRehash } = await passwordHasher.verify(credential, row[field]);
        if (!valid) {
            registerLoginFailure(id);
            writeAccessLog({ userId: id, eventType: 'login_failed', success: false, authMethod: field });
            notifySecurityEvent(id, 'Tentativo di accesso fallito', `Credenziali errate (${field}) su questo dispositivo.`);
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
            } catch (_) {}
        }
        if (row.totp_enabled || hasWebauthn) {
            const challengeToken = crypto.randomUUID();
            const methods = [];
            if (row.totp_enabled) methods.push('totp');
            if (hasWebauthn) methods.push('webauthn');
            setChallenge(challengeToken, { userId: id, expiresAt: Date.now() + LOGIN_CHALLENGE_TTL_MS, attempts: 0, firstFactor: field });
            return { success: true, requires2fa: true, methods, challengeToken };
        }
        return await _finalizeLogin(id, field);
    } catch (e) {
        return { success: false, error: e.message };
    }
}

async function loginWebauthnOptions(event, { challengeToken }) {
    try {
        const pending = getChallenge(challengeToken);
        if (!pending) return { success: false, error: 'Sessione di verifica scaduta' };
        return await twofaHandlers.webauthnAuthBegin(pending.userId);
    } catch (e) {
        return { success: false, error: e.message };
    }
}

async function loginUserVerify2fa(event, { challengeToken, code, assertion, backupCode }) {
    try {
        const pending = getChallenge(challengeToken);
        if (!pending) return { success: false, error: 'Sessione di verifica scaduta, effettua di nuovo il login.' };
        if (pending.attempts >= MAX_2FA_ATTEMPTS) {
            deleteChallenge(challengeToken);
            writeAccessLog({ userId: pending.userId, eventType: '2fa_failed', success: false, authMethod: 'lockout' });
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
            writeAccessLog({ userId: pending.userId, eventType: '2fa_failed', success: false, authMethod: authMethod || 'unknown' });
            notifySecurityEvent(pending.userId, 'Verifica 2FA fallita', `Tentativo di verifica a due fattori (${authMethod || 'sconosciuto'}) non riuscito.`);
            await saveDB();
            return { success: false, error: 'Verifica non riuscita' };
        }
        deleteChallenge(challengeToken);
        return await _finalizeLogin(pending.userId, `${pending.firstFactor}+${authMethod}`);
    } catch (e) {
        return { success: false, error: e.message };
    }
}

async function logoutUser(event, { userId }) {
    try {
        if (!userId) return { success: false };
        writeAccessLog({ userId, eventType: 'logout', success: true, authMethod: '' });
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
        const onProgress = (msg) => {
            try {
                if (event && event.sender && !event.sender.isDestroyed()) {
                    event.sender.send('scan-progress', msg);
                }
            } catch (_) {}
        };
        return await scanForNodes(onProgress);
    } catch (e) {
        return [];
    }
}

async function handleCloneNetwork(event, data) {
    try {
        const { host, port, networkCode, networkName } = data;
        if (!_isValidIp(host)) return { success: false, reason: 'invalid_ip', error: 'Indirizzo IPv4 non valido' };
        if (!_isValidPort(port)) return { success: false, reason: 'invalid_port', error: 'Porta di rete non valida' };
        const http = require('http');
        const hashedCode = hashNetworkCode(networkCode);
        return new Promise((resolve) => {
            try {
                const req = http.get(`http://${host}:${port}/sync/clone`, {
                    headers: { 'x-adestio-network': hashedCode },
                    timeout: 8000
                }, (res) => {
                    try {
                        if (res.statusCode === 403) {
                            return resolve({ success: false, reason: 'auth_failed', error: 'Codice di sicurezza non valido per questo nodo' });
                        }
                        if (res.statusCode !== 200) {
                            return resolve({ success: false, reason: 'http_error', error: `Risposta anomala dal nodo: HTTP ${res.statusCode}` });
                        }
                        const dataChunks = [];
                        res.on('data', (chunk) => dataChunks.push(chunk));
                        res.on('end', async () => {
                            try {
                                const buffer = Buffer.concat(dataChunks);
                                const success = await importClonedDB(buffer, networkCode, networkName);
                                if (success) {
                                    startSyncServer();
                                    resolve({ success: true });
                                } else {
                                    resolve({ success: false, reason: 'import_failed', error: 'Errore durante la decifratura o importazione del database' });
                                }
                            } catch (err) {
                                resolve({ success: false, reason: 'import_failed', error: err.message });
                            }
                        });
                    } catch (e) {
                        resolve({ success: false, reason: 'internal_error', error: e.message });
                    }
                });
                req.on('timeout', () => {
                    try {
                        req.destroy();
                        resolve({ success: false, reason: 'unreachable', error: 'Timeout di connessione: il nodo non risponde. Verifica che sia attivo e che il firewall consenta la porta 34567.' });
                    } catch (_) {
                        resolve({ success: false, reason: 'unreachable' });
                    }
                });
                req.on('error', (err) => {
                    resolve({ success: false, reason: 'unreachable', error: `Connessione TCP rifiutata o firewall attivo (${err.code || 'errore di rete'}).` });
                });
            } catch (e) {
                resolve({ success: false, reason: 'internal_error', error: e.message });
            }
        });
    } catch (e) {
        console.error(e);
        return { success: false, reason: 'fatal', error: e.message };
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
                            return resolve('Unknown');
                        }
                        if (stdout && stdout.includes('Public')) {
                            return resolve('Public');
                        }
                        resolve('Private');
                    } catch (e) {
                        resolve('Unknown');
                    }
                });
            } catch (e) {
                resolve('Unknown');
            }
        });
    } catch (e) {
        return 'Unknown';
    }
}

async function setNetworkProfilePrivate() {
    try {
        if (process.platform !== 'win32') return { success: true };
        const { exec } = require('child_process');
        return new Promise((resolve) => {
            try {
                const psCmd = `powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -Command "Start-Process powershell -Verb RunAs -WindowStyle Hidden -ArgumentList '-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', 'Get-NetConnectionProfile | Set-NetConnectionProfile -NetworkCategory Private'"`;
                exec(psCmd, (error) => {
                    try {
                        if (error) {
                            return resolve({ success: false, error: error.message });
                        }
                        resolve({ success: true });
                    } catch (err) {
                        resolve({ success: false, error: err.message });
                    }
                });
            } catch (e) {
                resolve({ success: false, error: e.message });
            }
        });
    } catch (e) {
        return { success: false, error: e.message };
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
    loginUserVerify2fa,
    loginWebauthnOptions,
    logoutUser,
    registerUser,
    handleScanNodes,
    handleCloneNetwork,
    checkNetworkProfile,
    setNetworkProfilePrivate,
    getUsersList,
    unlockDatabase,
    handlePingNode,
    getNetworkCode,
    getAllAccessLogs,
    getAccessLogsStats
};