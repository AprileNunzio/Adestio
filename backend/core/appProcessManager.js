'use strict';

const { utilityProcess } = require('electron');
const path = require('path');
const capabilityBroker = require('../security/capabilityBroker');

class AppProcessManager {
    constructor() {
        try {
            this.processes = new Map();
        } catch (error) {
            console.error('[AppProcessManager constructor Error]', error);
        }
    }

    spawnAppProcess(appId, manifest, appPath) {
        try {
            if (this.processes.has(appId)) {
                this.terminateAppProcess(appId);
            }
            const hostScript = path.join(__dirname, 'appWorkerHost.js');
            const child = utilityProcess.fork(hostScript, [appId, appPath, JSON.stringify(manifest)], {
                serviceName: `adestio-app-${appId}`
            });

            const token = capabilityBroker.generateAppToken(appId, manifest.permissions || []);

            child.on('message', (message) => {
                try {
                    this.handleWorkerMessage(appId, message, child);
                } catch (error) {
                    console.error(`[AppProcessManager handleWorkerMessage Error: ${appId}]`, error);
                }
            });

            child.on('exit', (code) => {
                try {
                    this.processes.delete(appId);
                    capabilityBroker.revokeAppToken(appId);
                } catch (error) {
                    console.error(`[AppProcessManager exit Error: ${appId}]`, error);
                }
            });

            this.processes.set(appId, {
                process: child,
                manifest: manifest,
                token: token,
                startTime: Date.now()
            });

            child.postMessage({ type: 'INIT', token: token, manifest: manifest });
            return true;
        } catch (error) {
            console.error(`[AppProcessManager spawnAppProcess Error: ${appId}]`, error);
            return false;
        }
    }

    handleWorkerMessage(appId, message, child) {
        try {
            if (!message || typeof message !== 'object') return;
            switch (message.type) {
                case 'IPC_CALL':
                    capabilityBroker.routeIpcCall(appId, message.targetApp, message.action, message.payload)
                        .then((result) => {
                            try {
                                child.postMessage({ type: 'IPC_RESPONSE', requestId: message.requestId, success: true, data: result });
                            } catch (e) {
                                console.error('[AppProcessManager IPC_RESPONSE Send Error]', e);
                            }
                        })
                        .catch((err) => {
                            try {
                                child.postMessage({ type: 'IPC_RESPONSE', requestId: message.requestId, success: false, error: err.message });
                            } catch (e) {
                                console.error('[AppProcessManager IPC_RESPONSE Error Send Error]', e);
                            }
                        });
                    break;
                case 'LOG':
                    console.log(`[Worker:${appId}]`, message.data);
                    break;
                default:
                    break;
            }
        } catch (error) {
            console.error(`[AppProcessManager handleWorkerMessage dispatch Error: ${appId}]`, error);
        }
    }

    terminateAppProcess(appId) {
        try {
            if (!this.processes.has(appId)) return false;
            const item = this.processes.get(appId);
            if (item && item.process) {
                item.process.kill();
            }
            this.processes.delete(appId);
            capabilityBroker.revokeAppToken(appId);
            return true;
        } catch (error) {
            console.error(`[AppProcessManager terminateAppProcess Error: ${appId}]`, error);
            return false;
        }
    }

    getActiveProcesses() {
        try {
            const list = [];
            for (const [id, info] of this.processes.entries()) {
                list.push({
                    id: id,
                    startTime: info.startTime,
                    permissions: info.manifest.permissions || []
                });
            }
            return list;
        } catch (error) {
            console.error('[AppProcessManager getActiveProcesses Error]', error);
            return [];
        }
    }

    terminateAll() {
        try {
            for (const id of this.processes.keys()) {
                this.terminateAppProcess(id);
            }
        } catch (error) {
            console.error('[AppProcessManager terminateAll Error]', error);
        }
    }
}

module.exports = new AppProcessManager();
