import { toast, fmt, Router } from '../../js/utils.js';

const API = () => window.electronAPI.presaServizio;
const _esc = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');

/* Mansioni ammesse per il personale scolastico (issue: Mansione vincolata) */
const MANSIONI = ['Assistente Tecnico', 'Collaboratore Scolastico', 'Docente', 'Assistente Amministrativo', 'DSGA'];

/* Campi editabili nella revisione post-import, raggruppati per sezione */
const REVIEW_GROUPS = [
    { title: 'Dati Anagrafici', icon: 'badge', fields: [
        ['cognome', 'Cognome', true], ['nome', 'Nome', true], ['sesso', 'Sesso (M/F)'],
        ['data_nascita', 'Data di nascita'], ['luogo_nascita', 'Comune di nascita'], ['provincia_nascita', 'Provincia nascita'],
        ['stato_civile', 'Stato civile'], ['codice_fiscale', 'Codice Fiscale', true], ['cittadinanza', 'Cittadinanza'],
        ['posizione_militare', 'Posizione militare'], ['comune_iscrizione_elettorale', 'Comune iscrizione elettorale']
    ]},
    { title: 'Residenza', icon: 'home', fields: [
        ['indirizzo_residenza', 'Indirizzo'], ['civico_residenza', 'Civico'], ['comune_residenza', 'Città'],
        ['provincia_residenza', 'Provincia'], ['cap_residenza', 'CAP']
    ]},
    { title: 'Domicilio', icon: 'location_on', fields: [
        ['indirizzo_domicilio', 'Indirizzo'], ['civico_domicilio', 'Civico'], ['comune_domicilio', 'Città'],
        ['provincia_domicilio', 'Provincia'], ['cap_domicilio', 'CAP']
    ]},
    { title: 'Recapiti', icon: 'contacts', fields: [
        ['telefono_fisso', 'Telefono fisso'], ['cellulare', 'Cellulare'], ['email_personale', 'Email personale'],
        ['email_pec', 'Email PEC'], ['email_istituzionale', 'Email istituzionale']
    ]},
    { title: "Documento d'Identità", icon: 'contact_page', fields: [
        ['tipo_documento', 'Tipo documento'], ['numero_documento', 'Numero'], ['rilasciato_da_documento', 'Rilasciato da'],
        ['data_rilascio_documento', 'Data rilascio'], ['data_scadenza_documento', 'Data scadenza']
    ]},
    { title: 'Titolo di Studio', icon: 'school', fields: [
        ['titolo_denominazione', 'Denominazione'], ['titolo_votazione', 'Voto'], ['titolo_data', 'Data conseguimento'],
        ['titolo_istituto', 'Istituto'], ['titolo_citta', 'Città istituto']
    ]},
    { title: 'Servizio', icon: 'work', fields: [
        ['mansione', 'Mansione', false, MANSIONI], ['ruolo', 'Ruolo / Convocazione'], ['data_assunzione', 'Data assunzione']
    ]},
    { title: 'Dati di Pagamento', icon: 'account_balance', fields: [
        ['iban', 'IBAN'], ['banca', 'Banca / Posta'], ['intestatario_conto', 'Intestatario']
    ]}
];

const REQUIRED = ['cognome', 'nome', 'codice_fiscale'];

export default {
    render: async (el, params = {}) => {
        let persone = [];

        const shell = (bodyHtml) => `
            <div class="pds-root fade-in-up">
                <header class="pds-hero">
                    <div class="pds-hero-txt">
                        <div class="pds-hero-chip"><span class="material-symbols-rounded">assignment_turned_in</span></div>
                        <div>
                            <h1>Presa di Servizio</h1>
                            <p>Raccogli i dati del personale, importali e genera il documento ufficiale ATA o Docenti.</p>
                        </div>
                    </div>
                    <div class="pds-hero-actions">
                        <button id="pds-import" class="pds-btn pds-btn-ghost"><span class="material-symbols-rounded">upload_file</span>Importa modulo compilato</button>
                        <button id="pds-invia" class="pds-btn pds-btn-primary"><span class="material-symbols-rounded">send</span>Invia presa di servizio</button>
                    </div>
                </header>
                ${bodyHtml}
            </div>
            ${STYLES}
        `;

        const renderHome = async () => {
            el.innerHTML = shell(`
                <section class="pds-panel">
                    <div class="pds-toolbar">
                        <div class="pds-search">
                            <span class="material-symbols-rounded">search</span>
                            <input id="pds-search" type="text" placeholder="Cerca personale per nome, cognome o codice fiscale…">
                        </div>
                        <span class="pds-count" id="pds-count">0</span>
                    </div>
                    <div id="pds-list" class="pds-list"></div>
                </section>
            `);
            el.querySelector('#pds-invia').addEventListener('click', openInviaModal);
            el.querySelector('#pds-import').addEventListener('click', doImport);
            const search = el.querySelector('#pds-search');
            search.addEventListener('input', () => renderList(search.value));
            try {
                persone = await window.electronAPI.anagrafica.persone.getAll({ includeDeleted: false });
            } catch (e) {
                el.querySelector('#pds-list').innerHTML = `<p class="pds-error">Errore caricamento personale: ${e.message}</p>`;
                return;
            }
            renderList('');
        };

        const renderList = (filter) => {
            const q = (filter || '').toLowerCase();
            const list = persone.filter(p =>
                (p.cognome || '').toLowerCase().includes(q) ||
                (p.nome || '').toLowerCase().includes(q) ||
                (p.codice_fiscale || '').toLowerCase().includes(q));
            const listEl = el.querySelector('#pds-list');
            el.querySelector('#pds-count').textContent = list.length;
            if (list.length === 0) {
                listEl.innerHTML = `<div class="pds-empty"><span class="material-symbols-rounded">groups</span>
                    <h3>Nessun personale trovato</h3>
                    <p>Importa un modulo compilato oppure inserisci il personale dall'anagrafica.</p></div>`;
                return;
            }
            listEl.innerHTML = list.map(p => `
                <div class="pds-person" data-id="${_esc(p.id)}">
                    <div class="pds-person-open" data-id="${_esc(p.id)}" role="button" tabindex="0" title="Apri la scheda in Gestione del Personale">
                        <div class="pds-avatar">${_esc((p.cognome || '?').charAt(0).toUpperCase())}</div>
                        <div class="pds-person-info">
                            <div class="pds-person-name">${_esc(p.cognome)} ${_esc(p.nome)}</div>
                            <div class="pds-person-cf">${_esc(p.codice_fiscale || 'CF non specificato')}${p.data_nascita ? ' · nato/a il ' + _esc(fmt.data(p.data_nascita)) : ''}</div>
                        </div>
                        <span class="material-symbols-rounded pds-person-chevron">chevron_right</span>
                    </div>
                    <button class="pds-btn pds-btn-soft pds-gen" data-id="${_esc(p.id)}">
                        <span class="material-symbols-rounded">description</span>Genera
                    </button>
                </div>`).join('');
            listEl.querySelectorAll('.pds-gen').forEach(b => {
                b.addEventListener('click', () => {
                    const p = persone.find(x => x.id === b.getAttribute('data-id'));
                    if (p) openGenerateModal(p);
                });
            });
            listEl.querySelectorAll('.pds-person-open').forEach(row => {
                const goToScheda = () => Router.navigate('app_container', { appId: 'gestione_personale', personaId: row.getAttribute('data-id') });
                row.addEventListener('click', goToScheda);
                row.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); goToScheda(); } });
            });
        };

        /* --------------------------- Invia modulo --------------------------- */
        const openInviaModal = () => {
            const m = mountModal('Invia presa di servizio', `
                <p class="pds-hint"><span class="material-symbols-rounded">lightbulb</span>
                    Invia al dipendente il modulo Excel da compilare. Puoi scaricarlo per consegnarlo di persona, oppure spedirlo via email.</p>
                <label class="pds-label">Tipo di personale</label>
                <select id="pds-tipo" class="pds-input">
                    <option value="ATA">ATA</option>
                    <option value="DOCENTI">Docente</option>
                </select>
                <div class="pds-mode">
                    <div class="pds-mode-card">
                        <div class="pds-mode-head"><span class="material-symbols-rounded">download</span><strong>Modalità offline</strong></div>
                        <p>Scarica il file .xlsx da consegnare a mano.</p>
                        <button id="pds-download" class="pds-btn pds-btn-primary" style="width:100%;"><span class="material-symbols-rounded">download</span>Scarica modulo .xlsx</button>
                    </div>
                    <div class="pds-mode-card">
                        <div class="pds-mode-head"><span class="material-symbols-rounded">mail</span><strong>Invio via email</strong></div>
                        <p>Spedisci il modulo tramite il server SMTP configurato.</p>
                        <input id="pds-email" type="email" class="pds-input" placeholder="indirizzo@email.it">
                        <button id="pds-sendmail" class="pds-btn pds-btn-primary" style="width:100%;"><span class="material-symbols-rounded">send</span>Invia via email</button>
                    </div>
                </div>
            `);
            const tipo = () => m.el.querySelector('#pds-tipo').value;
            m.el.querySelector('#pds-download').addEventListener('click', async (ev) => {
                const btn = ev.currentTarget; btn.disabled = true;
                try {
                    const r = await API().exportTemplate({ tipo: tipo() });
                    if (r.success) toast('Modulo salvato: ' + r.path, 'success');
                    else if (!r.canceled) toast(r.error || 'Errore', 'error');
                } catch (e) { toast(e.message, 'error'); } finally { btn.disabled = false; }
            });
            m.el.querySelector('#pds-sendmail').addEventListener('click', async (ev) => {
                const to = m.el.querySelector('#pds-email').value.trim();
                if (!to || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) { toast('Inserisci un indirizzo email valido', 'warning'); return; }
                const btn = ev.currentTarget; btn.disabled = true;
                try {
                    const r = await API().emailTemplate({ tipo: tipo(), to });
                    if (r.success) { toast('Modulo inviato a ' + to, 'success'); m.close(); }
                    else toast(r.error || 'Errore invio', 'error');
                } catch (e) { toast(e.message, 'error'); } finally { btn.disabled = false; }
            });
        };

        /* ------------------------- Import + revisione ------------------------ */
        const doImport = async () => {
            try {
                const r = await API().importXlsx();
                if (r.canceled) return;
                if (!r.success) { toast(r.error || 'Errore lettura file', 'error'); return; }
                renderReview(r.data, r.fileName);
            } catch (e) { toast(e.message, 'error'); }
        };

        const renderReview = (data, fileName) => {
            const missingRequired = REQUIRED.filter(k => !data[k]);
            el.innerHTML = shell(`
                <section class="pds-panel">
                    <div class="pds-review-head">
                        <div>
                            <h2><span class="material-symbols-rounded">fact_check</span> Revisione dati importati</h2>
                            <p>File: <strong>${fileName || 'modulo.xlsx'}</strong>. Correggi o completa i campi mancanti, poi salva in anagrafica.</p>
                        </div>
                        <button id="pds-back" class="pds-btn pds-btn-ghost"><span class="material-symbols-rounded">arrow_back</span>Annulla</button>
                    </div>
                    ${missingRequired.length ? `<div class="pds-warn"><span class="material-symbols-rounded">warning</span> Campi obbligatori mancanti: <strong>${missingRequired.join(', ')}</strong></div>` : ''}
                    <form id="pds-review-form">
                        ${REVIEW_GROUPS.map(g => `
                            <fieldset class="pds-group">
                                <legend><span class="material-symbols-rounded">${g.icon}</span>${g.title}</legend>
                                <div class="pds-grid">
                                    ${g.fields.map(([key, label, req, options]) => `
                                        <label class="pds-field ${req ? 'req' : ''}">
                                            <span>${label}${req ? ' *' : ''}</span>
                                            ${options ? `
                                            <select name="${key}" class="pds-input">
                                                <option value="">— Seleziona —</option>
                                                ${options.map(o => `<option value="${escapeAttr(o)}" ${data[key] === o ? 'selected' : ''}>${o}</option>`).join('')}
                                            </select>` : `
                                            <input name="${key}" class="pds-input ${(req && !data[key]) ? 'pds-input-err' : ''}" value="${escapeAttr(data[key] || '')}">`}
                                        </label>`).join('')}
                                </div>
                            </fieldset>`).join('')}
                        ${data.familiari && data.familiari.length ? `
                            <fieldset class="pds-group">
                                <legend><span class="material-symbols-rounded">family_restroom</span>Nucleo familiare (${data.familiari.length})</legend>
                                <ul class="pds-fam">${data.familiari.map(f => `<li>${f.nome_cognome} — ${f.relazione || ''} ${f.data_nascita ? '(' + f.data_nascita + ')' : ''}</li>`).join('')}</ul>
                                <p class="pds-note">I familiari vanno inseriti nella scheda anagrafica della persona (sezione Famiglia).</p>
                            </fieldset>` : ''}
                        <div class="pds-review-actions">
                            <select id="pds-review-tipo" class="pds-input" style="max-width:200px;">
                                <option value="ATA">Personale ATA</option>
                                <option value="DOCENTI">Personale Docente</option>
                            </select>
                            <button type="submit" class="pds-btn pds-btn-primary"><span class="material-symbols-rounded">save</span>Salva in anagrafica</button>
                        </div>
                    </form>
                </section>
            `);
            el.querySelector('#pds-back').addEventListener('click', renderHome);
            el.querySelector('#pds-review-form').addEventListener('submit', async (ev) => {
                ev.preventDefault();
                const form = ev.currentTarget;
                const out = { familiari: data.familiari || [] };
                new FormData(form).forEach((v, k) => { out[k] = String(v).trim(); });
                const miss = REQUIRED.filter(k => !out[k]);
                if (miss.length) { toast('Compila i campi obbligatori: ' + miss.join(', '), 'warning'); return; }
                const btn = form.querySelector('button[type=submit]'); btn.disabled = true;
                try {
                    const tipo = form.querySelector('#pds-review-tipo').value;
                    const r = await API().saveImportedPersona({ data: out, tipo });
                    if (r.success) {
                        toast('Dati salvati in anagrafica', 'success');
                        await refreshPersone();
                        const p = persone.find(x => x.id === r.personaId);
                        renderHome().then(() => { if (p) openGenerateModal(p, tipo); });
                    } else { toast(r.error || 'Errore salvataggio', 'error'); }
                } catch (e) { toast(e.message, 'error'); } finally { btn.disabled = false; }
            });
        };

        /* --------------------------- Genera docx ---------------------------- */
        const openGenerateModal = (persona, presetTipo) => {
            const today = new Date();
            const isoToday = today.toISOString().slice(0, 10);
            const m = mountModal(`Genera presa di servizio`, `
                <p class="pds-hint"><span class="material-symbols-rounded">badge</span>
                    <strong>${persona.cognome} ${persona.nome}</strong> — ${persona.codice_fiscale || ''}. Il modello M/F è scelto automaticamente dal sesso.</p>
                <label class="pds-label">Tipo di personale</label>
                <select id="pds-g-tipo" class="pds-input">
                    <option value="ATA" ${presetTipo === 'ATA' ? 'selected' : ''}>ATA</option>
                    <option value="DOCENTI" ${presetTipo === 'DOCENTI' ? 'selected' : ''}>Docente</option>
                </select>
                <label class="pds-label">Formato di output</label>
                <select id="pds-g-format" class="pds-input">
                    <option value="pdfa">PDF/A — documento ufficiale a norma (consigliato)</option>
                    <option value="docx">Word (.docx) — modificabile</option>
                </select>
                <div class="pds-grid">
                    <label class="pds-field"><span>Anno scolastico (inizio)</span><input id="pds-g-asi" class="pds-input" value="${today.getFullYear()}"></label>
                    <label class="pds-field"><span>Anno scolastico (fine)</span><input id="pds-g-asf" class="pds-input" value="${today.getFullYear() + 1}"></label>
                    <label class="pds-field"><span>Tempo det./indet.</span>
                        <select id="pds-g-tempo" class="pds-input"><option value="">—</option><option value="Indeterminato">Indeterminato</option><option value="Determinato">Determinato</option></select></label>
                    <label class="pds-field"><span>Ore settimanali</span><input id="pds-g-ore" class="pds-input" placeholder="Es. 36"></label>
                    <label class="pds-field"><span>Corso sicurezza</span><input id="pds-g-corso" class="pds-input" placeholder="Es. Formazione generale"></label>
                    <label class="pds-field"><span>Luogo di compilazione</span><input id="pds-g-luogo" class="pds-input" placeholder="Es. Roma"></label>
                    <label class="pds-field"><span>Data di compilazione</span><input id="pds-g-data" type="date" class="pds-input" value="${isoToday}"></label>
                </div>
                <p class="pds-note">I campi lasciati vuoti qui vengono presi dalla sezione <strong>Lavoro</strong> della persona, se compilati.</p>
                <button id="pds-g-go" class="pds-btn pds-btn-primary" style="width:100%; margin-top:0.8rem;"><span class="material-symbols-rounded">description</span>Genera documento</button>
            `);
            const readExtra = () => ({
                anno_scolastico_inizio: m.el.querySelector('#pds-g-asi').value.trim(),
                anno_scolastico_fine: m.el.querySelector('#pds-g-asf').value.trim(),
                tempo_rapporto: m.el.querySelector('#pds-g-tempo').value,
                ore_settimanali: m.el.querySelector('#pds-g-ore').value.trim(),
                corso_sicurezza: m.el.querySelector('#pds-g-corso').value.trim(),
                luogo_compilazione: m.el.querySelector('#pds-g-luogo').value.trim(),
                data_compilazione: m.el.querySelector('#pds-g-data').value
            });

            const doGenerate = async (tipo, extra) => {
                const format = (m.el.querySelector('#pds-g-format') || {}).value || 'pdfa';
                try {
                    const r = format === 'pdfa'
                        ? await API().generatePdf({ personaId: persona.id, tipo, extra })
                        : await API().generateDocx({ personaId: persona.id, tipo, extra });
                    if (r.success) { toast((format === 'pdfa' ? 'PDF/A generato: ' : 'Documento generato: ') + r.path, 'success'); m.close(); }
                    else if (r.code === 'NO_LIBREOFFICE') { toast(r.error, 'warning'); }
                    else if (!r.canceled) toast(r.error || 'Errore generazione', 'error');
                } catch (e) { toast(e.message, 'error'); }
            };

            const showMissingReminder = (missing, tipo, extra) => {
                const persB = missing.filter(f => f.scope !== 'istituto');
                const istB = missing.filter(f => f.scope === 'istituto');
                const chips = (arr) => arr.map(f => `<li><span class="material-symbols-rounded">radio_button_unchecked</span>${f.label}</li>`).join('');
                const rm = mountModal('Campi mancanti nel documento', `
                    <p class="pds-hint pds-warn"><span class="material-symbols-rounded">notifications_active</span>
                        Per <strong>${persona.cognome} ${persona.nome}</strong> alcuni campi del documento risultano <strong>vuoti</strong>.
                        Vuoi completarli prima nell'anagrafica, oppure generare comunque lasciandoli in bianco?</p>
                    ${persB.length ? `<div class="pds-miss-group"><h4><span class="material-symbols-rounded">person</span> Dati della persona (${persB.length})</h4><ul class="pds-miss">${chips(persB)}</ul></div>` : ''}
                    ${istB.length ? `<div class="pds-miss-group"><h4><span class="material-symbols-rounded">apartment</span> Dati dell'istituto (${istB.length})</h4><ul class="pds-miss">${chips(istB)}</ul><p class="pds-note">Si configurano in <strong>Amministratore ▸ Dati Istituto</strong>.</p></div>` : ''}
                    <div class="pds-review-actions" style="margin-top:1rem;">
                        <button id="pds-miss-update" class="pds-btn pds-btn-ghost"><span class="material-symbols-rounded">edit</span>Aggiorna anagrafica</button>
                        <button id="pds-miss-proceed" class="pds-btn pds-btn-primary"><span class="material-symbols-rounded">description</span>Procedi comunque</button>
                    </div>
                `);
                rm.el.querySelector('#pds-miss-update').addEventListener('click', () => {
                    rm.close(); m.close();
                    Router.navigate('app_container', { appId: 'gestione_personale', personaId: persona.id });
                });
                rm.el.querySelector('#pds-miss-proceed').addEventListener('click', async (ev) => {
                    const b = ev.currentTarget; b.disabled = true;
                    rm.close();
                    await doGenerate(tipo, extra);
                });
            };

            m.el.querySelector('#pds-g-go').addEventListener('click', async (ev) => {
                const btn = ev.currentTarget; btn.disabled = true;
                try {
                    const tipo = m.el.querySelector('#pds-g-tipo').value;
                    const extra = readExtra();
                    const pv = await API().previewDocx({ personaId: persona.id, tipo, extra });
                    if (pv && pv.success && Array.isArray(pv.missing) && pv.missing.length) showMissingReminder(pv.missing, tipo, extra);
                    else await doGenerate(tipo, extra);
                } catch (e) { toast(e.message, 'error'); } finally { btn.disabled = false; }
            });
        };

        const refreshPersone = async () => {
            try { persone = await window.electronAPI.anagrafica.persone.getAll({ includeDeleted: false }); } catch (e) {}
        };

        /* ------------------------------ helpers ----------------------------- */
        function mountModal(title, bodyHtml) {
            const wrap = document.createElement('div');
            wrap.className = 'pds-modal';
            wrap.innerHTML = `
                <div class="pds-modal-card">
                    <div class="pds-modal-head">
                        <h3>${title}</h3>
                        <button class="pds-modal-x"><span class="material-symbols-rounded">close</span></button>
                    </div>
                    <div class="pds-modal-body">${bodyHtml}</div>
                </div>`;
            document.body.appendChild(wrap);
            const close = () => wrap.remove();
            wrap.querySelector('.pds-modal-x').addEventListener('click', close);
            wrap.addEventListener('click', (e) => { if (e.target === wrap) close(); });
            requestAnimationFrame(() => wrap.classList.add('open'));
            return { el: wrap, close };
        }
        function escapeAttr(s) { return String(s).replace(/"/g, '&quot;').replace(/</g, '&lt;'); }

        await renderHome();
    }
};

const STYLES = `<style>
.pds-root { display:flex; flex-direction:column; gap:1.1rem; padding:0.2rem; }
.pds-hero { display:flex; justify-content:space-between; align-items:center; gap:1rem; flex-wrap:wrap;
    background:linear-gradient(135deg, var(--md-primary), var(--md-secondary, #6366f1)); color:#fff; border-radius:20px; padding:1.3rem 1.5rem;
    box-shadow:0 10px 30px -12px rgba(0,0,0,0.4); }
.pds-hero-txt { display:flex; align-items:center; gap:1rem; }
.pds-hero-chip { width:52px; height:52px; border-radius:15px; background:rgba(255,255,255,0.18); display:flex; align-items:center; justify-content:center; }
.pds-hero-chip .material-symbols-rounded { font-size:1.8rem; }
.pds-hero h1 { margin:0; font-size:1.55rem; font-weight:800; letter-spacing:-0.02em; }
.pds-hero p { margin:0.2rem 0 0; font-size:0.9rem; opacity:0.92; max-width:560px; }
.pds-hero-actions { display:flex; gap:0.6rem; flex-wrap:wrap; }
.pds-btn { display:inline-flex; align-items:center; gap:0.45rem; border:none; cursor:pointer; font-weight:600; font-size:0.88rem;
    padding:0.6rem 1.1rem; border-radius:12px; transition:transform .15s ease, box-shadow .15s ease, opacity .15s; font-family:inherit; }
.pds-btn:hover { transform:translateY(-1px); }
.pds-btn:disabled { opacity:0.55; cursor:default; transform:none; }
.pds-btn .material-symbols-rounded { font-size:1.15rem; }
.pds-btn-primary { background:var(--md-primary); color:#fff; box-shadow:0 6px 16px -6px var(--md-primary); }
.pds-hero .pds-btn-primary { background:#fff; color:var(--md-primary); }
.pds-btn-ghost { background:rgba(255,255,255,0.16); color:#fff; }
.pds-panel .pds-btn-ghost { background:var(--md-surface-variant); color:var(--md-on-surface); }
.pds-btn-soft { background:var(--md-surface-variant); color:var(--md-primary); }
.pds-panel { background:var(--md-surface); border:1px solid var(--md-outline-variant); border-radius:20px; padding:1.1rem 1.2rem;
    box-shadow:0 4px 20px rgba(0,0,0,0.04); }
.pds-toolbar { display:flex; align-items:center; gap:0.8rem; margin-bottom:0.9rem; }
.pds-search { position:relative; flex:1; }
.pds-search .material-symbols-rounded { position:absolute; left:0.8rem; top:50%; transform:translateY(-50%); color:var(--md-on-surface-variant); }
.pds-search input { width:100%; height:2.8rem; padding:0 0.9rem 0 2.6rem; border-radius:999px; border:1.5px solid var(--md-outline-variant);
    background:var(--md-surface-container-lowest, var(--md-surface)); color:var(--md-on-surface); outline:none; font-size:0.92rem; }
.pds-count { font-weight:800; background:var(--md-surface-variant); color:var(--md-on-surface); padding:0.15rem 0.6rem; border-radius:999px; font-size:0.82rem; }
.pds-list { display:flex; flex-direction:column; gap:0.55rem; }
.pds-person { display:flex; align-items:center; gap:0.9rem; padding:0.7rem 0.9rem; border-radius:14px;
    border:1px solid var(--md-outline-variant); background:var(--md-surface-container-lowest, var(--md-surface)); }
.pds-person:hover { border-color:var(--md-primary); }
.pds-avatar { width:42px; height:42px; border-radius:12px; background:var(--md-primary); color:#fff; font-weight:800; font-size:1.1rem;
    display:flex; align-items:center; justify-content:center; flex-shrink:0; }
.pds-person-open { display:flex; align-items:center; gap:0.9rem; flex:1; min-width:0; cursor:pointer; border-radius:10px; padding:0.2rem; }
.pds-person-open:hover .pds-person-name { color:var(--md-primary); }
.pds-person-open:focus-visible { outline:2px solid var(--md-primary); outline-offset:2px; }
.pds-person-chevron { color:var(--md-on-surface-variant); margin-left:auto; flex-shrink:0; }
.pds-person-info { flex:1; min-width:0; }
.pds-person-name { font-weight:700; color:var(--md-on-surface); }
.pds-person-cf { font-size:0.78rem; color:var(--md-on-surface-variant); }
.pds-empty, .pds-error { text-align:center; padding:2.5rem 1rem; color:var(--md-on-surface-variant); }
.pds-empty .material-symbols-rounded { font-size:2.6rem; opacity:0.5; }
.pds-empty h3 { margin:0.5rem 0 0.2rem; color:var(--md-on-surface); }
.pds-error { color:var(--md-error); }
.pds-hint, .pds-warn { display:flex; align-items:flex-start; gap:0.5rem; font-size:0.85rem; padding:0.7rem 0.9rem; border-radius:12px;
    background:var(--md-surface-variant); color:var(--md-on-surface); margin-bottom:0.9rem; }
.pds-warn { background:rgba(245,158,11,0.14); color:#b45309; }
.pds-hint .material-symbols-rounded, .pds-warn .material-symbols-rounded { font-size:1.15rem; }
.pds-label { display:block; font-weight:600; font-size:0.82rem; margin:0.3rem 0 0.35rem; color:var(--md-on-surface-variant); }
.pds-input { width:100%; padding:0.6rem 0.75rem; border-radius:10px; border:1.5px solid var(--md-outline-variant);
    background:var(--md-surface-container-lowest, var(--md-surface)); color:var(--md-on-surface); outline:none; font-size:0.88rem; font-family:inherit; }
.pds-input:focus { border-color:var(--md-primary); }
.pds-input-err { border-color:var(--md-error); background:rgba(239,68,68,0.05); }
.pds-mode { display:grid; grid-template-columns:1fr 1fr; gap:0.8rem; margin-top:0.9rem; }
@media (max-width:620px){ .pds-mode { grid-template-columns:1fr; } }
.pds-mode-card { border:1px solid var(--md-outline-variant); border-radius:14px; padding:0.9rem; display:flex; flex-direction:column; gap:0.5rem; }
.pds-mode-head { display:flex; align-items:center; gap:0.4rem; color:var(--md-on-surface); }
.pds-mode-card p { margin:0; font-size:0.8rem; color:var(--md-on-surface-variant); }
.pds-review-head { display:flex; justify-content:space-between; align-items:flex-start; gap:1rem; margin-bottom:0.9rem; flex-wrap:wrap; }
.pds-review-head h2 { margin:0; display:flex; align-items:center; gap:0.4rem; font-size:1.2rem; color:var(--md-on-surface); }
.pds-review-head p { margin:0.25rem 0 0; font-size:0.85rem; color:var(--md-on-surface-variant); }
.pds-group { border:1px solid var(--md-outline-variant); border-radius:14px; padding:0.9rem 1rem 1rem; margin:0 0 0.9rem; }
.pds-group legend { display:flex; align-items:center; gap:0.4rem; font-weight:700; font-size:0.9rem; color:var(--md-primary); padding:0 0.4rem; }
.pds-group legend .material-symbols-rounded { font-size:1.1rem; }
.pds-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:0.7rem; }
.pds-field { display:flex; flex-direction:column; gap:0.25rem; }
.pds-field > span { font-size:0.76rem; font-weight:600; color:var(--md-on-surface-variant); }
.pds-field.req > span { color:var(--md-on-surface); }
.pds-fam { margin:0.3rem 0 0; padding-left:1.1rem; color:var(--md-on-surface); font-size:0.85rem; }
.pds-miss-group { margin:0.6rem 0; }
.pds-miss-group h4 { display:flex; align-items:center; gap:0.4rem; margin:0 0 0.4rem; font-size:0.9rem; color:var(--md-on-surface); }
.pds-miss-group h4 .material-symbols-rounded { font-size:1.1rem; color:var(--md-primary); }
.pds-miss { list-style:none; margin:0; padding:0; display:flex; flex-wrap:wrap; gap:0.4rem; }
.pds-miss li { display:inline-flex; align-items:center; gap:0.35rem; font-size:0.8rem; padding:0.3rem 0.6rem; border-radius:999px;
    background:rgba(245,158,11,0.14); color:#b45309; border:1px solid rgba(245,158,11,0.3); }
.pds-miss li .material-symbols-rounded { font-size:0.95rem; }
.pds-note { font-size:0.78rem; color:var(--md-on-surface-variant); margin:0.5rem 0 0; }
.pds-review-actions { display:flex; justify-content:flex-end; align-items:center; gap:0.7rem; flex-wrap:wrap; }
.pds-modal { position:fixed; inset:0; background:rgba(0,0,0,0.5); display:flex; align-items:center; justify-content:center; z-index:9999;
    opacity:0; transition:opacity .2s ease; padding:1rem; }
.pds-modal.open { opacity:1; }
.pds-modal-card { background:var(--md-surface); border-radius:20px; width:min(620px, 100%); max-height:88vh; overflow-y:auto;
    box-shadow:0 24px 60px -20px rgba(0,0,0,0.5); transform:scale(0.96); transition:transform .2s ease; }
.pds-modal.open .pds-modal-card { transform:scale(1); }
.pds-modal-head { display:flex; justify-content:space-between; align-items:center; padding:1rem 1.2rem; border-bottom:1px solid var(--md-outline-variant); position:sticky; top:0; background:var(--md-surface); }
.pds-modal-head h3 { margin:0; font-size:1.1rem; color:var(--md-on-surface); }
.pds-modal-x { background:none; border:none; cursor:pointer; color:var(--md-on-surface-variant); display:flex; padding:0.3rem; border-radius:8px; }
.pds-modal-x:hover { background:var(--md-surface-variant); }
.pds-modal-body { padding:1.1rem 1.2rem 1.3rem; }
</style>`;
