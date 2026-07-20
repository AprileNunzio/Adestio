'use strict';
const dbManager = require('../db/db_manager');
const _loadedNamespaces = new Set();
async function getOrCreate(namespace, migrations = []) {
    const domain = `app_${namespace}`;
    try {
        const existing = dbManager.getDB(domain);
        if (existing) return existing;
    } catch (e) {
        if (e.message !== 'DB_NOT_INITIALIZED') throw e;
    }
    if (!(domain in dbManager.databases)) {
        dbManager.databases[domain] = null;
    }
    await dbManager.loadDatabase(domain, migrations);
    _loadedNamespaces.add(namespace);
    console.log(`[AppDbManager] DB "${domain}" caricato.`);
    return dbManager.getDB(domain);
}
function get(namespace) {
    return dbManager.getDB(`app_${namespace}`);
}
async function save(namespace) {
    return dbManager.saveDatabase(`app_${namespace}`);
}
function isLoaded(namespace) {
    return _loadedNamespaces.has(namespace);
}
function getLoadedNamespaces() {
    return Array.from(_loadedNamespaces);
}
module.exports = { getOrCreate, get, save, isLoaded, getLoadedNamespaces };
