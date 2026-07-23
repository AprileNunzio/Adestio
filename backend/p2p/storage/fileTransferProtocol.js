'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

class FileTransferProtocol {
    constructor() {
        try {
            this.server = null;
            this.port = 45891;
            this.storageDir = '';
        } catch (error) {
            console.error('[FileTransferProtocol constructor Error]', error);
        }
    }

    startServer(storageDir) {
        try {
            this.storageDir = storageDir;
            if (!fs.existsSync(this.storageDir)) {
                fs.mkdirSync(this.storageDir, { recursive: true });
            }

            this.server = http.createServer((req, res) => {
                try {
                    const url = new URL(req.url, `http://${req.headers.host}`);
                    if (req.method === 'GET' && url.pathname.startsWith('/chunk/')) {
                        const chunkHash = url.pathname.replace('/chunk/', '').replace(/[^a-f0-9]/gi, '');
                        const chunkPath = path.join(this.storageDir, `${chunkHash}.chk`);

                        if (fs.existsSync(chunkPath)) {
                            res.writeHead(200, { 'Content-Type': 'application/octet-stream' });
                            fs.createReadStream(chunkPath).pipe(res);
                        } else {
                            res.writeHead(404, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ error: 'Chunk non trovato' }));
                        }
                    } else {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Richiesta non valida' }));
                    }
                } catch (reqErr) {
                    console.error('[FileTransferProtocol HTTP Server Request Error]', reqErr);
                    res.writeHead(500);
                    res.end();
                }
            });

            this.server.listen(this.port);
        } catch (error) {
            console.error('[FileTransferProtocol startServer Error]', error);
        }
    }

    downloadChunk(peerAddress, chunkHash, targetDir) {
        try {
            return new Promise((resolve, reject) => {
                try {
                    const chunkPath = path.join(targetDir, `${chunkHash}.chk`);
                    if (fs.existsSync(chunkPath)) {
                        return resolve(chunkPath);
                    }

                    const url = `http://${peerAddress}:${this.port}/chunk/${chunkHash}`;
                    const file = fs.createWriteStream(chunkPath);

                    const request = http.get(url, (response) => {
                        try {
                            if (response.statusCode !== 200) {
                                fs.unlinkSync(chunkPath);
                                return reject(new Error(`Errore HTTP ${response.statusCode}`));
                            }
                            response.pipe(file);
                            file.on('finish', () => {
                                try {
                                    file.close(() => resolve(chunkPath));
                                } catch (closeErr) {
                                    reject(closeErr);
                                }
                            });
                        } catch (resErr) {
                            reject(resErr);
                        }
                    });

                    request.on('error', (err) => {
                        try {
                            if (fs.existsSync(chunkPath)) fs.unlinkSync(chunkPath);
                        } catch (e) {}
                        reject(err);
                    });
                } catch (innerErr) {
                    reject(innerErr);
                }
            });
        } catch (error) {
            console.error('[FileTransferProtocol downloadChunk Error]', error);
            return Promise.reject(error);
        }
    }

    stopServer() {
        try {
            if (this.server) {
                this.server.close();
                this.server = null;
            }
        } catch (error) {
            console.error('[FileTransferProtocol stopServer Error]', error);
        }
    }
}

module.exports = new FileTransferProtocol();
