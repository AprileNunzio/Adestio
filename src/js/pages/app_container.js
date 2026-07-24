import { Router } from '../utils.js';

export default {
    render: async (el, params) => {
        try {
            const appId = params?.appId;
            if (!appId) {
                el.innerHTML = '<p>Errore: Nessun ID applicativo fornito.</p>';
                return;
            }
            el.innerHTML = `
                <div id="app-mount-point" style="height: 100%; width: 100%;">
                    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%;">
                        <span class="material-symbols-rounded" style="font-size: 3rem; color: var(--md-primary); animation: spin 2s linear infinite;">sync</span>
                        <p style="margin-top: 1rem; color: var(--md-on-surface-variant);">Avvio modulo in corso...</p>
                    </div>
                </div>
                <style>
                    @keyframes spin { 100% { transform: rotate(360deg); } }
                </style>
            `;
            const mountPoint = el.querySelector('#app-mount-point');
            if (window.electronAPI) {
                const userId = sessionStorage.getItem('currentUserId');
                if (userId) {
                    const userPerms = await window.electronAPI.rbac.getEffectiveUserPermissions(userId);
                    const viewPermId = `${appId}:view`;
                    const hasAccess = userPerms.includes('*') || userPerms.includes(viewPermId) || userPerms.some(p => p.startsWith(`${appId}:`));
                    if (!hasAccess) {
                        mountPoint.innerHTML = `
                            <div class="card" style="text-align: center; max-width: 500px; margin: 4rem auto; padding: 3rem;">
                                <span class="material-symbols-rounded" style="font-size: 4rem; color: var(--md-error);">gpp_bad</span>
                                <h2 style="color: var(--md-error); margin-top: 1rem;">Accesso Negato</h2>
                                <p style="color: var(--md-on-surface-variant); margin: 1rem 0 2rem;">Non hai i permessi necessari per accedere a questa applicazione. Contatta l'amministratore di sistema per richiedere l'accesso.</p>
                                <button id="btn-back-auth" class="btn" style="background: var(--md-primary); color: white;">Torna alla Dashboard</button>
                            </div>
                        `;
                        el.querySelector('#btn-back-auth')?.addEventListener('click', () => {
                            Router.navigate((window.currentUser || sessionStorage.getItem('currentUserId')) ? 'dashboard' : 'auth_login');
                        });
                        return;
                    }
                }

                try {
                    const lockRes = await window.electronAPI.store.isAppLocked(appId);
                    if (lockRes && lockRes.locked) {
                        mountPoint.innerHTML = `
                            <div class="card" style="text-align:center;max-width:480px;margin:4rem auto;padding:3rem;border:2px solid var(--md-primary);background:rgba(var(--md-primary-rgb,59,130,246),0.04);">
                                <span class="material-symbols-rounded spin" style="font-size:4rem;color:var(--md-primary);">system_update</span>
                                <h2 style="color:var(--md-primary);margin-top:1.2rem;letter-spacing:-0.02em;">Aggiornamento in corso</h2>
                                <p style="color:var(--md-on-surface-variant);margin:0.8rem 0 2rem;line-height:1.6;">L'applicazione <strong>${appId}</strong> è in fase di aggiornamento in background. Sarà disponibile al termine del processo.</p>
                                <div style="display:flex;gap:1rem;justify-content:center;">
                                    <button id="btn-back-updating" class="btn btn-secondary">Torna alla Dashboard</button>
                                </div>
                            </div>
                        `;
                        mountPoint.querySelector('#btn-back-updating')?.addEventListener('click', () => {
                            Router.navigate('dashboard');
                        });
                        if (window.electronAPI.store.onAppUpdated) {
                            window.electronAPI.store.onAppUpdated(data => {
                                try {
                                    if (data && data.appId === appId) {
                                        el.innerHTML = '';
                                        Router.navigate('app_container', { appId });
                                    }
                                } catch (e) {}
                            });
                        }
                        return;
                    }
                } catch (lockErr) {}
            }

            try {
                let appModule = null;
                let appFolder = appId;
                let mainFile = 'app.js';
                let isMarketplace = false;

                if (window.electronAPI) {
                    const allApps = await window.electronAPI.getAppsRegistry();
                    const appManifest = allApps.find(a => a.folder === appId || a.id === appId);
                    if (appManifest) {
                        appFolder = appManifest.folder || appManifest.id || appId;
                        mainFile = appManifest.main || 'app.js';
                        if (!appManifest.core && !appManifest.bundled) {
                            isMarketplace = true;
                        }
                    }
                }

                if (isMarketplace) {
                    const cssPath = `adestio-app://${appFolder}/css/style.css`;
                    if (!document.querySelector(`link[data-app-css="${appFolder}"]`)) {
                        const link = document.createElement('link');
                        link.rel = 'stylesheet';
                        link.href = cssPath;
                        link.setAttribute('data-app-css', appFolder);
                        document.head.appendChild(link);
                    }
                    appModule = await import(`adestio-app://${appFolder}/${mainFile}`);
                } else {
                    try {
                        appModule = await import(`../../apps/${appFolder}/${mainFile}`);
                    } catch (e1) {
                        try {
                            appModule = await import(`../../apps/${appId}/app.js`);
                        } catch (e2) {
                            appModule = await import(`../apps/${appFolder}/${mainFile}`);
                        }
                    }
                }

                const targetRender = (appModule && appModule.default && typeof appModule.default.render === 'function') 
                    ? appModule.default.render 
                    : (appModule && typeof appModule.render === 'function' ? appModule.render : null);

                if (targetRender) {
                    await targetRender(mountPoint, params);
                } else {
                    mountPoint.innerHTML = `
                        <div class="card" style="text-align: center;">
                            <span class="material-symbols-rounded" style="font-size: 3rem; color: var(--md-error);">error</span>
                            <h2 style="color: var(--md-error);">Errore di Caricamento</h2>
                            <p>Il modulo <b>${appId}</b> non espone un metodo render() valido.</p>
                            <button id="btn-back-error" class="btn btn-secondary" style="margin-top: 1rem;">Torna alla Dashboard</button>
                        </div>
                    `;
                    el.querySelector('#btn-back-error')?.addEventListener('click', () => {
                        Router.navigate((window.currentUser || sessionStorage.getItem('currentUserId')) ? 'dashboard' : 'auth_login');
                    });
                }
            } catch (importError) {
                console.error("Dynamic import failed for app: " + appId, importError);
                mountPoint.innerHTML = `
                    <div class="card" style="text-align: center;">
                        <span class="material-symbols-rounded" style="font-size: 3rem; color: var(--md-error);">broken_image</span>
                        <h2 style="color: var(--md-error);">Modulo non trovato</h2>
                        <p>Impossibile caricare il modulo <b>${appId}</b>. Il file app.js potrebbe essere assente o danneggiato.</p>
                        <button id="btn-back-error" class="btn btn-secondary" style="margin-top: 1rem;">Torna alla Dashboard</button>
                    </div>
                `;
                el.querySelector('#btn-back-error')?.addEventListener('click', () => {
                    Router.navigate((window.currentUser || sessionStorage.getItem('currentUserId')) ? 'dashboard' : 'auth_login');
                });
            }
        } catch (e) {
            console.error(e);
            el.innerHTML = `<p>Errore critico App Container</p>`;
        }
    }
};
