'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
let _token = null;
function _tokenPath() {
    const { app } = require('electron');
    return path.join(app.getPath('userData'), 'diagnostics.token');
}
function getOrCreateToken() {
    if (_token) return _token;
    const p = _tokenPath();
    try {
        if (fs.existsSync(p)) {
            const existing = fs.readFileSync(p, 'utf8').trim();
            if (existing) { _token = existing; return _token; }
        }
    } catch (_) {}
    _token = crypto.randomBytes(32).toString('hex');
    try { fs.writeFileSync(p, _token, { mode: 0o600 }); } catch (_) {}
    return _token;
}
function verifyToken(req) {
    const header = req.headers['authorization'] || '';
    const provided = header.startsWith('Bearer ') ? header.slice(7) : header;
    return !!provided && provided === getOrCreateToken();
}
function requireAuth(req, res, next) {
    if (!verifyToken(req)) return res.status(401).json({ error: 'Unauthorized' });
    next();
}
module.exports = { getOrCreateToken, requireAuth };
