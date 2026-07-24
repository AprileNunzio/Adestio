'use strict';

const licenseManager = require('../security/licenseManager');
const auditLogger = require('../observability/auditLogger');

function getLicenseStatus() {
    try {
        return { success: true, data: licenseManager.getLicenseStatus() };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

function activateLicense(payload) {
    try {
        if (!payload || !payload.licenseKey) {
            return { success: false, error: 'License key assente' };
        }
        const res = licenseManager.activateLicense(payload.licenseKey);
        if (res.success) {
            auditLogger.logEvent(payload.userId || 'admin', 'LICENSE_ACTIVATION', 'license', res.license.licenseId, { tier: res.license.tier });
        }
        return res;
    } catch (e) {
        return { success: false, error: e.message };
    }
}

module.exports = {
    getLicenseStatus,
    activateLicense
};
