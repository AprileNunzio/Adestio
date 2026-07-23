'use strict';

const path = require('path');

const appId = process.argv[2];
const appPath = process.argv[3];
let manifest = {};

try {
    manifest = JSON.parse(process.argv[4] || '{}');
} catch (error) {
    console.error('[appWorkerHost Parse Manifest Error]', error);
}

let appInstance = null;
let appToken = null;

try {
    process.parentPort.on('message', (event) => {
        try {
            const message = event.data;
            if (!message || typeof message !== 'object') return;

            if (message.type === 'INIT') {
                appToken = message.token;
                initializeModule();
            } else if (message.type === 'IPC_RESPONSE') {
                if (appInstance && typeof appInstance.handleIpcResponse === 'function') {
                    appInstance.handleIpcResponse(message.requestId, message.success, message.data, message.error);
                }
            }
        } catch (error) {
            console.error('[appWorkerHost parentPort message Error]', error);
        }
    });
} catch (error) {
    console.error('[appWorkerHost setup listener Error]', error);
}

function initializeModule() {
    try {
        if (!manifest.backend) return;
        const backendFilePath = path.join(appPath, manifest.backend);
        const LoadedModule = require(backendFilePath);
        
        if (typeof LoadedModule === 'function') {
            appInstance = new LoadedModule({
                appId: appId,
                token: appToken,
                sendIpcCall: (targetApp, action, payload) => {
                    try {
                        const requestId = Math.random().toString(36).substring(2, 11);
                        process.parentPort.postMessage({
                            type: 'IPC_CALL',
                            requestId: requestId,
                            targetApp: targetApp,
                            action: action,
                            payload: payload
                        });
                        return requestId;
                    } catch (err) {
                        console.error('[appWorkerHost sendIpcCall Error]', err);
                        return null;
                    }
                },
                log: (data) => {
                    try {
                        process.parentPort.postMessage({ type: 'LOG', data: data });
                    } catch (err) {
                        console.error('[appWorkerHost log Error]', err);
                    }
                }
            });
            if (typeof appInstance.onLoad === 'function') {
                appInstance.onLoad();
            }
        } else if (typeof LoadedModule === 'object' && LoadedModule !== null) {
            appInstance = LoadedModule;
            if (typeof appInstance.onLoad === 'function') {
                appInstance.onLoad({ appId: appId, token: appToken });
            }
        }
    } catch (error) {
        console.error(`[appWorkerHost initializeModule Error: ${appId}]`, error);
    }
}
