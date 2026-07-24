import { Router } from '../utils.js';

export default {
    render: async (el) => {
        try {
            el.innerHTML = `
                <div class="page-container">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2.5rem; flex-wrap: wrap; gap: 1rem;">
                        <div>
                            <h1 class="text-title" style="margin-bottom: 0.3rem; font-size: 2.2rem; font-weight: 800; letter-spacing: -0.03em;">Dashboard Principale</h1>
                            <p class="text-body" style="color: var(--md-on-surface-variant); font-size: 1rem;">Seleziona un'applicazione per iniziare a lavorare</p>
                        </div>
                        <div style="display: flex; gap: 1rem; align-items: center;">
                            <div class="search-box" style="position: relative; width: 280px;">
                                <span class="material-symbols-rounded" style="position: absolute; left: 1rem; top: 50%; transform: translateY(-50%); color: var(--md-on-surface-variant); pointer-events: none;">search</span>
                                <input type="text" id="app-search" class="input" placeholder="Cerca applicativo..." style="padding-left: 2.8rem; width: 100%; border-radius: 20px; border: 1px solid var(--md-outline-variant); background: rgba(255, 255, 255, 0.7); color: var(--md-on-surface); height: 44px; font-size: 0.95rem;">
                            </div>
                        </div>
                    </div>

                    <div id="apps-grid" class="apps-grid">
                        <div style="grid-column: 1 / -1; text-align: center; padding: 3rem;">
                            <span class="material-symbols-rounded spin" style="font-size: 3rem; color: var(--md-primary);">sync</span>
                            <p style="margin-top: 1rem; color: var(--md-on-surface-variant);">Caricamento applicativi in corso...</p>
                        </div>
                    </div>
                </div>

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
                let installedAppsData = [];
                try {
                    const storeRes = await window.electronAPI.store.getInstalled();
                    if (storeRes && storeRes.success && Array.isArray(storeRes.data)) {
                        installedAppsData = storeRes.data;
                        installedApps = storeRes.data.map(a => a.id || a.app_id || a.folder);
                    }
                } catch (e) {
                    console.warn("Impossibile recuperare le app installate", e);
                }

                const now = Date.now();
                const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

                apps = allApps.filter(app => {
                    try {
                        const targetId = app.id || app.folder;
                        if (!app.core && !app.bundled && !installedApps.includes(targetId)) {
                            return false;
                        }
                        if (userPerms.includes('*')) return true;
                        const viewPermId = `${targetId}:view`;
                        return userPerms.includes(viewPermId) || userPerms.some(p => p.startsWith(`${targetId}:`));
                    } catch (err) {
                        return false;
                    }
                });

                installedAppsData.forEach(installedApp => {
                    try {
                        const targetId = installedApp.id || installedApp.app_id || installedApp.folder;
                        const exists = apps.some(a => (a.id || a.folder) === targetId);
                        if (!exists) {
                            apps.push({
                                id: targetId,
                                folder: installedApp.folder || targetId,
                                name: installedApp.name || targetId,
                                description: installedApp.description || '',
                                icon: installedApp.icon || 'icone/applicazione_generica.png',
                                installedAt: installedApp.installedAt || null
                            });
                        }
                    } catch (err) {}
                });

                apps.forEach(app => {
                    try {
                        const targetId = app.id || app.folder;
                        const matchInstalled = installedAppsData.find(i => (i.id || i.app_id || i.folder) === targetId);
                        if (matchInstalled && matchInstalled.installedAt) {
                            const installedTime = new Date(matchInstalled.installedAt).getTime();
                            if (!isNaN(installedTime) && (now - installedTime) < SEVEN_DAYS_MS) {
                                app.__isNew = true;
                            }
                        }
                    } catch (err) {}
                });

                apps.sort((a, b) => {
                    try {
                        if (a.core && !b.core) return -1;
                        if (!a.core && b.core) return 1;
                        return (a.name || '').localeCompare(b.name || '');
                    } catch (err) {
                        return 0;
                    }
                });

                apps.unshift({
                    id: '__store__',
                    name: 'App Store',
                    description: 'Installa applicazioni di terze parti o gestisci quelle presenti sul nodo',
                    icon: 'icone/store.png',
                    __isStorePinned: true
                });
            }

            const UPDATE_BADGE = {
                pending:     { cls: 'badge-updating', icon: 'schedule',      text: 'In coda' },
                downloading: { cls: 'badge-updating', icon: 'download',       text: 'Scaricamento...' },
                installing:  { cls: 'badge-updating', icon: 'system_update',  text: 'Installazione...' },
                done:        { cls: 'badge-done',     icon: 'check_circle',   text: 'Aggiornato' },
                error:       { cls: 'badge-error',    icon: 'error',          text: 'Errore' }
            };

            const renderApps = (filterText = '') => {
                try {
                    grid.innerHTML = '';
                    const searchLower = filterText.toLowerCase().trim();
                    const filtered = apps.filter(a =>
                        (a.name && a.name.toLowerCase().includes(searchLower)) ||
                        (a.description && a.description.toLowerCase().includes(searchLower))
                    );

                    if (filtered.length === 0) {
                        grid.innerHTML = '<p style="color: var(--md-on-surface-variant); grid-column: 1 / -1; text-align: center; padding: 2rem;">Nessun applicativo trovato.</p>';
                        return;
                    }

                    filtered.forEach(app => {
                        try {
                            const folderName = app.folder || app.id;
                            const card = document.createElement('div');
                            card.className = 'app-card fade-in-up';
                            card.dataset.appId = folderName;

                            if (app.__isStorePinned) {
                                card.innerHTML = `
                                    <img src="icone/store.png" class="app-icon" onerror="this.src='icone/applicazione_generica.png'">
                                    <div class="app-title">${app.name}</div>
                                    ${app.description ? `<div class="app-desc">${app.description}</div>` : ''}
                                `;
                                card.addEventListener('click', () => { Router.navigate('store'); });
                                grid.appendChild(card);
                                return;
                            }

                            const iconPath = app.icon
                                ? (app.icon.includes('//') ? app.icon : (app.core || app.bundled ? `apps/${folderName}/${app.icon}` : `adestio-app://${folderName}/${app.icon}`))
                                : `icone/applicazione_generica.png`;
                            const newBadgeHtml = app.__isNew
                                ? `<span class="badge-new">NUOVA</span>`
                                : '';

                            card.innerHTML = `
                                ${newBadgeHtml}
                                <img src="${iconPath}" class="app-icon" onerror="this.src='icone/applicazione_generica.png'">
                                <div class="app-title">${app.name}</div>
                                ${app.description ? `<div class="app-desc">${app.description}</div>` : ''}
                            `;
                            card.addEventListener('click', () => {
                                Router.navigate('app_container', { appId: folderName });
                            });
                            grid.appendChild(card);
                        } catch (err) {}
                    });
                } catch (e) {}
            };

            const applyUpdateBadge = (appId, state) => {
                try {
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

                    const isActive = state === 'downloading' || state === 'installing';
                    card.classList.toggle('locked', isActive);
                } catch (e) {}
            };

            renderApps();

            if (searchInput) {
                searchInput.addEventListener('input', (e) => {
                    renderApps(e.target.value);
                });
            }

            if (window.electronAPI && window.electronAPI.store) {
                try {
                    window.electronAPI.store.getUpdateQueue().then(res => {
                        try {
                            if (res && res.success && res.data && Array.isArray(res.data.queue)) {
                                res.data.queue.forEach(item => {
                                    applyUpdateBadge(item.appId, item.state);
                                });
                            }
                        } catch (e) {}
                    }).catch(() => {});
                } catch (e) {}

                try {
                    window.electronAPI.store.onAppUpdateEvent(data => {
                        try {
                            if (data && data.appId) {
                                applyUpdateBadge(data.appId, data.state);
                            }
                        } catch (e) {}
                    });
                } catch (e) {}

                try {
                    window.electronAPI.store.onAppUpdated(data => {
                        try {
                            if (data && data.appId) {
                                setTimeout(() => { applyUpdateBadge(data.appId, 'idle'); }, 5000);
                            }
                        } catch (e) {}
                    });
                } catch (e) {}
            }
        } catch (e) {
            console.error('Dashboard render error:', e);
            el.innerHTML = '<p>Errore durante il caricamento della Dashboard.</p>';
        }
    }
};
