import TwofaPanel from '../../../../js/shared/twofa_panel.js';
import { toast } from '../../../../js/utils.js';

function fieldHtml(id, label, icon, opts = {}) {
    return `
        <div style="margin-bottom:1rem;">
            <label style="display:flex; align-items:center; gap:0.4rem; margin-bottom:0.4rem; color:var(--md-on-surface-variant); font-weight:600; font-size:0.9rem;">
                <span class="material-symbols-rounded" style="font-size:1.1rem; color:var(--md-primary);">${icon}</span>${label}
            </label>
            <input type="${opts.type || 'password'}" id="${id}" ${opts.maxlength ? `maxlength="${opts.maxlength}"` : ''} ${opts.inputmode ? `inputmode="${opts.inputmode}"` : ''} placeholder="${opts.placeholder || ''}" style="width:100%; padding:0.75rem; border-radius:8px; border:1px solid var(--md-outline); background:var(--md-surface); color:var(--md-on-surface); outline:none;">
        </div>
    `;
}

export default {
    render: async (el) => {
        const userId = sessionStorage.getItem('currentUserId');
        if (!userId) { el.innerHTML = `<p style="padding:2rem; text-align:center; color: var(--md-error);">Utente non autenticato.</p>`; return; }
        el.innerHTML = `
            <div style="display:flex; align-items:center; gap:0.6rem; margin-bottom:1.5rem;">
                <span class="material-symbols-rounded" style="font-size:2rem; color: var(--md-primary);">verified_user</span>
                <div>
                    <h2 style="margin:0; font-size:1.4rem; color: var(--md-on-surface);">Sicurezza</h2>
                    <p style="margin:0.2rem 0 0 0; color: var(--md-on-surface-variant); font-size:0.9rem;">Gestisci password, PIN e l'autenticazione a due fattori del tuo account.</p>
                </div>
            </div>

            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(320px, 1fr)); gap:1.5rem; margin-bottom:1.5rem;">
                <div class="card fade-in-up" style="padding:1.5rem; background:var(--md-surface); border-radius:16px; border:1px solid var(--md-surface-variant);">
                    <h3 style="margin:0 0 1rem; font-size:1.15rem; color:var(--md-on-surface); display:flex; align-items:center; gap:0.5rem;">
                        <span class="material-symbols-rounded" style="color:var(--md-primary);">password</span> Cambia Password
                    </h3>
                    ${fieldHtml('sic-pwd-current', 'Password Attuale', 'lock')}
                    ${fieldHtml('sic-pwd-new', 'Nuova Password', 'key', { placeholder: 'Almeno 6 caratteri' })}
                    ${fieldHtml('sic-pwd-confirm', 'Conferma Nuova Password', 'key')}
                    <button id="sic-btn-save-password" class="btn primary" style="display:flex; align-items:center; gap:0.5rem; padding:0.7rem 1.4rem; margin-top:0.5rem;">
                        <span class="material-symbols-rounded">save</span> Aggiorna Password
                    </button>
                </div>

                <div class="card fade-in-up" style="padding:1.5rem; background:var(--md-surface); border-radius:16px; border:1px solid var(--md-surface-variant);">
                    <h3 style="margin:0 0 1rem; font-size:1.15rem; color:var(--md-on-surface); display:flex; align-items:center; gap:0.5rem;">
                        <span class="material-symbols-rounded" style="color:var(--md-primary);">dialpad</span> Cambia PIN di Accesso
                    </h3>
                    ${fieldHtml('sic-pin-current-password', 'Password Attuale', 'lock', { placeholder: 'Per confermare la tua identità' })}
                    ${fieldHtml('sic-pin-new', 'Nuovo PIN (6 cifre)', 'dialpad', { maxlength: 6, inputmode: 'numeric', placeholder: '••••••' })}
                    ${fieldHtml('sic-pin-confirm', 'Conferma Nuovo PIN', 'dialpad', { maxlength: 6, inputmode: 'numeric', placeholder: '••••••' })}
                    <button id="sic-btn-save-pin" class="btn primary" style="display:flex; align-items:center; gap:0.5rem; padding:0.7rem 1.4rem; margin-top:0.5rem;">
                        <span class="material-symbols-rounded">save</span> Aggiorna PIN
                    </button>
                </div>
            </div>

            <div id="sic-twofa-panel"></div>
        `;

        const btnSavePassword = el.querySelector('#sic-btn-save-password');
        btnSavePassword.addEventListener('click', async () => {
            const currentPassword = el.querySelector('#sic-pwd-current').value;
            const newPassword = el.querySelector('#sic-pwd-new').value;
            const confirmPassword = el.querySelector('#sic-pwd-confirm').value;

            if (!currentPassword || !newPassword) { toast('Compila tutti i campi', 'error'); return; }
            if (newPassword !== confirmPassword) { toast('La conferma non coincide con la nuova password', 'error'); return; }
            if (newPassword.length < 6) { toast('La nuova password deve contenere almeno 6 caratteri', 'error'); return; }

            const old = btnSavePassword.innerHTML;
            btnSavePassword.disabled = true;
            btnSavePassword.innerHTML = '<span class="material-symbols-rounded" style="animation:spin 1s linear infinite;">sync</span> Salvataggio...';
            try {
                await window.electronAPI.usersChangeOwnPassword({ currentPassword, newPassword });
                toast('Password aggiornata con successo', 'success');
                el.querySelector('#sic-pwd-current').value = '';
                el.querySelector('#sic-pwd-new').value = '';
                el.querySelector('#sic-pwd-confirm').value = '';
            } catch (e) {
                toast(e.message || 'Errore durante il cambio password', 'error');
            } finally {
                btnSavePassword.disabled = false;
                btnSavePassword.innerHTML = old;
            }
        });

        const btnSavePin = el.querySelector('#sic-btn-save-pin');
        btnSavePin.addEventListener('click', async () => {
            const currentPassword = el.querySelector('#sic-pin-current-password').value;
            const newPin = el.querySelector('#sic-pin-new').value;
            const confirmPin = el.querySelector('#sic-pin-confirm').value;

            if (!currentPassword) { toast('Inserisci la password attuale per confermare la tua identità', 'error'); return; }
            if (!/^\d{6}$/.test(newPin)) { toast('Il PIN deve essere composto da 6 cifre', 'error'); return; }
            if (newPin !== confirmPin) { toast('La conferma non coincide con il nuovo PIN', 'error'); return; }

            const old = btnSavePin.innerHTML;
            btnSavePin.disabled = true;
            btnSavePin.innerHTML = '<span class="material-symbols-rounded" style="animation:spin 1s linear infinite;">sync</span> Salvataggio...';
            try {
                await window.electronAPI.usersChangeOwnPin({ currentPassword, newPin });
                toast('PIN aggiornato con successo', 'success');
                el.querySelector('#sic-pin-current-password').value = '';
                el.querySelector('#sic-pin-new').value = '';
                el.querySelector('#sic-pin-confirm').value = '';
            } catch (e) {
                toast(e.message || 'Errore durante il cambio PIN', 'error');
            } finally {
                btnSavePin.disabled = false;
                btnSavePin.innerHTML = old;
            }
        });

        TwofaPanel.render(el.querySelector('#sic-twofa-panel'), userId);
    }
};
