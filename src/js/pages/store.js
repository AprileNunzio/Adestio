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
    erp: 'Gestionale',
    school: 'Scuola',
    personal: 'Personale',
    utility: 'Utilità'
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
                    <div style="display: flex; flex-wrap: wrap; align-items: flex-start; justify-content: space-between; gap: 1.5rem; margin-bottom: 2rem; width: 100%;">
                        <div style="flex: 1; min-width: 300px;">
                            <h1 class="text-title" style="font-size: 2.4rem; color: var(--md-primary); margin-bottom: 0.2rem; letter-spacing: -0.02em; text-align: left;">App Store</h1>
                            <p class="text-body" style="color: var(--md-on-surface-variant); font-size: 1.1rem; text-align: left;">
                                ${admin ? 'Installa applicazioni di terze parti o gestisci quelle già presenti su questo nodo.' : 'Applicazioni disponibili su questo nodo. Solo un Super Amministratore può installare o rimuovere applicazioni di terze parti.'}
                            </p>
                        </div>
                        <div style="position: relative; flex-shrink: 0; width: 100%; max-width: 350px;">
                            <span class="material-symbols-rounded" style="position: absolute; left: 1rem; top: 0.9rem; color: var(--md-on-surface-variant);">search</span>
                            <input type="text" id="store-search" class="input" placeholder="Cerca applicazione..." style="padding-left: 3rem; padding-top: 0.8rem; padding-bottom: 0.8rem; width: 100%; border-radius: 28px; background: var(--md-surface-variant); border: 1px solid var(--md-outline-variant); font-size: 1.05rem; box-shadow: inset 0 2px 4px rgba(0,0,0,0.05); transition: all 0.2s ease;">
                        </div>
                    </div>
                    <div style="display: flex; gap: 0.5rem; margin-bottom: 1.5rem; border-bottom: 1px solid var(--md-outline-variant);">
                        <button class="store-tab active" data-tab="available">Terze Parti</button>
                        <button class="store-tab" data-tab="installed">Installate</button>
                        <button class="store-tab" data-tab="core">Predefinite</button>
                    </div>
                    <div id="store-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1.5rem;">
                        <p style="color: var(--md-on-surface-variant);">Caricamento store in corso...</p>
                    </div>
                </div>
                <div id="store-detail-view" style="display: none; width: 100%; flex: 1; flex-direction: column;">
                    <div style="margin-bottom: 1.5rem;">
                        <button id="btn-back-store" class="btn" style="background: transparent; border: 1px solid var(--md-outline); color: var(--md-on-surface); display: inline-flex; align-items: center; gap: 0.5rem; border-radius: 12px;">
                            <span class="material-symbols-rounded">arrow_back</span> Torna allo Store
                        </button>
                    </div>
                    <div id="store-detail-content" style="background: var(--md-surface); border-radius: 24px; padding: 2.5rem; border: 1px solid var(--md-outline-variant); box-shadow: 0 10px 30px rgba(0,0,0,0.05);">
                        <!-- Il contenuto ultra-dettagliato verrà iniettato qui -->
                    </div>
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
                    }
                    .store-tab:hover { color: var(--md-primary); }
                    .store-tab.active { color: var(--md-primary); border-bottom-color: var(--md-primary); }
                    .store-card {
                        background: var(--md-surface);
                        border-radius: 18px;
                        padding: 1.4rem;
                        border: 1px solid var(--md-outline-variant);
                        display: flex;
                        flex-direction: column;
                        gap: 0.8rem;
                        transition: all 0.2s ease;
                        box-shadow: 0 4px 6px rgba(0,0,0,0.04);
                        cursor: pointer;
                    }
                    .store-card:hover { box-shadow: 0 8px 16px rgba(0,0,0,0.08); border-color: var(--md-primary); transform: translateY(-2px); }
                    .store-card-head { display: flex; gap: 0.9rem; align-items: center; }
                    .store-card-icon { width: 48px; height: 48px; object-fit: contain; border-radius: 10px; flex-shrink: 0; }
                    .store-card-title { font-weight: 700; color: var(--md-on-surface); font-size: 1.05rem; }
                    .store-card-desc { font-size: 0.85rem; color: var(--md-on-surface-variant); line-height: 1.4; flex: 1; }
                    .store-badge {
                        display: inline-flex; align-items: center; gap: 0.3rem;
                        font-size: 0.72rem; font-weight: 700; letter-spacing: 0.02em;
                        padding: 0.2rem 0.6rem; border-radius: 999px; width: fit-content;
                    }
                    .store-badge.installed { background: var(--md-success-container); color: var(--md-on-success-container); }
                    .store-badge.category { background: var(--md-secondary-container); color: var(--md-on-secondary-container); }
                    .store-badge.core { background: var(--md-primary-container); color: var(--md-on-primary-container); }
                    /* Stili pagina dettaglio */
                    .detail-header { display: flex; gap: 1.5rem; align-items: center; margin-bottom: 2rem; }
                    .detail-icon { width: 90px; height: 90px; border-radius: 18px; object-fit: contain; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
                    .detail-title { font-size: 2.2rem; font-weight: 800; color: var(--md-on-surface); margin: 0; }
                    .detail-developer { font-size: 1rem; color: var(--md-primary); font-weight: 600; margin-top: 0.2rem; }
                    .detail-section { margin-top: 2rem; border-top: 1px solid var(--md-outline-variant); padding-top: 1.5rem; }
                    .detail-h3 { font-size: 1.3rem; color: var(--md-on-surface); margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem; }
                    .detail-text { font-size: 1rem; color: var(--md-on-surface-variant); line-height: 1.6; }
                    .detail-action-bar { display: flex; gap: 1rem; margin-top: 1.5rem; }
                    .btn-install-large { background: var(--md-primary); color: var(--md-on-primary); border: none; padding: 1rem 2rem; border-radius: 14px; font-size: 1.1rem; font-weight: bold; cursor: pointer; display: inline-flex; align-items: center; gap: 0.5rem; }
                    .btn-uninstall-large { background: transparent; color: var(--md-error); border: 2px solid var(--md-error); padding: 1rem 2rem; border-radius: 14px; font-size: 1.1rem; font-weight: bold; cursor: pointer; display: inline-flex; align-items: center; gap: 0.5rem; }
                </style>
            `;
            const mainView = el.querySelector('#store-main-view');
            const detailView = el.querySelector('#store-detail-view');
            const detailContent = el.querySelector('#store-detail-content');
            const btnBackStore = el.querySelector('#btn-back-store');
            const grid = el.querySelector('#store-grid');
            const searchInput = el.querySelector('#store-search');
            const tabs = el.querySelectorAll('.store-tab');
            let marketApps = [];
            let coreApps = [];
            let activeTab = 'available';
            btnBackStore.addEventListener('click', () => {
                detailView.style.display = 'none';
                mainView.style.display = 'flex';
                loadApps(); 
            });
            async function performInstall(app) {
                const btn = document.getElementById('detail-action-btn');
                if (btn) { btn.disabled = true; btn.innerHTML = '<span class="material-symbols-rounded spin">sync</span> Download e Installazione...'; }
                const res = await window.electronAPI.store.install(app.id);
                if (res && res.success) {
                    toast(`"${app.name}" installata con successo.`, 'success');
                    app.installed = true;
                    showAppDetails(app, true);
                } else {
                    toast(res && res.error ? res.error : 'Installazione fallita.', 'error');
                    if (btn) { btn.disabled = false; btn.innerHTML = '<span class="material-symbols-rounded">download</span> Riprova'; }
                }
            }
            async function performUninstall(app) {
                if (!confirm(`Sei sicuro di voler disinstallare e rimuovere definitivamente ${app.name}?`)) return;
                const btn = document.getElementById('detail-action-btn');
                if (btn) { btn.disabled = true; btn.innerHTML = '<span class="material-symbols-rounded spin">sync</span> Disinstallazione in corso...'; }
                const res = await window.electronAPI.store.uninstall(app.id);
                if (res && res.success) {
                    toast(`"${app.name}" rimossa con successo.`, 'success');
                    app.installed = false;
                    showAppDetails(app, true);
                } else {
                    toast(res && res.error ? res.error : 'Disinstallazione fallita.', 'error');
                    if (btn) { btn.disabled = false; btn.innerHTML = '<span class="material-symbols-rounded">delete</span> Riprova'; }
                }
            }
            function showAppDetails(app, isAdmin) {
                mainView.style.display = 'none';
                detailView.style.display = 'flex';
                const iconPath = app.icon ? (app.icon.includes('//') ? app.icon : `apps/${app.folder}/${app.icon}`) : `icone/applicazione_generica.png`;
                const isCore = app.core;
                let actionBtnHtml = '';
                if (!isAdmin) {
                    actionBtnHtml = `<div style="padding: 1rem; background: var(--md-error-container); color: var(--md-on-error-container); border-radius: 12px; font-weight: bold;">Sono richiesti i permessi di Super Amministratore per gestire l'applicazione.</div>`;
                } else if (isCore) {
                    actionBtnHtml = `<div style="padding: 1rem; background: var(--md-primary-container); color: var(--md-on-primary-container); border-radius: 12px; font-weight: bold;"><span class="material-symbols-rounded" style="vertical-align: middle;">verified</span> Applicazione Predefinita di Sistema (Non rimovibile)</div>`;
                } else if (app.installed) {
                    actionBtnHtml = `<button id="detail-action-btn" class="btn-uninstall-large"><span class="material-symbols-rounded">delete</span> Disinstalla</button>`;
                } else {
                    actionBtnHtml = `<button id="detail-action-btn" class="btn-install-large"><span class="material-symbols-rounded">download</span> Scarica e Installa</button>`;
                }
                detailContent.innerHTML = `
                    <div class="detail-header">
                        <img src="${iconPath}" class="detail-icon" onerror="this.src='icone/applicazione_generica.png'">
                        <div>
                            <h2 class="detail-title">${app.name}</h2>
                            <div class="detail-developer">${app.author || 'Sviluppatore Sconosciuto'} • Versione ${app.version || '1.0.0'}</div>
                            <div style="margin-top: 0.5rem; display: flex; gap: 0.5rem;">
                                ${app.installed ? `<span class="store-badge installed">Installata</span>` : ''}
                                ${isCore ? `<span class="store-badge core">Sistema</span>` : ''}
                                ${CATEGORY_LABELS[app.category] ? `<span class="store-badge category">${CATEGORY_LABELS[app.category]}</span>` : ''}
                            </div>
                        </div>
                    </div>
                    <div class="detail-action-bar">
                        ${actionBtnHtml}
                    </div>
                    <div class="detail-section">
                        <h3 class="detail-h3"><span class="material-symbols-rounded">info</span> Descrizione</h3>
                        <p class="detail-text">${(app.long_description || app.description || '').replace(/\n/g, '<br>')}</p>
                    </div>
                    <div class="detail-section" style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem;">
                        <div>
                            <h3 class="detail-h3"><span class="material-symbols-rounded">memory</span> Dettagli Tecnici</h3>
                            <ul class="detail-text" style="list-style: none; padding: 0;">
                                <li><strong>Namespace IPC:</strong> ${app.ipc?.namespace || 'N/A'}</li>
                                <li><strong>Backend:</strong> ${app.backend || 'Nessuno'}</li>
                                <li><strong>Main UI:</strong> ${app.main || 'N/A'}</li>
                                <li><strong>Bundle:</strong> ${app.bundled ? 'Inclusa di default' : 'Scaricabile dal Web'}</li>
                            </ul>
                        </div>
                        <div>
                            <h3 class="detail-h3"><span class="material-symbols-rounded">extension</span> Dipendenze e API</h3>
                            <ul class="detail-text" style="list-style: none; padding: 0;">
                                <li><strong>App Richieste:</strong> ${(app.dependencies || []).join(', ') || 'Nessuna'}</li>
                                <li><strong>API Esterne Usate:</strong> ${(app.apis || []).join(', ') || 'Nessuna'}</li>
                            </ul>
                        </div>
                    </div>
                    ${app.legal_info ? `
                    <div class="detail-section">
                        <h3 class="detail-h3"><span class="material-symbols-rounded">gavel</span> Informazioni Legali e Privacy</h3>
                        <p class="detail-text" style="font-size: 0.9rem;">${app.legal_info.replace(/\n/g, '<br>')}</p>
                    </div>` : ''}
                    ${app.links && app.links.length > 0 ? `
                    <div class="detail-section">
                        <h3 class="detail-h3"><span class="material-symbols-rounded">link</span> Link Utili</h3>
                        <div style="display: flex; gap: 1rem;">
                            ${app.links.map(l => `<a href="${l.href}" target="_blank" style="color: var(--md-primary); font-weight: bold; text-decoration: none;">${l.rel || 'Link'}</a>`).join('')}
                        </div>
                    </div>` : ''}
                `;
                const btn = document.getElementById('detail-action-btn');
                if (btn && isAdmin && !isCore) {
                    btn.addEventListener('click', () => {
                        if (app.installed) performUninstall(app);
                        else performInstall(app);
                    });
                }
            }
            async function loadApps() {
                if (!window.electronAPI || !window.electronAPI.store) {
                    grid.innerHTML = '<p style="color: var(--md-error);">API Store non disponibile.</p>';
                    return;
                }
                const [availableRes, coreRes] = await Promise.all([
                    window.electronAPI.store.getAvailable(),
                    window.electronAPI.store.getCoreApps()
                ]);
                marketApps = (availableRes && availableRes.success) ? availableRes.data : [];
                coreApps = (coreRes && coreRes.success) ? coreRes.data : [];
                renderGrid(searchInput.value);
            }
            function renderMarketCard(app) {
                const iconPath = app.icon ? (app.icon.includes('//') ? app.icon : `apps/${app.folder}/${app.icon}`) : `icone/applicazione_generica.png`;
                const categoryLabel = CATEGORY_LABELS[app.category] || null;
                const card = document.createElement('div');
                card.className = 'store-card fade-in-up';
                card.innerHTML = `
                    <div class="store-card-head">
                        <img src="${iconPath}" class="store-card-icon" onerror="this.src='icone/applicazione_generica.png'">
                        <div style="flex: 1;">
                            <div class="store-card-title">${app.name}</div>
                            <div style="font-size: 0.75rem; color: var(--md-on-surface-variant);">v${app.version || '1.0.0'}</div>
                        </div>
                    </div>
                    <div class="store-card-desc" style="display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${app.description || ''}</div>
                    <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                        ${app.installed ? `<span class="store-badge installed"><span class="material-symbols-rounded" style="font-size: 0.9rem;">check_circle</span> Installata</span>` : ''}
                        ${categoryLabel ? `<span class="store-badge category">${categoryLabel}</span>` : ''}
                    </div>
                `;
                card.addEventListener('click', () => showAppDetails(app, admin));
                return card;
            }
            function renderCoreCard(app) {
                const iconPath = app.icon ? `apps/${app.folder}/${app.icon}` : `icone/applicazione_generica.png`;
                const categoryLabel = CATEGORY_LABELS[app.category] || null;
                const card = document.createElement('div');
                card.className = 'store-card fade-in-up';
                card.innerHTML = `
                    <div class="store-card-head">
                        <img src="${iconPath}" class="store-card-icon" onerror="this.src='icone/applicazione_generica.png'">
                        <div style="flex: 1;">
                            <div class="store-card-title">${app.name}</div>
                            <div style="font-size: 0.75rem; color: var(--md-on-surface-variant);">v${app.version || '1.0.0'}</div>
                        </div>
                    </div>
                    <div class="store-card-desc" style="display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${app.description || ''}</div>
                    <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                        <span class="store-badge core"><span class="material-symbols-rounded" style="font-size: 0.9rem;">verified</span> Predefinita</span>
                        ${categoryLabel ? `<span class="store-badge category">${categoryLabel}</span>` : ''}
                    </div>
                `;
                card.addEventListener('click', () => showAppDetails(app, admin));
                return card;
            }
            function renderGrid(filterText = '') {
                const term = (filterText || '').toLowerCase();
                const source = activeTab === 'core' ? coreApps : marketApps;
                const filtered = source
                    .filter(a => activeTab === 'installed' ? a.installed : true)
                    .filter(a =>
                        a.name.toLowerCase().includes(term) ||
                        (a.description && a.description.toLowerCase().includes(term))
                    );
                if (filtered.length === 0) {
                    const emptyMessages = {
                        installed: 'Nessuna applicazione di terze parti installata.',
                        core: 'Nessuna applicazione predefinita trovata.',
                        available: 'Nessuna applicazione di terze parti disponibile al momento.'
                    };
                    grid.innerHTML = `<p style="color: var(--md-on-surface-variant); grid-column: 1 / -1; text-align: center;">
                        ${emptyMessages[activeTab] || 'Nessuna applicazione trovata.'}
                    </p>`;
                    return;
                }
                grid.innerHTML = '';
                filtered.forEach(app => {
                    const card = activeTab === 'core' ? renderCoreCard(app) : renderMarketCard(app);
                    grid.appendChild(card);
                });
            }
            tabs.forEach(tab => {
                tab.addEventListener('click', () => {
                    tabs.forEach(t => t.classList.remove('active'));
                    tab.classList.add('active');
                    activeTab = tab.dataset.tab;
                    renderGrid(searchInput.value);
                });
            });
            searchInput.addEventListener('input', (e) => renderGrid(e.target.value));
            await loadApps();
        } catch (e) {
            console.error(e);
            el.innerHTML = `<p>Errore caricamento App Store</p>`;
        }
    }
};
