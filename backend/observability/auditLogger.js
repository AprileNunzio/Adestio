'use strict';

const { getDB, saveDB } = require('../db');

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
            const detailsStr = details ? (typeof details === 'object' ? JSON.stringify(details) : String(details)) : null;
            
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
