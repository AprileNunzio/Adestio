import { renderPersonScopedCrudSubapp } from '../../shared/subapp_crud_kit.js';
import { resolveCurrentPersona } from '../../shared/current_persona.js';
import { fmt } from '../../../../js/utils.js';
const TIPI_TITOLO = ['Licenza Media', 'Diploma di Qualifica', 'Diploma di Maturità', 'Laurea Triennale', 'Laurea Magistrale', 'Laurea Vecchio Ordinamento', 'Master', 'Dottorato', 'Abilitazione', 'Altro'];
export default {
    render: async (el) => {
        const persona = await resolveCurrentPersona();
        if (!persona) {
            el.innerHTML = '<p style="text-align:center; color:var(--md-on-surface-variant); padding:2rem;">Completa prima la sezione "I Miei Dati" per poter registrare i tuoi titoli di studio.</p>';
            return;
        }
        renderPersonScopedCrudSubapp(el, {
            title: 'Titoli di Studio',
            subtitle: 'I titoli e le qualifiche che hai conseguito',
            icon: 'school',
            tone: 'violet',
            newLabel: 'Nuovo Titolo',
            tableName: 'titoli_studio',
            emptyLabel: 'Aggiungi i tuoi titoli di studio: sono richiesti per la presa di servizio e le pratiche amministrative.',
            fixedPersona: persona,
            instructions: {
                intro: 'Registra i titoli di studio conseguiti. Indica come "principale" quello più elevato o rilevante per il tuo profilo professionale.',
                steps: [
                    'Premi <strong>“Nuovo Titolo”</strong> in alto a destra.',
                    'Inserisci la <strong>denominazione</strong> del titolo e il <strong>tipo</strong>.',
                    'Indica <strong>istituto</strong>, <strong>città</strong>, <strong>data</strong> e <strong>votazione</strong>.',
                    'Spunta <strong>“Titolo principale”</strong> per quello da usare di default nei documenti.'
                ]
            },
            api: {
                getByPersona: window.electronAPI.anagrafica.titoliStudio.getByPersona,
                create: window.electronAPI.anagrafica.titoliStudio.create,
                update: window.electronAPI.anagrafica.titoliStudio.update,
                remove: window.electronAPI.anagrafica.titoliStudio.remove
            },
            fields: [
                { key: 'denominazione', label: 'Denominazione Titolo', icon: 'workspace_premium', type: 'text', span: 2, required: true, datalist: { table: 'titoli_studio', column: 'denominazione' }, hint: 'Es. Diploma di Ragioniere, Laurea in Giurisprudenza.' },
                { key: 'tipo', label: 'Tipo di Titolo', icon: 'category', type: 'select', options: TIPI_TITOLO.map(v => ({ value: v, label: v })), hint: 'Livello del titolo conseguito.' },
                { key: 'votazione', label: 'Votazione', icon: 'grade', type: 'text', datalist: { table: 'titoli_studio', column: 'votazione' }, hint: 'Es. 100/100, 110/110 e lode.' },
                { key: 'istituto_rilascio', label: 'Istituto / Università', icon: 'account_balance', type: 'text', span: 2, datalist: { table: 'titoli_studio', column: 'istituto_rilascio' }, hint: 'Ente che ha rilasciato il titolo.' },
                { key: 'citta_istituto', label: 'Città Istituto', icon: 'location_city', type: 'text', datalist: { table: 'titoli_studio', column: 'citta_istituto' }, hint: 'Città dell\'istituto.' },
                { key: 'data_conseguimento', label: 'Data Conseguimento', icon: 'event', type: 'date', hint: 'Quando hai conseguito il titolo.' },
                { key: 'is_principale', label: 'Titolo principale', type: 'checkbox', default: 0, full: true, hint: 'Il titolo da usare di default nelle pratiche.' }
            ],
            cardTitle: (r) => r.denominazione,
            cardSubtitle: (r) => [r.tipo, r.votazione].filter(Boolean).join(' · '),
            cardMeta: (r) => [r.istituto_rilascio, r.data_conseguimento ? fmt.data(r.data_conseguimento) : ''].filter(Boolean).join(' · '),
            cardBadge: (r) => r.is_principale ? 'Principale' : null
        });
    }
};
