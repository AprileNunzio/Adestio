import { Router, toast } from './utils.js';
import dashboard from './pages/dashboard.js';
import auth_register from './pages/auth_register.js';
import auth_login from './pages/auth_login.js';
import auth_force_change from './pages/auth_force_change.js';
import oobe from './pages/oobe.js';
import app_container from './pages/app_container.js';
import network_analyzer from './pages/network_analyzer.js';
import nodes_manager from './pages/nodes/index.js';
import impostazioni_accessi from './pages/impostazioni_accessi.js';
import account_security from './pages/account_security.js';
import store from './pages/store.js';
try {
    window.Router = Router;
    window.Pages = {
        dashboard,
        auth_register,
        auth_login,
        auth_force_change,
        oobe,
        app_container,
        network_analyzer,
        nodes_manager,
        impostazioni_accessi,
        account_security,
        store
    };
    document.addEventListener('DOMContentLoaded', async () => {
        try {
            setTimeout(() => {
                const splash = document.getElementById('splash-screen');
                if (splash) {
                    splash.style.opacity = '0';
                    splash.style.visibility = 'hidden';
                    setTimeout(() => splash.remove(), 800);
                }
            }, 2000);
            const btnBack = document.getElementById('btn-nav-back');
            const btnHome = document.getElementById('btn-nav-home');
            const navTitle = document.getElementById('nav-title');
            if (btnBack) {
                btnBack.addEventListener('click', () => {
                    Router.back();
                });
            }
            if (btnHome) {
                btnHome.addEventListener('click', () => {
                    Router.navigate((window.currentUser || sessionStorage.getItem('currentUserId')) ? 'dashboard' : 'auth_login');
                });
            }
            if (window.electronAPI && window.electronAPI.onForceLogout) {
                window.electronAPI.onForceLogout((data) => {
                    const currentId = sessionStorage.getItem('currentUserId');
                    if (currentId && currentId === data.userId) {
                        sessionStorage.removeItem('currentUserId');
                        sessionStorage.removeItem('currentUser');
                        window.currentUser = null;
                        
                        const msg = `Sei stato disconnesso perché hai effettuato l'accesso presso il nodo '${data.nodeName || 'Sconosciuto'}' (IP: ${data.ipAddress || 'Sconosciuto'}) in data ${new Date().toLocaleString('it-IT')}.`;
                        toast(msg, 'error');
                        Router.navigate('auth_login');
                    }
                });
            }
            window.addEventListener('router:navigated', (e) => {
                if (btnBack) {
                    const isRootPage = ['dashboard', 'auth_login', 'auth_register', 'oobe'].includes(e.detail.pageName);
                    btnBack.style.display = (!isRootPage || Router.history.length > 1) ? 'flex' : 'none';
                    if (btnHome) {
                        btnHome.style.display = (!isRootPage) ? 'flex' : 'none';
                    }
                }
                if (navTitle) {
                    const pageNames = {
                        'dashboard': 'Dashboard',
                        'network_analyzer': 'Analisi di Rete',
                        'app_container': 'Applicazione',
                        'oobe': 'Setup Iniziale',
                        'auth_login': 'Autenticazione',
                        'auth_register': 'Registrazione',
                        'nodes_manager': 'Gestione Nodi',
                        'account_security': 'Sicurezza Account',
                        'store': 'App Store'
                    };
                    navTitle.innerText = pageNames[e.detail.pageName] || '';
                }
            });
            if (window.electronAPI) {
                document.getElementById('win-min')?.addEventListener('click', () => window.electronAPI.windowMinimize());
                document.getElementById('win-max')?.addEventListener('click', () => window.electronAPI.windowMaximize());
                document.getElementById('win-close')?.addEventListener('click', () => window.electronAPI.windowClose());
                const menuBtn = document.getElementById('app-menu-btn');
                const menuDropdown = document.getElementById('app-dropdown-menu');
                if (menuBtn && menuDropdown) {
                    menuBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        menuDropdown.style.display = menuDropdown.style.display === 'none' ? 'flex' : 'none';
                    });
                    document.addEventListener('click', () => {
                        menuDropdown.style.display = 'none';
                    });
                    document.getElementById('menu-btn-security')?.addEventListener('click', () => {
                        menuDropdown.style.display = 'none';
                        Router.navigate('account_security');
                    });
                    document.getElementById('menu-btn-store')?.addEventListener('click', () => {
                        menuDropdown.style.display = 'none';
                        Router.navigate('store');
                    });
                    document.getElementById('menu-btn-logout')?.addEventListener('click', async () => {
                        menuDropdown.style.display = 'none';
                        const currentId = sessionStorage.getItem('currentUserId');
                        try {
                            if (currentId && window.electronAPI.logoutUser) {
                                await window.electronAPI.logoutUser({ userId: currentId });
                            }
                        } catch (_) {}
                        sessionStorage.removeItem('currentUserId');
                        sessionStorage.removeItem('currentUser');
                        window.currentUser = null;
                        Router.navigate('auth_login');
                    });
                    document.getElementById('menu-btn-updates')?.addEventListener('click', () => {
                        menuDropdown.style.display = 'none';
                        window.electronAPI.checkForUpdates();
                    });
                    document.getElementById('menu-btn-github')?.addEventListener('click', () => {
                        menuDropdown.style.display = 'none';
                        window.electronAPI.openGitHub();
                    });
                    document.getElementById('menu-btn-devtools')?.addEventListener('click', () => {
                        menuDropdown.style.display = 'none';
                        window.electronAPI.toggleDevTools();
                    });
                }
            }
            if (window.electronAPI) {
                const hasConf = await window.electronAPI.hasConfig();
                if (!hasConf) {
                    await window.electronAPI.saveConfig({ setupComplete: true });
                    Router.navigate('oobe');
                } else {
                    const isRegistered = await window.electronAPI.checkIsRegistered();
                    if (isRegistered) {
                        Router.navigate('auth_login');
                    } else {
                        Router.navigate('oobe');
                    }
                }
            } else {
                Router.navigate('oobe');
            }
            if (window.electronAPI && window.electronAPI.onUserKicked) {
                window.electronAPI.onUserKicked((data) => {
                    const currentId = sessionStorage.getItem('currentUserId');
                    if (currentId && currentId === data.userId) {
                        sessionStorage.removeItem('currentUserId');
                        sessionStorage.removeItem('currentUser');
                        toast('Credenziali modificate da remoto. Disconnessione forzata.', 'error');
                        setTimeout(() => Router.navigate('auth_login'), 1500);
                    }
                });
            }
            if (window.electronAPI && window.electronAPI.onSyncAnomaly) {
                window.electronAPI.onSyncAnomaly((data) => {
                    toast(data.message || 'Anomalia nei dati di sincronizzazione', 'error');
                });
            }
            const showUpdateOverlay = (title, message) => {
                let overlay = document.getElementById('p2p-update-overlay');
                if (!overlay) {
                    overlay = document.createElement('div');
                    overlay.id = 'p2p-update-overlay';
                    overlay.style.position = 'fixed';
                    overlay.style.top = '0'; overlay.style.left = '0';
                    overlay.style.width = '100vw'; overlay.style.height = '100vh';
                    overlay.style.backgroundColor = 'rgba(0,0,0,0.85)';
                    overlay.style.backdropFilter = 'blur(10px)';
                    overlay.style.zIndex = '999999';
                    overlay.style.display = 'flex';
                    overlay.style.flexDirection = 'column';
                    overlay.style.justifyContent = 'center';
                    overlay.style.alignItems = 'center';
                    overlay.style.color = '#fff';
                    overlay.innerHTML = `
                        <div style="background: rgba(255,255,255,0.05); padding: 40px; border-radius: 16px; border: 1px solid rgba(255,255,255,0.1); text-align: center; max-width: 500px; position: relative;">
                            <button id="close-update-overlay" style="position: absolute; top: 15px; right: 15px; background: transparent; border: none; color: rgba(255,255,255,0.5); cursor: pointer;"><span class="material-symbols-rounded">close</span></button>
                            <span class="material-symbols-rounded" style="font-size: 64px; color: var(--md-primary); margin-bottom: 20px;">system_update_alt</span>
                            <h2 id="p2p-update-title" style="margin: 0 0 10px 0; font-weight: 500;">${title}</h2>
                            <p id="p2p-update-msg" style="margin: 0 0 20px 0; color: rgba(255,255,255,0.7); line-height: 1.5;">${message}</p>
                            <div style="width: 100%; background: rgba(255,255,255,0.1); border-radius: 8px; height: 16px; overflow: hidden; margin-bottom: 10px;">
                                <div id="p2p-update-progress-bar" style="width: 0%; height: 100%; background: var(--md-primary); transition: width 0.3s ease;"></div>
                            </div>
                            <div id="p2p-update-status" style="font-size: 14px; color: rgba(255,255,255,0.5);">Inizializzazione...</div>
                        </div>
                    `;
                    document.body.appendChild(overlay);
                    document.getElementById('close-update-overlay').addEventListener('click', () => {
                        overlay.style.display = 'none'; 
                    });
                } else {
                    overlay.style.display = 'flex';
                    document.getElementById('p2p-update-title').innerText = title;
                    document.getElementById('p2p-update-msg').innerText = message;
                }
            };
            if (window.electronAPI && window.electronAPI.onNetworkVersionMismatch) {
                window.electronAPI.onNetworkVersionMismatch((data) => {
                    showUpdateOverlay(
                        "Aggiornamento di Rete Obbligatorio", 
                        "È stata rilevata una versione del protocollo più recente sulla rete locale. Per proteggere l'integrità del database, questo nodo deve aggiornarsi."
                    );
                    document.getElementById('close-update-overlay').style.display = 'none'; 
                    window.electronAPI.forceP2PUpdate(data.peerIp);
                });
            }
            if (window.electronAPI && window.electronAPI.onUpdateDownloadProgress) {
                window.electronAPI.onUpdateDownloadProgress((progressData) => {
                    const bar = document.getElementById('p2p-update-progress-bar');
                    const stat = document.getElementById('p2p-update-status');
                    if (bar) bar.style.width = Math.max(5, progressData.percent) + '%';
                    if (stat) stat.innerText = 'Scaricamento: ' + progressData.percent.toFixed(1) + '%';
                });
            }
            if (window.electronAPI && window.electronAPI.onUpdateStatus) {
                window.electronAPI.onUpdateStatus((statusData) => {
                    const isSilent = statusData.status.includes('Ricerca') || statusData.status.includes('Sei aggiornato') || statusData.status.includes('Errore');
                    let overlay = document.getElementById('p2p-update-overlay');
                    if (isSilent) {
                        if (!overlay || overlay.style.display === 'none') {
                            toast(statusData.status, statusData.status.includes('Errore') ? 'error' : 'info');
                            return;
                        }
                    }
                    if (!overlay || overlay.style.display === 'none') {
                        showUpdateOverlay("Aggiornamento Software", "Download nuova versione in corso...");
                    }
                    const stat = document.getElementById('p2p-update-status');
                    if (stat) stat.innerText = statusData.status;
                    
                    if (statusData.waitingConsensus && overlay) {
                        let forceBtn = document.getElementById('p2p-force-update-btn');
                        if (!forceBtn) {
                            forceBtn = document.createElement('button');
                            forceBtn.id = 'p2p-force-update-btn';
                            forceBtn.innerText = 'Forza Installazione Ora';
                            forceBtn.style = 'margin-top: 15px; background: var(--md-error, #cf6679); color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-weight: bold; width: 100%; transition: opacity 0.2s;';
                            forceBtn.onclick = () => {
                                if (window.electronAPI && window.electronAPI.forceUpdateConsensus) {
                                    window.electronAPI.forceUpdateConsensus();
                                }
                                forceBtn.innerText = 'Forzatura in corso...';
                                forceBtn.disabled = true;
                                forceBtn.style.opacity = '0.5';
                            };
                            stat.parentNode.insertBefore(forceBtn, stat.nextSibling);
                        }
                    }
                    
                    if (statusData.finished) {
                        const bar = document.getElementById('p2p-update-progress-bar');
                        if (bar) bar.style.width = '100%';
                        setTimeout(() => {
                            let ov = document.getElementById('p2p-update-overlay');
                            if (ov && !statusData.status.includes('Riavvio')) {
                                ov.style.display = 'none';
                            }
                        }, 3000);
                    }
                });
            }
            if (window.electronAPI && window.electronAPI.onUpdateReadyForInstall) {
                window.electronAPI.onUpdateReadyForInstall((data) => {
                    let overlay = document.getElementById('p2p-update-overlay');
                    if (overlay) overlay.style.display = 'none';
                    const modal = document.getElementById('update-consent-modal');
                    const versionText = document.getElementById('update-consent-version');
                    const menuDropdown = document.getElementById('app-dropdown-menu');
                    if (menuDropdown) menuDropdown.style.display = 'none';
                    if (modal && versionText) {
                        versionText.innerText = `L'aggiornamento ${data.version}`;
                        modal.style.display = 'flex';
                    }

                    const btnLater = document.getElementById('update-consent-later');
                    const btnNow = document.getElementById('update-consent-now');

                    if (btnLater) {
                        btnLater.onclick = () => {
                            modal.style.display = 'none';
                            toast('Aggiornamento posticipato. Verrà installato al prossimo avvio.', 'info');
                        };
                    }

                    if (btnNow) {
                        btnNow.onclick = async () => {
                            btnNow.innerText = 'Riavvio in corso...';
                            btnNow.disabled = true;
                            if (btnLater) btnLater.disabled = true;
                            const installTimeout = setTimeout(() => {
                                toast('Installazione non avviata. Riprova.', 'error');
                                btnNow.innerText = 'Riavvia e Installa';
                                btnNow.disabled = false;
                                if (btnLater) btnLater.disabled = false;
                            }, 8000);
                            try {
                                const started = await window.electronAPI.installPendingUpdate();
                                if (started) {
                                    clearTimeout(installTimeout);
                                } else {
                                    clearTimeout(installTimeout);
                                    toast('Impossibile avviare l\'installazione.', 'error');
                                    btnNow.innerText = 'Riavvia e Installa';
                                    btnNow.disabled = false;
                                    if (btnLater) btnLater.disabled = false;
                                }
                            } catch (e) {
                                clearTimeout(installTimeout);
                                toast('Errore durante l\'avvio dell\'installazione.', 'error');
                                btnNow.innerText = 'Riavvia e Installa';
                                btnNow.disabled = false;
                                if (btnLater) btnLater.disabled = false;
                            }
                        };
                    }
                });
            }
            setInterval(async () => {
                if (window.electronAPI) {
                    try {
                        const status = await window.electronAPI.getAppStatus();
                        const ips = await window.electronAPI.getLocalIPs();
                        const isOffline = !navigator.onLine || ips.length === 0;
                        if (status) {
                            const verEl = document.getElementById('sb-version');
                            const sysEl = document.getElementById('sb-system');
                            const nodesEl = document.getElementById('sb-nodes');
                            if (verEl) verEl.innerText = `Versione ${status.version}`;
                            if (sysEl) {
                                if (isOffline) {
                                    sysEl.innerText = 'Isolamento Rete';
                                    sysEl.previousElementSibling.style.color = 'var(--md-error)';
                                    sysEl.previousElementSibling.innerText = 'wifi_off';
                                } else {
                                    sysEl.innerText = status.isOk ? 'Sistema OK' : 'Errore';
                                    sysEl.previousElementSibling.style.color = status.isOk ? 'var(--md-success)' : 'var(--md-error)';
                                    sysEl.previousElementSibling.innerText = status.isOk ? 'check_circle' : 'error';
                                }
                            }
                            if (nodesEl) nodesEl.innerText = `Nodi Connessi: ${status.connectedNodes}`;
                            
                            const ipEl = document.getElementById('sb-ip');
                            if (ipEl) {
                                if (isOffline) {
                                    ipEl.innerText = 'IP: Offline';
                                    ipEl.previousElementSibling.style.color = 'var(--md-error)';
                                } else {
                                    ipEl.innerText = `IP: ${ips[0]}`;
                                    ipEl.previousElementSibling.style.color = 'var(--md-secondary)';
                                }
                            }
                            
                            const errContainer = document.getElementById('sb-errors-container');
                            const errEl = document.getElementById('sb-errors');
                            if (errContainer && errEl) {
                                if (status.activeErrors > 0) {
                                    errContainer.style.display = 'flex';
                                    errEl.innerText = `Errori: ${status.activeErrors}`;
                                } else {
                                    errContainer.style.display = 'none';
                                }
                            }
                            
                            const syncEl = document.getElementById('sb-sync');
                            const syncIcon = document.getElementById('sb-sync-icon');
                            if (syncEl && status.syncState) {
                                syncEl.innerText = status.syncState;
                                if (status.syncState.includes('corso') || status.syncState.includes('Controllo')) {
                                    syncIcon.style.animation = 'spin 2s linear infinite';
                                    syncIcon.style.color = 'var(--md-warning)';
                                } else if (status.syncState.includes('Errore')) {
                                    syncIcon.style.animation = 'none';
                                    syncIcon.style.color = 'var(--md-error)';
                                } else {
                                    syncIcon.style.animation = 'none';
                                    syncIcon.style.color = 'var(--md-primary)';
                                }
                            }
                        }
                    } catch(e) {}
                }
            }, 3000);

            // Poll for distributed logs
            setInterval(async () => {
                if (window.electronAPI && window.electronAPI.rbac) {
                    try {
                        const errContainer = document.getElementById('sb-errors-container');
                        const logsRes = await window.electronAPI.rbac.getDistributedLogs();
                        if (logsRes && logsRes.success) {
                            if (errContainer) errContainer.style.display = 'flex';
                            const count = logsRes.logs.length;
                            const sbErrors = document.getElementById('sb-errors');
                            if (sbErrors) sbErrors.textContent = `Errori: ${count}`;
                            if (count > 0) {
                                errContainer.style.color = 'var(--md-error)';
                                errContainer.classList.add('pulse-animation');
                            } else {
                                errContainer.style.color = 'var(--md-outline)';
                                errContainer.classList.remove('pulse-animation');
                            }
                        } else {
                            if (errContainer) errContainer.style.display = 'none';
                        }
                    } catch (e) {
                        const errContainer = document.getElementById('sb-errors-container');
                        if (errContainer) errContainer.style.display = 'none';
                    }
                }
            }, 10000);

        } catch (e) {
            console.error(e);
        }
        const nodesContainer = document.getElementById('sb-nodes-container');
        if (nodesContainer) {
            nodesContainer.addEventListener('click', () => {
                Router.navigate('nodes_manager');
            });
        }
        const syncContainer = document.getElementById('sb-sync-container');
        if (syncContainer) {
            syncContainer.addEventListener('click', async () => {
                const icon = document.getElementById('sb-sync-icon');
                if (icon) {
                    icon.style.animation = 'spin 1s linear infinite';
                }
                if (window.electronAPI && window.electronAPI.forceSync) {
                    try {
                        await window.electronAPI.forceSync();
                    } catch(e) {}
                }
            });
        }
        const versionContainer = document.getElementById('sb-version-container');
        if (versionContainer) {
            versionContainer.addEventListener('click', () => {
                if (window.electronAPI) window.electronAPI.checkForUpdates();
            });
        }
        const systemContainer = document.getElementById('sb-system-container');
        if (systemContainer) {
            systemContainer.addEventListener('click', () => {
                Router.navigate('network_analyzer');
            });
        }
        const errorsContainer = document.getElementById('sb-errors-container');
        if (errorsContainer) {
            errorsContainer.addEventListener('click', () => {
                Router.navigate('app_container', { appId: 'amministratore', subAppId: 'errori_sync' });
            });
        }
    });
} catch (e) {
    console.error(e);
}
