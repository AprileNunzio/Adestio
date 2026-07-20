import { toast, fmt } from '../../../../js/utils.js';
import { isValidCodiceFiscale } from '../../shared/validators.js';
import { personaFormHtml, readPersonaForm, fillPersonaForm, populatePersonaFormDatalists, KIT_STYLES } from '../../shared/persona_form.js';
import { mountAuditButton } from '../../shared/audit_trail_button.js';
export default {
    render: async (el) => {
        let rawPersone = [];
        const renderList = async (filter = '') => {
            el.innerHTML = `
                <div class="fade-in-up dati-anagrafici-root" style="width:100%; height:100%; display:flex; flex-direction:column;">
                    <div class="dati-anagrafici-header" style="display:flex; flex-wrap:wrap; align-items:flex-start; justify-content:space-between; gap:1.5rem; margin-bottom:2rem; width:100%;">
                        <div style="flex:1; min-width:260px;">
                            <h1 class="text-title" style="font-size:clamp(1.7rem, 2.8vw, 2.2rem); color: var(--md-primary); margin-bottom:0.2rem; letter-spacing:-0.02em; text-align:left;">Dati Anagrafici</h1>
                            <p class="text-body" style="color: var(--md-on-surface-variant); font-size:1.05rem; text-align:left;">Anagrafe centrale delle persone</p>
                        </div>
                        <div class="dati-anagrafici-toolbar" style="display:flex; gap:1rem; align-items:center; flex-shrink:0; width:100%; max-width:500px; justify-content:flex-end;">
                            <div style="position:relative; flex:1;">
                                <span class="material-symbols-rounded" style="position:absolute; left:1rem; top:0.9rem; color: var(--md-on-surface-variant);">search</span>
                                <input type="text" id="persone-search" class="input" placeholder="Cerca per nome, cognome o codice fiscale..." style="padding-left:3rem; padding-top:0.8rem; padding-bottom:0.8rem; width:100%; border-radius:var(--shape-full); background: var(--md-surface-variant); border:1px solid var(--md-outline-variant); font-size:1.05rem;">
                            </div>
                            <button id="btn-add-persona" class="btn btn-primary" style="display:flex; align-items:center; justify-content:center; gap:0.5rem; padding:0.8rem 1.5rem; border-radius:var(--shape-full); flex-shrink:0;">
                                <span class="material-symbols-rounded">person_add</span>Nuova Persona
                            </button>
                        </div>
                    </div>
                    <div id="persone-content" style="flex:1; overflow-y:auto; background: var(--md-surface); border-radius:var(--shape-lg); padding:2rem; border:1px solid var(--md-outline-variant);">
                        <div style="text-align:center; padding:2rem;"><span class="material-symbols-rounded" style="animation: spin 2s linear infinite; font-size:2rem;">sync</span></div>
                    </div>
                </div>
                <div id="persona-modal" style="display:none; position:fixed; top:0; left:0; width:100vw; height:100vh; background: rgba(15,23,42,0.4); z-index:10000; align-items:center; justify-content:center; backdrop-filter: blur(12px); opacity:0; transition: opacity 0.3s ease;">
                    <div class="card" style="width:min(92vw, 640px); max-height:88vh; overflow-y:auto; padding:2.5rem; background: rgba(255,255,255,0.97); box-shadow:0 20px 50px rgba(0,0,0,0.15); border-radius:var(--shape-xl); transform: scale(0.95); transition: transform 0.3s cubic-bezier(0.34,1.56,0.64,1);">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:2rem;">
                            <h3 id="persona-modal-title" style="margin:0; font-family: var(--font-heading); font-size:1.6rem; color: var(--md-on-surface); font-weight:700;">Nuova Persona</h3>
                            <button id="btn-close-persona-modal" class="btn btn-icon" style="background: var(--md-surface-variant); border:none; cursor:pointer; border-radius:var(--shape-full); width:40px; height:40px; display:flex; justify-content:center; align-items:center;">
                                <span class="material-symbols-rounded">close</span>
                            </button>
                        </div>
                        <form id="persona-form" style="display:flex; flex-direction:column; gap:1rem;">
                            ${personaFormHtml()}
                            <div id="persona-modal-error" style="color: var(--md-on-error-container); font-size:0.9rem; text-align:center; display:none; background: var(--md-error-container); padding:0.8rem; border-radius:var(--shape-sm);"></div>
                            <div style="display:flex; justify-content:flex-end; gap:1rem; margin-top:1rem;">
                                <button type="button" id="btn-cancel-persona-modal" class="btn" style="background:transparent; border:none; color: var(--md-on-surface-variant); padding:0.8rem 1.5rem; border-radius:var(--shape-md); cursor:pointer; font-weight:600;">Annulla</button>
                                <button type="submit" id="btn-save-persona-modal" class="btn btn-primary" style="padding:0.8rem 2rem; border-radius:var(--shape-md); font-weight:600;">Salva</button>
                            </div>
                        </form>
                    </div>
                </div>
                ${KIT_STYLES}
                <style>
                    .dati-anagrafici-header, .dati-anagrafici-toolbar { transition: all 0.2s; }
                    @media (max-width: 720px) {
                        .dati-anagrafici-toolbar { max-width: 100%; flex-wrap: wrap; }
                        .dati-anagrafici-toolbar > div:first-child { min-width: 200px; }
                    }
                </style>
            `;
            const content = el.querySelector('#persone-content');
            const searchInput = el.querySelector('#persone-search');
            const modal = el.querySelector('#persona-modal');
            const form = el.querySelector('#persona-form');
            const modalError = el.querySelector('#persona-modal-error');
            const renderCards = (filterText) => {
                const filtered = rawPersone.filter(p =>
                    p.nome.toLowerCase().includes(filterText.toLowerCase()) ||
                    p.cognome.toLowerCase().includes(filterText.toLowerCase()) ||
                    (p.codice_fiscale && p.codice_fiscale.toLowerCase().includes(filterText.toLowerCase()))
                );
                if (filtered.length === 0) {
                    content.innerHTML = '<p style="text-align:center; color: var(--md-on-surface-variant);">Nessuna persona trovata.</p>';
                    return;
                }
                const tones = ['primary', 'tertiary', 'secondary'];
                content.innerHTML = `<div class="persone-grid">${filtered.map((p, index) => `
                    <div class="persona-card fade-in-up ${p.is_deleted ? 'blocked' : ''}" data-id="${p.id}">
                        <div style="display:flex; align-items:center; gap:0.8rem;">
                            <div class="persona-card-avatar" style="width:48px; height:48px; border-radius:var(--shape-sm); background: var(--md-${tones[index % tones.length]}); color: #ffffff; display:flex; align-items:center; justify-content:center; font-size:1.3rem; font-weight:bold; flex-shrink:0;">
                                ${(p.cognome || '?').charAt(0).toUpperCase()}
                            </div>
                            <div style="flex:1; overflow:hidden;">
                                <div style="font-weight:700; color: var(--md-on-surface); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${p.cognome} ${p.nome}</div>
                                <div style="font-size:0.8rem; color: var(--md-on-surface-variant); letter-spacing:0.5px;">${p.codice_fiscale || 'CF non specificato'}</div>
                            </div>
                        </div>
                        <div style="font-size:0.8rem; color: var(--md-on-surface-variant); margin-top:0.4rem;">${p.data_nascita ? 'Nato/a il ' + fmt.data(p.data_nascita) : ''}</div>
                    </div>
                `).join('')}</div>`;
                content.querySelectorAll('.persona-card').forEach(card => {
                    card.addEventListener('click', () => renderScheda(card.getAttribute('data-id')));
                });
            };
            const loadPersone = async (filterText = '') => {
                try {
                    rawPersone = await window.electronAPI.anagrafica.persone.getAll();
                    renderCards(filterText);
                } catch (e) {
                    content.innerHTML = `<p style="color:var(--md-error); text-align:center;">Errore caricamento: ${e.message}</p>`;
                }
            };
            searchInput.addEventListener('input', (e) => renderCards(e.target.value));
            const openModal = (persona = null) => {
                modalError.style.display = 'none';
                el.querySelector('#persona-modal-title').innerText = persona ? 'Modifica Persona' : 'Nuova Persona';
                fillPersonaForm(el, persona);
                populatePersonaFormDatalists(el);
                modal.style.display = 'flex';
                setTimeout(() => {
                    modal.style.opacity = '1';
                    modal.querySelector('.card').style.transform = 'scale(1)';
                }, 10);
            };
            const closeModal = () => {
                modal.style.opacity = '0';
                modal.querySelector('.card').style.transform = 'scale(0.95)';
                setTimeout(() => { modal.style.display = 'none'; }, 300);
            };
            el.querySelector('#btn-add-persona').addEventListener('click', () => openModal());
            el.querySelector('#btn-close-persona-modal').addEventListener('click', closeModal);
            el.querySelector('#btn-cancel-persona-modal').addEventListener('click', closeModal);
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                modalError.style.display = 'none';
                const btnSave = el.querySelector('#btn-save-persona-modal');
                btnSave.disabled = true;
                try {
                    const data = readPersonaForm(el);
                    const id = el.querySelector('#persona-id').value;
                    if (!id && (!data.codice_fiscale || !isValidCodiceFiscale(data.codice_fiscale))) {
                        throw new Error('Il Codice Fiscale è obbligatorio e deve essere valido: è la chiave univoca della persona');
                    }
                    if (id) {
                        data.id = id;
                        await window.electronAPI.anagrafica.persone.update(data);
                    } else {
                        await window.electronAPI.anagrafica.persone.create(data);
                    }
                    toast('Persona salvata con successo', 'success');
                    closeModal();
                    await loadPersone(searchInput.value);
                } catch (err) {
                    modalError.innerText = err.message || 'Errore durante il salvataggio.';
                    modalError.style.display = 'block';
                } finally {
                    btnSave.disabled = false;
                }
            });
            await loadPersone(filter);
        };
        const renderScheda = async (personaId) => {
            el.innerHTML = `
                <div class="fade-in-up" style="width:100%; height:100%; display:flex; flex-direction:column;">
                    <div style="display:flex; justify-content:center; align-items:center; height:100%;">
                        <span class="material-symbols-rounded" style="animation: spin 2s linear infinite; font-size:2rem;">sync</span>
                    </div>
                </div>
            `;
            let scheda;
            try {
                scheda = await window.electronAPI.anagrafica.persone.getScheda({ id: personaId });
            } catch (e) {
                el.innerHTML = `<p style="color:var(--md-error); text-align:center;">Errore caricamento scheda: ${e.message}</p>`;
                return;
            }
            const p = scheda.persona;
            let activeTab = 'documenti';
            const renderTabContent = () => {
                const box = el.querySelector('#scheda-tab-content');
                if (!box) return;
                if (activeTab === 'documenti') {
                    box.innerHTML = scheda.documenti.length === 0
                        ? '<p style="color:var(--md-on-surface-variant); text-align:center; padding:1.5rem;">Nessun documento registrato.</p>'
                        : scheda.documenti.map(d => `
                            <div class="scheda-record">
                                <div class="scheda-record-title">${d.tipo} — ${d.numero || 'n/d'}</div>
                                <div class="scheda-record-sub">Rilasciato da ${d.ente_rilascio || 'n/d'} il ${d.data_rilascio ? fmt.data(d.data_rilascio) : 'n/d'} — Scadenza: ${d.data_scadenza ? fmt.data(d.data_scadenza) : 'n/d'}</div>
                            </div>
                        `).join('');
                } else if (activeTab === 'residenza') {
                    box.innerHTML = scheda.indirizzi.length === 0
                        ? '<p style="color:var(--md-on-surface-variant); text-align:center; padding:1.5rem;">Nessun indirizzo registrato.</p>'
                        : scheda.indirizzi.map(i => `
                            <div class="scheda-record">
                                <div class="scheda-record-title">${i.tipo === 'residenza' ? 'Residenza' : 'Domicilio'} ${i.is_corrente ? '(attuale)' : '(storico)'}</div>
                                <div class="scheda-record-sub">${i.via} ${i.civico}, ${i.cap} ${i.comune} (${i.provincia}) — ${i.stato}</div>
                            </div>
                        `).join('');
                } else if (activeTab === 'lavoro') {
                    box.innerHTML = scheda.rapportiLavoro.length === 0
                        ? '<p style="color:var(--md-on-surface-variant); text-align:center; padding:1.5rem;">Nessun rapporto di lavoro registrato.</p>'
                        : scheda.rapportiLavoro.map(r => `
                            <div class="scheda-record">
                                <div class="scheda-record-title">${r.datore_lavoro} ${r.is_corrente ? '(attuale)' : '(storico)'}</div>
                                <div class="scheda-record-sub">${r.mansione || 'n/d'} — ${r.tipo_contratto || 'n/d'} — dal ${r.data_inizio ? fmt.data(r.data_inizio) : 'n/d'}${r.data_fine ? ' al ' + fmt.data(r.data_fine) : ''}</div>
                            </div>
                        `).join('');
                }
            };
            el.innerHTML = `
                <div class="fade-in-up scheda-root" style="width:100%; height:100%; display:flex; flex-direction:column;">
                    <div class="scheda-header" style="display:flex; align-items:center; flex-wrap:wrap; gap:1rem; margin-bottom:1.5rem;">
                        <button id="btn-back-scheda" class="btn-icon-action" title="Torna all'elenco"><span class="material-symbols-rounded">arrow_back</span></button>
                        <div style="flex:1; min-width:200px;">
                            <h1 class="text-title" style="font-size:clamp(1.5rem, 2.6vw, 2rem); color: var(--md-primary); margin-bottom:0.1rem;">${p.cognome} ${p.nome}</h1>
                            <p class="text-body" style="color: var(--md-on-surface-variant);">${p.codice_fiscale || 'Codice Fiscale non specificato'}</p>
                        </div>
                        <div id="scheda-audit-mount"></div>
                        <button id="btn-edit-scheda" class="btn btn-primary" style="display:flex; align-items:center; justify-content:center; gap:0.5rem; padding:0.7rem 1.4rem; border-radius:var(--shape-full);"><span class="material-symbols-rounded">edit</span>Modifica</button>
                        ${p.is_deleted ? '<button id="btn-restore-scheda" class="btn-icon-action" title="Ripristina"><span class="material-symbols-rounded">restore</span></button>' : '<button id="btn-delete-scheda" class="btn-icon-action danger" title="Elimina"><span class="material-symbols-rounded">delete</span></button>'}
                        <button id="btn-harddelete-scheda" class="btn-icon-action danger" title="Elimina Definitivamente"><span class="material-symbols-rounded">delete_forever</span></button>
                    </div>
                    <div class="card" style="padding:1.5rem; border-radius:var(--shape-lg); margin-bottom:1.5rem;">
                        <div class="scheda-info-chips">
                            <div class="scheda-chip tone-primary"><span class="material-symbols-rounded">cake</span>${p.data_nascita ? fmt.data(p.data_nascita) : 'Nascita n/d'} ${p.luogo_nascita ? 'a ' + p.luogo_nascita : ''} ${p.provincia_nascita ? '(' + p.provincia_nascita + ')' : ''}</div>
                            <div class="scheda-chip tone-secondary"><span class="material-symbols-rounded">wc</span>${p.sesso || 'Sesso n/d'}</div>
                            <div class="scheda-chip tone-tertiary"><span class="material-symbols-rounded">flag</span>${p.cittadinanza || 'Cittadinanza n/d'}</div>
                            <div class="scheda-chip tone-primary"><span class="material-symbols-rounded">favorite</span>${p.stato_civile || 'Stato civile n/d'}</div>
                            <div class="scheda-chip tone-secondary"><span class="material-symbols-rounded">email</span>${p.email_principale || 'Email n/d'}</div>
                            <div class="scheda-chip tone-tertiary"><span class="material-symbols-rounded">phone</span>${p.telefono_principale || 'Telefono n/d'}</div>
                        </div>
                        ${p.note ? `<div style="margin-top:1rem; color: var(--md-on-surface-variant);"><b>Note:</b> ${p.note}</div>` : ''}
                    </div>
                    <div class="scheda-tabs" style="display:flex; gap:0.8rem; margin-bottom:1rem; flex-wrap:wrap;">
                        <button class="scheda-tab active" data-tab="documenti">Documenti (${scheda.documenti.length})</button>
                        <button class="scheda-tab" data-tab="residenza">Residenza e Domicilio (${scheda.indirizzi.length})</button>
                        <button class="scheda-tab" data-tab="lavoro">Lavoro (${scheda.rapportiLavoro.length})</button>
                    </div>
                    <div id="scheda-tab-content" style="flex:1; overflow-y:auto; background: var(--md-surface); border-radius:var(--shape-lg); padding:1.5rem; border:1px solid var(--md-outline-variant);"></div>
                </div>
                <div id="persona-modal" style="display:none; position:fixed; top:0; left:0; width:100vw; height:100vh; background: rgba(15,23,42,0.4); z-index:10000; align-items:center; justify-content:center; backdrop-filter: blur(12px); opacity:0; transition: opacity 0.3s ease;">
                    <div class="card" style="width:min(92vw, 640px); max-height:88vh; overflow-y:auto; padding:2.5rem; background: rgba(255,255,255,0.97); box-shadow:0 20px 50px rgba(0,0,0,0.15); border-radius:var(--shape-xl); transform: scale(0.95); transition: transform 0.3s cubic-bezier(0.34,1.56,0.64,1);">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:2rem;">
                            <h3 style="margin:0; font-family: var(--font-heading); font-size:1.6rem; color: var(--md-on-surface); font-weight:700;">Modifica Persona</h3>
                            <button id="btn-close-persona-modal" class="btn btn-icon" style="background: var(--md-surface-variant); border:none; cursor:pointer; border-radius:var(--shape-full); width:40px; height:40px; display:flex; justify-content:center; align-items:center;">
                                <span class="material-symbols-rounded">close</span>
                            </button>
                        </div>
                        <form id="persona-form" style="display:flex; flex-direction:column; gap:1rem;">
                            ${personaFormHtml()}
                            <div id="persona-modal-error" style="color: var(--md-on-error-container); font-size:0.9rem; text-align:center; display:none; background: var(--md-error-container); padding:0.8rem; border-radius:var(--shape-sm);"></div>
                            <div style="display:flex; justify-content:flex-end; gap:1rem; margin-top:1rem;">
                                <button type="button" id="btn-cancel-persona-modal" class="btn" style="background:transparent; border:none; color: var(--md-on-surface-variant); padding:0.8rem 1.5rem; border-radius:var(--shape-md); cursor:pointer; font-weight:600;">Annulla</button>
                                <button type="submit" id="btn-save-persona-modal" class="btn btn-primary" style="padding:0.8rem 2rem; border-radius:var(--shape-md); font-weight:600;">Salva</button>
                            </div>
                        </form>
                    </div>
                </div>
                ${KIT_STYLES}
                <style>
                    .scheda-info-chips { display: flex; gap: 0.8rem; flex-wrap: wrap; }
                    .scheda-chip {
                        display: flex; align-items: center; gap: 0.5rem;
                        padding: 0.5rem 1rem; border-radius: var(--shape-full);
                        font-size: 0.9rem; font-weight: 500;
                    }
                    .scheda-chip .material-symbols-rounded { font-size: 1.1rem; }
                    .scheda-chip.tone-primary { background: var(--md-primary-container); color: var(--md-on-primary-container); }
                    .scheda-chip.tone-secondary { background: var(--md-secondary-container); color: var(--md-on-secondary-container); }
                    .scheda-chip.tone-tertiary { background: var(--md-tertiary-container); color: var(--md-on-tertiary-container); }
                    @media (max-width: 720px) {
                        .scheda-header { justify-content: flex-start; }
                        #btn-edit-scheda { flex: 1; }
                    }
                </style>
            `;
            renderTabContent();
            mountAuditButton(el.querySelector('#scheda-audit-mount'), { tableName: 'persone', recordId: personaId, label: `${p.cognome} ${p.nome}` });
            el.querySelectorAll('.scheda-tab').forEach(tab => {
                tab.addEventListener('click', () => {
                    activeTab = tab.getAttribute('data-tab');
                    el.querySelectorAll('.scheda-tab').forEach(t => t.classList.remove('active'));
                    tab.classList.add('active');
                    renderTabContent();
                });
            });
            el.querySelector('#btn-back-scheda').addEventListener('click', () => renderList());
            const modal = el.querySelector('#persona-modal');
            const form = el.querySelector('#persona-form');
            const modalError = el.querySelector('#persona-modal-error');
            const openModal = () => {
                modalError.style.display = 'none';
                fillPersonaForm(el, p);
                populatePersonaFormDatalists(el);
                modal.style.display = 'flex';
                setTimeout(() => {
                    modal.style.opacity = '1';
                    modal.querySelector('.card').style.transform = 'scale(1)';
                }, 10);
            };
            const closeModal = () => {
                modal.style.opacity = '0';
                modal.querySelector('.card').style.transform = 'scale(0.95)';
                setTimeout(() => { modal.style.display = 'none'; }, 300);
            };
            el.querySelector('#btn-edit-scheda').addEventListener('click', openModal);
            el.querySelector('#btn-close-persona-modal').addEventListener('click', closeModal);
            el.querySelector('#btn-cancel-persona-modal').addEventListener('click', closeModal);
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                modalError.style.display = 'none';
                const btnSave = el.querySelector('#btn-save-persona-modal');
                btnSave.disabled = true;
                try {
                    const data = readPersonaForm(el);
                    if (data.codice_fiscale && !isValidCodiceFiscale(data.codice_fiscale)) {
                        throw new Error('Codice Fiscale non valido');
                    }
                    data.id = personaId;
                    await window.electronAPI.anagrafica.persone.update(data);
                    toast('Persona aggiornata con successo', 'success');
                    closeModal();
                    await renderScheda(personaId);
                } catch (err) {
                    modalError.innerText = err.message || 'Errore durante il salvataggio.';
                    modalError.style.display = 'block';
                } finally {
                    btnSave.disabled = false;
                }
            });
            const deleteBtn = el.querySelector('#btn-delete-scheda');
            if (deleteBtn) {
                deleteBtn.addEventListener('click', async () => {
                    if (!confirm('Sei sicuro di voler bloccare questa persona?')) return;
                    await window.electronAPI.anagrafica.persone.remove({ id: personaId });
                    toast('Persona bloccata', 'success');
                    await renderScheda(personaId);
                });
            }
            const restoreBtn = el.querySelector('#btn-restore-scheda');
            if (restoreBtn) {
                restoreBtn.addEventListener('click', async () => {
                    await window.electronAPI.anagrafica.persone.restore({ id: personaId });
                    toast('Persona ripristinata', 'success');
                    await renderScheda(personaId);
                });
            }
            el.querySelector('#btn-harddelete-scheda').addEventListener('click', async () => {
                if (!confirm('ATTENZIONE: Sei sicuro di voler ELIMINARE DEFINITIVAMENTE questa persona e tutti i suoi dati collegati (documenti, indirizzi, lavoro)?\nQuesta operazione è irreversibile e verrà propagata a tutti i nodi connessi.')) return;
                await window.electronAPI.anagrafica.persone.hardDelete({ id: personaId });
                toast('Persona eliminata definitivamente', 'success');
                await renderList();
            });
        };
        await renderList();
    }
};
