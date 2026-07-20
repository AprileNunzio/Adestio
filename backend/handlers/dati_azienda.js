const crypto = require('crypto');
const db = require('../db');

function _generateId() {
    return crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');
}

function getSedi() {
    try {
        const aziendaDb = db.getDB('app_azienda');
        const rows = aziendaDb.query('SELECT * FROM azienda_sedi');
        
        return rows.map(row => {
            if (row.orari) {
                try {
                    row.orari = JSON.parse(row.orari);
                } catch (e) {
                    row.orari = {};
                }
            } else {
                row.orari = {};
            }
            return row;
        });
    } catch (e) {
        console.error('[Azienda Handler] Errore in getSedi:', e);
        throw e;
    }
}

async function getSedeById(id) {
    try {
        const aziendaDb = db.getDB('app_azienda');
        const rows = aziendaDb.query('SELECT * FROM azienda_sedi WHERE id = ?', [id]);
        if (rows.length === 0) return null;
        
        const row = rows[0];
        if (row.orari) {
            try {
                row.orari = JSON.parse(row.orari);
            } catch (e) {
                row.orari = {};
            }
        }
        return row;
    } catch (e) {
        console.error('[Azienda Handler] Errore in getSedeById:', e);
        throw e;
    }
}

async function saveSede(sede) {
    try {
        const aziendaDb = db.getDB('app_azienda');
        const isUpdate = !!sede.id;
        const id = sede.id || _generateId();
        
        const orariStr = typeof sede.orari === 'object' ? JSON.stringify(sede.orari) : sede.orari || '{}';

        if (isUpdate) {
            await aziendaDb.execute(`
                UPDATE azienda_sedi SET 
                    nome = ?, indirizzo = ?, cap = ?, citta = ?, provincia = ?, nazione = ?, telefono = ?, email = ?, orari = ?, is_centrale = ?, responsabile_persona_id = ?
                WHERE id = ?
            `, [
                sede.nome || '', sede.indirizzo || '', sede.cap || '', sede.citta || '', sede.provincia || '', sede.nazione || '', 
                sede.telefono || '', sede.email || '', orariStr, sede.is_centrale ? 1 : 0, sede.responsabile_persona_id || null, 
                id
            ]);
        } else {
            await aziendaDb.execute(`
                INSERT INTO azienda_sedi (id, nome, indirizzo, cap, citta, provincia, nazione, telefono, email, orari, is_centrale, responsabile_persona_id) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                id, sede.nome || '', sede.indirizzo || '', sede.cap || '', sede.citta || '', sede.provincia || '', sede.nazione || '', 
                sede.telefono || '', sede.email || '', orariStr, sede.is_centrale ? 1 : 0, sede.responsabile_persona_id || null
            ]);
        }
        
        await db.saveDB('app_azienda');
        return await getSedeById(id);
    } catch (e) {
        console.error('[Azienda Handler] Errore in saveSede:', e);
        throw e;
    }
}

async function deleteSede(id) {
    try {
        const aziendaDb = db.getDB('app_azienda');
        await aziendaDb.execute('DELETE FROM azienda_sedi WHERE id = ?', [id]);
        await db.saveDB('app_azienda');
        return true;
    } catch (e) {
        console.error('[Azienda Handler] Errore in deleteSede:', e);
        throw e;
    }
}

module.exports = {
    getSedi,
    getSedeById,
    saveSede,
    deleteSede
};
