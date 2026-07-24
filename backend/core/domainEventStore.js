'use strict';

const crypto = require('crypto');
const { getDB, saveDB } = require('../db');
const auditLogger = require('../observability/auditLogger');

class DomainEventStore {
    constructor() {
        try {
            this._listeners = new Map();
            this._initSchema();
        } catch (e) {}
    }

    _initSchema() {
        try {
            const db = getDB('ledger');
            if (db) {
                db.run(`
                    CREATE TABLE IF NOT EXISTS domain_events (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        event_id TEXT UNIQUE NOT NULL,
                        event_name TEXT NOT NULL,
                        aggregate_id TEXT NOT NULL,
                        actor_id TEXT NOT NULL,
                        payload TEXT NOT NULL,
                        timestamp INTEGER NOT NULL,
                        vector_clock TEXT
                    );
                    CREATE INDEX IF NOT EXISTS idx_domain_events_name ON domain_events(event_name);
                    CREATE INDEX IF NOT EXISTS idx_domain_events_aggregate ON domain_events(aggregate_id);
                `);
                saveDB('ledger');
            }
        } catch (e) {}
    }

    publishEvent(eventName, aggregateId, actorId, payload) {
        try {
            const eventId = `evt_${crypto.randomBytes(12).toString('hex')}`;
            const ts = Math.floor(Date.now() / 1000);
            const payloadStr = JSON.stringify(payload || {});
            const vectorClock = JSON.stringify({ ts, node: 'local' });

            const db = getDB('ledger');
            if (db) {
                db.run(
                    `INSERT INTO domain_events (event_id, event_name, aggregate_id, actor_id, payload, timestamp, vector_clock)
                     VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [eventId, eventName, aggregateId, actorId || 'system', payloadStr, ts, vectorClock]
                );
                saveDB('ledger');
            }

            if (this._listeners.has(eventName)) {
                const callbacks = this._listeners.get(eventName);
                callbacks.forEach(cb => {
                    try {
                        cb({ eventId, eventName, aggregateId, actorId, payload, timestamp: ts });
                    } catch (eCb) {}
                });
            }

            auditLogger.logEvent(actorId || 'system', 'DOMAIN_EVENT_PUBLISHED', eventName, aggregateId);
            return { success: true, eventId };
        } catch (e) {
            return { success: false, error: e.message };
        }
    }

    subscribe(eventName, callbackFn) {
        try {
            if (!this._listeners.has(eventName)) {
                this._listeners.set(eventName, []);
            }
            this._listeners.get(eventName).push(callbackFn);
            return true;
        } catch (e) {
            return false;
        }
    }

    getEvents(eventName = null, aggregateId = null, limit = 100) {
        try {
            const db = getDB('ledger');
            if (!db) return [];

            let query = `SELECT * FROM domain_events WHERE 1=1`;
            const params = [];

            if (eventName) {
                query += ` AND event_name = ?`;
                params.push(eventName);
            }
            if (aggregateId) {
                query += ` AND aggregate_id = ?`;
                params.push(aggregateId);
            }

            query += ` ORDER BY id DESC LIMIT ?`;
            params.push(limit);

            return db.query(query, params);
        } catch (e) {
            return [];
        }
    }
}

module.exports = new DomainEventStore();
