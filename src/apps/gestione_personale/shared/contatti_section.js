import { toast } from '../../../js/utils.js';
import { AK_STYLES, TONI } from './ui_kit.js';

/**
 * Sezione "Contatti & Recapiti" riutilizzabile, agganciata a una persona fissa.
 * Pensata per essere montata dentro la console per singola persona (embedded),
 * ma usabile anche in autonomia. Design condiviso (AK).
 *
 * mountContattiSection(el, { persona, tone='violet', embedded=true, onChange })
 */
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
const ICONS = { 'Telefono': 'phone', 'Email': 'email', 'Social': 'share', 'Web': 'language', 'VoIP': 'headset_mic', 'Emergenza': 'medical_services', 'Altro': 'contact_mail' };

function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function mountContattiSection(el, opts = {}) {
    const { persona, tone = 'violet', embedded = true, onChange } = opts;
    const TONE = TONI[tone] || TONI.violet;
    if (!persona || !persona.id) {
        el.innerHTML = '<div class="ak-empty"><span class="material-symbols-rounded">person_off</span><h4>Nessuna persona selezionata</h4></div>';
        return;
    }

    el.innerHTML = `
        <div class="ak-root" style="--ak-accent:${TONE.accent}; --ak-soft:${TONE.soft}; gap:0.75rem;">
            <section class="ak-panel">
                <div class="ak-toolbar">
                    <h3>Recapiti <span class="ak-count" id="ct-count">0</span></h3>
                    <button id="ct-add" class="ak-btn ak-btn-primary" style="padding:0.55rem 1.1rem;"><span class="material-symbols-rounded">add_ic_call</span>Nuovo Contatto</button>
                </div>
                <div class="ak-panel-body" id="ct-list"></div>
            </section>
        </div>

        <div id="ct-modal" class="ak-modal" style="--ak-accent:${TONE.accent}; --ak-soft:${TONE.soft};" role="dialog" aria-modal="true" aria-labelledby="ct-modal-title">
            <div class="ak-modal-card">
                <div class="ak-modal-head">
                    <h3 id="ct-modal-title"><span class="material-symbols-rounded">contact_phone</span><span id="ct-modal-title-text">Nuovo Contatto</span></h3>
                    <button type="button" id="ct-close" class="ak-iconbtn" aria-label="Chiudi finestra"><span class="material-symbols-rounded">close</span></button>
                </div>
                <div class="ak-modal-body">
                    <div class="ak-modal-hint"><span class="material-symbols-rounded">lightbulb</span><span>Scegli prima la categoria: i tipi suggeriti e il formato del valore si adattano di conseguenza.</span></div>
                    <form id="ct-form" class="ak-form">
                        <input type="hidden" id="ct-id">
                        <div class="ak-form-grid">
                            <div class="ak-field">
                                <label class="ak-flabel" for="ct-categoria">Categoria<span class="ak-req" aria-hidden="true">*</span></label>
                                <div class="ak-inputbox">
                                    <span class="material-symbols-rounded ak-ficon" aria-hidden="true">category</span>
                                    <select id="ct-categoria" class="ak-input" required>
                                        <option value="" disabled selected hidden>Seleziona…</option>
                                        ${CATEGORIE.map(c => `<option value="${c}">${c}</option>`).join('')}
                                    </select>
                                    <span class="material-symbols-rounded ak-fcaret" aria-hidden="true">unfold_more</span>
                                </div>
                                <small class="ak-hint">Il gruppo in cui finirà il contatto.</small>
                            </div>
                            <div class="ak-field">
                                <label class="ak-flabel" for="ct-tipo">Tipo<span class="ak-req" aria-hidden="true">*</span></label>
                                <div class="ak-inputbox">
                                    <span class="material-symbols-rounded ak-ficon" aria-hidden="true">label</span>
                                    <input type="text" id="ct-tipo" class="ak-input" list="ct-tipi-list" placeholder="es. Cellulare, PEC…" required>
                                    <datalist id="ct-tipi-list"></datalist>
                                </div>
                                <small class="ak-hint">Etichetta del recapito.</small>
                            </div>
                            <div class="ak-field" style="grid-column:1/-1;">
                                <label class="ak-flabel" for="ct-valore">Valore<span class="ak-req" aria-hidden="true">*</span></label>
                                <div class="ak-inputbox">
                                    <span class="material-symbols-rounded ak-ficon" aria-hidden="true">alternate_email</span>
                                    <input type="text" id="ct-valore" class="ak-input" placeholder="Numero, email o link…" required>
                                </div>
                                <small class="ak-hint">Il recapito vero e proprio (numero, indirizzo email, URL…).</small>
                            </div>
                            <div class="ak-field" style="grid-column:1/-1;">
                                <label class="ak-flabel" for="ct-note">Note (facoltative)</label>
                                <div class="ak-inputbox">
                                    <span class="material-symbols-rounded ak-ficon" aria-hidden="true">sticky_note_2</span>
                                    <input type="text" id="ct-note" class="ak-input" placeholder="Dettagli aggiuntivi…">
                                </div>
                            </div>
                            <label class="ak-check" for="ct-principale" style="grid-column:1/-1;">
                                <input type="checkbox" id="ct-principale">
                                <span class="ak-check-box" aria-hidden="true"><span class="material-symbols-rounded">check</span></span>
                                <span class="ak-check-text">Contatto principale (preferito)<small class="ak-hint" style="display:block;">Verrà evidenziato con una stella nella rubrica.</small></span>
                            </label>
                        </div>
                        <div id="ct-error" class="ak-error" role="alert"></div>
                        <div class="ak-actions">
                            <button type="button" id="ct-delete" class="ak-btn ak-btn-danger" style="display:none;"><span class="material-symbols-rounded">delete</span>Elimina</button>
                            <button type="button" id="ct-cancel" class="ak-btn ak-btn-ghost">Annulla</button>
                            <button type="submit" id="ct-save" class="ak-btn ak-btn-primary"><span class="material-symbols-rounded">save</span>Salva</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>

        ${AK_STYLES}
        <style>
            .ct-group { margin-bottom: 1.4rem; }
            .ct-group:last-child { margin-bottom: 0; }
            .ct-group-title { font-size: 0.9rem; font-weight: 800; color: var(--md-on-surface); margin: 0 0 0.8rem;
                display: flex; align-items: center; gap: 0.5rem; padding-bottom: 0.5rem; border-bottom: 2px solid var(--md-outline-variant); }
            .ct-group-title .material-symbols-rounded { color: ${TONE.accent}; font-size: 1.15rem; }
            .ct-group-count { font-size: 0.7rem; font-weight: 700; color: var(--md-on-surface-variant);
                background: var(--md-surface-variant); padding: 0.1rem 0.5rem; border-radius: 999px; margin-left: auto; }
            .ct-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 0.85rem; }
            .ct-card { position: relative; background: var(--md-surface-container-lowest); border: 1px solid var(--md-outline-variant);
                border-radius: 14px; padding: 0.85rem 1rem; display: flex; gap: 0.8rem; align-items: center; cursor: pointer;
                transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease; overflow: hidden; }
            .ct-card:hover { transform: translateY(-3px); box-shadow: 0 10px 22px -8px rgba(0,0,0,0.18); border-color: ${TONE.accent}; }
            .ct-card:focus-visible { outline: 3px solid var(--md-outline-focus); outline-offset: 2px; }
            .ct-card .c-icon { width: 40px; height: 40px; border-radius: 12px; background: ${TONE.soft}; color: ${TONE.accent};
                display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
            .ct-card .c-icon .material-symbols-rounded { font-size: 1.2rem; }
            .ct-card .c-content { flex: 1; min-width: 0; }
            .ct-card .c-valore { font-size: 0.92rem; font-weight: 700; color: var(--md-on-surface); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            .ct-card .c-tipo { font-size: 0.78rem; color: var(--md-on-surface-variant); font-weight: 500; }
            .ct-card .c-note { font-size: 0.72rem; color: var(--md-on-surface-variant); opacity: 0.85; margin-top: 0.1rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            .ct-card .c-star { position: absolute; top: 0.5rem; right: 0.5rem; color: #f59e0b; font-size: 1rem; }
        </style>
    `;

    const listBox = el.querySelector('#ct-list');
    const modal = el.querySelector('#ct-modal');
    const form = el.querySelector('#ct-form');
    const errorBox = el.querySelector('#ct-error');
    const titleText = el.querySelector('#ct-modal-title-text');
    const inId = el.querySelector('#ct-id');
    const inCat = el.querySelector('#ct-categoria');
    const inTipo = el.querySelector('#ct-tipo');
    const inVal = el.querySelector('#ct-valore');
    const inPrin = el.querySelector('#ct-principale');
    const inNote = el.querySelector('#ct-note');
    const dlTipi = el.querySelector('#ct-tipi-list');
    const btnDelete = el.querySelector('#ct-delete');
    const countEl = el.querySelector('#ct-count');

    let contatti = [];

    async function load() {
        try {
            contatti = await window.electronAPI.anagrafica.contatti.getByPersona({ personaId: persona.id });
            render();
            if (typeof onChange === 'function') onChange(contatti.length);
        } catch (e) {
            listBox.innerHTML = `<p style="color:var(--md-error); padding:1rem;">Errore: ${e.message}</p>`;
        }
    }

    function cardHtml(c, icon) {
        const star = c.is_principale === 1 ? `<span class="material-symbols-rounded c-star" title="Contatto principale" style="font-variation-settings:'FILL' 1;">star</span>` : '';
        const note = c.note ? `<div class="c-note">${esc(c.note)}</div>` : '';
        return `
            <div class="ct-card" data-id="${esc(c.id)}" tabindex="0" role="button">
                ${star}
                <div class="c-icon"><span class="material-symbols-rounded">${icon}</span></div>
                <div class="c-content">
                    <div class="c-valore">${esc(c.valore)}</div>
                    <div class="c-tipo">${esc(c.tipo)}</div>
                    ${note}
                </div>
            </div>`;
    }

    function render() {
        countEl.textContent = contatti.length;
        if (contatti.length === 0) {
            listBox.innerHTML = `<div class="ak-empty">
                <span class="material-symbols-rounded">contacts</span>
                <h4>Nessun recapito registrato</h4>
                <p>Aggiungi telefono, email, profili social o contatti di emergenza.</p>
            </div>`;
            return;
        }
        const gruppi = {};
        contatti.forEach(c => { const cat = c.categoria || 'Altro'; (gruppi[cat] = gruppi[cat] || []).push(c); });
        const ordine = [...CATEGORIE, ...Object.keys(gruppi).filter(c => !CATEGORIE.includes(c))];
        let html = '';
        for (const cat of ordine) {
            if (!gruppi[cat]) continue;
            const icon = ICONS[cat] || 'contact_mail';
            html += `<div class="ct-group">
                <div class="ct-group-title"><span class="material-symbols-rounded">${icon}</span> ${esc(cat)} <span class="ct-group-count">${gruppi[cat].length}</span></div>
                <div class="ct-grid">${gruppi[cat].map(c => cardHtml(c, icon)).join('')}</div>
            </div>`;
        }
        listBox.innerHTML = html;
        listBox.querySelectorAll('.ct-card').forEach(card => {
            const open = () => { const c = contatti.find(x => x.id === card.getAttribute('data-id')); if (c) openModal(c); };
            card.addEventListener('click', open);
            card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
        });
    }

    function updateDatalist(cat) {
        dlTipi.innerHTML = (TIPI_PER_CATEGORIA[cat] || []).map(t => `<option value="${t}"></option>`).join('');
        if (cat === 'Email') inVal.type = 'email';
        else if (cat === 'Telefono' || cat === 'Emergenza') inVal.type = 'tel';
        else if (cat === 'Web') inVal.type = 'url';
        else inVal.type = 'text';
    }

    function openModal(c = null) {
        errorBox.style.display = 'none';
        if (c) {
            titleText.textContent = 'Modifica Contatto';
            inId.value = c.id; inCat.value = c.categoria; updateDatalist(c.categoria);
            inTipo.value = c.tipo; inVal.value = c.valore; inPrin.checked = c.is_principale === 1; inNote.value = c.note || '';
            btnDelete.style.display = 'inline-flex';
        } else {
            titleText.textContent = 'Nuovo Contatto';
            form.reset(); inId.value = ''; inCat.value = ''; updateDatalist(''); btnDelete.style.display = 'none';
        }
        modal.style.display = 'flex';
        requestAnimationFrame(() => {
            modal.style.opacity = '1';
            modal.querySelector('.ak-modal-card').style.transform = 'scale(1) translateY(0)';
            inCat.focus();
        });
    }
    function closeModal() {
        modal.style.opacity = '0';
        modal.querySelector('.ak-modal-card').style.transform = 'scale(0.95) translateY(10px)';
        setTimeout(() => { modal.style.display = 'none'; }, 250);
    }

    inCat.addEventListener('change', (e) => { updateDatalist(e.target.value); inTipo.value = ''; });
    el.querySelector('#ct-add').addEventListener('click', () => openModal());
    el.querySelector('#ct-cancel').addEventListener('click', closeModal);
    el.querySelector('#ct-close').addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && modal.style.display === 'flex') closeModal(); });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        errorBox.style.display = 'none';
        const btnSave = el.querySelector('#ct-save');
        btnSave.disabled = true;
        try {
            const data = {
                persona_id: persona.id,
                categoria: inCat.value,
                tipo: inTipo.value.trim(),
                valore: inVal.value.trim(),
                is_principale: inPrin.checked,
                note: inNote.value.trim()
            };
            if (inId.value) { data.id = inId.value; await window.electronAPI.anagrafica.contatti.update(data); toast('Contatto aggiornato', 'success'); }
            else { await window.electronAPI.anagrafica.contatti.create(data); toast('Contatto aggiunto', 'success'); }
            closeModal();
            await load();
        } catch (err) {
            errorBox.textContent = err.message || 'Errore salvataggio';
            errorBox.style.display = 'block';
        } finally { btnSave.disabled = false; }
    });

    btnDelete.addEventListener('click', async () => {
        if (!confirm('Sei sicuro di voler eliminare questo contatto?')) return;
        try {
            btnDelete.disabled = true;
            await window.electronAPI.anagrafica.contatti.remove({ id: inId.value });
            toast('Contatto eliminato', 'success');
            closeModal();
            await load();
        } catch (err) {
            errorBox.textContent = err.message || 'Errore eliminazione';
            errorBox.style.display = 'block';
        } finally { btnDelete.disabled = false; }
    });

    load();
}
