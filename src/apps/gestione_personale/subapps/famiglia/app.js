import { renderPersonScopedCrudSubapp } from '../../shared/subapp_crud_kit.js';
import { fmt } from '../../../../js/utils.js';
const FIELDS = [
    { key: 'nome', label: 'Nome', icon: 'person', type: 'text', required: true, span: 1 },
    { key: 'cognome', label: 'Cognome', icon: 'badge', type: 'text', required: true, span: 1 },
    { key: 'codice_fiscale', label: 'Codice Fiscale', icon: 'fingerprint', type: 'text', uppercase: true, span: 2 },
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
    { key: 'note', label: 'Note', icon: 'edit_note', type: 'textarea', full: true }
];
export default {
    render: async (el) => {
        try {
            renderPersonScopedCrudSubapp(el, {
                title: 'Unità Familiare',
                subtitle: 'Gestisci i membri del nucleo familiare collegati alla persona',
                icon: 'family_restroom',
                tone: 'pink',
                newLabel: 'Nuovo Familiare',
                tableName: 'familiari',
                emptyLabel: 'Nessun familiare registrato per questa persona.',
                api: {
                    getByPersona: window.electronAPI.anagrafica.familiari.getByPersona,
                    create: window.electronAPI.anagrafica.familiari.create,
                    update: window.electronAPI.anagrafica.familiari.update,
                    remove: window.electronAPI.anagrafica.familiari.remove
                },
                fields: FIELDS,
                cardTitle: (r) => `${r.nome} ${r.cognome}`,
                cardSubtitle: (r) => r.grado_parentela,
                cardMeta: (r) => r.data_nascita ? `Nato/a il ${fmt.data(r.data_nascita)}` : '',
                cardBadge: (r) => r.is_a_carico ? 'A carico' : null
            });
        } catch (e) {
            console.error(e);
        }
    }
};
