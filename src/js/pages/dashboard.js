import { Router } from '../utils.js';

export default {
    render: async (el) => {
        try {
            el.innerHTML = `
                <div class="fade-in-up" style="width: 100%; flex: 1; display: flex; flex-direction: column;">
                    <div style="display: flex; flex-wrap: wrap; align-items: flex-start; justify-content: space-between; gap: 1.5rem; margin-bottom: 3rem; width: 100%;">
                        <div style="flex: 1; min-width: 300px;">
                            <h1 class="text-title" style="font-size: 2.4rem; color: var(--md-primary); margin-bottom: 0.2rem; letter-spacing: -0.02em; text-align: left;">Applicazioni</h1>
                            <p class="text-body" style="color: var(--md-on-surface-variant); font-size: 1.1rem; text-align: left;">Seleziona un modulo per iniziare.</p>
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
                    .app-title {
                        font-weight: 600;
                        color: var(--md-on-surface);
                        margin-bottom: 0.2rem;
                    }
                    .app-desc {
                        font-size: 0.8rem;
                        color: var(--md-on-surface-variant);
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

                apps = allApps.filter(app => {
                    const appId = app.folder;
                    const viewPermId = `${appId}:view`;

                    if (userPerms.includes('*')) return true;

                    if (userPerms.includes(viewPermId)) return true;

                    if (userPerms.some(p => p.startsWith(`${appId}:`))) return true;

                    return false;
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
