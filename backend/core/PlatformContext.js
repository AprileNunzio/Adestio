'use strict';
const { BrowserWindow } = require('electron');
const sessionManager = require('./session_manager');
const accessGuard = require('./access_guard');
class PlatformContext {
    constructor(appId) {
        this._appId = appId;
    }
        getDB() {
        return require('./AppDbManager').get(this._appId);
    }
        getCoreDB(domain) {
        return require('../db').getDB(domain);
    }
    getCurrentUserId() {
        return sessionManager.getCurrentUserId();
    }
    isLoggedIn() {
        return accessGuard.isLoggedIn();
    }
    isSuperadmin() {
        return accessGuard.isSuperadmin();
    }
        hasPermission(permId) {
        try {
            if (this.isSuperadmin()) return true;
            const userId = this.getCurrentUserId();
            if (!userId) return false;
            const { getEffectiveUserPermissions } = require('../handlers/rbac');
            const result = getEffectiveUserPermissions(null, userId);
            const perms = (result && result.data) ? result.data : (Array.isArray(result) ? result : []);
            const fullPermId = permId.includes(':') ? permId : `${this._appId}:${permId}`;
            return perms.includes('*') || perms.includes(fullPermId) || perms.includes(permId);
        } catch (e) {
            return false;
        }
    }
    log(...args) {
        console.log(`[App:${this._appId}]`, ...args);
    }
    warn(...args) {
        console.warn(`[App:${this._appId}]`, ...args);
    }
    error(...args) {
        console.error(`[App:${this._appId}]`, ...args);
    }
        emit(channel, data) {
        try {
            for (const win of BrowserWindow.getAllWindows()) {
                if (!win.isDestroyed()) win.webContents.send(channel, data);
            }
        } catch (e) {}
    }
        handler(fn) {
        const self = this;
        return async (event, payload) => {
            try {
                if (!self.isLoggedIn()) return { success: false, error: 'Non autenticato' };
                const result = await fn(self, event, payload);
                return result !== undefined ? result : { success: true };
            } catch (e) {
                self.error('IPC Error:', e.message);
                return { success: false, error: e.message };
            }
        };
    }
}
module.exports = PlatformContext;
