'use strict';
const sessionManager = require('./session_manager');
function isLoggedIn() {
    try {
        return sessionManager.isAuthenticated();
    } catch (e) {
        return false;
    }
}
function isSuperadmin() {
    try {
        const userId = sessionManager.getCurrentUserId();
        if (!userId) return false;
        const rbacHandlers = require('../handlers/rbac');
        const perms = rbacHandlers.getEffectiveUserPermissions(null, userId) || [];
        return perms.includes('*');
    } catch (e) {
        return false;
    }
}
module.exports = { isLoggedIn, isSuperadmin };
