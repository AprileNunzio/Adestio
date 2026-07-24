'use strict';

module.exports = [
    {
        version: 1,
        up: function(db) {
            try {
                db.run(`
                    CREATE TABLE IF NOT EXISTS audit_log (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        timestamp INTEGER NOT NULL,
                        actor_id TEXT NOT NULL,
                        action TEXT NOT NULL,
                        target_type TEXT NOT NULL,
                        target_id TEXT,
                        details TEXT,
                        ip_address TEXT,
                        result TEXT NOT NULL
                    );
                    CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_log(timestamp);
                    CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_log(actor_id);
                    CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log(action);
                `);
            } catch (e) {}
        }
    }
];
