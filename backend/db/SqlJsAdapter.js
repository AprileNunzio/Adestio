const IDatabaseAdapter = require('./IDatabaseAdapter');
const Database = require('better-sqlite3');

class SqlJsAdapter extends IDatabaseAdapter {
    constructor() {
        super();
        this.db = null;
    }

    async connect(config) {
        try {
            if (config && config.buffer) {
                this.db = new Database(config.buffer);
            } else {
                this.db = new Database(':memory:');
            }
            return true;
        } catch (e) {
            console.error('[SqlJsAdapter] connect error:', e);
            return false;
        }
    }

    disconnect() {
        try {
            if (this.db) {
                this.db.close();
                this.db = null;
            }
            return true;
        } catch (e) {
            return false;
        }
    }

    execute(sql, params = []) {
        try {
            if (!this.db) throw new Error('DB_NOT_INITIALIZED');
            this.db.prepare(sql).run(...params);
            return true;
        } catch (e) {
            throw e;
        }
    }

    query(sql, params = []) {
        try {
            if (!this.db) throw new Error('DB_NOT_INITIALIZED');
            const stmt = this.db.prepare(sql);
            const bindParams = Array.isArray(params) ? params : [params];
            return stmt.all(...bindParams);
        } catch (e) {
            throw e;
        }
    }

    exec(sql) {
        if (!this.db) throw new Error('DB_NOT_INITIALIZED');
        return this.db.exec(sql);
    }

    run(sql, params) {
        if (!this.db) throw new Error('DB_NOT_INITIALIZED');
        const bindParams = Array.isArray(params) ? params : [params];
        return this.db.prepare(sql).run(...bindParams);
    }

    prepare(sql) {
        if (!this.db) throw new Error('DB_NOT_INITIALIZED');
        return this.db.prepare(sql);
    }

    runMigrations(migrations) {
        try {
            if (!this.db) throw new Error('DB_NOT_INITIALIZED');
            const versionRes = this.query('PRAGMA user_version;');
            let currentVersion = 0;
            if (versionRes.length > 0) {
                currentVersion = versionRes[0].user_version;
            }
            const pendingMigrations = migrations
                .filter(m => m.version > currentVersion)
                .sort((a, b) => a.version - b.version);
            
            if (pendingMigrations.length > 0) {
                this.exec('BEGIN TRANSACTION;');
                try {
                    let lastVersion = currentVersion;
                    for (const m of pendingMigrations) {
                        this.exec(m.sql);
                        lastVersion = m.version;
                    }
                    this.exec(`PRAGMA user_version = ${lastVersion};`);
                    this.exec('COMMIT;');
                } catch (e) {
                    try { this.exec('ROLLBACK;'); } catch (_) {}
                    throw e;
                }
            }
            return true;
        } catch (e) {
            throw e;
        }
    }

    exportData() {
        try {
            if (!this.db) throw new Error('DB_NOT_INITIALIZED');
            return this.db.serialize();
        } catch (e) {
            throw e;
        }
    }
}

module.exports = SqlJsAdapter;
