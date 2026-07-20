const crypto = require('crypto');
const { getDB, saveDB, wrapMutationWithEvent, notifyDataChanged } = require('../db');
function rowToTitolo(row) {
    return {
        id: row.id,
        persona_id: row.persona_id,
        tipo: row.tipo || '',
        denominazione: row.denominazione || '',
        istituto_rilascio: row.istituto_rilascio || '',
        citta_istituto: row.citta_istituto || '',
        data_conseguimento: row.data_conseguimento || '',
        votazione: row.votazione || '',
        is_principale: row.is_principale,
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
        const rows = db.query('SELECT * FROM titoli_studio WHERE persona_id = ? AND is_deleted = 0 ORDER BY is_principale DESC, data_conseguimento DESC', [personaId]);
        return rows.map(rowToTitolo);
    } catch (e) {
        console.error('[AnagraficaTitoliStudioHandler] getByPersona error:', e);
        throw new Error('Impossibile recuperare i titoli di studio');
    }
}
async function create(event, args) {
    try {
        const { persona_id, denominazione } = args;
        if (!persona_id) throw new Error('Persona non specificata');
        if (!denominazione) throw new Error('Denominazione titolo obbligatoria');
        const db = getDB('app_anagrafica');
        const id = crypto.randomUUID();
        const now = Date.now();
        const isPrincipale = args.is_principale ? 1 : 0;
        if (isPrincipale) {
            db.run('UPDATE titoli_studio SET is_principale = 0, last_modified = ? WHERE persona_id = ? AND is_principale = 1', [now, persona_id]);
        }
        const payload = {
            id,
            persona_id,
            tipo: args.tipo || '',
            denominazione,
            istituto_rilascio: args.istituto_rilascio || '',
            citta_istituto: args.citta_istituto || '',
            data_conseguimento: args.data_conseguimento || '',
            votazione: args.votazione || '',
            is_principale: isPrincipale,
            note: args.note || '',
            last_modified: now,
            is_deleted: 0
        };
        db.run(
            `INSERT INTO titoli_studio (id, persona_id, tipo, denominazione, istituto_rilascio, citta_istituto, data_conseguimento, votazione, is_principale, note, last_modified, is_deleted)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
            [payload.id, payload.persona_id, payload.tipo, payload.denominazione, payload.istituto_rilascio, payload.citta_istituto, payload.data_conseguimento, payload.votazione, payload.is_principale, payload.note, payload.last_modified]
        );
        wrapMutationWithEvent('INSERT', 'titoli_studio', id, { ...payload, _actor_user_id: args.actorUserId || '' });
        saveDB('app_anagrafica');
        notifyDataChanged('titoli_studio', [id]);
        return { success: true, id };
    } catch (e) {
        console.error('[AnagraficaTitoliStudioHandler] create error:', e);
        throw new Error(e.message || 'Impossibile creare il titolo di studio');
    }
}
async function update(event, args) {
    try {
        const { id } = args;
        if (!id) throw new Error('ID mancante');
        if (!args.denominazione) throw new Error('Denominazione titolo obbligatoria');
        const db = getDB('app_anagrafica');
        const now = Date.now();
        const isPrincipale = args.is_principale ? 1 : 0;
        const existing = db.query('SELECT persona_id FROM titoli_studio WHERE id = ?', [id]);
        if (existing.length === 0) throw new Error('Titolo di studio non trovato');
        if (isPrincipale) {
            db.run('UPDATE titoli_studio SET is_principale = 0, last_modified = ? WHERE persona_id = ? AND id != ? AND is_principale = 1', [now, existing[0].persona_id, id]);
        }
        db.run(
            `UPDATE titoli_studio SET tipo = ?, denominazione = ?, istituto_rilascio = ?, citta_istituto = ?, data_conseguimento = ?, votazione = ?, is_principale = ?, note = ?, last_modified = ? WHERE id = ?`,
            [args.tipo || '', args.denominazione, args.istituto_rilascio || '', args.citta_istituto || '', args.data_conseguimento || '', args.votazione || '', isPrincipale, args.note || '', now, id]
        );
        const rows = db.query('SELECT * FROM titoli_studio WHERE id = ?', [id]);
        if (rows.length > 0) wrapMutationWithEvent('UPDATE', 'titoli_studio', id, { ...rowToTitolo(rows[0]), _actor_user_id: args.actorUserId || '' });
        saveDB('app_anagrafica');
        notifyDataChanged('titoli_studio', [id]);
        return { success: true };
    } catch (e) {
        console.error('[AnagraficaTitoliStudioHandler] update error:', e);
        throw new Error(e.message || 'Impossibile aggiornare il titolo di studio');
    }
}
async function remove(event, args) {
    try {
        const { id } = args;
        if (!id) throw new Error('ID mancante');
        const db = getDB('app_anagrafica');
        const now = Date.now();
        db.run('UPDATE titoli_studio SET is_deleted = 1, last_modified = ? WHERE id = ?', [now, id]);
        const rows = db.query('SELECT * FROM titoli_studio WHERE id = ?', [id]);
        if (rows.length > 0) wrapMutationWithEvent('UPDATE', 'titoli_studio', id, { ...rowToTitolo(rows[0]), _actor_user_id: args.actorUserId || '' });
        saveDB('app_anagrafica');
        notifyDataChanged('titoli_studio', [id]);
        return { success: true };
    } catch (e) {
        console.error('[AnagraficaTitoliStudioHandler] remove error:', e);
        throw new Error(e.message || 'Impossibile eliminare il titolo di studio');
    }
}
module.exports = { getByPersona, create, update, remove };
