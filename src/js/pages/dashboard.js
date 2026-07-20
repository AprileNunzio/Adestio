import { Router } from '../utils.js';
export default {
    render: async (el) => {
        try {
            const userId = sessionStorage.getItem('currentUserId');
            if (!window.currentUser && !userId) {
                Router.navigate('auth_login');
                return;
            }
            let lastLoginHtml = '';
            try {
                if (window.electronAPI) {
                    const res = await window.electronAPI.getAccessLogs(userId);
                    if (res.success && res.logs.length > 1) {
                        const last = res.logs[1]; // The previous login (0 is the current one)
                        const { dtFormat } = await import('../utils.js');
                        lastLoginHtml = `
                            <div class="last-login-widget" onclick="window.Router.navigate('app_container', { appId: 'impostazioni', subAppId: 'registro_accessi' })" style="cursor: pointer; background: var(--md-surface-variant); padding: 0.8rem 1.2rem; border-radius: 12px; display: inline-flex; align-items: center; gap: 0.8rem; margin-top: 1rem; border: 1px solid var(--md-outline-variant); transition: all 0.2s ease;">
                                <span class="material-symbols-rounded" style="color: var(--md-primary); font-size: 1.5rem;">history</span>
                                <div>
                                    <div style="font-size: 0.8rem; font-weight: 600; color: var(--md-on-surface-variant); text-transform: uppercase; letter-spacing: 0.5px;">Ultimo Accesso</div>
                                    <div style="font-size: 0.95rem; color: var(--md-on-surface);"><strong>${last.node_name || 'Sconosciuto'}</strong> il ${dtFormat(last.timestamp)}</div>
                                </div>
                                <span class="material-symbols-rounded" style="color: var(--md-on-surface-variant); margin-left: 0.5rem; opacity: 0.5;">chevron_right</span>
                            </div>
                        `;
                    }
                }
            } catch(e) { console.error('Error fetching access logs', e); }
            el.innerHTML = `
                <div class="fade-in-up" style="width: 100%; flex: 1; display: flex; flex-direction: column;">
                    <div style="display: flex; flex-wrap: wrap; align-items: flex-start; justify-content: space-between; gap: 1.5rem; margin-bottom: 3rem; width: 100%;">
                        <div style="flex: 1; min-width: 300px;">
                            <h1 class="text-title" style="font-size: 2.4rem; color: var(--md-primary); margin-bottom: 0.2rem; letter-spacing: -0.02em; text-align: left;">Applicazioni</h1>
                            <p class="text-body" style="color: var(--md-on-surface-variant); font-size: 1.1rem; text-align: left;">Seleziona un modulo per iniziare.</p>
                            ${lastLoginHtml}
                        </div>
                        <div style="position: relative; flex-shrink: 0; width: 100%; max-width: 350px;">
                            <span class="material-symbols-rounded" style="position: absolute; left: 1rem; top: 0.9rem; color: var(--md-on-surface-variant);">search</span>
                            <input type="text" id="app-search" class="input" placeholder="Cerca applicativo..." style="padding-left: 3rem; padding-top: 0.8rem; padding-bottom: 0.8rem; width: 100%; border-radius: 28px; background: var(--md-surface-variant); border: 1px solid var(--md-outline-variant); font-size: 1.05rem; box-shadow: inset 0 2px 4px rgba(0,0,0,0.05); transition: all 0.2s ease;">
                        </div>
                    </div>
                    <div id="apps-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 2rem;">
                        <p>Caricamento app in corso...</p>
                    </div>
                </div>
                <style>
                    .app-card {
                        background: var(--md-surface);
                        border-radius: 16px;
                        padding: 1.5rem;
                        text-align: center;
                        border: 1px solid var(--md-outline);
                        cursor: pointer;
                        transition: all 0.2s ease;
                        box-shadow: 0 4px 6px rgba(0,0,0,0.05);
                    }
                    .app-card:hover {
                        transform: translateY(-5px);
                        box-shadow: 0 8px 12px rgba(103, 80, 164, 0.15);
                        border-color: var(--md-primary);
                    }
                    .app-icon {
                        width: 64px;
                        height: 64px;
                        object-fit: contain;
                        margin-bottom: 1rem;
                    }
                    .app-icon-glyph {
                        width: 64px;
                        height: 64px;
                        border-radius: 16px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        margin: 0 auto 1rem;
                        background: var(--md-primary-container);
                        color: var(--md-primary);
                        font-size: 2.1rem;
                    }
                    .app-title {
                        font-weight: 600;
                        color: var(--md-on-surface);
                        margin-bottom: 0.2rem;
                    }
                    .app-desc {
                        font-size: 0.8rem;
                        color: var(--md-on-surface-variant);
                    }
                    .last-login-widget:hover {
                        background: var(--md-surface);
                        border-color: var(--md-primary);
                        box-shadow: 0 4px 6px rgba(0,0,0,0.05);
                    }
                </style>
            `;
            const grid = el.querySelector('#apps-grid');
            const searchInput = el.querySelector('#app-search');
            let apps = [];
            if (window.electronAPI) {
                const allApps = await window.electronAPI.getAppsRegistry();
                const userId = sessionStorage.getItem('currentUserId');
                let userPerms = [];
                if (userId) {
                    userPerms = await window.electronAPI.rbac.getEffectiveUserPermissions(userId);
                }
                let installedApps = [];
                try {
                    const storeRes = await window.electronAPI.store.getInstalled();
                    if (storeRes.success && storeRes.data) {
                        installedApps = storeRes.data.map(a => a.app_id);
                    }
                } catch(e) { console.warn("Impossibile recuperare le app installate", e); }
                apps = allApps.filter(app => {
                    const appId = app.folder;
                    if (!app.core && !app.bundled && !installedApps.includes(appId)) {
                        return false;
                    }
                    const viewPermId = `${appId}:view`;
                    if (userPerms.includes('*')) return true;
                    if (userPerms.includes(viewPermId)) return true;
                    if (userPerms.some(p => p.startsWith(`${appId}:`))) return true;
                    return false;
                });
                apps.unshift({
                    __isStorePinned: true,
                    name: 'App Store',
                    description: 'Installa applicazioni di terze parti o gestisci quelle presenti sul nodo'
                });
            }
            const renderApps = (filterText = '') => {
                grid.innerHTML = '';
                const filtered = apps.filter(app => 
                    app.name.toLowerCase().includes(filterText.toLowerCase()) || 
                    (app.description && app.description.toLowerCase().includes(filterText.toLowerCase()))
                );
                if (filtered.length === 0) {
                    grid.innerHTML = '<p style="color: var(--md-on-surface-variant); grid-column: 1 / -1; text-align: center;">Nessun applicativo trovato.</p>';
                    return;
                }
                filtered.forEach(app => {
                    const card = document.createElement('div');
                    card.className = 'app-card fade-in-up';
                    if (app.__isStorePinned) {
                        card.innerHTML = `
                            <img src="icone/store.png" class="app-icon" onerror="this.src='icone/applicazione_generica.png'">
                            <div class="app-title">${app.name}</div>
                            ${app.description ? `<div class="app-desc">${app.description}</div>` : ''}
                        `;
                        card.addEventListener('click', () => {
                            Router.navigate('store');
                        });
                        grid.appendChild(card);
                        return;
                    }
                    const iconPath = app.icon ? `apps/${app.folder}/${app.icon}` : `icone/applicazione_generica.png`;
                    card.innerHTML = `
                        <img src="${iconPath}" class="app-icon" onerror="this.src='icone/applicazione_generica.png'">
                        <div class="app-title">${app.name}</div>
                        ${app.description ? `<div class="app-desc">${app.description}</div>` : ''}
                    `;
                    card.addEventListener('click', () => {
                        Router.navigate('app_container', { appId: app.folder });
                    });
                    grid.appendChild(card);
                });
            };
            renderApps();
            searchInput.addEventListener('input', (e) => {
                try {
                    renderApps(e.target.value);
                } catch(err) { console.error(err); }
            });
        } catch (e) {
            console.error(e);
            el.innerHTML = `<p>Errore caricamento dashboard</p>`;
        }
    }
};
