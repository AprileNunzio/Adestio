import { renderPersonScopedCrudSubapp } from '../../shared/subapp_crud_kit.js';
import { fmt } from '../../../../js/utils.js';
const TIPI_DOCUMENTO = {
    carta_identita: "Carta d'Identità",
    passaporto: 'Passaporto',
    patente: 'Patente di Guida',
    tessera_sanitaria: 'Tessera Sanitaria',
    permesso_soggiorno: 'Permesso di Soggiorno',
    altro: 'Altro'
};
export default {
    render: async (el) => {
        renderPersonScopedCrudSubapp(el, {
            title: 'Documenti',
            subtitle: "Documenti d'identità collegati alla persona selezionata",
            newLabel: 'Nuovo Documento',
            tableName: 'documenti_identita',
            emptyLabel: 'Nessun documento registrato per questa persona.',
            api: {
                getByPersona: window.electronAPI.anagrafica.documenti.getByPersona,
                create: window.electronAPI.anagrafica.documenti.create,
                update: window.electronAPI.anagrafica.documenti.update,
                remove: window.electronAPI.anagrafica.documenti.remove
            },
            fields: [
                { key: 'tipo', label: 'Tipo Documento', icon: 'badge', type: 'select', required: true, options: Object.entries(TIPI_DOCUMENTO).map(([value, label]) => ({ value, label })) },
                { key: 'numero', label: 'Numero Documento', icon: 'tag', type: 'text' },
                { key: 'ente_rilascio', label: 'Ente di Rilascio', icon: 'account_balance', type: 'text', datalist: { table: 'documenti_identita', column: 'ente_rilascio' } },
                { key: 'data_rilascio', label: 'Data di Rilascio', icon: 'event', type: 'date' },
                { key: 'data_scadenza', label: 'Data di Scadenza', icon: 'event_busy', type: 'date' }
            ],
            cardTitle: (r) => `${TIPI_DOCUMENTO[r.tipo] || r.tipo}${r.numero ? ' — ' + r.numero : ''}`,
            cardSubtitle: (r) => r.ente_rilascio ? `Rilasciato da ${r.ente_rilascio}` : '',
            cardMeta: (r) => r.data_scadenza ? `Scadenza: ${fmt.data(r.data_scadenza)}` : 'Nessuna scadenza registrata'
        });
    }
};
