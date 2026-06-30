'use strict';
const { CURRENT_PAYLOAD_VERSION } = require('./schema_registry');

const ADAPTERS = {
    users: {
        1: (p) => ({ passkey: '', email: '', pin: '', must_change_password: 0, nome: '', cognome: '', is_superadmin: 0, last_login: 0, ...p })
    },
    roles:            { 1: p => p },
    permissions:      { 1: p => p },
    role_permissions: { 1: p => p },
    groups:           { 1: p => p },
    user_groups:      { 1: p => p },
    user_roles:       { 1: p => p },
    group_roles:      { 1: p => p }
};

function adaptPayload(tableName, fromVersion, payload) {
    try {
        if (!payload) return payload;
        const table = ADAPTERS[tableName];
        if (!table) return payload;
        let result = payload;
        for (let v = fromVersion; v <= CURRENT_PAYLOAD_VERSION; v++) {
            if (table[v]) result = table[v](result);
        }
        return result;
    } catch (_) { return payload; }
}

module.exports = { adaptPayload };
