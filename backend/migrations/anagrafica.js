// Dominio app_anagrafica.enc — dati personali (persone + entità collegate).
// Schema finale equivalente al risultato cumulativo delle migrazioni auth.js
// v5, v6, v11, v12, v13, v14, v15, prima che quelle tabelle venissero spostate
// qui fuori dal dominio auth/core (vedi auth.js v16 che le droppa).
module.exports = [
    {
        version: 1,
        sql: `
            CREATE TABLE IF NOT EXISTS persone (
                id TEXT PRIMARY KEY,
                codice_fiscale TEXT DEFAULT '',
                nome TEXT NOT NULL DEFAULT '',
                cognome TEXT NOT NULL DEFAULT '',
                sesso TEXT DEFAULT '',
                data_nascita TEXT DEFAULT '',
                luogo_nascita TEXT DEFAULT '',
                provincia_nascita TEXT DEFAULT '',
                cittadinanza TEXT DEFAULT '',
                stato_civile TEXT DEFAULT '',
                email_principale TEXT DEFAULT '',
                telefono_principale TEXT DEFAULT '',
                foto_path TEXT DEFAULT '',
                note TEXT DEFAULT '',
                created_at INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER)),
                last_modified INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER)),
                is_deleted INTEGER DEFAULT 0,
                user_id TEXT DEFAULT '',
                cap_nascita TEXT DEFAULT '',
                posizione_militare TEXT DEFAULT '',
                comune_iscrizione_elettorale TEXT DEFAULT ''
            );
            CREATE UNIQUE INDEX IF NOT EXISTS idx_persone_codice_fiscale ON persone(codice_fiscale) WHERE codice_fiscale != '' AND is_deleted = 0;
            CREATE INDEX IF NOT EXISTS idx_persone_cognome_nome ON persone(cognome, nome);
            CREATE UNIQUE INDEX IF NOT EXISTS idx_persone_user_id ON persone(user_id) WHERE user_id != '' AND is_deleted = 0;

            CREATE TABLE IF NOT EXISTS documenti_identita (
                id TEXT PRIMARY KEY,
                persona_id TEXT NOT NULL,
                tipo TEXT NOT NULL DEFAULT 'carta_identita',
                numero TEXT DEFAULT '',
                ente_rilascio TEXT DEFAULT '',
                data_rilascio TEXT DEFAULT '',
                data_scadenza TEXT DEFAULT '',
                file_path TEXT DEFAULT '',
                note TEXT DEFAULT '',
                last_modified INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER)),
                is_deleted INTEGER DEFAULT 0,
                FOREIGN KEY(persona_id) REFERENCES persone(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS idx_documenti_persona ON documenti_identita(persona_id);

            CREATE TABLE IF NOT EXISTS indirizzi (
                id TEXT PRIMARY KEY,
                persona_id TEXT NOT NULL,
                tipo TEXT NOT NULL DEFAULT 'residenza',
                via TEXT DEFAULT '',
                civico TEXT DEFAULT '',
                cap TEXT DEFAULT '',
                comune TEXT DEFAULT '',
                provincia TEXT DEFAULT '',
                stato TEXT DEFAULT 'Italia',
                data_inizio TEXT DEFAULT '',
                data_fine TEXT DEFAULT '',
                is_corrente INTEGER DEFAULT 1,
                note TEXT DEFAULT '',
                last_modified INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER)),
                is_deleted INTEGER DEFAULT 0,
                FOREIGN KEY(persona_id) REFERENCES persone(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS idx_indirizzi_persona ON indirizzi(persona_id);

            CREATE TABLE IF NOT EXISTS rapporti_lavoro (
                id TEXT PRIMARY KEY,
                persona_id TEXT NOT NULL,
                datore_lavoro TEXT DEFAULT '',
                mansione TEXT DEFAULT '',
                tipo_contratto TEXT DEFAULT '',
                sede_lavoro TEXT DEFAULT '',
                data_inizio TEXT DEFAULT '',
                data_fine TEXT DEFAULT '',
                is_corrente INTEGER DEFAULT 1,
                note TEXT DEFAULT '',
                last_modified INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER)),
                is_deleted INTEGER DEFAULT 0,
                categoria_personale TEXT DEFAULT '',
                profilo_professionale TEXT DEFAULT '',
                ruolo TEXT DEFAULT '',
                ore_settimanali TEXT DEFAULT '',
                tipo_rapporto TEXT DEFAULT '',
                data_stipula TEXT DEFAULT '',
                anno_scolastico_inizio TEXT DEFAULT '',
                anno_scolastico_fine TEXT DEFAULT '',
                corso_sicurezza TEXT DEFAULT '',
                FOREIGN KEY(persona_id) REFERENCES persone(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS idx_rapporti_lavoro_persona ON rapporti_lavoro(persona_id);

            CREATE TABLE IF NOT EXISTS contatti (
                id TEXT PRIMARY KEY,
                persona_id TEXT NOT NULL,
                categoria TEXT NOT NULL,
                tipo TEXT NOT NULL,
                valore TEXT NOT NULL,
                is_principale INTEGER DEFAULT 0,
                note TEXT DEFAULT '',
                last_modified INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER)),
                is_deleted INTEGER DEFAULT 0,
                FOREIGN KEY(persona_id) REFERENCES persone(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS idx_contatti_persona_id ON contatti(persona_id);

            CREATE TABLE IF NOT EXISTS familiari (
                id TEXT PRIMARY KEY,
                persona_id TEXT NOT NULL,
                nome TEXT NOT NULL,
                cognome TEXT NOT NULL,
                codice_fiscale TEXT,
                sesso TEXT,
                data_nascita TEXT,
                grado_parentela TEXT NOT NULL,
                is_a_carico INTEGER DEFAULT 0,
                note TEXT DEFAULT '',
                last_modified INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER)),
                is_deleted INTEGER DEFAULT 0,
                FOREIGN KEY(persona_id) REFERENCES persone(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS idx_familiari_persona_id ON familiari(persona_id);

            CREATE TABLE IF NOT EXISTS titoli_studio (
                id TEXT PRIMARY KEY,
                persona_id TEXT NOT NULL,
                tipo TEXT DEFAULT '',
                denominazione TEXT DEFAULT '',
                istituto_rilascio TEXT DEFAULT '',
                citta_istituto TEXT DEFAULT '',
                data_conseguimento TEXT DEFAULT '',
                votazione TEXT DEFAULT '',
                is_principale INTEGER DEFAULT 0,
                note TEXT DEFAULT '',
                last_modified INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER)),
                is_deleted INTEGER DEFAULT 0,
                FOREIGN KEY(persona_id) REFERENCES persone(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS idx_titoli_studio_persona_id ON titoli_studio(persona_id);

            CREATE TABLE IF NOT EXISTS dati_bancari (
                id TEXT PRIMARY KEY,
                persona_id TEXT NOT NULL,
                iban TEXT DEFAULT '',
                banca TEXT DEFAULT '',
                intestatario TEXT DEFAULT '',
                is_principale INTEGER DEFAULT 0,
                note TEXT DEFAULT '',
                last_modified INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER)),
                is_deleted INTEGER DEFAULT 0,
                FOREIGN KEY(persona_id) REFERENCES persone(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS idx_dati_bancari_persona_id ON dati_bancari(persona_id);
        `
    }
];
