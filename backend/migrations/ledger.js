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
    },
    {
        version: 2,
        sql: `
            ALTER TABLE event_log ADD COLUMN signature   TEXT    NOT NULL DEFAULT '';
            ALTER TABLE event_log ADD COLUMN received_at  INTEGER NOT NULL DEFAULT 0;
            ALTER TABLE event_log ADD COLUMN validity     TEXT    NOT NULL DEFAULT 'valid';
            ALTER TABLE event_log ADD COLUMN applied_at   INTEGER NOT NULL DEFAULT 0;
            CREATE INDEX IF NOT EXISTS idx_event_log_prefix ON event_log(substr(block_id,1,2));
        `
    },
    {
        version: 3,
        sql: `
            CREATE TABLE IF NOT EXISTS node_keys (
                node_id     TEXT PRIMARY KEY,
                public_key  TEXT NOT NULL,
                first_seen  INTEGER NOT NULL DEFAULT 0,
                last_seen   INTEGER NOT NULL DEFAULT 0
            );
            CREATE TABLE IF NOT EXISTS peer_reputation (
                node_id       TEXT PRIMARY KEY,
                successes     INTEGER NOT NULL DEFAULT 0,
                failures      INTEGER NOT NULL DEFAULT 0,
                latency_sum   INTEGER NOT NULL DEFAULT 0,
                samples       INTEGER NOT NULL DEFAULT 0,
                first_seen    INTEGER NOT NULL DEFAULT 0,
                last_seen     INTEGER NOT NULL DEFAULT 0,
                last_success  INTEGER NOT NULL DEFAULT 0,
                score         REAL    NOT NULL DEFAULT 0.5,
                updated_at    INTEGER NOT NULL DEFAULT 0
            );
            CREATE TABLE IF NOT EXISTS sync_outbox (
                block_id      TEXT PRIMARY KEY,
                created_at    INTEGER NOT NULL,
                attempts      INTEGER NOT NULL DEFAULT 0,
                next_attempt  INTEGER NOT NULL DEFAULT 0,
                acks          TEXT    NOT NULL DEFAULT '[]',
                durable       INTEGER NOT NULL DEFAULT 0
            );
            CREATE INDEX IF NOT EXISTS idx_outbox_pending ON sync_outbox(durable, next_attempt);
            CREATE TABLE IF NOT EXISTS hinted_hints (
                id           TEXT PRIMARY KEY,
                target_node  TEXT NOT NULL,
                block_id     TEXT NOT NULL,
                created_at   INTEGER NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_hints_target ON hinted_hints(target_node);
        `
    }
];
