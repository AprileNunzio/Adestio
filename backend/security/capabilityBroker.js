'use strict';

const crypto = require('crypto');

class CapabilityBroker {
    constructor() {
        try {
            this.appTokens = new Map();
            this.registeredHandlers = new Map();
        } catch (error) {
            console.error('[CapabilityBroker constructor Error]', error);
        }
    }

    generateAppToken(appId, permissions) {
        try {
            const secret = crypto.randomBytes(32).toString('hex');
            const tokenInfo = {
                appId: appId,
                secret: secret,
                permissions: new Set(permissions || []),
                createdAt: Date.now()
            };
            this.appTokens.set(appId, tokenInfo);
            return secret;
        } catch (error) {
            console.error(`[CapabilityBroker generateAppToken Error: ${appId}]`, error);
            return null;
        }
    }

    revokeAppToken(appId) {
        try {
            this.appTokens.delete(appId);
            this.registeredHandlers.delete(appId);
        } catch (error) {
            console.error(`[CapabilityBroker revokeAppToken Error: ${appId}]`, error);
        }
    }

    verifyCapability(appId, requiredPermission) {
        try {
            if (!this.appTokens.has(appId)) return false;
            const tokenInfo = this.appTokens.get(appId);
            if (!tokenInfo || !tokenInfo.permissions) return false;
            return tokenInfo.permissions.has(requiredPermission) || tokenInfo.permissions.has('*');
        } catch (error) {
            console.error(`[CapabilityBroker verifyCapability Error: ${appId}]`, error);
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
            console.error(`[CapabilityBroker registerApiHandler Error: ${appId}]`, error);
            return false;
        }
    }

    async routeIpcCall(sourceAppId, targetAppId, action, payload) {
        try {
            if (!this.appTokens.has(sourceAppId)) {
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
                throw new Error(`Handler non valido per aziona ${action}`);
            }

            const result = await Promise.resolve(handler(sourceAppId, payload));
            return result;
        } catch (error) {
            console.error(`[CapabilityBroker routeIpcCall Error ${sourceAppId} -> ${targetAppId}]`, error);
            throw error;
        }
    }
}

module.exports = new CapabilityBroker();
