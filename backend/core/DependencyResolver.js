'use strict';

/**
 * DependencyResolver — risolve le dipendenze tra app del marketplace.
 *
 * Dipendenze con prefisso "core:" (es. "core:users") sono sempre disponibili
 * perché fanno parte del Platform Core. Non vanno installate.
 */

const CORE_MODULES = new Set([
    'core:users',
    'core:rbac',
    'core:auth',
    'core:notifications',
    'core:session',
]);

function _getDepIds(manifest) {
    if (!manifest || !manifest.dependencies) return [];
    if (Array.isArray(manifest.dependencies)) return manifest.dependencies;
    if (typeof manifest.dependencies === 'object') return Object.keys(manifest.dependencies);
    return [];
}

/**
 * Calcola l'ordine di installazione per appId e tutte le sue dipendenze.
 * Le dipendenze vengono prima dell'app stessa (topological sort DFS).
 *
 * @param {string}   appId          — ID dell'app da installare
 * @param {Object[]} availableApps  — app disponibili nello store (array di manifest)
 * @param {string[]} installedApps  — ID delle app già installate
 * @returns {string[]} ordine di installazione (deps prima, l'app per ultima)
 * @throws {Error} se una dipendenza non è disponibile nello store
 */
function resolve(appId, availableApps, installedApps = []) {
    const available = new Map(availableApps.map(a => [a.id, a]));
    const installed = new Set(Array.isArray(installedApps)
        ? installedApps.map(a => (typeof a === 'string' ? a : a.id))
        : []);
    const result = [];
    const visited = new Set();

    function visit(id) {
        if (CORE_MODULES.has(id)) return;
        if (installed.has(id)) return;
        if (visited.has(id)) return;

        const manifest = available.get(id);
        if (!manifest) {
            throw new Error(`Dipendenza "${id}" non trovata nello store. Impossibile procedere.`);
        }

        visited.add(id);
        const deps = _getDepIds(manifest);
        for (const dep of deps) {
            visit(dep);
        }
        result.push(id);
    }

    visit(appId);
    return result;
}

/**
 * Restituisce le dipendenze di appId che non sono ancora installate.
 *
 * @returns {string[]} array di app ID da installare prima
 */
function getMissingDeps(appId, availableApps, installedApps = []) {
    const available = new Map(availableApps.map(a => [a.id, a]));
    const installed = new Set(Array.isArray(installedApps)
        ? installedApps.map(a => (typeof a === 'string' ? a : a.id))
        : []);
    const manifest = available.get(appId);
    if (!manifest) return [];

    const deps = _getDepIds(manifest);
    return deps.filter(dep => {
        if (CORE_MODULES.has(dep)) return false;
        return !installed.has(dep);
    });
}

/**
 * Verifica se un'app può essere disinstallata.
 * Un'app non può essere rimossa se altre app installate dipendono da essa.
 *
 * @returns {{ canUninstall: boolean, blockedBy: string[] }}
 */
function canUninstall(appId, installedApps, availableApps) {
    const available = new Map(availableApps.map(a => [a.id, a]));
    const blockedBy = [];

    for (const app of installedApps) {
        const id = typeof app === 'string' ? app : app.id;
        if (id === appId) continue;
        const manifest = available.get(id);
        if (!manifest) continue;
        
        const deps = _getDepIds(manifest);
        if (deps.includes(appId)) {
            blockedBy.push(id);
        }
    }

    return { canUninstall: blockedBy.length === 0, blockedBy };
}

/** Verifica se un ID è un modulo core (non installabile). */
function isCoreModule(id) {
    return CORE_MODULES.has(id);
}

module.exports = { resolve, getMissingDeps, canUninstall, isCoreModule, CORE_MODULES };
