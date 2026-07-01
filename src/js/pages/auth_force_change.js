import { Router, toast } from '../utils.js';
const AuthForceChange = {
    render: async (el) => {
        const currentUserId = sessionStorage.getItem('currentUserId');
        if (!currentUserId) {
            Router.navigate('auth_login');
            return;
        }
        const html = `
            <div class="fade-in-up" style="width: 100%; max-width: 500px; margin: auto; padding-top: 2rem;">
                <div class="card" style="padding: 2rem;">
                    <div style="text-align: center; margin-bottom: 2rem;">
                        <span class="material-symbols-rounded" style="font-size: 3.5rem; color: var(--md-primary); margin-bottom: 0.5rem;">admin_panel_settings</span>
                        <h1 class="text-title" style="margin-bottom: 0.5rem;">Aggiornamento Credenziali Obbligatorio</h1>
                        <p class="text-body" style="color: var(--md-on-surface-variant); font-size: 0.95rem;">
                            Il tuo account è stato creato o resettato da un Amministratore di Rete. 
                            In conformità con i protocolli di sicurezza aziendale, sei tenuto a impostare delle credenziali personali per abilitare il tuo profilo prima di poter accedere all'infrastruttura.
                        </p>
                    </div>
                    <form id="force-change-form">
                        <div class="form-group" style="margin-bottom: 1.5rem;">
                            <label style="display: block; font-weight: 500; margin-bottom: 0.5rem; color: var(--md-on-surface);">Nuova Password di Sicurezza</label>
                            <input type="password" id="new-pwd" class="input-field" placeholder="Inserisci nuova password" required minlength="6" autofocus>
                        </div>
                        <div class="form-group" style="margin-bottom: 1.5rem;">
                            <label style="display: block; font-weight: 500; margin-bottom: 0.5rem; color: var(--md-on-surface);">Conferma Password</label>
                            <input type="password" id="confirm-pwd" class="input-field" placeholder="Ripeti la password" required>
                        </div>
                        <hr style="border: 0; border-top: 1px solid var(--md-outline); margin: 2rem 0;">
                        <div class="form-group" style="margin-bottom: 1.5rem;">
                            <label style="display: block; font-weight: 500; margin-bottom: 0.5rem; color: var(--md-on-surface);">Nuovo PIN Operativo (6 Cifre)</label>
                            <input type="password" id="new-pin" class="input-field" placeholder="es. 123456" maxlength="6" pattern="[0-9]{6}" required>
                        </div>
                        <div class="form-group" style="margin-bottom: 2rem;">
                            <label style="display: block; font-weight: 500; margin-bottom: 0.5rem; color: var(--md-on-surface);">Conferma PIN</label>
                            <input type="password" id="confirm-pin" class="input-field" placeholder="Ripeti il PIN" maxlength="6" pattern="[0-9]{6}" required>
                        </div>
                        <button type="submit" class="btn btn-primary" style="width: 100%; justify-content: center; font-size: 1.1rem; padding: 12px;">
                            <span class="material-symbols-rounded">verified_user</span> 
                            Autentica e Accedi
                        </button>
                    </form>
                </div>
            </div>
            <style>
                .input-field {
                    width: 100%;
                    padding: 14px 16px;
                    font-size: 1rem;
                    border: 2px solid var(--md-outline);
                    border-radius: 12px;
                    background: var(--md-surface-variant);
                    color: var(--md-on-surface);
                    transition: all 0.2s;
                }
                .input-field:focus {
                    outline: none;
                    border-color: var(--md-primary);
                    background: var(--md-surface);
                    box-shadow: 0 0 0 3px rgba(103, 80, 164, 0.15);
                }
            </style>
        `;
        el.innerHTML = html;
        el.querySelector('#force-change-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const pwd = el.querySelector('#new-pwd').value;
            const pwd2 = el.querySelector('#confirm-pwd').value;
            const pin = el.querySelector('#new-pin').value;
            const pin2 = el.querySelector('#confirm-pin').value;
            if (pwd !== pwd2) {
                toast("Le password non coincidono", "error");
                return;
            }
            if (pin !== pin2) {
                toast("I PIN non coincidono", "error");
                return;
            }
            try {
                const usersRes = await window.electronAPI.getUsersList();
                const user = usersRes.users.find(u => u.id === currentUserId);
                if (!user) throw new Error("Utente non trovato");
                const result = await window.electronAPI.usersUpdate({
                    id: currentUserId,
                    username: user.username,
                    email: user.email || '',
                    password: pwd,
                    pin: pin,
                    must_change_password: 0
                });
                if (result.success) {
                    toast("Credenziali aggiornate con successo", "success");
                    Router.navigate('dashboard');
                } else {
                    toast(result.error || "Errore durante l'aggiornamento", "error");
                }
            } catch (err) {
                console.error(err);
                toast("Si è verificato un errore di sistema", "error");
            }
        });
    }
};
export default AuthForceChange;
