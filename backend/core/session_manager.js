'use strict';
let _session = null;
function setSession(userId) {
    try {
        if (!userId) return false;
        _session = { userId, loginAt: Date.now() };
        return true;
    } catch (e) {
        return false;
    }
}
function clearSession() {
    try {
        _session = null;
        return true;
    } catch (e) {
        return false;
    }
}
function getCurrentUserId() {
    try {
        return _session ? _session.userId : null;
    } catch (e) {
        return null;
    }
}
function isAuthenticated() {
    try {
        return _session !== null;
    } catch (e) {
        return false;
    }
}
module.exports = { setSession, clearSession, getCurrentUserId, isAuthenticated };
