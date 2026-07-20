'use strict';
const { BrowserWindow } = require('electron');
const sessionManager = require('./session_manager');
const accessGuard = require('./access_guard');

/**
 * PlatformContext — iniettato in ogni app backend via AppLoader.
 * È il contratto tra la piattaforma e le app: nessuna app accede
 * direttamente a db_manager o session_manager.
 */
class PlatformContext {
    constructor(appId) {
        this._appId = appId;
    }

    // ── Database ──────────────────────────────────────────────

    /** DB privato dell'app (app_<namespace>.enc). */
    getDB() {
        return require('./AppDbManager').get(this._appId);
    }

    /** DB di un dominio core (auth, config, ledger). */
    getCoreDB(domain) {
        return require('../db').getDB(domain);
    }

    // ── Sessione / Accesso ────────────────────────────────────

    getCurrentUserId() {
        return sessionManager.getCurrentUserId();
    }

    isLoggedIn() {
        return accessGuard.isLoggedIn();
    }

    isSuperadmin() {
        return accessGuard.isSuperadmin();
    }

    /**
     * Verifica se l'utente corrente ha un permesso specifico.
     * Usa l'ID completo del permesso: "<appId>:<permId>" oppure solo "<permId>".
     */
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

    // ── Logging ───────────────────────────────────────────────

    log(...args) {
        console.log(`[App:${this._appId}]`, ...args);
    }

    warn(...args) {
        console.warn(`[App:${this._appId}]`, ...args);
    }

    error(...args) {
        console.error(`[App:${this._appId}]`, ...args);
    }

    // ── Push events → Renderer ────────────────────────────────

    /** Invia un evento push a tutte le finestre aperte. */
    emit(channel, data) {
        try {
            for (const win of BrowserWindow.getAllWindows()) {
                if (!win.isDestroyed()) win.webContents.send(channel, data);
            }
        } catch (e) {}
    }

    // ── Utility ───────────────────────────────────────────────

    /**
     * Wrappa un handler IPC con auth check e error handling standard.
     * Uso: handlers['persone:getAll'] = ctx.handler(async (ctx, event, payload) => { ... })
     */
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
