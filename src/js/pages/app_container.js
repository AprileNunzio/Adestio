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
                        el.querySelector('#btn-back-auth')?.addEventListener('click', () => Router.navigate('dashboard'));
                        return;
                    }
                }
            }
            try {
                const appModule = await import(`../../apps/${appId}/app.js`);
                if (appModule && appModule.default && typeof appModule.default.render === 'function') {
                    await appModule.default.render(mountPoint, params);
                } else {
                    mountPoint.innerHTML = `
                        <div class="card" style="text-align: center;">
                            <span class="material-symbols-rounded" style="font-size: 3rem; color: var(--md-error);">error</span>
                            <h2 style="color: var(--md-error);">Errore di Caricamento</h2>
                            <p>Il modulo <b>${appId}</b> non espone un metodo render() valido.</p>
                            <button id="btn-back-error" class="btn btn-secondary" style="margin-top: 1rem;">Torna alla Dashboard</button>
                        </div>
                    `;
                    el.querySelector('#btn-back-error')?.addEventListener('click', () => Router.navigate('dashboard'));
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
                el.querySelector('#btn-back-error')?.addEventListener('click', () => Router.navigate('dashboard'));
            }
        } catch (e) {
            console.error(e);
            el.innerHTML = `<p>Errore critico App Container</p>`;
        }
    }
};
