'use strict';
const { ipcMain } = require('electron');
const accessGuard = require('./access_guard');
const _registry = new Map();
function register(appId, namespace, handlers, context) {
    try {
        if (_registry.has(appId)) {
            deregister(appId);
        }
        const channels = new Set();
        for (const [action, handler] of Object.entries(handlers)) {
            const channel = `app:${namespace}:${action}`;
            try {
                ipcMain.removeHandler(channel);
                ipcMain.handle(channel, async (event, payload) => {
                    try {
                        if (!accessGuard.isLoggedIn()) {
                            return { success: false, error: 'Non autenticato' };
                        }
                        return await handler(context, event, payload);
                    } catch (e) {
                        return { success: false, error: e.message };
                    }
                });
                channels.add(channel);
            } catch (e) {}
        }
        _registry.set(appId, channels);
    } catch (e) {}
}
function deregister(appId) {
    try {
        const channels = _registry.get(appId);
        if (!channels) return;
        for (const channel of channels) {
            try { ipcMain.removeHandler(channel); } catch (e) {}
        }
        _registry.delete(appId);
    } catch (e) {}
}
function getRegistered() {
    try {
        return Array.from(_registry.keys());
    } catch (e) {
        return [];
    }
}
function isRegistered(appId) {
    try {
        return _registry.has(appId);
    } catch (e) {
        return false;
    }
}
function getChannels(appId) {
    try {
        return Array.from(_registry.get(appId) || []);
    } catch (e) {
        return [];
    }
}
module.exports = { register, deregister, getRegistered, isRegistered, getChannels };

