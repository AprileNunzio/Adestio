const { getDB, saveDB, wrapMutationWithEvent } = require('../db');
const fs = require('fs');
const path = require('path');
function generateId() {
    try {
        const crypto = require('crypto');
        return crypto.randomBytes(16).toString('hex');
    } catch (e) {
        console.error(e);
        throw e;
    }
}
function getTimestamp() {
    try {
        return Math.floor(Date.now() / 1000);
    } catch (e) {
        return 0;
    }
}
function rowsToObjects(res) {
    try {
        if (!res || res.length === 0) return [];
        return res[0].values.map(row =>
            res[0].columns.reduce((obj, col, i) => { obj[col] = row[i]; return obj; }, {})
        );
    } catch (e) {
        console.error(e);
        return [];
    }
}
function syncPermissionsFromManifests(event) {
    try {
        const db = getDB();
        if (!db) throw new Error('DB non inizializzato');
        const appsPath = path.join(__dirname, '..', '..', 'src', 'apps');
        if (!fs.existsSync(appsPath)) return true;
        const ts = getTimestamp();
        const dirs = fs.readdirSync(appsPath, { withFileTypes: true });
        for (const d of dirs) {
            try {
                if (!d.isDirectory()) continue;
                const manifestPath = path.join(appsPath, d.name, 'manifest.json');
                if (fs.existsSync(manifestPath)) {
                    try {
                        const m = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
                        if (m.permissions && Array.isArray(m.permissions)) {
                            for (const p of m.permissions) {
                                _upsertPermission(db, `${d.name}:${p.id}`, p, `Permesso ${p.id} per app ${d.name}`, ts);
                            }
                        }
                    } catch (e) {}
                }
                const subAppsPath = path.join(appsPath, d.name, 'subapps');
                if (fs.existsSync(subAppsPath)) {
                    const subdirs = fs.readdirSync(subAppsPath, { withFileTypes: true });
                    for (const sd of subdirs) {
                        try {
                            if (!sd.isDirectory()) continue;
                            const smPath = path.join(subAppsPath, sd.name, 'manifest.json');
                            if (fs.existsSync(smPath)) {
                                const sm = JSON.parse(fs.readFileSync(smPath, 'utf8'));
                                if (sm.permissions && Array.isArray(sm.permissions)) {
                                    for (const p of sm.permissions) {
                                        _upsertPermission(db, `${d.name}:${sd.name}:${p.id}`, p, `Permesso ${p.id} per subapp ${d.name}/${sd.name}`, ts);
                                    }
                                }
                            }
                        } catch (e) {}
                    }
                }
            } catch (e) {}
        }
        saveDB();
        return true;
    } catch (e) {
        console.error(e);
        return false;
    }
}
function _upsertPermission(db, permId, p, description, ts) {
    try {
        const chk = db.query('SELECT id FROM permissions WHERE id = ?', [permId]);
        if (chk.length > 0) return;
        db.run('INSERT INTO permissions (id, name, description, last_modified, is_deleted) VALUES (?, ?, ?, ?, 0)',
            [permId, p.label || p.id, description, ts]);
        if (p.default_groups && Array.isArray(p.default_groups)) {
            for (const gName of p.default_groups) {
                const groupChk = db.query('SELECT id FROM groups WHERE name = ?', [gName]);
                if (groupChk.length > 0) {
                    db.run('INSERT INTO group_permissions (group_id, permission_id, last_modified, is_deleted) VALUES (?, ?, ?, 0)', [groupChk[0].id, permId, ts]);
                }
            }
        }
    } catch (e) {
        console.error(e);
    }
}
function getAllUsers(event) {
    try {
        const db = getDB();
        if (!db) return [];
        let res;
        try {
            res = db.exec('SELECT id, username, email, is_superadmin FROM users WHERE is_deleted = 0');
        } catch (e) {
            res = db.exec('SELECT id, username, email FROM users WHERE is_deleted = 0');
        }
        return rowsToObjects(res);
    } catch (e) {
        console.error(e);
        return [];
    }
}
function getAllRoles(event) {
    try {
        const db = getDB();
        if (!db) return [];
        const res = db.exec('SELECT * FROM roles WHERE is_deleted = 0');
        return rowsToObjects(res);
    } catch (e) {
        console.error(e);
        return [];
    }
}
function createRole(event, name, description) {
    try {
        return false;
    } catch (e) {
        console.error(e);
        return false;
    }
}
function assignRoleToUser(event, userId, roleId) {
    try {
        return false;
    } catch (e) {
        console.error(e);
        return false;
    }
}
function removeRoleFromUser(event, userId, roleId) {
    try {
        return false;
    } catch (e) {
        console.error(e);
        return false;
    }
}
function getAllGroups(event) {
    try {
        const db = getDB();
        if (!db) return [];
        let res;
        try {
            res = db.exec('SELECT id, name, description, is_superadmin FROM groups');
        } catch (e) {
            res = db.exec('SELECT id, name, description FROM groups');
        }
        return rowsToObjects(res);
    } catch (e) {
        console.error(e);
        return [];
    }
}
function createGroup(event, name, description, isSuperadmin = 0) {
    try {
        const db = getDB();
        if (!db) return false;
        const id = generateId();
        try {
            db.run('INSERT INTO groups (id, name, description, is_superadmin) VALUES (?, ?, ?, ?)', [id, name, description, isSuperadmin ? 1 : 0]);
        } catch (e) {
            db.run('INSERT INTO groups (id, name, description) VALUES (?, ?, ?)', [id, name, description]);
        }
        saveDB();
        return true;
    } catch (e) {
        console.error(e);
        return false;
    }
}
function getGroupPermissions(event, groupId) {
    try {
        const db = getDB();
        if (!db) return [];
        const res = db.query('SELECT permission_id FROM group_permissions WHERE group_id = ? AND is_deleted = 0', [groupId]);
        return (res || []).map(r => r.permission_id);
    } catch (e) {
        console.error(e);
        return [];
    }
}
function getUserPermissions(event, userId) {
    try {
        const db = getDB();
        if (!db) return [];
        const res = db.query('SELECT permission_id FROM user_permissions WHERE user_id = ? AND is_deleted = 0', [userId]);
        return (res || []).map(r => r.permission_id);
    } catch (e) {
        console.error(e);
        return [];
    }
}
function getEffectiveUserPermissions(event, userId) {
    try {
        const db = getDB();
        if (!db) return [];
        try {
            const superCheck = db.query('SELECT is_superadmin FROM users WHERE id = ?', [userId]);
            if (superCheck.length > 0 && superCheck[0].is_superadmin === 1) {
                return ['*'];
            }
        } catch (colErr) {
            console.warn('Colonna is_superadmin in users non trovata.');
        }
        try {
            const superGroupCheck = db.query(
                `SELECT 1 as found FROM groups g
                 JOIN user_groups ug ON ug.group_id = g.id
                 WHERE ug.user_id = ? AND ug.is_deleted = 0 AND g.is_superadmin = 1
                 LIMIT 1`,
                [userId]
            );
            if (superGroupCheck.length > 0) {
                return ['*'];
            }
        } catch (colErr) {
            console.warn('Colonna is_superadmin in groups non trovata.');
        }
        const res = db.query(
            `SELECT permission_id FROM user_permissions WHERE user_id = ? AND is_deleted = 0
             UNION
             SELECT permission_id FROM group_permissions WHERE group_id IN (
                 SELECT group_id FROM user_groups WHERE user_id = ? AND is_deleted = 0
             ) AND is_deleted = 0`,
            [userId, userId]
        );
        return (res || []).map(r => r.permission_id);
    } catch (e) {
        console.error('Errore getEffectiveUserPermissions:', e);
        return [];
    }
}
function setGroupPermission(event, groupId, permissionId, value) {
    try {
        const db = getDB();
        if (!db) return false;
        const ts = getTimestamp();
        const chk = db.query('SELECT group_id FROM group_permissions WHERE group_id = ? AND permission_id = ?', [groupId, permissionId]);
        if (chk.length > 0) {
            db.run('UPDATE group_permissions SET is_deleted = ?, last_modified = ? WHERE group_id = ? AND permission_id = ?',
                [value ? 0 : 1, ts, groupId, permissionId]);
        } else if (value) {
            db.run('INSERT INTO group_permissions (group_id, permission_id, last_modified, is_deleted) VALUES (?, ?, ?, 0)',
                [groupId, permissionId, ts]);
        }
        saveDB();
        return true;
    } catch (e) {
        console.error(e);
        return false;
    }
}
function setUserPermission(event, userId, permissionId, value) {
    try {
        const db = getDB();
        if (!db) return false;
        const ts = getTimestamp();
        const chk = db.query('SELECT user_id FROM user_permissions WHERE user_id = ? AND permission_id = ?', [userId, permissionId]);
        if (chk.length > 0) {
            db.run('UPDATE user_permissions SET is_deleted = ?, last_modified = ? WHERE user_id = ? AND permission_id = ?',
                [value ? 0 : 1, ts, userId, permissionId]);
        } else if (value) {
            db.run('INSERT INTO user_permissions (user_id, permission_id, last_modified, is_deleted) VALUES (?, ?, ?, 0)',
                [userId, permissionId, ts]);
        }
        saveDB();
        return true;
    } catch (e) {
        console.error(e);
        return false;
    }
}
function getGroupUsers(event, groupId) {
    try {
        const db = getDB();
        if (!db) return [];
        const res = db.query('SELECT user_id FROM user_groups WHERE group_id = ? AND is_deleted = 0', [groupId]);
        return (res || []).map(r => r.user_id);
    } catch (e) {
        console.error(e);
        return [];
    }
}
function updateGroupUsers(event, groupId, userIds) {
    try {
        const db = getDB();
        if (!db) return false;
        const ts = getTimestamp();
        db.run('UPDATE user_groups SET is_deleted = 1, last_modified = ? WHERE group_id = ?', [ts, groupId]);
        for (const uid of userIds) {
            try {
                const chk = db.query('SELECT group_id FROM user_groups WHERE group_id = ? AND user_id = ?', [groupId, uid]);
                if (chk.length > 0) {
                    db.run('UPDATE user_groups SET is_deleted = 0, last_modified = ? WHERE group_id = ? AND user_id = ?', [ts, groupId, uid]);
                } else {
                    db.run('INSERT INTO user_groups (group_id, user_id, last_modified, is_deleted) VALUES (?, ?, ?, 0)', [groupId, uid, ts]);
                }
            } catch (e) {
                console.error(e);
            }
        }
        saveDB();
        return true;
    } catch (e) {
        console.error(e);
        return false;
    }
}
module.exports = {
    getAllUsers,
    getAllRoles,
    createRole,
    assignRoleToUser,
    removeRoleFromUser,
    syncPermissionsFromManifests,
    getAllGroups,
    createGroup,
    getGroupPermissions,
    getUserPermissions,
    getEffectiveUserPermissions,
    setGroupPermission,
    setUserPermission,
    getGroupUsers,
    updateGroupUsers
};
