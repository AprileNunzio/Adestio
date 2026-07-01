const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { getDB, saveDB, wrapMutationWithEvent, notifyDataChanged } = require('../db');
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}
async function getAll(event, args) {
    try {
        const db = getDB();
        const res = db.exec("SELECT id, username, email, pin, last_modified, is_deleted, nome, cognome, is_superadmin, last_login FROM users");
        if (res.length === 0) return [];
        return res[0].values.map(row => ({
            id: row[0],
            username: row[1],
            email: row[2] || '',
            pin: row[3] || '',
            last_modified: row[4],
            is_deleted: row[5],
            nome: row[6] || '',
            cognome: row[7] || '',
            is_superadmin: row[8] || 0,
            last_login: row[9] || 0
        }));
    } catch (e) {
        console.error('[UsersHandler] getAll error:', e);
        throw new Error('Impossibile recuperare gli utenti');
    }
}
async function create(event, args) {
    try {
        const { nome, cognome, password, email, pin } = args;
        const username = `${cognome || ''} ${nome || ''}`.trim() || args.username; 
        if (!username || !password) throw new Error('Nome, Cognome e Password sono obbligatori');
        const db = getDB();
        const check = db.exec(`SELECT id FROM users WHERE username = '${username.replace(/'/g, "''")}'`);
        if (check.length > 0 && check[0].values.length > 0) {
            throw new Error('Username già in uso');
        }
        const id = generateUUID();
        const hashedPassword = await bcrypt.hash(password, 10);
        const now = Date.now();
        const passkey = ''; 
        db.run(
            'INSERT INTO users (id, username, password, passkey, email, pin, last_modified, is_deleted, must_change_password, nome, cognome) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 1, ?, ?)',
            [id, username, hashedPassword, passkey, email || '', pin || '', now, nome || '', cognome || '']
        );
        const payload = { id, username, password: hashedPassword, passkey, email: email || '', pin: pin || '', last_modified: now, is_deleted: 0, must_change_password: 1, nome: nome || '', cognome: cognome || '', is_superadmin: 0, last_login: 0 };
        wrapMutationWithEvent('INSERT', 'users', id, payload);
        saveDB();
        notifyDataChanged('users', [id]);
        return { success: true, id };
    } catch (e) {
        console.error('[UsersHandler] create error:', e);
        throw new Error(e.message || 'Impossibile creare utente');
    }
}
async function update(event, args) {
    try {
        const { id, nome, cognome, password, email, pin } = args;
        const username = `${cognome || ''} ${nome || ''}`.trim() || args.username;
        if (!id || !username) throw new Error('ID e Nome/Cognome sono obbligatori');
        const db = getDB();
        const check = db.exec(`SELECT id FROM users WHERE username = '${username.replace(/'/g, "''")}' AND id != '${id}'`);
        if (check.length > 0 && check[0].values.length > 0) {
            throw new Error('Nome e Cognome generano un username già in uso da un altro account');
        }
        let updateSql = 'UPDATE users SET username = ?, email = ?, pin = ?, last_modified = ?, nome = ?, cognome = ?';
        const params = [username, email || '', pin || '', Date.now(), nome || '', cognome || ''];
        let newHashedPassword = null;
        if (password && password.trim() !== '') {
            newHashedPassword = await bcrypt.hash(password, 10);
            updateSql += ', password = ?';
            params.push(newHashedPassword);
        }
        if (args.must_change_password !== undefined) {
            updateSql += ', must_change_password = ?';
            params.push(args.must_change_password);
        }
        updateSql += ' WHERE id = ?';
        params.push(id);
        db.run(updateSql, params);
        const res = db.exec(`SELECT username, password, passkey, email, pin, is_deleted, last_modified, must_change_password, nome, cognome, is_superadmin, last_login FROM users WHERE id = '${id}'`);
        if (res.length > 0 && res[0].values.length > 0) {
            const row = res[0].values[0];
            const payload = {
                id: id,
                username: row[0],
                password: row[1],
                passkey: row[2],
                email: row[3],
                pin: row[4],
                is_deleted: row[5],
                last_modified: row[6],
                must_change_password: row[7] || 0,
                nome: row[8] || '',
                cognome: row[9] || '',
                is_superadmin: row[10] || 0,
                last_login: row[11] || 0
            };
            wrapMutationWithEvent('UPDATE', 'users', id, payload);
        }
        saveDB();
        notifyDataChanged('users', [id]);
        return { success: true };
    } catch (e) {
        console.error('[UsersHandler] update error:', e);
        throw new Error(e.message || 'Impossibile aggiornare utente');
    }
}
async function remove(event, args) {
    try {
        const { id } = args;
        if (!id) throw new Error('ID mancante');
        const db = getDB();
        const now = Date.now();
        db.run('UPDATE users SET is_deleted = 1, last_modified = ? WHERE id = ?', [now, id]);
        const res = db.exec(`SELECT username, password, passkey, email, pin, is_deleted, last_modified, must_change_password, nome, cognome, is_superadmin, last_login FROM users WHERE id = '${id}'`);
        if (res.length > 0 && res[0].values.length > 0) {
            const row = res[0].values[0];
            const payload = {
                id: id,
                username: row[0],
                password: row[1],
                passkey: row[2],
                email: row[3],
                pin: row[4],
                is_deleted: row[5],
                last_modified: row[6],
                must_change_password: row[7] || 0,
                nome: row[8] || '',
                cognome: row[9] || '',
                is_superadmin: row[10] || 0,
                last_login: row[11] || 0
            };
            wrapMutationWithEvent('UPDATE', 'users', id, payload);
        }
        saveDB();
        notifyDataChanged('users', [id]);
        return { success: true };
    } catch (e) {
        console.error('[UsersHandler] remove error:', e);
        throw new Error(e.message || 'Impossibile eliminare utente');
    }
}
async function restore(event, args) {
    try {
        const { id } = args;
        if (!id) throw new Error('ID mancante');
        const db = getDB();
        const now = Date.now();
        db.run('UPDATE users SET is_deleted = 0, last_modified = ? WHERE id = ?', [now, id]);
        const res = db.exec(`SELECT username, password, passkey, email, pin, is_deleted, last_modified, must_change_password, nome, cognome, is_superadmin, last_login FROM users WHERE id = '${id}'`);
        if (res.length > 0 && res[0].values.length > 0) {
            const row = res[0].values[0];
            const payload = {
                id: id,
                username: row[0],
                password: row[1],
                passkey: row[2],
                email: row[3],
                pin: row[4],
                is_deleted: row[5],
                last_modified: row[6],
                must_change_password: row[7] || 0,
                nome: row[8] || '',
                cognome: row[9] || '',
                is_superadmin: row[10] || 0,
                last_login: row[11] || 0
            };
            wrapMutationWithEvent('UPDATE', 'users', id, payload);
        }
        saveDB();
        notifyDataChanged('users', [id]);
        return { success: true };
    } catch (e) {
        console.error('[UsersHandler] restore error:', e);
        throw new Error(e.message || 'Impossibile sbloccare utente');
    }
}
async function hardDelete(event, args) {
    try {
        const { id } = args;
        if (!id) throw new Error('ID mancante');
        const db = getDB();
        db.run('DELETE FROM users WHERE id = ?', [id]);
        wrapMutationWithEvent('DELETE', 'users', id, null);
        saveDB();
        notifyDataChanged('users', [id]);
        return { success: true };
    } catch (e) {
        console.error('[UsersHandler] hardDelete error:', e);
        throw new Error(e.message || "Impossibile eliminare definitivamente l'utente");
    }
}
module.exports = { getAll, create, update, remove, restore, hardDelete };
