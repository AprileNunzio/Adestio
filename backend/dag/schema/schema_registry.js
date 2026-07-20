'use strict';
const CURRENT_PAYLOAD_VERSION = 1;
const SYNC_TABLES = ['users', 'roles', 'permissions', 'role_permissions', 'groups', 'user_groups', 'user_roles', 'group_roles', 'distributed_logs', 'persone', 'documenti_identita', 'indirizzi', 'rapporti_lavoro', 'titoli_studio', 'dati_bancari', 'contatti', 'familiari', 'access_logs', 'webauthn_credentials', 'totp_backup_codes', 'notification_preferences', 'notifications'];
const SCHEMAS = {
    users:            { required: ['id', 'username', 'password', 'is_deleted'] },
    roles:            { required: [] },
    permissions:      { required: [] },
    role_permissions: { required: [] },
    groups:           { required: [] },
    user_groups:      { required: [] },
    user_roles:       { required: [] },
    group_roles:      { required: [] },
    distributed_logs: { required: ['id', 'node_id', 'level', 'message', 'created_at'] },
    persone:            { required: ['id', 'is_deleted'] },
    documenti_identita: { required: ['id', 'persona_id', 'is_deleted'] },
    indirizzi:          { required: ['id', 'persona_id', 'is_deleted'] },
    rapporti_lavoro:    { required: ['id', 'persona_id', 'is_deleted'] },
    titoli_studio:      { required: ['id', 'persona_id', 'is_deleted'] },
    dati_bancari:       { required: ['id', 'persona_id', 'is_deleted'] },
    contatti:           { required: ['id', 'persona_id', 'is_deleted'] },
    familiari:          { required: ['id', 'persona_id', 'is_deleted'] },
    access_logs:               { required: ['id', 'user_id', 'timestamp'] },
    webauthn_credentials:      { required: ['id', 'user_id', 'credential_id'] },
    totp_backup_codes:         { required: ['id', 'user_id', 'code_hash'] },
    notification_preferences: { required: ['id', 'user_id', 'category'] },
    notifications:             { required: ['id', 'user_id', 'category'] }
};
function getSchema(tableName) { return SCHEMAS[tableName] || null; }

// Instradamento tabella → dominio DB. Ogni tabella sincronizzata dal DAG vive in
// un solo dominio; il default 'auth' copre RBAC/utenti/sicurezza/notifiche.
// Le tabelle del dominio personale vivono in app_anagrafica.enc (vedi Fase 4).
const TABLE_DOMAINS = {
    persone: 'app_anagrafica',
    documenti_identita: 'app_anagrafica',
    indirizzi: 'app_anagrafica',
    rapporti_lavoro: 'app_anagrafica',
    titoli_studio: 'app_anagrafica',
    dati_bancari: 'app_anagrafica',
    contatti: 'app_anagrafica',
    familiari: 'app_anagrafica'
};
function getDomainForTable(tableName) { return TABLE_DOMAINS[tableName] || 'auth'; }

module.exports = { CURRENT_PAYLOAD_VERSION, SYNC_TABLES, getSchema, getDomainForTable };
