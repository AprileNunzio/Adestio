const path = require('path');
const fs = require('fs');

// Immagini "per convenzione" cercate nella cartella dell'app/sotto-app.
const ICON_FILE_CANDIDATES = ['icon.png', 'icona.png', 'icon.svg', 'icon.jpg', 'icon.jpeg', 'icon.webp', 'icon.gif'];

/**
 * Risolve quale icona usare, dando SEMPRE priorità a un file immagine presente
 * nella cartella rispetto a un'icona MD3 dichiarata nel manifest.
 * Priorità: 1) file immagine esplicito nel manifest (se esiste) →
 *           2) immagine "per convenzione" nella cartella (icon.png, icona.png, …) →
 *           3) nome icona MD3 dal manifest → 4) icona MD3 di default.
 */
function resolveIconName(dir, manifestIcon, defaultMd3) {
    const folderImage = ICON_FILE_CANDIDATES.find(f => fs.existsSync(path.join(dir, f)));
    if (manifestIcon && manifestIcon.includes('.')) {
        // Il manifest punta a un file immagine specifico: lo rispetto se esiste,
        // altrimenti ripiego su un'immagine della cartella o sul default MD3.
        if (fs.existsSync(path.join(dir, manifestIcon))) return manifestIcon;
        return folderImage || defaultMd3;
    }
    // Il manifest indica un'icona MD3 (o niente): un'immagine reale nella cartella vince.
    if (folderImage) return folderImage;
    return manifestIcon || defaultMd3;
}

async function getAppsRegistry() {
    try {
        const { app } = require('electron');
        const apps = [];
        
        // 1. Core Apps (sola lettura in app.asar)
        const coreAppsPath = path.join(__dirname, '../../src', 'apps');
        if (fs.existsSync(coreAppsPath)) {
            const dirs = fs.readdirSync(coreAppsPath, { withFileTypes: true });
            for (const d of dirs) {
                if (d.isDirectory()) {
                    const manifestPath = path.join(coreAppsPath, d.name, 'manifest.json');
                    if (fs.existsSync(manifestPath)) {
                        try {
                            const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
                            manifest.folder = d.name;
                            manifest.id = manifest.id || d.name;
                            manifest.icon = resolveIconName(path.join(coreAppsPath, d.name), manifest.icon, 'widgets');
                            manifest.appPath = path.join(coreAppsPath, d.name); // path assoluto
                            apps.push(manifest);
                        } catch(e) { console.error("[AppsRegistry] Error parsing core manifest", e); }
                    }
                }
            }
        }

        // 2. Installed Apps (leggibili/scrivibili in AppData)
        if (app) {
            const userAppsPath = path.join(app.getPath('userData'), 'installed_apps');
            if (fs.existsSync(userAppsPath)) {
                const dirs = fs.readdirSync(userAppsPath, { withFileTypes: true });
                for (const d of dirs) {
                    if (d.isDirectory()) {
                        const manifestPath = path.join(userAppsPath, d.name, 'manifest.json');
                        if (fs.existsSync(manifestPath)) {
                            try {
                                const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
                                manifest.folder = d.name;
                                manifest.id = manifest.id || d.name;
                                manifest.icon = resolveIconName(path.join(userAppsPath, d.name), manifest.icon, 'widgets');
                                manifest.appPath = path.join(userAppsPath, d.name); // path assoluto
                                
                                // Sovrascrivi se esiste già (es. utente ha scaricato update di un'app core)
                                const existingIdx = apps.findIndex(a => a.id === manifest.id);
                                if (existingIdx >= 0) apps[existingIdx] = manifest;
                                else apps.push(manifest);
                            } catch(e) { console.error("[AppsRegistry] Error parsing user manifest", e); }
                        }
                    }
                }
            }
        }

        return apps;
    } catch (e) {
        console.error('[AppsRegistry] getAppsRegistry() fault:', e.message);
        return [];
    }
}
async function getSubAppsRegistry(event, appId) {
    try {
        const subAppsPath = path.join(__dirname, '../../src', 'apps', appId, 'subapps');
        if (!fs.existsSync(subAppsPath)) return [];
        const apps = [];
        const dirs = fs.readdirSync(subAppsPath, { withFileTypes: true });
        for (const d of dirs) {
            if (d.isDirectory()) {
                const manifestPath = path.join(subAppsPath, d.name, 'manifest.json');
                if (fs.existsSync(manifestPath)) {
                    try {
                        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
                        manifest.folder = d.name;
                        manifest.id = manifest.id || d.name;
                        manifest.icon = resolveIconName(path.join(subAppsPath, d.name), manifest.icon, 'extension');

                        apps.push(manifest);
                    } catch(e) { console.error("[AppsRegistry] Error parsing subapp manifest", e); }
                }
            }
        }
        return apps;
    } catch(e) {
        console.error("[AppsRegistry] Error reading subapps registry", e);
        return [];
    }
}
module.exports = {
    getAppsRegistry,
    getSubAppsRegistry
};
