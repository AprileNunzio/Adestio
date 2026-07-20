import { renderPersonScopedCrudSubapp } from '../../shared/subapp_crud_kit.js';
export default {
    render: async (el) => {
        renderPersonScopedCrudSubapp(el, {
            title: 'Dati Bancari',
            subtitle: 'Coordinate bancarie della persona selezionata',
            icon: 'account_balance',
            tone: 'orange',
            newLabel: 'Nuovo Conto',
            tableName: 'dati_bancari',
            emptyLabel: 'Nessuna coordinata bancaria registrata per questa persona.',
            modalHint: 'Controlla che l\'IBAN sia corretto: un errore blocca l\'accredito. In Italia sono 27 caratteri (IT + 25).',
            api: {
                getByPersona: window.electronAPI.anagrafica.datiBancari.getByPersona,
                create: window.electronAPI.anagrafica.datiBancari.create,
                update: window.electronAPI.anagrafica.datiBancari.update,
                remove: window.electronAPI.anagrafica.datiBancari.remove
            },
            fields: [
                { key: 'iban', label: 'IBAN', icon: 'tag', type: 'text', span: 2, required: true },
                { key: 'banca', label: 'Banca / Posta', icon: 'account_balance', type: 'text', datalist: { table: 'dati_bancari', column: 'banca' } },
                { key: 'intestatario', label: 'Intestatario del Conto', icon: 'person', type: 'text', datalist: { table: 'dati_bancari', column: 'intestatario' } },
                { key: 'is_principale', label: 'Conto principale', type: 'checkbox', default: 0, full: true }
            ],
            cardTitle: (r) => r.banca || 'Conto bancario',
            cardSubtitle: (r) => r.iban || '',
            cardMeta: (r) => r.intestatario ? `Intestato a ${r.intestatario}` : '',
            cardBadge: (r) => r.is_principale ? 'Principale' : null
        });
    }
};
