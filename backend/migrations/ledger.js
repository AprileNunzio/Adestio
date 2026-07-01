module.exports = [
    {
        version: 1,
        sql: `
            CREATE TABLE IF NOT EXISTS event_log (
                block_id         TEXT PRIMARY KEY,
                parent_ids       TEXT NOT NULL,
                event_type       TEXT NOT NULL,
                table_name       TEXT NOT NULL,
                record_id        TEXT NOT NULL,
                payload          TEXT NOT NULL,
                node_id          TEXT NOT NULL,
                created_at       INTEGER NOT NULL,
                payload_version  INTEGER NOT NULL DEFAULT 1,
                is_applied       INTEGER NOT NULL DEFAULT 0
            );
            CREATE INDEX IF NOT EXISTS idx_event_log_created ON event_log(created_at);
            CREATE INDEX IF NOT EXISTS idx_event_log_applied ON event_log(is_applied);
            CREATE INDEX IF NOT EXISTS idx_event_log_table   ON event_log(table_name);
            CREATE INDEX IF NOT EXISTS idx_event_log_record  ON event_log(table_name, record_id);
            CREATE TABLE IF NOT EXISTS dag_tips (
                block_id TEXT PRIMARY KEY
            );
            INSERT OR IGNORE INTO dag_tips (block_id) VALUES ('GENESIS');
        `
    }
];
