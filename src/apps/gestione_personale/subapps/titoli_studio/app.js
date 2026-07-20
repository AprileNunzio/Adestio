import { renderPersonScopedCrudSubapp } from '../../shared/subapp_crud_kit.js';
import { fmt } from '../../../../js/utils.js';
const TIPI_TITOLO = ['Licenza Media', 'Diploma di Qualifica', 'Diploma di Maturità', 'Laurea Triennale', 'Laurea Magistrale', 'Laurea Vecchio Ordinamento', 'Master', 'Dottorato', 'Abilitazione', 'Altro'];
export default {
    render: async (el) => {
        renderPersonScopedCrudSubapp(el, {
            title: 'Titoli di Studio',
            subtitle: 'Titoli e qualifiche della persona selezionata',
            icon: 'school',
            tone: 'violet',
            newLabel: 'Nuovo Titolo',
            tableName: 'titoli_studio',
            emptyLabel: 'Nessun titolo di studio registrato per questa persona.',
            api: {
                getByPersona: window.electronAPI.anagrafica.titoliStudio.getByPersona,
                create: window.electronAPI.anagrafica.titoliStudio.create,
                update: window.electronAPI.anagrafica.titoliStudio.update,
                remove: window.electronAPI.anagrafica.titoliStudio.remove
            },
            fields: [
                { key: 'denominazione', label: 'Denominazione Titolo', icon: 'workspace_premium', type: 'text', span: 2, required: true, datalist: { table: 'titoli_studio', column: 'denominazione' } },
                { key: 'tipo', label: 'Tipo di Titolo', icon: 'category', type: 'select', options: TIPI_TITOLO.map(v => ({ value: v, label: v })) },
                { key: 'votazione', label: 'Votazione', icon: 'grade', type: 'text', datalist: { table: 'titoli_studio', column: 'votazione' } },
                { key: 'istituto_rilascio', label: 'Istituto / Università', icon: 'account_balance', type: 'text', span: 2, datalist: { table: 'titoli_studio', column: 'istituto_rilascio' } },
                { key: 'citta_istituto', label: 'Città Istituto', icon: 'location_city', type: 'text', datalist: { table: 'titoli_studio', column: 'citta_istituto' } },
                { key: 'data_conseguimento', label: 'Data Conseguimento', icon: 'event', type: 'date' },
                { key: 'is_principale', label: 'Titolo principale', type: 'checkbox', default: 0, full: true }
            ],
            cardTitle: (r) => r.denominazione,
            cardSubtitle: (r) => [r.tipo, r.votazione].filter(Boolean).join(' · '),
            cardMeta: (r) => [r.istituto_rilascio, r.data_conseguimento ? fmt.data(r.data_conseguimento) : ''].filter(Boolean).join(' · '),
            cardBadge: (r) => r.is_principale ? 'Principale' : null
        });
    }
};
