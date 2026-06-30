import { Router, toast } from '../../utils.js';
import AuthState from './auth_state.js';

const AuthLoginForm = {
    render: (el) => {
        try {
            const container = el.querySelector('#login-container');
            if (!container) return;
            const targetUser = AuthState.users.find(u => u.id === AuthState.selectedUserId) || {};
            const initial = targetUser.username ? targetUser.username.charAt(0).toUpperCase() : '?';

            // Hide grid and extra buttons
            const grid = el.querySelector('.users-grid');
            const moreBtn = el.querySelector('#btn-show-all');
            const subtitle = el.querySelector('.text-subtitle');
            if (grid) grid.style.display = 'none';
            if (moreBtn) moreBtn.style.display = 'none';
            if (subtitle) subtitle.innerText = 'Inserisci le tue credenziali per accedere';

            container.style.display = 'block';
            container.style.background = 'transparent';
            container.style.border = 'none';
            container.style.boxShadow = 'none';
            container.style.padding = '1rem 0 0 0';

            let headerHtml = `
                <div class="selected-user-banner fade-in" style="flex-direction: column; align-items: center; border: none; padding-bottom: 0;">
                    <div class="banner-avatar" style="width: 80px; height: 80px; font-size: 2rem; margin-bottom: 1rem; box-shadow: 0 10px 25px rgba(59, 130, 246, 0.3);">${initial}</div>
                    <div class="banner-info" style="align-items: center; text-align: center;">
                        <span class="banner-name" style="font-size: 1.5rem; margin-bottom: 0.3rem;">${targetUser.username || 'Utente'}</span>
                        <span class="banner-role" style="margin-bottom: 1.5rem;">${targetUser.is_superadmin ? 'Amministratore di Sistema' : 'Utente Standard'}</span>
                    </div>
                </div>
            `;

            const backButtonHtml = `
                <div style="text-align: center; margin-top: 1rem;" class="fade-in">
                    <button id="btn-change-user" class="btn-reset" style="margin: 0 auto;">
                        <span class="material-symbols-rounded">arrow_back</span>
                        <span>Scegli un altro utente</span>
                    </button>
                </div>
            `;

            if (AuthState.pinAttempts >= 3) {
                container.innerHTML = headerHtml + `
                    <div class="form-section fade-in">
                        <div class="form-warning">
                            <span class="material-symbols-rounded">lock_clock</span>
                            <span>Tentativi PIN esauriti. Inserisci la Password.</span>
                        </div>
                        <form id="password-form" class="auth-form">
                            <div class="input-group">
                                <span class="material-symbols-rounded input-icon">key</span>
                                <input type="password" id="fallback-password" class="input-field" placeholder="Password di Sicurezza" required autofocus>
                            </div>
                            <button type="submit" class="btn-submit">
                                <span>Accedi al Sistema</span>
                                <span class="material-symbols-rounded">login</span>
                            </button>
                        </form>
                    </div>
                ` + backButtonHtml;
                const pwdForm = container.querySelector('#password-form');
                if (pwdForm) {
                    pwdForm.addEventListener('submit', async (e) => {
                        try {
                            e.preventDefault();
                            const pwdInput = container.querySelector('#fallback-password');
                            if (pwdInput) {
                                await AuthLoginForm.attemptLogin(el, { id: AuthState.selectedUserId, password: pwdInput.value });
                            }
                        } catch (_) {}
                    });
                }
                const pwdField = container.querySelector('#fallback-password');
                if (pwdField) setTimeout(() => { try { pwdField.focus(); } catch(_) {} }, 50);
            } else {
                container.innerHTML = headerHtml + `
                    <div class="form-section fade-in">
                        <form id="pin-form" class="auth-form">
                            <div class="pin-grid" style="margin-bottom: 2rem;">
                                <input type="password" maxlength="1" class="pin-box" data-index="0" autofocus required>
                                <input type="password" maxlength="1" class="pin-box" data-index="1" required>
                                <input type="password" maxlength="1" class="pin-box" data-index="2" required>
                                <input type="password" maxlength="1" class="pin-box" data-index="3" required>
                                <input type="password" maxlength="1" class="pin-box" data-index="4" required>
                                <input type="password" maxlength="1" class="pin-box" data-index="5" required>
                            </div>
                        </form>
                    </div>
                ` + backButtonHtml;
                const inputs = Array.from(container.querySelectorAll('.pin-box'));
                if (inputs.length > 0) setTimeout(() => { try { inputs[0].focus(); } catch(_) {} }, 50);
                inputs.forEach((input, idx) => {
                    input.addEventListener('input', async (e) => {
                        try {
                            const val = e.target.value;
                            input.classList.remove('pin-error');
                            if (/[^0-9]/.test(val)) { e.target.value = ''; return; }
                            if (val !== '' && idx < inputs.length - 1) inputs[idx + 1].focus();

                            if (idx === 5 && val !== '') {
                                const fullPin = inputs.map(i => i.value).join('');
                                if (fullPin.length === 6) {
                                    await AuthLoginForm.attemptLogin(el, { id: AuthState.selectedUserId, pin: fullPin }, inputs);
                                }
                            }
                        } catch (_) {}
                    });
                    input.addEventListener('keydown', (e) => {
                        try {
                            if (e.key === 'Backspace' && e.target.value === '' && idx > 0) {
                                inputs[idx - 1].focus();
                            }
                        } catch (_) {}
                    });
                });
            }

            const changeBtn = container.querySelector('#btn-change-user');
            if (changeBtn) {
                changeBtn.addEventListener('click', () => {
                    try {
                        AuthState.selectedUserId = null;
                        AuthState.pinAttempts = 0;
                        container.style.display = 'none';
                        container.innerHTML = '';
                        if (grid) grid.style.display = 'grid';
                        if (moreBtn) moreBtn.style.display = 'flex';
                        if (subtitle) subtitle.innerText = 'Seleziona il profilo per accedere alla postazione';
                        const cards = el.querySelectorAll('.user-card');
                        cards.forEach(c => c.classList.remove('selected'));
                    } catch (_) {}
                });
            }
        } catch (_) {}
    },

    attemptLogin: async (el, credentials, pinInputs = null) => {
        try {
            toast("Verifica in corso...", "info");
            const result = await window.electronAPI.loginUser(credentials);
            if (result && result.success) {
                try {
                    sessionStorage.setItem('currentUserId', credentials.id);
                    localStorage.setItem('lastLoggedInUserId', credentials.id);
                } catch (_) {}
                if (result.must_change_password) {
                    toast("Richiesto aggiornamento credenziali", "warning");
                    Router.navigate('auth_force_change');
                } else {
                    toast("Accesso completato!", "success");
                    Router.navigate('dashboard');
                }
            } else {
                if (credentials.pin) {
                    AuthState.pinAttempts++;
                    toast(`PIN errato (${3 - AuthState.pinAttempts} tentativi rimasti)`, "error");
                    if (AuthState.pinAttempts >= 3) {
                        AuthLoginForm.render(el);
                    } else if (pinInputs) {
                        pinInputs.forEach(i => { try { i.value = ''; i.classList.add('pin-error'); } catch(_) {} });
                        try { pinInputs[0].focus(); } catch(_) {}
                    }
                } else {
                    toast("Password errata", "error");
                }
            }
        } catch (_) {}
    }
};

export default AuthLoginForm;
