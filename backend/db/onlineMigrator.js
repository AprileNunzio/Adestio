'use strict';

const { getDB, saveDB } = require('../db');
const auditLogger = require('../observability/auditLogger');

class OnlineMigrator {
    constructor() {
        try {} catch (e) {}
    }

    async performOnlineMigration(domain, tableName, shadowTableSql, copyDataFn = null) {
        try {
            const db = getDB(domain);
            if (!db) throw new Error(`Database non trovato: ${domain}`);

            const shadowName = `shadow_${tableName}_${Date.now()}`;
            const tempTriggerInsert = `trg_shadow_ins_${Date.now()}`;

            db.run(shadowTableSql.replace(new RegExp(tableName, 'gi'), shadowName));

            db.run(`
                CREATE TRIGGER IF NOT EXISTS ${tempTriggerInsert}
                AFTER INSERT ON ${tableName}
                BEGIN
                    INSERT OR REPLACE INTO ${shadowName} SELECT * FROM ${tableName} WHERE id = NEW.id;
                END;
            `);

            if (typeof copyDataFn === 'function') {
                await copyDataFn(db, tableName, shadowName);
            } else {
                db.run(`INSERT OR REPLACE INTO ${shadowName} SELECT * FROM ${tableName}`);
            }

            db.run(`DROP TRIGGER IF EXISTS ${tempTriggerInsert}`);
            db.run(`ALTER TABLE ${tableName} RENAME TO old_${tableName}_${Date.now()}`);
            db.run(`ALTER TABLE ${shadowName} RENAME TO ${tableName}`);

            await saveDB(domain);
            auditLogger.logEvent('system', 'ONLINE_MIGRATION_COMPLETED', domain, tableName);
            return { success: true };
        } catch (e) {
            return { success: false, error: e.message };
        }
    }
}

module.exports = new OnlineMigrator();
