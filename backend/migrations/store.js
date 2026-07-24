module.exports = [
    {
        version: 1,
        sql: `
            CREATE TABLE IF NOT EXISTS installed_apps (
                app_id       TEXT PRIMARY KEY,
                version      TEXT NOT NULL,
                installed_at INTEGER NOT NULL,
                installed_by TEXT,
                status       TEXT NOT NULL DEFAULT 'active'
            );
            CREATE TABLE IF NOT EXISTS app_dependencies (
                app_id     TEXT NOT NULL,
                depends_on TEXT NOT NULL,
                PRIMARY KEY (app_id, depends_on)
            );
            CREATE TABLE IF NOT EXISTS app_install_log (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                app_id        TEXT NOT NULL,
                action        TEXT NOT NULL,
                version       TEXT,
                actor_user_id TEXT,
                timestamp     INTEGER NOT NULL,
                success       INTEGER NOT NULL DEFAULT 1,
                error         TEXT
            );
        `
    },
    {
        version: 2,
        sql: `
            CREATE TABLE IF NOT EXISTS custom_repositories (
                id           TEXT PRIMARY KEY,
                label        TEXT NOT NULL,
                type         TEXT NOT NULL,
                url          TEXT NOT NULL,
                added_at     INTEGER NOT NULL,
                added_by     TEXT,
                enabled      INTEGER NOT NULL DEFAULT 1,
                last_checked INTEGER,
                last_status  TEXT,
                last_error   TEXT
            );
        `
    }
];
