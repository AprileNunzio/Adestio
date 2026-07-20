/**
 * Anagrafica UI Kit
 * -----------------
 * Sistema di design condiviso da TUTTE le sotto-app dell'Anagrafica
 * (I Miei Dati, Contatti, Documenti, Lavoro, Residenza e Domicilio).
 *
 * Obiettivi:
 *  - grafica moderna e coerente ("stessa famiglia") tra tutte le app
 *  - massimo dettaglio e istruzioni per l'utente (label + suggerimenti)
 *  - alti contrasti e piena accessibilità (label associate, focus visibili, ARIA)
 *  - layout compatto che occupa poco spazio
 *
 * Espone: TONI, heroHtml(), guidaHtml(), campoHtml(), leggiCampo(), AK_STYLES.
 */

import { datalistHtml } from './riferimenti.js';

/* Palette per-app: ogni gradiente usa toni scuri così che il testo bianco
   mantenga sempre un contrasto WCAG adeguato (titolo grande/bold >= 3:1). */
export const TONI = {
    blue:   { grad: 'linear-gradient(135deg, #2563eb 0%, #4338ca 100%)', accent: '#2563eb', soft: 'rgba(37,99,235,0.10)',  icon: 'badge' },
    violet: { grad: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)', accent: '#7c3aed', soft: 'rgba(124,58,237,0.10)', icon: 'contacts' },
    orange: { grad: 'linear-gradient(135deg, #c2410c 0%, #9a3412 100%)', accent: '#c2410c', soft: 'rgba(194,65,12,0.10)',  icon: 'badge' },
    teal:   { grad: 'linear-gradient(135deg, #0f766e 0%, #0e7490 100%)', accent: '#0f766e', soft: 'rgba(15,118,110,0.10)', icon: 'work' },
    cyan:   { grad: 'linear-gradient(135deg, #0e7490 0%, #1d4ed8 100%)', accent: '#0e7490', soft: 'rgba(14,116,144,0.10)', icon: 'home' }
};

function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/**
 * Intestazione "hero" a gradiente, identica in tutte le app.
 * @param {object} o
 *  - title, subtitle: testi
 *  - icon: material symbol del chip a sinistra
 *  - tone: chiave di TONI (blue/violet/orange/teal/cyan)
 *  - actionsHtml: markup dei bottoni a destra (es. "Nuovo …")
 *  - auditMountId: id del contenitore per il bottone storico (opzionale)
 */
export function heroHtml(o) {
    const tone = TONI[o.tone] || TONI.blue;
    const icon = o.icon || tone.icon;
    return `
        <header class="ak-hero" role="banner" style="--ak-grad:${tone.grad};">
            <div class="ak-hero-glow ak-hero-glow-a"></div>
            <div class="ak-hero-glow ak-hero-glow-b"></div>
            <div class="ak-hero-left">
                <div class="ak-hero-chip" aria-hidden="true">
                    <span class="material-symbols-rounded">${esc(icon)}</span>
                </div>
                <div>
                    <h1 class="ak-hero-title">${esc(o.title)}</h1>
                    <p class="ak-hero-sub">${esc(o.subtitle || '')}</p>
                </div>
            </div>
            <div class="ak-hero-actions">
                ${o.auditMountId ? `<div id="${esc(o.auditMountId)}"></div>` : ''}
                ${o.actionsHtml || ''}
            </div>
        </header>
    `;
}

/**
 * Pannello istruzioni compatto e accessibile (elemento <details>).
 * Chiuso di default per non occupare spazio, ma sempre disponibile.
 * @param {object} o - { intro: string, steps: string[], tone }
 */
export function guidaHtml(o) {
    const tone = TONI[o.tone] || TONI.blue;
    const steps = (o.steps || []).map((s, i) => `
        <li class="ak-guide-step">
            <span class="ak-guide-num" aria-hidden="true">${i + 1}</span>
            <span>${s}</span>
        </li>
    `).join('');
    return `
        <details class="ak-guide" style="--ak-accent:${tone.accent}; --ak-soft:${tone.soft};">
            <summary class="ak-guide-summary">
                <span class="material-symbols-rounded" aria-hidden="true">help</span>
                <span class="ak-guide-summary-text">Come compilare questa sezione</span>
                <span class="material-symbols-rounded ak-guide-caret" aria-hidden="true">expand_more</span>
            </summary>
            <div class="ak-guide-body">
                ${o.intro ? `<p class="ak-guide-intro">${o.intro}</p>` : ''}
                ${steps ? `<ol class="ak-guide-steps">${steps}</ol>` : ''}
            </div>
        </details>
    `;
}

/* ---- Campo di form condiviso: etichetta statica + icona + suggerimento ---- */
/* Uso label statica (sempre visibile) invece di floating label: più chiara per
   qualsiasi utente e pienamente accessibile via <label for>. */
export function campoHtml(field, value, idPrefix = 'crud-field-') {
    const id = `${idPrefix}${field.key}`;
    const val = value === undefined || value === null ? '' : value;
    let spanStyle = '';
    if (field.full) spanStyle = 'grid-column:1/-1;';
    else if (field.span) spanStyle = `grid-column:span ${field.span};`;
    const flex = spanStyle ? `style="${spanStyle}"` : '';
    const req = field.required ? '<span class="ak-req" title="Campo obbligatorio" aria-hidden="true">*</span>' : '';
    const hint = field.hint ? `<small class="ak-hint" id="${id}-hint">${esc(field.hint)}</small>` : '';
    const describedBy = field.hint ? `aria-describedby="${id}-hint"` : '';

    if (field.type === 'checkbox') {
        return `
            <label class="ak-check" ${flex} for="${id}">
                <input type="checkbox" id="${id}" ${val ? 'checked' : ''}>
                <span class="ak-check-box" aria-hidden="true"><span class="material-symbols-rounded">check</span></span>
                <span class="ak-check-text">${esc(field.label)}${field.hint ? `<small class="ak-hint" style="display:block;">${esc(field.hint)}</small>` : ''}</span>
            </label>
        `;
    }

    const labelRow = `<label class="ak-flabel" for="${id}">${esc(field.label)}${req}</label>`;

    if (field.type === 'select') {
        const options = (field.options || []).map(op =>
            `<option value="${esc(op.value)}" ${String(op.value) === String(val) ? 'selected' : ''}>${esc(op.label)}</option>`).join('');
        return `
            <div class="ak-field" ${flex}>
                ${labelRow}
                <div class="ak-inputbox">
                    <span class="material-symbols-rounded ak-ficon" aria-hidden="true">${esc(field.icon || 'edit_note')}</span>
                    <select id="${id}" class="ak-input" ${field.required ? 'required' : ''} ${describedBy}>
                        <option value="" ${!val ? 'selected' : ''} disabled hidden>Seleziona…</option>
                        ${options}
                    </select>
                    <span class="material-symbols-rounded ak-fcaret" aria-hidden="true">unfold_more</span>
                </div>
                ${hint}
            </div>
        `;
    }

    if (field.type === 'textarea') {
        return `
            <div class="ak-field" ${flex}>
                ${labelRow}
                <div class="ak-inputbox">
                    <span class="material-symbols-rounded ak-ficon ak-ficon-top" aria-hidden="true">${esc(field.icon || 'notes')}</span>
                    <textarea id="${id}" class="ak-input ak-textarea" rows="3" placeholder="${esc(field.placeholder || '')}" ${describedBy}>${esc(val)}</textarea>
                </div>
                ${hint}
            </div>
        `;
    }

    const inputType = field.type === 'date' ? 'date' : (field.type || 'text');
    const listAttr = field.datalist ? `list="dl-${field.key}"` : '';
    const listHtml = field.datalist ? datalistHtml(`dl-${field.key}`) : '';
    const upper = field.uppercase ? 'style="text-transform:uppercase;"' : '';
    return `
        <div class="ak-field" ${flex}>
            ${labelRow}
            <div class="ak-inputbox">
                <span class="material-symbols-rounded ak-ficon" aria-hidden="true">${esc(field.icon || 'edit_note')}</span>
                <input type="${inputType}" id="${id}" class="ak-input" placeholder="${esc(field.placeholder || '')}" value="${esc(val)}" ${field.required ? 'required' : ''} ${listAttr} ${describedBy} ${upper}>
                ${listHtml}
            </div>
            ${hint}
        </div>
    `;
}

export function leggiCampo(el, field, idPrefix = 'crud-field-') {
    const input = el.querySelector(`#${idPrefix}${field.key}`);
    if (!input) return '';
    if (field.type === 'checkbox') return input.checked ? 1 : 0;
    let v = input.value;
    if (field.uppercase && typeof v === 'string') v = v.toUpperCase();
    return v;
}

export function toISODate(value) {
    if (!value) return '';
    const s = String(value).trim();
    let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
    if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    const n = Number(s);
    if (!isNaN(n) && n > 100000) {
        const d = new Date(n);
        if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    }
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    return s;
}

/* ------------------------------ Stili condivisi ------------------------------ */
export const AK_STYLES = `
<style>
    .ak-root { width:100%; height:100%; display:flex; flex-direction:column; gap:1rem; min-height:0; }

    /* ---------- HERO ---------- */
    .ak-hero {
        position:relative; overflow:hidden; border-radius:20px;
        background:var(--ak-grad); padding:1rem 1.4rem;
        display:flex; align-items:center; justify-content:space-between; gap:1rem; flex-wrap:wrap;
        box-shadow:0 10px 28px -12px rgba(0,0,0,0.45);
    }
    .ak-hero-left { display:flex; align-items:center; gap:0.9rem; position:relative; z-index:2; min-width:0; }
    .ak-hero-chip {
        width:46px; height:46px; border-radius:14px; flex-shrink:0;
        background:rgba(255,255,255,0.18); border:1px solid rgba(255,255,255,0.35);
        display:flex; align-items:center; justify-content:center; backdrop-filter:blur(4px);
    }
    .ak-hero-chip .material-symbols-rounded { color:#fff; font-size:1.6rem; }
    .ak-hero-title { margin:0; color:#fff; font-family:var(--font-heading); font-weight:800;
        font-size:clamp(1.25rem, 2.4vw, 1.6rem); letter-spacing:-0.02em; line-height:1.1; }
    .ak-hero-sub { margin:0.15rem 0 0; color:rgba(255,255,255,0.92); font-size:0.9rem; font-weight:500; }
    .ak-hero-actions { display:flex; align-items:center; gap:0.7rem; position:relative; z-index:2; flex-wrap:wrap; }
    .ak-hero-glow { position:absolute; border-radius:50%; filter:blur(34px); opacity:0.35; pointer-events:none; }
    .ak-hero-glow-a { width:220px; height:220px; right:-4%; top:-70%; background:radial-gradient(circle,#fff 0%,transparent 70%); }
    .ak-hero-glow-b { width:160px; height:160px; left:-3%; bottom:-70%; background:radial-gradient(circle,#fff 0%,transparent 70%); }

    .ak-hero-btn {
        display:inline-flex; align-items:center; gap:0.4rem; cursor:pointer;
        padding:0.6rem 1.2rem; border-radius:999px; font-weight:700; font-size:0.92rem;
        background:#fff; color:#111827; border:none; box-shadow:0 4px 12px rgba(0,0,0,0.18);
        transition:transform .15s ease, box-shadow .15s ease;
    }
    .ak-hero-btn:hover { transform:translateY(-2px); box-shadow:0 8px 18px rgba(0,0,0,0.25); }
    .ak-hero-btn:active { transform:translateY(0); }
    .ak-hero-btn .material-symbols-rounded { font-size:1.2rem; }

    /* ---------- GUIDA (istruzioni) ---------- */
    .ak-guide {
        border:1px solid var(--md-outline-variant); border-left:4px solid var(--ak-accent);
        border-radius:14px; background:var(--md-surface-container-lowest); overflow:hidden;
    }
    .ak-guide-summary {
        list-style:none; cursor:pointer; user-select:none;
        display:flex; align-items:center; gap:0.6rem; padding:0.75rem 1rem;
        font-weight:700; color:var(--md-on-surface); font-size:0.95rem;
    }
    .ak-guide-summary::-webkit-details-marker { display:none; }
    .ak-guide-summary > .material-symbols-rounded:first-child { color:var(--ak-accent); font-size:1.3rem; }
    .ak-guide-summary-text { flex:1; }
    .ak-guide-caret { transition:transform .25s ease; color:var(--md-on-surface-variant); }
    .ak-guide[open] .ak-guide-caret { transform:rotate(180deg); }
    .ak-guide-summary:hover { background:var(--ak-soft); }
    .ak-guide-summary:focus-visible { outline:3px solid var(--md-outline-focus); outline-offset:-3px; }
    .ak-guide-body { padding:0 1rem 1rem 1rem; }
    .ak-guide-intro { margin:0 0 0.7rem; color:var(--md-on-surface-variant); font-size:0.9rem; line-height:1.5; }
    .ak-guide-steps { list-style:none; margin:0; padding:0; display:grid; gap:0.5rem; }
    .ak-guide-step { display:flex; align-items:flex-start; gap:0.6rem; font-size:0.88rem; color:var(--md-on-surface); line-height:1.45; }
    .ak-guide-num {
        flex-shrink:0; width:22px; height:22px; border-radius:50%; background:var(--ak-accent); color:#fff;
        font-size:0.75rem; font-weight:700; display:flex; align-items:center; justify-content:center; margin-top:1px;
    }

    /* ---------- PANNELLO / CARD ---------- */
    .ak-panel {
        flex:1; min-height:0; display:flex; flex-direction:column;
        background:var(--md-surface); border:1px solid var(--md-outline-variant);
        border-radius:18px; box-shadow:0 8px 30px rgba(0,0,0,0.04);
    }
    .ak-panel-body { flex:1; overflow-y:auto; padding:1.2rem 1.4rem; }
    .ak-toolbar { display:flex; align-items:center; justify-content:space-between; gap:1rem;
        padding:0.9rem 1.4rem; border-bottom:1px solid var(--md-outline-variant); flex-wrap:wrap; }
    .ak-toolbar h3 { margin:0; font-family:var(--font-heading); font-size:1.05rem; color:var(--md-on-surface); }
    .ak-count { font-size:0.8rem; color:var(--md-on-surface-variant); font-weight:600;
        background:var(--md-surface-variant); padding:0.15rem 0.6rem; border-radius:999px; margin-left:0.5rem; }

    /* ---------- CAMPI FORM ---------- */
    .ak-form-sections-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(320px, 1fr)); gap:1rem; align-items:start; }
    .ak-form-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(220px, 1fr)); gap:0.9rem 1rem; }
    .ak-section { border:1px solid var(--md-outline-variant); border-radius:14px; padding:1rem 1.1rem 1.1rem;
        background:var(--md-surface-container-lowest); margin-bottom:1rem; }
    .ak-section-head { display:flex; align-items:center; gap:0.6rem; margin-bottom:0.9rem;
        padding-bottom:0.6rem; border-bottom:1px dashed var(--md-outline-variant); }
    .ak-section-icon { width:30px; height:30px; border-radius:9px; display:flex; align-items:center; justify-content:center;
        background:var(--ak-soft, var(--md-primary-container)); color:var(--ak-accent, var(--md-on-primary-container)); }
    .ak-section-icon .material-symbols-rounded { font-size:1.15rem; }
    .ak-section-title { margin:0; font-size:1rem; font-weight:700; color:var(--md-on-surface); letter-spacing:-0.01em; }

    .ak-field { display:flex; flex-direction:column; gap:0.3rem; }
    .ak-flabel { font-size:0.8rem; font-weight:600; color:var(--md-on-surface); padding-left:0.15rem; }
    .ak-req { color:var(--md-error); margin-left:0.15rem; font-weight:800; }
    .ak-inputbox { position:relative; }
    .ak-ficon { position:absolute; left:0.75rem; top:50%; transform:translateY(-50%);
        color:var(--md-on-surface-variant); font-size:1.15rem; pointer-events:none; z-index:1; }
    .ak-ficon-top { top:1.1rem; transform:none; }
    .ak-fcaret { position:absolute; right:0.7rem; top:50%; transform:translateY(-50%);
        color:var(--md-on-surface-variant); font-size:1.1rem; pointer-events:none; }
    .ak-input {
        width:100%; height:2.85rem; padding:0 0.85rem 0 2.55rem; border-radius:11px;
        border:1.5px solid var(--md-outline-variant); background:var(--md-surface-container-lowest);
        color:var(--md-on-surface); font-size:0.95rem; font-family:var(--font-body);
        outline:none; transition:border-color .18s ease, box-shadow .18s ease, background .18s ease; appearance:none;
    }
    select.ak-input { padding-right:2.3rem; cursor:pointer; }
    .ak-textarea { height:auto; min-height:5rem; padding-top:0.7rem; resize:vertical; line-height:1.4; }
    .ak-input::placeholder { color:var(--md-on-surface-variant); opacity:0.7; }
    .ak-input:hover { border-color:var(--md-on-surface-variant); }
    .ak-input:focus { border-color:var(--md-primary); box-shadow:0 0 0 3px var(--md-outline-focus); background:var(--md-surface); }
    .ak-input:disabled { background:var(--md-surface-variant); color:var(--md-on-surface-variant); cursor:not-allowed; }
    .ak-hint { font-size:0.74rem; color:var(--md-on-surface-variant); padding-left:0.15rem; line-height:1.35; }

    /* Checkbox custom accessibile */
    .ak-check { display:flex; align-items:flex-start; gap:0.6rem; cursor:pointer; padding:0.55rem 0.2rem; }
    .ak-check input { position:absolute; opacity:0; width:1px; height:1px; }
    .ak-check-box { flex-shrink:0; width:22px; height:22px; border-radius:7px; border:2px solid var(--md-outline);
        background:var(--md-surface-container-lowest); display:flex; align-items:center; justify-content:center;
        transition:all .15s ease; margin-top:1px; }
    .ak-check-box .material-symbols-rounded { font-size:1rem; color:#fff; opacity:0; transform:scale(0.6); transition:all .15s ease; }
    .ak-check input:checked + .ak-check-box { background:var(--md-primary); border-color:var(--md-primary); }
    .ak-check input:checked + .ak-check-box .material-symbols-rounded { opacity:1; transform:scale(1); }
    .ak-check input:focus-visible + .ak-check-box { outline:3px solid var(--md-outline-focus); outline-offset:2px; }
    .ak-check-text { font-size:0.9rem; font-weight:600; color:var(--md-on-surface); line-height:1.3; }
    .ak-check-text .ak-hint { font-weight:400; }

    /* ---------- CARD ELENCO ---------- */
    .ak-cards { display:grid; grid-template-columns:repeat(auto-fill, minmax(clamp(230px, 27vw, 300px), 1fr)); gap:1rem; }
    .ak-card {
        position:relative; background:var(--md-surface-container-lowest);
        border:1px solid var(--md-outline-variant); border-left:5px solid var(--ak-accent, var(--md-primary));
        border-radius:14px; padding:1rem 1.1rem; display:flex; flex-direction:column; gap:0.25rem;
        transition:transform .18s ease, box-shadow .18s ease, border-color .18s ease;
    }
    .ak-card:hover { transform:translateY(-3px); box-shadow:0 10px 22px -8px rgba(0,0,0,0.18); }
    .ak-card-title { font-weight:700; color:var(--md-on-surface); font-size:1rem; line-height:1.25; }
    .ak-card-sub { color:var(--md-on-surface-variant); font-size:0.86rem; line-height:1.35; }
    .ak-card-meta { color:var(--md-on-surface-variant); font-size:0.78rem; display:inline-flex; align-items:center; gap:0.3rem; }
    .ak-card-badge { position:absolute; top:0.7rem; right:0.7rem; background:var(--ak-accent, var(--md-primary)); color:#fff;
        font-size:0.66rem; font-weight:800; padding:0.15rem 0.5rem; border-radius:999px; text-transform:uppercase; letter-spacing:0.04em; }
    .ak-card-actions { display:flex; justify-content:flex-end; gap:0.4rem; margin-top:0.7rem; padding-top:0.7rem;
        border-top:1px solid var(--md-outline-variant); }

    .ak-iconbtn { background:transparent; border:1px solid var(--md-outline-variant); color:var(--md-on-surface-variant);
        cursor:pointer; width:34px; height:34px; border-radius:9px; display:inline-flex; align-items:center; justify-content:center;
        transition:all .15s ease; }
    .ak-iconbtn:hover { background:var(--md-primary); border-color:var(--md-primary); color:#fff; }
    .ak-iconbtn:focus-visible { outline:3px solid var(--md-outline-focus); outline-offset:1px; }
    .ak-iconbtn.danger { color:var(--md-error); }
    .ak-iconbtn.danger:hover { background:var(--md-error); border-color:var(--md-error); color:#fff; }
    .ak-iconbtn .material-symbols-rounded { font-size:1.15rem; }

    /* ---------- STATO VUOTO ---------- */
    .ak-empty { text-align:center; padding:2.5rem 1rem; color:var(--md-on-surface-variant); display:flex; flex-direction:column; align-items:center; gap:0.4rem; }
    .ak-empty .material-symbols-rounded { font-size:3rem; color:var(--md-outline-variant); }
    .ak-empty h4 { margin:0.3rem 0 0; color:var(--md-on-surface); font-weight:700; }
    .ak-empty p { margin:0; font-size:0.9rem; }

    /* ---------- MODALE ---------- */
    .ak-modal { display:none; position:fixed; inset:0; z-index:10000; align-items:center; justify-content:center;
        background:rgba(15,23,42,0.45); backdrop-filter:blur(8px); -webkit-backdrop-filter:blur(8px); opacity:0; transition:opacity .25s ease; }
    .ak-modal-card { width:min(94vw, 860px); max-height:90vh; overflow-y:auto; background:var(--md-surface-container-lowest);
        border-radius:22px; box-shadow:0 24px 60px -12px rgba(0,0,0,0.4); transform:scale(0.95) translateY(10px);
        transition:transform .28s cubic-bezier(0.34,1.56,0.64,1); }
    .ak-modal-head { display:flex; align-items:center; justify-content:space-between; gap:1rem;
        padding:1.3rem 1.5rem 0.9rem; }
    .ak-modal-head h3 { margin:0; font-family:var(--font-heading); font-size:1.25rem; font-weight:700; color:var(--md-on-surface);
        display:flex; align-items:center; gap:0.5rem; }
    .ak-modal-head h3 .material-symbols-rounded { color:var(--ak-accent, var(--md-primary)); }
    .ak-modal-body { padding:0.4rem 1.5rem 1.5rem; }
    .ak-modal-hint { font-size:0.84rem; color:var(--md-on-surface-variant); background:var(--ak-soft, var(--md-surface-variant));
        border-radius:10px; padding:0.6rem 0.8rem; margin-bottom:1rem; display:flex; gap:0.5rem; align-items:flex-start; }
    .ak-modal-hint .material-symbols-rounded { font-size:1.1rem; color:var(--ak-accent, var(--md-primary)); flex-shrink:0; }
    .ak-form { display:flex; flex-direction:column; gap:0.9rem; }
    .ak-error { color:var(--md-on-error-container); background:var(--md-error-container); border-left:4px solid var(--md-error);
        padding:0.7rem 0.9rem; border-radius:10px; font-size:0.88rem; font-weight:500; display:none; }
    .ak-actions { display:flex; justify-content:flex-end; align-items:center; gap:0.7rem; margin-top:0.4rem;
        padding-top:1rem; border-top:1px solid var(--md-outline-variant); }
    .ak-btn { display:inline-flex; align-items:center; gap:0.4rem; cursor:pointer; border:none;
        padding:0.65rem 1.4rem; border-radius:999px; font-weight:700; font-size:0.92rem; transition:all .15s ease; }
    .ak-btn:focus-visible { outline:3px solid var(--md-outline-focus); outline-offset:2px; }
    .ak-btn-primary { background:var(--ak-accent, var(--md-primary)); color:#fff; box-shadow:0 4px 12px -2px rgba(0,0,0,0.25); }
    .ak-btn-primary:hover { transform:translateY(-1px); filter:brightness(1.06); }
    .ak-btn-ghost { background:transparent; color:var(--md-on-surface-variant); }
    .ak-btn-ghost:hover { background:var(--md-surface-variant); color:var(--md-on-surface); }
    .ak-btn-danger { background:transparent; color:var(--md-error); margin-right:auto; }
    .ak-btn-danger:hover { background:var(--md-error-container); color:var(--md-on-error-container); }
    .ak-btn:disabled { opacity:0.6; cursor:not-allowed; transform:none; }

    @media (max-width: 680px) {
        .ak-hero { padding:0.9rem 1rem; }
        .ak-hero-actions { width:100%; }
        .ak-hero-btn { width:100%; justify-content:center; }
        .ak-form-grid { grid-template-columns:1fr; }
        .ak-toolbar { flex-direction:column; align-items:stretch; }
    }

    /* --- Compatibilità componente audit condiviso (audit_trail_button.js) --- */
    .btn-icon-action { background:transparent; border:1px solid var(--md-outline-variant); color:var(--md-on-surface-variant);
        cursor:pointer; width:34px; height:34px; border-radius:9px; display:inline-flex; align-items:center; justify-content:center; transition:all .15s ease; }
    .btn-icon-action:hover { background:var(--md-primary); border-color:var(--md-primary); color:#fff; }
    .btn-icon-action:focus-visible { outline:3px solid var(--md-outline-focus); outline-offset:1px; }
    .ak-hero .btn-icon-action { width:40px; height:40px; border-radius:12px;
        background:rgba(255,255,255,0.18); border:1px solid rgba(255,255,255,0.35); color:#fff; }
    .ak-hero .btn-icon-action:hover { background:rgba(255,255,255,0.32); border-color:rgba(255,255,255,0.6); }

    /* Record dello storico revisioni (audit modal) */
    .scheda-record { background:var(--md-surface-container-lowest); border:1px solid var(--md-outline-variant);
        border-left:4px solid var(--md-primary); border-radius:12px; padding:1rem; margin-bottom:0.8rem; }
    .scheda-record-title { font-weight:700; color:var(--md-on-surface); }
    .scheda-record-sub { font-size:0.85rem; color:var(--md-on-surface-variant); margin-top:0.2rem; }
</style>
`;
