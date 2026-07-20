import { toast } from '../../../../../js/utils.js';

export default {
    render: async (container) => {
        try {
            const DAYS = [
                { id: 'lun', label: 'Lunedì' },
                { id: 'mar', label: 'Martedì' },
                { id: 'mer', label: 'Mercoledì' },
                { id: 'gio', label: 'Giovedì' },
                { id: 'ven', label: 'Venerdì' },
                { id: 'sab', label: 'Sabato' },
                { id: 'dom', label: 'Domenica' }
            ];

            container.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:1.5rem;">
                    <div>
                        <h3 style="margin:0; font-size:1.4rem; color:var(--md-on-surface);">Sedi Aziendali</h3>
                        <p style="margin:0.2rem 0 0; color:var(--md-on-surface-variant); font-size:0.9rem;">Elenco delle sedi fisiche, orari e contatti.</p>
                    </div>
                    <button id="da-btn-add-sede" class="btn primary" style="display:flex; align-items:center; gap:0.5rem; padding:0.8rem 1.5rem;">
                        <span class="material-symbols-rounded">add</span> Aggiungi Sede
                    </button>
                </div>

                <div class="card" style="background:var(--md-surface); border-radius:16px; border:1px solid var(--md-outline-variant); overflow:hidden;">
                    <div style="overflow-x:auto;">
                        <table style="width:100%; border-collapse:collapse; text-align:left;">
                            <thead style="background:var(--md-surface-variant); color:var(--md-on-surface-variant); font-size:0.85rem; text-transform:uppercase;">
                                <tr>
                                    <th style="padding:1rem; font-weight:600;">Nome Sede</th>
                                    <th style="padding:1rem; font-weight:600;">Indirizzo</th>
                                    <th style="padding:1rem; font-weight:600;">Contatti</th>
                                    <th style="padding:1rem; font-weight:600; text-align:right;">Azioni</th>
                                </tr>
                            </thead>
                            <tbody id="da-sedi-tbody">
                                <tr><td colspan="4" style="text-align:center; padding:2rem;"><span class="material-symbols-rounded" style="animation:spin 1s linear infinite;">sync</span> Caricamento...</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- Modale Gestione Sede -->
                <div id="da-sede-modal" class="modal-overlay" style="display:none; position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.5); z-index:9999; justify-content:center; align-items:center;">
                    <div class="modal-content" style="background:var(--md-surface); width:90%; max-width:800px; max-height:90vh; border-radius:24px; display:flex; flex-direction:column; overflow:hidden; box-shadow:0 24px 38px rgba(0,0,0,0.14);">
                        <div style="padding:1.5rem; border-bottom:1px solid var(--md-outline-variant); display:flex; justify-content:space-between; align-items:center;">
                            <h3 id="da-sede-modal-title" style="margin:0; font-size:1.4rem;">Gestione Sede</h3>
                            <span class="material-symbols-rounded" id="da-sede-modal-close" style="cursor:pointer; color:var(--md-on-surface-variant);">close</span>
                        </div>
                        <div style="padding:1.5rem; overflow-y:auto; flex:1;">
                            <input type="hidden" id="da-sede-id">
                            
                            <div style="display:grid; grid-template-columns:1fr 1fr; gap:1.2rem; margin-bottom:2rem;">
                                <div style="grid-column:1/-1; display:flex; justify-content:space-between; align-items:flex-end;">
                                    <div style="flex:1; padding-right:1rem;">
                                        <label style="display:block; margin-bottom:0.4rem; font-weight:600; font-size:0.9rem; color:var(--md-on-surface-variant);">Nome Sede *</label>
                                        <input type="text" id="da-sede-nome" class="input" placeholder="Es. Sede Centrale" style="width:100%; padding:0.75rem; border-radius:8px; border:1px solid var(--md-outline); background:var(--md-surface);">
                                    </div>
                                    <label style="display:flex; align-items:center; gap:0.5rem; cursor:pointer; background:var(--md-primary-container); padding:0.75rem 1rem; border-radius:8px; border:1px dashed var(--md-primary);">
                                        <input type="checkbox" id="da-sede-is-centrale" style="width:18px; height:18px; accent-color:var(--md-primary);"> 
                                        <span style="font-weight:600; color:var(--md-on-primary-container);">Sede Principale</span>
                                    </label>
                                </div>
                                <div style="grid-column:1/-1;">
                                    <label style="display:block; margin-bottom:0.4rem; font-weight:600; font-size:0.9rem; color:var(--md-on-surface-variant);">Indirizzo</label>
                                    <input type="text" id="da-sede-indirizzo" class="input" placeholder="Via, civico" style="width:100%; padding:0.75rem; border-radius:8px; border:1px solid var(--md-outline); background:var(--md-surface);">
                                </div>
                                <div>
                                    <label style="display:block; margin-bottom:0.4rem; font-weight:600; font-size:0.9rem; color:var(--md-on-surface-variant);">Città</label>
                                    <input type="text" id="da-sede-citta" class="input" placeholder="Città" style="width:100%; padding:0.75rem; border-radius:8px; border:1px solid var(--md-outline); background:var(--md-surface);">
                                </div>
                                <div style="display:flex; gap:0.5rem;">
                                    <div style="flex:1;">
                                        <label style="display:block; margin-bottom:0.4rem; font-weight:600; font-size:0.9rem; color:var(--md-on-surface-variant);">CAP</label>
                                        <input type="text" id="da-sede-cap" class="input" placeholder="00000" style="width:100%; padding:0.75rem; border-radius:8px; border:1px solid var(--md-outline); background:var(--md-surface);">
                                    </div>
                                    <div style="flex:1;">
                                        <label style="display:block; margin-bottom:0.4rem; font-weight:600; font-size:0.9rem; color:var(--md-on-surface-variant);">Prov.</label>
                                        <input type="text" id="da-sede-provincia" class="input" placeholder="RM" style="width:100%; padding:0.75rem; border-radius:8px; border:1px solid var(--md-outline); background:var(--md-surface);">
                                    </div>
                                </div>
                                <div>
                                    <label style="display:block; margin-bottom:0.4rem; font-weight:600; font-size:0.9rem; color:var(--md-on-surface-variant);">Telefono</label>
                                    <input type="text" id="da-sede-telefono" class="input" style="width:100%; padding:0.75rem; border-radius:8px; border:1px solid var(--md-outline); background:var(--md-surface);">
                                </div>
                                <div>
                                    <label style="display:block; margin-bottom:0.4rem; font-weight:600; font-size:0.9rem; color:var(--md-on-surface-variant);">Email</label>
                                    <input type="email" id="da-sede-email" class="input" style="width:100%; padding:0.75rem; border-radius:8px; border:1px solid var(--md-outline); background:var(--md-surface);">
                                </div>
                            </div>

                            <h4 style="margin:0 0 1rem; color:var(--md-primary); border-bottom:1px solid var(--md-outline-variant); padding-bottom:0.5rem;">Orari di Apertura</h4>
                            <div id="da-sede-orari" style="display:flex; flex-direction:column; gap:0.5rem;">
                                ${DAYS.map(day => `
                                    <div class="orario-row" data-day="${day.id}" style="display:flex; align-items:center; gap:1rem; padding:0.5rem; background:var(--md-surface-variant); border-radius:8px;">
                                        <div style="width:100px; font-weight:600;">
                                            <label style="display:flex; align-items:center; gap:0.5rem; cursor:pointer;">
                                                <input type="checkbox" class="chk-aperto" checked> ${day.label}
                                            </label>
                                        </div>
                                        <div class="orari-inputs" style="display:flex; gap:1rem; flex:1;">
                                            <div style="display:flex; align-items:center; gap:0.5rem;">
                                                <span>Mattina:</span>
                                                <input type="time" class="m-start" value="08:00" style="padding:0.3rem; border-radius:4px; border:1px solid var(--md-outline);"> -
                                                <input type="time" class="m-end" value="13:00" style="padding:0.3rem; border-radius:4px; border:1px solid var(--md-outline);">
                                            </div>
                                            <div style="display:flex; align-items:center; gap:0.5rem;">
                                                <span>Pom:</span>
                                                <input type="time" class="p-start" style="padding:0.3rem; border-radius:4px; border:1px solid var(--md-outline);"> -
                                                <input type="time" class="p-end" style="padding:0.3rem; border-radius:4px; border:1px solid var(--md-outline);">
                                            </div>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                        <div style="padding:1.5rem; border-top:1px solid var(--md-outline-variant); display:flex; justify-content:flex-end; gap:1rem; background:var(--md-surface-variant);">
                            <button id="da-sede-modal-cancel" class="btn" style="padding:0.8rem 1.5rem; background:transparent; color:var(--md-on-surface);">Annulla</button>
                            <button id="da-sede-modal-save" class="btn primary" style="padding:0.8rem 1.5rem; display:flex; align-items:center; gap:0.5rem;">
                                <span class="material-symbols-rounded">check</span> Salva Sede
                            </button>
                        </div>
                    </div>
                </div>
            `;

            const tbody = container.querySelector('#da-sedi-tbody');
            const modal = container.querySelector('#da-sede-modal');

            const loadSedi = async () => {
                try {
                    const sedi = await window.electronAPI.datiAzienda.getSedi();
                    tbody.innerHTML = '';
                    if (sedi.length === 0) {
                        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:2rem; color:var(--md-on-surface-variant);">Nessuna sede configurata.</td></tr>';
                        return;
                    }
                    sedi.forEach(sede => {
                        const tr = document.createElement('tr');
                        tr.style.borderBottom = '1px solid var(--md-outline-variant)';
                        tr.innerHTML = `
                            <td style="padding:1rem;">
                                <div style="font-weight:600; color:var(--md-on-surface);">${sede.nome}</div>
                                ${sede.is_centrale ? '<span style="font-size:0.7rem; background:var(--md-primary); color:#fff; padding:0.1rem 0.4rem; border-radius:4px;">Centrale</span>' : ''}
                            </td>
                            <td style="padding:1rem; font-size:0.9rem; color:var(--md-on-surface-variant);">
                                ${sede.indirizzo ? sede.indirizzo : ''} ${sede.citta ? '- ' + sede.citta : ''}
                            </td>
                            <td style="padding:1rem; font-size:0.9rem; color:var(--md-on-surface-variant);">
                                ${sede.telefono ? 'Tel: ' + sede.telefono + '<br>' : ''}
                                ${sede.email ? 'Email: ' + sede.email : ''}
                            </td>
                            <td style="padding:1rem; text-align:right;">
                                <button class="btn-icon btn-edit" data-id="${sede.id}" title="Modifica"><span class="material-symbols-rounded">edit</span></button>
                                <button class="btn-icon btn-delete" data-id="${sede.id}" title="Elimina" style="color:var(--md-error);"><span class="material-symbols-rounded">delete</span></button>
                            </td>
                        `;
                        tbody.appendChild(tr);
                    });

                    tbody.querySelectorAll('.btn-edit').forEach(b => b.addEventListener('click', () => openModal(b.dataset.id)));
                    tbody.querySelectorAll('.btn-delete').forEach(b => b.addEventListener('click', () => deleteSede(b.dataset.id)));

                } catch (e) {
                    tbody.innerHTML = `<tr><td colspan="4" style="color:var(--md-error); padding:1rem;">Errore caricamento: ${e.message}</td></tr>`;
                }
            };

            const openModal = async (id = null) => {
                container.querySelector('#da-sede-id').value = '';
                container.querySelector('#da-sede-nome').value = '';
                container.querySelector('#da-sede-is-centrale').checked = false;
                container.querySelector('#da-sede-indirizzo').value = '';
                container.querySelector('#da-sede-citta').value = '';
                container.querySelector('#da-sede-cap').value = '';
                container.querySelector('#da-sede-provincia').value = '';
                container.querySelector('#da-sede-telefono').value = '';
                container.querySelector('#da-sede-email').value = '';
                
                // reset orari
                container.querySelectorAll('.orario-row').forEach(row => {
                    row.querySelector('.chk-aperto').checked = true;
                    row.querySelector('.m-start').value = '08:00';
                    row.querySelector('.m-end').value = '13:00';
                    row.querySelector('.p-start').value = '';
                    row.querySelector('.p-end').value = '';
                    row.querySelector('.orari-inputs').style.opacity = '1';
                });

                if (id) {
                    try {
                        const s = await window.electronAPI.datiAzienda.getSedeById(id);
                        if (s) {
                            container.querySelector('#da-sede-id').value = s.id;
                            container.querySelector('#da-sede-nome').value = s.nome;
                            container.querySelector('#da-sede-is-centrale').checked = !!s.is_centrale;
                            container.querySelector('#da-sede-indirizzo').value = s.indirizzo;
                            container.querySelector('#da-sede-citta').value = s.citta;
                            container.querySelector('#da-sede-cap').value = s.cap;
                            container.querySelector('#da-sede-provincia').value = s.provincia;
                            container.querySelector('#da-sede-telefono').value = s.telefono;
                            container.querySelector('#da-sede-email').value = s.email;

                            if (s.orari && typeof s.orari === 'object') {
                                DAYS.forEach(day => {
                                    const row = container.querySelector(`.orario-row[data-day="${day.id}"]`);
                                    const shifts = s.orari[day.id];
                                    if (shifts && shifts.length > 0) {
                                        row.querySelector('.chk-aperto').checked = true;
                                        row.querySelector('.orari-inputs').style.opacity = '1';
                                        
                                        if (shifts[0]) {
                                            row.querySelector('.m-start').value = shifts[0].start || '';
                                            row.querySelector('.m-end').value = shifts[0].end || '';
                                        }
                                        if (shifts[1]) {
                                            row.querySelector('.p-start').value = shifts[1].start || '';
                                            row.querySelector('.p-end').value = shifts[1].end || '';
                                        }
                                    } else {
                                        row.querySelector('.chk-aperto').checked = false;
                                        row.querySelector('.orari-inputs').style.opacity = '0.4';
                                        row.querySelector('.m-start').value = '';
                                        row.querySelector('.m-end').value = '';
                                    }
                                });
                            }
                        }
                    } catch (e) {
                        toast('Errore caricamento sede', 'error');
                        return;
                    }
                }
                
                modal.style.display = 'flex';
            };

            const chiudiModal = () => {
                modal.style.display = 'none';
            };

            container.querySelector('#da-btn-add-sede').addEventListener('click', () => openModal());
            container.querySelector('#da-sede-modal-close').addEventListener('click', chiudiModal);
            container.querySelector('#da-sede-modal-cancel').addEventListener('click', chiudiModal);

            container.querySelectorAll('.chk-aperto').forEach(chk => {
                chk.addEventListener('change', (e) => {
                    const row = e.target.closest('.orario-row');
                    const inputs = row.querySelector('.orari-inputs');
                    if (e.target.checked) {
                        inputs.style.opacity = '1';
                    } else {
                        inputs.style.opacity = '0.4';
                        row.querySelector('.m-start').value = '';
                        row.querySelector('.m-end').value = '';
                        row.querySelector('.p-start').value = '';
                        row.querySelector('.p-end').value = '';
                    }
                });
            });

            container.querySelector('#da-sede-modal-save').addEventListener('click', async (ev) => {
                const nome = container.querySelector('#da-sede-nome').value.trim();
                if (!nome) {
                    toast('Inserire il Nome Sede', 'error');
                    return;
                }

                const orariObj = {};
                DAYS.forEach(day => {
                    const row = container.querySelector(`.orario-row[data-day="${day.id}"]`);
                    const isAperto = row.querySelector('.chk-aperto').checked;
                    orariObj[day.id] = [];
                    if (isAperto) {
                        const mS = row.querySelector('.m-start').value;
                        const mE = row.querySelector('.m-end').value;
                        if (mS && mE) orariObj[day.id].push({ start: mS, end: mE });

                        const pS = row.querySelector('.p-start').value;
                        const pE = row.querySelector('.p-end').value;
                        if (pS && pE) orariObj[day.id].push({ start: pS, end: pE });
                    }
                });

                const data = {
                    id: container.querySelector('#da-sede-id').value,
                    nome: nome,
                    is_centrale: container.querySelector('#da-sede-is-centrale').checked,
                    indirizzo: container.querySelector('#da-sede-indirizzo').value.trim(),
                    citta: container.querySelector('#da-sede-citta').value.trim(),
                    cap: container.querySelector('#da-sede-cap').value.trim(),
                    provincia: container.querySelector('#da-sede-provincia').value.trim(),
                    telefono: container.querySelector('#da-sede-telefono').value.trim(),
                    email: container.querySelector('#da-sede-email').value.trim(),
                    orari: orariObj
                };

                const btn = ev.currentTarget;
                const old = btn.innerHTML;
                btn.disabled = true;
                btn.innerHTML = '<span class="material-symbols-rounded" style="animation:spin 1s linear infinite;">sync</span> Salvataggio...';

                try {
                    await window.electronAPI.datiAzienda.saveSede(data);
                    toast('Sede salvata', 'success');
                    chiudiModal();
                    loadSedi();
                } catch (e) {
                    toast('Errore salvataggio: ' + e.message, 'error');
                } finally {
                    btn.disabled = false;
                    btn.innerHTML = old;
                }
            });

            const deleteSede = async (id) => {
                if (confirm('Sei sicuro di voler eliminare questa Sede?')) {
                    try {
                        await window.electronAPI.datiAzienda.deleteSede(id);
                        toast('Sede eliminata', 'success');
                        loadSedi();
                    } catch (e) {
                        toast('Errore eliminazione: ' + e.message, 'error');
                    }
                }
            };

            await loadSedi();

        } catch (e) {
            console.error(e);
            container.innerHTML = '<div style="color:var(--md-error);">Errore rendering Sedi: ' + e.message + '</div>';
        }
    }
};
