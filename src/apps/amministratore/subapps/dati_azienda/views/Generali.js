import { toast } from '../../../../../js/utils.js';

export default {
    render: async (container, configCache, saveConfig) => {
        try {
            const isScuola = configCache.is_scuola === true || configCache.is_scuola === 'true';

            container.innerHTML = `
                <div class="card fade-in-up" style="padding:1.5rem; background:var(--md-surface); border-radius:16px; border:1px solid var(--md-surface-variant); max-width:900px; margin:0 auto;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem;">
                        <div>
                            <h3 style="margin:0; font-size:1.4rem; color:var(--md-on-surface);">Dati Generali Ente</h3>
                            <p style="margin:0; color:var(--md-on-surface-variant); font-size:0.9rem;">Informazioni legali, anagrafiche e fatturazione.</p>
                        </div>
                        
                        <label style="display:flex; align-items:center; gap:0.5rem; cursor:pointer; user-select:none; background:var(--md-surface-variant); padding:0.5rem 1rem; border-radius:24px;">
                            <span style="font-weight:600; color:var(--md-on-surface-variant);">L'ente è una Scuola?</span>
                            <div style="position:relative; width:44px; height:24px;">
                                <input type="checkbox" id="da-is-scuola" ${isScuola ? 'checked' : ''} style="opacity:0; width:0; height:0;">
                                <div class="switch-track" style="position:absolute; top:0; left:0; right:0; bottom:0; background: ${isScuola ? 'var(--md-primary)' : 'var(--md-surface)'}; border-radius:24px; transition:0.3s; box-shadow:inset 0 1px 3px rgba(0,0,0,0.1);"></div>
                                <div class="switch-thumb" style="position:absolute; top:2px; left:${isScuola ? '22px' : '2px'}; width:20px; height:20px; background:#fff; border-radius:50%; transition:0.3s; box-shadow:0 1px 3px rgba(0,0,0,0.3);"></div>
                            </div>
                        </label>
                    </div>

                    <div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:1.2rem;">
                        <div style="grid-column:1 / -1;">
                            <label style="display:flex; align-items:center; gap:0.4rem; margin-bottom:0.4rem; color:var(--md-on-surface-variant); font-weight:600; font-size:0.9rem;">
                                <span class="material-symbols-rounded" style="font-size:1.1rem; color:var(--md-primary);">corporate_fare</span>Denominazione Ente / Ragione Sociale *
                            </label>
                            <input type="text" id="da-istituto_nome" value="${configCache.istituto_nome || ''}" placeholder="Es. I.C. Giovanni Verga / Azienda S.p.A." style="width:100%; padding:0.75rem; border-radius:8px; border:1px solid var(--md-outline); background:var(--md-surface); color:var(--md-on-surface); outline:none;">
                        </div>

                        <div id="scuola-fields-container" style="display:${isScuola ? 'block' : 'none'}; grid-column:1 / -1; background:var(--md-primary-container); padding:1rem; border-radius:8px; border:1px dashed var(--md-primary);">
                            <label style="display:flex; align-items:center; gap:0.4rem; margin-bottom:0.4rem; color:var(--md-on-primary-container); font-weight:600; font-size:0.9rem;">
                                <span class="material-symbols-rounded" style="font-size:1.1rem; color:var(--md-primary);">school</span>Codice Meccanografico
                            </label>
                            <input type="text" id="da-istituto_codice_meccanografico" value="${configCache.istituto_codice_meccanografico || ''}" placeholder="Es. RMIC8AA00X" style="width:100%; padding:0.75rem; border-radius:8px; border:1px solid var(--md-outline); background:var(--md-surface); color:var(--md-on-surface); outline:none;">
                        </div>

                        <div>
                            <label style="display:flex; align-items:center; gap:0.4rem; margin-bottom:0.4rem; color:var(--md-on-surface-variant); font-weight:600; font-size:0.9rem;">
                                <span class="material-symbols-rounded" style="font-size:1.1rem; color:var(--md-primary);">receipt_long</span>Partita IVA
                            </label>
                            <input type="text" id="da-istituto_piva" value="${configCache.istituto_piva || ''}" placeholder="Es. 01234567890" style="width:100%; padding:0.75rem; border-radius:8px; border:1px solid var(--md-outline); background:var(--md-surface); color:var(--md-on-surface); outline:none;">
                        </div>

                        <div>
                            <label style="display:flex; align-items:center; gap:0.4rem; margin-bottom:0.4rem; color:var(--md-on-surface-variant); font-weight:600; font-size:0.9rem;">
                                <span class="material-symbols-rounded" style="font-size:1.1rem; color:var(--md-primary);">badge</span>Codice Fiscale
                            </label>
                            <input type="text" id="da-istituto_cf" value="${configCache.istituto_cf || ''}" placeholder="Es. 80012345678" style="width:100%; padding:0.75rem; border-radius:8px; border:1px solid var(--md-outline); background:var(--md-surface); color:var(--md-on-surface); outline:none;">
                        </div>
                        
                        <div>
                            <label style="display:flex; align-items:center; gap:0.4rem; margin-bottom:0.4rem; color:var(--md-on-surface-variant); font-weight:600; font-size:0.9rem;">
                                <span class="material-symbols-rounded" style="font-size:1.1rem; color:var(--md-primary);">send</span>Codice Destinatario (SDI)
                            </label>
                            <input type="text" id="da-istituto_sdi" value="${configCache.istituto_sdi || ''}" placeholder="Es. M5UXCR1 (o PEC)" style="width:100%; padding:0.75rem; border-radius:8px; border:1px solid var(--md-outline); background:var(--md-surface); color:var(--md-on-surface); outline:none;">
                        </div>

                        <div>
                            <label style="display:flex; align-items:center; gap:0.4rem; margin-bottom:0.4rem; color:var(--md-on-surface-variant); font-weight:600; font-size:0.9rem;">
                                <span class="material-symbols-rounded" style="font-size:1.1rem; color:var(--md-primary);">account_circle</span>Forma Giuridica / REA
                            </label>
                            <input type="text" id="da-istituto_forma" value="${configCache.istituto_forma || ''}" placeholder="Es. S.p.A. / Ente Pubblico / REA MI-1234" style="width:100%; padding:0.75rem; border-radius:8px; border:1px solid var(--md-outline); background:var(--md-surface); color:var(--md-on-surface); outline:none;">
                        </div>

                        <div style="grid-column:1 / -1;">
                            <label style="display:flex; align-items:center; gap:0.4rem; margin-bottom:0.4rem; color:var(--md-on-surface-variant); font-weight:600; font-size:0.9rem;">
                                <span class="material-symbols-rounded" style="font-size:1.1rem; color:var(--md-primary);">gavel</span>Legale Rappresentante
                            </label>
                            <input type="text" id="da-istituto_rappresentante" value="${configCache.istituto_rappresentante || ''}" placeholder="Nome e Cognome del Dirigente o Amministratore" style="width:100%; padding:0.75rem; border-radius:8px; border:1px solid var(--md-outline); background:var(--md-surface); color:var(--md-on-surface); outline:none;">
                        </div>

                        <div style="grid-column:1 / -1;">
                            <label style="display:flex; align-items:center; gap:0.4rem; margin-bottom:0.4rem; color:var(--md-on-surface-variant); font-weight:600; font-size:0.9rem;">
                                <span class="material-symbols-rounded" style="font-size:1.1rem; color:var(--md-primary);">location_on</span>Indirizzo Sede Legale Completo
                            </label>
                            <input type="text" id="da-istituto_indirizzo" value="${configCache.istituto_indirizzo || ''}" placeholder="Via, civico, CAP, città (Prov.)" style="width:100%; padding:0.75rem; border-radius:8px; border:1px solid var(--md-outline); background:var(--md-surface); color:var(--md-on-surface); outline:none;">
                        </div>

                        <div>
                            <label style="display:flex; align-items:center; gap:0.4rem; margin-bottom:0.4rem; color:var(--md-on-surface-variant); font-weight:600; font-size:0.9rem;">
                                <span class="material-symbols-rounded" style="font-size:1.1rem; color:var(--md-primary);">call</span>Telefono Principale
                            </label>
                            <input type="text" id="da-istituto_telefono" value="${configCache.istituto_telefono || ''}" placeholder="Es. +39 06 1234567" style="width:100%; padding:0.75rem; border-radius:8px; border:1px solid var(--md-outline); background:var(--md-surface); color:var(--md-on-surface); outline:none;">
                        </div>

                        <div>
                            <label style="display:flex; align-items:center; gap:0.4rem; margin-bottom:0.4rem; color:var(--md-on-surface-variant); font-weight:600; font-size:0.9rem;">
                                <span class="material-symbols-rounded" style="font-size:1.1rem; color:var(--md-primary);">public</span>Sito Web
                            </label>
                            <input type="text" id="da-istituto_web" value="${configCache.istituto_web || ''}" placeholder="Es. www.azienda.it" style="width:100%; padding:0.75rem; border-radius:8px; border:1px solid var(--md-outline); background:var(--md-surface); color:var(--md-on-surface); outline:none;">
                        </div>

                        <div>
                            <label style="display:flex; align-items:center; gap:0.4rem; margin-bottom:0.4rem; color:var(--md-on-surface-variant); font-weight:600; font-size:0.9rem;">
                                <span class="material-symbols-rounded" style="font-size:1.1rem; color:var(--md-primary);">mail</span>Email Istituzionale
                            </label>
                            <input type="text" id="da-istituto_email" value="${configCache.istituto_email || ''}" placeholder="Es. info@azienda.it" style="width:100%; padding:0.75rem; border-radius:8px; border:1px solid var(--md-outline); background:var(--md-surface); color:var(--md-on-surface); outline:none;">
                        </div>

                        <div>
                            <label style="display:flex; align-items:center; gap:0.4rem; margin-bottom:0.4rem; color:var(--md-on-surface-variant); font-weight:600; font-size:0.9rem;">
                                <span class="material-symbols-rounded" style="font-size:1.1rem; color:var(--md-primary);">mark_email_read</span>Email PEC
                            </label>
                            <input type="text" id="da-istituto_pec" value="${configCache.istituto_pec || ''}" placeholder="Es. pec@pec.azienda.it" style="width:100%; padding:0.75rem; border-radius:8px; border:1px solid var(--md-outline); background:var(--md-surface); color:var(--md-on-surface); outline:none;">
                        </div>
                    </div>

                    <div style="margin-top:2rem; display:flex; justify-content:flex-end;">
                        <button id="da-btn-save-generali" class="btn primary" style="display:flex; align-items:center; gap:0.5rem; padding:0.8rem 1.5rem;">
                            <span class="material-symbols-rounded">save</span> Salva Dati Generali
                        </button>
                    </div>
                </div>
            `;

            const chkScuola = container.querySelector('#da-is-scuola');
            const track = container.querySelector('.switch-track');
            const thumb = container.querySelector('.switch-thumb');
            const scFields = container.querySelector('#scuola-fields-container');

            chkScuola.addEventListener('change', (e) => {
                const checked = e.target.checked;
                track.style.background = checked ? 'var(--md-primary)' : 'var(--md-surface)';
                thumb.style.left = checked ? '22px' : '2px';
                scFields.style.display = checked ? 'block' : 'none';
            });

            container.querySelector('#da-btn-save-generali').addEventListener('click', async (ev) => {
                const btn = ev.currentTarget;
                const old = btn.innerHTML;
                btn.disabled = true;
                btn.innerHTML = '<span class="material-symbols-rounded" style="animation:spin 1s linear infinite;">sync</span> Salvataggio...';
                
                try {
                    const patch = {
                        is_scuola: chkScuola.checked,
                        istituto_nome: container.querySelector('#da-istituto_nome').value.trim(),
                        istituto_codice_meccanografico: container.querySelector('#da-istituto_codice_meccanografico').value.trim(),
                        istituto_piva: container.querySelector('#da-istituto_piva').value.trim(),
                        istituto_cf: container.querySelector('#da-istituto_cf').value.trim(),
                        istituto_sdi: container.querySelector('#da-istituto_sdi').value.trim(),
                        istituto_forma: container.querySelector('#da-istituto_forma').value.trim(),
                        istituto_rappresentante: container.querySelector('#da-istituto_rappresentante').value.trim(),
                        istituto_indirizzo: container.querySelector('#da-istituto_indirizzo').value.trim(),
                        istituto_telefono: container.querySelector('#da-istituto_telefono').value.trim(),
                        istituto_web: container.querySelector('#da-istituto_web').value.trim(),
                        istituto_email: container.querySelector('#da-istituto_email').value.trim(),
                        istituto_pec: container.querySelector('#da-istituto_pec').value.trim()
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
            container.innerHTML = '<div style="color:var(--md-error);">Errore rendering Generali: ' + e.message + '</div>';
        }
    }
};
