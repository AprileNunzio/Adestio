import { populateProvinceDatalist, populateNazioniDatalist, populateComuniDatalist, getComuniCache } from './riferimenti.js';
import { campoHtml, toISODate } from './ui_kit.js';
export const STATI_CIVILI = ['Celibe/Nubile', 'Coniugato/a', 'Divorziato/a', 'Vedovo/a', 'Unione civile'];
const P = 'persona-';
const CAMPI_IDENTITA = [
    { key: 'cognome', label: 'Cognome', icon: 'badge', type: 'text', required: true, hint: 'Il tuo cognome, come sui documenti.' },
    { key: 'nome', label: 'Nome', icon: 'person', type: 'text', required: true, hint: 'Il tuo nome di battesimo.' },
    { key: 'cf', label: 'Codice Fiscale', icon: 'fingerprint', type: 'text', required: true, uppercase: true, full: true, hint: 'Chiave univoca della persona: una volta salvato non è più modificabile.' },
    { key: 'sesso', label: 'Sesso', icon: 'wc', type: 'select', required: true, hint: 'Come indicato sui documenti.', options: [
        { value: 'M', label: 'Maschio' }, { value: 'F', label: 'Femmina' }, { value: 'Altro', label: 'Altro' }
    ] },
    { key: 'stato-civile', label: 'Stato Civile', icon: 'favorite', type: 'select', required: true, hint: 'La tua situazione familiare attuale.', options: STATI_CIVILI.map(s => ({ value: s, label: s })) }
];
const CAMPI_NASCITA = [
    { key: 'data-nascita', label: 'Data di Nascita', icon: 'cake', type: 'date', required: true, hint: 'Giorno, mese e anno di nascita.' },
    { key: 'luogo-nascita', label: 'Luogo di Nascita', icon: 'location_on', type: 'text', datalist: true, hint: 'Comune di nascita: Provincia e CAP automatici.' },
    { key: 'provincia-nascita', label: 'Provincia', icon: 'map', type: 'text', uppercase: true, datalist: true, hint: 'Sigla (es. RM). Suggerita in automatico.' },
    { key: 'cap-nascita', label: 'CAP di Nascita', icon: 'markunread_mailbox', type: 'text', datalist: true, hint: 'Codice postale.' },
    { key: 'cittadinanza', label: 'Cittadinanza', icon: 'flag', type: 'text', datalist: true, hint: 'La tua nazionalità (es. Italiana).' }
];
function sectionHtml(icon, title, tone, campi) {
    return `
        <div class="ak-section" style="--ak-accent:${tone.accent}; --ak-soft:${tone.soft};">
            <div class="ak-section-head">
                <div class="ak-section-icon"><span class="material-symbols-rounded">${icon}</span></div>
                <h3 class="ak-section-title">${title}</h3>
            </div>
            <div class="ak-form-grid">
                ${campi.map(f => campoHtml(f, '', P)).join('')}
            </div>
        </div>
    `;
}
export function personaFormHtml() {
    const blue = { accent: '#2563eb', soft: 'rgba(37,99,235,0.10)' };
    const teal = { accent: '#0f766e', soft: 'rgba(15,118,110,0.10)' };
    return `
        <input type="hidden" id="persona-id">
        <div class="ak-form-sections-grid">
            ${sectionHtml('badge', 'Identità', blue, CAMPI_IDENTITA)}
            ${sectionHtml('public', 'Nascita e Cittadinanza', teal, CAMPI_NASCITA)}
        </div>
    `;
}
export function readPersonaForm(el) {
    return {
        cognome: el.querySelector('#persona-cognome').value.trim(),
        nome: el.querySelector('#persona-nome').value.trim(),
        codice_fiscale: el.querySelector('#persona-cf').value.trim().toUpperCase(),
        sesso: el.querySelector('#persona-sesso').value,
        data_nascita: el.querySelector('#persona-data-nascita').value,
        luogo_nascita: el.querySelector('#persona-luogo-nascita').value.trim(),
        provincia_nascita: el.querySelector('#persona-provincia-nascita').value.trim().toUpperCase(),
        cap_nascita: el.querySelector('#persona-cap-nascita') ? el.querySelector('#persona-cap-nascita').value.trim() : '',
        cittadinanza: el.querySelector('#persona-cittadinanza').value.trim(),
        stato_civile: el.querySelector('#persona-stato-civile').value
    };
}
export function populatePersonaFormDatalists(el) {
    populateProvinceDatalist(el.querySelector('#dl-provincia-nascita'));
    populateNazioniDatalist(el.querySelector('#dl-cittadinanza'));
    populateComuniDatalist(el.querySelector('#dl-luogo-nascita'));
    const inputLuogoNascita = el.querySelector('#persona-luogo-nascita');
    if (inputLuogoNascita) {
        inputLuogoNascita.addEventListener('input', () => {
            const cache = getComuniCache();
            const val = inputLuogoNascita.value.trim().toLowerCase();
            const comune = cache.find(c => c.n.toLowerCase() === val);
            if (comune) {
                const provInput = el.querySelector('#persona-provincia-nascita');
                if (provInput) provInput.value = comune.p;
                const capInput = el.querySelector('#persona-cap-nascita');
                if (capInput) capInput.value = comune.c;
            }
        });
    }
}
export function fillPersonaForm(el, persona) {
    const cfInput = el.querySelector('#persona-cf');
    el.querySelector('#persona-id').value = persona ? persona.id : '';
    el.querySelector('#persona-cognome').value = persona ? persona.cognome : '';
    el.querySelector('#persona-nome').value = persona ? persona.nome : '';
    cfInput.value = persona ? persona.codice_fiscale : '';
    cfInput.disabled = !!persona;
    cfInput.title = persona ? 'Il Codice Fiscale è la chiave univoca della persona e non può essere modificato' : '';
    el.querySelector('#persona-sesso').value = persona ? persona.sesso : '';
    el.querySelector('#persona-data-nascita').value = persona ? toISODate(persona.data_nascita) : '';
    el.querySelector('#persona-luogo-nascita').value = persona ? persona.luogo_nascita : '';
    el.querySelector('#persona-provincia-nascita').value = persona ? persona.provincia_nascita : '';
    if (el.querySelector('#persona-cap-nascita')) el.querySelector('#persona-cap-nascita').value = persona ? (persona.cap_nascita || '') : '';
    el.querySelector('#persona-cittadinanza').value = persona ? persona.cittadinanza : '';
    el.querySelector('#persona-stato-civile').value = persona ? persona.stato_civile : '';
}
/* Retro-compatibilità: alcuni moduli importano ancora KIT_STYLES.
   Gli stili ora vivono in ui_kit.js (AK_STYLES), quindi qui è una stringa vuota. */
export const KIT_STYLES = '';
