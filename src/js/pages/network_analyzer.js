export default {
    render: async (el) => {
        try {
            el.innerHTML = `
                <div class="fade-in-up" style="width: 100%; height: 100%; display: flex; flex-direction: column; gap: 2rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <h1 class="text-title" style="text-align: left; font-size: 2.2rem; color: var(--md-primary); margin-bottom: 0.2rem; letter-spacing: -0.02em;">Diagnostica P2P</h1>
                            <p class="text-body" style="text-align: left; color: var(--md-on-surface-variant); font-size: 1.05rem;">Analisi approfondita della rete, firewall e stato sincronizzazione.</p>
                        </div>
                        <div style="display: flex; gap: 1rem;">
                            <button id="btn-fix-diag" class="btn" style="background: var(--md-error); color: var(--md-on-error); display: none; padding: 0.8rem 1.5rem; font-weight: 600; border-radius: 12px; box-shadow: 0 4px 12px rgba(244, 67, 54, 0.3);">
                                <span class="material-symbols-rounded">build</span> Risolvi Problemi
                            </button>
                            <button id="btn-run-diag" class="btn btn-primary" style="padding: 0.8rem 1.5rem; font-weight: 600; border-radius: 12px; box-shadow: 0 4px 12px rgba(46, 125, 50, 0.2);">
                                <span class="material-symbols-rounded">troubleshoot</span> Avvia Analisi
                            </button>
                        </div>
                    </div>
                    <div style="display: flex; gap: 2rem; flex: 1; min-height: 0;">
                        <!-- Colonna Sinistra: Console Log -->
                        <div class="card" style="flex: 1.5; display: flex; flex-direction: column; padding: 0; overflow: hidden; background: #1e1e1e; border: 1px solid #333;">
                            <div style="padding: 1rem 1.5rem; background: #2d2d2d; border-bottom: 1px solid #444; display: flex; align-items: center; gap: 0.8rem;">
                                <span class="material-symbols-rounded" style="color: #4CAF50;">terminal</span>
                                <span style="color: #fff; font-family: monospace; font-weight: 600;">Console Eventi di Sistema</span>
                            </div>
                            <div id="diag-console" style="flex: 1; overflow-y: auto; padding: 1.5rem; font-family: 'Consolas', 'Courier New', monospace; font-size: 0.95rem; line-height: 1.5; color: #d4d4d4;">
                                <div style="color: #6a9955;">> In attesa di comando...</div>
                            </div>
                        </div>
                        <div style="flex: 1; display: flex; flex-direction: column; gap: 2rem; min-height: 0;">
                            <div class="card" style="display: flex; flex-direction: column; padding: 0; overflow: hidden;">
                                <div style="padding: 1rem 1.5rem; background: var(--md-surface-variant); border-bottom: 1px solid var(--md-outline-variant); display: flex; align-items: center; gap: 0.8rem;">
                                    <span class="material-symbols-rounded" style="color: var(--md-primary);">shield_locked</span>
                                    <span style="font-weight: 600; color: var(--md-on-surface);">Stato Sicurezza & Database</span>
                                </div>
                                <div style="padding: 1.5rem; background: var(--md-surface); display: flex; flex-direction: column; gap: 1rem;">
                                    <div style="display: flex; justify-content: space-between; align-items: center;">
                                        <div style="display: flex; align-items: center; gap: 0.5rem; color: var(--md-on-surface-variant);">
                                            <span class="material-symbols-rounded" style="font-size: 1.2rem;">encrypted</span> Crittografia Dati
                                        </div>
                                        <div style="font-weight: 600; color: var(--md-success);">AES-256-GCM Attiva</div>
                                    </div>
                                    <div style="display: flex; justify-content: space-between; align-items: center;">
                                        <div style="display: flex; align-items: center; gap: 0.5rem; color: var(--md-on-surface-variant);">
                                            <span class="material-symbols-rounded" style="font-size: 1.2rem;">storage</span> Dimensioni DB
                                        </div>
                                        <div id="db-size" style="font-weight: 600; color: var(--md-on-surface);">Calcolo...</div>
                                    </div>
                                    <div style="display: flex; justify-content: space-between; align-items: center;">
                                        <div style="display: flex; align-items: center; gap: 0.5rem; color: var(--md-on-surface-variant);">
                                            <span class="material-symbols-rounded" style="font-size: 1.2rem;">backup</span> Backup Disponibili
                                        </div>
                                        <div id="db-backups" style="font-weight: 600; color: var(--md-on-surface);">Calcolo...</div>
                                    </div>
                                </div>
                            </div>
                            <!-- Card Firewall Enterprise -->
                            <div class="card" style="padding: 1.5rem; background: var(--md-surface); border-radius: 16px; border: 1px solid var(--md-surface-variant); box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
                                <div style="display: flex; align-items: center; gap: 0.8rem; margin-bottom: 1.5rem;">
                                    <span class="material-symbols-rounded" style="color: var(--md-primary); font-size: 1.5rem;">security</span>
                                    <h3 style="font-size: 1.1rem; color: var(--md-on-surface); margin: 0;">Firewall Enterprise</h3>
                                </div>
                                <div style="display: flex; flex-direction: column; gap: 1rem;">
                                    <button id="btn-firewall-open" class="btn secondary" style="width: 100%; justify-content: center; font-weight: 500;">
                                        <span class="material-symbols-rounded">open_in_new</span> Apri Impostazioni Windows
                                    </button>
                                    <button id="btn-firewall-force" class="btn" style="width: 100%; justify-content: center; font-weight: 600; background: #d32f2f; color: white; box-shadow: 0 4px 12px rgba(211, 47, 47, 0.3);">
                                        <span class="material-symbols-rounded">admin_panel_settings</span> Forza Regole PowerShell (Admin)
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            const btnRun = document.getElementById('btn-run-diag');
            const btnFix = document.getElementById('btn-fix-diag');
            const consoleEl = document.getElementById('diag-console');
            const appendLog = (msg, type = 'info') => {
                const line = document.createElement('div');
                line.style.marginBottom = '0.5rem';
                let color = '#d4d4d4'; 
                let icon = '';
                if (type === 'success') { color = '#4CAF50'; icon = '[OK] '; }
                else if (type === 'error') { color = '#f44336'; icon = '[ERR] '; }
                else if (type === 'warning') { color = '#ff9800'; icon = '[WARN] '; }
                else if (type === 'loading') { color = '#2196F3'; icon = '[...] '; }
                else { icon = '[SYS] '; }
                line.innerHTML = `<span style="color: #569cd6;">${new Date().toLocaleTimeString()}</span> <span style="color: ${color}; font-weight: ${type !== 'info' ? 'bold' : 'normal'};">${icon}${msg}</span>`;
                consoleEl.appendChild(line);
                consoleEl.scrollTop = consoleEl.scrollHeight;
            };
            window.electronAPI.onDiagProgress((data) => {
                appendLog(data.msg, data.status);
                if (data.data && data.data.showFixBtn) {
                    btnFix.style.display = 'flex';
                }
                if (data.data && data.data.fixCompleted) {
                    btnFix.style.display = 'none';
                }
            });
            btnRun.addEventListener('click', async () => {
                btnFix.style.display = 'none';
                consoleEl.innerHTML = '';
                appendLog("Inizializzazione routine di sistema...", "info");
                btnRun.disabled = true;
                btnRun.innerHTML = `<span class="material-symbols-rounded" style="animation: spin 1s linear infinite;">sync</span> In corso...`;
                await window.electronAPI.runDiagnostics();
                btnRun.disabled = false;
                btnRun.innerHTML = `<span class="material-symbols-rounded">troubleshoot</span> Nuova Analisi`;
            });
            btnFix.addEventListener('click', async () => {
                btnFix.disabled = true;
                btnFix.innerHTML = `<span class="material-symbols-rounded" style="animation: spin 1s linear infinite;">sync</span> Applicazione...`;
                await window.electronAPI.fixDiagnostics();
                btnFix.disabled = false;
                btnFix.innerHTML = `<span class="material-symbols-rounded">build</span> Risolvi Problemi`;
            });
            const formatBytes = (bytes) => {
                if (bytes === 0) return '0 Bytes';
                const k = 1024, dm = 2, sizes = ['Bytes', 'KB', 'MB', 'GB'], i = Math.floor(Math.log(bytes) / Math.log(k));
                return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
            };
            const btnFwOpen = document.getElementById('btn-firewall-open');
            const btnFwForce = document.getElementById('btn-firewall-force');
            if (btnFwOpen) {
                btnFwOpen.addEventListener('click', async () => {
                    await window.electronAPI.openFirewallSettings();
                });
            }
            if (btnFwForce) {
                btnFwForce.addEventListener('click', async () => {
                    btnFwForce.disabled = true;
                    btnFwForce.innerHTML = `<span class="material-symbols-rounded" style="animation: spin 1s linear infinite;">sync</span> Esecuzione PowerShell...`;
                    const res = await window.electronAPI.forceFirewallRules();
                    btnFwForce.disabled = false;
                    if (res) {
                        btnFwForce.innerHTML = `<span class="material-symbols-rounded">check_circle</span> Regole Forzate con Successo`;
                        btnFwForce.style.background = 'var(--md-success)';
                        setTimeout(() => {
                            btnFwForce.innerHTML = `<span class="material-symbols-rounded">admin_panel_settings</span> Forza Regole PowerShell (Admin)`;
                            btnFwForce.style.background = '#d32f2f';
                        }, 3000);
                    } else {
                        btnFwForce.innerHTML = `<span class="material-symbols-rounded">error</span> Errore (UAC Rifiutato?)`;
                        setTimeout(() => {
                            btnFwForce.innerHTML = `<span class="material-symbols-rounded">admin_panel_settings</span> Forza Regole PowerShell (Admin)`;
                        }, 3000);
                    }
                });
            }
            const loadBackupStatus = async () => {
                try {
                    const status = await window.electronAPI.dbGetBackupStatus();
                    if (status) {
                        const sizeEl = document.getElementById('db-size');
                        const backupsEl = document.getElementById('db-backups');
                        let mainSize = status.primary.appData || status.primary.docs || 0;
                        sizeEl.innerText = mainSize ? formatBytes(mainSize) : 'Non Inizializzato';
                        let backupText = `${status.totalBackups} archivi criptati`;
                        if (status.totalBackups > 0) {
                            backupsEl.style.color = 'var(--md-success)';
                            backupsEl.innerText = backupText;
                        } else {
                            backupsEl.style.color = 'var(--md-warning)';
                            backupsEl.innerText = '0 (In attesa)';
                        }
                    }
                } catch(e) { console.error(e); }
            };
            loadBackupStatus();
            const pollTimer = setInterval(() => {
                if (!document.getElementById('db-size')) {
                    clearInterval(pollTimer);
                    return;
                }
                loadBackupStatus();
            }, 3000);
        } catch (e) {
            console.error(e);
        }
    }
};
