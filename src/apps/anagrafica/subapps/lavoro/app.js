import { renderPersonScopedCrudSubapp } from '../../shared/subapp_crud_kit.js';
import { resolveCurrentPersona } from '../../shared/current_persona.js';
import { fmt } from '../../../../js/utils.js';
const TIPI_CONTRATTO = ['Tempo Indeterminato', 'Tempo Determinato', 'Apprendistato', 'Partita IVA', 'Collaborazione', 'Stage/Tirocinio', 'Altro'];
const CATEGORIE_PERSONALE = ['ATA', 'Docente', 'Dirigente Scolastico', 'Personale Educativo', 'Altro'];
const TIPI_RAPPORTO = ['Indeterminato', 'Determinato'];
function periodo(r) {
    const inizio = r.data_inizio ? fmt.data(r.data_inizio) : '—';
    if (r.is_corrente) return `Dal ${inizio} · in corso`;
    const fine = r.data_fine ? fmt.data(r.data_fine) : '—';
    return `Dal ${inizio} al ${fine}`;
}
export default {
    render: async (el) => {
        const persona = await resolveCurrentPersona();
        if (!persona) {
            el.innerHTML = '<p style="text-align:center; color:var(--md-on-surface-variant); padding:2rem;">Completa prima la sezione "I Miei Dati" per poter registrare i tuoi rapporti di lavoro.</p>';
            return;
        }
        renderPersonScopedCrudSubapp(el, {
            title: 'Lavoro',
            subtitle: 'La tua storia professionale, dal primo impiego a oggi',
            icon: 'work',
            tone: 'teal',
            newLabel: 'Nuovo Rapporto',
            tableName: 'rapporti_lavoro',
            emptyLabel: 'Aggiungi il tuo impiego attuale e quelli passati per costruire il tuo storico.',
            fixedPersona: persona,
            instructions: {
                intro: 'Registra i tuoi rapporti di lavoro attuali e passati. Ogni voce diventa parte del tuo storico professionale, utile per curriculum e pratiche amministrative.',
                steps: [
                    'Premi <strong>“Nuovo Rapporto”</strong> in alto a destra.',
                    'Inserisci il <strong>datore di lavoro</strong> e la tua <strong>mansione</strong>.',
                    'Scegli il <strong>tipo di contratto</strong> e indica la <strong>data di inizio</strong>.',
                    'Se è l\'impiego attuale lascia spuntato <strong>“Rapporto attuale”</strong>; altrimenti togli la spunta e aggiungi la <strong>data di fine</strong>.'
                ]
            },
            modalHint: 'Per un lavoro ancora in corso lascia vuota la data di fine e mantieni attiva la spunta “Rapporto attuale”.',
            api: {
                getByPersona: window.electronAPI.anagrafica.lavoro.getByPersona,
                create: window.electronAPI.anagrafica.lavoro.create,
                update: window.electronAPI.anagrafica.lavoro.update,
                remove: window.electronAPI.anagrafica.lavoro.remove
            },
            fields: [
                { key: 'datore_lavoro', label: 'Datore di Lavoro', icon: 'apartment', type: 'text', span: 2, required: true, datalist: { table: 'rapporti_lavoro', column: 'datore_lavoro' }, hint: 'Nome dell\'azienda o del datore.' },
                { key: 'mansione', label: 'Mansione', icon: 'engineering', type: 'text', datalist: { table: 'rapporti_lavoro', column: 'mansione' }, hint: 'Il ruolo che ricopri o ricoprivi.' },
                { key: 'tipo_contratto', label: 'Tipo Contratto', icon: 'description', type: 'select', options: TIPI_CONTRATTO.map(v => ({ value: v, label: v })), hint: 'La forma contrattuale del rapporto.' },
                { key: 'sede_lavoro', label: 'Sede di Lavoro', icon: 'location_on', type: 'text', span: 2, datalist: { table: 'rapporti_lavoro', column: 'sede_lavoro' }, hint: 'Città o luogo in cui lavori.' },
                { key: 'data_inizio', label: 'Data Inizio', icon: 'event', type: 'date', hint: 'Quando è iniziato il rapporto.' },
                { key: 'data_fine', label: 'Data Fine', icon: 'event_busy', type: 'date', hint: 'Lascia vuoto se ancora in corso.' },
                { key: 'is_corrente', label: 'È il mio lavoro attuale', type: 'checkbox', default: 1, full: true, hint: 'Attivo se questo rapporto è tuttora in corso.' },
                { key: 'categoria_personale', label: 'Categoria Personale', icon: 'badge', type: 'select', options: CATEGORIE_PERSONALE.map(v => ({ value: v, label: v })), hint: 'Solo per personale scolastico: ATA o Docente.' },
                { key: 'profilo_professionale', label: 'Profilo Professionale', icon: 'work_history', type: 'text', span: 2, datalist: { table: 'rapporti_lavoro', column: 'profilo_professionale' }, hint: 'Es. Collaboratore Scolastico, Assistente Amministrativo.' },
                { key: 'ruolo', label: 'Ruolo', icon: 'assignment_ind', type: 'text', datalist: { table: 'rapporti_lavoro', column: 'ruolo' }, hint: 'Ruolo indicato nella presa di servizio.' },
                { key: 'ore_settimanali', label: 'Ore Settimanali', icon: 'schedule', type: 'text', hint: 'Numero di ore di servizio a settimana.' },
                { key: 'tipo_rapporto', label: 'Tempo Det./Indet.', icon: 'more_time', type: 'select', options: TIPI_RAPPORTO.map(v => ({ value: v, label: v })), hint: 'Contratto a tempo determinato o indeterminato.' },
                { key: 'data_stipula', label: 'Data Stipula Contratto', icon: 'handshake', type: 'date', hint: 'Data di firma del contratto individuale.' },
                { key: 'anno_scolastico_inizio', label: 'Anno Scolastico (inizio)', icon: 'calendar_today', type: 'text', hint: 'Es. 2025' },
                { key: 'anno_scolastico_fine', label: 'Anno Scolastico (fine)', icon: 'event_available', type: 'text', hint: 'Es. 2026' },
                { key: 'corso_sicurezza', label: 'Corso Sicurezza', icon: 'health_and_safety', type: 'text', span: 2, hint: 'Estremi del corso sulla sicurezza (D.Lgs. 81/2008).' }
            ],
            cardTitle: (r) => r.datore_lavoro,
            cardSubtitle: (r) => [r.mansione, r.tipo_contratto].filter(Boolean).join(' · '),
            cardMeta: (r) => periodo(r),
            cardBadge: (r) => r.is_corrente ? 'Attuale' : null
        });
    }
};
