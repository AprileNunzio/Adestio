const { BrowserWindow } = require('electron');
const db = require('../db');
const sync = require('../sync');
const syncEngine = require('../sync_engine');
const blockchain = require('../blockchain');
const AppLoader = require('./AppLoader');
const store = require('../handlers/store');
class BootManager {
    static async runStartupSequence() {
        console.log('[BootManager] Inizio sequenza di avvio...');
        const unlocked = await db.autoUnlockDB();
        sync.ensureFirewallRule();
        sync.startSyncServer();
        try { 
            require('../diagnostics_api').startDiagnosticsServer(); 
        } catch(e) { 
            console.error('[BootManager] Diagnostica fallita:', e); 
        }
        if (unlocked) {
            try {
                blockchain.rebuildStateFromLog();
            } catch(rbErr) { 
                console.error('[BootManager] Errore rebuildStateFromLog:', rbErr); 
            }
            try {
                await AppLoader.loadAllInstalledApps();
            } catch(alErr) { 
                console.error('[BootManager] Errore AppLoader:', alErr); 
            }
        } else {
            const registered = db.checkIsRegistered();
            if (registered) {
                console.error('[BootManager] DB irrecuperabile localmente, avvio full resync automatico...');
                setTimeout(async () => {
                    await this.attemptDatabaseRecovery();
                }, 8000);
            }
        }
        console.log('[BootManager] Sequenza di avvio completata.');
    }
    static async attemptDatabaseRecovery() {
        try {
            const nodes = sync.getDetailedNodes().filter(n => n.ip !== '127.0.0.1');
            let recovered = false;
            for (const node of nodes) {
                const ok = await syncEngine.triggerFullResync(node.ip, node.port);
                if (ok) { recovered = true; break; }
            }
            if (!recovered) {
                const win = BrowserWindow.getAllWindows()[0];
                if (win && !win.isDestroyed()) {
                    win.webContents.send('db-recovery-failed', {
                        message: 'Database locale irrecuperabile. Connettiti alla rete per ripristinare i dati oppure reimposta il nodo.'
                    });
                }
            }
        } catch(recErr) { 
            console.error('[BootManager] Errore Auto recovery:', recErr); 
        }
    }
    static runBackgroundTasks() {
        console.log('[BootManager] Avvio task in background...');
        setTimeout(() => {
            store.preloadMarketplaceCache()
                .then(() => store.syncNetworkApps())
                .catch(e => console.error('[BootManager] Errore preload/sync Marketplace:', e));
        }, 5000); 
    }
}
module.exports = BootManager;
