import { toast } from '../../../../js/utils.js';

// Campi salvati nella config (chiave -> etichetta). Usati per compilare i
// placeholder dell'istituto nella presa di servizio.
const FIELDS = [
    { key: 'istituto_nome', label: 'Denominazione Istituto', icon: 'school', ph: 'Es. I.C. Giovanni Verga', span: 2 },
    { key: 'istituto_codice_meccanografico', label: 'Codice Meccanografico', icon: 'tag', ph: 'Es. RMIC8AA00X' },
    { key: 'istituto_indirizzo', label: 'Indirizzo Completo', icon: 'location_on', ph: 'Via, civico, CAP, città (Prov.)', span: 2 },
    { key: 'istituto_telefono', label: 'Telefono Istituto', icon: 'call', ph: 'Es. 06 1234567' },
    { key: 'istituto_email', label: 'Email Istituto', icon: 'mail', ph: 'Es. rmic8aa00x@istruzione.it' },
    { key: 'istituto_cc_banca', label: 'Banca / Istituto Tesoreria', icon: 'account_balance', ph: 'Es. Banca d\'Italia', span: 2 },
    { key: 'istituto_cc_intestatario', label: 'Intestatario Conto', icon: 'badge', ph: 'Intestatario del conto tesoreria' },
    { key: 'istituto_cc_iban', label: 'IBAN Conto Corrente', icon: 'tag', ph: 'IBAN della tesoreria della scuola' },
    { key: 'istituto_fondo_espero', label: 'Fondo Espero', icon: 'savings', ph: 'Es. Aderente / Non aderente', span: 2 }
];

export default {
    render: async (el) => {
        try {
            el.innerHTML = `
                <div class="fade-in-up" style="display:flex; flex-direction:column; height:100%; padding:1.5rem; overflow-y:auto;">
                    <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:1.5rem; gap:1rem; flex-wrap:wrap;">
                        <div>
                            <h2 style="margin:0 0 0.4rem; font-size:2rem; color:var(--md-on-surface); font-weight:800; letter-spacing:-0.02em;">Dati Istituto</h2>
                            <p style="margin:0; color:var(--md-on-surface-variant); font-size:1.05rem; max-width:640px;">Dati costanti della scuola, inseriti una sola volta e compilati automaticamente in ogni presa di servizio (nome istituto, codice meccanografico, tesoreria, ecc.).</p>
                        </div>
                        <button id="di-save" class="btn primary" style="display:flex; align-items:center; gap:0.5rem;">
                            <span class="material-symbols-rounded">save</span> Salva Dati Istituto
                        </button>
                    </div>
                    <div class="card" style="padding:1.5rem; background:var(--md-surface); border-radius:16px; border:1px solid var(--md-surface-variant);">
                        <div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:1.2rem;">
                            ${FIELDS.map(f => `
                                <div style="${f.span === 2 ? 'grid-column:1 / -1;' : ''}">
                                    <label style="display:flex; align-items:center; gap:0.4rem; margin-bottom:0.4rem; color:var(--md-on-surface-variant); font-weight:600; font-size:0.9rem;">
                                        <span class="material-symbols-rounded" style="font-size:1.1rem; color:var(--md-primary);">${f.icon}</span>${f.label}
                                    </label>
                                    <input type="text" id="di-${f.key}" placeholder="${f.ph}" style="width:100%; padding:0.75rem; border-radius:8px; border:1px solid var(--md-outline); background:var(--md-surface); color:var(--md-on-surface); outline:none;">
                                </div>`).join('')}
                        </div>
                    </div>
                </div>
            `;

            const config = await window.electronAPI.readConfig() || {};
            FIELDS.forEach(f => { const i = document.getElementById('di-' + f.key); if (i && config[f.key]) i.value = config[f.key]; });

            document.getElementById('di-save').addEventListener('click', async (ev) => {
                const btn = ev.currentTarget;
                const old = btn.innerHTML;
                btn.disabled = true;
                btn.innerHTML = '<span class="material-symbols-rounded" style="animation:spin 1s linear infinite;">sync</span> Salvataggio...';
                try {
                    const patch = {};
                    FIELDS.forEach(f => { patch[f.key] = (document.getElementById('di-' + f.key).value || '').trim(); });
                    const ok = await window.electronAPI.saveConfig(Object.assign({}, config, patch));
                    toast(ok ? 'Dati istituto salvati' : 'Errore durante il salvataggio', ok ? 'success' : 'error');
                } catch (e) {
                    toast('Errore: ' + e.message, 'error');
                } finally {
                    btn.disabled = false;
                    btn.innerHTML = old;
                }
            });
        } catch (e) {
            console.error(e);
            el.innerHTML = '<div style="padding:2rem; color:var(--md-error);">Errore rendering Dati Istituto: ' + e.message + '</div>';
        }
    }
};
