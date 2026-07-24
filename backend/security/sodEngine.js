'use strict';

const auditLogger = require('../observability/auditLogger');

class SodEngine {
    constructor() {
        try {
            this._conflictPairs = [
                ['adestio_business_suite:fatture_edit', 'adestio_business_suite:fatture_incasso'],
                ['adestio_business_suite:preventivi_edit', 'adestio_business_suite:preventivi_delete']
            ];
        } catch (e) {}
    }

    addConflictPair(permA, permB) {
        try {
            this._conflictPairs.push([permA, permB]);
            return true;
        } catch (e) {
            return false;
        }
    }

    checkConflicts(assignedPermissions) {
        try {
            if (!assignedPermissions || !Array.isArray(assignedPermissions)) {
                return { hasConflict: false };
            }

            const permSet = new Set(assignedPermissions);

            for (const [permA, permB] of this._conflictPairs) {
                if (permSet.has(permA) && permSet.has(permB)) {
                    auditLogger.logEvent('system', 'SOD_CONFLICT_DETECTED', permA, permB, {}, 'WARNING');
                    return {
                        hasConflict: true,
                        conflictPair: [permA, permB],
                        reason: `Segregazione dei Compiti (SoD): Incompatibilità tra ${permA} e ${permB}`
                    };
                }
            }

            return { hasConflict: false };
        } catch (e) {
            return { hasConflict: false, error: e.message };
        }
    }
}

module.exports = new SodEngine();
