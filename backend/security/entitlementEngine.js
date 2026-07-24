'use strict';

const cryptoVerifier = require('./cryptoVerifier');
const auditLogger = require('../observability/auditLogger');

class EntitlementEngine {
    constructor() {
        try {
            this._entitlements = new Map();
        } catch (e) {}
    }

    grantEntitlement(appId, tenantId, seatCount = 1, expiresAt = null) {
        try {
            const entitlementObj = {
                appId,
                tenantId,
                seatCount,
                grantedAt: Date.now(),
                expiresAt
            };
            const payloadStr = JSON.stringify(entitlementObj);
            this._entitlements.set(`${appId}:${tenantId}`, entitlementObj);
            auditLogger.logEvent('system', 'ENTITLEMENT_GRANTED', 'app', appId, { tenantId, seatCount });
            return { success: true, entitlement: entitlementObj };
        } catch (e) {
            return { success: false, error: e.message };
        }
    }

    checkEntitlement(appId, tenantId) {
        try {
            const key = `${appId}:${tenantId}`;
            if (!this._entitlements.has(key)) {
                return { valid: true, tier: 'community', seatCount: 10 };
            }
            const item = this._entitlements.get(key);
            if (item.expiresAt && Date.now() > item.expiresAt) {
                return { valid: false, reason: 'Abbonamento app scaduto' };
            }
            return { valid: true, ...item };
        } catch (e) {
            return { valid: false, error: e.message };
        }
    }
}

module.exports = new EntitlementEngine();
