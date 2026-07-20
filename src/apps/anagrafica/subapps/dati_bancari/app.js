import { renderPersonScopedCrudSubapp } from '../../shared/subapp_crud_kit.js';
import { resolveCurrentPersona } from '../../shared/current_persona.js';
export default {
    render: async (el) => {
        const persona = await resolveCurrentPersona();
        if (!persona) {
            el.innerHTML = '<p style="text-align:center; color:var(--md-on-surface-variant); padding:2rem;">Completa prima la sezione "I Miei Dati" per poter registrare le tue coordinate bancarie.</p>';
            return;
        }
        renderPersonScopedCrudSubapp(el, {
            title: 'Dati Bancari',
            subtitle: 'Le coordinate su cui ricevere accrediti e stipendi',
            icon: 'account_balance',
            tone: 'orange',
            newLabel: 'Nuovo Conto',
            tableName: 'dati_bancari',
            emptyLabel: 'Aggiungi le tue coordinate bancarie (IBAN) per gli accrediti.',
            fixedPersona: persona,
            instructions: {
                intro: 'Registra le coordinate bancarie su cui ricevere gli accrediti. Indica come "principale" il conto da usare di default.',
                steps: [
                    'Premi <strong>“Nuovo Conto”</strong> in alto a destra.',
                    'Inserisci l\'<strong>IBAN</strong> completo.',
                    'Indica la <strong>banca</strong> e l\'<strong>intestatario</strong> del conto.',
                    'Spunta <strong>“Conto principale”</strong> per usarlo di default.'
                ]
            },
            modalHint: 'Controlla che l\'IBAN sia corretto: un errore blocca l\'accredito. In Italia sono 27 caratteri (IT + 25).',
            api: {
                getByPersona: window.electronAPI.anagrafica.datiBancari.getByPersona,
                create: window.electronAPI.anagrafica.datiBancari.create,
                update: window.electronAPI.anagrafica.datiBancari.update,
                remove: window.electronAPI.anagrafica.datiBancari.remove
            },
            fields: [
                { key: 'iban', label: 'IBAN', icon: 'tag', type: 'text', span: 2, required: true, hint: 'Coordinata bancaria internazionale.' },
                { key: 'banca', label: 'Banca / Posta', icon: 'account_balance', type: 'text', datalist: { table: 'dati_bancari', column: 'banca' }, hint: 'Es. Intesa Sanpaolo, Poste Italiane.' },
                { key: 'intestatario', label: 'Intestatario del Conto', icon: 'person', type: 'text', datalist: { table: 'dati_bancari', column: 'intestatario' }, hint: 'A chi è intestato il conto.' },
                { key: 'is_principale', label: 'Conto principale', type: 'checkbox', default: 0, full: true, hint: 'Il conto da usare di default per gli accrediti.' }
            ],
            cardTitle: (r) => r.banca || 'Conto bancario',
            cardSubtitle: (r) => r.iban || '',
            cardMeta: (r) => r.intestatario ? `Intestato a ${r.intestatario}` : '',
            cardBadge: (r) => r.is_principale ? 'Principale' : null
        });
    }
};
