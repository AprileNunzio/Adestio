import { toast } from '../../../../js/utils.js';
import { getCurrentUserId, resolveCurrentPersona } from '../../shared/current_persona.js';
import { heroHtml, guidaHtml, AK_STYLES, TONI } from '../../shared/ui_kit.js';
const CATEGORIE = ['Telefono', 'Email', 'Social', 'Web', 'VoIP', 'Emergenza', 'Altro'];
const TIPI_PER_CATEGORIA = {
    'Telefono': ['Cellulare', 'Lavoro', 'Fisso', 'Aziendale', 'Fax'],
    'Email': ['Personale', 'Lavoro', 'PEC'],
    'Social': ['LinkedIn', 'Facebook', 'Instagram', 'Twitter', 'TikTok', 'YouTube', 'Twitch'],
    'Web': ['Sito Personale', 'Portfolio', 'Sito Aziendale', 'Blog'],
    'VoIP': ['Skype', 'Zoom', 'Teams', 'Google Meet', 'Discord'],
    'Emergenza': ['Parente', 'Amico', 'Medico'],
    'Altro': ['Personalizzato']
};
const ICONS = {
    'Telefono': 'phone',
    'Email': 'email',
    'Social': 'share',
    'Web': 'language',
    'VoIP': 'headset_mic',
    'Emergenza': 'medical_services',
    'Altro': 'contact_mail'
};
const TONE = TONI.violet;
function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function getContattiHtml() {
    return `
        <div class="fade-in-up ak-root">
            ${heroHtml({
                title: 'Contatti & Recapiti',
                subtitle: 'Tutti i tuoi recapiti in un\'unica rubrica ordinata.',
                icon: 'contacts',
                tone: 'violet',
                actionsHtml: `<button id="btn-add-contatto" class="ak-hero-btn"><span class="material-symbols-rounded">add_ic_call</span>Nuovo Contatto</button>`
            })}
            ${guidaHtml({
                tone: 'violet',
                intro: 'Raccogli qui numeri di telefono, email, profili social e contatti di emergenza. Verranno raggruppati automaticamente per categoria.',
                steps: [
                    'Premi <strong>“Nuovo Contatto”</strong> in alto a destra.',
                    'Scegli la <strong>categoria</strong> (Telefono, Email, Social…) e il <strong>tipo</strong> (es. Cellulare, PEC).',
                    'Inserisci il <strong>valore</strong>: numero, indirizzo email o link a seconda della categoria.',
                    'Spunta <strong>“Contatto principale”</strong> per il recapito che preferisci ricevere per primo.'
                ]
            })}
            <div class="ak-panel">
                <div class="ak-panel-body" id="contatti-list-container"></div>
            </div>
        </div>
        <div id="contatto-modal" class="ak-modal" style="--ak-accent:${TONE.accent}; --ak-soft:${TONE.soft};" role="dialog" aria-modal="true" aria-labelledby="modal-title-text">
            <div class="ak-modal-card">
                <div class="ak-modal-head">
                    <h3><span class="material-symbols-rounded">contact_phone</span><span id="modal-title-text">Nuovo Contatto</span></h3>
                    <button type="button" id="btn-cancel-x" class="ak-iconbtn" aria-label="Chiudi finestra"><span class="material-symbols-rounded">close</span></button>
                </div>
                <div class="ak-modal-body">
                    <div class="ak-modal-hint"><span class="material-symbols-rounded">lightbulb</span><span>Scegli prima la categoria: i tipi suggeriti e il formato del valore si adattano di conseguenza.</span></div>
                    <form id="contatto-form" class="ak-form">
                        <input type="hidden" id="contatto-id">
                        <div class="ak-form-grid">
                            <div class="ak-field">
                                <label class="ak-flabel" for="contatto-categoria">Categoria<span class="ak-req" aria-hidden="true">*</span></label>
                                <div class="ak-inputbox">
                                    <span class="material-symbols-rounded ak-ficon" aria-hidden="true">category</span>
                                    <select id="contatto-categoria" class="ak-input" required>
                                        <option value="" disabled selected hidden>Seleziona…</option>
                                        ${CATEGORIE.map(c => `<option value="${c}">${c}</option>`).join('')}
                                    </select>
                                    <span class="material-symbols-rounded ak-fcaret" aria-hidden="true">unfold_more</span>
                                </div>
                                <small class="ak-hint">Il gruppo in cui finirà il contatto.</small>
                            </div>
                            <div class="ak-field">
                                <label class="ak-flabel" for="contatto-tipo">Tipo<span class="ak-req" aria-hidden="true">*</span></label>
                                <div class="ak-inputbox">
                                    <span class="material-symbols-rounded ak-ficon" aria-hidden="true">label</span>
                                    <input type="text" id="contatto-tipo" class="ak-input" list="tipi-list" placeholder="es. Cellulare, PEC…" required>
                                    <datalist id="tipi-list"></datalist>
                                </div>
                                <small class="ak-hint">Etichetta del recapito.</small>
                            </div>
                            <div class="ak-field" style="grid-column:1/-1;">
                                <label class="ak-flabel" for="contatto-valore">Valore<span class="ak-req" aria-hidden="true">*</span></label>
                                <div class="ak-inputbox">
                                    <span class="material-symbols-rounded ak-ficon" aria-hidden="true">alternate_email</span>
                                    <input type="text" id="contatto-valore" class="ak-input" placeholder="Numero, email o link…" required>
                                </div>
                                <small class="ak-hint">Il recapito vero e proprio (numero, indirizzo email, URL…).</small>
                            </div>
                            <div class="ak-field" style="grid-column:1/-1;">
                                <label class="ak-flabel" for="contatto-note">Note (facoltative)</label>
                                <div class="ak-inputbox">
                                    <span class="material-symbols-rounded ak-ficon" aria-hidden="true">sticky_note_2</span>
                                    <input type="text" id="contatto-note" class="ak-input" placeholder="Dettagli aggiuntivi…">
                                </div>
                            </div>
                            <label class="ak-check" for="contatto-principale" style="grid-column:1/-1;">
                                <input type="checkbox" id="contatto-principale">
                                <span class="ak-check-box" aria-hidden="true"><span class="material-symbols-rounded">check</span></span>
                                <span class="ak-check-text">Contatto principale (preferito)<small class="ak-hint" style="display:block;">Verrà evidenziato con un badge nella rubrica.</small></span>
                            </label>
                        </div>
                        <div id="modal-error" class="ak-error" role="alert"></div>
                        <div class="ak-actions">
                            <button type="button" id="btn-delete" class="ak-btn ak-btn-danger" style="display:none;"><span class="material-symbols-rounded">delete</span>Elimina</button>
                            <button type="button" id="btn-cancel" class="ak-btn ak-btn-ghost">Annulla</button>
                            <button type="submit" id="btn-save" class="ak-btn ak-btn-primary"><span class="material-symbols-rounded">save</span>Salva</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
        ${AK_STYLES}
        <style>
            .contatti-group { margin-bottom: 1.6rem; }
            .contatti-group:last-child { margin-bottom: 0; }
            .contatti-group-title { font-size: 0.95rem; font-weight: 800; color: var(--md-on-surface); margin: 0 0 0.9rem;
                display: flex; align-items: center; gap: 0.5rem; padding-bottom: 0.5rem; border-bottom: 2px solid var(--md-outline-variant); }
            .contatti-group-title .material-symbols-rounded { color: ${TONE.accent}; font-size: 1.2rem; }
            .contatti-group-count { font-size: 0.72rem; font-weight: 700; color: var(--md-on-surface-variant);
                background: var(--md-surface-variant); padding: 0.1rem 0.5rem; border-radius: 999px; margin-left: auto; }
            .contatti-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 0.9rem; }
            .contatto-card { position: relative; background: var(--md-surface-container-lowest); border: 1px solid var(--md-outline-variant);
                border-radius: 14px; padding: 0.9rem 1rem; display: flex; gap: 0.85rem; align-items: center; cursor: pointer;
                transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease; overflow: hidden; }
            .contatto-card:hover { transform: translateY(-3px); box-shadow: 0 10px 22px -8px rgba(0,0,0,0.18); border-color: ${TONE.accent}; }
            .contatto-card:focus-visible { outline: 3px solid var(--md-outline-focus); outline-offset: 2px; }
            .contatto-card .c-icon { width: 42px; height: 42px; border-radius: 12px; background: ${TONE.soft}; color: ${TONE.accent};
                display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
            .contatto-card .c-icon .material-symbols-rounded { font-size: 1.25rem; }
            .contatto-card .c-content { flex: 1; min-width: 0; }
            .contatto-card .c-valore { font-size: 0.95rem; font-weight: 700; color: var(--md-on-surface);
                white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            .contatto-card .c-tipo { font-size: 0.8rem; color: var(--md-on-surface-variant); font-weight: 500; }
            .contatto-card .c-note { font-size: 0.75rem; color: var(--md-on-surface-variant); opacity: 0.85; margin-top: 0.15rem;
                white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            .contatto-card .c-star { position: absolute; top: 0.5rem; right: 0.5rem; color: #f59e0b; font-size: 1.05rem; }
        </style>
    `;
}
const subapp = {
    render: async (el) => {
        const userId = getCurrentUserId();
        if (!userId) {
            el.innerHTML = '<p style="text-align:center; color:var(--md-error); padding:2rem;">Devi effettuare l\'accesso per gestire l\'agenda contatti.</p>';
            return;
        }
        let persona = null;
        try {
            persona = await resolveCurrentPersona();
        } catch (e) {
            el.innerHTML = `<p style="text-align:center; color:var(--md-error); padding:2rem;">Errore caricamento: ${e.message}</p>`;
            return;
        }
        if (!persona) {
            el.innerHTML = `<div class="ak-empty" style="margin-top:2rem;">
                <span class="material-symbols-rounded">person_off</span>
                <h4>Anagrafica non ancora configurata</h4>
                <p>Vai su "I Miei Dati" per creare la tua scheda, poi torna qui per aggiungere i contatti.</p>
            </div>`;
            return;
        }
        el.innerHTML = getContattiHtml();
        const listContainer = el.querySelector('#contatti-list-container');
        const modal = el.querySelector('#contatto-modal');
        const form = el.querySelector('#contatto-form');
        const btnAdd = el.querySelector('#btn-add-contatto');
        const btnCancel = el.querySelector('#btn-cancel');
        const btnCancelX = el.querySelector('#btn-cancel-x');
        const btnDelete = el.querySelector('#btn-delete');
        const modalError = el.querySelector('#modal-error');
        const modalTitleText = el.querySelector('#modal-title-text');
        const inputId = el.querySelector('#contatto-id');
        const inputCategoria = el.querySelector('#contatto-categoria');
        const inputTipo = el.querySelector('#contatto-tipo');
        const inputValore = el.querySelector('#contatto-valore');
        const inputPrincipale = el.querySelector('#contatto-principale');
        const inputNote = el.querySelector('#contatto-note');
        const datalistTipi = el.querySelector('#tipi-list');
        let contattiList = [];
        async function loadContatti() {
            try {
                contattiList = await window.electronAPI.anagrafica.contatti.getByPersona({ personaId: persona.id });
                renderContatti();
            } catch (e) {
                listContainer.innerHTML = `<p style="color:var(--md-error); padding:1rem;">Errore: ${e.message}</p>`;
            }
        }
        function cardHtml(c, icon) {
            const star = c.is_principale === 1 ? `<span class="material-symbols-rounded c-star" title="Contatto principale" style="font-variation-settings:'FILL' 1;">star</span>` : '';
            const noteHtml = c.note ? `<div class="c-note">${esc(c.note)}</div>` : '';
            return `
                <div class="contatto-card" data-id="${esc(c.id)}" tabindex="0" role="button">
                    ${star}
                    <div class="c-icon"><span class="material-symbols-rounded">${icon}</span></div>
                    <div class="c-content">
                        <div class="c-valore">${esc(c.valore)}</div>
                        <div class="c-tipo">${esc(c.tipo)}</div>
                        ${noteHtml}
                    </div>
                </div>
            `;
        }
        function renderContatti() {
            if (contattiList.length === 0) {
                listContainer.innerHTML = `<div class="ak-empty">
                    <span class="material-symbols-rounded">contacts</span>
                    <h4>Nessun contatto presente</h4>
                    <p>Clicca su "Nuovo Contatto" in alto per aggiungerne uno.</p>
                </div>`;
                return;
            }
            const gruppi = {};
            contattiList.forEach(c => {
                const cat = c.categoria || 'Altro';
                if (!gruppi[cat]) gruppi[cat] = [];
                gruppi[cat].push(c);
            });
            const ordine = [...CATEGORIE, ...Object.keys(gruppi).filter(c => !CATEGORIE.includes(c))];
            let html = '';
            for (const cat of ordine) {
                if (!gruppi[cat]) continue;
                const icon = ICONS[cat] || 'contact_mail';
                html += `<div class="contatti-group">
                    <div class="contatti-group-title">
                        <span class="material-symbols-rounded">${icon}</span> ${esc(cat)}
                        <span class="contatti-group-count">${gruppi[cat].length}</span>
                    </div>
                    <div class="contatti-grid">${gruppi[cat].map(c => cardHtml(c, icon)).join('')}</div>
                </div>`;
            }
            listContainer.innerHTML = html;
            listContainer.querySelectorAll('.contatto-card').forEach(card => {
                const open = () => {
                    const c = contattiList.find(x => x.id === card.getAttribute('data-id'));
                    if (c) openModal(c);
                };
                card.addEventListener('click', open);
                card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
            });
        }
        function openModal(contatto = null) {
            modalError.style.display = 'none';
            if (contatto) {
                modalTitleText.textContent = 'Modifica Contatto';
                inputId.value = contatto.id;
                inputCategoria.value = contatto.categoria;
                updateDatalist(contatto.categoria);
                inputTipo.value = contatto.tipo;
                inputValore.value = contatto.valore;
                inputPrincipale.checked = contatto.is_principale === 1;
                inputNote.value = contatto.note || '';
                btnDelete.style.display = 'inline-flex';
            } else {
                modalTitleText.textContent = 'Nuovo Contatto';
                form.reset();
                inputId.value = '';
                inputCategoria.value = '';
                updateDatalist('');
                btnDelete.style.display = 'none';
            }
            modal.style.display = 'flex';
            requestAnimationFrame(() => {
                modal.style.opacity = '1';
                modal.querySelector('.ak-modal-card').style.transform = 'scale(1) translateY(0)';
                inputCategoria.focus();
            });
        }
        function closeModal() {
            modal.style.opacity = '0';
            modal.querySelector('.ak-modal-card').style.transform = 'scale(0.95) translateY(10px)';
            setTimeout(() => { modal.style.display = 'none'; }, 250);
        }
        function updateDatalist(cat) {
            const list = TIPI_PER_CATEGORIA[cat] || [];
            datalistTipi.innerHTML = list.map(t => `<option value="${t}"></option>`).join('');
            if (cat === 'Email') inputValore.type = 'email';
            else if (cat === 'Telefono' || cat === 'Emergenza') inputValore.type = 'tel';
            else if (cat === 'Web') inputValore.type = 'url';
            else inputValore.type = 'text';
        }
        inputCategoria.addEventListener('change', (e) => {
            updateDatalist(e.target.value);
            inputTipo.value = '';
        });
        btnAdd.addEventListener('click', () => openModal());
        btnCancel.addEventListener('click', closeModal);
        btnCancelX.addEventListener('click', closeModal);
        modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && modal.style.display === 'flex') closeModal(); });
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            modalError.style.display = 'none';
            const btnSave = el.querySelector('#btn-save');
            btnSave.disabled = true;
            try {
                const data = {
                    persona_id: persona.id,
                    categoria: inputCategoria.value,
                    tipo: inputTipo.value.trim(),
                    valore: inputValore.value.trim(),
                    is_principale: inputPrincipale.checked,
                    note: inputNote.value.trim()
                };
                if (inputId.value) {
                    data.id = inputId.value;
                    await window.electronAPI.anagrafica.contatti.update(data);
                    toast('Contatto aggiornato', 'success');
                } else {
                    await window.electronAPI.anagrafica.contatti.create(data);
                    toast('Contatto aggiunto', 'success');
                }
                closeModal();
                await loadContatti();
            } catch (err) {
                modalError.textContent = err.message || 'Errore salvataggio';
                modalError.style.display = 'block';
            } finally {
                btnSave.disabled = false;
            }
        });
        btnDelete.addEventListener('click', async () => {
            if (!confirm('Sei sicuro di voler eliminare questo contatto?')) return;
            try {
                btnDelete.disabled = true;
                await window.electronAPI.anagrafica.contatti.remove({ id: inputId.value });
                toast('Contatto eliminato', 'success');
                closeModal();
                await loadContatti();
            } catch (err) {
                modalError.textContent = err.message || 'Errore eliminazione';
                modalError.style.display = 'block';
            } finally {
                btnDelete.disabled = false;
            }
        });
        await loadContatti();
    }
};
export default subapp;
