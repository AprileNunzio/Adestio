'use strict';
const CURRENT_PAYLOAD_VERSION = 1;
const SYNC_TABLES = ['users', 'roles', 'permissions', 'role_permissions', 'groups', 'user_groups', 'user_roles', 'group_roles'];
const SCHEMAS = {
    users:            { required: ['id', 'username', 'password', 'is_deleted'] },
    roles:            { required: [] },
    permissions:      { required: [] },
    role_permissions: { required: [] },
    groups:           { required: [] },
    user_groups:      { required: [] },
    user_roles:       { required: [] },
    group_roles:      { required: [] }
};
function getSchema(tableName) { return SCHEMAS[tableName] || null; }
module.exports = { CURRENT_PAYLOAD_VERSION, SYNC_TABLES, getSchema };
