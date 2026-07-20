import { renderPersonScopedCrudSubapp } from '../../shared/subapp_crud_kit.js';
const TIPI_INDIRIZZO = { residenza: 'Residenza', domicilio: 'Domicilio' };
export default {
    render: async (el) => {
        renderPersonScopedCrudSubapp(el, {
            title: 'Residenza e Domicilio',
            subtitle: 'Indirizzi di residenza e domicilio della persona selezionata, con storico',
            newLabel: 'Nuovo Indirizzo',
            tableName: 'indirizzi',
            emptyLabel: 'Nessun indirizzo registrato per questa persona.',
            api: {
                getByPersona: window.electronAPI.anagrafica.residenza.getByPersona,
                create: window.electronAPI.anagrafica.residenza.create,
                update: window.electronAPI.anagrafica.residenza.update,
                remove: window.electronAPI.anagrafica.residenza.remove
            },
            fields: [
                { key: 'tipo', label: 'Tipo Indirizzo', icon: 'home', type: 'select', required: true, options: Object.entries(TIPI_INDIRIZZO).map(([value, label]) => ({ value, label })) },
                { key: 'via', label: 'Via/Piazza', icon: 'signpost', type: 'text', flex: 2, required: true, datalist: { table: 'indirizzi', column: 'via' } },
                { key: 'civico', label: 'Civico', icon: 'tag', type: 'text', flex: 1 },
                { key: 'cap', label: 'CAP', icon: 'markunread_mailbox', type: 'text', flex: 1, datalist: { table: 'indirizzi', column: 'cap' } },
                { key: 'comune', label: 'Comune', icon: 'location_city', type: 'text', flex: 2, required: true, datalist: 'comuni' },
                { key: 'provincia', label: 'Provincia', icon: 'map', type: 'text', flex: 1, datalist: 'province' },
                { key: 'stato', label: 'Stato', icon: 'flag', type: 'text', flex: 1, default: 'Italia', datalist: { table: 'indirizzi', column: 'stato' } },
                { key: 'data_inizio', label: 'Data Inizio', icon: 'event', type: 'date', flex: 1 },
                { key: 'data_fine', label: 'Data Fine', icon: 'event_busy', type: 'date', flex: 1 },
                { key: 'is_corrente', label: 'Indirizzo attuale', type: 'checkbox', default: 1 }
            ],
            cardTitle: (r) => `${TIPI_INDIRIZZO[r.tipo] || r.tipo}${r.is_corrente ? ' (attuale)' : ' (storico)'}`,
            cardSubtitle: (r) => `${r.via || ''} ${r.civico || ''}, ${r.cap || ''} ${r.comune || ''} (${r.provincia || ''})`,
            cardMeta: (r) => r.stato || ''
        });
    }
};
