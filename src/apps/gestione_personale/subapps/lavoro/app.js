import { renderPersonScopedCrudSubapp } from '../../shared/subapp_crud_kit.js';
const TIPI_CONTRATTO = ['Tempo Indeterminato', 'Tempo Determinato', 'Apprendistato', 'Partita IVA', 'Collaborazione', 'Stage/Tirocinio', 'Altro'];
const CATEGORIE_PERSONALE = ['ATA', 'Docente', 'Dirigente Scolastico', 'Personale Educativo', 'Altro'];
const TIPI_RAPPORTO = ['Indeterminato', 'Determinato'];
export default {
    render: async (el) => {
        renderPersonScopedCrudSubapp(el, {
            title: 'Lavoro',
            subtitle: 'Rapporti di lavoro della persona selezionata, con storico',
            newLabel: 'Nuovo Rapporto di Lavoro',
            tableName: 'rapporti_lavoro',
            emptyLabel: 'Nessun rapporto di lavoro registrato per questa persona.',
            api: {
                getByPersona: window.electronAPI.anagrafica.lavoro.getByPersona,
                create: window.electronAPI.anagrafica.lavoro.create,
                update: window.electronAPI.anagrafica.lavoro.update,
                remove: window.electronAPI.anagrafica.lavoro.remove
            },
            fields: [
                { key: 'datore_lavoro', label: 'Datore di Lavoro', icon: 'apartment', type: 'text', required: true, datalist: { table: 'rapporti_lavoro', column: 'datore_lavoro' } },
                { key: 'mansione', label: 'Mansione', icon: 'engineering', type: 'text', datalist: { table: 'rapporti_lavoro', column: 'mansione' } },
                { key: 'tipo_contratto', label: 'Tipo Contratto', icon: 'description', type: 'select', options: TIPI_CONTRATTO.map(v => ({ value: v, label: v })) },
                { key: 'sede_lavoro', label: 'Sede di Lavoro', icon: 'location_on', type: 'text', datalist: { table: 'rapporti_lavoro', column: 'sede_lavoro' } },
                { key: 'data_inizio', label: 'Data Inizio', icon: 'event', type: 'date', flex: 1 },
                { key: 'data_fine', label: 'Data Fine', icon: 'event_busy', type: 'date', flex: 1 },
                { key: 'is_corrente', label: 'Rapporto attuale', type: 'checkbox', default: 1 },
                { key: 'categoria_personale', label: 'Categoria Personale', icon: 'badge', type: 'select', options: CATEGORIE_PERSONALE.map(v => ({ value: v, label: v })) },
                { key: 'profilo_professionale', label: 'Profilo Professionale', icon: 'work_history', type: 'text', span: 2, datalist: { table: 'rapporti_lavoro', column: 'profilo_professionale' } },
                { key: 'ruolo', label: 'Ruolo', icon: 'assignment_ind', type: 'text', datalist: { table: 'rapporti_lavoro', column: 'ruolo' } },
                { key: 'ore_settimanali', label: 'Ore Settimanali', icon: 'schedule', type: 'text' },
                { key: 'tipo_rapporto', label: 'Tempo Det./Indet.', icon: 'more_time', type: 'select', options: TIPI_RAPPORTO.map(v => ({ value: v, label: v })) },
                { key: 'data_stipula', label: 'Data Stipula Contratto', icon: 'handshake', type: 'date' },
                { key: 'anno_scolastico_inizio', label: 'Anno Scolastico (inizio)', icon: 'calendar_today', type: 'text' },
                { key: 'anno_scolastico_fine', label: 'Anno Scolastico (fine)', icon: 'event_available', type: 'text' },
                { key: 'corso_sicurezza', label: 'Corso Sicurezza', icon: 'health_and_safety', type: 'text', span: 2 }
            ],
            cardTitle: (r) => `${r.datore_lavoro}${r.is_corrente ? ' (attuale)' : ' (storico)'}`,
            cardSubtitle: (r) => r.mansione || '',
            cardMeta: (r) => r.tipo_contratto || ''
        });
    }
};
