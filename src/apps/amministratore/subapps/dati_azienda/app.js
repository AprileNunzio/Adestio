import { toast } from '../../../../js/utils.js';
import GeneraliView from './views/Generali.js';
import SediView from './views/Sedi.js';
import FiscaliView from './views/Fiscali.js';

export default {
    render: async (el) => {
        try {
            el.innerHTML = `
                <div class="dati-azienda-container fade-in-up" style="display:flex; flex-direction:column; height:100%; overflow:hidden;">
                    <div style="padding: 1.5rem 1.5rem 0 1.5rem;">
                        <h2 style="margin:0 0 0.4rem; font-size:2rem; color:var(--md-on-surface); font-weight:800; letter-spacing:-0.02em;">Dati Azienda</h2>
                        <p style="margin:0; color:var(--md-on-surface-variant); font-size:1.05rem; max-width:640px;">Gestione dei dati anagrafici, fiscali e sedi dell'ente o dell'azienda.</p>
                        
                        <div class="tabs-header" style="display:flex; gap:1.5rem; margin-top:1.5rem; border-bottom:1px solid var(--md-outline-variant);">
                            <div class="tab-btn active" data-target="generali">Dati Generali</div>
                            <div class="tab-btn" data-target="fiscali">Dati Fiscali / Tesoreria</div>
                            <div class="tab-btn" data-target="sedi">Gestione Sedi</div>
                        </div>
                    </div>
                    
                    <div class="tab-content" id="tab-content-container" style="flex:1; overflow-y:auto; padding:1.5rem; position:relative;">
                        <!-- Content rendered dynamically -->
                    </div>
                </div>

                <style>
                    .tab-btn {
                        padding: 0.8rem 1rem;
                        cursor: pointer;
                        font-weight: 600;
                        color: var(--md-on-surface-variant);
                        border-bottom: 3px solid transparent;
                        transition: all 0.2s;
                    }
                    .tab-btn:hover {
                        color: var(--md-primary);
                    }
                    .tab-btn.active {
                        color: var(--md-primary);
                        border-bottom-color: var(--md-primary);
                    }
                </style>
            `;

            const container = el.querySelector('#tab-content-container');
            const tabs = el.querySelectorAll('.tab-btn');
            
            let currentView = null;
            let configCache = await window.electronAPI.readConfig() || {};

            const saveConfig = async (patch) => {
                const newConfig = { ...configCache, ...patch };
                const ok = await window.electronAPI.saveConfig(newConfig);
                if (ok) configCache = newConfig;
                return ok;
            };

            const renderTab = async (target) => {
                container.innerHTML = '<div style="text-align:center; padding:2rem;"><span class="material-symbols-rounded" style="animation:spin 1s linear infinite;">sync</span> Caricamento...</div>';
                tabs.forEach(t => t.classList.remove('active'));
                el.querySelector(\`.tab-btn[data-target="\${target}"]\`).classList.add('active');

                try {
                    if (target === 'generali') {
                        currentView = GeneraliView;
                        await currentView.render(container, configCache, saveConfig);
                    } else if (target === 'fiscali') {
                        currentView = FiscaliView;
                        await currentView.render(container, configCache, saveConfig);
                    } else if (target === 'sedi') {
                        currentView = SediView;
                        await currentView.render(container);
                    }
                } catch (e) {
                    console.error(e);
                    container.innerHTML = \`<div style="color:var(--md-error);">Errore di rendering modulo: \${e.message}</div>\`;
                }
            };

            tabs.forEach(btn => {
                btn.addEventListener('click', () => {
                    if (!btn.classList.contains('active')) {
                        renderTab(btn.dataset.target);
                    }
                });
            });

            // Initial render
            renderTab('generali');

        } catch (e) {
            console.error(e);
            el.innerHTML = '<div style="padding:2rem; color:var(--md-error);">Errore critico: ' + e.message + '</div>';
        }
    }
};
