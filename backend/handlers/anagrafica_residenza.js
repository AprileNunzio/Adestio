const crypto = require('crypto');
const { getDB, saveDB, wrapMutationWithEvent, notifyDataChanged } = require('../db');
function rowToIndirizzo(row) {
    return {
        id: row.id,
        persona_id: row.persona_id,
        tipo: row.tipo || 'residenza',
        via: row.via || '',
        civico: row.civico || '',
        cap: row.cap || '',
        comune: row.comune || '',
        provincia: row.provincia || '',
        stato: row.stato || 'Italia',
        data_inizio: row.data_inizio || '',
        data_fine: row.data_fine || '',
        is_corrente: row.is_corrente,
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
        const rows = db.query('SELECT * FROM indirizzi WHERE persona_id = ? AND is_deleted = 0 ORDER BY is_corrente DESC, data_inizio DESC', [personaId]);
        return rows.map(rowToIndirizzo);
    } catch (e) {
        console.error('[AnagraficaResidenzaHandler] getByPersona error:', e);
        throw new Error('Impossibile recuperare gli indirizzi');
    }
}
async function create(event, args) {
    try {
        const { persona_id, tipo } = args;
        if (!persona_id) throw new Error('Persona non specificata');
        if (!tipo) throw new Error('Tipo indirizzo obbligatorio');
        const db = getDB('app_anagrafica');
        const id = crypto.randomUUID();
        const now = Date.now();
        const isCorrente = args.is_corrente === undefined ? 1 : (args.is_corrente ? 1 : 0);
        if (isCorrente) {
            db.run('UPDATE indirizzi SET is_corrente = 0, last_modified = ? WHERE persona_id = ? AND tipo = ? AND is_corrente = 1', [now, persona_id, tipo]);
        }
        const payload = {
            id,
            persona_id,
            tipo,
            via: args.via || '',
            civico: args.civico || '',
            cap: args.cap || '',
            comune: args.comune || '',
            provincia: args.provincia || '',
            stato: args.stato || 'Italia',
            data_inizio: args.data_inizio || '',
            data_fine: args.data_fine || '',
            is_corrente: isCorrente,
            note: args.note || '',
            last_modified: now,
            is_deleted: 0
        };
        db.run(
            `INSERT INTO indirizzi (id, persona_id, tipo, via, civico, cap, comune, provincia, stato, data_inizio, data_fine, is_corrente, note, last_modified, is_deleted)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
            [payload.id, payload.persona_id, payload.tipo, payload.via, payload.civico, payload.cap, payload.comune, payload.provincia, payload.stato, payload.data_inizio, payload.data_fine, payload.is_corrente, payload.note, payload.last_modified]
        );
        wrapMutationWithEvent('INSERT', 'indirizzi', id, { ...payload, _actor_user_id: args.actorUserId || '' });
        saveDB('app_anagrafica');
        notifyDataChanged('indirizzi', [id]);
        return { success: true, id };
    } catch (e) {
        console.error('[AnagraficaResidenzaHandler] create error:', e);
        throw new Error(e.message || "Impossibile creare l'indirizzo");
    }
}
async function update(event, args) {
    try {
        const { id } = args;
        if (!id) throw new Error('ID mancante');
        if (!args.tipo) throw new Error('Tipo indirizzo obbligatorio');
        const db = getDB('app_anagrafica');
        const now = Date.now();
        const isCorrente = args.is_corrente === undefined ? 1 : (args.is_corrente ? 1 : 0);
        const existing = db.query('SELECT persona_id, tipo FROM indirizzi WHERE id = ?', [id]);
        if (existing.length === 0) throw new Error('Indirizzo non trovato');
        if (isCorrente) {
            db.run('UPDATE indirizzi SET is_corrente = 0, last_modified = ? WHERE persona_id = ? AND tipo = ? AND id != ? AND is_corrente = 1', [now, existing[0].persona_id, existing[0].tipo, id]);
        }
        db.run(
            `UPDATE indirizzi SET tipo = ?, via = ?, civico = ?, cap = ?, comune = ?, provincia = ?, stato = ?, data_inizio = ?, data_fine = ?, is_corrente = ?, note = ?, last_modified = ? WHERE id = ?`,
            [args.tipo, args.via || '', args.civico || '', args.cap || '', args.comune || '', args.provincia || '', args.stato || 'Italia', args.data_inizio || '', args.data_fine || '', isCorrente, args.note || '', now, id]
        );
        const rows = db.query('SELECT * FROM indirizzi WHERE id = ?', [id]);
        if (rows.length > 0) wrapMutationWithEvent('UPDATE', 'indirizzi', id, { ...rowToIndirizzo(rows[0]), _actor_user_id: args.actorUserId || '' });
        saveDB('app_anagrafica');
        notifyDataChanged('indirizzi', [id]);
        return { success: true };
    } catch (e) {
        console.error('[AnagraficaResidenzaHandler] update error:', e);
        throw new Error(e.message || "Impossibile aggiornare l'indirizzo");
    }
}
async function remove(event, args) {
    try {
        const { id } = args;
        if (!id) throw new Error('ID mancante');
        const db = getDB('app_anagrafica');
        const now = Date.now();
        db.run('UPDATE indirizzi SET is_deleted = 1, last_modified = ? WHERE id = ?', [now, id]);
        const rows = db.query('SELECT * FROM indirizzi WHERE id = ?', [id]);
        if (rows.length > 0) wrapMutationWithEvent('UPDATE', 'indirizzi', id, { ...rowToIndirizzo(rows[0]), _actor_user_id: args.actorUserId || '' });
        saveDB('app_anagrafica');
        notifyDataChanged('indirizzi', [id]);
        return { success: true };
    } catch (e) {
        console.error('[AnagraficaResidenzaHandler] remove error:', e);
        throw new Error(e.message || "Impossibile eliminare l'indirizzo");
    }
}
module.exports = { getByPersona, create, update, remove };
