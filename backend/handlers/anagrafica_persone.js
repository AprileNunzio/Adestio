const crypto = require('crypto');
const { getDB, saveDB, wrapMutationWithEvent, notifyDataChanged } = require('../db');
const { normalizeCodiceFiscale, isValidCodiceFiscale } = require('../utils/anagrafica_validators');
function rowToPersona(row) {
    return {
        id: row.id,
        codice_fiscale: row.codice_fiscale || '',
        user_id: row.user_id || '',
        nome: row.nome || '',
        cognome: row.cognome || '',
        sesso: row.sesso || '',
        data_nascita: row.data_nascita || '',
        luogo_nascita: row.luogo_nascita || '',
        provincia_nascita: row.provincia_nascita || '',
        cap_nascita: row.cap_nascita || '',
        cittadinanza: row.cittadinanza || '',
        stato_civile: row.stato_civile || '',
        email_principale: row.email_principale || '',
        telefono_principale: row.telefono_principale || '',
        posizione_militare: row.posizione_militare || '',
        comune_iscrizione_elettorale: row.comune_iscrizione_elettorale || '',
        foto_path: row.foto_path || '',
        note: row.note || '',
        created_at: row.created_at,
        last_modified: row.last_modified,
        is_deleted: row.is_deleted
    };
}
async function getAll(event, args = {}) {
    try {
        const db = getDB('app_anagrafica');
        const includeDeleted = args && args.includeDeleted;
        const rows = db.query(`SELECT * FROM persone WHERE is_deleted <= ? ORDER BY cognome, nome`, [includeDeleted ? 1 : 0]);
        return rows.map(rowToPersona);
    } catch (e) {
        console.error('[AnagraficaPersoneHandler] getAll error:', e);
        throw new Error('Impossibile recuperare le persone');
    }
}
async function search(event, args = {}) {
    try {
        const db = getDB('app_anagrafica');
        const query = (args && args.query ? String(args.query) : '').trim();
        if (!query) return [];
        const like = `%${query}%`;
        const cf = normalizeCodiceFiscale(query);
        const rows = db.query(
            `SELECT * FROM persone WHERE is_deleted = 0 AND (nome LIKE ? OR cognome LIKE ? OR codice_fiscale LIKE ? OR codice_fiscale = ?) ORDER BY cognome, nome LIMIT 20`,
            [like, like, like, cf]
        );
        return rows.map(rowToPersona);
    } catch (e) {
        console.error('[AnagraficaPersoneHandler] search error:', e);
        throw new Error('Impossibile cercare le persone');
    }
}
async function getById(event, args) {
    try {
        const { id } = args;
        if (!id) throw new Error('ID mancante');
        const db = getDB('app_anagrafica');
        const rows = db.query('SELECT * FROM persone WHERE id = ?', [id]);
        if (rows.length === 0) return null;
        return rowToPersona(rows[0]);
    } catch (e) {
        console.error('[AnagraficaPersoneHandler] getById error:', e);
        throw new Error('Impossibile recuperare la persona');
    }
}
async function getByUserId(event, args) {
    try {
        const { userId } = args;
        if (!userId) throw new Error('ID utente mancante');
        const db = getDB('app_anagrafica');
        const rows = db.query('SELECT * FROM persone WHERE user_id = ? AND is_deleted = 0', [userId]);
        if (rows.length === 0) return null;
        return rowToPersona(rows[0]);
    } catch (e) {
        console.error('[AnagraficaPersoneHandler] getByUserId error:', e);
        throw new Error('Impossibile recuperare la persona collegata all\'utente');
    }
}
function validatePayload(args) {
    const nome = (args.nome || '').trim();
    const cognome = (args.cognome || '').trim();
    if (!nome || !cognome) throw new Error('Nome e Cognome sono obbligatori');
    const codiceFiscale = normalizeCodiceFiscale(args.codice_fiscale || '');
    if (!codiceFiscale) throw new Error('Il Codice Fiscale è obbligatorio: è la chiave univoca della persona');
    if (!isValidCodiceFiscale(codiceFiscale)) throw new Error('Codice Fiscale non valido');
    return { nome, cognome, codiceFiscale };
}
async function create(event, args) {
    try {
        const { nome, cognome, codiceFiscale } = validatePayload(args);
        const db = getDB('app_anagrafica');
        const coreDb = getDB('auth');
        const userId = (args.user_id || '').trim();
        const now = Date.now();
        // Una persona con questo CF potrebbe già esistere in uno stato "non recuperabile"
        // dalla UI (eliminata logicamente, non collegata, oppure collegata a un utente
        // non più attivo). In tutti questi casi la adottiamo per l'utente corrente invece
        const existingRows = db.query('SELECT * FROM persone WHERE id = ?', [codiceFiscale]);
        if (existingRows.length > 0) {
            const existing = existingRows[0];
            if (existing.user_id && existing.user_id !== userId) {
                const otherUser = coreDb.query('SELECT is_deleted FROM users WHERE id = ?', [existing.user_id]);
                if (otherUser.length > 0 && otherUser[0].is_deleted === 0) {
                    throw new Error("Il Codice Fiscale inserito è già associato a un altro utente attivo del sistema.");
                }
            }
            if (userId) {
                const userCheck = db.query('SELECT id FROM persone WHERE user_id = ? AND is_deleted = 0 AND id != ?', [userId, codiceFiscale]);
                if (userCheck.length > 0) throw new Error("Questo utente ha già una persona collegata");
            }
            const keep = (nv, ov) => { const s = String(nv || '').trim(); return s !== '' ? s : (ov || ''); };
            const nextUserId = userId || existing.user_id || '';
            db.run(
                `UPDATE persone SET user_id = ?, nome = ?, cognome = ?, sesso = ?, data_nascita = ?, luogo_nascita = ?, provincia_nascita = ?, cap_nascita = ?, cittadinanza = ?, stato_civile = ?, last_modified = ?, is_deleted = 0 WHERE id = ?`,
                [nextUserId, nome, cognome, keep(args.sesso, existing.sesso), keep(args.data_nascita, existing.data_nascita), keep(args.luogo_nascita, existing.luogo_nascita), keep(args.provincia_nascita, existing.provincia_nascita), keep(args.cap_nascita, existing.cap_nascita), keep(args.cittadinanza, existing.cittadinanza), keep(args.stato_civile, existing.stato_civile), now, codiceFiscale]
            );
            const rows = db.query('SELECT * FROM persone WHERE id = ?', [codiceFiscale]);
            wrapMutationWithEvent('UPDATE', 'persone', codiceFiscale, { ...rowToPersona(rows[0]), _actor_user_id: args.actorUserId || '' });
            saveDB('app_anagrafica');
            notifyDataChanged('persone', [codiceFiscale]);
            return { success: true, id: codiceFiscale, claimed: true };
        }
        if (userId) {
            const userCheck = db.query('SELECT id FROM persone WHERE user_id = ? AND is_deleted = 0', [userId]);
            if (userCheck.length > 0) throw new Error("Questo utente ha già una persona collegata");
        }
        const payload = {
            id: codiceFiscale,
            codice_fiscale: codiceFiscale,
            user_id: userId,
            nome,
            cognome,
            sesso: args.sesso || '',
            data_nascita: args.data_nascita || '',
            luogo_nascita: args.luogo_nascita || '',
            provincia_nascita: args.provincia_nascita || '',
            cap_nascita: args.cap_nascita || '',
            cittadinanza: args.cittadinanza || '',
            stato_civile: args.stato_civile || '',
            email_principale: args.email_principale || '',
            telefono_principale: args.telefono_principale || '',
            foto_path: args.foto_path || '',
            note: args.note || '',
            created_at: now,
            last_modified: now,
            is_deleted: 0
        };
        db.run(
            `INSERT INTO persone (id, codice_fiscale, user_id, nome, cognome, sesso, data_nascita, luogo_nascita, provincia_nascita, cap_nascita, cittadinanza, stato_civile, email_principale, telefono_principale, foto_path, note, created_at, last_modified, is_deleted)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
            [payload.id, payload.codice_fiscale, payload.user_id, payload.nome, payload.cognome, payload.sesso, payload.data_nascita, payload.luogo_nascita, payload.provincia_nascita, payload.cap_nascita, payload.cittadinanza, payload.stato_civile, payload.email_principale, payload.telefono_principale, payload.foto_path, payload.note, payload.created_at, payload.last_modified]
        );
        wrapMutationWithEvent('INSERT', 'persone', payload.id, { ...payload, _actor_user_id: args.actorUserId || '' });
        saveDB('app_anagrafica');
        notifyDataChanged('persone', [payload.id]);
        return { success: true, id: payload.id };
    } catch (e) {
        console.error('[AnagraficaPersoneHandler] create error:', e);
        throw new Error(e.message || 'Impossibile creare la persona');
    }
}
async function update(event, args) {
    try {
        const { id } = args;
        if (!id) throw new Error('ID mancante');
        const nome = (args.nome || '').trim();
        const cognome = (args.cognome || '').trim();
        if (!nome || !cognome) throw new Error('Nome e Cognome sono obbligatori');
        const db = getDB('app_anagrafica');
        const now = Date.now();
        db.run(
            `UPDATE persone SET nome = ?, cognome = ?, sesso = ?, data_nascita = ?, luogo_nascita = ?, provincia_nascita = ?, cap_nascita = ?, cittadinanza = ?, stato_civile = ?, email_principale = ?, telefono_principale = ?, posizione_militare = ?, comune_iscrizione_elettorale = ?, foto_path = ?, note = ?, last_modified = ? WHERE id = ?`,
            [nome, cognome, args.sesso || '', args.data_nascita || '', args.luogo_nascita || '', args.provincia_nascita || '', args.cap_nascita || '', args.cittadinanza || '', args.stato_civile || '', args.email_principale || '', args.telefono_principale || '', args.posizione_militare || '', args.comune_iscrizione_elettorale || '', args.foto_path || '', args.note || '', now, id]
        );
        const rows = db.query('SELECT * FROM persone WHERE id = ?', [id]);
        if (rows.length > 0) {
            wrapMutationWithEvent('UPDATE', 'persone', id, { ...rowToPersona(rows[0]), _actor_user_id: args.actorUserId || '' });
        }
        saveDB('app_anagrafica');
        notifyDataChanged('persone', [id]);
        return { success: true };
    } catch (e) {
        console.error('[AnagraficaPersoneHandler] update error:', e);
        throw new Error(e.message || 'Impossibile aggiornare la persona');
    }
}
async function remove(event, args) {
    try {
        const { id } = args;
        if (!id) throw new Error('ID mancante');
        const db = getDB('app_anagrafica');
        const now = Date.now();
        db.run('UPDATE persone SET is_deleted = 1, last_modified = ? WHERE id = ?', [now, id]);
        const rows = db.query('SELECT * FROM persone WHERE id = ?', [id]);
        if (rows.length > 0) {
            wrapMutationWithEvent('UPDATE', 'persone', id, { ...rowToPersona(rows[0]), _actor_user_id: args.actorUserId || '' });
        }
        saveDB('app_anagrafica');
        notifyDataChanged('persone', [id]);
        return { success: true };
    } catch (e) {
        console.error('[AnagraficaPersoneHandler] remove error:', e);
        throw new Error(e.message || 'Impossibile eliminare la persona');
    }
}
async function restore(event, args) {
    try {
        const { id } = args;
        if (!id) throw new Error('ID mancante');
        const db = getDB('app_anagrafica');
        const now = Date.now();
        db.run('UPDATE persone SET is_deleted = 0, last_modified = ? WHERE id = ?', [now, id]);
        const rows = db.query('SELECT * FROM persone WHERE id = ?', [id]);
        if (rows.length > 0) {
            wrapMutationWithEvent('UPDATE', 'persone', id, { ...rowToPersona(rows[0]), _actor_user_id: args.actorUserId || '' });
        }
        saveDB('app_anagrafica');
        notifyDataChanged('persone', [id]);
        return { success: true };
    } catch (e) {
        console.error('[AnagraficaPersoneHandler] restore error:', e);
        throw new Error(e.message || 'Impossibile ripristinare la persona');
    }
}
async function hardDelete(event, args) {
    try {
        const { id } = args;
        if (!id) throw new Error('ID mancante');
        const db = getDB('app_anagrafica');
        db.run('DELETE FROM documenti_identita WHERE persona_id = ?', [id]);
        db.run('DELETE FROM indirizzi WHERE persona_id = ?', [id]);
        db.run('DELETE FROM rapporti_lavoro WHERE persona_id = ?', [id]);
        db.run('DELETE FROM persone WHERE id = ?', [id]);
        const deletePayload = { _actor_user_id: args.actorUserId || '' };
        wrapMutationWithEvent('DELETE', 'documenti_identita', id, deletePayload);
        wrapMutationWithEvent('DELETE', 'indirizzi', id, deletePayload);
        wrapMutationWithEvent('DELETE', 'rapporti_lavoro', id, deletePayload);
        wrapMutationWithEvent('DELETE', 'persone', id, deletePayload);
        saveDB('app_anagrafica');
        notifyDataChanged('persone', [id]);
        return { success: true };
    } catch (e) {
        console.error('[AnagraficaPersoneHandler] hardDelete error:', e);
        throw new Error(e.message || 'Impossibile eliminare definitivamente la persona');
    }
}
async function getScheda(event, args) {
    try {
        const { id } = args;
        if (!id) throw new Error('ID mancante');
        const db = getDB('app_anagrafica');
        const personaRows = db.query('SELECT * FROM persone WHERE id = ?', [id]);
        if (personaRows.length === 0) throw new Error('Persona non trovata');
        const documenti = db.query('SELECT * FROM documenti_identita WHERE persona_id = ? AND is_deleted = 0 ORDER BY data_scadenza DESC', [id]);
        const indirizzi = db.query('SELECT * FROM indirizzi WHERE persona_id = ? AND is_deleted = 0 ORDER BY is_corrente DESC, data_inizio DESC', [id]);
        const rapportiLavoro = db.query('SELECT * FROM rapporti_lavoro WHERE persona_id = ? AND is_deleted = 0 ORDER BY is_corrente DESC, data_inizio DESC', [id]);
        const familiari = db.query('SELECT * FROM familiari WHERE persona_id = ? AND is_deleted = 0 ORDER BY grado_parentela ASC, data_nascita ASC', [id]);
        const titoliStudio = db.query('SELECT * FROM titoli_studio WHERE persona_id = ? AND is_deleted = 0 ORDER BY is_principale DESC, data_conseguimento DESC', [id]);
        const datiBancari = db.query('SELECT * FROM dati_bancari WHERE persona_id = ? AND is_deleted = 0 ORDER BY is_principale DESC, last_modified DESC', [id]);
        const contatti = db.query('SELECT * FROM contatti WHERE persona_id = ? AND is_deleted = 0 ORDER BY is_principale DESC', [id]);
        return {
            persona: rowToPersona(personaRows[0]),
            documenti,
            indirizzi,
            rapportiLavoro,
            familiari,
            titoliStudio,
            datiBancari,
            contatti
        };
    } catch (e) {
        console.error('[AnagraficaPersoneHandler] getScheda error:', e);
        throw new Error(e.message || 'Impossibile recuperare la scheda della persona');
    }
}
function linkOrCreateForUser(userId, codiceFiscale, nome, cognome, email, actorUserId) {
    if (!userId) throw new Error('ID utente mancante');
    const cf = normalizeCodiceFiscale(codiceFiscale || '');
    if (!cf || !isValidCodiceFiscale(cf)) throw new Error('Il Codice Fiscale è obbligatorio e deve essere valido: verrà associato all\'anagrafica personale dell\'utente');
    const db = getDB('app_anagrafica');
    const coreDb = getDB('auth');
    const now = Date.now();
    const existing = db.query('SELECT * FROM persone WHERE id = ?', [cf]);
    if (existing.length > 0) {
        if (existing[0].user_id && existing[0].user_id !== userId) {
            const oldUserRows = coreDb.query('SELECT is_deleted FROM users WHERE id = ?', [existing[0].user_id]);
            if (oldUserRows.length > 0 && oldUserRows[0].is_deleted === 0) {
                throw new Error("Attenzione: Il Codice Fiscale inserito risulta già registrato e associato ad un'utenza attualmente attiva nel sistema.");
            }
        }
        db.run('UPDATE persone SET user_id = ?, email_principale = ?, last_modified = ? WHERE id = ?', [userId, email || '', now, cf]);
        if (email && email.trim() !== '') {
            const checkEmail = db.query('SELECT id FROM contatti WHERE persona_id = ? AND valore = ? AND categoria = ? AND is_deleted = 0', [cf, email.trim(), 'Email']);
            if (checkEmail.length === 0) {
                const contactId = crypto.randomUUID();
                db.run(
                    `INSERT INTO contatti (id, persona_id, categoria, tipo, valore, is_principale, note, last_modified, is_deleted) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
                    [contactId, cf, 'Email', 'Lavoro', email.trim(), 1, 'Importata da utenza', now]
                );
                wrapMutationWithEvent('INSERT', 'contatti', contactId, {
                    id: contactId, persona_id: cf, categoria: 'Email', tipo: 'Lavoro', valore: email.trim(), is_principale: 1, note: 'Importata da utenza', last_modified: now, is_deleted: 0, _actor_user_id: actorUserId || ''
                });
                notifyDataChanged('contatti', [contactId]);
            }
        }
        const rows = db.query('SELECT * FROM persone WHERE id = ?', [cf]);
        wrapMutationWithEvent('UPDATE', 'persone', cf, { ...rowToPersona(rows[0]), _actor_user_id: actorUserId || '' });
        return rowToPersona(rows[0]);
    }
    const userCheck = db.query('SELECT id FROM persone WHERE user_id = ? AND is_deleted = 0', [userId]);
    if (userCheck.length > 0) throw new Error('Questo utente ha già una persona collegata');
    const payload = {
        id: cf,
        codice_fiscale: cf,
        user_id: userId,
        nome: (nome || '').trim(),
        cognome: (cognome || '').trim(),
        sesso: '',
        data_nascita: '',
        luogo_nascita: '',
        provincia_nascita: '',
        cittadinanza: '',
        stato_civile: '',
        email_principale: email || '',
        telefono_principale: '',
        foto_path: '',
        note: '',
        created_at: now,
        last_modified: now,
        is_deleted: 0
    };
    db.run(
        `INSERT INTO persone (id, codice_fiscale, user_id, nome, cognome, sesso, data_nascita, luogo_nascita, provincia_nascita, cittadinanza, stato_civile, email_principale, telefono_principale, foto_path, note, created_at, last_modified, is_deleted)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
        [payload.id, payload.codice_fiscale, payload.user_id, payload.nome, payload.cognome, payload.sesso, payload.data_nascita, payload.luogo_nascita, payload.provincia_nascita, payload.cittadinanza, payload.stato_civile, payload.email_principale, payload.telefono_principale, payload.foto_path, payload.note, payload.created_at, payload.last_modified]
    );
    wrapMutationWithEvent('INSERT', 'persone', cf, { ...payload, _actor_user_id: actorUserId || '' });
    if (email && email.trim() !== '') {
        const contactId = crypto.randomUUID();
        db.run(
            `INSERT INTO contatti (id, persona_id, categoria, tipo, valore, is_principale, note, last_modified, is_deleted) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
            [contactId, cf, 'Email', 'Lavoro', email.trim(), 1, 'Creata da registrazione', now]
        );
        wrapMutationWithEvent('INSERT', 'contatti', contactId, {
            id: contactId, persona_id: cf, categoria: 'Email', tipo: 'Lavoro', valore: email.trim(), is_principale: 1, note: 'Creata da registrazione', last_modified: now, is_deleted: 0, _actor_user_id: actorUserId || ''
        });
        notifyDataChanged('contatti', [contactId]);
    }
    return payload;
}
module.exports = { getAll, search, getById, getByUserId, create, update, remove, restore, hardDelete, getScheda, linkOrCreateForUser };
