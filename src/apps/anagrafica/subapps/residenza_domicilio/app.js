import { renderPersonScopedCrudSubapp } from '../../shared/subapp_crud_kit.js';
import { resolveCurrentPersona } from '../../shared/current_persona.js';
import { fmt } from '../../../../js/utils.js';
const TIPI_INDIRIZZO = { residenza: 'Residenza', domicilio: 'Domicilio' };
function periodo(r) {
    const inizio = r.data_inizio ? fmt.data(r.data_inizio) : null;
    if (r.is_corrente) return inizio ? `Dal ${inizio} · attuale` : 'Indirizzo attuale';
    const fine = r.data_fine ? fmt.data(r.data_fine) : '—';
    return inizio ? `Dal ${inizio} al ${fine}` : `Fino al ${fine}`;
}
export default {
    render: async (el) => {
        const persona = await resolveCurrentPersona();
        if (!persona) {
            el.innerHTML = '<p style="text-align:center; color:var(--md-on-surface-variant); padding:2rem;">Completa prima la sezione "I Miei Dati" per poter registrare i tuoi indirizzi.</p>';
            return;
        }
        renderPersonScopedCrudSubapp(el, {
            title: 'Residenza e Domicilio',
            subtitle: 'I tuoi indirizzi, con lo storico di dove hai vissuto',
            icon: 'home',
            tone: 'cyan',
            newLabel: 'Nuovo Indirizzo',
            tableName: 'indirizzi',
            emptyLabel: 'Aggiungi la tua residenza attuale e, se vuoi, il domicilio e gli indirizzi passati.',
            fixedPersona: persona,
            instructions: {
                intro: 'La <strong>residenza</strong> è l\'indirizzo ufficiale registrato all\'anagrafe; il <strong>domicilio</strong> è dove vivi abitualmente se diverso. Puoi conservare anche gli indirizzi passati come storico.',
                steps: [
                    'Premi <strong>“Nuovo Indirizzo”</strong> in alto a destra.',
                    'Scegli il <strong>tipo</strong> (Residenza o Domicilio).',
                    'Digita il <strong>Comune</strong>: Provincia e CAP verranno suggeriti in automatico.',
                    'Completa via e civico, quindi salva. Spunta <strong>“Indirizzo attuale”</strong> per quello in cui vivi ora.'
                ]
            },
            modalHint: 'Inizia dal Comune: scrivendolo, Provincia e CAP si compilano da soli. Togli la spunta “attuale” per archiviare un vecchio indirizzo.',
            api: {
                getByPersona: window.electronAPI.anagrafica.residenza.getByPersona,
                create: window.electronAPI.anagrafica.residenza.create,
                update: window.electronAPI.anagrafica.residenza.update,
                remove: window.electronAPI.anagrafica.residenza.remove
            },
            fields: [
                { key: 'tipo', label: 'Tipo Indirizzo', icon: 'home', type: 'select', required: true, options: Object.entries(TIPI_INDIRIZZO).map(([value, label]) => ({ value, label })), hint: 'Residenza (ufficiale) o Domicilio (dove vivi).' },
                { key: 'via', label: 'Via / Piazza', icon: 'signpost', type: 'text', span: 2, required: true, datalist: { table: 'indirizzi', column: 'via' }, hint: 'Nome della via o piazza.' },
                { key: 'civico', label: 'Civico', icon: 'tag', type: 'text', hint: 'Numero civico.' },
                { key: 'comune', label: 'Comune', icon: 'location_city', type: 'text', required: true, datalist: 'comuni', hint: 'Scrivilo per compilare Provincia e CAP.' },
                { key: 'provincia', label: 'Provincia', icon: 'map', type: 'text', uppercase: true, datalist: 'province', hint: 'Sigla (es. RM). Compilato in automatico.' },
                { key: 'cap', label: 'CAP', icon: 'markunread_mailbox', type: 'text', datalist: { table: 'indirizzi', column: 'cap' }, hint: 'Codice postale a 5 cifre.' },
                { key: 'stato', label: 'Stato', icon: 'flag', type: 'text', default: 'Italia', datalist: { table: 'indirizzi', column: 'stato' }, hint: 'Nazione dell\'indirizzo.' },
                { key: 'data_inizio', label: 'Data Inizio', icon: 'event', type: 'date', hint: 'Da quando risiedi/vivi qui.' },
                { key: 'data_fine', label: 'Data Fine', icon: 'event_busy', type: 'date', hint: 'Lascia vuoto se è l\'indirizzo attuale.' },
                { key: 'is_corrente', label: 'È il mio indirizzo attuale', type: 'checkbox', default: 1, full: true, hint: 'Attivo se vivi qui adesso.' }
            ],
            cardTitle: (r) => `${TIPI_INDIRIZZO[r.tipo] || r.tipo}`,
            cardSubtitle: (r) => `${[r.via, r.civico].filter(Boolean).join(' ')}${r.via ? ',' : ''} ${r.cap || ''} ${r.comune || ''}${r.provincia ? ' (' + r.provincia + ')' : ''}`.trim(),
            cardMeta: (r) => periodo(r),
            cardBadge: (r) => r.is_corrente ? 'Attuale' : null
        });
    }
};
