const express = require('express');
const path = require('path');
const PORT = 34570;
const HOST = 'localhost';
let _server = null;
let _url = null;
function startLocalAppServer() {
    return new Promise((resolve) => {
        try {
            const app = express();
            app.use((req, res, next) => {
                try {
                    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
                    res.setHeader('Pragma', 'no-cache');
                    res.setHeader('Expires', '0');
                    res.setHeader('Surrogate-Control', 'no-store');
                    next();
                } catch (err) {
                    next();
                }
            });
            app.use(express.static(path.join(__dirname, '../../src'), {
                etag: false,
                maxAge: 0,
                setHeaders: (res) => {
                    try {
                        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
                        res.setHeader('Pragma', 'no-cache');
                        res.setHeader('Expires', '0');
                        res.setHeader('Surrogate-Control', 'no-store');
                    } catch (e) {}
                }
            }));
            _server = app.listen(PORT, '127.0.0.1', () => {
                _url = `http://${HOST}:${PORT}/index.html`;
                resolve(_url);
            });
            _server.on('error', (e) => {
                console.error('[LocalAppServer] Errore avvio:', e.message);
                _server = null;
                _url = null;
                resolve(null);
            });
        } catch (e) {
            console.error('[LocalAppServer] Errore avvio:', e.message);
            resolve(null);
        }
    });
}
function getLocalAppUrl() {
    return _url;
}
module.exports = { startLocalAppServer, getLocalAppUrl, PORT, HOST };
