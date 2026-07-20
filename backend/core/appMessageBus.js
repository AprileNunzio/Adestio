const appsRegistry = require('../security/appsRegistry');

class AppMessageBus {
    constructor() {
        try {
            this.activeConnections = new Map();
        } catch (e) {
            console.error(e);
        }
    }

    registerAppWindow(appId, webContents) {
        try {
            if (!appsRegistry.isAppInstalledAndVerified(appId)) {
                throw new Error(`Cannot register window for unverified app ${appId}`);
            }
            this.activeConnections.set(appId, webContents);
        } catch (e) {
            console.error(e);
        }
    }

    unregisterAppWindow(appId) {
        try {
            this.activeConnections.delete(appId);
        } catch (e) {
            console.error(e);
        }
    }

    routeMessage(senderAppId, targetAppId, payload) {
        try {
            if (!this.activeConnections.has(senderAppId)) {
                throw new Error("Sender app is not active or verified.");
            }

            if (!this.activeConnections.has(targetAppId)) {
                throw new Error(`Target app ${targetAppId} is not running.`);
            }

            const senderPermissions = appsRegistry.getAppPermissions(senderAppId);
            const canMessageTarget = senderPermissions.includes(`ipc:send:${targetAppId}`);
            
            if (!canMessageTarget) {
                throw new Error(`App ${senderAppId} lacks permission to message ${targetAppId}.`);
            }

            const targetWebContents = this.activeConnections.get(targetAppId);
            
            const secureMessage = {
                from: senderAppId,
                payload: payload,
                timestamp: Date.now(),
                verifiedByMain: true 
            };

            targetWebContents.send(`app-message-receive:${targetAppId}`, secureMessage);
            return { success: true, delivered: true };
        } catch (e) {
            console.error(e);
            return { success: false, error: e.message };
        }
    }
}

module.exports = new AppMessageBus();
