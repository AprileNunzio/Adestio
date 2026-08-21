'use strict';
const { protocol, net, app } = require('electron');
const path = require('path');
const fs = require('fs');

function getMimeType(filePath) {
    try {
        const ext = path.extname(filePath).toLowerCase();
        if (ext === '.css') return 'text/css; charset=utf-8';
        if (ext === '.js') return 'text/javascript; charset=utf-8';
        if (ext === '.html') return 'text/html; charset=utf-8';
        if (ext === '.json') return 'application/json; charset=utf-8';
        if (ext === '.png') return 'image/png';
        if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
        if (ext === '.svg') return 'image/svg+xml';
        if (ext === '.woff2') return 'font/woff2';
        return null;
    } catch (e) {
        return null;
    }
}

function registerCustomProtocol() {
    try {
        protocol.handle('adestio', async (request) => {
            try {
                const url = new URL(request.url);
                let filePath = decodeURIComponent(url.pathname);
                if (filePath.startsWith('/')) {
                    filePath = filePath.substring(1);
                }
                if (!filePath) filePath = 'index.html';
                
                const coreSrcPath = app.isPackaged 
                    ? path.join(process.resourcesPath, 'app.asar', 'src')
                    : path.join(__dirname, '..', '..', 'src');
                    
                const absolutePath = path.resolve(coreSrcPath, filePath);
                
                if (!absolutePath.startsWith(path.resolve(coreSrcPath))) {
                    return new Response('Accesso negato', { status: 403 });
                }
                
                if (!fs.existsSync(absolutePath)) {
                    return new Response('File non trovato', { status: 404 });
                }
                const response = await net.fetch(`file:///${absolutePath.replace(/\\/g, '/')}`);
                const newHeaders = new Headers(response.headers);
                const mime = getMimeType(absolutePath);
                if (mime) newHeaders.set('Content-Type', mime);
                newHeaders.set('Access-Control-Allow-Origin', '*');
                newHeaders.set('Cache-Control', 'no-cache, no-store, must-revalidate');
                newHeaders.set('Pragma', 'no-cache');
                newHeaders.set('Expires', '0');

                return new Response(response.body, {
                    status: response.status,
                    statusText: response.statusText,
                    headers: newHeaders
                });
            } catch (e) {
                console.error('[CustomProtocol] Errore adestio:', e);
                return new Response('Internal Server Error', { status: 500 });
            }
        });

        protocol.handle('adestio-app', async (request) => {
            try {
                const url = new URL(request.url);
                const appId = url.hostname;
                let filePath = decodeURIComponent(url.pathname);
                if (filePath.startsWith('/')) {
                    filePath = filePath.substring(1);
                }

                const appsDir = path.join(app.getPath('userData'), 'installed_apps');
                let targetAppDir = path.join(appsDir, appId);

                if (!fs.existsSync(targetAppDir) && fs.existsSync(appsDir)) {
                    try {
                        const entries = fs.readdirSync(appsDir, { withFileTypes: true });
                        for (const ent of entries) {
                            if (ent.isDirectory()) {
                                const candidate = path.join(appsDir, ent.name);
                                const mPath = path.join(candidate, 'manifest.json');
                                if (fs.existsSync(mPath)) {
                                    try {
                                        const m = JSON.parse(fs.readFileSync(mPath, 'utf8'));
                                        if (m.id === appId || m.folder === appId || ent.name.toLowerCase() === appId.toLowerCase()) {
                                            targetAppDir = candidate;
                                            break;
                                        }
                                    } catch (eM) {}
                                }
                            }
                        }
                    } catch (eDir) {}
                }

                let absolutePath = path.resolve(targetAppDir, filePath);

                if (!fs.existsSync(absolutePath)) {
                    if (filePath === 'style.css') {
                        const cssNested = path.resolve(targetAppDir, 'css', 'style.css');
                        if (fs.existsSync(cssNested)) absolutePath = cssNested;
                    }
                }

                if (!fs.existsSync(absolutePath)) {
                    const coreSrcPath = app.isPackaged 
                        ? path.join(process.resourcesPath, 'app.asar', 'src')
                        : path.join(__dirname, '..', '..', 'src');
                    const fallbackPath = path.resolve(coreSrcPath, filePath);
                    if (fs.existsSync(fallbackPath)) {
                        absolutePath = fallbackPath;
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

                const fileBuffer = await fs.promises.readFile(absolutePath);
                const newHeaders = new Headers();
                const mime = getMimeType(absolutePath) || 'application/octet-stream';
                newHeaders.set('Content-Type', mime);
                newHeaders.set('Access-Control-Allow-Origin', '*');
                newHeaders.set('Cache-Control', 'no-cache, no-store, must-revalidate');
                newHeaders.set('Pragma', 'no-cache');
                newHeaders.set('Expires', '0');
                
                return new Response(fileBuffer, {
                    status: 200,
                    headers: newHeaders
                });
            } catch (e) {
                console.error('[CustomProtocol] Errore adestio-app:', e);
                return new Response('Internal Server Error', { status: 500 });
            }
        });
    } catch (e) {
        console.error('[CustomProtocol] Errore durante registrazione:', e);
    }
}

module.exports = { registerCustomProtocol };
