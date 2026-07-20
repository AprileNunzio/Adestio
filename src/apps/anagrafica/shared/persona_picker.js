import { toast } from '../../../js/utils.js';
import { isValidCodiceFiscale } from './validators.js';
export function mountPersonaPicker(container, options = {}) {
    const { onSelect, allowCreateInline = true, initialPersona = null } = options;
    container.innerHTML = `
        <div class="persona-picker">
            <div class="premium-input-group" id="persona-picker-search-group">
                <span class="material-symbols-rounded icon">search</span>
                <input type="text" class="premium-input" id="persona-picker-input" placeholder="Cerca persona per nome, cognome o codice fiscale...">
            </div>
            <div id="persona-picker-results" class="persona-picker-results"></div>
            <div id="persona-picker-selected" class="persona-picker-selected" style="display:none;"></div>
        </div>
        <style>
            .persona-picker { width: 100%; position: relative; }
            .persona-picker-results { position: relative; margin-top: 0.5rem; display: flex; flex-direction: column; gap: 0.5rem; }
            .persona-picker-item {
                display: flex; align-items: center; gap: 0.8rem;
                padding: 0.8rem 1rem; border-radius: var(--shape-md);
                border: 1px solid var(--md-outline-variant);
                background: var(--md-surface); cursor: pointer; transition: all 0.2s;
            }
            .persona-picker-item:hover { border-color: var(--md-primary); background: var(--md-primary-container); }
            .persona-picker-item-icon {
                width: 36px; height: 36px; border-radius: var(--shape-sm); flex-shrink: 0;
                background: var(--md-secondary-container); color: var(--md-on-secondary-container);
                display: flex; align-items: center; justify-content: center;
            }
            .persona-picker-item-name { font-weight: 600; color: var(--md-on-surface); }
            .persona-picker-item-cf { font-size: 0.8rem; color: var(--md-on-surface-variant); letter-spacing: 0.5px; }
            .persona-picker-empty { display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap; padding: 0.8rem 1rem; color: var(--md-on-surface-variant); font-size: 0.9rem; }
            .persona-picker-selected { display: flex; }
            .persona-picker-chip {
                display: flex; align-items: center; gap: 0.8rem; width: 100%;
                padding: 1rem; border-radius: var(--shape-lg); border: 1px solid var(--md-primary);
                background: var(--md-primary-container);
            }
            .persona-picker-chip .material-symbols-rounded { color: var(--md-on-primary-container); }
            .persona-picker-chip-name { font-weight: 700; color: var(--md-on-primary-container); }
            .persona-picker-chip-cf { font-size: 0.8rem; color: var(--md-on-primary-container); opacity: 0.8; letter-spacing: 0.5px; }
            .persona-picker-create-form { display: flex; flex-direction: column; gap: 0.6rem; padding: 1rem; border-radius: var(--shape-md); border: 1px dashed var(--md-outline); }
        </style>
    `;
    const input = container.querySelector('#persona-picker-input');
    const searchGroup = container.querySelector('#persona-picker-search-group');
    const results = container.querySelector('#persona-picker-results');
    const selectedBox = container.querySelector('#persona-picker-selected');
    let debounceTimer = null;
    let selectedPersona = null;
    function renderSelected(persona) {
        selectedPersona = persona;
        searchGroup.style.display = 'none';
        results.innerHTML = '';
        selectedBox.style.display = 'flex';
        selectedBox.innerHTML = `
            <div class="persona-picker-chip">
                <span class="material-symbols-rounded">person</span>
                <div style="flex:1;">
                    <div class="persona-picker-chip-name">${persona.cognome} ${persona.nome}</div>
                    <div class="persona-picker-chip-cf">${persona.codice_fiscale || 'Codice Fiscale non specificato'}</div>
                </div>
                <button type="button" id="persona-picker-change" class="btn-icon-action" title="Cambia persona">
                    <span class="material-symbols-rounded">swap_horiz</span>
                </button>
            </div>
        `;
        selectedBox.querySelector('#persona-picker-change').addEventListener('click', () => {
            selectedPersona = null;
            searchGroup.style.display = 'block';
            selectedBox.style.display = 'none';
            input.value = '';
            results.innerHTML = '';
            input.focus();
        });
        if (typeof onSelect === 'function') onSelect(persona);
    }
    function renderResults(list, query) {
        if (list.length === 0) {
            results.innerHTML = `<div class="persona-picker-empty"><span>Nessuna persona trovata.</span>${allowCreateInline ? '<button type="button" id="persona-picker-create-new" class="btn btn-primary" style="padding:0.5rem 1rem; border-radius:var(--shape-full);">Crea nuova persona</button>' : ''}</div>`;
            if (allowCreateInline) {
                results.querySelector('#persona-picker-create-new').addEventListener('click', () => openInlineCreate(query));
            }
            return;
        }
        results.innerHTML = list.map(p => `
            <div class="persona-picker-item" data-id="${p.id}">
                <div class="persona-picker-item-icon"><span class="material-symbols-rounded">person</span></div>
                <div>
                    <div class="persona-picker-item-name">${p.cognome} ${p.nome}</div>
                    <div class="persona-picker-item-cf">${p.codice_fiscale || ''}</div>
                </div>
            </div>
        `).join('');
        results.querySelectorAll('.persona-picker-item').forEach(item => {
            item.addEventListener('click', () => {
                const persona = list.find(p => p.id === item.getAttribute('data-id'));
                if (persona) renderSelected(persona);
            });
        });
    }
    function openInlineCreate(prefillQuery) {
        const parts = (prefillQuery || '').trim().split(/\s+/);
        const guessedNome = parts.length > 1 ? parts.slice(1).join(' ') : '';
        const guessedCognome = parts.length > 0 ? parts[0] : '';
        results.innerHTML = `
            <div class="persona-picker-create-form">
                <div class="premium-input-group">
                    <span class="material-symbols-rounded icon">badge</span>
                    <input type="text" id="persona-picker-new-cognome" class="premium-input" placeholder="Cognome" value="${guessedCognome}">
                </div>
                <div class="premium-input-group">
                    <span class="material-symbols-rounded icon">badge</span>
                    <input type="text" id="persona-picker-new-nome" class="premium-input" placeholder="Nome" value="${guessedNome}">
                </div>
                <div class="premium-input-group">
                    <span class="material-symbols-rounded icon">fingerprint</span>
                    <input type="text" id="persona-picker-new-cf" class="premium-input" placeholder="Codice Fiscale (obbligatorio, è la chiave univoca)" style="text-transform: uppercase;">
                </div>
                <div style="display:flex; gap:0.6rem; justify-content:flex-end;">
                    <button type="button" id="persona-picker-cancel-new" class="btn" style="background:transparent; border:none; color:var(--md-on-surface-variant); cursor:pointer;">Annulla</button>
                    <button type="button" id="persona-picker-save-new" class="btn btn-primary" style="padding:0.6rem 1.2rem; border-radius:var(--shape-full);">Salva Persona</button>
                </div>
            </div>
        `;
        results.querySelector('#persona-picker-cancel-new').addEventListener('click', () => { results.innerHTML = ''; });
        results.querySelector('#persona-picker-save-new').addEventListener('click', async () => {
            const cognome = results.querySelector('#persona-picker-new-cognome').value.trim();
            const nome = results.querySelector('#persona-picker-new-nome').value.trim();
            const codiceFiscale = results.querySelector('#persona-picker-new-cf').value.trim().toUpperCase();
            if (!nome || !cognome) { toast('Nome e Cognome sono obbligatori', 'error'); return; }
            if (!codiceFiscale || !isValidCodiceFiscale(codiceFiscale)) { toast('Codice Fiscale obbligatorio e deve essere valido', 'error'); return; }
            try {
                const res = await window.electronAPI.anagrafica.persone.create({ nome, cognome, codice_fiscale: codiceFiscale });
                const persona = await window.electronAPI.anagrafica.persone.getById({ id: res.id });
                toast('Persona creata con successo', 'success');
                renderSelected(persona);
            } catch (e) {
                toast(e.message || 'Errore durante la creazione della persona', 'error');
            }
        });
    }
    input.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        const query = input.value.trim();
        if (query.length < 2) { results.innerHTML = ''; return; }
        debounceTimer = setTimeout(async () => {
            try {
                const found = await window.electronAPI.anagrafica.persone.search({ query });
                renderResults(found, query);
            } catch (e) {
                toast('Errore durante la ricerca: ' + e.message, 'error');
            }
        }, 300);
    });
    if (initialPersona) renderSelected(initialPersona);
    return {
        getSelected: () => selectedPersona,
        reset: () => {
            selectedPersona = null;
            searchGroup.style.display = 'block';
            selectedBox.style.display = 'none';
            input.value = '';
            results.innerHTML = '';
        }
    };
}
