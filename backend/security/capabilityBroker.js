'use strict';

const crypto = require('crypto');
const appMetrics = require('../observability/appMetrics');
const auditLogger = require('../observability/auditLogger');

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

class CapabilityBroker {
    constructor() {
        try {
            this.appTokens = new Map();
            this.registeredHandlers = new Map();
            this._startGarbageCollector();
        } catch (error) {}
    }

    _startGarbageCollector() {
        try {
            setInterval(() => {
                try {
                    const now = Date.now();
                    this.appTokens.forEach((info, appId) => {
                        if (info.expiresAt && now > info.expiresAt) {
                            this.revokeAppToken(appId);
                        }
                    });
                } catch (e) {}
            }, 60 * 60 * 1000);
        } catch (e) {}
    }

    generateAppToken(appId, permissions) {
        try {
            const secret = crypto.randomBytes(32).toString('hex');
            const tokenInfo = {
                appId: appId,
                secret: secret,
                permissions: new Set(permissions || []),
                createdAt: Date.now(),
                expiresAt: Date.now() + TOKEN_TTL_MS
            };
            this.appTokens.set(appId, tokenInfo);
            return secret;
        } catch (error) {
            return null;
        }
    }

    revokeAppToken(appId) {
        try {
            this.appTokens.delete(appId);
            this.registeredHandlers.delete(appId);
        } catch (error) {}
    }

    verifyCapability(appId, requiredPermission) {
        try {
            if (!this.appTokens.has(appId)) return false;
            const tokenInfo = this.appTokens.get(appId);
            if (!tokenInfo || !tokenInfo.permissions) return false;
            if (tokenInfo.expiresAt && Date.now() > tokenInfo.expiresAt) {
                this.revokeAppToken(appId);
                return false;
            }
            return tokenInfo.permissions.has(requiredPermission) || tokenInfo.permissions.has('*');
        } catch (error) {
            return false;
        }
    }

    registerApiHandler(appId, action, handlerFn) {
        try {
            if (!this.registeredHandlers.has(appId)) {
                this.registeredHandlers.set(appId, new Map());
            }
            const appMap = this.registeredHandlers.get(appId);
            appMap.set(action, handlerFn);
            return true;
        } catch (error) {
            return false;
        }
    }

    async routeIpcCall(sourceAppId, targetAppId, action, payload) {
        const start = Date.now();
        try {
            if (sourceAppId !== 'core' && sourceAppId !== 'core:gdpr' && !this.appTokens.has(sourceAppId)) {
                auditLogger.logEvent(sourceAppId, 'UNAUTHORIZED_IPC', 'app', targetAppId, { action }, 'FAILURE');
                throw new Error(`Non autorizzato: sorgente ${sourceAppId} non valida`);
            }
            if (!this.registeredHandlers.has(targetAppId)) {
                throw new Error(`Target non registrato: ${targetAppId}`);
            }
            const targetMap = this.registeredHandlers.get(targetAppId);
            if (!targetMap.has(action)) {
                throw new Error(`Azione non trovata su target ${targetAppId}: ${action}`);
            }

            const handler = targetMap.get(action);
            if (typeof handler !== 'function') {
                throw new Error(`Handler non valido per azione ${action}`);
            }

            const result = await Promise.resolve(handler(sourceAppId, payload));
            appMetrics.recordIpcInvocation(targetAppId, action, Date.now() - start, true);
            return result;
        } catch (error) {
            appMetrics.recordIpcInvocation(targetAppId, action, Date.now() - start, false, error.message);
            throw error;
        }
    }
}

module.exports = new CapabilityBroker();
