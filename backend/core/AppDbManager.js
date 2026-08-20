'use strict';
const dbManager = require('../db/db_manager');
const _loadedNamespaces = new Set();
async function getOrCreate(namespace, migrations = []) {
    try {
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
        return dbManager.getDB(domain);
    } catch (err) {
        return null;
    }
}
function get(namespace) {
    try {
        return dbManager.getDB(`app_${namespace}`);
    } catch (err) {
        return null;
    }
}
async function save(namespace) {
    try {
        return await dbManager.saveDatabase(`app_${namespace}`);
    } catch (err) {
        return false;
    }
}
function isLoaded(namespace) {
    try {
        return _loadedNamespaces.has(namespace);
    } catch (err) {
        return false;
    }
}
function getLoadedNamespaces() {
    try {
        return Array.from(_loadedNamespaces);
    } catch (err) {
        return [];
    }
}
module.exports = { getOrCreate, get, save, isLoaded, getLoadedNamespaces };

