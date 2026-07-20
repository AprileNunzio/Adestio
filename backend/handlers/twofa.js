const crypto = require('crypto');
const { authenticator } = require('otplib');
const QRCode = require('qrcode');
const { getDB, saveDB, wrapMutationWithEvent } = require('../db');
const passwordHasher = require('../security/password_hasher');
const { localAppUrlIfAny } = (() => {
    const { getLocalAppUrl } = require('../core/localAppServer');
    return { localAppUrlIfAny: getLocalAppUrl };
})();

const RP_NAME = 'Adestio';
const RP_ID = 'localhost';
const BACKUP_CODES_COUNT = 10;
const CHALLENGE_TTL_MS = 5 * 60 * 1000;

// challenge WebAuthn effimero per (userId -> { challenge, type, expiresAt })
const _webauthnChallenges = new Map();

function _rpOrigin() {
    const url = localAppUrlIfAny();
    if (url) {
        try { return new URL(url).origin; } catch (_) {}
    }
    return `http://${RP_ID}:34570`;
}

function _cleanupChallenges() {
    const now = Date.now();
    for (const [key, val] of _webauthnChallenges.entries()) {
        if (val.expiresAt < now) _webauthnChallenges.delete(key);
    }
}

function _getUserRow(userId) {
    const db = getDB('auth');
    const rows = db.query('SELECT * FROM users WHERE id = ?', [userId]);
    return rows && rows.length > 0 ? rows[0] : null;
}

const _TOUCH_ALLOWED = new Set(['totp_enabled', 'totp_secret', 'twofa_required', 'passkey', 'must_change_password', 'last_login']);
function _touchUser(userId, patch) {
    const db = getDB('auth');
    const ts = Date.now();
    const fields = Object.keys(patch).filter(f => _TOUCH_ALLOWED.has(f));
    if (fields.length === 0) return;
    const setSql = fields.map(f => `${f} = ?`).join(', ');
    db.run(`UPDATE users SET ${setSql}, last_modified = ? WHERE id = ?`, [...fields.map(f => patch[f]), ts, userId]);
    const updated = db.query('SELECT * FROM users WHERE id = ?', [userId]);
    if (updated && updated.length > 0) {
        wrapMutationWithEvent('UPDATE', 'users', userId, updated[0]);
    }
}

async function getStatus(event, userId) {
    try {
        const user = _getUserRow(userId);
        if (!user) return { success: false, error: 'Utente non trovato' };
        const db = getDB('auth');
        const rows = db.query(
            'SELECT id, credential_id, device_name, created_at, last_used_at FROM webauthn_credentials WHERE user_id = ? AND is_deleted = 0 ORDER BY created_at DESC',
            [userId]
        );
        return {
            success: true,
            totpEnabled: !!user.totp_enabled,
            twofaRequired: !!user.twofa_required,
            passkeys: rows.map(r => ({
                id: r.id,
                credentialId: r.credential_id,
                deviceName: r.device_name,
                createdAt: r.created_at,
                lastUsedAt: r.last_used_at
            }))
        };
    } catch (e) {
        console.error('[2FA] getStatus error:', e.message);
        return { success: false, error: e.message };
    }
}

async function totpSetupBegin(event, userId) {
    try {
        const user = _getUserRow(userId);
        if (!user) return { success: false, error: 'Utente non trovato' };
        const secret = authenticator.generateSecret();
        const otpauthUrl = authenticator.keyuri(user.username || userId, RP_NAME, secret);
        const qrDataUrl = await QRCode.toDataURL(otpauthUrl);
        return { success: true, secret, otpauthUrl, qrDataUrl };
    } catch (e) {
        console.error('[2FA] totpSetupBegin error:', e.message);
        return { success: false, error: e.message };
    }
}

function _generateBackupCodes() {
    const codes = [];
    for (let i = 0; i < BACKUP_CODES_COUNT; i++) {
        const raw = crypto.randomBytes(5).toString('hex').toUpperCase();
        codes.push(`${raw.slice(0, 5)}-${raw.slice(5, 10)}`);
    }
    return codes;
}

async function totpSetupConfirm(event, { userId, secret, code }) {
    try {
        const user = _getUserRow(userId);
        if (!user) return { success: false, error: 'Utente non trovato' };
        if (!secret || !code) return { success: false, error: 'Dati mancanti' };
        const valid = authenticator.check(String(code).trim(), secret);
        if (!valid) return { success: false, error: 'Codice non valido' };
        _touchUser(userId, { totp_secret: secret, totp_enabled: 1 });
        const db = getDB('auth');
        const ts = Date.now();
        _softDeleteBackupCodes(userId, ts);
        const plainCodes = _generateBackupCodes();
        for (const plain of plainCodes) {
            const id = crypto.randomUUID();
            const codeHash = await passwordHasher.hash(plain);
            const payload = { id, user_id: userId, code_hash: codeHash, used_at: 0, created_at: ts, is_deleted: 0, last_modified: ts };
            db.run(
                'INSERT INTO totp_backup_codes (id, user_id, code_hash, used_at, created_at, is_deleted, last_modified) VALUES (?, ?, ?, 0, ?, 0, ?)',
                [id, userId, codeHash, ts, ts]
            );
            wrapMutationWithEvent('INSERT', 'totp_backup_codes', id, payload);
        }
        await saveDB('auth');
        return { success: true, backupCodes: plainCodes };
    } catch (e) {
        console.error('[2FA] totpSetupConfirm error:', e.message);
        return { success: false, error: e.message };
    }
}

function _softDeleteBackupCodes(userId, ts) {
    const db = getDB('auth');
    const rows = db.query('SELECT * FROM totp_backup_codes WHERE user_id = ? AND is_deleted = 0', [userId]);
    if (rows.length === 0) return;
    db.run('UPDATE totp_backup_codes SET is_deleted = 1, last_modified = ? WHERE user_id = ? AND is_deleted = 0', [ts, userId]);
    rows.forEach(row => wrapMutationWithEvent('UPDATE', 'totp_backup_codes', row.id, { ...row, is_deleted: 1, last_modified: ts }));
}

async function totpDisable(event, { userId, password }) {
    try {
        const user = _getUserRow(userId);
        if (!user) return { success: false, error: 'Utente non trovato' };
        const { valid } = await passwordHasher.verify(password, user.password);
        if (!valid) return { success: false, error: 'Password errata' };
        _touchUser(userId, { totp_secret: '', totp_enabled: 0 });
        _softDeleteBackupCodes(userId, Date.now());
        await saveDB('auth');
        return { success: true };
    } catch (e) {
        console.error('[2FA] totpDisable error:', e.message);
        return { success: false, error: e.message };
    }
}

function totpVerifyCode(userId, code) {
    try {
        const user = _getUserRow(userId);
        if (!user || !user.totp_enabled || !user.totp_secret) return false;
        return authenticator.check(String(code || '').trim(), user.totp_secret);
    } catch (e) {
        console.error('[2FA] totpVerifyCode error:', e.message);
        return false;
    }
}

async function backupCodeVerify(userId, code) {
    try {
        const db = getDB('auth');
        const rows = db.query('SELECT * FROM totp_backup_codes WHERE user_id = ? AND used_at = 0 AND is_deleted = 0', [userId]);
        const normalized = String(code || '').trim().toUpperCase();
        for (const row of rows) {
            const { valid } = await passwordHasher.verify(normalized, row.code_hash);
            if (valid) {
                const ts = Date.now();
                db.run('UPDATE totp_backup_codes SET used_at = ?, last_modified = ? WHERE id = ?', [ts, ts, row.id]);
                wrapMutationWithEvent('UPDATE', 'totp_backup_codes', row.id, { ...row, used_at: ts, last_modified: ts });
                await saveDB('auth');
                return true;
            }
        }
        return false;
    } catch (e) {
        console.error('[2FA] backupCodeVerify error:', e.message);
        return false;
    }
}

async function webauthnRegisterBegin(event, userId) {
    try {
        const { generateRegistrationOptions } = await import('@simplewebauthn/server');
        const user = _getUserRow(userId);
        if (!user) return { success: false, error: 'Utente non trovato' };
        const db = getDB('auth');
        const existing = db.query('SELECT credential_id FROM webauthn_credentials WHERE user_id = ? AND is_deleted = 0', [userId]);
        const options = await generateRegistrationOptions({
            rpName: RP_NAME,
            rpID: RP_ID,
            userName: user.username || userId,
            userID: Buffer.from(userId),
            userDisplayName: `${user.nome || ''} ${user.cognome || ''}`.trim() || user.username || userId,
            attestationType: 'none',
            excludeCredentials: existing.map(r => ({ id: r.credential_id })),
            authenticatorSelection: { residentKey: 'preferred', userVerification: 'preferred' }
        });
        _cleanupChallenges();
        _webauthnChallenges.set(userId, { challenge: options.challenge, type: 'registration', expiresAt: Date.now() + CHALLENGE_TTL_MS });
        return { success: true, options };
    } catch (e) {
        console.error('[2FA] webauthnRegisterBegin error:', e.message);
        return { success: false, error: e.message };
    }
}

async function webauthnRegisterFinish(event, { userId, response, deviceName }) {
    try {
        const { verifyRegistrationResponse } = await import('@simplewebauthn/server');
        const pending = _webauthnChallenges.get(userId);
        if (!pending || pending.type !== 'registration' || pending.expiresAt < Date.now()) {
            return { success: false, error: 'Richiesta di registrazione scaduta, riprova.' };
        }
        const verification = await verifyRegistrationResponse({
            response,
            expectedChallenge: pending.challenge,
            expectedOrigin: _rpOrigin(),
            expectedRPID: RP_ID
        });
        _webauthnChallenges.delete(userId);
        if (!verification.verified || !verification.registrationInfo) {
            return { success: false, error: 'Verifica passkey fallita' };
        }
        const { credential } = verification.registrationInfo;
        const db = getDB('auth');
        const id = crypto.randomUUID();
        const ts = Date.now();
        const publicKeyB64 = Buffer.from(credential.publicKey).toString('base64');
        const transports = (credential.transports || []).join(',');
        const payload = {
            id, user_id: userId, credential_id: credential.id, public_key: publicKeyB64,
            counter: credential.counter || 0, device_name: (deviceName || 'Passkey').slice(0, 80),
            transports, created_at: ts, last_used_at: 0, is_deleted: 0, last_modified: ts
        };
        db.run(
            'INSERT INTO webauthn_credentials (id, user_id, credential_id, public_key, counter, device_name, transports, created_at, last_used_at, is_deleted, last_modified) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?)',
            [id, userId, credential.id, publicKeyB64, credential.counter || 0, payload.device_name, transports, ts, ts]
        );
        wrapMutationWithEvent('INSERT', 'webauthn_credentials', id, payload);
        await saveDB('auth');
        return { success: true, id };
    } catch (e) {
        console.error('[2FA] webauthnRegisterFinish error:', e.message);
        return { success: false, error: e.message };
    }
}

async function webauthnRemove(event, { userId, credentialRowId }) {
    try {
        const db = getDB('auth');
        const rows = db.query('SELECT * FROM webauthn_credentials WHERE id = ? AND user_id = ?', [credentialRowId, userId]);
        if (!rows || rows.length === 0) return { success: false, error: 'Passkey non trovata' };
        const ts = Date.now();
        db.run('UPDATE webauthn_credentials SET is_deleted = 1, last_modified = ? WHERE id = ?', [ts, credentialRowId]);
        wrapMutationWithEvent('UPDATE', 'webauthn_credentials', credentialRowId, { ...rows[0], is_deleted: 1, last_modified: ts });
        await saveDB('auth');
        return { success: true };
    } catch (e) {
        console.error('[2FA] webauthnRemove error:', e.message);
        return { success: false, error: e.message };
    }
}

async function webauthnAuthBegin(userId) {
    try {
        const { generateAuthenticationOptions } = await import('@simplewebauthn/server');
        const db = getDB('auth');
        const creds = db.query('SELECT credential_id, transports FROM webauthn_credentials WHERE user_id = ? AND is_deleted = 0', [userId]);
        if (!creds || creds.length === 0) return { success: false, error: 'Nessuna passkey registrata' };
        const options = await generateAuthenticationOptions({
            rpID: RP_ID,
            userVerification: 'preferred',
            allowCredentials: creds.map(c => ({ id: c.credential_id, transports: c.transports ? c.transports.split(',').filter(Boolean) : undefined }))
        });
        _cleanupChallenges();
        _webauthnChallenges.set(userId, { challenge: options.challenge, type: 'authentication', expiresAt: Date.now() + CHALLENGE_TTL_MS });
        return { success: true, options };
    } catch (e) {
        console.error('[2FA] webauthnAuthBegin error:', e.message);
        return { success: false, error: e.message };
    }
}

async function webauthnAuthVerify(userId, response) {
    try {
        const { verifyAuthenticationResponse } = await import('@simplewebauthn/server');
        const pending = _webauthnChallenges.get(userId);
        if (!pending || pending.type !== 'authentication' || pending.expiresAt < Date.now()) {
            return false;
        }
        const db = getDB('auth');
        const rows = db.query('SELECT * FROM webauthn_credentials WHERE user_id = ? AND credential_id = ? AND is_deleted = 0', [userId, response.id]);
        if (!rows || rows.length === 0) return false;
        const stored = rows[0];
        const verification = await verifyAuthenticationResponse({
            response,
            expectedChallenge: pending.challenge,
            expectedOrigin: _rpOrigin(),
            expectedRPID: RP_ID,
            credential: {
                id: stored.credential_id,
                publicKey: new Uint8Array(Buffer.from(stored.public_key, 'base64')),
                counter: stored.counter,
                transports: stored.transports ? stored.transports.split(',').filter(Boolean) : undefined
            }
        });
        _webauthnChallenges.delete(userId);
        if (!verification.verified) return false;
        const ts = Date.now();
        db.run('UPDATE webauthn_credentials SET counter = ?, last_used_at = ?, last_modified = ? WHERE id = ?', [verification.authenticationInfo.newCounter, ts, ts, stored.id]);
        wrapMutationWithEvent('UPDATE', 'webauthn_credentials', stored.id, { ...stored, counter: verification.authenticationInfo.newCounter, last_used_at: ts, last_modified: ts });
        await saveDB('auth');
        return true;
    } catch (e) {
        console.error('[2FA] webauthnAuthVerify error:', e.message);
        return false;
    }
}

function hasPermission(actorUserId, permId) {
    try {
        const rbacHandlers = require('./rbac');
        const perms = rbacHandlers.getEffectiveUserPermissions(null, actorUserId) || [];
        return perms.includes('*') || perms.includes(permId) || perms.some(p => p.startsWith('impostazioni:') || p.startsWith('amministratore:'));
    } catch (e) {
        return false;
    }
}

async function adminReset(event, { actorUserId, targetUserId }) {
    try {
        if (!hasPermission(actorUserId, 'impostazioni:edit')) {
            return { success: false, error: 'Permesso negato' };
        }
        const target = _getUserRow(targetUserId);
        if (!target) return { success: false, error: 'Utente non trovato' };
        const ts = Date.now();
        _touchUser(targetUserId, { totp_secret: '', totp_enabled: 0 });
        _softDeleteBackupCodes(targetUserId, ts);
        const db = getDB('auth');
        const credRows = db.query('SELECT * FROM webauthn_credentials WHERE user_id = ? AND is_deleted = 0', [targetUserId]);
        if (credRows.length > 0) {
            db.run('UPDATE webauthn_credentials SET is_deleted = 1, last_modified = ? WHERE user_id = ? AND is_deleted = 0', [ts, targetUserId]);
            credRows.forEach(row => wrapMutationWithEvent('UPDATE', 'webauthn_credentials', row.id, { ...row, is_deleted: 1, last_modified: ts }));
        }
        const logId = crypto.randomUUID();
        const deviceInfo = `Reset 2FA da ${actorUserId}`;
        const logPayload = {
            id: logId, user_id: targetUserId, node_id: '', node_name: '', ip_address: '', device_info: deviceInfo,
            timestamp: ts, is_deleted: 0, event_type: '2fa_admin_reset', success: 1, auth_method: '', last_modified: ts
        };
        db.run(
            'INSERT INTO access_logs (id, user_id, node_id, node_name, ip_address, device_info, timestamp, is_deleted, event_type, success, auth_method, last_modified) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [logId, targetUserId, '', '', '', deviceInfo, ts, 0, '2fa_admin_reset', 1, '', ts]
        );
        wrapMutationWithEvent('INSERT', 'access_logs', logId, logPayload);
        await saveDB('auth');
        return { success: true };
    } catch (e) {
        console.error('[2FA] adminReset error:', e.message);
        return { success: false, error: e.message };
    }
}

async function setTwofaPolicy(event, { actorUserId, required }) {
    try {
        if (!hasPermission(actorUserId, 'impostazioni:edit')) {
            return { success: false, error: 'Permesso negato' };
        }
        const db = getDB('auth');
        const ts = Date.now();
        db.run('UPDATE users SET twofa_required = ?, last_modified = ? WHERE is_deleted = 0', [required ? 1 : 0, ts]);
        const rows = db.query('SELECT * FROM users WHERE is_deleted = 0', []);
        for (const row of rows) {
            wrapMutationWithEvent('UPDATE', 'users', row.id, row);
        }
        await saveDB('auth');
        return { success: true };
    } catch (e) {
        console.error('[2FA] setTwofaPolicy error:', e.message);
        return { success: false, error: e.message };
    }
}

async function adminListStatus(event, actorUserId) {
    try {
        if (!hasPermission(actorUserId, 'impostazioni:view')) {
            return { success: false, error: 'Permesso negato' };
        }
        const db = getDB('auth');
        const users = db.query('SELECT id, username, nome, cognome, totp_enabled, twofa_required FROM users WHERE is_deleted = 0', []);
        const creds = db.query('SELECT user_id, COUNT(*) as cnt FROM webauthn_credentials WHERE is_deleted = 0 GROUP BY user_id', []);
        const credMap = {};
        creds.forEach(c => { credMap[c.user_id] = c.cnt; });
        return {
            success: true,
            users: users.map(u => ({
                id: u.id,
                username: u.username,
                nome: u.nome,
                cognome: u.cognome,
                totpEnabled: !!u.totp_enabled,
                twofaRequired: !!u.twofa_required,
                passkeysCount: credMap[u.id] || 0
            }))
        };
    } catch (e) {
        console.error('[2FA] adminListStatus error:', e.message);
        return { success: false, error: e.message };
    }
}

module.exports = {
    getStatus,
    totpSetupBegin,
    totpSetupConfirm,
    totpDisable,
    totpVerifyCode,
    backupCodeVerify,
    webauthnRegisterBegin,
    webauthnRegisterFinish,
    webauthnRemove,
    webauthnAuthBegin,
    webauthnAuthVerify,
    adminReset,
    setTwofaPolicy,
    adminListStatus
};
