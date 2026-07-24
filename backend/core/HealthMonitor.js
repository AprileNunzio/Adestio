'use strict';

const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const licenseManager = require('../security/licenseManager');

class HealthMonitor {
    constructor() {
        try {
            this._lastReport = null;
        } catch (e) {}
    }

    getSystemHealth() {
        try {
            const userData = app.getPath('userData');
            const dbDir = path.join(userData, 'db');
            let totalDbSizeBytes = 0;

            if (fs.existsSync(dbDir)) {
                const files = fs.readdirSync(dbDir);
                for (const f of files) {
                    try {
                        const stat = fs.statSync(path.join(dbDir, f));
                        totalDbSizeBytes += stat.size;
                    } catch (eFile) {}
                }
            }

            const license = licenseManager.getLicenseStatus();
            const memoryUsage = process.memoryUsage();

            const health = {
                timestamp: new Date().toISOString(),
                status: 'HEALTHY',
                warnings: [],
                metrics: {
                    dbTotalSizeBytes: totalDbSizeBytes,
                    dbTotalSizeMB: (totalDbSizeBytes / (1024 * 1024)).toFixed(2),
                    processRssMB: (memoryUsage.rss / (1024 * 1024)).toFixed(2),
                    heapUsedMB: (memoryUsage.heapUsed / (1024 * 1024)).toFixed(2),
                    license: {
                        active: license.active,
                        tier: license.tier,
                        isExpired: license.isExpired,
                        expiresAt: license.expiresAt
                    }
                }
            };

            if (license.isExpired) {
                health.status = 'WARNING';
                health.warnings.push('La licenza aziendale è scaduta');
            }

            if (totalDbSizeBytes > 500 * 1024 * 1024) {
                health.status = 'WARNING';
                health.warnings.push('La dimensione del database supera 500 MB');
            }

            this._lastReport = health;
            return health;
        } catch (e) {
            return { status: 'ERROR', error: e.message };
        }
    }
}

module.exports = new HealthMonitor();
