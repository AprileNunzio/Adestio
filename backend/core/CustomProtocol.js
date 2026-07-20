'use strict';
const { protocol, net, app } = require('electron');
const path = require('path');
const fs = require('fs');

function registerCustomProtocol() {
    // Protocollo per servire le app di terze parti in modo sicuro
    protocol.handle('adestio-app', async (request) => {
        try {
            const url = new URL(request.url);
            // Il formato atteso è adestio-app://<app_id>/<file_path>
            const appId = url.hostname;
            let filePath = decodeURIComponent(url.pathname);
            if (filePath.startsWith('/')) {
                filePath = filePath.substring(1);
            }

            const appsDir = path.join(app.getPath('userData'), 'installed_apps');
            const targetAppDir = path.join(appsDir, appId);

            if (!fs.existsSync(targetAppDir)) {
                return new Response('App non trovata', { status: 404 });
            }

            // Evita directory traversal attacks (es. ../../)
            let absolutePath = path.resolve(targetAppDir, filePath);
            
            // Permetti alle app esterne di importare utility core (es. ../../js/utils.js)
            // che il browser risolve in adestio-app://<app_id>/js/utils.js
            if (filePath.startsWith('js/') || filePath.startsWith('css/') || filePath.startsWith('assets/')) {
                const coreSrcPath = app.isPackaged 
                    ? path.join(process.resourcesPath, 'app.asar', 'src')
                    : path.join(__dirname, '..', '..', 'src');
                absolutePath = path.resolve(coreSrcPath, filePath);
            } else {
                if (!absolutePath.startsWith(path.resolve(targetAppDir))) {
                    return new Response('Accesso negato', { status: 403 });
                }
            }

            if (!fs.existsSync(absolutePath)) {
                return new Response('File non trovato', { status: 404 });
            }

            if (request.method === 'OPTIONS') {
                return new Response(null, {
                    status: 204,
                    headers: {
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
                        'Access-Control-Allow-Headers': '*'
                    }
                });
            }

            // Otteniamo il file usando net.fetch (che gestisce automaticamente il MIME type)
            const response = await net.fetch(`file:///${absolutePath.replace(/\\/g, '/')}`);
            const newHeaders = new Headers(response.headers);
            newHeaders.set('Access-Control-Allow-Origin', '*');
            
            return new Response(response.body, {
                status: response.status,
                statusText: response.statusText,
                headers: newHeaders
            });
        } catch (e) {
            console.error('[CustomProtocol] Errore:', e);
            return new Response('Internal Server Error', { status: 500 });
        }
    });
}

module.exports = { registerCustomProtocol };
