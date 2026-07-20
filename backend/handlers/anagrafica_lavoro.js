const crypto = require('crypto');
const { getDB, saveDB, wrapMutationWithEvent, notifyDataChanged } = require('../db');
function rowToRapporto(row) {
    return {
        id: row.id,
        persona_id: row.persona_id,
        datore_lavoro: row.datore_lavoro || '',
        mansione: row.mansione || '',
        tipo_contratto: row.tipo_contratto || '',
        sede_lavoro: row.sede_lavoro || '',
        data_inizio: row.data_inizio || '',
        data_fine: row.data_fine || '',
        is_corrente: row.is_corrente,
        note: row.note || '',
        categoria_personale: row.categoria_personale || '',
        profilo_professionale: row.profilo_professionale || '',
        ruolo: row.ruolo || '',
        ore_settimanali: row.ore_settimanali || '',
        tipo_rapporto: row.tipo_rapporto || '',
        data_stipula: row.data_stipula || '',
        anno_scolastico_inizio: row.anno_scolastico_inizio || '',
        anno_scolastico_fine: row.anno_scolastico_fine || '',
        corso_sicurezza: row.corso_sicurezza || '',
        last_modified: row.last_modified,
        is_deleted: row.is_deleted
    };
}
async function getByPersona(event, args) {
    try {
        const { personaId } = args;
        if (!personaId) throw new Error('ID persona mancante');
        const db = getDB('app_anagrafica');
        const rows = db.query('SELECT * FROM rapporti_lavoro WHERE persona_id = ? AND is_deleted = 0 ORDER BY is_corrente DESC, data_inizio DESC', [personaId]);
        return rows.map(rowToRapporto);
    } catch (e) {
        console.error('[AnagraficaLavoroHandler] getByPersona error:', e);
        throw new Error('Impossibile recuperare i rapporti di lavoro');
    }
}
async function create(event, args) {
    try {
        const { persona_id, datore_lavoro } = args;
        if (!persona_id) throw new Error('Persona non specificata');
        if (!datore_lavoro) throw new Error('Datore di lavoro obbligatorio');
        const db = getDB('app_anagrafica');
        const id = crypto.randomUUID();
        const now = Date.now();
        const isCorrente = args.is_corrente === undefined ? 1 : (args.is_corrente ? 1 : 0);
        if (isCorrente) {
            db.run('UPDATE rapporti_lavoro SET is_corrente = 0, last_modified = ? WHERE persona_id = ? AND is_corrente = 1', [now, persona_id]);
        }
        const payload = {
            id,
            persona_id,
            datore_lavoro,
            mansione: args.mansione || '',
            tipo_contratto: args.tipo_contratto || '',
            sede_lavoro: args.sede_lavoro || '',
            data_inizio: args.data_inizio || '',
            data_fine: args.data_fine || '',
            is_corrente: isCorrente,
            note: args.note || '',
            categoria_personale: args.categoria_personale || '',
            profilo_professionale: args.profilo_professionale || '',
            ruolo: args.ruolo || '',
            ore_settimanali: args.ore_settimanali || '',
            tipo_rapporto: args.tipo_rapporto || '',
            data_stipula: args.data_stipula || '',
            anno_scolastico_inizio: args.anno_scolastico_inizio || '',
            anno_scolastico_fine: args.anno_scolastico_fine || '',
            corso_sicurezza: args.corso_sicurezza || '',
            last_modified: now,
            is_deleted: 0
        };
        db.run(
            `INSERT INTO rapporti_lavoro (id, persona_id, datore_lavoro, mansione, tipo_contratto, sede_lavoro, data_inizio, data_fine, is_corrente, note, categoria_personale, profilo_professionale, ruolo, ore_settimanali, tipo_rapporto, data_stipula, anno_scolastico_inizio, anno_scolastico_fine, corso_sicurezza, last_modified, is_deleted)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
            [payload.id, payload.persona_id, payload.datore_lavoro, payload.mansione, payload.tipo_contratto, payload.sede_lavoro, payload.data_inizio, payload.data_fine, payload.is_corrente, payload.note, payload.categoria_personale, payload.profilo_professionale, payload.ruolo, payload.ore_settimanali, payload.tipo_rapporto, payload.data_stipula, payload.anno_scolastico_inizio, payload.anno_scolastico_fine, payload.corso_sicurezza, payload.last_modified]
        );
        wrapMutationWithEvent('INSERT', 'rapporti_lavoro', id, { ...payload, _actor_user_id: args.actorUserId || '' });
        saveDB('app_anagrafica');
        notifyDataChanged('rapporti_lavoro', [id]);
        return { success: true, id };
    } catch (e) {
        console.error('[AnagraficaLavoroHandler] create error:', e);
        throw new Error(e.message || 'Impossibile creare il rapporto di lavoro');
    }
}
async function update(event, args) {
    try {
        const { id } = args;
        if (!id) throw new Error('ID mancante');
        if (!args.datore_lavoro) throw new Error('Datore di lavoro obbligatorio');
        const db = getDB('app_anagrafica');
        const now = Date.now();
        const isCorrente = args.is_corrente === undefined ? 1 : (args.is_corrente ? 1 : 0);
        const existing = db.query('SELECT persona_id FROM rapporti_lavoro WHERE id = ?', [id]);
        if (existing.length === 0) throw new Error('Rapporto di lavoro non trovato');
        if (isCorrente) {
            db.run('UPDATE rapporti_lavoro SET is_corrente = 0, last_modified = ? WHERE persona_id = ? AND id != ? AND is_corrente = 1', [now, existing[0].persona_id, id]);
        }
        db.run(
            `UPDATE rapporti_lavoro SET datore_lavoro = ?, mansione = ?, tipo_contratto = ?, sede_lavoro = ?, data_inizio = ?, data_fine = ?, is_corrente = ?, note = ?, categoria_personale = ?, profilo_professionale = ?, ruolo = ?, ore_settimanali = ?, tipo_rapporto = ?, data_stipula = ?, anno_scolastico_inizio = ?, anno_scolastico_fine = ?, corso_sicurezza = ?, last_modified = ? WHERE id = ?`,
            [args.datore_lavoro, args.mansione || '', args.tipo_contratto || '', args.sede_lavoro || '', args.data_inizio || '', args.data_fine || '', isCorrente, args.note || '', args.categoria_personale || '', args.profilo_professionale || '', args.ruolo || '', args.ore_settimanali || '', args.tipo_rapporto || '', args.data_stipula || '', args.anno_scolastico_inizio || '', args.anno_scolastico_fine || '', args.corso_sicurezza || '', now, id]
        );
        const rows = db.query('SELECT * FROM rapporti_lavoro WHERE id = ?', [id]);
        if (rows.length > 0) wrapMutationWithEvent('UPDATE', 'rapporti_lavoro', id, { ...rowToRapporto(rows[0]), _actor_user_id: args.actorUserId || '' });
        saveDB('app_anagrafica');
        notifyDataChanged('rapporti_lavoro', [id]);
        return { success: true };
    } catch (e) {
        console.error('[AnagraficaLavoroHandler] update error:', e);
        throw new Error(e.message || 'Impossibile aggiornare il rapporto di lavoro');
    }
}
async function remove(event, args) {
    try {
        const { id } = args;
        if (!id) throw new Error('ID mancante');
        const db = getDB('app_anagrafica');
        const now = Date.now();
        db.run('UPDATE rapporti_lavoro SET is_deleted = 1, last_modified = ? WHERE id = ?', [now, id]);
        const rows = db.query('SELECT * FROM rapporti_lavoro WHERE id = ?', [id]);
        if (rows.length > 0) wrapMutationWithEvent('UPDATE', 'rapporti_lavoro', id, { ...rowToRapporto(rows[0]), _actor_user_id: args.actorUserId || '' });
        saveDB('app_anagrafica');
        notifyDataChanged('rapporti_lavoro', [id]);
        return { success: true };
    } catch (e) {
        console.error('[AnagraficaLavoroHandler] remove error:', e);
        throw new Error(e.message || 'Impossibile eliminare il rapporto di lavoro');
    }
}
module.exports = { getByPersona, create, update, remove };
