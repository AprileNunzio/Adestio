'use strict';
const crypto = require('crypto');
const { getDB, saveDB, wrapMutationWithEvent } = require('../db');
const { BrowserWindow } = require('electron');
function _esc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
const CATEGORIES = ['security', 'sync', 'system', 'network'];
class NotificationManager {
        static async dispatch({ userId, category, title, message, severity = 'info', metadata = null }) {
        if (!CATEGORIES.includes(category)) {
            console.error('[NotificationManager] Categoria non valida:', category);
            return { success: false, error: 'Categoria non valida' };
        }
        try {
            const db = getDB();
            const ts = Date.now();
            const id = crypto.randomUUID();
            const metadataStr = metadata ? JSON.stringify(metadata) : null;
            const payloadDb = { 
                id, user_id: userId, category, title, 
                message: message || '', severity, is_read: 0, 
                created_at: ts, is_deleted: 0, last_modified: ts,
                metadata: metadataStr
            };
            db.run(
                'INSERT INTO notifications (id, user_id, category, title, message, severity, is_read, created_at, is_deleted, last_modified, metadata) VALUES (?, ?, ?, ?, ?, ?, 0, ?, 0, ?, ?)',
                [id, userId, category, title, message || '', severity, ts, ts, metadataStr]
            );
            wrapMutationWithEvent('INSERT', 'notifications', id, payloadDb);
            await saveDB();
            const prefRows = db.query('SELECT * FROM notification_preferences WHERE user_id = ? AND category = ? AND is_deleted = 0', [userId, category]);
            const inAppEnabled = prefRows.length > 0 ? !!prefRows[0].in_app : true; 
            const emailEnabled = prefRows.length > 0 ? !!prefRows[0].email : false; 
            const soundEnabled = prefRows.length > 0 ? !!prefRows[0].sound : true;  
            if (inAppEnabled) {
                this.sendInApp(userId, { ...payloadDb, metadata }, soundEnabled);
            }
            if (emailEnabled && (severity === 'error' || severity === 'warning')) {
                this.sendEmail(userId, title, message || '');
            }
            return { success: true, id };
        } catch (e) {
            console.error('[NotificationManager] Dispatch error:', e.message);
            return { success: false, error: e.message };
        }
    }
    static sendInApp(userId, payload, soundEnabled) {
        // Broadcast via IPC to all windows to show a real-time toast
        const windows = BrowserWindow.getAllWindows();
        windows.forEach(win => {
            if (!win.isDestroyed()) {
                win.webContents.send('notification:new', { ...payload, playSound: soundEnabled });
            }
        });
    }
    static async sendEmail(userId, title, message) {
        try {
            const configHandlers = require('../handlers/config');
            const config = configHandlers.readConfig(null);
            if (!config || !config.smtp_host || !config.smtp_user) return;
            const db = getDB();
            const rows = db.query('SELECT email FROM users WHERE id = ?', [userId]);
            const toEmail = rows && rows.length > 0 ? rows[0].email : '';
            if (!toEmail) return;
            const nodemailer = require('nodemailer');
            let secure = config.smtp_security === 'ssl' || config.smtp_port == 465;
            const transportOpts = {
                host: config.smtp_host,
                port: parseInt(config.smtp_port) || 587,
                secure,
                auth: { user: config.smtp_user, pass: config.smtp_pass },
                tls: { rejectUnauthorized: !config.smtp_allow_self_signed }
            };
            if (config.smtp_security === 'starttls') {
                transportOpts.secure = false;
                transportOpts.requireTLS = true;
            } else if (config.smtp_security === 'none') {
                transportOpts.secure = false;
                transportOpts.ignoreTLS = true;
            }
            const transporter = nodemailer.createTransport(transportOpts);
            const fromStr = config.smtp_sender_name ? `"${config.smtp_sender_name}" <${config.smtp_sender_email}>` : config.smtp_sender_email;
            await transporter.sendMail({
                from: fromStr,
                to: toEmail,
                subject: `Adestio - ${title}`,
                text: message,
                html: `<div style="font-family: sans-serif; padding: 20px;"><h2>${_esc(title)}</h2><p>${_esc(message)}</p></div>`
            });
        } catch (e) {
            console.error('[NotificationManager] sendEmail error:', e.message);
        }
    }
}
module.exports = NotificationManager;
