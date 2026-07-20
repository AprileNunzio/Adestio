const crypto = require('crypto');
const { getDB, saveDB, wrapMutationWithEvent, notifyDataChanged } = require('../db');
function rowToContatto(row) {
    return {
        id: row.id,
        persona_id: row.persona_id,
        categoria: row.categoria || 'Telefono',
        tipo: row.tipo || 'Cellulare',
        valore: row.valore || '',
        is_principale: row.is_principale || 0,
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
        const rows = db.query('SELECT * FROM contatti WHERE persona_id = ? AND is_deleted = 0 ORDER BY categoria ASC, is_principale DESC', [personaId]);
        return rows.map(rowToContatto);
    } catch (e) {
        console.error('[AnagraficaContattiHandler] getByPersona error:', e);
        throw new Error('Impossibile recuperare i contatti');
    }
}
async function create(event, args) {
    try {
        const { persona_id, categoria, tipo, valore } = args;
        if (!persona_id) throw new Error('Persona non specificata');
        if (!categoria) throw new Error('Categoria obbligatoria');
        if (!tipo) throw new Error('Tipo obbligatorio');
        if (!valore) throw new Error('Valore obbligatorio');
        const db = getDB('app_anagrafica');
        if (args.is_principale) {
            db.run('UPDATE contatti SET is_principale = 0, last_modified = ? WHERE persona_id = ? AND categoria = ?', [Date.now(), persona_id, categoria]);
        }
        const id = crypto.randomUUID();
        const now = Date.now();
        const payload = {
            id,
            persona_id,
            categoria,
            tipo,
            valore,
            is_principale: args.is_principale ? 1 : 0,
            note: args.note || '',
            last_modified: now,
            is_deleted: 0
        };
        db.run(
            `INSERT INTO contatti (id, persona_id, categoria, tipo, valore, is_principale, note, last_modified, is_deleted)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
            [payload.id, payload.persona_id, payload.categoria, payload.tipo, payload.valore, payload.is_principale, payload.note, payload.last_modified]
        );
        wrapMutationWithEvent('INSERT', 'contatti', id, { ...payload, _actor_user_id: args.actorUserId || '' });
        saveDB('app_anagrafica');
        notifyDataChanged('contatti', [id]);
        return { success: true, id };
    } catch (e) {
        console.error('[AnagraficaContattiHandler] create error:', e);
        throw new Error(e.message || 'Impossibile creare il contatto');
    }
}
async function update(event, args) {
    try {
        const { id, persona_id, categoria, tipo, valore } = args;
        if (!id) throw new Error('ID mancante');
        if (!categoria) throw new Error('Categoria obbligatoria');
        if (!tipo) throw new Error('Tipo obbligatorio');
        if (!valore) throw new Error('Valore obbligatorio');
        const db = getDB('app_anagrafica');
        const now = Date.now();
        if (args.is_principale && persona_id) {
            db.run('UPDATE contatti SET is_principale = 0, last_modified = ? WHERE persona_id = ? AND categoria = ? AND id != ?', [now, persona_id, categoria, id]);
        }
        db.run(
            `UPDATE contatti SET categoria = ?, tipo = ?, valore = ?, is_principale = ?, note = ?, last_modified = ? WHERE id = ?`,
            [categoria, tipo, valore, args.is_principale ? 1 : 0, args.note || '', now, id]
        );
        const rows = db.query('SELECT * FROM contatti WHERE id = ?', [id]);
        if (rows.length > 0) wrapMutationWithEvent('UPDATE', 'contatti', id, { ...rowToContatto(rows[0]), _actor_user_id: args.actorUserId || '' });
        saveDB('app_anagrafica');
        notifyDataChanged('contatti', [id]);
        return { success: true };
    } catch (e) {
        console.error('[AnagraficaContattiHandler] update error:', e);
        throw new Error(e.message || 'Impossibile aggiornare il contatto');
    }
}
async function remove(event, args) {
    try {
        const { id } = args;
        if (!id) throw new Error('ID mancante');
        const db = getDB('app_anagrafica');
        const now = Date.now();
        db.run('UPDATE contatti SET is_deleted = 1, last_modified = ? WHERE id = ?', [now, id]);
        const rows = db.query('SELECT * FROM contatti WHERE id = ?', [id]);
        if (rows.length > 0) wrapMutationWithEvent('UPDATE', 'contatti', id, { ...rowToContatto(rows[0]), _actor_user_id: args.actorUserId || '' });
        saveDB('app_anagrafica');
        notifyDataChanged('contatti', [id]);
        return { success: true };
    } catch (e) {
        console.error('[AnagraficaContattiHandler] remove error:', e);
        throw new Error(e.message || 'Impossibile eliminare il contatto');
    }
}
module.exports = { getByPersona, create, update, remove };
