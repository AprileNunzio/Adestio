'use strict';

const auditLogger = require('../observability/auditLogger');

class AbacGuard {
    constructor() {
        try {} catch (e) {}
    }

    evaluateContext(userId, appId, permissionId, context = {}) {
        try {
            if (!context) return { allowed: true };

            if (context.timeWindow) {
                const now = new Date();
                const currentMinutes = now.getHours() * 60 + now.getMinutes();
                const [startStr, endStr] = String(context.timeWindow).split('-');
                if (startStr && endStr) {
                    const [sH, sM] = startStr.split(':').map(Number);
                    const [eH, eM] = endStr.split(':').map(Number);
                    const startMin = sH * 60 + (sM || 0);
                    const endMin = eH * 60 + (eM || 0);

                    if (currentMinutes < startMin || currentMinutes > endMin) {
                        auditLogger.logEvent(userId || 'system', 'ABAC_TIME_RESTRICTION', appId, permissionId, { context }, 'WARNING');
                        return { allowed: false, reason: `Accesso negato fuori dalla fascia oraria consentita (${context.timeWindow})` };
                    }
                }
            }

            if (context.allowedIpSubnets && Array.isArray(context.allowedIpSubnets) && context.allowedIpSubnets.length > 0) {
                const clientIp = context.clientIp || '127.0.0.1';
                const match = context.allowedIpSubnets.some(subnet => clientIp.startsWith(subnet) || subnet === '*' || clientIp === '127.0.0.1');
                if (!match) {
                    auditLogger.logEvent(userId || 'system', 'ABAC_IP_RESTRICTION', appId, permissionId, { clientIp }, 'WARNING');
                    return { allowed: false, reason: `Accesso negato dall'IP corrente (${clientIp})` };
                }
            }

            if (context.branchScope && context.targetBranch) {
                if (context.branchScope !== '*' && context.branchScope !== context.targetBranch) {
                    auditLogger.logEvent(userId || 'system', 'ABAC_BRANCH_RESTRICTION', appId, permissionId, { context }, 'WARNING');
                    return { allowed: false, reason: `Accesso non autorizzato per la filiale ${context.targetBranch}` };
                }
            }

            return { allowed: true };
        } catch (e) {
            return { allowed: false, reason: e.message };
        }
    }
}

module.exports = new AbacGuard();
