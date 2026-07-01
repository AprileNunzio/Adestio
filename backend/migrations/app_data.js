module.exports = [
    {
        version: 1,
        sql: `
            CREATE TABLE IF NOT EXISTS app_info (
                key_name TEXT PRIMARY KEY,
                key_value TEXT NOT NULL
            );
        `
    }
];
