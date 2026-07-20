const { getDB } = require('../db');
const SUGGESTION_WHITELIST = {
    'persone.luogo_nascita': true,
    'persone.cittadinanza': true,
    'indirizzi.comune': true,
    'indirizzi.via': true,
    'indirizzi.cap': true,
    'indirizzi.stato': true,
    'rapporti_lavoro.datore_lavoro': true,
    'rapporti_lavoro.mansione': true,
    'rapporti_lavoro.sede_lavoro': true,
    'documenti_identita.ente_rilascio': true
};
async function getProvince() {
    try {
        const db = getDB('app');
        return db.query('SELECT sigla, nome FROM province ORDER BY nome');
    } catch (e) {
        console.error('[AnagraficaRiferimentiHandler] getProvince error:', e);
        return [];
    }
}
async function getNazioni() {
    try {
        const db = getDB('app');
        return db.query('SELECT nome, gentilizio FROM nazioni ORDER BY nome');
    } catch (e) {
        console.error('[AnagraficaRiferimentiHandler] getNazioni error:', e);
        return [];
    }
}
async function getSuggestions(event, args) {
    try {
        const { table, column } = args || {};
        const key = `${table}.${column}`;
        if (!SUGGESTION_WHITELIST[key]) throw new Error('Campo non abilitato ai suggerimenti');
        const db = getDB('app_anagrafica');
        const rows = db.query(
            `SELECT DISTINCT ${column} AS value FROM ${table} WHERE ${column} IS NOT NULL AND ${column} != '' AND is_deleted = 0 ORDER BY ${column} LIMIT 50`
        );
        return rows.map(r => r.value);
    } catch (e) {
        console.error('[AnagraficaRiferimentiHandler] getSuggestions error:', e);
        return [];
    }
}
module.exports = { getProvince, getNazioni, getSuggestions };
