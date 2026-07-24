'use strict';

const fs = require('fs');
const path = require('path');
const { getDB, saveDB } = require('../db');

class GdprManager {
    constructor() {
        try {
            this._retentionDays = 365 * 5;
        } catch (e) {}
    }

    async eraseSubjectData(personId, tenantId = null) {
        try {
            const results = { erasedFromCore: [], erasedFromApps: [], success: true };
            const dbAnagrafica = getDB('anagrafica');
            
            if (dbAnagrafica) {
                const tables = [
                    'anagrafica_contatti', 'anagrafica_dati_bancari', 'anagrafica_documenti',
                    'anagrafica_familiari', 'anagrafica_lavoro', 'anagrafica_residenza',
                    'anagrafica_riferimenti', 'anagrafica_titoli_studio'
                ];
                
                tables.forEach(table => {
                    try {
                        let query = `DELETE FROM ${table} WHERE persona_id = ?`;
                        let params = [personId];
                        if (tenantId) {
                            query += ` AND tenant_id = ?`;
                            params.push(tenantId);
                        }
                        dbAnagrafica.run(query, params);
                        results.erasedFromCore.push(table);
                    } catch (e1) {}
                });

                let pQuery = `DELETE FROM anagrafica_persone WHERE id = ?`;
                let pParams = [personId];
                if (tenantId) {
                    pQuery += ` AND tenant_id = ?`;
                    pParams.push(tenantId);
                }
                dbAnagrafica.run(pQuery, pParams);
                results.erasedFromCore.push('anagrafica_persone');
                await saveDB('anagrafica');
            }

            try {
                const capabilityBroker = require('./capabilityBroker');
                const registeredApps = Array.from(capabilityBroker.registeredHandlers.keys());
                for (const appId of registeredApps) {
                    try {
                        await capabilityBroker.routeIpcCall('core:gdpr', appId, 'gdpr:erase-subject', { personId, tenantId });
                        results.erasedFromApps.push(appId);
                    } catch (eApp) {}
                }
            } catch (eBroker) {}

            return results;
        } catch (e) {
            return { success: false, error: e.message };
        }
    }

    exportSubjectData(personId, tenantId = null) {
        try {
            const exportData = { personId, exportedAt: new Date().toISOString(), data: {} };
            const dbAnagrafica = getDB('anagrafica');
            
            if (dbAnagrafica) {
                let pQuery = `SELECT * FROM anagrafica_persone WHERE id = ?`;
                let pParams = [personId];
                if (tenantId) {
                    pQuery += ` AND tenant_id = ?`;
                    pParams.push(tenantId);
                }
                exportData.data.persona = dbAnagrafica.query(pQuery, pParams);

                const tables = [
                    'anagrafica_contatti', 'anagrafica_dati_bancari', 'anagrafica_documenti',
                    'anagrafica_familiari', 'anagrafica_lavoro', 'anagrafica_residenza',
                    'anagrafica_riferimenti', 'anagrafica_titoli_studio'
                ];

                tables.forEach(table => {
                    try {
                        let query = `SELECT * FROM ${table} WHERE persona_id = ?`;
                        let params = [personId];
                        if (tenantId) {
                            query += ` AND tenant_id = ?`;
                            params.push(tenantId);
                        }
                        exportData.data[table] = dbAnagrafica.query(query, params);
                    } catch (e1) {}
                });
            }
            return exportData;
        } catch (e) {
            return { error: e.message };
        }
    }

    applyRetentionPolicy(customRetentionDays = null) {
        try {
            const days = customRetentionDays || this._retentionDays;
            const cutoffTimestamp = Math.floor((Date.now() - (days * 24 * 60 * 60 * 1000)) / 1000);
            const auditDb = getDB('audit');
            if (auditDb) {
                auditDb.run(`DELETE FROM audit_log WHERE timestamp < ?`, [cutoffTimestamp]);
                saveDB('audit');
            }
            return { success: true, cutoffTimestamp };
        } catch (e) {
            return { success: false, error: e.message };
        }
    }
}

module.exports = new GdprManager();
