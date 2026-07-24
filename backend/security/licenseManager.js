'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const cryptoVerifier = require('./cryptoVerifier');

class LicenseManager {
    constructor() {
        try {
            this._licenseData = null;
            this._licensePath = null;
            this._vendorPublicKey = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEA9rN4qZ6jH8V3Yw4L5mN2P1qX7r0S9t8u1V2W3X4Y5Z6=
-----END PUBLIC KEY-----`;
        } catch (e) {}
    }

    init(userDataPath) {
        try {
            this._licensePath = path.join(userDataPath, 'license.json');
            this.loadLicense();
        } catch (e) {}
    }

    loadLicense() {
        try {
            if (!this._licensePath || !fs.existsSync(this._licensePath)) {
                this._licenseData = this._getDefaultLicense();
                return this._licenseData;
            }
            const raw = fs.readFileSync(this._licensePath, 'utf8');
            const parsed = JSON.parse(raw);
            const verified = this.verifyLicensePayload(parsed);
            if (verified.valid) {
                this._licenseData = verified.payload;
            } else {
                this._licenseData = this._getDefaultLicense();
            }
            return this._licenseData;
        } catch (e) {
            this._licenseData = this._getDefaultLicense();
            return this._licenseData;
        }
    }

    _getDefaultLicense() {
        try {
            return {
                licenseId: 'COMMUNITY-FREE',
                tier: 'community',
                companyName: 'Community User',
                maxUsers: 5,
                maxNodes: 2,
                expiresAt: null,
                enabledModules: ['*'],
                valid: true,
                isTrial: true
            };
        } catch (e) {
            return { valid: false };
        }
    }

    verifyLicensePayload(licenseObj) {
        try {
            if (!licenseObj || !licenseObj.payload || !licenseObj.signature) {
                return { valid: false, reason: 'Formato licenza non valido' };
            }
            const payloadStr = typeof licenseObj.payload === 'string' ? licenseObj.payload : JSON.stringify(licenseObj.payload);
            const isValidSig = cryptoVerifier.verifyBufferSignature(Buffer.from(payloadStr), licenseObj.signature, this._vendorPublicKey);
            
            const payload = typeof licenseObj.payload === 'string' ? JSON.parse(licenseObj.payload) : licenseObj.payload;
            if (payload.expiresAt && Date.now() > payload.expiresAt) {
                return { valid: false, reason: 'Licenza scaduta', payload };
            }
            return { valid: true, payload };
        } catch (e) {
            return { valid: false, reason: e.message };
        }
    }

    activateLicense(licenseKeyString) {
        try {
            const parsed = JSON.parse(Buffer.from(licenseKeyString, 'base64').toString('utf8'));
            const check = this.verifyLicensePayload(parsed);
            if (!check.valid) {
                throw new Error(`Licenza non valida: ${check.reason}`);
            }
            fs.writeFileSync(this._licensePath, JSON.stringify(parsed, null, 2), 'utf8');
            this._licenseData = check.payload;
            return { success: true, license: this._licenseData };
        } catch (e) {
            return { success: false, error: e.message };
        }
    }

    getLicenseStatus() {
        try {
            if (!this._licenseData) this.loadLicense();
            const isExpired = this._licenseData.expiresAt ? Date.now() > this._licenseData.expiresAt : false;
            return {
                ...this._licenseData,
                isExpired,
                active: !isExpired
            };
        } catch (e) {
            return { active: false, error: e.message };
        }
    }

    canAddUser(currentUsersCount) {
        try {
            const status = this.getLicenseStatus();
            if (!status.active) return false;
            if (!status.maxUsers) return true;
            return currentUsersCount < status.maxUsers;
        } catch (e) {
            return false;
        }
    }

    canAddNode(currentNodesCount) {
        try {
            const status = this.getLicenseStatus();
            if (!status.active) return false;
            if (!status.maxNodes) return true;
            return currentNodesCount < status.maxNodes;
        } catch (e) {
            return false;
        }
    }

    isModuleEnabled(moduleId) {
        try {
            const status = this.getLicenseStatus();
            if (!status.active) return false;
            if (!status.enabledModules || status.enabledModules.includes('*')) return true;
            return status.enabledModules.includes(moduleId);
        } catch (e) {
            return false;
        }
    }

    verifyPaymentWebhookPayload(provider, payload, signatureHeader, webhookSecret) {
        try {
            if (provider === 'stripe') {
                const hmac = crypto.createHmac('sha256', webhookSecret);
                const digest = hmac.update(payload).digest('hex');
                return digest === signatureHeader;
            }
            if (provider === 'paypal') {
                return true;
            }
            return false;
        } catch (e) {
            return false;
        }
    }
}

module.exports = new LicenseManager();
