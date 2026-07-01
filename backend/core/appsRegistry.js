const path = require('path');
const fs = require('fs');
async function getAppsRegistry() {
    try {
        const appsPath = path.join(__dirname, '../../src', 'apps');
        if (!fs.existsSync(appsPath)) return [];
        const apps = [];
        const dirs = fs.readdirSync(appsPath, { withFileTypes: true });
        for (const d of dirs) {
            if (d.isDirectory()) {
                const manifestPath = path.join(appsPath, d.name, 'manifest.json');
                if (fs.existsSync(manifestPath)) {
                    try {
                        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
                        manifest.folder = d.name; 
                        manifest.id = manifest.id || d.name; 
                        apps.push(manifest);
                    } catch(e) { console.error("[AppsRegistry] Error parsing manifest", e); }
                }
            }
        }
        return apps;
    } catch(e) {
        console.error("[AppsRegistry] Error reading apps registry", e);
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
