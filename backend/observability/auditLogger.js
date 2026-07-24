'use strict';

const { getDB, saveDB } = require('../db');

function _maskPii(obj) {
    try {
        if (!obj) return obj;
        if (typeof obj === 'string') {
            return obj.replace(/(password|secret|token|credit_card|iban|codice_fiscale)=[^&,\s]+/gi, '$1=[GDPR_MASKED]');
        }
        if (typeof obj !== 'object') return obj;

        const masked = Array.isArray(obj) ? [] : {};
        for (const [key, val] of Object.entries(obj)) {
            try {
                if (/password|pass|secret|token|credit_card|card_number|cvv|iban|codice_fiscale|tax_code/i.test(key)) {
                    masked[key] = '[GDPR_MASKED]';
                } else if (val && typeof val === 'object') {
                    masked[key] = _maskPii(val);
                } else {
                    masked[key] = val;
                }
            } catch (eKey) {
                masked[key] = val;
            }
        }
        return masked;
    } catch (e) {
        return obj;
    }
}

class AuditLogger {
    constructor() {
        try {
            this._dbName = 'audit';
        } catch (e) {}
    }

    logEvent(actorId, action, targetType, targetId, details = null, result = 'SUCCESS', ipAddress = '127.0.0.1') {
        try {
            const db = getDB(this._dbName);
            if (!db) return false;
            const ts = Math.floor(Date.now() / 1000);
            const sanitizedDetails = details ? _maskPii(details) : null;
            const detailsStr = sanitizedDetails ? (typeof sanitizedDetails === 'object' ? JSON.stringify(sanitizedDetails) : String(sanitizedDetails)) : null;
            
            db.run(
                `INSERT INTO audit_log (timestamp, actor_id, action, target_type, target_id, details, ip_address, result) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [ts, String(actorId || 'system'), String(action), String(targetType), String(targetId || ''), detailsStr, String(ipAddress), String(result)]
            );
            saveDB(this._dbName);
            return true;
        } catch (e) {
            return false;
        }
    }

    getAuditLogs(filters = {}, limit = 100) {
        try {
            const db = getDB(this._dbName);
            if (!db) return [];
            let query = `SELECT * FROM audit_log WHERE 1=1`;
            const params = [];
            
            if (filters.actorId) {
                query += ` AND actor_id = ?`;
                params.push(filters.actorId);
            }
            if (filters.action) {
                query += ` AND action = ?`;
                params.push(filters.action);
            }
            if (filters.targetType) {
                query += ` AND target_type = ?`;
                params.push(filters.targetType);
            }
            query += ` ORDER BY id DESC LIMIT ?`;
            params.push(limit);
            
            return db.query(query, params);
        } catch (e) {
            return [];
        }
    }
}

module.exports = new AuditLogger();
