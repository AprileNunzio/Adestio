module.exports = [
    {
        version: 1,
        sql: `
            CREATE TABLE IF NOT EXISTS azienda_sedi (
                id TEXT PRIMARY KEY,
                nome TEXT NOT NULL,
                indirizzo TEXT,
                cap TEXT,
                citta TEXT,
                provincia TEXT,
                nazione TEXT,
                telefono TEXT,
                email TEXT,
                orari TEXT,
                is_centrale INTEGER DEFAULT 0,
                responsabile_persona_id TEXT
            );
        `
    }
];
