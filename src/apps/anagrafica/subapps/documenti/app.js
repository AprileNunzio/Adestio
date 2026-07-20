import { renderPersonScopedCrudSubapp } from '../../shared/subapp_crud_kit.js';
import { resolveCurrentPersona } from '../../shared/current_persona.js';
import { fmt } from '../../../../js/utils.js';
const TIPI_DOCUMENTO = {
    carta_identita: "Carta d'Identità",
    passaporto: 'Passaporto',
    patente: 'Patente di Guida',
    tessera_sanitaria: 'Tessera Sanitaria',
    permesso_soggiorno: 'Permesso di Soggiorno',
    altro: 'Altro'
};
function scadenzaInfo(r) {
    if (!r.data_scadenza) return { label: 'Nessuna scadenza registrata', badge: null };
    const oggi = new Date(); oggi.setHours(0, 0, 0, 0);
    const scad = new Date(r.data_scadenza);
    const giorni = Math.ceil((scad - oggi) / 86400000);
    if (giorni < 0) return { label: `Scaduto il ${fmt.data(r.data_scadenza)}`, badge: 'Scaduto' };
    if (giorni <= 60) return { label: `In scadenza: ${fmt.data(r.data_scadenza)}`, badge: 'In scadenza' };
    return { label: `Valido fino al ${fmt.data(r.data_scadenza)}`, badge: null };
}
export default {
    render: async (el) => {
        const persona = await resolveCurrentPersona();
        if (!persona) {
            el.innerHTML = '<p style="text-align:center; color:var(--md-on-surface-variant); padding:2rem;">Completa prima la sezione "I Miei Dati" per poter registrare i tuoi documenti.</p>';
            return;
        }
        renderPersonScopedCrudSubapp(el, {
            title: 'Documenti',
            subtitle: "I tuoi documenti d'identità, sempre a portata di mano",
            icon: 'badge',
            tone: 'orange',
            newLabel: 'Nuovo Documento',
            tableName: 'documenti_identita',
            emptyLabel: 'Registra qui carta d\'identità, passaporto, patente e altri documenti.',
            fixedPersona: persona,
            instructions: {
                intro: 'Tieni traccia di tutti i tuoi documenti di riconoscimento e delle relative scadenze: riceverai un colpo d\'occhio immediato su ciò che sta per scadere.',
                steps: [
                    'Premi <strong>“Nuovo Documento”</strong> in alto a destra.',
                    'Scegli il <strong>tipo</strong> (es. Carta d\'Identità) e inserisci il <strong>numero</strong> riportato sul documento.',
                    'Indica l\'<strong>ente di rilascio</strong> (es. il tuo Comune) e le <strong>date</strong> di rilascio e scadenza.',
                    'Salva: i documenti scaduti o in scadenza entro 60 giorni verranno evidenziati automaticamente.'
                ]
            },
            modalHint: 'Il numero e le date li trovi stampati sul documento stesso. La data di scadenza è facoltativa ma consigliata per gli avvisi.',
            api: {
                getByPersona: window.electronAPI.anagrafica.documenti.getByPersona,
                create: window.electronAPI.anagrafica.documenti.create,
                update: window.electronAPI.anagrafica.documenti.update,
                remove: window.electronAPI.anagrafica.documenti.remove
            },
            fields: [
                { key: 'tipo', label: 'Tipo Documento', icon: 'badge', type: 'select', required: true, options: Object.entries(TIPI_DOCUMENTO).map(([value, label]) => ({ value, label })), hint: 'Che tipo di documento stai registrando.' },
                { key: 'numero', label: 'Numero Documento', icon: 'tag', type: 'text', hint: 'Il codice alfanumerico riportato sul documento.' },
                { key: 'ente_rilascio', label: 'Ente di Rilascio', icon: 'account_balance', type: 'text', span: 2, datalist: { table: 'documenti_identita', column: 'ente_rilascio' }, hint: 'Chi lo ha emesso (es. Comune, Questura, Motorizzazione).' },
                { key: 'data_rilascio', label: 'Data di Rilascio', icon: 'event', type: 'date', hint: 'Quando è stato emesso.' },
                { key: 'data_scadenza', label: 'Data di Scadenza', icon: 'event_busy', type: 'date', hint: 'Utile per ricevere gli avvisi di scadenza.' }
            ],
            cardTitle: (r) => `${TIPI_DOCUMENTO[r.tipo] || r.tipo}${r.numero ? ' — ' + r.numero : ''}`,
            cardSubtitle: (r) => r.ente_rilascio ? `Rilasciato da ${r.ente_rilascio}` : '',
            cardMeta: (r) => scadenzaInfo(r).label,
            cardBadge: (r) => scadenzaInfo(r).badge
        });
    }
};
