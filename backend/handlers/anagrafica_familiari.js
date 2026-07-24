const crypto = require('crypto');
const { getDB, saveDB, wrapMutationWithEvent, notifyDataChanged } = require('../db');
const { normalizeCodiceFiscale, isValidCodiceFiscale } = require('../utils/anagrafica_validators');
function rowToFamiliare(row) {
    return {
        id: row.id,
        persona_id: row.persona_id,
        nome: row.nome || '',
        cognome: row.cognome || '',
        codice_fiscale: row.codice_fiscale || '',
        sesso: row.sesso || '',
        data_nascita: row.data_nascita || '',
        grado_parentela: row.grado_parentela || '',
        is_a_carico: row.is_a_carico || 0,
        note: row.note || '',
        last_modified: row.last_modified,
        is_deleted: row.is_deleted
    };
}
async function getByPersona(event, args) {
    try {
        const { personaId } = args;
        if (!personaId) throw new Error('ID persona mancante');
        const db = getDB('app_anagrafica');
        const rows = db.query('SELECT * FROM familiari WHERE persona_id = ? AND is_deleted = 0 ORDER BY grado_parentela ASC, data_nascita ASC', [personaId]);
        return rows.map(rowToFamiliare);
    } catch (e) {
        console.error('[AnagraficaFamiliariHandler] getByPersona error:', e);
        throw new Error('Impossibile recuperare i familiari');
    }
}
function validatePayload(args) {
    const nome = (args.nome || '').trim();
    const cognome = (args.cognome || '').trim();
    const grado_parentela = (args.grado_parentela || '').trim();
    if (!nome || !cognome) throw new Error('Nome e Cognome sono obbligatori');
    if (!grado_parentela) throw new Error('Il grado di parentela è obbligatorio');
    let codiceFiscale = normalizeCodiceFiscale(args.codice_fiscale || '');
    if (codiceFiscale && !isValidCodiceFiscale(codiceFiscale)) {
        throw new Error('Codice Fiscale non valido');
    }
    return { nome, cognome, grado_parentela, codiceFiscale };
}
function verifyGdprConsistency(db, args, codiceFiscale) {
    if (!codiceFiscale) return;
    const rows = db.query('SELECT nome, cognome, data_nascita FROM persone WHERE codice_fiscale = ? AND is_deleted = 0', [codiceFiscale]);
    if (rows.length > 0) {
        const p = rows[0];
        const nomeUpper = (args.nome || '').trim().toUpperCase();
        const cognomeUpper = (args.cognome || '').trim().toUpperCase();
        const pNomeUpper = (p.nome || '').trim().toUpperCase();
        const pCognomeUpper = (p.cognome || '').trim().toUpperCase();
        
        if (nomeUpper !== pNomeUpper || cognomeUpper !== pCognomeUpper) {
            throw new Error("I dati anagrafici forniti non corrispondono a quelli registrati a sistema per questo Codice Fiscale.");
        }
        if (args.data_nascita && p.data_nascita && args.data_nascita !== p.data_nascita) {
            throw new Error("I dati anagrafici forniti non corrispondono a quelli registrati a sistema per questo Codice Fiscale.");
        }
    }
}
async function create(event, args) {
    try {
        const { persona_id } = args;
        if (!persona_id) throw new Error('Persona non specificata');
        const { nome, cognome, grado_parentela, codiceFiscale } = validatePayload(args);
        const db = getDB('app_anagrafica');
        verifyGdprConsistency(db, args, codiceFiscale);
        const id = crypto.randomUUID();
        const now = Date.now();
        const isACarico = args.is_a_carico ? 1 : 0;
        const payload = {
            id,
            persona_id,
            nome,
            cognome,
            codice_fiscale: codiceFiscale,
            sesso: args.sesso || '',
            data_nascita: args.data_nascita || '',
            grado_parentela,
            is_a_carico: isACarico,
            note: args.note || '',
            last_modified: now,
            is_deleted: 0
        };
        db.run(
            `INSERT INTO familiari (id, persona_id, nome, cognome, codice_fiscale, sesso, data_nascita, grado_parentela, is_a_carico, note, last_modified, is_deleted)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
            [payload.id, payload.persona_id, payload.nome, payload.cognome, payload.codice_fiscale, payload.sesso, payload.data_nascita, payload.grado_parentela, payload.is_a_carico, payload.note, payload.last_modified]
        );
        wrapMutationWithEvent('INSERT', 'familiari', id, { ...payload, _actor_user_id: args.actorUserId || '' });
        saveDB('app_anagrafica');
        notifyDataChanged('familiari', [id]);
        return { success: true, id };
    } catch (e) {
        console.error('[AnagraficaFamiliariHandler] create error:', e);
        throw new Error(e.message || "Impossibile creare il familiare");
    }
}
async function update(event, args) {
    try {
        const { id } = args;
        if (!id) throw new Error('ID mancante');
        const { nome, cognome, grado_parentela, codiceFiscale } = validatePayload(args);
        const db = getDB('app_anagrafica');
        verifyGdprConsistency(db, args, codiceFiscale);
        const now = Date.now();
        const isACarico = args.is_a_carico ? 1 : 0;
        const existing = db.query('SELECT id FROM familiari WHERE id = ?', [id]);
        if (existing.length === 0) throw new Error('Familiare non trovato');
        db.run(
            `UPDATE familiari SET nome = ?, cognome = ?, codice_fiscale = ?, sesso = ?, data_nascita = ?, grado_parentela = ?, is_a_carico = ?, note = ?, last_modified = ? WHERE id = ?`,
            [nome, cognome, codiceFiscale, args.sesso || '', args.data_nascita || '', grado_parentela, isACarico, args.note || '', now, id]
        );
        const rows = db.query('SELECT * FROM familiari WHERE id = ?', [id]);
        if (rows.length > 0) {
            wrapMutationWithEvent('UPDATE', 'familiari', id, { ...rowToFamiliare(rows[0]), _actor_user_id: args.actorUserId || '' });
        }
        saveDB('app_anagrafica');
        notifyDataChanged('familiari', [id]);
        return { success: true };
    } catch (e) {
        console.error('[AnagraficaFamiliariHandler] update error:', e);
        throw new Error(e.message || "Impossibile aggiornare il familiare");
    }
}
async function remove(event, args) {
    try {
        const { id } = args;
        if (!id) throw new Error('ID mancante');
        const db = getDB('app_anagrafica');
        const now = Date.now();
        db.run('UPDATE familiari SET is_deleted = 1, last_modified = ? WHERE id = ?', [now, id]);
        const rows = db.query('SELECT * FROM familiari WHERE id = ?', [id]);
        if (rows.length > 0) {
            wrapMutationWithEvent('UPDATE', 'familiari', id, { ...rowToFamiliare(rows[0]), _actor_user_id: args.actorUserId || '' });
        }
        saveDB('app_anagrafica');
        notifyDataChanged('familiari', [id]);
        return { success: true };
    } catch (e) {
        console.error('[AnagraficaFamiliariHandler] remove error:', e);
        throw new Error(e.message || "Impossibile eliminare il familiare");
    }
}
module.exports = { getByPersona, create, update, remove };
