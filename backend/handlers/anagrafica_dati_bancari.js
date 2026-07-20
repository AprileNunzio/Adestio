const crypto = require('crypto');
const { getDB, saveDB, wrapMutationWithEvent, notifyDataChanged } = require('../db');
function rowToBancario(row) {
    return {
        id: row.id,
        persona_id: row.persona_id,
        iban: row.iban || '',
        banca: row.banca || '',
        intestatario: row.intestatario || '',
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
        const rows = db.query('SELECT * FROM dati_bancari WHERE persona_id = ? AND is_deleted = 0 ORDER BY is_principale DESC, last_modified DESC', [personaId]);
        return rows.map(rowToBancario);
    } catch (e) {
        console.error('[AnagraficaDatiBancariHandler] getByPersona error:', e);
        throw new Error('Impossibile recuperare i dati bancari');
    }
}
async function create(event, args) {
    try {
        const { persona_id, iban } = args;
        if (!persona_id) throw new Error('Persona non specificata');
        if (!iban) throw new Error('IBAN obbligatorio');
        const db = getDB('app_anagrafica');
        const id = crypto.randomUUID();
        const now = Date.now();
        const isPrincipale = args.is_principale ? 1 : 0;
        if (isPrincipale) {
            db.run('UPDATE dati_bancari SET is_principale = 0, last_modified = ? WHERE persona_id = ? AND is_principale = 1', [now, persona_id]);
        }
        const payload = {
            id,
            persona_id,
            iban,
            banca: args.banca || '',
            intestatario: args.intestatario || '',
            is_principale: isPrincipale,
            note: args.note || '',
            last_modified: now,
            is_deleted: 0
        };
        db.run(
            `INSERT INTO dati_bancari (id, persona_id, iban, banca, intestatario, is_principale, note, last_modified, is_deleted)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
            [payload.id, payload.persona_id, payload.iban, payload.banca, payload.intestatario, payload.is_principale, payload.note, payload.last_modified]
        );
        wrapMutationWithEvent('INSERT', 'dati_bancari', id, { ...payload, _actor_user_id: args.actorUserId || '' });
        saveDB('app_anagrafica');
        notifyDataChanged('dati_bancari', [id]);
        return { success: true, id };
    } catch (e) {
        console.error('[AnagraficaDatiBancariHandler] create error:', e);
        throw new Error(e.message || 'Impossibile creare i dati bancari');
    }
}
async function update(event, args) {
    try {
        const { id } = args;
        if (!id) throw new Error('ID mancante');
        if (!args.iban) throw new Error('IBAN obbligatorio');
        const db = getDB('app_anagrafica');
        const now = Date.now();
        const isPrincipale = args.is_principale ? 1 : 0;
        const existing = db.query('SELECT persona_id FROM dati_bancari WHERE id = ?', [id]);
        if (existing.length === 0) throw new Error('Dati bancari non trovati');
        if (isPrincipale) {
            db.run('UPDATE dati_bancari SET is_principale = 0, last_modified = ? WHERE persona_id = ? AND id != ? AND is_principale = 1', [now, existing[0].persona_id, id]);
        }
        db.run(
            `UPDATE dati_bancari SET iban = ?, banca = ?, intestatario = ?, is_principale = ?, note = ?, last_modified = ? WHERE id = ?`,
            [args.iban, args.banca || '', args.intestatario || '', isPrincipale, args.note || '', now, id]
        );
        const rows = db.query('SELECT * FROM dati_bancari WHERE id = ?', [id]);
        if (rows.length > 0) wrapMutationWithEvent('UPDATE', 'dati_bancari', id, { ...rowToBancario(rows[0]), _actor_user_id: args.actorUserId || '' });
        saveDB('app_anagrafica');
        notifyDataChanged('dati_bancari', [id]);
        return { success: true };
    } catch (e) {
        console.error('[AnagraficaDatiBancariHandler] update error:', e);
        throw new Error(e.message || 'Impossibile aggiornare i dati bancari');
    }
}
async function remove(event, args) {
    try {
        const { id } = args;
        if (!id) throw new Error('ID mancante');
        const db = getDB('app_anagrafica');
        const now = Date.now();
        db.run('UPDATE dati_bancari SET is_deleted = 1, last_modified = ? WHERE id = ?', [now, id]);
        const rows = db.query('SELECT * FROM dati_bancari WHERE id = ?', [id]);
        if (rows.length > 0) wrapMutationWithEvent('UPDATE', 'dati_bancari', id, { ...rowToBancario(rows[0]), _actor_user_id: args.actorUserId || '' });
        saveDB('app_anagrafica');
        notifyDataChanged('dati_bancari', [id]);
        return { success: true };
    } catch (e) {
        console.error('[AnagraficaDatiBancariHandler] remove error:', e);
        throw new Error(e.message || 'Impossibile eliminare i dati bancari');
    }
}
module.exports = { getByPersona, create, update, remove };
