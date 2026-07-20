import { initCrudSubapp } from '../../shared/subapp_crud_kit.js';

const TONE = { accent: '#ec4899', soft: 'rgba(236, 72, 153, 0.1)', icon: 'family_restroom' };

const FIELDS = [
    { key: 'nome', label: 'Nome', icon: 'person', type: 'text', required: true, full: true },
    { key: 'cognome', label: 'Cognome', icon: 'badge', type: 'text', required: true, full: true },
    { key: 'codice_fiscale', label: 'Codice Fiscale', icon: 'fingerprint', type: 'text', uppercase: true, full: true },
    { key: 'sesso', label: 'Sesso', icon: 'wc', type: 'select', options: [
        { value: '', label: 'Seleziona...' },
        { value: 'M', label: 'Maschio' },
        { value: 'F', label: 'Femmina' },
        { value: 'Altro', label: 'Altro' }
    ] },
    { key: 'data_nascita', label: 'Data di Nascita', icon: 'cake', type: 'date' },
    { key: 'grado_parentela', label: 'Grado di Parentela', icon: 'diversity_1', type: 'select', required: true, options: [
        { value: '', label: 'Seleziona...' },
        { value: 'Coniuge', label: 'Coniuge' },
        { value: 'Figlio/a', label: 'Figlio/a' },
        { value: 'Genitore', label: 'Genitore' },
        { value: 'Fratello/Sorella', label: 'Fratello/Sorella' },
        { value: 'Nonno/a', label: 'Nonno/a' },
        { value: 'Nipote', label: 'Nipote' },
        { value: 'Suocero/a', label: 'Suocero/a' },
        { value: 'Altro', label: 'Altro' }
    ] },
    { key: 'is_a_carico', label: 'Familiare a carico', icon: 'payments', type: 'checkbox', hint: 'Spunta se il familiare è a carico fiscalmente' },
    { key: 'note', label: 'Note (Opzionale)', icon: 'edit_note', type: 'textarea', full: true }
];

function renderFamiliare(item) {
    const aCarico = item.is_a_carico ? '<span class="ak-badge" style="background:#ec4899; color:white; font-size:10px; margin-left:8px;">A CARICO</span>' : '';
    const cfStr = item.codice_fiscale ? `<div style="font-size:12px; color:var(--text-secondary); margin-top:2px; font-family:monospace;">${item.codice_fiscale}</div>` : '';
    const nascitaStr = item.data_nascita ? `<span style="margin-left: 8px;">(Nato/a il ${item.data_nascita.split('-').reverse().join('/')})</span>` : '';
    
    return `
        <div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
            <div>
                <div style="font-weight:600; font-size:14px; color:var(--text-main); display:flex; align-items:center;">
                    ${item.nome} ${item.cognome} ${aCarico}
                </div>
                ${cfStr}
            </div>
            <div style="text-align:right;">
                <div style="font-weight:500; font-size:13px; color:var(--text-main);">${item.grado_parentela}</div>
                <div style="font-size:12px; color:var(--text-secondary);">${nascitaStr}</div>
            </div>
        </div>
    `;
}

export function initFamigliaSubapp(container, currentPersona, config = {}) {
    return initCrudSubapp(container, currentPersona, {
        ...config,
        title: 'Unità Familiare',
        tone: TONE,
        fields: FIELDS,
        apiNamespace: 'familiari',
        renderItem: renderFamiliare,
        sortRecords: (a, b) => {
            const ordini = { 'Coniuge': 1, 'Figlio/a': 2, 'Genitore': 3 };
            const ordA = ordini[a.grado_parentela] || 99;
            const ordB = ordini[b.grado_parentela] || 99;
            if (ordA !== ordB) return ordA - ordB;
            if (a.data_nascita && b.data_nascita) {
                return new Date(b.data_nascita) - new Date(a.data_nascita);
            }
            return 0;
        }
    });
}
