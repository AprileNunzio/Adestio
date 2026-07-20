'use strict';
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
function isCoreModule(id) {
    return CORE_MODULES.has(id);
}
module.exports = { resolve, getMissingDeps, canUninstall, isCoreModule, CORE_MODULES };
