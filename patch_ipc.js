const fs = require('fs');
let c = fs.readFileSync('backend/core/ipcRouter.js', 'utf8');

const withActorBackendCode = `
function withActorBackend(args) {
    const sessionManager = require('./session_manager');
    const actorUserId = sessionManager.getCurrentUserId() || '';
    if (args && typeof args === 'object') {
        return Object.assign({}, args, { actorUserId });
    }
    return { actorUserId };
}
`;

if (!c.includes('function withActorBackend')) {
    c = c.replace(/function registerAllIPCHandlers\(windowManager\) \{[\s\S]*?try \{/, (match) => {
        return match + '\n' + withActorBackendCode;
    });
}

// Now replace specific handlers
const routesToPatch = [
    'usersCreate', 'usersUpdate', 'usersDelete', 'usersRestore', 'usersHardDelete',
    'anagrafica:persone:create', 'anagrafica:persone:update', 'anagrafica:persone:remove', 'anagrafica:persone:restore', 'anagrafica:persone:hardDelete',
    'anagrafica:documenti:create', 'anagrafica:documenti:update', 'anagrafica:documenti:remove',
    'anagrafica:residenza:create', 'anagrafica:residenza:update', 'anagrafica:residenza:remove',
    'anagrafica:contatti:create', 'anagrafica:contatti:update', 'anagrafica:contatti:remove',
    'anagrafica:familiari:create', 'anagrafica:familiari:update', 'anagrafica:familiari:remove',
    'anagrafica:lavoro:create', 'anagrafica:lavoro:update', 'anagrafica:lavoro:remove',
    'anagrafica:titoliStudio:create', 'anagrafica:titoliStudio:update', 'anagrafica:titoliStudio:remove',
    'anagrafica:datiBancari:create', 'anagrafica:datiBancari:update', 'anagrafica:datiBancari:remove',
    'presaServizio:saveImportedPersona'
];

for (const route of routesToPatch) {
    const regex = new RegExp(`ipcMain\\.handle\\('${route}',\\s*\\(e,\\s*args\\)\\s*=>\\s*([a-zA-Z0-9_.]+)\\(([^)]+)\\)\\);`, 'g');
    c = c.replace(regex, (match, handlerFunc, handlerArgs) => {
        // e.g. handlerFunc = 'usersHandlers.create', handlerArgs = 'e, args'
        return `ipcMain.handle('${route}', (e, args) => ${handlerFunc}(e, withActorBackend(args)));`;
    });
}

fs.writeFileSync('backend/core/ipcRouter.js', c);
console.log('patched backend/core/ipcRouter.js');
