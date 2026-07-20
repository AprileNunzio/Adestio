import { Router, toast } from '../../utils.js';
import { startAuthentication, isWebauthnSupported } from '../../webauthn_client.js';
async function finalizeSession(userId) {
    try {
        sessionStorage.setItem('currentUserId', userId);
        localStorage.setItem('lastLoggedInUserId', userId);
        if (window.electronAPI && window.electronAPI.broadcastLogin) {
            window.electronAPI.broadcastLogin(userId).catch(() => {});
        }
    } catch (_) {}
}
const AuthTwoFaForm = {
    render: (el, { challengeToken, methods, userId, onBack }) => {
        try {
            const container = el.querySelector('#login-container');
            if (!container) return;
            const hasTotp = methods.includes('totp');
            const hasWebauthn = methods.includes('webauthn') && isWebauthnSupported();
            container.innerHTML = `
                <div class="selected-user-banner fade-in" style="flex-direction: column; align-items: center; border: none; padding-bottom: 0;">
                    <div class="banner-avatar" style="width: 70px; height: 70px; font-size: 1.8rem; margin-bottom: 1rem;"><span class="material-symbols-rounded" style="font-size: 1.8rem;">verified_user</span></div>
                    <div class="banner-info" style="align-items: center; text-align: center;">
                        <span class="banner-name" style="font-size: 1.3rem; margin-bottom: 0.3rem;">Verifica in due passaggi</span>
                        <span class="banner-role" style="margin-bottom: 1.5rem;">Conferma la tua identità per completare l'accesso</span>
                    </div>
                </div>
                <div class="form-section fade-in" id="tfa-form-section"></div>
                <div style="text-align: center; margin-top: 1rem;" class="fade-in">
                    <button id="tfa-back" class="btn-reset" style="margin: 0 auto;">
                        <span class="material-symbols-rounded">arrow_back</span>
                        <span>Torna al login</span>
                    </button>
                </div>
            `;
            container.querySelector('#tfa-back').addEventListener('click', () => { if (onBack) onBack(); });
            const section = container.querySelector('#tfa-form-section');
            const renderTotp = () => {
                section.innerHTML = `
                    <form id="tfa-totp-form" class="auth-form">
                        <div class="input-group">
                            <span class="material-symbols-rounded input-icon">password</span>
                            <input type="text" id="tfa-totp-code" class="input-field" placeholder="Codice a 6 cifre" maxlength="6" inputmode="numeric" autofocus required>
                        </div>
                        <button type="submit" class="btn-submit">
                            <span>Verifica</span>
                            <span class="material-symbols-rounded">check</span>
                        </button>
                    </form>
                    <div style="display:flex; flex-direction:column; gap:0.6rem; margin-top:1rem; align-items:center;">
                        ${hasWebauthn ? `<button id="tfa-use-webauthn" class="btn-reset">Usa la Passkey al suo posto</button>` : ''}
                        <button id="tfa-use-backup" class="btn-reset">Ho perso l'accesso, usa un codice di backup</button>
                    </div>
                `;
                section.querySelector('#tfa-totp-form').addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const code = section.querySelector('#tfa-totp-code').value;
                    await submitVerification({ code });
                });
                if (hasWebauthn) {
                    section.querySelector('#tfa-use-webauthn').addEventListener('click', renderWebauthn);
                }
                section.querySelector('#tfa-use-backup').addEventListener('click', renderBackup);
            };
            const renderWebauthn = () => {
                section.innerHTML = `
                    <div style="text-align:center; padding: 1rem 0;">
                        <span class="material-symbols-rounded" style="font-size: 3rem; color: #3b82f6;">fingerprint</span>
                        <p class="pin-instruction">Premi il pulsante e completa la verifica con Windows Hello, impronta digitale o la tua chiave di sicurezza.</p>
                        <button id="tfa-webauthn-start" class="btn-submit"><span class="material-symbols-rounded">fingerprint</span> <span>Usa Passkey</span></button>
                    </div>
                    <div style="display:flex; flex-direction:column; gap:0.6rem; margin-top:1rem; align-items:center;">
                        ${hasTotp ? `<button id="tfa-use-totp" class="btn-reset">Usa il codice dell'app di autenticazione</button>` : ''}
                        <button id="tfa-use-backup" class="btn-reset">Ho perso l'accesso, usa un codice di backup</button>
                    </div>
                `;
                section.querySelector('#tfa-webauthn-start').addEventListener('click', async () => {
                    try {
                        toast('Segui le istruzioni del dispositivo…', 'info');
                        const optsRes = await window.electronAPI.loginWebauthnOptions({ challengeToken });
                        if (!optsRes || !optsRes.success) { toast((optsRes && optsRes.error) || 'Passkey non disponibile', 'error'); return; }
                        const assertion = await startAuthentication(optsRes.options);
                        await submitVerification({ assertion });
                    } catch (err) {
                        console.error(err);
                        toast(err.message || 'Verifica passkey annullata', 'error');
                    }
                });
                if (hasTotp) section.querySelector('#tfa-use-totp').addEventListener('click', renderTotp);
                section.querySelector('#tfa-use-backup').addEventListener('click', renderBackup);
            };
            const renderBackup = () => {
                section.innerHTML = `
                    <form id="tfa-backup-form" class="auth-form">
                        <div class="input-group">
                            <span class="material-symbols-rounded input-icon">key</span>
                            <input type="text" id="tfa-backup-code" class="input-field" placeholder="Codice di backup (es. AB12C-D34EF)" autofocus required>
                        </div>
                        <button type="submit" class="btn-submit">
                            <span>Verifica</span>
                            <span class="material-symbols-rounded">check</span>
                        </button>
                    </form>
                    <div style="display:flex; flex-direction:column; gap:0.6rem; margin-top:1rem; align-items:center;">
                        ${hasTotp ? `<button id="tfa-use-totp" class="btn-reset">Torna al codice dell'app di autenticazione</button>` : ''}
                        ${hasWebauthn ? `<button id="tfa-use-webauthn" class="btn-reset">Usa la Passkey</button>` : ''}
                    </div>
                `;
                section.querySelector('#tfa-backup-form').addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const backupCode = section.querySelector('#tfa-backup-code').value;
                    await submitVerification({ backupCode });
                });
                if (hasTotp) section.querySelector('#tfa-use-totp').addEventListener('click', renderTotp);
                if (hasWebauthn) section.querySelector('#tfa-use-webauthn').addEventListener('click', renderWebauthn);
            };
            const submitVerification = async (payload) => {
                try {
                    toast('Verifica in corso...', 'info');
                    const result = await window.electronAPI.loginUserVerify2fa({ challengeToken, ...payload });
                    if (result && result.success) {
                        await finalizeSession(userId);
                        if (result.must_change_password) {
                            toast('Richiesto aggiornamento credenziali', 'warning');
                            Router.navigate('auth_force_change');
                        } else {
                            toast('Accesso completato!', 'success');
                            Router.navigate('dashboard');
                        }
                    } else {
                        toast((result && result.error) || 'Verifica non riuscita', 'error');
                    }
                } catch (err) {
                    console.error(err);
                    toast('Errore durante la verifica', 'error');
                }
            };
            if (hasTotp) renderTotp();
            else if (hasWebauthn) renderWebauthn();
            else renderBackup();
        } catch (e) {
            console.error(e);
        }
    }
};
export default AuthTwoFaForm;
