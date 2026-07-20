const crypto = require('crypto');
const { getDB, saveDB, wrapMutationWithEvent } = require('../db');

const CATEGORIES = ['security', 'sync', 'system', 'network'];
const CATEGORY_LABELS = {
    security: 'Sicurezza',
    sync: 'Sincronizzazione',
    system: 'Sistema',
    network: 'Rete'
};
const DEFAULT_PREF = { in_app: 1, email: 0, sound: 1 };

async function getPreferences(event, userId) {
    try {
        const db = getDB();
        const rows = db.query('SELECT * FROM notification_preferences WHERE user_id = ? AND is_deleted = 0', [userId]);
        const byCategory = {};
        rows.forEach(r => { byCategory[r.category] = r; });
        const preferences = CATEGORIES.map(category => {
            const row = byCategory[category];
            return {
                category,
                label: CATEGORY_LABELS[category],
                in_app: row ? !!row.in_app : !!DEFAULT_PREF.in_app,
                email: row ? !!row.email : !!DEFAULT_PREF.email,
                sound: row ? !!row.sound : !!DEFAULT_PREF.sound
            };
        });
        return { success: true, preferences };
    } catch (e) {
        console.error('[Notifications] getPreferences error:', e.message);
        return { success: false, error: e.message };
    }
}

async function setPreference(event, { userId, category, in_app, email, sound }) {
    try {
        if (!CATEGORIES.includes(category)) return { success: false, error: 'Categoria non valida' };
        const db = getDB();
        const ts = Date.now();
        const existing = db.query('SELECT * FROM notification_preferences WHERE user_id = ? AND category = ? AND is_deleted = 0', [userId, category]);
        if (existing.length > 0) {
            const row = existing[0];
            db.run('UPDATE notification_preferences SET in_app = ?, email = ?, sound = ?, updated_at = ?, last_modified = ? WHERE id = ?',
                [in_app ? 1 : 0, email ? 1 : 0, sound ? 1 : 0, ts, ts, row.id]);
            wrapMutationWithEvent('UPDATE', 'notification_preferences', row.id, { ...row, in_app: in_app ? 1 : 0, email: email ? 1 : 0, sound: sound ? 1 : 0, updated_at: ts, last_modified: ts });
        } else {
            const id = crypto.randomUUID();
            const payload = { id, user_id: userId, category, in_app: in_app ? 1 : 0, email: email ? 1 : 0, sound: sound ? 1 : 0, updated_at: ts, is_deleted: 0, last_modified: ts };
            db.run('INSERT INTO notification_preferences (id, user_id, category, in_app, email, sound, updated_at, is_deleted, last_modified) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)',
                [id, userId, category, in_app ? 1 : 0, email ? 1 : 0, sound ? 1 : 0, ts, ts]);
            wrapMutationWithEvent('INSERT', 'notification_preferences', id, payload);
        }
        await saveDB();
        return { success: true };
    } catch (e) {
        console.error('[Notifications] setPreference error:', e.message);
        return { success: false, error: e.message };
    }
}

async function list(event, { userId, unreadOnly, page = 1, pageSize = 30 }) {
    try {
        const db = getDB();
        const where = ['user_id = ?', 'is_deleted = 0'];
        const params = [userId];
        if (unreadOnly) where.push('is_read = 0');
        const whereSql = where.join(' AND ');
        const totalRows = db.query(`SELECT COUNT(*) as cnt FROM notifications WHERE ${whereSql}`, params);
        const total = totalRows && totalRows.length > 0 ? totalRows[0].cnt : 0;
        const unreadRows = db.query('SELECT COUNT(*) as cnt FROM notifications WHERE user_id = ? AND is_deleted = 0 AND is_read = 0', [userId]);
        const unreadCount = unreadRows && unreadRows.length > 0 ? unreadRows[0].cnt : 0;
        const safePageSize = Math.min(Math.max(Number(pageSize) || 30, 1), 200);
        const offset = Math.max((Number(page) || 1) - 1, 0) * safePageSize;
        const notifications = db.query(
            `SELECT * FROM notifications WHERE ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
            [...params, safePageSize, offset]
        );
        return { success: true, notifications, total, unreadCount, page: Number(page) || 1, pageSize: safePageSize };
    } catch (e) {
        console.error('[Notifications] list error:', e.message);
        return { success: false, error: e.message };
    }
}

async function markRead(event, { userId, id, all }) {
    try {
        const db = getDB();
        const ts = Date.now();
        if (all) {
            const rows = db.query('SELECT id FROM notifications WHERE user_id = ? AND is_read = 0 AND is_deleted = 0', [userId]);
            db.run('UPDATE notifications SET is_read = 1, last_modified = ? WHERE user_id = ? AND is_read = 0 AND is_deleted = 0', [ts, userId]);
            rows.forEach(r => wrapMutationWithEvent('UPDATE', 'notifications', r.id, { id: r.id, is_read: 1, last_modified: ts }));
        } else if (id) {
            db.run('UPDATE notifications SET is_read = 1, last_modified = ? WHERE id = ? AND user_id = ?', [ts, id, userId]);
            wrapMutationWithEvent('UPDATE', 'notifications', id, { id, is_read: 1, last_modified: ts });
        }
        await saveDB();
        return { success: true };
    } catch (e) {
        console.error('[Notifications] markRead error:', e.message);
        return { success: false, error: e.message };
    }
}

// Funzione interna (esposta anche via IPC): crea una notifica passando per il nuovo NotificationManager.
async function create(payload) {
    try {
        const NotificationManager = require('../core/notificationManager');
        return await NotificationManager.dispatch(payload);
    } catch (e) {
        console.error('[Notifications] create error:', e.message);
        return { success: false, error: e.message };
    }
}

module.exports = { getPreferences, setPreference, list, markRead, create, CATEGORIES };
