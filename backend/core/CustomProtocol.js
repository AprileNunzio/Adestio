'use strict';
const { protocol, net, app } = require('electron');
const path = require('path');
const fs = require('fs');

function registerCustomProtocol() {
    // Protocollo per servire le app di terze parti in modo sicuro
    protocol.handle('adestio-app', (request) => {
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
            const absolutePath = path.resolve(targetAppDir, filePath);
            if (!absolutePath.startsWith(path.resolve(targetAppDir))) {
                return new Response('Accesso negato', { status: 403 });
            }

            if (!fs.existsSync(absolutePath)) {
                return new Response('File non trovato', { status: 404 });
            }

            // Otteniamo il file usando net.fetch (che gestisce automaticamente il MIME type)
            // Se file:// non fosse sufficiente in futuro, si potrebbe usare lo stream nativo.
            return net.fetch(`file:///${absolutePath.replace(/\\/g, '/')}`);
        } catch (e) {
            console.error('[CustomProtocol] Errore:', e);
            return new Response('Internal Server Error', { status: 500 });
        }
    });
}

module.exports = { registerCustomProtocol };
