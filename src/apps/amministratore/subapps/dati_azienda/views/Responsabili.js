import { toast } from '../../../../../js/utils.js';

export default {
    render: async (container, configCache, saveConfig) => {
        try {
            const isScuola = configCache.is_scuola === true || configCache.is_scuola === 'true';
            
            // Parse custom responsabili from cache
            let customResp = [];
            if (configCache.responsabili_custom) {
                try {
                    customResp = JSON.parse(configCache.responsabili_custom);
                } catch(e) {
                    customResp = [];
                }
            }

            container.innerHTML = `
                <div class="card fade-in-up" style="padding:1.5rem; background:var(--md-surface); border-radius:16px; border:1px solid var(--md-surface-variant); max-width:900px; margin:0 auto;">
                    <div style="margin-bottom:1.5rem;">
                        <h3 style="margin:0; font-size:1.4rem; color:var(--md-on-surface);">Organigramma e Responsabili</h3>
                        <p style="margin:0.2rem 0 0; color:var(--md-on-surface-variant); font-size:0.9rem;">Nomine dei responsabili per la sicurezza, privacy e altre figure legali richieste.</p>
                    </div>

                    <div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:1.2rem;">
                        <!-- Privacy & GDPR -->
                        <div style="grid-column:1 / -1; margin-top:1rem;">
                            <h4 style="margin:0 0 0.5rem; color:var(--md-primary); border-bottom:1px solid var(--md-outline-variant); padding-bottom:0.3rem;">Privacy & GDPR</h4>
                        </div>
                        <div>
                            <label style="display:flex; align-items:center; gap:0.4rem; margin-bottom:0.4rem; color:var(--md-on-surface-variant); font-weight:600; font-size:0.9rem;">
                                Titolare del Trattamento Dati
                            </label>
                            <input type="text" id="da-resp_titolare_privacy" value="${configCache.resp_titolare_privacy || ''}" placeholder="Es. Nome o Ragione Sociale" style="width:100%; padding:0.75rem; border-radius:8px; border:1px solid var(--md-outline); background:var(--md-surface); color:var(--md-on-surface); outline:none;">
                        </div>
                        <div>
                            <label style="display:flex; align-items:center; gap:0.4rem; margin-bottom:0.4rem; color:var(--md-on-surface-variant); font-weight:600; font-size:0.9rem;">
                                Data Protection Officer (DPO / RPD)
                            </label>
                            <input type="text" id="da-resp_dpo" value="${configCache.resp_dpo || ''}" placeholder="Nome, Cognome o Azienda" style="width:100%; padding:0.75rem; border-radius:8px; border:1px solid var(--md-outline); background:var(--md-surface); color:var(--md-on-surface); outline:none;">
                        </div>

                        <!-- Sicurezza sul Lavoro -->
                        <div style="grid-column:1 / -1; margin-top:1rem;">
                            <h4 style="margin:0 0 0.5rem; color:var(--md-primary); border-bottom:1px solid var(--md-outline-variant); padding-bottom:0.3rem;">Sicurezza sul Lavoro (D.Lgs. 81/08)</h4>
                        </div>
                        <div>
                            <label style="display:flex; align-items:center; gap:0.4rem; margin-bottom:0.4rem; color:var(--md-on-surface-variant); font-weight:600; font-size:0.9rem;">
                                Responsabile Servizio Prevenzione (RSPP)
                            </label>
                            <input type="text" id="da-resp_rspp" value="${configCache.resp_rspp || ''}" placeholder="Nominativo RSPP" style="width:100%; padding:0.75rem; border-radius:8px; border:1px solid var(--md-outline); background:var(--md-surface); color:var(--md-on-surface); outline:none;">
                        </div>
                        <div>
                            <label style="display:flex; align-items:center; gap:0.4rem; margin-bottom:0.4rem; color:var(--md-on-surface-variant); font-weight:600; font-size:0.9rem;">
                                Rappresentante dei Lavoratori (RLS)
                            </label>
                            <input type="text" id="da-resp_rls" value="${configCache.resp_rls || ''}" placeholder="Nominativo RLS" style="width:100%; padding:0.75rem; border-radius:8px; border:1px solid var(--md-outline); background:var(--md-surface); color:var(--md-on-surface); outline:none;">
                        </div>
                        <div>
                            <label style="display:flex; align-items:center; gap:0.4rem; margin-bottom:0.4rem; color:var(--md-on-surface-variant); font-weight:600; font-size:0.9rem;">
                                Medico Competente
                            </label>
                            <input type="text" id="da-resp_medico" value="${configCache.resp_medico || ''}" placeholder="Dott. Nome Cognome" style="width:100%; padding:0.75rem; border-radius:8px; border:1px solid var(--md-outline); background:var(--md-surface); color:var(--md-on-surface); outline:none;">
                        </div>
                        <div>
                            <label style="display:flex; align-items:center; gap:0.4rem; margin-bottom:0.4rem; color:var(--md-on-surface-variant); font-weight:600; font-size:0.9rem;">
                                Responsabile Antincendio / Emergenze
                            </label>
                            <input type="text" id="da-resp_emergenze" value="${configCache.resp_emergenze || ''}" placeholder="Nominativo o Ditta Esterna" style="width:100%; padding:0.75rem; border-radius:8px; border:1px solid var(--md-outline); background:var(--md-surface); color:var(--md-on-surface); outline:none;">
                        </div>

                        <!-- Altre Figure -->
                        <div style="grid-column:1 / -1; margin-top:1rem;">
                            <h4 style="margin:0 0 0.5rem; color:var(--md-primary); border-bottom:1px solid var(--md-outline-variant); padding-bottom:0.3rem;">Altre Figure Nominate</h4>
                        </div>
                        <div>
                            <label style="display:flex; align-items:center; gap:0.4rem; margin-bottom:0.4rem; color:var(--md-on-surface-variant); font-weight:600; font-size:0.9rem;">
                                Preposto al Divieto di Fumo
                            </label>
                            <input type="text" id="da-resp_fumo" value="${configCache.resp_fumo || ''}" placeholder="Nominativo" style="width:100%; padding:0.75rem; border-radius:8px; border:1px solid var(--md-outline); background:var(--md-surface); color:var(--md-on-surface); outline:none;">
                        </div>
                        <div>
                            <label style="display:flex; align-items:center; gap:0.4rem; margin-bottom:0.4rem; color:var(--md-on-surface-variant); font-weight:600; font-size:0.9rem;">
                                Amministratore di Sistema
                            </label>
                            <input type="text" id="da-resp_sysadmin" value="${configCache.resp_sysadmin || ''}" placeholder="Responsabile IT" style="width:100%; padding:0.75rem; border-radius:8px; border:1px solid var(--md-outline); background:var(--md-surface); color:var(--md-on-surface); outline:none;">
                        </div>
                        
                        <div style="display:${isScuola ? 'block' : 'none'};">
                            <label style="display:flex; align-items:center; gap:0.4rem; margin-bottom:0.4rem; color:var(--md-on-surface-variant); font-weight:600; font-size:0.9rem;">
                                Responsabile Transizione Digitale (RTD)
                            </label>
                            <input type="text" id="da-resp_rtd" value="${configCache.resp_rtd || ''}" placeholder="Nominativo RTD" style="width:100%; padding:0.75rem; border-radius:8px; border:1px solid var(--md-outline); background:var(--md-surface); color:var(--md-on-surface); outline:none;">
                        </div>

                        <!-- Organigramma Personalizzato -->
                        <div style="grid-column:1 / -1; margin-top:1rem;">
                            <div style="display:flex; justify-content:space-between; align-items:flex-end; border-bottom:1px solid var(--md-outline-variant); padding-bottom:0.3rem; margin-bottom:0.5rem;">
                                <h4 style="margin:0; color:var(--md-primary);">Organigramma Flessibile (Infinite Figure)</h4>
                                <button id="da-btn-add-custom-resp" class="btn" style="padding:0.3rem 0.6rem; font-size:0.8rem; display:flex; align-items:center; gap:0.3rem;">
                                    <span class="material-symbols-rounded" style="font-size:1.1rem;">add</span> Aggiungi Figura
                                </button>
                            </div>
                            <p style="margin:0 0 1rem; color:var(--md-on-surface-variant); font-size:0.85rem;">Qui puoi inserire liberamente DSGA, Dirigenti, Preposti, Amministratori di Sistema e qualsiasi altra qualifica.</p>
                            
                            <div id="da-custom-resp-container" style="display:flex; flex-direction:column; gap:0.8rem;">
                                <!-- Le righe dinamiche verranno iniettate qui -->
                            </div>
                        </div>
                    </div>

                    <div style="margin-top:2rem; display:flex; justify-content:flex-end;">
                        <button id="da-btn-save-responsabili" class="btn primary" style="display:flex; align-items:center; gap:0.5rem; padding:0.8rem 1.5rem;">
                            <span class="material-symbols-rounded">save</span> Salva Organigramma
                        </button>
                    </div>
                </div>
            `;

            const customContainer = container.querySelector('#da-custom-resp-container');

            const renderCustomResp = () => {
                customContainer.innerHTML = '';
                if (customResp.length === 0) {
                    customContainer.innerHTML = '<div style="text-align:center; padding:1rem; color:var(--md-on-surface-variant); font-size:0.9rem; font-style:italic;">Nessuna figura personalizzata aggiunta.</div>';
                    return;
                }
                customResp.forEach((item, index) => {
                    const row = document.createElement('div');
                    row.style.cssText = 'display:flex; gap:0.5rem; align-items:center; background:var(--md-surface-variant); padding:0.5rem; border-radius:8px;';
                    row.innerHTML = `
                        <input type="text" class="custom-role" value="${item.ruolo}" placeholder="Ruolo (es. Dirigente, DSGA...)" style="flex:1; padding:0.6rem; border-radius:4px; border:1px solid var(--md-outline); background:var(--md-surface); outline:none;">
                        <input type="text" class="custom-name" value="${item.nome}" placeholder="Nominativo" style="flex:1; padding:0.6rem; border-radius:4px; border:1px solid var(--md-outline); background:var(--md-surface); outline:none;">
                        <button class="btn-remove-custom icon-btn" data-index="${index}" style="color:var(--md-error); padding:0.5rem; background:transparent; border:none; cursor:pointer;" title="Rimuovi">
                            <span class="material-symbols-rounded">delete</span>
                        </button>
                    `;
                    customContainer.appendChild(row);
                });

                customContainer.querySelectorAll('.btn-remove-custom').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        const idx = parseInt(e.currentTarget.dataset.index);
                        customResp.splice(idx, 1);
                        renderCustomResp();
                    });
                });
            };

            renderCustomResp();

            container.querySelector('#da-btn-add-custom-resp').addEventListener('click', () => {
                customResp.push({ ruolo: '', nome: '' });
                renderCustomResp();
            });

            container.querySelector('#da-btn-save-responsabili').addEventListener('click', async (ev) => {
                const btn = ev.currentTarget;
                const old = btn.innerHTML;
                btn.disabled = true;
                btn.innerHTML = '<span class="material-symbols-rounded" style="animation:spin 1s linear infinite;">sync</span> Salvataggio...';
                
                try {
                    // Collect custom responsabili
                    const customRows = customContainer.querySelectorAll('div[style*="display:flex"]');
                    const currentCustomResp = [];
                    customRows.forEach(row => {
                        const ruolo = row.querySelector('.custom-role')?.value.trim();
                        const nome = row.querySelector('.custom-name')?.value.trim();
                        if (ruolo || nome) {
                            currentCustomResp.push({ ruolo, nome });
                        }
                    });

                    const patch = {
                        resp_titolare_privacy: container.querySelector('#da-resp_titolare_privacy').value.trim(),
                        resp_dpo: container.querySelector('#da-resp_dpo').value.trim(),
                        resp_rspp: container.querySelector('#da-resp_rspp').value.trim(),
                        resp_rls: container.querySelector('#da-resp_rls').value.trim(),
                        resp_medico: container.querySelector('#da-resp_medico').value.trim(),
                        resp_emergenze: container.querySelector('#da-resp_emergenze').value.trim(),
                        resp_fumo: container.querySelector('#da-resp_fumo').value.trim(),
                        resp_sysadmin: container.querySelector('#da-resp_sysadmin').value.trim(),
                        resp_rtd: container.querySelector('#da-resp_rtd') ? container.querySelector('#da-resp_rtd').value.trim() : '',
                        responsabili_custom: JSON.stringify(currentCustomResp)
                    };
                    const ok = await saveConfig(patch);
                    toast(ok ? 'Responsabili salvati con successo' : 'Errore nel salvataggio', ok ? 'success' : 'error');
                } catch (e) {
                    toast('Errore: ' + e.message, 'error');
                } finally {
                    btn.disabled = false;
                    btn.innerHTML = old;
                }
            });

        } catch (e) {
            console.error(e);
            container.innerHTML = `<div style="color:var(--md-error);">Errore rendering Responsabili: ${e.message}</div>`;
        }
    }
};
