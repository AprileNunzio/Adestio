import { toast } from '../../../../js/utils.js';

export default {
    render: async (el) => {
        try {
            el.innerHTML = `
                <div class="fade-in-up" style="display: flex; flex-direction: column; height: 100%; padding: 1.5rem; overflow-y: auto; overflow-x: hidden;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 2rem; flex-wrap: wrap; gap: 1rem;">
                        <div>
                            <h2 style="margin: 0 0 0.5rem 0; font-size: 2rem; color: var(--md-on-surface); font-weight: 800; letter-spacing: -0.02em; display: flex; align-items: center; gap: 0.8rem;">
                                <span class="material-symbols-rounded" style="color: var(--md-primary); font-size: 2.2rem;">system_update</span>
                                Aggiornamenti & Cache
                            </h2>
                            <p style="margin: 0; color: var(--md-on-surface-variant); font-size: 1.1rem;">Gestisci la modalità di aggiornamento di Adestio, delle applicazioni dello Store e la pulizia della cache di memoria.</p>
                        </div>
                        <div style="display: flex; gap: 1rem;">
                            <button id="btn-save-settings" class="btn primary" style="display: flex; align-items: center; gap: 0.5rem; padding: 0.8rem 1.5rem; border-radius: 12px; font-weight: 600;">
                                <span class="material-symbols-rounded">save</span> Salva Impostazioni
                            </button>
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(420px, 1fr)); gap: 1.5rem; margin-bottom: 2rem;">
                        <div class="card" style="padding: 1.5rem; background: var(--md-surface); border-radius: 16px; border: 1px solid var(--md-surface-variant); display: flex; flex-direction: column; gap: 1.5rem; box-shadow: 0 4px 6px rgba(0,0,0,0.03);">
                            <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--md-surface-variant); padding-bottom: 1rem;">
                                <div style="display: flex; align-items: center; gap: 0.8rem;">
                                    <span class="material-symbols-rounded" style="color: var(--md-primary); font-size: 1.8rem;">desktop_windows</span>
                                    <h3 style="margin: 0; font-size: 1.25rem; color: var(--md-on-surface); font-weight: 700;">Applicazione Principale (Adestio)</h3>
                                </div>
                                <span id="core-version-badge" class="badge" style="background: var(--md-primary-container); color: var(--md-on-primary-container); padding: 0.3rem 0.8rem; border-radius: 20px; font-weight: 600; font-size: 0.85rem;">v...</span>
                            </div>

                            <div>
                                <label class="text-label" style="display: block; margin-bottom: 0.6rem; color: var(--md-on-surface); font-weight: 600; font-size: 0.95rem;">Modalità di Aggiornamento</label>
                                <div style="display: flex; flex-direction: column; gap: 0.8rem; background: var(--md-surface-variant); padding: 1rem; border-radius: 12px;">
                                    <label style="display: flex; align-items: flex-start; gap: 0.8rem; cursor: pointer;">
                                        <input type="radio" name="updates_core_mode" value="auto" id="core-mode-auto" style="margin-top: 0.2rem; cursor: pointer;">
                                        <div>
                                            <span style="font-weight: 600; color: var(--md-on-surface); display: block;">Automatica (Consigliata)</span>
                                            <span style="font-size: 0.85rem; color: var(--md-on-surface-variant);">Scarica e notifica/installa automaticamente le nuove release di Adestio tramite rete LAN P2P o repository globale.</span>
                                        </div>
                                    </label>
                                    <label style="display: flex; align-items: flex-start; gap: 0.8rem; cursor: pointer;">
                                        <input type="radio" name="updates_core_mode" value="manual" id="core-mode-manual" style="margin-top: 0.2rem; cursor: pointer;">
                                        <div>
                                            <span style="font-weight: 600; color: var(--md-on-surface); display: block;">Manuale</span>
                                            <span style="font-size: 0.85rem; color: var(--md-on-surface-variant);">Ricerca e installa gli aggiornamenti di Adestio soltanto quando richiesto esplicitamente dall'amministratore.</span>
                                        </div>
                                    </label>
                                </div>
                            </div>

                            <div style="display: flex; align-items: center; gap: 0.8rem; padding: 0.5rem 0;">
                                <input type="checkbox" id="core-auto-check" style="width: 1.3rem; height: 1.3rem; cursor: pointer;">
                                <label for="core-auto-check" style="color: var(--md-on-surface); font-size: 0.95rem; cursor: pointer; font-weight: 500;">
                                    Abilita verifica periodica in background (ogni 4 ore)
                                </label>
                            </div>

                            <div style="margin-top: auto; padding-top: 1rem; border-top: 1px dashed var(--md-surface-variant); display: flex; flex-direction: column; gap: 1rem;">
                                <div style="display: flex; justify-content: space-between; align-items: center; gap: 1rem;">
                                    <button id="btn-check-core" class="btn secondary" style="display: flex; align-items: center; gap: 0.5rem; flex: 1; justify-content: center;">
                                        <span class="material-symbols-rounded">refresh</span> Verifica Aggiornamenti Adestio
                                    </button>
                                </div>
                                <div id="core-status-box" style="display: none; padding: 0.8rem 1rem; border-radius: 10px; background: var(--md-surface-variant); font-size: 0.9rem; color: var(--md-on-surface); line-height: 1.4;"></div>
                            </div>
                        </div>

                        <div class="card" style="padding: 1.5rem; background: var(--md-surface); border-radius: 16px; border: 1px solid var(--md-surface-variant); display: flex; flex-direction: column; gap: 1.5rem; box-shadow: 0 4px 6px rgba(0,0,0,0.03);">
                            <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--md-surface-variant); padding-bottom: 1rem;">
                                <div style="display: flex; align-items: center; gap: 0.8rem;">
                                    <span class="material-symbols-rounded" style="color: var(--md-primary); font-size: 1.8rem;">apps</span>
                                    <h3 style="margin: 0; font-size: 1.25rem; color: var(--md-on-surface); font-weight: 700;">Applicazioni & Moduli Store</h3>
                                </div>
                                <span id="apps-count-badge" class="badge" style="background: var(--md-secondary-container); color: var(--md-on-secondary-container); padding: 0.3rem 0.8rem; border-radius: 20px; font-weight: 600; font-size: 0.85rem;">... App</span>
                            </div>

                            <div>
                                <label class="text-label" style="display: block; margin-bottom: 0.6rem; color: var(--md-on-surface); font-weight: 600; font-size: 0.95rem;">Modalità di Aggiornamento Software</label>
                                <div style="display: flex; flex-direction: column; gap: 0.8rem; background: var(--md-surface-variant); padding: 1rem; border-radius: 12px;">
                                    <label style="display: flex; align-items: flex-start; gap: 0.8rem; cursor: pointer;">
                                        <input type="radio" name="updates_apps_mode" value="auto" id="apps-mode-auto" style="margin-top: 0.2rem; cursor: pointer;">
                                        <div>
                                            <span style="font-weight: 600; color: var(--md-on-surface); display: block;">Automatica (Consigliata)</span>
                                            <span style="font-size: 0.85rem; color: var(--md-on-surface-variant);">Aggiorna automaticamente le applicazioni installate in background e notifica ad operazione ultimata.</span>
                                        </div>
                                    </label>
                                    <label style="display: flex; align-items: flex-start; gap: 0.8rem; cursor: pointer;">
                                        <input type="radio" name="updates_apps_mode" value="manual" id="apps-mode-manual" style="margin-top: 0.2rem; cursor: pointer;">
                                        <div>
                                            <span style="font-weight: 600; color: var(--md-on-surface); display: block;">Manuale</span>
                                            <span style="font-size: 0.85rem; color: var(--md-on-surface-variant);">Notifica la presenza di aggiornamenti nello Store, lasciando all'utente la scelta di avviare l'installazione.</span>
                                        </div>
                                    </label>
                                </div>
                            </div>

                            <div style="display: flex; align-items: center; gap: 0.8rem; padding: 0.5rem 0;">
                                <input type="checkbox" id="apps-auto-check" style="width: 1.3rem; height: 1.3rem; cursor: pointer;">
                                <label for="apps-auto-check" style="color: var(--md-on-surface); font-size: 0.95rem; cursor: pointer; font-weight: 500;">
                                    Abilita ricerca automatica aggiornamenti app in background
                                </label>
                            </div>

                            <div style="margin-top: auto; padding-top: 1rem; border-top: 1px dashed var(--md-surface-variant); display: flex; flex-direction: column; gap: 1rem;">
                                <div style="display: flex; justify-content: space-between; align-items: center; gap: 1rem;">
                                    <button id="btn-check-apps" class="btn secondary" style="display: flex; align-items: center; gap: 0.5rem; flex: 1; justify-content: center;">
                                        <span class="material-symbols-rounded">sync</span> Verifica Aggiornamenti Store
                                    </button>
                                </div>
                                <div id="apps-status-box" style="display: none; padding: 0.8rem 1rem; border-radius: 10px; background: var(--md-surface-variant); font-size: 0.9rem; color: var(--md-on-surface); line-height: 1.4;"></div>
                            </div>
                        </div>

                        <div class="card" style="grid-column: 1 / -1; padding: 1.5rem; background: var(--md-surface); border-radius: 16px; border: 1px solid var(--md-surface-variant); display: flex; flex-direction: column; gap: 1.5rem; box-shadow: 0 4px 6px rgba(0,0,0,0.03);">
                            <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--md-surface-variant); padding-bottom: 1rem;">
                                <div style="display: flex; align-items: center; gap: 0.8rem;">
                                    <span class="material-symbols-rounded" style="color: var(--md-primary); font-size: 1.8rem;">cleaning_services</span>
                                    <h3 style="margin: 0; font-size: 1.25rem; color: var(--md-on-surface); font-weight: 700;">Gestione Cache & Memoria Moduli</h3>
                                </div>
                            </div>

                            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1.5rem; align-items: center;">
                                <div>
                                    <div style="display: flex; align-items: center; gap: 0.8rem; margin-bottom: 0.8rem;">
                                        <input type="checkbox" id="auto-clear-cache" style="width: 1.3rem; height: 1.3rem; cursor: pointer;">
                                        <label for="auto-clear-cache" style="color: var(--md-on-surface); font-size: 0.95rem; cursor: pointer; font-weight: 600;">
                                            Svuota e sovrascrivi la cache a ogni aggiornamento (Consigliato)
                                        </label>
                                    </div>
                                    <p style="margin: 0; color: var(--md-on-surface-variant); font-size: 0.9rem; line-height: 1.5;">
                                        Garantisce che nessuna versione obsoleta di script, stili o pacchetti rimanga attiva dopo un aggiornamento dell'applicazione principale o dei moduli installati.
                                    </p>
                                </div>

                                <div style="display: flex; justify-content: flex-end; align-items: center; gap: 1rem;">
                                    <button id="btn-clear-cache-now" class="btn" style="background: var(--md-surface-variant); color: var(--md-on-surface); border: 1px solid var(--md-outline-variant); display: flex; align-items: center; gap: 0.5rem; padding: 0.8rem 1.5rem; border-radius: 12px; font-weight: 600; cursor: pointer;">
                                        <span class="material-symbols-rounded">delete_sweep</span> Svuota Cache Adesso
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            const coreModeAuto = el.querySelector('#core-mode-auto');
            const coreModeManual = el.querySelector('#core-mode-manual');
            const coreAutoCheck = el.querySelector('#core-auto-check');
            const appsModeAuto = el.querySelector('#apps-mode-auto');
            const appsModeManual = el.querySelector('#apps-mode-manual');
            const appsAutoCheck = el.querySelector('#apps-auto-check');
            const autoClearCache = el.querySelector('#auto-clear-cache');
            const coreVersionBadge = el.querySelector('#core-version-badge');
            const appsCountBadge = el.querySelector('#apps-count-badge');
            const coreStatusBox = el.querySelector('#core-status-box');
            const appsStatusBox = el.querySelector('#apps-status-box');
            const btnSave = el.querySelector('#btn-save-settings');
            const btnCheckCore = el.querySelector('#btn-check-core');
            const btnCheckApps = el.querySelector('#btn-check-apps');
            const btnClearCacheNow = el.querySelector('#btn-clear-cache-now');

            try {
                if (window.electronAPI && window.electronAPI.getAppStatus) {
                    const status = await window.electronAPI.getAppStatus();
                    if (status && status.version) {
                        coreVersionBadge.textContent = `v${status.version}`;
                    }
                }
            } catch (eStatus) {}

            try {
                if (window.electronAPI && window.electronAPI.store && window.electronAPI.store.getInstalled) {
                    const instRes = await window.electronAPI.store.getInstalled();
                    if (instRes && instRes.success && Array.isArray(instRes.data)) {
                        appsCountBadge.textContent = `${instRes.data.length} App installate`;
                    }
                }
            } catch (eAppsCount) {}

            try {
                if (window.electronAPI && window.electronAPI.getUpdateSettings) {
                    const res = await window.electronAPI.getUpdateSettings();
                    if (res && res.success && res.data) {
                        const d = res.data;
                        if (d.updates_core_mode === 'manual') {
                            coreModeManual.checked = true;
                        } else {
                            coreModeAuto.checked = true;
                        }
                        coreAutoCheck.checked = d.updates_core_auto_check !== false;

                        if (d.updates_apps_mode === 'manual') {
                            appsModeManual.checked = true;
                        } else {
                            appsModeAuto.checked = true;
                        }
                        appsAutoCheck.checked = d.updates_apps_auto_check !== false;
                        autoClearCache.checked = d.auto_clear_cache_on_update !== false;
                    }
                }
            } catch (eLoadSettings) {
                console.error(eLoadSettings);
            }

            btnSave.addEventListener('click', async () => {
                try {
                    const oldHtml = btnSave.innerHTML;
                    btnSave.disabled = true;
                    btnSave.innerHTML = '<span class="material-symbols-rounded spin">sync</span> Salvataggio...';

                    const payload = {
                        updates_core_mode: coreModeManual.checked ? 'manual' : 'auto',
                        updates_core_auto_check: coreAutoCheck.checked,
                        updates_apps_mode: appsModeManual.checked ? 'manual' : 'auto',
                        updates_apps_auto_check: appsAutoCheck.checked,
                        auto_clear_cache_on_update: autoClearCache.checked
                    };

                    const res = await window.electronAPI.saveUpdateSettings(payload);
                    btnSave.disabled = false;
                    btnSave.innerHTML = oldHtml;

                    if (res && res.success) {
                        toast('Impostazioni aggiornamenti salvate con successo!', 'success');
                    } else {
                        toast('Errore durante il salvataggio: ' + (res?.error || 'Impossibile salvare'), 'error');
                    }
                } catch (eSave) {
                    btnSave.disabled = false;
                    btnSave.innerHTML = '<span class="material-symbols-rounded">save</span> Salva Impostazioni';
                    toast('Errore: ' + eSave.message, 'error');
                }
            });

            btnCheckCore.addEventListener('click', async () => {
                try {
                    coreStatusBox.style.display = 'block';
                    coreStatusBox.innerHTML = '<div style="display:flex;align-items:center;gap:0.5rem;"><span class="material-symbols-rounded spin">sync</span> Ricerca aggiornamenti Adestio in corso...</div>';
                    await window.electronAPI.checkForUpdates();
                } catch (eCoreCheck) {
                    coreStatusBox.style.display = 'block';
                    coreStatusBox.textContent = 'Errore durante la verifica: ' + eCoreCheck.message;
                }
            });

            if (window.electronAPI && window.electronAPI.onUpdateStatus) {
                window.electronAPI.onUpdateStatus((data) => {
                    try {
                        if (!data) return;
                        coreStatusBox.style.display = 'block';
                        coreStatusBox.textContent = data.status || 'Operazione in corso...';
                    } catch (e) {}
                });
            }

            btnCheckApps.addEventListener('click', async () => {
                try {
                    appsStatusBox.style.display = 'block';
                    appsStatusBox.innerHTML = '<div style="display:flex;align-items:center;gap:0.5rem;"><span class="material-symbols-rounded spin">sync</span> Ricerca aggiornamenti Store in corso...</div>';
                    const res = await window.electronAPI.store.checkUpdates();
                    if (res && res.success && Array.isArray(res.data)) {
                        if (res.data.length === 0) {
                            appsStatusBox.innerHTML = '<div style="color:#2e7d32;font-weight:600;display:flex;align-items:center;gap:0.4rem;"><span class="material-symbols-rounded">check_circle</span> Tutte le applicazioni dello Store sono aggiornate.</div>';
                        } else {
                            appsStatusBox.innerHTML = `<div style="color:var(--md-primary);font-weight:600;display:flex;align-items:center;gap:0.4rem;"><span class="material-symbols-rounded">info</span> Trovati ${res.data.length} aggiornamenti disponibili per le app.</div>`;
                            if (appsModeAuto.checked) {
                                window.electronAPI.store.forceCheckUpdates();
                            }
                        }
                    } else {
                        appsStatusBox.textContent = 'Nessun nuovo aggiornamento disponibile.';
                    }
                } catch (eAppsCheck) {
                    appsStatusBox.style.display = 'block';
                    appsStatusBox.textContent = 'Errore durante la verifica dello Store: ' + eAppsCheck.message;
                }
            });

            btnClearCacheNow.addEventListener('click', async () => {
                try {
                    const oldHtml = btnClearCacheNow.innerHTML;
                    btnClearCacheNow.disabled = true;
                    btnClearCacheNow.innerHTML = '<span class="material-symbols-rounded spin">sync</span> Pulizia cache in corso...';

                    const res = await window.electronAPI.clearAppCache();
                    btnClearCacheNow.disabled = false;
                    btnClearCacheNow.innerHTML = oldHtml;

                    if (res && res.success) {
                        toast('Cache HTTP, moduli e session storage svuotati con successo!', 'success');
                    } else {
                        toast('Errore durante la pulizia della cache: ' + (res?.error || 'Operazione fallita'), 'error');
                    }
                } catch (eCacheClear) {
                    btnClearCacheNow.disabled = false;
                    btnClearCacheNow.innerHTML = '<span class="material-symbols-rounded">delete_sweep</span> Svuota Cache Adesso';
                    toast('Errore: ' + eCacheClear.message, 'error');
                }
            });

        } catch (e) {
            el.innerHTML = '<div style="padding: 2rem; color: var(--md-error);">Errore rendering modulo Aggiornamenti: ' + e.message + '</div>';
        }
    }
};
