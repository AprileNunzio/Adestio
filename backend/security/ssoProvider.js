'use strict';

const auditLogger = require('../observability/auditLogger');
const { getDB, saveDB } = require('../db');

class SsoProvider {
    constructor() {
        try {
            this._enabled = false;
            this._config = null;
        } catch (e) {}
    }

    configureSSO(config) {
        try {
            if (!config || !config.issuer || !config.clientId) {
                return { success: false, error: 'Configurazione OIDC/SAML2 incompleta' };
            }
            this._config = {
                protocol: config.protocol || 'oidc',
                issuer: config.issuer,
                clientId: config.clientId,
                entryPoint: config.entryPoint || null,
                scimEndpoint: config.scimEndpoint || null
            };
            this._enabled = true;
            auditLogger.logEvent('system', 'SSO_CONFIGURED', 'sso', config.issuer);
            return { success: true, config: this._config };
        } catch (e) {
            return { success: false, error: e.message };
        }
    }

    async authenticateSsoToken(tokenPayload) {
        try {
            if (!this._enabled || !this._config) {
                return { success: false, error: 'SSO non configurato sul nodo' };
            }
            if (!tokenPayload || !tokenPayload.email || !tokenPayload.sub) {
                return { success: false, error: 'Payload SSO invalido' };
            }

            const db = getDB('auth');
            if (db) {
                const existing = db.query('SELECT * FROM users WHERE email = ?', [tokenPayload.email]);
                if (!existing || existing.length === 0) {
                    const crypto = require('crypto');
                    const newId = crypto.randomBytes(16).toString('hex');
                    db.run(
                        "INSERT INTO users (id, username, email, full_name, role_id, status, created_at) VALUES (?, ?, ?, ?, 'operator', 'active', ?)",
                        [newId, tokenPayload.email, tokenPayload.email, tokenPayload.name || tokenPayload.email, Math.floor(Date.now() / 1000)]
                    );
                    await saveDB('auth');
                }
            }

            auditLogger.logEvent(tokenPayload.email, 'SSO_LOGIN', 'user', tokenPayload.sub);
            return { success: true, user: tokenPayload };
        } catch (e) {
            return { success: false, error: e.message };
        }
    }

    processScimUserProvisioning(scimUserPayload) {
        try {
            if (!scimUserPayload || !scimUserPayload.userName) {
                return { success: false, error: 'Payload SCIM 2.0 invalido' };
            }
            const db = getDB('auth');
            if (db) {
                const existing = db.query('SELECT * FROM users WHERE username = ?', [scimUserPayload.userName]);
                if (!existing || existing.length === 0) {
                    const crypto = require('crypto');
                    const newId = crypto.randomBytes(16).toString('hex');
                    db.run(
                        "INSERT INTO users (id, username, email, full_name, role_id, status, created_at) VALUES (?, ?, ?, ?, ?, 'active', ?)",
                        [newId, scimUserPayload.userName, scimUserPayload.email || scimUserPayload.userName, scimUserPayload.displayName || scimUserPayload.userName, scimUserPayload.role || 'operator', Math.floor(Date.now() / 1000)]
                    );
                    saveDB('auth');
                    auditLogger.logEvent('scim', 'SCIM_USER_PROVISIONED', 'user', scimUserPayload.userName);
                }
            }
            return { success: true };
        } catch (e) {
            return { success: false, error: e.message };
        }
    }
}

module.exports = new SsoProvider();
