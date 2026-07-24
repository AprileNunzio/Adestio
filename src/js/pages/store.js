import { Router, toast } from '../utils.js';

async function isSuperadmin() {
    try {
        const userId = sessionStorage.getItem('currentUserId');
        if (!userId || !window.electronAPI || !window.electronAPI.rbac) return false;
        const perms = await window.electronAPI.rbac.getEffectiveUserPermissions(userId);
        return Array.isArray(perms) && perms.includes('*');
    } catch (e) {
        return false;
    }
}

const CATEGORY_LABELS = {
    hr: 'Risorse Umane',
    erp: 'Gestionale ERP',
    school: 'Scuola & Formazione',
    personal: 'Produttività',
    utility: 'Utilità di Sistema'
};

const UPDATE_BADGE = {
    pending:     { cls: 'badge-updating', icon: 'schedule',      text: 'In coda' },
    downloading: { cls: 'badge-updating', icon: 'download',       text: 'Scaricamento...' },
    installing:  { cls: 'badge-updating', icon: 'system_update',  text: 'Installazione...' },
    done:        { cls: 'badge-done',     icon: 'check_circle',   text: 'Aggiornato' },
    error:       { cls: 'badge-error',    icon: 'error',          text: 'Errore' }
};

export default {
    render: async (el) => {
        try {
            const userId = sessionStorage.getItem('currentUserId');
            if (!window.currentUser && !userId) {
                Router.navigate('auth_login');
                return;
            }
            const admin = await isSuperadmin();

            el.innerHTML = `
                <div id="store-main-view" class="fade-in-up" style="width: 100%; flex: 1; display: flex; flex-direction: column;">
                    <div style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 1.5rem; margin-bottom: 1.5rem; width: 100%;">
                        <div style="flex: 1; min-width: 300px;">
                            <h1 class="text-title" style="font-size: 2.4rem; color: var(--md-primary); margin-bottom: 0.2rem; letter-spacing: -0.02em; text-align: left; display: flex; align-items: center; gap: 0.6rem;">
                                <span class="material-symbols-rounded" style="font-size: 2.6rem;">storefront</span>
                                App Store & Update Hub
                            </h1>
                            <p class="text-body" style="color: var(--md-on-surface-variant); font-size: 1.05rem; text-align: left;">
                                ${admin ? 'Esplora il marketplace, installa le applicazioni di terze parti e mantieni aggiornato il tuo nodo.' : 'Applicazioni disponibili. Solo i Super Amministratori possono installare o aggiornare le applicazioni.'}
                            </p>
                        </div>
                        <div style="display: flex; gap: 1rem; align-items: center; flex-wrap: wrap;">
                            <button id="btn-check-updates" class="btn" style="background: var(--md-surface-variant); color: var(--md-on-surface); border: 1px solid var(--md-outline-variant); border-radius: 28px; padding: 0.75rem 1.4rem; font-weight: 600; display: inline-flex; align-items: center; gap: 0.5rem; cursor: pointer; transition: all 0.2s ease;">
                                <span class="material-symbols-rounded" id="icon-check-updates">sync</span> Verifica Aggiornamenti
                            </button>
                            <div style="position: relative; width: 300px;">
                                <span class="material-symbols-rounded" style="position: absolute; left: 1rem; top: 0.75rem; color: var(--md-on-surface-variant);">search</span>
                                <input type="text" id="store-search" class="input" placeholder="Cerca applicazione..." style="padding-left: 2.8rem; padding-top: 0.7rem; padding-bottom: 0.7rem; width: 100%; border-radius: 28px; background: var(--md-surface-variant); border: 1px solid var(--md-outline-variant); font-size: 1rem;">
                            </div>
                        </div>
                    </div>

                    <div style="display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; margin-bottom: 1.5rem; border-bottom: 1px solid var(--md-outline-variant);">
                        <div style="display: flex; gap: 0.5rem;">
                            <button class="store-tab active" data-tab="available">Terze Parti</button>
                            <button class="store-tab" data-tab="updates">Aggiornamenti <span id="updates-count-badge" class="badge-count" style="display: none;">0</span></button>
                            <button class="store-tab" data-tab="installed">Installate</button>
                            <button class="store-tab" data-tab="core">Sistema</button>
                        </div>
                        <div id="update-all-container" style="display: none;">
                            <button id="btn-update-all" class="btn" style="background: var(--md-primary); color: var(--md-on-primary); border-radius: 20px; padding: 0.5rem 1.2rem; font-weight: 700; font-size: 0.9rem; border: none; cursor: pointer; display: inline-flex; align-items: center; gap: 0.4rem;">
                                <span class="material-symbols-rounded">system_update_alt</span> Aggiorna Tutte
                            </button>
                        </div>
                    </div>

                    <div id="store-grid" class="apps-grid">
                        <p style="color: var(--md-on-surface-variant);">Caricamento store in corso...</p>
                    </div>
                </div>

                <div id="store-detail-view" style="display: none; width: 100%; flex: 1; flex-direction: column;">
                    <div style="margin-bottom: 1.5rem;">
                        <button id="btn-back-store" class="btn" style="background: transparent; border: 1px solid var(--md-outline); color: var(--md-on-surface); display: inline-flex; align-items: center; gap: 0.5rem; border-radius: 12px; cursor: pointer; font-weight: 600;">
                            <span class="material-symbols-rounded">arrow_back</span> Torna allo Store
                        </button>
                    </div>
                    <div id="store-detail-content" style="background: var(--md-surface); border-radius: 24px; padding: 2.5rem; border: 1px solid var(--md-outline-variant); box-shadow: 0 10px 30px rgba(0,0,0,0.05);"></div>
                </div>

                <style>
                    .store-tab {
                        background: transparent;
                        border: none;
                        border-bottom: 3px solid transparent;
                        padding: 0.8rem 1.2rem;
                        font-family: var(--font-body);
                        font-size: 1rem;
                        font-weight: 600;
                        color: var(--md-on-surface-variant);
                        cursor: pointer;
                        transition: all 0.2s ease;
                        display: inline-flex;
                        align-items: center;
                        gap: 0.4rem;
                    }
                    .store-tab:hover { color: var(--md-primary); }
                    .store-tab.active { color: var(--md-primary); border-bottom-color: var(--md-primary); }
                    .badge-count {
                        background: var(--md-error);
                        color: var(--md-on-error);
                        font-size: 0.75rem;
                        font-weight: 700;
                        padding: 0.1rem 0.5rem;
                        border-radius: 999px;
                    }
                    .store-badge {
                        display: inline-flex; align-items: center; gap: 0.3rem;
                        font-size: 0.75rem; font-weight: 700; letter-spacing: 0.02em;
                        padding: 0.25rem 0.65rem; border-radius: 999px; width: fit-content;
                    }
                    .store-badge.installed { background: var(--md-success-container); color: var(--md-on-success-container); }
                    .store-badge.update { background: var(--md-tertiary-container); color: var(--md-on-tertiary-container); border: 1px solid var(--md-tertiary); }
                    .store-badge.category { background: var(--md-secondary-container); color: var(--md-on-secondary-container); }
                    .store-badge.core { background: var(--md-primary-container); color: var(--md-on-primary-container); }
                    .detail-header { display: flex; gap: 1.8rem; align-items: center; margin-bottom: 2rem; }
                    .detail-icon { width: 96px; height: 96px; border-radius: 20px; object-fit: contain; box-shadow: 0 6px 16px rgba(0,0,0,0.1); }
                    .detail-title { font-size: 2.3rem; font-weight: 800; color: var(--md-on-surface); margin: 0; }
                    .detail-developer { font-size: 1.05rem; color: var(--md-primary); font-weight: 600; margin-top: 0.2rem; }
                    .detail-section { margin-top: 2rem; border-top: 1px solid var(--md-outline-variant); padding-top: 1.5rem; }
                    .detail-h3 { font-size: 1.3rem; color: var(--md-on-surface); margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem; }
                    .detail-text { font-size: 1rem; color: var(--md-on-surface-variant); line-height: 1.6; }
                    .detail-action-bar { display: flex; gap: 1rem; margin-top: 1.5rem; flex-wrap: wrap; }
                    .btn-install-large { background: var(--md-primary); color: var(--md-on-primary); border: none; padding: 1rem 2rem; border-radius: 14px; font-size: 1.1rem; font-weight: bold; cursor: pointer; display: inline-flex; align-items: center; gap: 0.5rem; }
                    .btn-update-large { background: var(--md-tertiary); color: var(--md-on-tertiary); border: none; padding: 1rem 2rem; border-radius: 14px; font-size: 1.1rem; font-weight: bold; cursor: pointer; display: inline-flex; align-items: center; gap: 0.5rem; }
                    .btn-uninstall-large { background: transparent; color: var(--md-error); border: 2px solid var(--md-error); padding: 1rem 2rem; border-radius: 14px; font-size: 1.1rem; font-weight: bold; cursor: pointer; display: inline-flex; align-items: center; gap: 0.5rem; }
                    .spin { animation: spin 1s linear infinite; }
                    @keyframes spin { 100% { transform: rotate(360deg); } }
                </style>
            `;

            const mainView = el.querySelector('#store-main-view');
            const detailView = el.querySelector('#store-detail-view');
            const detailContent = el.querySelector('#store-detail-content');
            const btnBackStore = el.querySelector('#btn-back-store');
            const grid = el.querySelector('#store-grid');
            const searchInput = el.querySelector('#store-search');
            const tabs = el.querySelectorAll('.store-tab');
            const btnCheckUpdates = el.querySelector('#btn-check-updates');
            const iconCheckUpdates = el.querySelector('#icon-check-updates');
            const updatesBadge = el.querySelector('#updates-count-badge');
            const updateAllContainer = el.querySelector('#update-all-container');
            const btnUpdateAll = el.querySelector('#btn-update-all');

            let marketApps = [];
            let coreApps = [];
            let activeTab = 'available';
            let updateStates = {};

            function applyUpdateBadge(appId, state) {
                try {
                    if (state === 'idle' || !UPDATE_BADGE[state]) {
                        delete updateStates[appId];
                    } else {
                        updateStates[appId] = state;
                    }

                    const card = grid.querySelector(`[data-app-id="${appId}"]`);
                    if (!card) return;

                    let badge = card.querySelector('.update-badge');
                    if (state === 'idle' || !UPDATE_BADGE[state]) {
                        if (badge) badge.remove();
                        card.classList.remove('locked');
                        return;
                    }

                    const { cls, icon, text } = UPDATE_BADGE[state];
                    if (!badge) {
                        badge = document.createElement('span');
                        badge.className = `update-badge ${cls}`;
                        card.appendChild(badge);
                    } else {
                        badge.className = `update-badge ${cls}`;
                    }
                    badge.innerHTML = `<span class="material-symbols-rounded" style="font-size:0.9rem;vertical-align:middle;">${icon}</span> ${text}`;
                    card.classList.toggle('locked', state === 'downloading' || state === 'installing');
                } catch (e) {}
            }

            function reapplyUpdateStates() {
                try {
                    Object.keys(updateStates).forEach(appId => applyUpdateBadge(appId, updateStates[appId]));
                } catch (e) {}
            }

            btnBackStore.addEventListener('click', () => {
                try {
                    detailView.style.display = 'none';
                    mainView.style.display = 'flex';
                    loadApps();
                } catch (e) {
                    console.error("btnBackStore click error:", e);
                }
            });

            btnCheckUpdates.addEventListener('click', async () => {
                try {
                    iconCheckUpdates.classList.add('spin');
                    btnCheckUpdates.disabled = true;
                    if (window.electronAPI && window.electronAPI.store && window.electronAPI.store.checkUpdates) {
                        await window.electronAPI.store.checkUpdates();
                    }
                    await loadApps();
                    toast('Verifica aggiornamenti completata.', 'info');
                } catch (e) {
                    console.error("btnCheckUpdates error:", e);
                } finally {
                    iconCheckUpdates.classList.remove('spin');
                    btnCheckUpdates.disabled = false;
                }
            });

            btnUpdateAll.addEventListener('click', async () => {
                try {
                    const appsToUpdate = marketApps.filter(a => a.installed && a.hasUpdate);
                    if (appsToUpdate.length === 0) return;

                    btnUpdateAll.disabled = true;
                    btnUpdateAll.innerHTML = '<span class="material-symbols-rounded spin">sync</span> Aggiornamento in corso...';

                    for (const app of appsToUpdate) {
                        await window.electronAPI.store.install(app.id);
                    }
                    toast('Tutte le applicazioni sono state aggiornate con successo!', 'success');
                    await loadApps();
                } catch (e) {
                    console.error("btnUpdateAll error:", e);
                    toast('Errore durante l\'aggiornamento di massa.', 'error');
                } finally {
                    btnUpdateAll.disabled = false;
                    btnUpdateAll.innerHTML = '<span class="material-symbols-rounded">system_update_alt</span> Aggiorna Tutte';
                }
            });

            async function performInstall(app, isUpdate = false) {
                try {
                    const btn = document.getElementById('detail-action-btn');
                    if (btn) {
                        btn.disabled = true;
                        btn.innerHTML = `<span class="material-symbols-rounded spin">sync</span> ${isUpdate ? 'Aggiornamento...' : 'Download e Installazione...'}`;
                    }
                    const res = await window.electronAPI.store.install(app.id);
                    if (res && res.success) {
                        toast(`"${app.name}" ${isUpdate ? 'aggiornata' : 'installata'} con successo.`, 'success');
                        app.installed = true;
                        app.hasUpdate = false;
                        showAppDetails(app, admin);
                    } else {
                        toast(res && res.error ? res.error : 'Operazione fallita.', 'error');
                        if (btn) {
                            btn.disabled = false;
                            btn.innerHTML = `<span class="material-symbols-rounded">download</span> Riprova`;
                        }
                    }
                } catch (e) {
                    console.error("performInstall error:", e);
                }
            }

            async function performUninstall(app) {
                try {
                    if (!confirm(`Sei sicuro di voler disinstallare e rimuovere definitivamente ${app.name}?`)) return;
                    const btn = document.getElementById('detail-action-btn');
                    if (btn) {
                        btn.disabled = true;
                        btn.innerHTML = '<span class="material-symbols-rounded spin">sync</span> Disinstallazione in corso...';
                    }
                    const res = await window.electronAPI.store.uninstall(app.id);
                    if (res && res.success) {
                        toast(`"${app.name}" rimossa con successo.`, 'success');
                        app.installed = false;
                        app.hasUpdate = false;
                        showAppDetails(app, admin);
                    } else {
                        toast(res && res.error ? res.error : 'Disinstallazione fallita.', 'error');
                        if (btn) {
                            btn.disabled = false;
                            btn.innerHTML = '<span class="material-symbols-rounded">delete</span> Riprova';
                        }
                    }
                } catch (e) {
                    console.error("performUninstall error:", e);
                }
            }

            function showAppDetails(app, isAdmin) {
                try {
                    mainView.style.display = 'none';
                    detailView.style.display = 'flex';
                    const iconPath = app.icon ? (app.icon.includes('//') ? app.icon : `apps/${app.folder}/${app.icon}`) : `icone/applicazione_generica.png`;
                    const isCore = app.core;

                    let actionBtnHtml = '';
                    if (!isAdmin) {
                        actionBtnHtml = `<div style="padding: 1rem; background: var(--md-error-container); color: var(--md-on-error-container); border-radius: 12px; font-weight: bold;">Sono richiesti i permessi di Super Amministratore per gestire l'applicazione.</div>`;
                    } else if (isCore) {
                        actionBtnHtml = `<div style="padding: 1rem; background: var(--md-primary-container); color: var(--md-on-primary-container); border-radius: 12px; font-weight: bold;"><span class="material-symbols-rounded" style="vertical-align: middle;">verified</span> Applicazione Predefinita di Sistema (Non rimovibile)</div>`;
                    } else if (app.installed && app.hasUpdate) {
                        actionBtnHtml = `
                            <button id="detail-open-btn" class="btn-open-large" style="background: var(--md-primary); color: white; border: none; padding: 12px 24px; border-radius: 12px; font-weight: bold; cursor: pointer; display: inline-flex; align-items: center; gap: 8px;"><span class="material-symbols-rounded">launch</span> Apri Applicazione</button>
                            <button id="detail-action-btn" class="btn-update-large"><span class="material-symbols-rounded">system_update</span> Aggiorna alla v${app.version}</button>
                            <button id="detail-uninstall-btn" class="btn-uninstall-large"><span class="material-symbols-rounded">delete</span> Disinstalla</button>
                        `;
                    } else if (app.installed) {
                        actionBtnHtml = `
                            <button id="detail-open-btn" class="btn-open-large" style="background: var(--md-primary); color: white; border: none; padding: 12px 24px; border-radius: 12px; font-weight: bold; cursor: pointer; display: inline-flex; align-items: center; gap: 8px;"><span class="material-symbols-rounded">launch</span> Apri Applicazione</button>
                            <button id="detail-uninstall-btn" class="btn-uninstall-large"><span class="material-symbols-rounded">delete</span> Disinstalla Applicazione</button>
                        `;
                    } else {
                        actionBtnHtml = `<button id="detail-action-btn" class="btn-install-large"><span class="material-symbols-rounded">download</span> Scarica e Installa (v${app.version || '1.0.0'})</button>`;
                    }

                    detailContent.innerHTML = `
                        <div class="detail-header">
                            <img src="${iconPath}" class="detail-icon" onerror="this.src='icone/applicazione_generica.png'">
                            <div>
                                <h2 class="detail-title">${app.name}</h2>
                                <div class="detail-developer">${app.author || 'NunzioTech'} • Versione ${app.version || '1.0.0'}</div>
                                <div style="margin-top: 0.6rem; display: flex; gap: 0.5rem; flex-wrap: wrap;">
                                    ${app.installed ? `<span class="store-badge installed"><span class="material-symbols-rounded" style="font-size: 0.9rem;">check_circle</span> Installata v${app.installedVersion || app.version}</span>` : ''}
                                    ${app.hasUpdate ? `<span class="store-badge update"><span class="material-symbols-rounded" style="font-size: 0.9rem;">system_update</span> Aggiornamento Disponibile v${app.version}</span>` : ''}
                                    ${isCore ? `<span class="store-badge core">Sistema</span>` : ''}
                                    ${CATEGORY_LABELS[app.category] ? `<span class="store-badge category">${CATEGORY_LABELS[app.category]}</span>` : ''}
                                </div>
                            </div>
                        </div>

                        <div class="detail-action-bar">
                            ${actionBtnHtml}
                        </div>

                        <div class="detail-section">
                            <h3 class="detail-h3"><span class="material-symbols-rounded">info</span> Descrizione Estesa</h3>
                            <p class="detail-text">${(app.long_description || app.description || '').replace(/\n/g, '<br>')}</p>
                        </div>

                        <div class="detail-section" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 2rem;">
                            <div>
                                <h3 class="detail-h3"><span class="material-symbols-rounded">memory</span> Dettagli Tecnici</h3>
                                <ul class="detail-text" style="list-style: none; padding: 0;">
                                    <li><strong>ID Applicazione:</strong> ${app.id}</li>
                                    <li><strong>Namespace IPC:</strong> ${app.ipc?.namespace || 'N/A'}</li>
                                    <li><strong>Backend Service:</strong> ${app.backend || 'Nessuno'}</li>
                                    <li><strong>Main UI:</strong> ${app.main || 'N/A'}</li>
                                </ul>
                            </div>
                            <div>
                                <h3 class="detail-h3"><span class="material-symbols-rounded">vpn_key</span> Dipendenze e API Protette</h3>
                                <p class="detail-text"><strong>App Dipendenti:</strong> ${app.dependencies && Object.keys(app.dependencies).length ? Object.keys(app.dependencies).join(', ') : 'Nessuna (Autonoma)'}</p>
                                <p class="detail-text" style="margin-top: 0.5rem;"><strong>Permessi Richiesti:</strong> ${app.permissions && app.permissions.length ? app.permissions.join(', ') : 'Nessuno'}</p>
                            </div>
                        </div>

                        ${app.legal_info ? `
                        <div class="detail-section">
                            <h3 class="detail-h3"><span class="material-symbols-rounded">gavel</span> Informazioni Legali e Conformità</h3>
                            <p class="detail-text" style="font-size: 0.95rem;">${app.legal_info.replace(/\n/g, '<br>')}</p>
                        </div>` : ''}

                        ${app.links && app.links.length > 0 ? `
                        <div class="detail-section">
                            <h3 class="detail-h3"><span class="material-symbols-rounded">link</span> Documentazione e Risorse</h3>
                            <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
                                ${app.links.map(l => `<a href="${l.href}" target="_blank" style="color: var(--md-primary); font-weight: bold; text-decoration: none; display: inline-flex; align-items: center; gap: 0.3rem;"><span class="material-symbols-rounded" style="font-size: 1.1rem;">open_in_new</span> ${l.rel || 'Risorsa'}</a>`).join('')}
                            </div>
                        </div>` : ''}
                    `;

                    const actionBtn = document.getElementById('detail-action-btn');
                    const uninstallBtn = document.getElementById('detail-uninstall-btn');

                    if (actionBtn && isAdmin && !isCore) {
                        actionBtn.addEventListener('click', () => {
                            performInstall(app, app.hasUpdate);
                        });
                    }
                    if (uninstallBtn && isAdmin && !isCore) {
                        uninstallBtn.addEventListener('click', () => {
                            performUninstall(app);
                        });
                    }
                } catch (e) {
                    console.error("showAppDetails error:", e);
                }
            }

            async function loadApps() {
                try {
                    if (!window.electronAPI || !window.electronAPI.store) {
                        grid.innerHTML = '<p style="color: var(--md-error);">API Store non disponibile.</p>';
                        return;
                    }
                    const [availableRes, coreRes, installedRes] = await Promise.all([
                        window.electronAPI.store.getAvailable(),
                        window.electronAPI.store.getCoreApps(),
                        window.electronAPI.store.getInstalled ? window.electronAPI.store.getInstalled() : Promise.resolve({ success: true, data: [] })
                    ]);

                    marketApps = (availableRes && availableRes.success) ? availableRes.data : [];
                    coreApps = (coreRes && coreRes.success) ? coreRes.data : [];
                    const installedAppsMap = (installedRes && installedRes.success && Array.isArray(installedRes.data)) ? installedRes.data : [];

                    marketApps.forEach(app => {
                        const inst = installedAppsMap.find(i => i.id === app.id);
                        if (inst) {
                            app.installed = true;
                            app.installedVersion = inst.version || '1.0.0';
                            app.hasUpdate = app.version && app.installedVersion && app.version !== app.installedVersion;
                        } else {
                            app.installed = false;
                            app.hasUpdate = false;
                        }
                    });

                    const pendingUpdatesCount = marketApps.filter(a => a.installed && a.hasUpdate).length;
                    if (pendingUpdatesCount > 0) {
                        updatesBadge.style.display = 'inline-block';
                        updatesBadge.innerText = pendingUpdatesCount;
                        updateAllContainer.style.display = 'block';
                    } else {
                        updatesBadge.style.display = 'none';
                        updateAllContainer.style.display = 'none';
                    }

                    renderGrid(searchInput.value);
                } catch (e) {
                    console.error("loadApps error:", e);
                }
            }

            function renderMarketCard(app) {
                try {
                    const iconPath = app.icon ? (app.icon.includes('//') ? app.icon : `apps/${app.folder}/${app.icon}`) : `icone/applicazione_generica.png`;
                    const categoryLabel = CATEGORY_LABELS[app.category] || null;
                    const card = document.createElement('div');
                    card.className = 'app-card fade-in-up';
                    card.dataset.appId = app.id;
                    card.innerHTML = `
                        <img src="${iconPath}" class="app-icon" onerror="this.src='icone/applicazione_generica.png'">
                        <div class="app-title">${app.name}</div>
                        <div class="app-meta">v${app.version || '1.0.0'} ${app.author ? '• ' + app.author : ''}</div>
                        <div class="app-desc" style="display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${app.description || ''}</div>
                        <div class="app-badges">
                            ${app.installed && !app.hasUpdate ? `<span class="tile-badge installed"><span class="material-symbols-rounded" style="font-size: 0.9rem;">check_circle</span> Installata</span>` : ''}
                            ${app.hasUpdate ? `<span class="tile-badge update"><span class="material-symbols-rounded" style="font-size: 0.9rem;">system_update</span> Update v${app.version}</span>` : ''}
                            ${categoryLabel ? `<span class="tile-badge category">${categoryLabel}</span>` : ''}
                        </div>
                    `;
                    card.addEventListener('click', () => showAppDetails(app, admin));
                    return card;
                } catch (e) {
                    console.error("renderMarketCard error:", e);
                    return document.createElement('div');
                }
            }

            function renderCoreCard(app) {
                try {
                    const iconPath = app.icon ? `apps/${app.folder}/${app.icon}` : `icone/applicazione_generica.png`;
                    const categoryLabel = CATEGORY_LABELS[app.category] || null;
                    const card = document.createElement('div');
                    card.className = 'app-card fade-in-up';
                    card.dataset.appId = app.id;
                    card.innerHTML = `
                        <img src="${iconPath}" class="app-icon" onerror="this.src='icone/applicazione_generica.png'">
                        <div class="app-title">${app.name}</div>
                        <div class="app-meta">v${app.version || '1.0.0'} • Sistema</div>
                        <div class="app-desc" style="display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${app.description || ''}</div>
                        <div class="app-badges">
                            <span class="tile-badge core"><span class="material-symbols-rounded" style="font-size: 0.9rem;">verified</span> Predefinita</span>
                            ${categoryLabel ? `<span class="tile-badge category">${categoryLabel}</span>` : ''}
                        </div>
                    `;
                    card.addEventListener('click', () => showAppDetails(app, admin));
                    return card;
                } catch (e) {
                    console.error("renderCoreCard error:", e);
                    return document.createElement('div');
                }
            }

            function renderGrid(filterText = '') {
                try {
                    const term = (filterText || '').toLowerCase();
                    let source = activeTab === 'core' ? coreApps : marketApps;

                    if (activeTab === 'installed') {
                        source = source.filter(a => a.installed);
                    } else if (activeTab === 'updates') {
                        source = source.filter(a => a.installed && a.hasUpdate);
                    }

                    const filtered = source.filter(a =>
                        a.name.toLowerCase().includes(term) ||
                        (a.description && a.description.toLowerCase().includes(term))
                    );

                    if (filtered.length === 0) {
                        const emptyMessages = {
                            updates: 'Nessun aggiornamento disponibile. Tutte le applicazioni sono all\'ultima versione!',
                            installed: 'Nessuna applicazione di terze parti installata.',
                            core: 'Nessuna applicazione predefinita trovata.',
                            available: 'Nessuna applicazione di terze parti disponibile al momento.'
                        };
                        grid.innerHTML = `<p style="color: var(--md-on-surface-variant); grid-column: 1 / -1; text-align: center; padding: 3rem 0; font-size: 1.1rem;">
                            ${emptyMessages[activeTab] || 'Nessuna applicazione trovata.'}
                        </p>`;
                        return;
                    }

                    grid.innerHTML = '';
                    filtered.forEach(app => {
                        const card = activeTab === 'core' ? renderCoreCard(app) : renderMarketCard(app);
                        grid.appendChild(card);
                    });
                    reapplyUpdateStates();
                } catch (e) {
                    console.error("renderGrid error:", e);
                }
            }

            tabs.forEach(tab => {
                tab.addEventListener('click', () => {
                    try {
                        tabs.forEach(t => t.classList.remove('active'));
                        tab.classList.add('active');
                        activeTab = tab.dataset.tab;
                        renderGrid(searchInput.value);
                    } catch (e) {
                        console.error("tab click error:", e);
                    }
                });
            });

            searchInput.addEventListener('input', (e) => {
                try {
                    renderGrid(e.target.value);
                } catch (err) {
                    console.error("searchInput input error:", err);
                }
            });

            await loadApps();

            if (window.electronAPI && window.electronAPI.store) {
                try {
                    window.electronAPI.store.getUpdateQueue().then(res => {
                        try {
                            if (res && res.success && res.data && Array.isArray(res.data.queue)) {
                                res.data.queue.forEach(item => applyUpdateBadge(item.appId, item.state));
                            }
                        } catch (e) {}
                    }).catch(() => {});
                } catch (e) {}

                try {
                    window.electronAPI.store.onAppUpdateEvent(data => {
                        try {
                            if (data && data.appId) applyUpdateBadge(data.appId, data.state);
                        } catch (e) {}
                    });
                } catch (e) {}

                try {
                    window.electronAPI.store.onAppUpdated(data => {
                        try {
                            if (data && data.appId) {
                                setTimeout(() => { applyUpdateBadge(data.appId, 'idle'); }, 5000);
                                loadApps();
                            }
                        } catch (e) {}
                    });
                } catch (e) {}
            }
        } catch (e) {
            console.error("Store render error:", e);
            el.innerHTML = `<p style="color: var(--md-error);">Errore caricamento App Store & Update Hub</p>`;
        }
    }
};
