const crypto = require('crypto');

const CURRENT_PAYLOAD_VERSION = 1;

const SYNC_TABLES = [
    'users',
    'roles',
    'permissions',
    'role_permissions',
    'groups',
    'user_groups',
    'user_roles',
    'group_roles'
];

const adapters = {
    users: {
        1: (payload) => {
            return {
                ...payload,
                passkey: payload.passkey || '',
                email: payload.email || '',
                pin: payload.pin || '',
                must_change_password: payload.must_change_password || 0,
                nome: payload.nome || '',
                cognome: payload.cognome || '',
                is_superadmin: payload.is_superadmin || 0,
                last_login: payload.last_login || 0
            };
        }
    },
    roles: {
        1: (payload) => payload
    },
    permissions: {
        1: (payload) => payload
    },
    role_permissions: {
        1: (payload) => payload
    },
    groups: {
        1: (payload) => payload
    },
    user_groups: {
        1: (payload) => payload
    },
    user_roles: {
        1: (payload) => payload
    },
    group_roles: {
        1: (payload) => payload
    }
};

const schemas = {
    users: ['id', 'username', 'password', 'is_deleted']
};

function validatePayloadSchema(tableName, eventType, payload) {
    if (eventType === 'DELETE' || !payload) return true;
    const schema = schemas[tableName];
    if (!schema) return true;

    for (const key of schema) {
        if (!(key in payload)) {
            try {
                const { logSyncAnomaly } = require('./logger');
                logSyncAnomaly('SCHEMA_MISMATCH', `Manca il campo obbligatorio '${key}' nella tabella '${tableName}'`, payload);
            } catch(e) {}
            return false;
        }
    }
    return true;
}

function adaptPayload(tableName, payloadVersion, payload) {
    try {
        if (!payload) return payload;

        const tableAdapters = adapters[tableName];
        if (!tableAdapters) return payload;

        let result = payload;
        for (let v = payloadVersion; v <= CURRENT_PAYLOAD_VERSION; v++) {
            if (tableAdapters[v]) {
                result = tableAdapters[v](result);
            }
        }
        return result;
    } catch (e) {
        try { require('./logger').logError(e, { context: 'adaptPayload' }); } catch(_) {}
        return payload;
    }
}

function computeBlockId(parentIds, nodeId, createdAt, eventType, tableName, recordId, payload, payloadVersion) {
    try {
        const canonical = JSON.stringify(parentIds.slice().sort()) +
            nodeId +
            String(createdAt) +
            eventType +
            tableName +
            recordId +
            JSON.stringify(payload) +
            String(payloadVersion);
        return crypto.createHash('sha256').update(canonical).digest('hex');
    } catch (e) {
        console.error('[PayloadAdapters] computeBlockId error:', e);
        throw e;
    }
}

module.exports = { adaptPayload, validatePayloadSchema, computeBlockId, CURRENT_PAYLOAD_VERSION, SYNC_TABLES };
