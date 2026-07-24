const { BrowserWindow, app } = require('electron');
const path = require('path');
const db = require('../db');
const sync = require('../sync');
const syncEngine = require('../sync_engine');
const AppLoader = require('./AppLoader');
const store = require('../handlers/store');
const peerDiscovery = require('../p2p/discovery/peerDiscovery');
const fileTransferProtocol = require('../p2p/storage/fileTransferProtocol');
const crdtEngine = require('../db/crdtEngine');
const nodeIdentity = require('./node_identity');
const AppUpdateManager = require('./AppUpdateManager');


class BootManager {
    static async runStartupSequence() {
        try {
            const unlocked = await db.autoUnlockDB();
            sync.ensureFirewallRule();
            sync.startSyncServer();

            try {
                const nodeId = nodeIdentity.getNodeId();
                crdtEngine.setNodeId(nodeId);
                peerDiscovery.start(nodeId);
                
                const storagePath = path.join(app.getPath('userData'), 'p2p_storage');
                fileTransferProtocol.startServer(storagePath);
            } catch (p2pErr) {
                console.error('[BootManager P2P Init Error]', p2pErr);
            }

            try { 
                require('../diagnostics_api').startDiagnosticsServer(); 
            } catch(e) { 
                console.error('[BootManager Diagnostica Error]', e); 
            }

            if (unlocked) {
                try {
                    await AppLoader.loadAllInstalledApps();
                } catch(alErr) {
                    console.error('[BootManager AppLoader Error]', alErr);
                }
                try {
                    // Sincronizza automaticamente i permessi dichiarati dai manifest (core +
                    // terze parti) ad ogni avvio: un nuovo permesso non deve restare invisibile
                    // finche' un admin non apre manualmente Amministratore > Sistema RBAC.
                    require('../handlers/rbac').syncPermissionsFromManifests();
                } catch (rbacErr) {
                    console.error('[BootManager RBAC Sync Error]', rbacErr);
                }
            } else {
                try {
                    const registered = db.checkIsRegistered();
                    if (registered) {
                        setTimeout(async () => {
                            try {
                                await BootManager.attemptDatabaseRecovery();
                            } catch (recErr) {
                                console.error('[BootManager Recovery Timeout Error]', recErr);
                            }
                        }, 8000);
                    }
                } catch (regErr) {
                    console.error('[BootManager Check Registration Error]', regErr);
                }
            }
        } catch (error) {
            console.error('[BootManager runStartupSequence Fatal Error]', error);
        }
    }

    static async attemptDatabaseRecovery() {
        try {
            const nodes = sync.getDetailedNodes().filter(n => n.ip !== '127.0.0.1');
            let recovered = false;
            for (const node of nodes) {
                try {
                    const ok = await syncEngine.triggerFullResync(node.ip, node.port);
                    if (ok) { recovered = true; break; }
                } catch (nodeSyncErr) {
                    console.error('[BootManager nodeSync Error]', nodeSyncErr);
                }
            }
            if (!recovered) {
                const win = BrowserWindow.getAllWindows()[0];
                if (win && !win.isDestroyed()) {
                    win.webContents.send('db-recovery-failed', {
                        message: 'Database locale irrecuperabile.'
                    });
                }
            }
        } catch(recErr) { 
            console.error('[BootManager attemptDatabaseRecovery Error]', recErr); 
        }
    }

    static runBackgroundTasks() {
        try {
            setTimeout(() => {
                try {
                    store.preloadMarketplaceCache()
                        .then(() => store.syncNetworkApps())
                        .then(() => AppUpdateManager.startBackgroundCheck())
                        .catch(e => console.error('[BootManager Background Task Error]', e));
                } catch (bgTaskErr) {
                    console.error('[BootManager Background Task Error]', bgTaskErr);
                }
            }, 5000);
        } catch (error) {
            console.error('[BootManager runBackgroundTasks Error]', error);
        }
    }
}

module.exports = BootManager;

