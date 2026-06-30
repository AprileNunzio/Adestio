const IDatabaseAdapter = require('./IDatabaseAdapter');
const initSqlJs = require('sql.js');

class SqlJsAdapter extends IDatabaseAdapter {
    constructor() {
        super();
        this.db = null;
    }

    async connect(config) {
        try {
            const SQL = await initSqlJs();
            if (config && config.buffer) {
                this.db = new SQL.Database(config.buffer);
            } else {
                this.db = new SQL.Database();
            }
            return true;
        } catch (e) {
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
            this.db.run(sql, params);
            return true;
        } catch (e) {
            throw e;
        }
    }

    query(sql, params = []) {
        try {
            if (!this.db) throw new Error('DB_NOT_INITIALIZED');
            const stmt = this.db.prepare(sql);
            if (params.length > 0) stmt.bind(params);
            const rows = [];
            while (stmt.step()) {
                rows.push(stmt.getAsObject());
            }
            stmt.free();
            return rows;
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
        return this.db.run(sql, params);
    }

    prepare(sql) {
        if (!this.db) throw new Error('DB_NOT_INITIALIZED');
        return this.db.prepare(sql);
    }

    runMigrations(migrations) {
        try {
            if (!this.db) throw new Error('DB_NOT_INITIALIZED');
            const versionRes = this.exec('PRAGMA user_version;');
            let currentVersion = 0;
            if (versionRes.length > 0 && versionRes[0].values.length > 0) {
                currentVersion = versionRes[0].values[0][0];
            }

            const pendingMigrations = migrations
                .filter(m => m.version > currentVersion)
                .sort((a, b) => a.version - b.version);

            if (pendingMigrations.length > 0) {
                this.execute('BEGIN TRANSACTION;');
                try {
                    let lastVersion = currentVersion;
                    for (const m of pendingMigrations) {
                        this.execute(m.sql);
                        lastVersion = m.version;
                    }
                    this.execute(`PRAGMA user_version = ${lastVersion};`);
                    this.execute('COMMIT;');
                } catch (e) {
                    try { this.execute('ROLLBACK;'); } catch (_) {}
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
            const data = this.db.export();
            return Buffer.from(data);
        } catch (e) {
            throw e;
        }
    }
}
module.exports = SqlJsAdapter;
