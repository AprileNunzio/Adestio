const crypto = require('crypto');
const { getDB, saveDB, wrapMutationWithEvent, notifyDataChanged } = require('../db');
function rowToDocumento(row) {
    return {
        id: row.id,
        persona_id: row.persona_id,
        tipo: row.tipo || 'carta_identita',
        numero: row.numero || '',
        ente_rilascio: row.ente_rilascio || '',
        data_rilascio: row.data_rilascio || '',
        data_scadenza: row.data_scadenza || '',
        file_path: row.file_path || '',
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
        const rows = db.query('SELECT * FROM documenti_identita WHERE persona_id = ? AND is_deleted = 0 ORDER BY data_scadenza DESC', [personaId]);
        return rows.map(rowToDocumento);
    } catch (e) {
        console.error('[AnagraficaDocumentiHandler] getByPersona error:', e);
        throw new Error('Impossibile recuperare i documenti');
    }
}
async function create(event, args) {
    try {
        const { persona_id, tipo } = args;
        if (!persona_id) throw new Error('Persona non specificata');
        if (!tipo) throw new Error('Tipo documento obbligatorio');
        const db = getDB('app_anagrafica');
        const id = crypto.randomUUID();
        const now = Date.now();
        const payload = {
            id,
            persona_id,
            tipo,
            numero: args.numero || '',
            ente_rilascio: args.ente_rilascio || '',
            data_rilascio: args.data_rilascio || '',
            data_scadenza: args.data_scadenza || '',
            file_path: args.file_path || '',
            note: args.note || '',
            last_modified: now,
            is_deleted: 0
        };
        db.run(
            `INSERT INTO documenti_identita (id, persona_id, tipo, numero, ente_rilascio, data_rilascio, data_scadenza, file_path, note, last_modified, is_deleted)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
            [payload.id, payload.persona_id, payload.tipo, payload.numero, payload.ente_rilascio, payload.data_rilascio, payload.data_scadenza, payload.file_path, payload.note, payload.last_modified]
        );
        wrapMutationWithEvent('INSERT', 'documenti_identita', id, { ...payload, _actor_user_id: args.actorUserId || '' });
        saveDB('app_anagrafica');
        notifyDataChanged('documenti_identita', [id]);
        return { success: true, id };
    } catch (e) {
        console.error('[AnagraficaDocumentiHandler] create error:', e);
        throw new Error(e.message || 'Impossibile creare il documento');
    }
}
async function update(event, args) {
    try {
        const { id } = args;
        if (!id) throw new Error('ID mancante');
        if (!args.tipo) throw new Error('Tipo documento obbligatorio');
        const db = getDB('app_anagrafica');
        const now = Date.now();
        db.run(
            `UPDATE documenti_identita SET tipo = ?, numero = ?, ente_rilascio = ?, data_rilascio = ?, data_scadenza = ?, file_path = ?, note = ?, last_modified = ? WHERE id = ?`,
            [args.tipo, args.numero || '', args.ente_rilascio || '', args.data_rilascio || '', args.data_scadenza || '', args.file_path || '', args.note || '', now, id]
        );
        const rows = db.query('SELECT * FROM documenti_identita WHERE id = ?', [id]);
        if (rows.length > 0) wrapMutationWithEvent('UPDATE', 'documenti_identita', id, { ...rowToDocumento(rows[0]), _actor_user_id: args.actorUserId || '' });
        saveDB('app_anagrafica');
        notifyDataChanged('documenti_identita', [id]);
        return { success: true };
    } catch (e) {
        console.error('[AnagraficaDocumentiHandler] update error:', e);
        throw new Error(e.message || 'Impossibile aggiornare il documento');
    }
}
async function remove(event, args) {
    try {
        const { id } = args;
        if (!id) throw new Error('ID mancante');
        const db = getDB('app_anagrafica');
        const now = Date.now();
        db.run('UPDATE documenti_identita SET is_deleted = 1, last_modified = ? WHERE id = ?', [now, id]);
        const rows = db.query('SELECT * FROM documenti_identita WHERE id = ?', [id]);
        if (rows.length > 0) wrapMutationWithEvent('UPDATE', 'documenti_identita', id, { ...rowToDocumento(rows[0]), _actor_user_id: args.actorUserId || '' });
        saveDB('app_anagrafica');
        notifyDataChanged('documenti_identita', [id]);
        return { success: true };
    } catch (e) {
        console.error('[AnagraficaDocumentiHandler] remove error:', e);
        throw new Error(e.message || 'Impossibile eliminare il documento');
    }
}
module.exports = { getByPersona, create, update, remove };
