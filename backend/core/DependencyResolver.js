'use strict';

const CORE_MODULES = new Set([
    'core',
    'core:users',
    'core:rbac',
    'core:auth',
    'core:notifications',
    'core:session',
    'anagrafica',
    'gestione_personale'
]);

function _getDepIds(manifest) {
    try {
        if (!manifest || !manifest.dependencies) return [];
        if (Array.isArray(manifest.dependencies)) return manifest.dependencies;
        if (typeof manifest.dependencies === 'object' && manifest.dependencies !== null) {
            return Object.keys(manifest.dependencies);
        }
        return [];
    } catch (e) {
        return [];
    }
}

function resolve(appId, availableApps, installedApps = []) {
    try {
        const available = new Map(availableApps.map(a => [a.id, a]));
        const installed = new Set(Array.isArray(installedApps)
            ? installedApps.map(a => (typeof a === 'string' ? a : a.id))
            : []);
        const result = [];
        const visited = new Set();

        function visit(id) {
            try {
                if (!id) return;
                if (id === 'core' || id.startsWith('core:') || CORE_MODULES.has(id)) return;
                if (installed.has(id)) return;
                if (visited.has(id)) return;

                const manifest = available.get(id);
                if (!manifest) {
                    console.warn(`[DependencyResolver] Dipendenza "${id}" non presente nello store, bypassata per tolleranza.`);
                    return;
                }

                visited.add(id);
                const deps = _getDepIds(manifest);
                for (const dep of deps) {
                    visit(dep);
                }
                result.push(id);
            } catch (err) {
                console.error("[DependencyResolver] visit error:", err);
            }
        }

        visit(appId);
        if (!result.includes(appId)) {
            result.push(appId);
        }
        return result;
    } catch (e) {
        console.error("[DependencyResolver] resolve error:", e);
        return [appId];
    }
}

function getMissingDeps(appId, availableApps, installedApps = []) {
    try {
        const available = new Map(availableApps.map(a => [a.id, a]));
        const installed = new Set(Array.isArray(installedApps)
            ? installedApps.map(a => (typeof a === 'string' ? a : a.id))
            : []);
        const manifest = available.get(appId);
        if (!manifest) return [];
        const deps = _getDepIds(manifest);
        return deps.filter(dep => {
            if (!dep || dep === 'core' || dep.startsWith('core:') || CORE_MODULES.has(dep)) return false;
            return !installed.has(dep);
        });
    } catch (e) {
        return [];
    }
}

function canUninstall(appId, installedApps, availableApps) {
    try {
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
    } catch (e) {
        return { canUninstall: true, blockedBy: [] };
    }
}

function isCoreModule(id) {
    try {
        return !id || id === 'core' || id.startsWith('core:') || CORE_MODULES.has(id);
    } catch (e) {
        return false;
    }
}

module.exports = { resolve, getMissingDeps, canUninstall, isCoreModule, CORE_MODULES };
