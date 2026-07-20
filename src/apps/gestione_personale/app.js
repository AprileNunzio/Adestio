import { toast, fmt } from '../../js/utils.js';
import { isValidCodiceFiscale } from './shared/validators.js';
import { heroHtml, guidaHtml, AK_STYLES, TONI } from './shared/ui_kit.js';
import { personaFormHtml, readPersonaForm, fillPersonaForm, populatePersonaFormDatalists } from './shared/persona_form.js';
import { renderPersonScopedCrudSubapp } from './shared/subapp_crud_kit.js';
import { mountContattiSection } from './shared/contatti_section.js';
import { mountAuditButton } from './shared/audit_trail_button.js';

/* ------------------------- Configurazioni sezioni CRUD ------------------------- */
const TIPI_DOCUMENTO = {
    carta_identita: "Carta d'Identità", passaporto: 'Passaporto', patente: 'Patente di Guida',
    tessera_sanitaria: 'Tessera Sanitaria', permesso_soggiorno: 'Permesso di Soggiorno', altro: 'Altro'
};
const TIPI_CONTRATTO = ['Tempo Indeterminato', 'Tempo Determinato', 'Apprendistato', 'Partita IVA', 'Collaborazione', 'Stage/Tirocinio', 'Altro'];
const MANSIONI_SCOLASTICHE = ['Docente', 'Assistente Tecnico', 'Collaboratore Scolastico', 'Assistente Amministrativo', 'DSGA', 'Altro'];
const TIPI_INDIRIZZO = { residenza: 'Residenza', domicilio: 'Domicilio' };

function scadenzaInfo(r) {
    if (!r.data_scadenza) return { label: 'Nessuna scadenza registrata', badge: null };
    const oggi = new Date(); oggi.setHours(0, 0, 0, 0);
    const giorni = Math.ceil((new Date(r.data_scadenza) - oggi) / 86400000);
    if (giorni < 0) return { label: `Scaduto il ${fmt.data(r.data_scadenza)}`, badge: 'Scaduto' };
    if (giorni <= 60) return { label: `In scadenza: ${fmt.data(r.data_scadenza)}`, badge: 'In scadenza' };
    return { label: `Valido fino al ${fmt.data(r.data_scadenza)}`, badge: null };
}
function periodoLavoro(r) {
    const i = r.data_inizio ? fmt.data(r.data_inizio) : '—';
    if (r.is_corrente) return `Dal ${i} · in corso`;
    return `Dal ${i}${r.data_fine ? ' al ' + fmt.data(r.data_fine) : ''}`;
}
function periodoIndirizzo(r) {
    const i = r.data_inizio ? fmt.data(r.data_inizio) : null;
    if (r.is_corrente) return i ? `Dal ${i} · attuale` : 'Indirizzo attuale';
    return i ? `Dal ${i}${r.data_fine ? ' al ' + fmt.data(r.data_fine) : ''}` : (r.data_fine ? `Fino al ${fmt.data(r.data_fine)}` : '');
}

function documentiConfig(persona, onChange) {
    return {
        embedded: true, fixedPersona: persona, tone: 'orange', icon: 'badge', newLabel: 'Nuovo Documento',
        recordsTitle: 'Documenti', tableName: 'documenti_identita', onChange,
        emptyLabel: "Registra carta d'identità, passaporto, patente e altri documenti di questa persona.",
        instructions: { intro: 'Documenti di riconoscimento della persona e relative scadenze (i documenti scaduti o in scadenza entro 60 giorni sono evidenziati).', steps: [
            'Premi <strong>“Nuovo Documento”</strong>.', 'Scegli il <strong>tipo</strong> e inserisci il <strong>numero</strong>.', 'Indica ente di rilascio e date, poi salva.'
        ] },
        modalHint: 'Numero e date si trovano stampati sul documento. La scadenza è facoltativa ma consigliata per gli avvisi.',
        api: window.electronAPI.anagrafica.documenti,
        fields: [
            { key: 'tipo', label: 'Tipo Documento', icon: 'badge', type: 'select', required: true, options: Object.entries(TIPI_DOCUMENTO).map(([value, label]) => ({ value, label })), hint: 'Che tipo di documento.' },
            { key: 'numero', label: 'Numero Documento', icon: 'tag', type: 'text', hint: 'Codice alfanumerico del documento.' },
            { key: 'ente_rilascio', label: 'Ente di Rilascio', icon: 'account_balance', type: 'text', span: 2, datalist: { table: 'documenti_identita', column: 'ente_rilascio' }, hint: 'Chi lo ha emesso (Comune, Questura…).' },
            { key: 'data_rilascio', label: 'Data di Rilascio', icon: 'event', type: 'date', hint: 'Quando è stato emesso.' },
            { key: 'data_scadenza', label: 'Data di Scadenza', icon: 'event_busy', type: 'date', hint: 'Utile per gli avvisi.' }
        ],
        cardTitle: (r) => `${TIPI_DOCUMENTO[r.tipo] || r.tipo}${r.numero ? ' — ' + r.numero : ''}`,
        cardSubtitle: (r) => r.ente_rilascio ? `Rilasciato da ${r.ente_rilascio}` : '',
        cardMeta: (r) => scadenzaInfo(r).label,
        cardBadge: (r) => scadenzaInfo(r).badge
    };
}
function lavoroConfig(persona, onChange) {
    return {
        embedded: true, fixedPersona: persona, tone: 'teal', icon: 'work', newLabel: 'Nuovo Rapporto',
        recordsTitle: 'Rapporti di lavoro', tableName: 'rapporti_lavoro', onChange,
        emptyLabel: 'Aggiungi impiego attuale e rapporti passati per costruire lo storico professionale.',
        instructions: { intro: 'Rapporti di lavoro attuali e passati della persona.', steps: [
            'Premi <strong>“Nuovo Rapporto”</strong>.', 'Inserisci datore e mansione.', 'Se in corso, lascia spuntato “È il lavoro attuale”; altrimenti aggiungi la data di fine.'
        ] },
        modalHint: 'Per un lavoro in corso lascia vuota la data di fine e mantieni la spunta “attuale”.',
        api: window.electronAPI.anagrafica.lavoro,
        fields: [
            { key: 'datore_lavoro', label: 'Datore di Lavoro', icon: 'apartment', type: 'text', span: 2, required: true, datalist: { table: 'rapporti_lavoro', column: 'datore_lavoro' }, hint: "Nome dell'azienda o del datore." },
            { key: 'mansione', label: 'Mansione', icon: 'engineering', type: 'select', options: MANSIONI_SCOLASTICHE.map(v => ({ value: v, label: v })), hint: 'Profilo/ruolo ricoperto.' },
            { key: 'tipo_contratto', label: 'Tipo Contratto', icon: 'description', type: 'select', options: TIPI_CONTRATTO.map(v => ({ value: v, label: v })), hint: 'Forma contrattuale.' },
            { key: 'sede_lavoro', label: 'Sede di Lavoro', icon: 'location_on', type: 'text', span: 2, datalist: { table: 'rapporti_lavoro', column: 'sede_lavoro' }, hint: 'Città o luogo di lavoro.' },
            { key: 'data_inizio', label: 'Data Inizio', icon: 'event', type: 'date', hint: 'Inizio del rapporto.' },
            { key: 'data_fine', label: 'Data Fine', icon: 'event_busy', type: 'date', hint: 'Vuoto se ancora in corso.' },
            { key: 'is_corrente', label: 'È il lavoro attuale', type: 'checkbox', default: 1, full: true, hint: 'Attivo se tuttora in corso.' }
        ],
        cardTitle: (r) => r.datore_lavoro,
        cardSubtitle: (r) => [r.mansione, r.tipo_contratto].filter(Boolean).join(' · '),
        cardMeta: (r) => periodoLavoro(r),
        cardBadge: (r) => r.is_corrente ? 'Attuale' : null
    };
}
const TIPI_TITOLO = ['Licenza Media', 'Diploma di Qualifica', 'Diploma di Maturità', 'Laurea Triennale', 'Laurea Magistrale', 'Laurea Vecchio Ordinamento', 'Master', 'Dottorato', 'Abilitazione', 'Altro'];
function titoliConfig(persona, onChange) {
    return {
        embedded: true, fixedPersona: persona, tone: 'violet', icon: 'school', newLabel: 'Nuovo Titolo',
        recordsTitle: 'Titoli di studio', tableName: 'titoli_studio', onChange,
        emptyLabel: 'Aggiungi i titoli di studio: richiesti per la presa di servizio e le pratiche.',
        instructions: { intro: 'Titoli di studio e qualifiche della persona.', steps: [
            'Premi <strong>“Nuovo Titolo”</strong>.', 'Inserisci denominazione, tipo e votazione.', 'Indica istituto, città e data di conseguimento.'
        ] },
        api: window.electronAPI.anagrafica.titoliStudio,
        fields: [
            { key: 'denominazione', label: 'Denominazione Titolo', icon: 'workspace_premium', type: 'text', span: 2, required: true, datalist: { table: 'titoli_studio', column: 'denominazione' }, hint: 'Es. Diploma di Ragioniere.' },
            { key: 'tipo', label: 'Tipo di Titolo', icon: 'category', type: 'select', options: TIPI_TITOLO.map(v => ({ value: v, label: v })), hint: 'Livello del titolo.' },
            { key: 'votazione', label: 'Votazione', icon: 'grade', type: 'text', datalist: { table: 'titoli_studio', column: 'votazione' }, hint: 'Es. 100/100.' },
            { key: 'istituto_rilascio', label: 'Istituto / Università', icon: 'account_balance', type: 'text', span: 2, datalist: { table: 'titoli_studio', column: 'istituto_rilascio' }, hint: 'Ente che ha rilasciato il titolo.' },
            { key: 'citta_istituto', label: 'Città Istituto', icon: 'location_city', type: 'text', datalist: { table: 'titoli_studio', column: 'citta_istituto' }, hint: 'Città dell\'istituto.' },
            { key: 'data_conseguimento', label: 'Data Conseguimento', icon: 'event', type: 'date', hint: 'Quando è stato conseguito.' },
            { key: 'is_principale', label: 'Titolo principale', type: 'checkbox', default: 0, full: true, hint: 'Da usare di default nelle pratiche.' }
        ],
        cardTitle: (r) => r.denominazione,
        cardSubtitle: (r) => [r.tipo, r.votazione].filter(Boolean).join(' · '),
        cardMeta: (r) => [r.istituto_rilascio, r.data_conseguimento ? fmt.data(r.data_conseguimento) : ''].filter(Boolean).join(' · '),
        cardBadge: (r) => r.is_principale ? 'Principale' : null
    };
}
function bancariConfig(persona, onChange) {
    return {
        embedded: true, fixedPersona: persona, tone: 'orange', icon: 'account_balance', newLabel: 'Nuovo Conto',
        recordsTitle: 'Dati bancari', tableName: 'dati_bancari', onChange,
        emptyLabel: 'Aggiungi le coordinate bancarie (IBAN) per gli accrediti.',
        instructions: { intro: 'Coordinate bancarie su cui ricevere gli accrediti.', steps: [
            'Premi <strong>“Nuovo Conto”</strong>.', 'Inserisci l\'IBAN completo.', 'Indica banca e intestatario.'
        ] },
        modalHint: 'Controlla che l\'IBAN sia corretto: in Italia sono 27 caratteri (IT + 25).',
        api: window.electronAPI.anagrafica.datiBancari,
        fields: [
            { key: 'iban', label: 'IBAN', icon: 'tag', type: 'text', span: 2, required: true, hint: 'Coordinata bancaria.' },
            { key: 'banca', label: 'Banca / Posta', icon: 'account_balance', type: 'text', datalist: { table: 'dati_bancari', column: 'banca' }, hint: 'Es. Intesa Sanpaolo.' },
            { key: 'intestatario', label: 'Intestatario', icon: 'person', type: 'text', datalist: { table: 'dati_bancari', column: 'intestatario' }, hint: 'A chi è intestato il conto.' },
            { key: 'is_principale', label: 'Conto principale', type: 'checkbox', default: 0, full: true, hint: 'Da usare di default per gli accrediti.' }
        ],
        cardTitle: (r) => r.banca || 'Conto bancario',
        cardSubtitle: (r) => r.iban || '',
        cardMeta: (r) => r.intestatario ? `Intestato a ${r.intestatario}` : '',
        cardBadge: (r) => r.is_principale ? 'Principale' : null
    };
}
function residenzaConfig(persona, onChange) {
    return {
        embedded: true, fixedPersona: persona, tone: 'cyan', icon: 'home', newLabel: 'Nuovo Indirizzo',
        recordsTitle: 'Indirizzi', tableName: 'indirizzi', onChange,
        emptyLabel: 'Aggiungi residenza attuale, domicilio ed eventuali indirizzi passati.',
        instructions: { intro: '<strong>Residenza</strong>: indirizzo ufficiale all\'anagrafe. <strong>Domicilio</strong>: dove la persona vive se diverso.', steps: [
            'Premi <strong>“Nuovo Indirizzo”</strong>.', 'Scegli il tipo (Residenza/Domicilio).', 'Scrivi il <strong>Comune</strong>: Provincia e CAP si compilano da soli.'
        ] },
        modalHint: 'Inizia dal Comune: Provincia e CAP si compilano automaticamente. Togli la spunta “attuale” per archiviare un vecchio indirizzo.',
        api: window.electronAPI.anagrafica.residenza,
        fields: [
            { key: 'tipo', label: 'Tipo Indirizzo', icon: 'home', type: 'select', required: true, options: Object.entries(TIPI_INDIRIZZO).map(([value, label]) => ({ value, label })), hint: 'Residenza (ufficiale) o Domicilio.' },
            { key: 'via', label: 'Via / Piazza', icon: 'signpost', type: 'text', span: 2, required: true, datalist: { table: 'indirizzi', column: 'via' }, hint: 'Nome della via o piazza.' },
            { key: 'civico', label: 'Civico', icon: 'tag', type: 'text', hint: 'Numero civico.' },
            { key: 'comune', label: 'Comune', icon: 'location_city', type: 'text', required: true, datalist: 'comuni', hint: 'Compila Provincia e CAP.' },
            { key: 'provincia', label: 'Provincia', icon: 'map', type: 'text', uppercase: true, datalist: 'province', hint: 'Sigla (es. RM). Automatico.' },
            { key: 'cap', label: 'CAP', icon: 'markunread_mailbox', type: 'text', datalist: { table: 'indirizzi', column: 'cap' }, hint: 'Codice postale.' },
            { key: 'stato', label: 'Stato', icon: 'flag', type: 'text', default: 'Italia', datalist: { table: 'indirizzi', column: 'stato' }, hint: 'Nazione.' },
            { key: 'data_inizio', label: 'Data Inizio', icon: 'event', type: 'date', hint: 'Da quando.' },
            { key: 'data_fine', label: 'Data Fine', icon: 'event_busy', type: 'date', hint: 'Vuoto se attuale.' },
            { key: 'is_corrente', label: 'È l\'indirizzo attuale', type: 'checkbox', default: 1, full: true, hint: 'Attivo se vive qui adesso.' }
        ],
        cardTitle: (r) => `${TIPI_INDIRIZZO[r.tipo] || r.tipo}`,
        cardSubtitle: (r) => `${[r.via, r.civico].filter(Boolean).join(' ')}${r.via ? ',' : ''} ${r.cap || ''} ${r.comune || ''}${r.provincia ? ' (' + r.provincia + ')' : ''}`.trim(),
        cardMeta: (r) => periodoIndirizzo(r),
        cardBadge: (r) => r.is_corrente ? 'Attuale' : null
    };
}

function famigliaConfig(persona, onChange) {
    return {
        embedded: true, fixedPersona: persona, tone: 'pink', icon: 'family_restroom', newLabel: 'Nuovo Familiare',
        recordsTitle: 'Componenti della Famiglia', tableName: 'familiari', onChange,
        emptyLabel: "Aggiungi coniugi, figli e altri familiari a carico o per riferimenti di emergenza.",
        instructions: { intro: 'Nucleo familiare e parenti.', steps: [
            'Premi <strong>“Nuovo Familiare”</strong>.', 'Inserisci i dati essenziali e il grado di parentela.', 'Spunta “A carico” se necessario ai fini fiscali.'
        ] },
        modalHint: 'Puoi aggiungere familiari anche senza che abbiano una scheda in anagrafica.',
        api: window.electronAPI.familiari || window.electronAPI.anagrafica.familiari,
        fields: [
            { key: 'nome', label: 'Nome', icon: 'person', type: 'text', required: true, span: 1 },
            { key: 'cognome', label: 'Cognome', icon: 'badge', type: 'text', required: true, span: 1 },
            { key: 'codice_fiscale', label: 'Codice Fiscale', icon: 'fingerprint', type: 'text', uppercase: true, span: 2 },
            { key: 'sesso', label: 'Sesso', icon: 'wc', type: 'select', options: [
                { value: '', label: 'Seleziona...' }, { value: 'M', label: 'Maschio' }, { value: 'F', label: 'Femmina' }, { value: 'Altro', label: 'Altro' }
            ] },
            { key: 'data_nascita', label: 'Data di Nascita', icon: 'cake', type: 'date' },
            { key: 'grado_parentela', label: 'Grado di Parentela', icon: 'diversity_1', type: 'select', required: true, options: [
                { value: '', label: 'Seleziona...' }, { value: 'Coniuge', label: 'Coniuge' }, { value: 'Figlio/a', label: 'Figlio/a' },
                { value: 'Genitore', label: 'Genitore' }, { value: 'Fratello/Sorella', label: 'Fratello/Sorella' }, { value: 'Altro', label: 'Altro' }
            ] },
            { key: 'is_a_carico', label: 'Familiare a carico', icon: 'payments', type: 'checkbox', hint: 'Ai fini fiscali' }
        ],
        cardTitle: (r) => `${r.nome} ${r.cognome}`,
        cardSubtitle: (r) => r.codice_fiscale || '',
        cardMeta: (r) => `${r.grado_parentela}${r.data_nascita ? ' - Nato/a il ' + fmt.data(r.data_nascita) : ''}`,
        cardBadge: (r) => r.is_a_carico ? 'A carico' : null
    };
}

/* --------------------------------- Console --------------------------------- */
export default {
    render: async (el, params = {}) => {
        let rawPersone = [];

        /* ============================ DIRECTORY ============================ */
        const renderDirectory = async (filter = '') => {
            el.innerHTML = `
                <div class="fade-in-up ak-root">
                    ${heroHtml({
                        title: 'Gestione del Personale', tone: 'teal', icon: 'groups',
                        subtitle: 'Seleziona una persona per gestirne tutti i dati in un unico posto.',
                        actionsHtml: `<button id="gp-add-persona" class="ak-hero-btn"><span class="material-symbols-rounded">person_add</span>Nuova Persona</button>`
                    })}
                    ${guidaHtml({ tone: 'teal',
                        intro: 'Da qui gestisci l\'anagrafica del personale. Cerca o scegli una persona: si aprirà la sua scheda con dati, contatti, documenti, lavoro e indirizzi, tutti modificabili in un\'unica pagina.',
                        steps: [
                            'Usa la ricerca per nome, cognome o codice fiscale.',
                            'Clicca una persona per aprire la sua scheda completa.',
                            'Oppure premi <strong>“Nuova Persona”</strong> per inserirne una nuova.'
                        ] })}
                    <div class="ak-panel">
                        <div class="ak-toolbar">
                            <div style="position:relative; flex:1; min-width:220px;">
                                <span class="material-symbols-rounded" style="position:absolute; left:0.85rem; top:50%; transform:translateY(-50%); color:var(--md-on-surface-variant);">search</span>
                                <input type="text" id="gp-search" placeholder="Cerca per nome, cognome o codice fiscale…" value="${filter.replace(/"/g, '&quot;')}"
                                    style="width:100%; height:2.85rem; padding:0 0.9rem 0 2.6rem; border-radius:999px; border:1.5px solid var(--md-outline-variant); background:var(--md-surface-container-lowest); color:var(--md-on-surface); font-size:0.95rem; outline:none;">
                            </div>
                            <span class="ak-count" id="gp-count">0</span>
                        </div>
                        <div class="ak-panel-body" id="gp-directory"></div>
                    </div>
                </div>

                <div id="persona-modal" class="ak-modal" style="--ak-accent:${TONI.teal.accent}; --ak-soft:${TONI.teal.soft};" role="dialog" aria-modal="true" aria-labelledby="persona-modal-title">
                    <div class="ak-modal-card">
                        <div class="ak-modal-head">
                            <h3 id="persona-modal-title"><span class="material-symbols-rounded">badge</span><span id="persona-modal-title-text">Nuova Persona</span></h3>
                            <button id="persona-modal-close" class="ak-iconbtn" aria-label="Chiudi"><span class="material-symbols-rounded">close</span></button>
                        </div>
                        <div class="ak-modal-body">
                            <div class="ak-modal-hint"><span class="material-symbols-rounded">lightbulb</span><span>Il Codice Fiscale è la chiave univoca della persona: una volta creata non è più modificabile.</span></div>
                            <form id="persona-form">
                                ${personaFormHtml()}
                                <div id="persona-modal-error" class="ak-error" role="alert"></div>
                                <div class="ak-actions">
                                    <button type="button" id="persona-modal-cancel" class="ak-btn ak-btn-ghost">Annulla</button>
                                    <button type="submit" id="persona-modal-save" class="ak-btn ak-btn-primary"><span class="material-symbols-rounded">save</span>Salva</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
                ${AK_STYLES}
                <style>
                    .gp-people { display:grid; grid-template-columns:repeat(auto-fill, minmax(clamp(240px,26vw,300px), 1fr)); gap:0.9rem; }
                    .gp-person { display:flex; align-items:center; gap:0.85rem; padding:0.9rem 1rem; border-radius:14px;
                        background:var(--md-surface-container-lowest); border:1px solid var(--md-outline-variant); cursor:pointer;
                        transition:transform .16s ease, box-shadow .16s ease, border-color .16s ease; text-align:left; }
                    .gp-person:hover { transform:translateY(-3px); box-shadow:0 10px 22px -8px rgba(0,0,0,0.18); border-color:${TONI.teal.accent}; }
                    .gp-person:focus-visible { outline:3px solid var(--md-outline-focus); outline-offset:2px; }
                    .gp-person.blocked { opacity:0.7; }
                    .gp-avatar { width:46px; height:46px; border-radius:13px; flex-shrink:0; color:#fff; font-weight:800; font-size:1.2rem;
                        display:flex; align-items:center; justify-content:center; }
                    .gp-person-name { font-weight:700; color:var(--md-on-surface); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
                    .gp-person-cf { font-size:0.78rem; color:var(--md-on-surface-variant); letter-spacing:0.4px; }
                    .gp-person-sub { font-size:0.75rem; color:var(--md-on-surface-variant); margin-top:0.1rem; }
                    .gp-blocked-badge { font-size:0.62rem; font-weight:800; text-transform:uppercase; letter-spacing:0.04em;
                        background:var(--md-error-container); color:var(--md-on-error-container); padding:0.1rem 0.45rem; border-radius:999px; }
                </style>
            `;

            const directory = el.querySelector('#gp-directory');
            const searchInput = el.querySelector('#gp-search');
            const countEl = el.querySelector('#gp-count');
            const modal = el.querySelector('#persona-modal');
            const form = el.querySelector('#persona-form');
            const modalError = el.querySelector('#persona-modal-error');
            const AVATAR_TONES = [TONI.teal.accent, TONI.violet.accent, TONI.orange.accent, TONI.blue.accent, TONI.cyan.accent];

            const renderCards = (filterText) => {
                const q = (filterText || '').toLowerCase();
                const filtered = rawPersone.filter(p =>
                    (p.nome || '').toLowerCase().includes(q) ||
                    (p.cognome || '').toLowerCase().includes(q) ||
                    (p.codice_fiscale || '').toLowerCase().includes(q));
                countEl.textContent = filtered.length;
                if (filtered.length === 0) {
                    directory.innerHTML = `<div class="ak-empty"><span class="material-symbols-rounded">person_search</span><h4>Nessuna persona trovata</h4><p>Modifica la ricerca oppure crea una nuova persona.</p></div>`;
                    return;
                }
                directory.innerHTML = `<div class="gp-people">${filtered.map((p, i) => `
                    <div class="gp-person ${p.is_deleted ? 'blocked' : ''}" data-id="${p.id}" tabindex="0" role="button">
                        <div class="gp-avatar" style="background:${AVATAR_TONES[i % AVATAR_TONES.length]};">${(p.cognome || '?').charAt(0).toUpperCase()}</div>
                        <div style="flex:1; min-width:0;">
                            <div class="gp-person-name">${p.cognome || ''} ${p.nome || ''}</div>
                            <div class="gp-person-cf">${p.codice_fiscale || 'CF non specificato'}</div>
                            <div class="gp-person-sub">${p.is_deleted ? '<span class="gp-blocked-badge">Bloccata</span>' : (p.data_nascita ? 'Nato/a il ' + fmt.data(p.data_nascita) : '')}</div>
                        </div>
                        <span class="material-symbols-rounded" style="color:var(--md-on-surface-variant);">chevron_right</span>
                    </div>`).join('')}</div>`;
                directory.querySelectorAll('.gp-person').forEach(card => {
                    const open = () => openWorkspace(card.getAttribute('data-id'));
                    card.addEventListener('click', open);
                    card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
                });
            };

            const loadPersone = async (filterText = '') => {
                try {
                    rawPersone = await window.electronAPI.anagrafica.persone.getAll({ includeDeleted: true });
                    renderCards(filterText);
                } catch (e) {
                    directory.innerHTML = `<p style="color:var(--md-error); text-align:center; padding:2rem;">Errore caricamento: ${e.message}</p>`;
                }
            };

            searchInput.addEventListener('input', (e) => renderCards(e.target.value));

            const openModal = () => {
                modalError.style.display = 'none';
                fillPersonaForm(el, null);
                populatePersonaFormDatalists(el);
                modal.style.display = 'flex';
                requestAnimationFrame(() => {
                    modal.style.opacity = '1';
                    modal.querySelector('.ak-modal-card').style.transform = 'scale(1) translateY(0)';
                    const first = form.querySelector('#persona-cognome'); if (first) first.focus();
                });
            };
            const closeModal = () => {
                modal.style.opacity = '0';
                modal.querySelector('.ak-modal-card').style.transform = 'scale(0.95) translateY(10px)';
                setTimeout(() => { modal.style.display = 'none'; }, 250);
            };
            el.querySelector('#gp-add-persona').addEventListener('click', openModal);
            el.querySelector('#persona-modal-close').addEventListener('click', closeModal);
            el.querySelector('#persona-modal-cancel').addEventListener('click', closeModal);
            modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                modalError.style.display = 'none';
                const btnSave = el.querySelector('#persona-modal-save');
                btnSave.disabled = true;
                try {
                    const data = readPersonaForm(el);
                    if (!data.codice_fiscale || !isValidCodiceFiscale(data.codice_fiscale)) {
                        throw new Error('Il Codice Fiscale è obbligatorio e deve essere valido: è la chiave univoca della persona');
                    }
                    const res = await window.electronAPI.anagrafica.persone.create(data);
                    toast('Persona creata con successo', 'success');
                    closeModal();
                    if (res && res.id) { openWorkspace(res.id); }
                    else { await loadPersone(searchInput.value); }
                } catch (err) {
                    modalError.textContent = err.message || 'Errore durante il salvataggio.';
                    modalError.style.display = 'block';
                } finally { btnSave.disabled = false; }
            });

            await loadPersone(filter);
        };

        /* ============================ WORKSPACE ============================ */
        const openWorkspace = async (personaId) => {
            el.innerHTML = `<div class="ak-root" style="align-items:center; justify-content:center;"><span class="material-symbols-rounded" style="font-size:2rem; animation:spin 2s linear infinite;">sync</span></div>`;
            let scheda, contattiCount = 0;
            try {
                scheda = await window.electronAPI.anagrafica.persone.getScheda({ id: personaId });
                try { const cs = await window.electronAPI.anagrafica.contatti.getByPersona({ personaId }); contattiCount = cs.length; } catch (e) {}
            } catch (e) {
                el.innerHTML = `<p style="color:var(--md-error); text-align:center; padding:2rem;">Errore caricamento scheda: ${e.message}</p>`;
                return;
            }
            const p = scheda.persona;
            const counts = {
                contatti: contattiCount,
                documenti: scheda.documenti.length,
                lavoro: scheda.rapportiLavoro.length,
                residenza: scheda.indirizzi.length,
                famiglia: scheda.familiari ? scheda.familiari.length : 0,
                titoli: scheda.titoliStudio ? scheda.titoliStudio.length : 0,
                bancari: scheda.datiBancari ? scheda.datiBancari.length : 0
            };
            const TABS = [
                { id: 'dati', label: 'Dati', icon: 'badge' },
                { id: 'contatti', label: 'Contatti', icon: 'contacts' },
                { id: 'famiglia', label: 'Famiglia', icon: 'family_restroom' },
                { id: 'documenti', label: 'Documenti', icon: 'badge' },
                { id: 'lavoro', label: 'Lavoro', icon: 'work' },
                { id: 'titoli', label: 'Titoli', icon: 'school' },
                { id: 'bancari', label: 'Dati Bancari', icon: 'account_balance' },
                { id: 'residenza', label: 'Residenza', icon: 'home' }
            ];

            el.innerHTML = `
                <div class="fade-in-up ak-root gp-ws">
                    ${heroHtml({
                        title: `${p.cognome || ''} ${p.nome || ''}`.trim() || 'Persona',
                        subtitle: p.codice_fiscale || 'Codice Fiscale non specificato',
                        icon: 'person', tone: 'teal', auditMountId: 'gp-audit',
                        actionsHtml: `
                            ${p.is_deleted ? '<span class="gp-hero-flag">Bloccata</span>' : ''}
                            ${p.is_deleted
                                ? '<button id="gp-restore" class="ak-hero-btn" style="background:#fff;"><span class="material-symbols-rounded">restore</span>Ripristina</button>'
                                : '<button id="gp-block" class="ak-hero-btn" style="background:rgba(255,255,255,0.16); color:#fff;"><span class="material-symbols-rounded">block</span>Blocca</button>'}
                            <button id="gp-back" class="ak-hero-btn"><span class="material-symbols-rounded">arrow_back</span>Elenco</button>`
                    })}
                    <div class="gp-tabs" role="tablist">
                        ${TABS.map((t, i) => `
                            <button class="gp-tab ${i === 0 ? 'active' : ''}" data-tab="${t.id}" role="tab" aria-selected="${i === 0}">
                                <span class="material-symbols-rounded">${t.icon}</span>${t.label}
                                ${t.id !== 'dati' ? `<span class="gp-tabcount" id="gp-tc-${t.id}">${counts[t.id]}</span>` : ''}
                            </button>`).join('')}
                    </div>
                    <div id="gp-tab-content" class="gp-tab-content"></div>
                </div>
                ${AK_STYLES}
                <style>
                    .gp-ws { gap:0.9rem; }
                    .gp-hero-flag { background:var(--md-error); color:#fff; font-size:0.7rem; font-weight:800; text-transform:uppercase;
                        letter-spacing:0.05em; padding:0.25rem 0.6rem; border-radius:999px; }
                    .gp-tabs { display:flex; gap:0.5rem; flex-wrap:wrap; }
                    .gp-tab { display:inline-flex; align-items:center; gap:0.4rem; cursor:pointer; border:1px solid var(--md-outline-variant);
                        background:var(--md-surface-container-lowest); color:var(--md-on-surface-variant); font-weight:600; font-size:0.9rem;
                        padding:0.5rem 0.95rem; border-radius:999px; transition:all .15s ease; }
                    .gp-tab .material-symbols-rounded { font-size:1.1rem; }
                    .gp-tab:hover { border-color:${TONI.teal.accent}; color:var(--md-on-surface); }
                    .gp-tab:focus-visible { outline:3px solid var(--md-outline-focus); outline-offset:2px; }
                    .gp-tab.active { background:${TONI.teal.grad}; color:#fff; border-color:transparent; box-shadow:0 6px 14px -6px rgba(0,0,0,0.4); }
                    .gp-tabcount { font-size:0.7rem; font-weight:800; background:rgba(0,0,0,0.12); padding:0.05rem 0.4rem; border-radius:999px; }
                    .gp-tab.active .gp-tabcount { background:rgba(255,255,255,0.28); }
                    .gp-tab-content { flex:1; min-height:0; display:flex; flex-direction:column; }
                </style>
            `;

            mountAuditButton(el.querySelector('#gp-audit'), { tableName: 'persone', recordId: personaId, label: `${p.cognome} ${p.nome}` });
            el.querySelector('#gp-back').addEventListener('click', () => renderDirectory());
            const blockBtn = el.querySelector('#gp-block');
            if (blockBtn) blockBtn.addEventListener('click', async () => {
                if (!confirm('Bloccare questa persona? Potrai ripristinarla in qualsiasi momento.')) return;
                try { await window.electronAPI.anagrafica.persone.remove({ id: personaId }); toast('Persona bloccata', 'success'); openWorkspace(personaId); }
                catch (e) { toast(e.message || 'Errore', 'error'); }
            });
            const restoreBtn = el.querySelector('#gp-restore');
            if (restoreBtn) restoreBtn.addEventListener('click', async () => {
                try { await window.electronAPI.anagrafica.persone.restore({ id: personaId }); toast('Persona ripristinata', 'success'); openWorkspace(personaId); }
                catch (e) { toast(e.message || 'Errore', 'error'); }
            });

            const content = el.querySelector('#gp-tab-content');
            const setCount = (tabId, n) => { const b = el.querySelector(`#gp-tc-${tabId}`); if (b) b.textContent = n; };

            const mountDati = () => {
                content.innerHTML = `
                    <div class="ak-root" style="--ak-accent:${TONI.blue.accent}; --ak-soft:${TONI.blue.soft}; gap:0.75rem;">
                        ${guidaHtml({ tone: 'blue',
                            intro: 'Dati anagrafici della persona. Il Codice Fiscale non è modificabile perché identifica in modo univoco la persona.',
                            steps: ['Aggiorna i campi necessari.', 'Premi <strong>“Salva Modifiche”</strong> in fondo.'] })}
                        <div class="ak-panel"><div class="ak-panel-body">
                            <form id="gp-dati-form" style="width:100%;">
                                ${personaFormHtml()}
                                <div id="gp-dati-error" class="ak-error" role="alert"></div>
                                <div class="ak-actions">
                                    <button type="submit" class="ak-btn ak-btn-primary" id="gp-dati-save" style="--ak-accent:${TONI.blue.accent};"><span class="material-symbols-rounded">save</span>Salva Modifiche</button>
                                </div>
                            </form>
                        </div></div>
                    </div>`;
                const dform = content.querySelector('#gp-dati-form');
                const derr = content.querySelector('#gp-dati-error');
                fillPersonaForm(content, p);
                populatePersonaFormDatalists(content);
                dform.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    derr.style.display = 'none';
                    const btn = content.querySelector('#gp-dati-save');
                    btn.disabled = true;
                    try {
                        const data = readPersonaForm(content);
                        if (data.codice_fiscale && !isValidCodiceFiscale(data.codice_fiscale)) throw new Error('Codice Fiscale non valido');
                        data.id = personaId;
                        await window.electronAPI.anagrafica.persone.update(data);
                        toast('Dati aggiornati con successo', 'success');
                        openWorkspace(personaId);
                    } catch (err) {
                        derr.textContent = err.message || 'Errore durante il salvataggio.';
                        derr.style.display = 'block';
                    } finally { btn.disabled = false; }
                });
            };

            const mountTab = (tabId) => {
                content.innerHTML = '';
                if (tabId === 'dati') return mountDati();
                if (tabId === 'contatti') return mountContattiSection(content, { persona: p, tone: 'violet', embedded: true, onChange: (n) => setCount('contatti', n) });
                if (tabId === 'famiglia') return renderPersonScopedCrudSubapp(content, famigliaConfig(p, (n) => setCount('famiglia', n)));
                if (tabId === 'documenti') return renderPersonScopedCrudSubapp(content, documentiConfig(p, (n) => setCount('documenti', n)));
                if (tabId === 'lavoro') return renderPersonScopedCrudSubapp(content, lavoroConfig(p, (n) => setCount('lavoro', n)));
                if (tabId === 'titoli') return renderPersonScopedCrudSubapp(content, titoliConfig(p, (n) => setCount('titoli', n)));
                if (tabId === 'bancari') return renderPersonScopedCrudSubapp(content, bancariConfig(p, (n) => setCount('bancari', n)));
                if (tabId === 'residenza') return renderPersonScopedCrudSubapp(content, residenzaConfig(p, (n) => setCount('residenza', n)));
            };

            el.querySelectorAll('.gp-tab').forEach(tab => {
                tab.addEventListener('click', () => {
                    el.querySelectorAll('.gp-tab').forEach(t => { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); });
                    tab.classList.add('active'); tab.setAttribute('aria-selected', 'true');
                    mountTab(tab.getAttribute('data-tab'));
                });
            });
            mountTab('dati');
        };

        try {
            // Se un'altra app (es. Presa di Servizio) ci passa una persona, apri
            // direttamente la sua scheda invece dell'elenco.
            if (params && params.personaId) await openWorkspace(params.personaId);
            else await renderDirectory();
        } catch (e) {
            console.error(e);
            el.innerHTML = '<p style="text-align:center; color:var(--md-error); padding:2rem;">Errore critico caricamento Gestione del Personale</p>';
        }
    }
};
