
export default {
    render: async (el, params = {}) => {
        try {
            let SUBAPPS = [];
            if (window.electronAPI) {
                SUBAPPS = await window.electronAPI.getSubAppsRegistry('amministratore');
            }
            const renderHome = () => {
                el.innerHTML = `
                    <div class="fade-in-up" style="width: 100%; flex: 1; display: flex; flex-direction: column;">
                        <div style="display: flex; flex-wrap: wrap; align-items: flex-start; justify-content: space-between; gap: 1.5rem; margin-bottom: 3rem; width: 100%;">
                            <div style="flex: 1; min-width: 300px;">
                                <h1 class="text-title" style="font-size: 2.4rem; color: var(--md-primary); margin-bottom: 0.2rem; letter-spacing: -0.02em; text-align: left;">Amministratore</h1>
                                <p class="text-body" style="color: var(--md-on-surface-variant); font-size: 1.1rem; text-align: left;">Gestione Utenti, Ruoli e Sicurezza del Nodo</p>
                            </div>
                            <div style="position: relative; flex-shrink: 0; width: 100%; max-width: 350px;">
                                <span class="material-symbols-rounded" style="position: absolute; left: 1rem; top: 0.9rem; color: var(--md-on-surface-variant);">search</span>
                                <input type="text" id="subapp-search" class="input" placeholder="Cerca modulo..." style="padding-left: 3rem; padding-top: 0.8rem; padding-bottom: 0.8rem; width: 100%; border-radius: 28px; background: var(--md-surface-variant); border: 1px solid var(--md-outline-variant); font-size: 1.05rem; box-shadow: inset 0 2px 4px rgba(0,0,0,0.05); transition: all 0.2s ease;">
                            </div>
                        </div>
                        <div id="subapps-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 2rem;">
                            <!-- Grid popolata via JS -->
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
                const grid = el.querySelector('#subapps-grid');
                const searchInput = el.querySelector('#subapp-search');
                const renderSubApps = (filterText = '') => {
                    grid.innerHTML = '';
                    const filtered = SUBAPPS.filter(app => 
                        app.name.toLowerCase().includes(filterText.toLowerCase()) || 
                        (app.description && app.description.toLowerCase().includes(filterText.toLowerCase()))
                    );
                    if (filtered.length === 0) {
                        grid.innerHTML = '<p style="color: var(--md-on-surface-variant); grid-column: 1 / -1; text-align: center;">Nessun modulo trovato.</p>';
                        return;
                    }
                    filtered.forEach(app => {
                        const card = document.createElement('div');
                        card.className = 'app-card subapp-card fade-in-up';
                        card.setAttribute('data-id', app.folder);
                        const iconPath = app.icon ? `apps/amministratore/subapps/${app.folder}/${app.icon}` : `icone/applicazione_generica.png`;
                        card.innerHTML = `
                            <img src="${iconPath}" class="app-icon" onerror="this.src='icone/applicazione_generica.png'">
                            <div class="app-title">${app.name}</div>
                            ${app.description ? `<div class="app-desc">${app.description}</div>` : ''}
                        `;
                        card.addEventListener('click', async () => {
                            try {
                                const { Router } = await import('../../js/utils.js');
                                Router.navigate('app_container', { appId: 'amministratore', subAppId: app.folder });
                            } catch (err) {}
                        });
                        grid.appendChild(card);
                    });
                };
                renderSubApps();
                if (searchInput) {
                    searchInput.addEventListener('input', (e) => {
                        renderSubApps(e.target.value);
                    });
                }
            };
            const renderSubApp = async (id) => {
                try {
                    const subAppDef = SUBAPPS.find(s => s.folder === id);
                    el.innerHTML = `
                        <div class="fade-in-up" style="width: 100%; height: 100%; display: flex; flex-direction: column;">
                            <div id="subapp-mount-point" style="flex: 1; display: flex; flex-direction: column;">
                                <div style="display: flex; justify-content: center; align-items: center; height: 100%;">
                                    <span class="material-symbols-rounded" style="font-size: 2rem; animation: spin 2s linear infinite;">sync</span>
                                </div>
                            </div>
                        </div>
                    `;
                    const mountPoint = el.querySelector('#subapp-mount-point');
                    try {
                        const mainFile = subAppDef && subAppDef.main ? subAppDef.main : 'app.js';
                        const module = await import(`./subapps/${id}/${mainFile}`);
                        if (module && module.default && typeof module.default.render === 'function') {
                            await module.default.render(mountPoint);
                        } else {
                            throw new Error("Invalid subapp module");
                        }
                    } catch (importErr) {
                        mountPoint.innerHTML = `<div style="text-align: center; color: var(--md-error);">
                            <span class="material-symbols-rounded" style="font-size: 3rem; margin-bottom: 1rem;">error</span>
                            <p>Errore durante il caricamento del sottomodulo.</p>
                        </div>`;
                    }
                } catch (e) {
                    console.error(e);
                }
            };
            if (params.subAppId) {
                renderSubApp(params.subAppId);
            } else {
                renderHome();
            }
        } catch (e) {
            console.error(e);
            el.innerHTML = '<p>Errore critico caricamento Impostazioni</p>';
        }
    }
};
