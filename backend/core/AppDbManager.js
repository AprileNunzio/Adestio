'use strict';
const dbManager = require('../db/db_manager');

/**
 * AppDbManager — gestisce i database per-app (app_<namespace>.enc).
 *
 * Ogni app installata ottiene il proprio file cifrato separato.
 * Il dominio è "app_<namespace>" e mappa al file "app_<namespace>.enc".
 * I DB core (auth, config, ledger) restano gestiti esclusivamente da db_manager.
 */

const _loadedNamespaces = new Set();

/**
 * Inizializza il DB di un'app se non è già caricato.
 * Le migrations devono essere un array di { version: number, up(db): void }.
 */
async function getOrCreate(namespace, migrations = []) {
    const domain = `app_${namespace}`;

    // Già caricato: restituiamo direttamente
    try {
        const existing = dbManager.getDB(domain);
        if (existing) return existing;
    } catch (e) {
        if (e.message !== 'DB_NOT_INITIALIZED') throw e;
    }

    // Registra il dominio nella mappa interna di db_manager (è un plain object, è safe)
    if (!(domain in dbManager.databases)) {
        dbManager.databases[domain] = null;
    }

    await dbManager.loadDatabase(domain, migrations);
    _loadedNamespaces.add(namespace);
    console.log(`[AppDbManager] DB "${domain}" caricato.`);
    return dbManager.getDB(domain);
}

/** Restituisce il DB di un'app già caricata. Lancia se non caricato. */
function get(namespace) {
    return dbManager.getDB(`app_${namespace}`);
}

/** Persiste il DB di un'app su disco (cifrato). */
async function save(namespace) {
    return dbManager.saveDatabase(`app_${namespace}`);
}

function isLoaded(namespace) {
    return _loadedNamespaces.has(namespace);
}

/** Lista tutti i namespace app attualmente caricati. */
function getLoadedNamespaces() {
    return Array.from(_loadedNamespaces);
}

module.exports = { getOrCreate, get, save, isLoaded, getLoadedNamespaces };
