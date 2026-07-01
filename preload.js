const { contextBridge, ipcRenderer } = require('electron');
try {
    contextBridge.exposeInMainWorld('electronAPI', {
        ping: () => {
            try {
                return ipcRenderer.invoke('ping');
            } catch (e) {
                console.error(e);
                throw e;
            }
        },
        checkIsRegistered: () => {
            try {
                return ipcRenderer.invoke('checkIsRegistered');
            } catch (e) {
                console.error(e);
                throw e;
            }
        },
        hasConfig: () => {
            try { return ipcRenderer.invoke('hasConfig'); } catch(e) { throw e; }
        },
        readConfig: () => {
            try { return ipcRenderer.invoke('readConfig'); } catch(e) { throw e; }
        },
        saveConfig: (data) => {
            try { return ipcRenderer.invoke('saveConfig', data); } catch(e) { throw e; }
        },
        registerUser: (data) => {
            try {
                return ipcRenderer.invoke('registerUser', data);
            } catch (e) {
                console.error(e);
                throw e;
            }
        },
        loginUser: (data) => {
            try {
                return ipcRenderer.invoke('loginUser', data);
            } catch (e) {
                console.error(e);
                throw e;
            }
        },
        unlockDatabase: (password) => {
            try { return ipcRenderer.invoke('unlockDatabase', password); } catch(e) { throw e; }
        },
        getUsersList: () => {
            try { return ipcRenderer.invoke('getUsersList'); } catch(e) { throw e; }
        },
        getAppsRegistry: () => {
            try { return ipcRenderer.invoke('getAppsRegistry'); } catch(e) { throw e; }
        },
        getSubAppsRegistry: (appId) => {
            try { return ipcRenderer.invoke('getSubAppsRegistry', appId); } catch(e) { throw e; }
        },
        scanNodes: () => {
            try { return ipcRenderer.invoke('scanNodes'); } catch(e) { throw e; }
        },
        onScanProgress: (callback) => ipcRenderer.on('scan-progress', (event, message) => callback(message)),
        onSyncUpdated: (callback) => ipcRenderer.on('sync-updated', (event, data) => callback(data)),
        forceSync: () => {
            try { return ipcRenderer.invoke('forceSync'); } catch(e) { throw e; }
        },
        checkNetworkProfile: () => {
            try { return ipcRenderer.invoke('checkNetworkProfile'); } catch(e) { throw e; }
        },
        cloneNetwork: (data) => {
            try { return ipcRenderer.invoke('cloneNetwork', data); } catch(e) { throw e; }
        },
        pingNode: (data) => {
            try { return ipcRenderer.invoke('pingNode', data); } catch(e) { throw e; }
        },
        getAppStatus: () => {
            try { return ipcRenderer.invoke('getAppStatus'); } catch(e) { throw e; }
        },
        getLocalIPs: () => {
            try { return ipcRenderer.invoke('getLocalIPs'); } catch(e) { throw e; }
        },
        runDiagnostics: () => {
            try { return ipcRenderer.invoke('runDiagnostics'); } catch(e) { throw e; }
        },
        fixDiagnostics: () => {
            try { return ipcRenderer.invoke('fixDiagnostics'); } catch(e) { throw e; }
        },
        usersGetAll: (data) => {
            try { return ipcRenderer.invoke('usersGetAll', data); } catch(e) { throw e; }
        },
        usersCreate: (data) => {
            try { return ipcRenderer.invoke('usersCreate', data); } catch(e) { throw e; }
        },
        usersUpdate: (data) => {
            try { return ipcRenderer.invoke('usersUpdate', data); } catch(e) { throw e; }
        },
        usersDelete: (data) => {
            try { return ipcRenderer.invoke('usersDelete', data); } catch(e) { throw e; }
        },
        usersRestore: (data) => {
            try { return ipcRenderer.invoke('usersRestore', data); } catch(e) { throw e; }
        },
        usersHardDelete: (data) => {
            try { return ipcRenderer.invoke('usersHardDelete', data); } catch(e) { throw e; }
        },
        rbac: {
            getAllUsers: () => ipcRenderer.invoke('rbac:getAllUsers'),
            getAllRoles: () => ipcRenderer.invoke('rbac:getAllRoles'),
            createRole: (name, desc) => ipcRenderer.invoke('rbac:createRole', name, desc),
            assignRoleToUser: (userId, roleId) => ipcRenderer.invoke('rbac:assignRoleToUser', userId, roleId),
            removeRoleFromUser: (userId, roleId) => ipcRenderer.invoke('rbac:removeRoleFromUser', userId, roleId),
            syncPermissionsFromManifests: () => ipcRenderer.invoke('rbac:syncPermissionsFromManifests'),
            getAllGroups: () => ipcRenderer.invoke('rbac:getAllGroups'),
            createGroup: (name, desc, isSuperadmin) => ipcRenderer.invoke('rbac:createGroup', name, desc, isSuperadmin),
            getGroupPermissions: (groupId) => ipcRenderer.invoke('rbac:getGroupPermissions', groupId),
            getUserPermissions: (userId) => ipcRenderer.invoke('rbac:getUserPermissions', userId),
            getEffectiveUserPermissions: (userId) => ipcRenderer.invoke('rbac:getEffectiveUserPermissions', userId),
            setGroupPermission: (groupId, permId, val) => ipcRenderer.invoke('rbac:setGroupPermission', groupId, permId, val),
            setUserPermission: (userId, permId, val) => ipcRenderer.invoke('rbac:setUserPermission', userId, permId, val),
            getGroupUsers: (groupId) => ipcRenderer.invoke('rbac:getGroupUsers', groupId),
            updateGroupUsers: (groupId, userIds) => ipcRenderer.invoke('rbac:updateGroupUsers', groupId, userIds)
        },
        logError: (message) => ipcRenderer.invoke('logError', message),
        runDiagnostics: () => {
            try { return ipcRenderer.invoke('runDiagnostics'); } catch(e) { throw e; }
        },
        fixDiagnostics: () => {
            try { return ipcRenderer.invoke('fixDiagnostics'); } catch(e) { throw e; }
        },
        dbGetBackupStatus: () => {
            try { return ipcRenderer.invoke('dbGetBackupStatus'); } catch(e) { throw e; }
        },
        getDetailedNodes: () => {
            try { return ipcRenderer.invoke('getDetailedNodes'); } catch(e) { throw e; }
        },
        getExtendedNodeMetrics: () => {
            try { return ipcRenderer.invoke('getExtendedNodeMetrics'); } catch(e) { throw e; }
        },
        getNodeId: () => {
            try { return ipcRenderer.invoke('getNodeId'); } catch(e) { throw e; }
        },
        blockchainFullResync: (data) => {
            try { return ipcRenderer.invoke('blockchainFullResync', data); } catch(e) { throw e; }
        },
        blockchainRebuild: () => {
            try { return ipcRenderer.invoke('blockchainRebuild'); } catch(e) { throw e; }
        },
        onNetworkVersionMismatch: (callback) => {
            try {
                ipcRenderer.on('network-version-mismatch', (event, data) => callback(data));
            } catch(e) { console.error(e); }
        },
        onUpdateDownloadProgress: (callback) => {
            try {
                ipcRenderer.on('update-download-progress', (event, data) => callback(data));
            } catch(e) { console.error(e); }
        },
        onUpdateStatus: (callback) => {
            try {
                ipcRenderer.on('update-status', (event, data) => callback(data));
            } catch(e) { console.error(e); }
        },
        onSyncStateChanged: (callback) => {
            try {
                ipcRenderer.on('sync-state-changed', (event, data) => callback(data));
            } catch(e) { console.error(e); }
        },
        onSyncAnomaly: (callback) => {
            try {
                ipcRenderer.on('sync-anomaly', (event, data) => callback(data));
            } catch(e) { console.error(e); }
        },
        onDbRecoveryFailed: (callback) => {
            try {
                ipcRenderer.on('db-recovery-failed', (event, data) => callback(data));
            } catch(e) { console.error(e); }
        },
        onUserKicked: (callback) => {
            try {
                ipcRenderer.on('user-kicked', (event, data) => callback(data));
            } catch(e) { console.error(e); }
        },
        onDiagProgress: (callback) => ipcRenderer.on('diag-progress', (event, data) => callback(data)),
        windowMinimize: () => {
            try { return ipcRenderer.invoke('window-minimize'); } catch(e) { throw e; }
        },
        windowMaximize: () => {
            try { return ipcRenderer.invoke('window-maximize'); } catch(e) { throw e; }
        },
        windowClose: () => {
            try { return ipcRenderer.invoke('window-close'); } catch(e) { throw e; }
        },
        resetApp: () => {
            try { return ipcRenderer.invoke('resetApp'); } catch(e) { throw e; }
        },
        checkForUpdates: () => {
            try { return ipcRenderer.invoke('checkForUpdates'); } catch(e) { throw e; }
        },
        forceP2PUpdate: (peerIp) => {
            try { return ipcRenderer.invoke('forceP2PUpdate', peerIp); } catch(e) { throw e; }
        },
        openGitHub: () => {
            try { return ipcRenderer.invoke('openGitHub'); } catch(e) { throw e; }
        },
        toggleDevTools: () => {
            try { return ipcRenderer.invoke('toggleDevTools'); } catch(e) { throw e; }
        },
        getNetworkCode: () => {
            try { return ipcRenderer.invoke('getNetworkCode'); } catch(e) { throw e; }
        }
    });
} catch (e) {
    console.error(e);
}
