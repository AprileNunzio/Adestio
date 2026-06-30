const migrations = [
    {
        version: 1,
        sql: `
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                passkey TEXT NOT NULL
            );
        `
    },
    {
        version: 2,
        sql: `
            CREATE TABLE IF NOT EXISTS users_new (
                id TEXT PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                passkey TEXT NOT NULL,
                last_modified INTEGER NOT NULL,
                is_deleted INTEGER DEFAULT 0
            );

            INSERT INTO users_new (id, username, password, passkey, last_modified, is_deleted)
            SELECT 
                lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-a' || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6))), 
                username, password, passkey, 
                CAST(strftime('%s','now') AS INTEGER), 0
            FROM users;

            DROP TABLE users;
            ALTER TABLE users_new RENAME TO users;
        `
    },
    {
        version: 3,
        sql: `
            ALTER TABLE users ADD COLUMN email TEXT DEFAULT '';
        `
    },
    {
        version: 4,
        sql: `
            ALTER TABLE users ADD COLUMN pin TEXT DEFAULT '';
        `
    },
    {
        version: 5,
        sql: `
            CREATE TABLE IF NOT EXISTS network_config (
                key_name TEXT PRIMARY KEY,
                key_value TEXT NOT NULL
            );
        `
    },
    {
        version: 6,
        sql: `
            CREATE TABLE IF NOT EXISTS roles (
                id TEXT PRIMARY KEY,
                name TEXT UNIQUE NOT NULL,
                description TEXT
            );

            CREATE TABLE IF NOT EXISTS permissions (
                id TEXT PRIMARY KEY,
                name TEXT UNIQUE NOT NULL,
                description TEXT
            );

            CREATE TABLE IF NOT EXISTS role_permissions (
                role_id TEXT,
                permission_id TEXT,
                PRIMARY KEY(role_id, permission_id),
                FOREIGN KEY(role_id) REFERENCES roles(id) ON DELETE CASCADE,
                FOREIGN KEY(permission_id) REFERENCES permissions(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS groups (
                id TEXT PRIMARY KEY,
                name TEXT UNIQUE NOT NULL,
                description TEXT
            );

            CREATE TABLE IF NOT EXISTS user_groups (
                user_id TEXT,
                group_id TEXT,
                PRIMARY KEY(user_id, group_id),
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY(group_id) REFERENCES groups(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS user_roles (
                user_id TEXT,
                role_id TEXT,
                PRIMARY KEY(user_id, role_id),
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY(role_id) REFERENCES roles(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS group_roles (
                group_id TEXT,
                role_id TEXT,
                PRIMARY KEY(group_id, role_id),
                FOREIGN KEY(group_id) REFERENCES groups(id) ON DELETE CASCADE,
                FOREIGN KEY(role_id) REFERENCES roles(id) ON DELETE CASCADE
            );
        `
    },
    {
        version: 7,
        sql: `
            ALTER TABLE roles ADD COLUMN last_modified INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER));
            ALTER TABLE roles ADD COLUMN is_deleted INTEGER DEFAULT 0;

            ALTER TABLE permissions ADD COLUMN last_modified INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER));
            ALTER TABLE permissions ADD COLUMN is_deleted INTEGER DEFAULT 0;

            ALTER TABLE role_permissions ADD COLUMN last_modified INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER));
            ALTER TABLE role_permissions ADD COLUMN is_deleted INTEGER DEFAULT 0;

            ALTER TABLE groups ADD COLUMN last_modified INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER));
            ALTER TABLE groups ADD COLUMN is_deleted INTEGER DEFAULT 0;

            ALTER TABLE user_groups ADD COLUMN last_modified INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER));
            ALTER TABLE user_groups ADD COLUMN is_deleted INTEGER DEFAULT 0;

            ALTER TABLE user_roles ADD COLUMN last_modified INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER));
            ALTER TABLE user_roles ADD COLUMN is_deleted INTEGER DEFAULT 0;

            ALTER TABLE group_roles ADD COLUMN last_modified INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER));
            ALTER TABLE group_roles ADD COLUMN is_deleted INTEGER DEFAULT 0;
        `
    },
    {
        version: 8,
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
        `
    },
    {
        version: 9,
        sql: `
            CREATE TABLE IF NOT EXISTS dag_tips (
                block_id TEXT PRIMARY KEY
            );

            INSERT OR IGNORE INTO dag_tips (block_id) VALUES ('GENESIS');
        `
    },
    {
        version: 10,
        sql: `
            CREATE TABLE IF NOT EXISTS node_registry (
                node_id          TEXT PRIMARY KEY,
                protocol_version INTEGER NOT NULL DEFAULT 0,
                app_version      TEXT NOT NULL DEFAULT '0.0.0',
                last_seen        INTEGER NOT NULL DEFAULT 0
            );
        `
    },
    {
        version: 11,
        sql: `
            ALTER TABLE users ADD COLUMN must_change_password INTEGER DEFAULT 0;
        `
    },
    {
        version: 12,
        sql: `
            CREATE TABLE IF NOT EXISTS group_permissions (
                group_id TEXT,
                permission_id TEXT,
                last_modified INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER)),
                is_deleted INTEGER DEFAULT 0,
                PRIMARY KEY(group_id, permission_id),
                FOREIGN KEY(group_id) REFERENCES groups(id) ON DELETE CASCADE,
                FOREIGN KEY(permission_id) REFERENCES permissions(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS user_permissions (
                user_id TEXT,
                permission_id TEXT,
                last_modified INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER)),
                is_deleted INTEGER DEFAULT 0,
                PRIMARY KEY(user_id, permission_id),
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY(permission_id) REFERENCES permissions(id) ON DELETE CASCADE
            );
        `
    },
    {
        version: 13,
        sql: `
            ALTER TABLE users ADD COLUMN is_superadmin INTEGER DEFAULT 0;
        `
    },
    {
        version: 14,
        sql: `
            ALTER TABLE groups ADD COLUMN is_superadmin INTEGER DEFAULT 0;
        `
    },
    {
        version: 15,
        sql: `
            ALTER TABLE users ADD COLUMN nome TEXT DEFAULT '';
            ALTER TABLE users ADD COLUMN cognome TEXT DEFAULT '';
        `
    }
];

module.exports = migrations;
