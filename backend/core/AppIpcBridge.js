'use strict';
const { ipcMain } = require('electron');
const accessGuard = require('./access_guard');
const _registry = new Map();
function register(appId, namespace, handlers, context) {
    if (_registry.has(appId)) {
        console.warn(`[AppIpcBridge] App "${appId}" già registrata. Deregistro prima.`);
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
                    console.error(`[AppIpcBridge] Errore in "${channel}":`, e.message);
                    return { success: false, error: e.message };
                }
            });
            channels.add(channel);
        } catch (e) {
            console.error(`[AppIpcBridge] Impossibile registrare "${channel}":`, e.message);
        }
    }
    _registry.set(appId, channels);
    console.log(`[AppIpcBridge] App "${appId}": ${channels.size} canali registrati.`);
}
function deregister(appId) {
    const channels = _registry.get(appId);
    if (!channels) return;
    for (const channel of channels) {
        try { ipcMain.removeHandler(channel); } catch (e) {}
    }
    _registry.delete(appId);
    console.log(`[AppIpcBridge] App "${appId}": canali deregistrati.`);
}
function getRegistered()       { return Array.from(_registry.keys()); }
function isRegistered(appId)   { return _registry.has(appId); }
function getChannels(appId)    { return Array.from(_registry.get(appId) || []); }
module.exports = { register, deregister, getRegistered, isRegistered, getChannels };
