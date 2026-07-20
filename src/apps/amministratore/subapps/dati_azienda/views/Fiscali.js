import { toast } from '../../../../../js/utils.js';

export default {
    render: async (container, configCache, saveConfig) => {
        try {
            const isScuola = configCache.is_scuola === true || configCache.is_scuola === 'true';

            container.innerHTML = `
                <div class="card fade-in-up" style="padding:1.5rem; background:var(--md-surface); border-radius:16px; border:1px solid var(--md-surface-variant); max-width:800px; margin:0 auto;">
                    <div style="margin-bottom:1.5rem;">
                        <h3 style="margin:0; font-size:1.4rem; color:var(--md-on-surface);">Dati Fiscali / Tesoreria</h3>
                        <p style="margin:0.2rem 0 0; color:var(--md-on-surface-variant); font-size:0.9rem;">Impostazioni bancarie, tesoreria e fondi pensione dell'ente.</p>
                    </div>

                    <div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:1.2rem;">
                        <div style="grid-column:1 / -1;">
                            <label style="display:flex; align-items:center; gap:0.4rem; margin-bottom:0.4rem; color:var(--md-on-surface-variant); font-weight:600; font-size:0.9rem;">
                                <span class="material-symbols-rounded" style="font-size:1.1rem; color:var(--md-primary);">account_balance</span>Banca / Istituto Tesoreria
                            </label>
                            <input type="text" id="da-istituto_cc_banca" value="${configCache.istituto_cc_banca || ''}" placeholder="Es. Banca d'Italia" style="width:100%; padding:0.75rem; border-radius:8px; border:1px solid var(--md-outline); background:var(--md-surface); color:var(--md-on-surface); outline:none;">
                        </div>

                        <div>
                            <label style="display:flex; align-items:center; gap:0.4rem; margin-bottom:0.4rem; color:var(--md-on-surface-variant); font-weight:600; font-size:0.9rem;">
                                <span class="material-symbols-rounded" style="font-size:1.1rem; color:var(--md-primary);">badge</span>Intestatario Conto
                            </label>
                            <input type="text" id="da-istituto_cc_intestatario" value="${configCache.istituto_cc_intestatario || ''}" placeholder="Es. Nome Ente" style="width:100%; padding:0.75rem; border-radius:8px; border:1px solid var(--md-outline); background:var(--md-surface); color:var(--md-on-surface); outline:none;">
                        </div>

                        <div>
                            <label style="display:flex; align-items:center; gap:0.4rem; margin-bottom:0.4rem; color:var(--md-on-surface-variant); font-weight:600; font-size:0.9rem;">
                                <span class="material-symbols-rounded" style="font-size:1.1rem; color:var(--md-primary);">tag</span>IBAN Conto Corrente
                            </label>
                            <input type="text" id="da-istituto_cc_iban" value="${configCache.istituto_cc_iban || ''}" placeholder="IT..." style="width:100%; padding:0.75rem; border-radius:8px; border:1px solid var(--md-outline); background:var(--md-surface); color:var(--md-on-surface); outline:none;">
                        </div>

                        <div style="grid-column:1 / -1; display:${isScuola ? 'block' : 'none'};">
                            <label style="display:flex; align-items:center; gap:0.4rem; margin-bottom:0.4rem; color:var(--md-on-surface-variant); font-weight:600; font-size:0.9rem;">
                                <span class="material-symbols-rounded" style="font-size:1.1rem; color:var(--md-primary);">savings</span>Fondo Espero (Scuole)
                            </label>
                            <input type="text" id="da-istituto_fondo_espero" value="${configCache.istituto_fondo_espero || ''}" placeholder="Es. Aderente / Non aderente" style="width:100%; padding:0.75rem; border-radius:8px; border:1px solid var(--md-outline); background:var(--md-surface); color:var(--md-on-surface); outline:none;">
                        </div>
                    </div>

                    <div style="margin-top:2rem; display:flex; justify-content:flex-end;">
                        <button id="da-btn-save-fiscali" class="btn primary" style="display:flex; align-items:center; gap:0.5rem; padding:0.8rem 1.5rem;">
                            <span class="material-symbols-rounded">save</span> Salva Dati Fiscali
                        </button>
                    </div>
                </div>
            `;

            container.querySelector('#da-btn-save-fiscali').addEventListener('click', async (ev) => {
                const btn = ev.currentTarget;
                const old = btn.innerHTML;
                btn.disabled = true;
                btn.innerHTML = '<span class="material-symbols-rounded" style="animation:spin 1s linear infinite;">sync</span> Salvataggio...';
                
                try {
                    const patch = {
                        istituto_cc_banca: container.querySelector('#da-istituto_cc_banca').value.trim(),
                        istituto_cc_intestatario: container.querySelector('#da-istituto_cc_intestatario').value.trim(),
                        istituto_cc_iban: container.querySelector('#da-istituto_cc_iban').value.trim(),
                        istituto_fondo_espero: container.querySelector('#da-istituto_fondo_espero') ? container.querySelector('#da-istituto_fondo_espero').value.trim() : ''
                    };
                    const ok = await saveConfig(patch);
                    toast(ok ? 'Dati salvati con successo' : 'Errore nel salvataggio', ok ? 'success' : 'error');
                } catch (e) {
                    toast('Errore: ' + e.message, 'error');
                } finally {
                    btn.disabled = false;
                    btn.innerHTML = old;
                }
            });

        } catch (e) {
            console.error(e);
            container.innerHTML = '<div style="color:var(--md-error);">Errore rendering Fiscali: ' + e.message + '</div>';
        }
    }
};
