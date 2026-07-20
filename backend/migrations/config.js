module.exports = [
    {
        version: 1,
        sql: `
            CREATE TABLE IF NOT EXISTS network_config (
                key_name TEXT PRIMARY KEY,
                key_value TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS node_registry (
                node_id          TEXT PRIMARY KEY,
                protocol_version INTEGER NOT NULL DEFAULT 0,
                app_version      TEXT NOT NULL DEFAULT '0.0.0',
                last_seen        INTEGER NOT NULL DEFAULT 0
            );
        `
    },
    {
        version: 2,
        sql: `
            CREATE TABLE IF NOT EXISTS known_peers (
                ip               TEXT PRIMARY KEY,
                port             INTEGER NOT NULL DEFAULT 34567,
                name             TEXT NOT NULL DEFAULT 'Adestio Node',
                node_id          TEXT,
                protocol_version INTEGER NOT NULL DEFAULT 0,
                last_seen        INTEGER NOT NULL DEFAULT 0,
                success_count    INTEGER NOT NULL DEFAULT 0,
                failure_count    INTEGER NOT NULL DEFAULT 0
            );
        `
    }
];
