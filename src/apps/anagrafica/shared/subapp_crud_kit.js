import { toast } from '../../../js/utils.js';
import { mountPersonaPicker } from './persona_picker.js';
import { mountAuditButton } from './audit_trail_button.js';
import { populateProvinceDatalist, populateNazioniDatalist, populateSuggestionDatalist, populateComuniDatalist, getComuniCache } from './riferimenti.js';
import { TONI, heroHtml, guidaHtml, campoHtml, leggiCampo, AK_STYLES } from './ui_kit.js';
function populateFieldDatalists(el, fields) {
    fields.forEach(field => {
        if (!field.datalist) return;
        const datalistEl = el.querySelector(`#dl-${field.key}`);
        if (!datalistEl) return;
        if (field.datalist === 'province') populateProvinceDatalist(datalistEl);
        else if (field.datalist === 'nazioni') populateNazioniDatalist(datalistEl);
        else if (field.datalist === 'comuni') populateComuniDatalist(datalistEl);
        else populateSuggestionDatalist(datalistEl, field.datalist.table, field.datalist.column);
    });
}
export function renderPersonScopedCrudSubapp(el, config) {
    const {
        title, subtitle, icon, tone = 'blue', api, fields, newLabel, emptyLabel,
        cardTitle, cardSubtitle, cardMeta, cardBadge, fixedPersona, tableName,
        instructions, modalHint
    } = config;
    const toneObj = TONI[tone] || TONI.blue;
    el.innerHTML = `
        <div class="fade-in-up ak-root">
            ${heroHtml({
                title, subtitle, icon, tone,
                actionsHtml: `<button id="crud-kit-btn-new" class="ak-hero-btn"><span class="material-symbols-rounded">add</span>${newLabel}</button>`
            })}
            ${instructions ? guidaHtml({ intro: instructions.intro, steps: instructions.steps, tone }) : ''}
            ${fixedPersona ? '' : `<div class="ak-panel" style="flex:none;"><div class="ak-panel-body" id="crud-kit-picker"></div></div>`}
            <section id="crud-kit-records" class="ak-panel" style="display:none;">
                <div class="ak-toolbar">
                    <h3>Elenco <span class="ak-count" id="crud-kit-count">0</span></h3>
                </div>
                <div class="ak-panel-body" id="crud-kit-grid"></div>
            </section>
        </div>
        <div id="crud-kit-modal" class="ak-modal" style="--ak-accent:${toneObj.accent}; --ak-soft:${toneObj.soft};" role="dialog" aria-modal="true" aria-labelledby="crud-kit-modal-title">
            <div class="ak-modal-card">
                <div class="ak-modal-head">
                    <h3 id="crud-kit-modal-title"><span class="material-symbols-rounded">${icon || toneObj.icon}</span><span id="crud-kit-modal-title-text"></span></h3>
                    <button id="crud-kit-btn-close" class="ak-iconbtn" aria-label="Chiudi finestra"><span class="material-symbols-rounded">close</span></button>
                </div>
                <div class="ak-modal-body">
                    ${modalHint ? `<div class="ak-modal-hint"><span class="material-symbols-rounded">lightbulb</span><span>${modalHint}</span></div>` : ''}
                    <form id="crud-kit-form" class="ak-form">
                        <input type="hidden" id="crud-field-id">
                        <div id="crud-kit-form-fields" class="ak-form-grid"></div>
                        <div id="crud-kit-modal-error" class="ak-error" role="alert"></div>
                        <div class="ak-actions">
                            <button type="button" id="crud-kit-btn-cancel" class="ak-btn ak-btn-ghost">Annulla</button>
                            <button type="submit" id="crud-kit-btn-save" class="ak-btn ak-btn-primary"><span class="material-symbols-rounded">save</span>Salva</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
        ${AK_STYLES}
    `;
    const recordsSection = el.querySelector('#crud-kit-records');
    const grid = el.querySelector('#crud-kit-grid');
    const countEl = el.querySelector('#crud-kit-count');
    const modal = el.querySelector('#crud-kit-modal');
    const form = el.querySelector('#crud-kit-form');
    const modalError = el.querySelector('#crud-kit-modal-error');
    const formFieldsBox = el.querySelector('#crud-kit-form-fields');
    let currentPersona = null;
    let records = [];
    formFieldsBox.innerHTML = fields.map(f => campoHtml(f, '')).join('');
    populateFieldDatalists(el, fields);
    // Auto-compilazione Provincia/CAP dal Comune
    fields.forEach(f => {
        if (f.datalist === 'comuni') {
            const input = el.querySelector(`#crud-field-${f.key}`);
            if (input) {
                input.addEventListener('change', () => {
                    const cache = getComuniCache();
                    const val = input.value.trim().toLowerCase();
                    const comune = cache.find(c => c.n.toLowerCase() === val);
                    if (comune) {
                        const provInput = el.querySelector('#crud-field-provincia');
                        if (provInput) provInput.value = comune.p;
                        const capInput = el.querySelector('#crud-field-cap');
                        if (capInput) capInput.value = comune.c;
                    }
                });
            }
        }
    });
    function renderRecords() {
        countEl.textContent = records.length;
        if (records.length === 0) {
            grid.innerHTML = `<div class="ak-empty">
                <span class="material-symbols-rounded">${icon || toneObj.icon}</span>
                <h4>Ancora niente qui</h4>
                <p>${emptyLabel || 'Nessun elemento registrato.'}</p>
            </div>`;
            return;
        }
        grid.innerHTML = `<div class="ak-cards">${records.map(r => `
            <div class="ak-card fade-in-up" style="--ak-accent:${toneObj.accent};">
                ${cardBadge && cardBadge(r) ? `<span class="ak-card-badge">${cardBadge(r)}</span>` : ''}
                <div class="ak-card-title">${cardTitle(r)}</div>
                ${cardSubtitle && cardSubtitle(r) ? `<div class="ak-card-sub">${cardSubtitle(r)}</div>` : ''}
                ${cardMeta && cardMeta(r) ? `<div class="ak-card-meta"><span class="material-symbols-rounded" style="font-size:1rem;">info</span>${cardMeta(r)}</div>` : ''}
                <div class="ak-card-actions">
                    <div class="crud-kit-audit-mount" data-id="${r.id}"></div>
                    <button class="ak-iconbtn crud-kit-btn-edit" data-id="${r.id}" title="Modifica" aria-label="Modifica"><span class="material-symbols-rounded">edit</span></button>
                    <button class="ak-iconbtn danger crud-kit-btn-delete" data-id="${r.id}" title="Elimina" aria-label="Elimina"><span class="material-symbols-rounded">delete</span></button>
                </div>
            </div>
        `).join('')}</div>`;
        if (tableName) {
            grid.querySelectorAll('.crud-kit-audit-mount').forEach(mount => {
                const record = records.find(r => r.id === mount.getAttribute('data-id'));
                mountAuditButton(mount, { tableName, recordId: mount.getAttribute('data-id'), label: record ? cardTitle(record) : '' });
            });
        }
        grid.querySelectorAll('.crud-kit-btn-edit').forEach(btn => {
            btn.addEventListener('click', () => {
                const record = records.find(r => r.id === btn.getAttribute('data-id'));
                if (record) openModal(record);
            });
        });
        grid.querySelectorAll('.crud-kit-btn-delete').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (!confirm('Sei sicuro di voler eliminare questo elemento? L\'operazione non è reversibile.')) return;
                try {
                    await api.remove({ id: btn.getAttribute('data-id') });
                    toast('Eliminato con successo', 'success');
                    await loadRecords();
                } catch (e) {
                    toast(e.message || "Errore durante l'eliminazione", 'error');
                }
            });
        });
    }
    async function loadRecords() {
        try {
            records = await api.getByPersona({ personaId: currentPersona.id });
            renderRecords();
        } catch (e) {
            grid.innerHTML = `<p style="color:var(--md-error); text-align:center; padding:2rem;">Errore caricamento: ${e.message}</p>`;
        }
    }
    function openModal(record = null) {
        modalError.style.display = 'none';
        el.querySelector('#crud-kit-modal-title-text').textContent = record ? 'Modifica' : newLabel;
        el.querySelector('#crud-field-id').value = record ? record.id : '';
        fields.forEach(f => {
            const input = el.querySelector(`#crud-field-${f.key}`);
            if (!input) return;
            const value = record ? record[f.key] : (f.default !== undefined ? f.default : '');
            if (f.type === 'checkbox') input.checked = !!value;
            else input.value = value === undefined || value === null ? '' : value;
        });
        modal.style.display = 'flex';
        requestAnimationFrame(() => {
            modal.style.opacity = '1';
            modal.querySelector('.ak-modal-card').style.transform = 'scale(1) translateY(0)';
            const first = form.querySelector('input:not([type=hidden]), select, textarea');
            if (first) first.focus();
        });
    }
    function closeModal() {
        modal.style.opacity = '0';
        modal.querySelector('.ak-modal-card').style.transform = 'scale(0.95) translateY(10px)';
        setTimeout(() => { modal.style.display = 'none'; }, 250);
    }
    el.querySelector('#crud-kit-btn-new').addEventListener('click', () => openModal());
    el.querySelector('#crud-kit-btn-close').addEventListener('click', closeModal);
    el.querySelector('#crud-kit-btn-cancel').addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && modal.style.display === 'flex') closeModal(); });
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        modalError.style.display = 'none';
        const btnSave = el.querySelector('#crud-kit-btn-save');
        btnSave.disabled = true;
        try {
            const id = el.querySelector('#crud-field-id').value;
            const data = { persona_id: currentPersona.id };
            fields.forEach(f => { data[f.key] = leggiCampo(el, f); });
            if (id) {
                data.id = id;
                await api.update(data);
            } else {
                await api.create(data);
            }
            toast('Salvato con successo', 'success');
            closeModal();
            await loadRecords();
        } catch (e) {
            modalError.textContent = e.message || 'Errore durante il salvataggio.';
            modalError.style.display = 'block';
        } finally {
            btnSave.disabled = false;
        }
    });
    if (fixedPersona) {
        currentPersona = fixedPersona;
        recordsSection.style.display = 'flex';
        loadRecords();
    } else {
        mountPersonaPicker(el.querySelector('#crud-kit-picker'), {
            onSelect: async (persona) => {
                currentPersona = persona;
                recordsSection.style.display = 'flex';
                await loadRecords();
            }
        });
    }
}
