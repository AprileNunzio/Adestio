import { toast } from '../../../../../js/utils.js';

export default {
    render: async (container, configCache, saveConfig) => {
        try {
            const isScuola = configCache.is_scuola === true || configCache.is_scuola === 'true';

            container.innerHTML = `
                <div class="card fade-in-up" style="padding:1.5rem; background:var(--md-surface); border-radius:16px; border:1px solid var(--md-surface-variant); max-width:900px; margin:0 auto;">
                    <div style="margin-bottom:1.5rem;">
                        <h3 style="margin:0; font-size:1.4rem; color:var(--md-on-surface);">Certificazioni e Compliance</h3>
                        <p style="margin:0.2rem 0 0; color:var(--md-on-surface-variant); font-size:0.9rem;">Gestisci i requisiti di qualificazione per appalti, bandi e conformità aziendale.</p>
                    </div>

                    <div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:1.2rem;">
                        
                        <div style="grid-column:1 / -1; margin-top:1rem;">
                            <h4 style="margin:0 0 0.5rem; color:var(--md-primary); border-bottom:1px solid var(--md-outline-variant); padding-bottom:0.3rem;">Sistemi di Gestione (Norme ISO)</h4>
                        </div>
                        
                        <div>
                            <label style="display:flex; align-items:center; justify-content:space-between; margin-bottom:0.4rem; font-weight:600; font-size:0.9rem; color:var(--md-on-surface-variant);">
                                <span>Certificazione ISO 9001 (Qualità)</span>
                                <input type="checkbox" id="da-cert-iso9001-chk" ${configCache.cert_iso9001 === 'true' ? 'checked' : ''} style="width:18px; height:18px; accent-color:var(--md-primary);">
                            </label>
                            <input type="text" id="da-cert-iso9001-ente" value="${configCache.cert_iso9001_ente || ''}" placeholder="Ente certificatore / N. Certificato" style="width:100%; padding:0.75rem; border-radius:8px; border:1px solid var(--md-outline); background:var(--md-surface); color:var(--md-on-surface); outline:none; display:${configCache.cert_iso9001 === 'true' ? 'block' : 'none'};" class="da-cert-detail">
                        </div>

                        <div>
                            <label style="display:flex; align-items:center; justify-content:space-between; margin-bottom:0.4rem; font-weight:600; font-size:0.9rem; color:var(--md-on-surface-variant);">
                                <span>Certificazione ISO 27001 (Sicurezza IT)</span>
                                <input type="checkbox" id="da-cert-iso27001-chk" ${configCache.cert_iso27001 === 'true' ? 'checked' : ''} style="width:18px; height:18px; accent-color:var(--md-primary);">
                            </label>
                            <input type="text" id="da-cert-iso27001-ente" value="${configCache.cert_iso27001_ente || ''}" placeholder="Ente certificatore / N. Certificato" style="width:100%; padding:0.75rem; border-radius:8px; border:1px solid var(--md-outline); background:var(--md-surface); color:var(--md-on-surface); outline:none; display:${configCache.cert_iso27001 === 'true' ? 'block' : 'none'};" class="da-cert-detail">
                        </div>
                        
                        <div>
                            <label style="display:flex; align-items:center; justify-content:space-between; margin-bottom:0.4rem; font-weight:600; font-size:0.9rem; color:var(--md-on-surface-variant);">
                                <span>Certificazione ISO 14001 (Ambiente)</span>
                                <input type="checkbox" id="da-cert-iso14001-chk" ${configCache.cert_iso14001 === 'true' ? 'checked' : ''} style="width:18px; height:18px; accent-color:var(--md-primary);">
                            </label>
                            <input type="text" id="da-cert-iso14001-ente" value="${configCache.cert_iso14001_ente || ''}" placeholder="Ente certificatore / N. Certificato" style="width:100%; padding:0.75rem; border-radius:8px; border:1px solid var(--md-outline); background:var(--md-surface); color:var(--md-on-surface); outline:none; display:${configCache.cert_iso14001 === 'true' ? 'block' : 'none'};" class="da-cert-detail">
                        </div>

                        <div>
                            <label style="display:flex; align-items:center; justify-content:space-between; margin-bottom:0.4rem; font-weight:600; font-size:0.9rem; color:var(--md-on-surface-variant);">
                                <span>Certificazione ISO 45001 (Salute sul Lavoro)</span>
                                <input type="checkbox" id="da-cert-iso45001-chk" ${configCache.cert_iso45001 === 'true' ? 'checked' : ''} style="width:18px; height:18px; accent-color:var(--md-primary);">
                            </label>
                            <input type="text" id="da-cert-iso45001-ente" value="${configCache.cert_iso45001_ente || ''}" placeholder="Ente certificatore / N. Certificato" style="width:100%; padding:0.75rem; border-radius:8px; border:1px solid var(--md-outline); background:var(--md-surface); color:var(--md-on-surface); outline:none; display:${configCache.cert_iso45001 === 'true' ? 'block' : 'none'};" class="da-cert-detail">
                        </div>

                        <div style="grid-column:1 / -1; margin-top:1rem;">
                            <h4 style="margin:0 0 0.5rem; color:var(--md-primary); border-bottom:1px solid var(--md-outline-variant); padding-bottom:0.3rem;">Modelli Organizzativi e SOA</h4>
                        </div>

                        <div>
                            <label style="display:flex; align-items:center; justify-content:space-between; margin-bottom:0.4rem; font-weight:600; font-size:0.9rem; color:var(--md-on-surface-variant);">
                                <span>Modello Organizzativo 231/01</span>
                                <input type="checkbox" id="da-cert-231-chk" ${configCache.cert_231 === 'true' ? 'checked' : ''} style="width:18px; height:18px; accent-color:var(--md-primary);">
                            </label>
                            <input type="text" id="da-cert-231-ente" value="${configCache.cert_231_ente || ''}" placeholder="Data adozione OdV" style="width:100%; padding:0.75rem; border-radius:8px; border:1px solid var(--md-outline); background:var(--md-surface); color:var(--md-on-surface); outline:none; display:${configCache.cert_231 === 'true' ? 'block' : 'none'};" class="da-cert-detail">
                        </div>

                        <div>
                            <label style="display:flex; align-items:center; justify-content:space-between; margin-bottom:0.4rem; font-weight:600; font-size:0.9rem; color:var(--md-on-surface-variant);">
                                <span>Attestazione SOA (Opere Pubbliche)</span>
                                <input type="checkbox" id="da-cert-soa-chk" ${configCache.cert_soa === 'true' ? 'checked' : ''} style="width:18px; height:18px; accent-color:var(--md-primary);">
                            </label>
                            <input type="text" id="da-cert-soa-ente" value="${configCache.cert_soa_ente || ''}" placeholder="Categorie SOA (Es. OG1, OS3...)" style="width:100%; padding:0.75rem; border-radius:8px; border:1px solid var(--md-outline); background:var(--md-surface); color:var(--md-on-surface); outline:none; display:${configCache.cert_soa === 'true' ? 'block' : 'none'};" class="da-cert-detail">
                        </div>
                    </div>

                    <div style="margin-top:2rem; display:flex; justify-content:flex-end;">
                        <button id="da-btn-save-cert" class="btn primary" style="display:flex; align-items:center; gap:0.5rem; padding:0.8rem 1.5rem;">
                            <span class="material-symbols-rounded">save</span> Salva Certificazioni
                        </button>
                    </div>
                </div>
            `;

            
            const setupToggle = (chkId, txtId) => {
                const chk = container.querySelector('#' + chkId);
                const txt = container.querySelector('#' + txtId);
                if (!chk || !txt) return;
                chk.addEventListener('change', (e) => {
                    txt.style.display = e.target.checked ? 'block' : 'none';
                    if (!e.target.checked) txt.value = '';
                });
            };

            setupToggle('da-cert-iso9001-chk', 'da-cert-iso9001-ente');
            setupToggle('da-cert-iso27001-chk', 'da-cert-iso27001-ente');
            setupToggle('da-cert-iso14001-chk', 'da-cert-iso14001-ente');
            setupToggle('da-cert-iso45001-chk', 'da-cert-iso45001-ente');
            setupToggle('da-cert-231-chk', 'da-cert-231-ente');
            setupToggle('da-cert-soa-chk', 'da-cert-soa-ente');

            container.querySelector('#da-btn-save-cert').addEventListener('click', async (ev) => {
                const btn = ev.currentTarget;
                const old = btn.innerHTML;
                btn.disabled = true;
                btn.innerHTML = '<span class="material-symbols-rounded" style="animation:spin 1s linear infinite;">sync</span> Salvataggio...';
                
                try {
                    const patch = {
                        cert_iso9001: container.querySelector('#da-cert-iso9001-chk').checked ? 'true' : 'false',
                        cert_iso9001_ente: container.querySelector('#da-cert-iso9001-ente').value.trim(),
                        
                        cert_iso27001: container.querySelector('#da-cert-iso27001-chk').checked ? 'true' : 'false',
                        cert_iso27001_ente: container.querySelector('#da-cert-iso27001-ente').value.trim(),
                        
                        cert_iso14001: container.querySelector('#da-cert-iso14001-chk').checked ? 'true' : 'false',
                        cert_iso14001_ente: container.querySelector('#da-cert-iso14001-ente').value.trim(),
                        
                        cert_iso45001: container.querySelector('#da-cert-iso45001-chk').checked ? 'true' : 'false',
                        cert_iso45001_ente: container.querySelector('#da-cert-iso45001-ente').value.trim(),
                        
                        cert_231: container.querySelector('#da-cert-231-chk').checked ? 'true' : 'false',
                        cert_231_ente: container.querySelector('#da-cert-231-ente').value.trim(),
                        
                        cert_soa: container.querySelector('#da-cert-soa-chk').checked ? 'true' : 'false',
                        cert_soa_ente: container.querySelector('#da-cert-soa-ente').value.trim()
                    };
                    const ok = await saveConfig(patch);
                    toast(ok ? 'Certificazioni salvate con successo' : 'Errore nel salvataggio', ok ? 'success' : 'error');
                } catch (e) {
                    toast('Errore: ' + e.message, 'error');
                } finally {
                    btn.disabled = false;
                    btn.innerHTML = old;
                }
            });

        } catch (e) {
            console.error(e);
            container.innerHTML = '<div style="color:var(--md-error);">Errore rendering Certificazioni: ' + e.message + '</div>';
        }
    }
};
