'use strict';
const path = require('path');
const fs = require('fs');
const { dialog, app } = require('electron');
const XLSX = require('xlsx');
const { createReport, listCommands } = require('docx-templates');

// Cartella dei template (in dev = sorgente, in prod = dentro l'asar/resources)
function templateDir() {
    return path.join(__dirname, 'Template');
}
function xlsxTemplatePath(tipo) {
    const f = tipo === 'DOCENTI' ? 'Cognome_Nome_DOCENTI.xlsx' : 'Cognome_Nome_ATA.xlsx';
    return path.join(templateDir(), f);
}
// Sceglie il docx corretto: <ATA|DOCENTI> + _M / _F / generico
function docxTemplatePath(tipo, sesso) {
    const base = tipo === 'DOCENTI' ? 'Presa_di_Servizio_DOCENTI' : 'Presa_di_Servizio_ATA';
    const s = (sesso || '').toUpperCase();
    const candidates = [];
    if (s === 'M') candidates.push(base + '_M.docx');
    else if (s === 'F') candidates.push(base + '_F.docx');
    candidates.push(base + '.docx');
    for (const c of candidates) {
        const p = path.join(templateDir(), c);
        if (fs.existsSync(p)) return p;
    }
    return path.join(templateDir(), base + '.docx');
}

/* --------------------- Parsing XLSX modulo anagrafica --------------------- */
// Pulisce l'etichetta: rimuove il suggerimento "Es. ..." ed emoji/spazi.
function normLabel(raw) {
    return String(raw || '')
        .replace(/Es\.[\s\S]*$/i, '')
        .replace(/[^A-Za-zÀ-ù0-9'/()\- ]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toUpperCase();
}
// etichetta normalizzata -> campo interno
const LABEL_MAP = {
    'COGNOME': 'cognome',
    'NOME': 'nome',
    'SESSO (M/F)': 'sesso',
    'DATA DI NASCITA': 'data_nascita',
    'COMUNE DI NASCITA': 'luogo_nascita',
    'PROVINCIA DI NASCITA': 'provincia_nascita',
    'STATO CIVILE': 'stato_civile',
    'CODICE FISCALE': 'codice_fiscale',
    'CITTADINANZA': 'cittadinanza',
    'INDIRIZZO RESIDENZA': 'indirizzo_residenza',
    'NUMERO CIVICO RESIDENZA': 'civico_residenza',
    "CITTA' RESIDENZA": 'comune_residenza',
    'PROVINCIA RESIDENZA': 'provincia_residenza',
    'CAP RESIDENZA': 'cap_residenza',
    'INDIRIZZO DOMICILIO': 'indirizzo_domicilio',
    'NUMERO CIVICO DOMICILIO': 'civico_domicilio',
    "CITTA' DOMICILIO": 'comune_domicilio',
    'PROVINCIA DOMICILIO': 'provincia_domicilio',
    'CAP DOMICILIO': 'cap_domicilio',
    'TELEFONO FISSO': 'telefono_fisso',
    'CELLULARE': 'cellulare',
    'E-MAIL PERSONALE': 'email_personale',
    'EMAIL PERSONALE': 'email_personale',
    'E-MAIL PEC': 'email_pec',
    'EMAIL PEC': 'email_pec',
    'E-MAIL ISTITUZIONALE': 'email_istituzionale',
    'EMAIL ISTITUZIONALE': 'email_istituzionale',
    'TIPO DOCUMENTO': 'tipo_documento',
    'NUMERO DOCUMENTO': 'numero_documento',
    'RILASCIATO DA': 'rilasciato_da_documento',
    'DATA RILASCIO': 'data_rilascio_documento',
    'DATA SCADENZA': 'data_scadenza_documento',
    'TITOLO DI STUDIO': 'titolo_denominazione',
    'VOTO': 'titolo_votazione',
    'DATA DEL TITOLO DI STUDIO': 'titolo_data',
    'DENOMINAZIONE ISTITUTO': 'titolo_istituto',
    "CITTA' ISTITUTO": 'titolo_citta',
    'RUOLO DELLA CONVOCAZIONE': 'ruolo',
    'DATA ASSUNZIONE PRESA DI SERVIZIO': 'data_assunzione',
    'POSIZIONE MILITARE': 'posizione_militare',
    'IBAN': 'iban',
    'DENOMINAZIONE BANCA / POSTA': 'banca',
    'INTESTATARIO DEL CONTO': 'intestatario_conto'
};

function cellVal(ws, r, c) {
    const addr = XLSX.utils.encode_cell({ r, c });
    const cell = ws[addr];
    return cell && cell.v !== undefined && cell.v !== null ? String(cell.v).trim() : '';
}

function parseAnagraficaXlsx(ws) {
    const range = XLSX.utils.decode_range(ws['!ref']);
    const data = {};
    const familiari = [];
    let inFamiliari = false;
    for (let R = range.s.r; R <= range.e.r; R++) {
        const bRaw = cellVal(ws, R, 1); // colonna B
        const cRaw = cellVal(ws, R, 2); // colonna C
        const dRaw = cellVal(ws, R, 3); // colonna D
        const label = normLabel(bRaw);
        // Sezione nucleo familiare: righe con nome+cognome in B, relazione in C, data in D
        if (label === 'NUCLEO FAMILIARE') { inFamiliari = true; continue; }
        if (label && (label.includes('FORMAZIONE') || label.includes('DATI DI PAGAMENTO') || label.includes('DOCUMENTI'))) inFamiliari = false;
        if (inFamiliari) {
            // salta la riga intestazione ("NOME E COGNOME")
            if (label.startsWith('NOME E COGNOME')) continue;
            if (bRaw && !LABEL_MAP[label]) {
                familiari.push({ nome_cognome: bRaw, relazione: cRaw, data_nascita: dRaw });
                continue;
            }
        }
        if (LABEL_MAP[label] && cRaw) {
            data[LABEL_MAP[label]] = cRaw;
        }
    }
    data.familiari = familiari;
    return data;
}

/* ----------------------- Costruzione dati per il DOCX ----------------------- */
function fmtDate(v) {
    if (!v) return '';
    const s = String(v).trim();
    // ISO yyyy-mm-dd -> dd/mm/yyyy
    const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
    return s; // già in formato leggibile
}
function pick(arr, predicate) { return (arr || []).find(predicate) || null; }

// Dati costanti dell'istituto (configurati in Amministratore > Dati Istituto),
// uguali per tutti i dipendenti e uniti a ogni presa di servizio.
function buildIstitutoData(cfg) {
    cfg = cfg || {};
    return {
        Nome_Istituto: cfg.istituto_nome || '',
        IndirizzoCompletoIstituto: cfg.istituto_indirizzo || '',
        CodiceMeccanografico: cfg.istituto_codice_meccanografico || '',
        TelefonoIstituto: cfg.istituto_telefono || '',
        Email_Istituto: cfg.istituto_email || '',
        Nome_Istituto_CC: cfg.istituto_cc_banca || '',
        Intestatario_Conto_Corrente: cfg.istituto_cc_intestatario || '',
        IBAN_Conto_Corrente: cfg.istituto_cc_iban || '',
        FondoEspero: cfg.istituto_fondo_espero || ''
    };
}

// Costruisce l'oggetto placeholder->valore a partire dalla scheda persona + extra.
function buildDocxData(scheda, extra) {
    const p = scheda.persona || {};
    const indirizzi = scheda.indirizzi || [];
    const contatti = scheda.contatti || [];
    const documenti = scheda.documenti || [];
    const titoli = scheda.titoliStudio || [];
    const rapporti = scheda.rapportiLavoro || [];
    const familiari = scheda.familiari || [];
    extra = extra || {};

    const residenza = pick(indirizzi, i => (i.tipo || '').toLowerCase() === 'residenza' && i.is_corrente) || pick(indirizzi, i => (i.tipo || '').toLowerCase() === 'residenza') || indirizzi[0] || {};
    const domicilio = pick(indirizzi, i => (i.tipo || '').toLowerCase() === 'domicilio' && i.is_corrente) || pick(indirizzi, i => (i.tipo || '').toLowerCase() === 'domicilio');
    const doc = documenti[0] || {};
    const titolo = pick(titoli, t => t.is_principale) || titoli[0] || {};
    const rap = pick(rapporti, r => r.is_corrente) || rapporti[0] || {};

    const cVal = (pred) => { const c = pick(contatti, pred); return c ? c.valore : ''; };
    const telefono = cVal(c => /tel|cell|fiss/i.test((c.tipo || '') + (c.categoria || ''))) || p.telefono_principale || '';
    const emailPers = cVal(c => /mail/i.test((c.categoria || '')) && !/pec|istitu/i.test((c.tipo || ''))) || p.email_principale || '';
    const emailPec = cVal(c => /pec/i.test((c.tipo || '') + (c.valore || '')));

    const nomeCognome = `${p.nome || ''} ${p.cognome || ''}`.trim();
    const domicilioStr = domicilio ? `${[domicilio.via, domicilio.civico].filter(Boolean).join(' ')}, ${domicilio.cap || ''} ${domicilio.comune || ''}${domicilio.provincia ? ' (' + domicilio.provincia + ')' : ''}`.trim() : '';
    const parenteDati = familiari.map(f => `${f.nome || ''} ${f.cognome || ''} (${f.grado_parentela || ''})`.trim()).filter(Boolean).join('; ');

    return {
        Nome_e_Cognome: nomeCognome,
        Comune_Nascita: p.luogo_nascita || '',
        Nascita: fmtDate(p.data_nascita),
        Data_Nascita: fmtDate(p.data_nascita),
        Provincia_Nascita: p.provincia_nascita || '',
        Codice_Fiscale: p.codice_fiscale || p.id || '',
        Cittadinanza: p.cittadinanza || '',
        Stato_Civile: p.stato_civile || '',
        Posizione_Militare: p.posizione_militare || '',
        Comune_Iscrizione_Elettorale: p.comune_iscrizione_elettorale || residenza.comune || '',
        // Residenza
        Comune_Residenza: residenza.comune || '',
        Provincia_Residenza: residenza.provincia || '',
        Indirizzo_Residenza: residenza.via || '',
        Numero_Civico: residenza.civico || '',
        CAP_Residenza: residenza.cap || '',
        Domicilio: domicilioStr,
        // Recapiti
        Numero_Telefono: telefono,
        Indirizzo_Email: emailPers,
        Indirizzo_Email_PEC: emailPec,
        // Documento
        tipo_documento: doc.tipo || '',
        numero_documento: doc.numero || '',
        rilasciato_da_documento: doc.ente_rilascio || '',
        data_scadenza_documento: fmtDate(doc.data_scadenza),
        // Titolo di studio
        Denominazione_Titolo_di_Studio: titolo.denominazione || '',
        Istituto_Rilascio_Titolo: titolo.istituto_rilascio || '',
        Citta_Istituto_Rilascio: titolo.citta_istituto || '',
        Data_Conseguimento_Titolo: fmtDate(titolo.data_conseguimento),
        Votazione_Titolo: titolo.votazione || '',
        // Servizio / contratto
        Profilo_Professionale: rap.profilo_professionale || rap.ruolo || '',
        Ruolo: rap.ruolo || rap.mansione || '',
        Numero_Ore_Settimanali: rap.ore_settimanali || extra.ore_settimanali || '',
        Tempo_Determinato_o_Indeterminato: (rap.tipo_rapporto || extra.tempo_rapporto) ? (`tempo ${rap.tipo_rapporto || extra.tempo_rapporto}`.toLowerCase()) : '',
        Data_Stipula_Contratto: fmtDate(rap.data_stipula || rap.data_inizio),
        Anno_Scolastico_Inizio: rap.anno_scolastico_inizio || extra.anno_scolastico_inizio || '',
        Anno_Scolastico_Fine: rap.anno_scolastico_fine || extra.anno_scolastico_fine || '',
        CorsoSicurezza: rap.corso_sicurezza || extra.corso_sicurezza || '',
        Parente_Dati: parenteDati,
        // Compilazione (runtime)
        Luogo_Compilazione: extra.luogo_compilazione || residenza.comune || '',
        Data_Compilazione: extra.data_compilazione || fmtDate(new Date().toISOString())
    };
}

/* ------------------------------- Handler IPC ------------------------------- */
// Salva il template xlsx vuoto in una posizione scelta dall'utente.
async function exportTemplate(event, args) {
    try {
        const tipo = (args && args.tipo) || 'ATA';
        const src = xlsxTemplatePath(tipo);
        if (!fs.existsSync(src)) return { success: false, error: 'Template non trovato: ' + path.basename(src) };
        const suggested = `Cognome_Nome_${tipo}.xlsx`;
        const res = await dialog.showSaveDialog({
            title: 'Salva il modulo da compilare',
            defaultPath: path.join(app.getPath('downloads'), suggested),
            filters: [{ name: 'Excel', extensions: ['xlsx'] }]
        });
        if (res.canceled || !res.filePath) return { success: false, canceled: true };
        fs.copyFileSync(src, res.filePath);
        return { success: true, path: res.filePath };
    } catch (e) {
        console.error('[PresaServizio] exportTemplate', e);
        return { success: false, error: e.message };
    }
}

// Invia il template xlsx via email (allegato) usando lo stesso IPC sendMail.
async function emailTemplate(event, args) {
    try {
        const tipo = (args && args.tipo) || 'ATA';
        const to = args && args.to;
        if (!to) return { success: false, error: 'Indirizzo email mancante' };
        const src = xlsxTemplatePath(tipo);
        if (!fs.existsSync(src)) return { success: false, error: 'Template non trovato' };
        const contentBase64 = fs.readFileSync(src).toString('base64');
        const configHandlers = require('../../../backend/config');
        const smtp = configHandlers.readConfig() || {};
        if (!smtp.smtp_host) return { success: false, error: 'Server SMTP non configurato (Amministratore > SMTP).' };
        const nodemailer = require('nodemailer');
        let secure = smtp.smtp_security === 'ssl' || smtp.smtp_port == 465;
        const opts = {
            host: smtp.smtp_host, port: parseInt(smtp.smtp_port) || 587, secure,
            auth: { user: smtp.smtp_user, pass: smtp.smtp_pass },
            tls: { rejectUnauthorized: !smtp.smtp_allow_self_signed },
            connectionTimeout: smtp.smtp_timeout || 10000
        };
        if (smtp.smtp_security === 'starttls') { opts.secure = false; opts.requireTLS = true; }
        else if (smtp.smtp_security === 'none') { opts.secure = false; opts.ignoreTLS = true; }
        const transporter = nodemailer.createTransport(opts);
        const from = smtp.smtp_sender_name ? `"${smtp.smtp_sender_name}" <${smtp.smtp_sender_email}>` : smtp.smtp_sender_email;
        await transporter.sendMail({
            from, to,
            subject: `Modulo raccolta dati - Presa di Servizio (${tipo})`,
            text: 'In allegato il modulo Excel da compilare per la presa di servizio. Ti preghiamo di restituirlo compilato.',
            html: '<div style="font-family:sans-serif"><p>Gentile collega,</p><p>in allegato trovi il modulo Excel da compilare per la <strong>presa di servizio</strong>.</p><p>Ti preghiamo di compilarlo e restituirlo alla segreteria.</p></div>',
            attachments: [{ filename: `Cognome_Nome_${tipo}.xlsx`, content: fs.readFileSync(src) }]
        });
        return { success: true };
    } catch (e) {
        console.error('[PresaServizio] emailTemplate', e);
        return { success: false, error: e.message };
    }
}

const IMPORT_XLSX_MAX_BYTES = 15 * 1024 * 1024;
async function importXlsx(event) {
    try {
        const res = await dialog.showOpenDialog({
            title: 'Seleziona il modulo compilato',
            properties: ['openFile'],
            filters: [{ name: 'Excel', extensions: ['xlsx', 'xls'] }]
        });
        if (res.canceled || !res.filePaths || res.filePaths.length === 0) return { success: false, canceled: true };
        const filePath = res.filePaths[0];
        const stat = fs.statSync(filePath);
        if (stat.size > IMPORT_XLSX_MAX_BYTES) {
            return { success: false, error: 'Il file selezionato supera la dimensione massima consentita (15MB).' };
        }
        const wb = XLSX.readFile(filePath, { cellFormula: false, cellHTML: false, bookVBA: false });
        const ws = wb.Sheets[wb.SheetNames[0]];
        if (!ws) return { success: false, error: 'Il file non contiene fogli validi.' };
        const data = parseAnagraficaXlsx(ws);
        return { success: true, data, fileName: path.basename(filePath) };
    } catch (e) {
        console.error('[PresaServizio] importXlsx', e);
        return { success: false, error: e.message };
    }
}

// Placeholder che provengono dai dati COSTANTI dell'istituto (config), non dalla persona.
const ISTITUTO_KEYS = new Set(['Nome_Istituto', 'IndirizzoCompletoIstituto', 'CodiceMeccanografico', 'TelefonoIstituto', 'Email_Istituto', 'Nome_Istituto_CC', 'Intestatario_Conto_Corrente', 'IBAN_Conto_Corrente', 'FondoEspero']);
// Etichette leggibili per i placeholder del template.
const DOCX_LABELS = {
    Nome_e_Cognome: 'Nome e cognome', Comune_Nascita: 'Comune di nascita', Nascita: 'Data di nascita', Data_Nascita: 'Data di nascita',
    Provincia_Nascita: 'Provincia di nascita', Codice_Fiscale: 'Codice fiscale', Cittadinanza: 'Cittadinanza', Stato_Civile: 'Stato civile',
    Posizione_Militare: 'Posizione militare', Comune_Iscrizione_Elettorale: 'Comune iscrizione elettorale',
    Comune_Residenza: 'Comune di residenza', Provincia_Residenza: 'Provincia di residenza', Indirizzo_Residenza: 'Indirizzo di residenza',
    Numero_Civico: 'Numero civico', CAP_Residenza: 'CAP di residenza', Domicilio: 'Domicilio',
    Numero_Telefono: 'Telefono', Indirizzo_Email: 'Email', Indirizzo_Email_PEC: 'Email PEC',
    tipo_documento: "Tipo documento d'identità", numero_documento: 'Numero documento', rilasciato_da_documento: 'Documento rilasciato da', data_scadenza_documento: 'Scadenza documento',
    Denominazione_Titolo_di_Studio: 'Titolo di studio', Istituto_Rilascio_Titolo: 'Istituto del titolo', Citta_Istituto_Rilascio: 'Città istituto', Data_Conseguimento_Titolo: 'Data conseguimento titolo', Votazione_Titolo: 'Votazione',
    Profilo_Professionale: 'Profilo professionale', Ruolo: 'Ruolo / Mansione', Numero_Ore_Settimanali: 'Ore settimanali', Tempo_Determinato_o_Indeterminato: 'Tipo di rapporto', Data_Stipula_Contratto: 'Data stipula contratto',
    Anno_Scolastico_Inizio: 'Anno scolastico (inizio)', Anno_Scolastico_Fine: 'Anno scolastico (fine)', CorsoSicurezza: 'Corso sicurezza', Parente_Dati: 'Dati familiari',
    Luogo_Compilazione: 'Luogo di compilazione', Data_Compilazione: 'Data di compilazione',
    Nome_Istituto: 'Nome istituto', IndirizzoCompletoIstituto: 'Indirizzo istituto', CodiceMeccanografico: 'Codice meccanografico', TelefonoIstituto: 'Telefono istituto', Email_Istituto: 'Email istituto',
    Nome_Istituto_CC: 'Banca tesoreria istituto', Intestatario_Conto_Corrente: 'Intestatario conto istituto', IBAN_Conto_Corrente: 'IBAN istituto', FondoEspero: 'Fondo Espero'
};
function labelFor(key) { return DOCX_LABELS[key] || String(key).replace(/_/g, ' '); }

// Costruisce l'oggetto dati completo (persona + istituto) e la lista dei placeholder,
// senza generare nulla. Riusato sia dall'anteprima sia dalla generazione vera.
async function _assembleDocxData(event, args) {
    const personaId = args && args.personaId;
    const tipo = (args && args.tipo) || 'ATA';
    if (!personaId) return { error: 'Persona non specificata' };
    const scheda = await require('../../../backend/handlers/anagrafica_persone').getScheda(event, { id: personaId });
    if (!scheda || !scheda.persona) return { error: 'Scheda persona non trovata' };
    const tplPath = docxTemplatePath(tipo, scheda.persona.sesso || '');
    if (!fs.existsSync(tplPath)) return { error: 'Template docx non trovato: ' + path.basename(tplPath) };
    const template = fs.readFileSync(tplPath);
    const cmds = await listCommands(template, ['${', '}']);
    const keys = [...new Set(cmds.map(c => (c.code || '').trim()).filter(Boolean))];
    const full = {};
    for (const k of keys) full[k] = '';
    let istitutoCfg = {};
    try { istitutoCfg = require('../../../backend/config').readConfig() || {}; } catch (_) {}
    Object.assign(full, buildIstitutoData(istitutoCfg));
    Object.assign(full, buildDocxData(scheda, args.extra || {}));
    return { full, keys, template, scheda, tipo };
}

// Anteprima: ritorna i campi del documento che risulterebbero VUOTI, senza generare il file.
async function previewDocx(event, args) {
    try {
        const a = await _assembleDocxData(event, args);
        if (a.error) return { success: false, error: a.error };
        const missing = a.keys.filter(k => !a.full[k]).map(k => ({ key: k, label: labelFor(k), scope: ISTITUTO_KEYS.has(k) ? 'istituto' : 'persona' }));
        return { success: true, total: a.keys.length, missing };
    } catch (e) {
        console.error('[PresaServizio] previewDocx', e);
        return { success: false, error: e.message };
    }
}

// Genera la presa di servizio compilando il template docx e la salva su disco.
async function generateDocx(event, args) {
    try {
        const a = await _assembleDocxData(event, args);
        if (a.error) return { success: false, error: a.error };
        const { full, keys, template, scheda, tipo } = a;
        const report = await createReport({ template, data: full, cmdDelimiter: ['${', '}'], failFast: false });
        const cognome = (scheda.persona.cognome || 'Cognome').replace(/[^A-Za-z0-9]/g, '');
        const nome = (scheda.persona.nome || 'Nome').replace(/[^A-Za-z0-9]/g, '');
        const suggested = `Presa_di_Servizio_${cognome}_${nome}_${tipo}.docx`;
        const saveRes = await dialog.showSaveDialog({
            title: 'Salva la presa di servizio',
            defaultPath: path.join(app.getPath('downloads'), suggested),
            filters: [{ name: 'Word', extensions: ['docx'] }]
        });
        if (saveRes.canceled || !saveRes.filePath) return { success: false, canceled: true };
        fs.writeFileSync(saveRes.filePath, report);
        return { success: true, path: saveRes.filePath, missing: keys.filter(k => !full[k]) };
    } catch (e) {
        console.error('[PresaServizio] generateDocx', e);
        return { success: false, error: e.message };
    }
}

// Genera la presa di servizio in PDF/A (con metadati) tramite LibreOffice headless.
async function generatePdf(event, args) {
    try {
        const a = await _assembleDocxData(event, args);
        if (a.error) return { success: false, error: a.error };
        const { full, keys, template, scheda, tipo } = a;
        const report = await createReport({ template, data: full, cmdDelimiter: ['${', '}'], failFast: false });
        const p = scheda.persona;
        let istitutoCfg = {};
        try { istitutoCfg = require('../../../backend/config').readConfig() || {}; } catch (_) {}
        const meta = {
            title: `Presa di Servizio - ${p.cognome || ''} ${p.nome || ''}`.trim(),
            subject: 'Presa di Servizio',
            creator: istitutoCfg.istituto_nome || 'Adestio',
            keywords: [tipo, p.codice_fiscale || p.id || ''].filter(Boolean).join(', '),
            description: `Presa di servizio ${tipo} per ${p.cognome || ''} ${p.nome || ''}`.trim()
        };
        const conv = await require('../../../backend/handlers/pdf_export').convertDocxToPdfA(Buffer.from(report), meta, { pdfaVersion: 2 });
        if (!conv.success) {
            if (conv.code === 'NO_LIBREOFFICE') {
                return { success: false, code: 'NO_LIBREOFFICE', error: 'Per generare il PDF/A serve LibreOffice installato sul computer. Installa LibreOffice (gratuito) oppure indica il percorso di soffice nelle impostazioni.' };
            }
            return { success: false, error: conv.error || 'Conversione PDF/A non riuscita' };
        }
        const cognome = (p.cognome || 'Cognome').replace(/[^A-Za-z0-9]/g, '');
        const nome = (p.nome || 'Nome').replace(/[^A-Za-z0-9]/g, '');
        const suggested = `Presa_di_Servizio_${cognome}_${nome}_${tipo}.pdf`;
        const saveRes = await dialog.showSaveDialog({
            title: 'Salva la presa di servizio (PDF/A)',
            defaultPath: path.join(app.getPath('downloads'), suggested),
            filters: [{ name: 'PDF/A', extensions: ['pdf'] }]
        });
        if (saveRes.canceled || !saveRes.filePath) return { success: false, canceled: true };
        fs.writeFileSync(saveRes.filePath, conv.pdf);
        return { success: true, path: saveRes.filePath, format: 'pdfa', missing: keys.filter(k => !full[k]) };
    } catch (e) {
        console.error('[PresaServizio] generatePdf', e);
        return { success: false, error: e.message };
    }
}

// Scrive nel DB i dati (corretti dall'operatore) provenienti dall'import.
// Match per Codice Fiscale: la persona viene creata o aggiornata; le entità
// collegate vengono aggiunte. Ritorna { success, personaId }.
async function saveImportedPersona(event, args) {
    try {
        const d = (args && args.data) || {};
        const actorUserId = (args && args.actorUserId) || '';
        const personeH = require('../../../backend/handlers/anagrafica_persone');
        const documentiH = require('../../../backend/handlers/anagrafica_documenti');
        const residenzaH = require('../../../backend/handlers/anagrafica_residenza');
        const contattiH = require('../../../backend/handlers/anagrafica_contatti');
        const lavoroH = require('../../../backend/handlers/anagrafica_lavoro');
        const titoliH = require('../../../backend/handlers/anagrafica_titoli_studio');
        const bancariH = require('../../../backend/handlers/anagrafica_dati_bancari');

        if (!d.codice_fiscale) return { success: false, error: 'Codice Fiscale mancante: obbligatorio per l\'import' };
        if (!d.nome || !d.cognome) return { success: false, error: 'Nome e Cognome sono obbligatori' };

        // Le date nel modulo Excel sono in formato gg/mm/aaaa, ma il DB e i campi
        // <input type=date> dell'anagrafica usano il formato ISO aaaa-mm-gg.
        // Senza questa conversione le date non si visualizzano nella scheda persona.
        const toISO = (s) => {
            if (!s) return '';
            const m = String(s).trim().match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
            if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
            return String(s).trim();
        };
        ['data_nascita', 'data_rilascio_documento', 'data_scadenza_documento', 'titolo_data', 'data_assunzione'].forEach(k => { d[k] = toISO(d[k]); });
        (d.familiari || []).forEach(f => { f.data_nascita = toISO(f.data_nascita); });

        // 1) Persona (upsert per CF)
        const pRes = await personeH.create(event, {
            codice_fiscale: d.codice_fiscale, nome: d.nome, cognome: d.cognome, sesso: d.sesso || '',
            data_nascita: d.data_nascita || '', luogo_nascita: d.luogo_nascita || '', provincia_nascita: d.provincia_nascita || '',
            cap_nascita: d.cap_nascita || '', cittadinanza: d.cittadinanza || '', stato_civile: d.stato_civile || '',
            actorUserId
        });
        const personaId = (pRes && pRes.id) || d.codice_fiscale;
        // aggiorna i campi extra persona (posizione militare, iscrizione elettorale)
        const existing = await personeH.getById(event, { id: personaId });
        if (existing) {
            await personeH.update(event, Object.assign({}, existing, {
                id: personaId,
                posizione_militare: d.posizione_militare || existing.posizione_militare || '',
                comune_iscrizione_elettorale: d.comune_iscrizione_elettorale || existing.comune_iscrizione_elettorale || '',
                actorUserId
            }));
        }

        const add = async (fn, payload) => { try { await fn(event, Object.assign({ persona_id: personaId, actorUserId }, payload)); } catch (e) { console.warn('[PresaServizio] import add skip:', e.message); } };

        // 2) Documento
        if (d.numero_documento || d.tipo_documento) {
            await add(documentiH.create, { tipo: d.tipo_documento || 'altro', numero: d.numero_documento || '', ente_rilascio: d.rilasciato_da_documento || '', data_rilascio: d.data_rilascio_documento || '', data_scadenza: d.data_scadenza_documento || '' });
        }
        // 3) Indirizzi
        if (d.indirizzo_residenza || d.comune_residenza) {
            await add(residenzaH.create, { tipo: 'residenza', via: d.indirizzo_residenza || '', civico: d.civico_residenza || '', cap: d.cap_residenza || '', comune: d.comune_residenza || '', provincia: d.provincia_residenza || '', is_corrente: 1 });
        }
        if (d.indirizzo_domicilio || d.comune_domicilio) {
            await add(residenzaH.create, { tipo: 'domicilio', via: d.indirizzo_domicilio || '', civico: d.civico_domicilio || '', cap: d.cap_domicilio || '', comune: d.comune_domicilio || '', provincia: d.provincia_domicilio || '', is_corrente: 1 });
        }
        // 4) Contatti
        if (d.telefono_fisso) await add(contattiH.create, { categoria: 'Telefono', tipo: 'Fisso', valore: d.telefono_fisso, is_principale: 0 });
        if (d.cellulare) await add(contattiH.create, { categoria: 'Telefono', tipo: 'Cellulare', valore: d.cellulare, is_principale: 1 });
        if (d.email_personale) await add(contattiH.create, { categoria: 'Email', tipo: 'Personale', valore: d.email_personale, is_principale: 1 });
        if (d.email_pec) await add(contattiH.create, { categoria: 'Email', tipo: 'PEC', valore: d.email_pec, is_principale: 0 });
        if (d.email_istituzionale) await add(contattiH.create, { categoria: 'Email', tipo: 'Istituzionale', valore: d.email_istituzionale, is_principale: 0 });
        // 5) Titolo di studio
        if (d.titolo_denominazione) {
            await add(titoliH.create, { denominazione: d.titolo_denominazione, votazione: d.titolo_votazione || '', data_conseguimento: d.titolo_data || '', istituto_rilascio: d.titolo_istituto || '', citta_istituto: d.titolo_citta || '', is_principale: 1 });
        }
        // 6) Dati bancari
        if (d.iban) await add(bancariH.create, { iban: d.iban, banca: d.banca || '', intestatario: d.intestatario_conto || '', is_principale: 1 });
        // 7) Rapporto di lavoro / servizio
        if (d.ruolo || d.mansione || d.data_assunzione || args.tipo) {
            // Data inizio servizio: sempre 1° settembre dell'anno in corso.
            const annoCorrente = new Date().getFullYear();
            const isDocente = args && args.tipo === 'DOCENTI';
            const mansione = d.mansione || (isDocente ? 'Docente' : (d.ruolo || ''));
            const rapPayload = {
                datore_lavoro: 'Ministero dell\'Istruzione e del Merito',
                mansione,
                categoria_personale: isDocente ? 'Docente' : 'ATA',
                ruolo: d.ruolo || '', profilo_professionale: mansione || d.ruolo || '',
                data_inizio: `${annoCorrente}-09-01`,
                data_stipula: d.data_assunzione || '', is_corrente: 1
            };
            // Se la persona ha già un rapporto corrente, lo aggiorno (evita duplicati
            // e sovrascrive dati stantii come un vecchio datore di lavoro); altrimenti ne creo uno.
            try {
                const esistenti = await lavoroH.getByPersona(event, { personaId });
                const corrente = (esistenti || []).find(r => r.is_corrente) || (esistenti || [])[0];
                if (corrente) await lavoroH.update(event, Object.assign({ id: corrente.id, persona_id: personaId, actorUserId }, rapPayload));
                else await add(lavoroH.create, rapPayload);
            } catch (e) { await add(lavoroH.create, rapPayload); }
        }
        // 8) Nucleo familiare (dal modulo: "COGNOME NOME", relazione, data nascita)
        for (const f of (d.familiari || [])) {
            const parts = String(f.nome_cognome || '').trim().split(/\s+/);
            if (parts.length < 2) continue;
            const cognome = parts[0];
            const nome = parts.slice(1).join(' ');
            const rel = String(f.relazione || '').toUpperCase();
            let grado = 'Altro';
            if (/MOGLIE|MARITO|CONIUGE/.test(rel)) grado = 'Coniuge';
            else if (/FIGLI/.test(rel)) grado = 'Figlio/a';
            else if (/PADRE|MADRE|GENITORE/.test(rel)) grado = 'Genitore';
            else if (/FRATELLO|SORELLA/.test(rel)) grado = 'Fratello/Sorella';
            await add(require('../../../backend/handlers/anagrafica_familiari').create, {
                nome, cognome, grado_parentela: grado, data_nascita: f.data_nascita || '',
                note: grado === 'Altro' && f.relazione ? f.relazione : ''
            });
        }
        return { success: true, personaId };
    } catch (e) {
        console.error('[PresaServizio] saveImportedPersona', e);
        return { success: false, error: e.message };
    }
}

module.exports = { 
    register(context) {
        return {
            exportTemplate: (e, args) => exportTemplate(e, args),
            emailTemplate: (e, args) => emailTemplate(e, args),
            importXlsx: (e) => importXlsx(e),
            saveImportedPersona: (e, args) => saveImportedPersona(e, args),
            previewDocx: (e, args) => previewDocx(e, args),
            generateDocx: (e, args) => generateDocx(e, args),
            generatePdf: (e, args) => generatePdf(e, args)
        };
    },
    exportTemplate, emailTemplate, importXlsx, previewDocx, generateDocx, generatePdf, saveImportedPersona, parseAnagraficaXlsx, buildDocxData, buildIstitutoData 
};
