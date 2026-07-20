import { Router, toast } from '../../utils.js';
import AuthState from './auth_state.js';
import AuthTwoFaForm from './auth_2fa_form.js';
const AuthLoginForm = {
    render: (el) => {
        try {
            const container = el.querySelector('#login-container');
            if (!container) return;
            const targetUser = AuthState.users.find(u => u.id === AuthState.selectedUserId) || {};
            const initial = targetUser.username ? targetUser.username.charAt(0).toUpperCase() : '?';
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
            container.style.padding = '0';
            
            const savedMethod = localStorage.getItem('loginMethod_' + AuthState.selectedUserId);
            AuthState.loginMethod = AuthState.loginMethod || savedMethod || 'pin';
            const currentMethod = AuthState.loginMethod;

            let headerHtml = `
                <div class="selected-user-banner fade-in" style="flex-direction: column; align-items: center; border: none; padding-bottom: 0;">
                    <div class="banner-avatar" style="width: 60px; height: 60px; font-size: 1.5rem; margin-bottom: 0.5rem; box-shadow: 0 5px 15px rgba(59, 130, 246, 0.3);">${initial}</div>
                    <div class="banner-info" style="align-items: center; text-align: center;">
                        <span class="banner-name" style="font-size: 1.2rem; margin-bottom: 0.1rem;">${targetUser.username || 'Utente'}</span>
                        <span class="banner-role" style="margin-bottom: 0.5rem; font-size: 0.85rem;">${targetUser.is_superadmin ? 'Amministratore' : 'Utente'}</span>
                    </div>
                </div>
            `;
            
            const tabsHtml = `
                <div class="auth-tabs fade-in" style="display: flex; justify-content: center; gap: 0.5rem; margin-bottom: 1rem;">
                    <button class="btn-tab ${currentMethod === 'pin' ? 'active' : ''}" data-method="pin" style="padding: 0.4rem 0.8rem; border-radius: 8px; border: 1px solid #ccc; background: ${currentMethod === 'pin' ? '#e2e8f0' : 'transparent'}; cursor: pointer;">PIN</button>
                    <button class="btn-tab ${currentMethod === 'password' ? 'active' : ''}" data-method="password" style="padding: 0.4rem 0.8rem; border-radius: 8px; border: 1px solid #ccc; background: ${currentMethod === 'password' ? '#e2e8f0' : 'transparent'}; cursor: pointer;">Password</button>
                    <button class="btn-tab ${currentMethod === 'passkey' ? 'active' : ''}" data-method="passkey" style="padding: 0.4rem 0.8rem; border-radius: 8px; border: 1px solid #ccc; background: ${currentMethod === 'passkey' ? '#e2e8f0' : 'transparent'}; cursor: pointer;">Passkey</button>
                </div>
            `;

            const backButtonHtml = `
                <div style="text-align: center; margin-top: 0.5rem;" class="fade-in">
                    <button id="btn-change-user" class="btn-reset" style="margin: 0 auto; font-size: 0.9rem;">
                        <span class="material-symbols-rounded" style="font-size: 1.1rem;">arrow_back</span>
                        <span>Scegli un altro utente</span>
                    </button>
                </div>
            `;
            
            let formHtml = '';

            if (currentMethod === 'password') {
                formHtml = `
                    <div class="form-section fade-in">
                        <form id="password-form" class="auth-form" style="margin-bottom: 0;">
                            <div class="input-group" style="margin-bottom: 0.8rem;">
                                <span class="material-symbols-rounded input-icon">key</span>
                                <input type="password" id="fallback-password" class="input-field" placeholder="Password di Sicurezza" required autofocus>
                            </div>
                            <button type="submit" class="btn-submit">
                                <span>Accedi al Sistema</span>
                                <span class="material-symbols-rounded">login</span>
                            </button>
                        </form>
                    </div>
                `;
            } else if (currentMethod === 'passkey') {
                formHtml = `
                    <div class="form-section fade-in" style="text-align: center;">
                        <p style="margin-bottom: 1rem; color: #64748b; font-size: 0.9rem;">Prepara il tuo dispositivo di autenticazione.</p>
                        <button id="btn-login-passkey" class="btn-submit" style="margin: 0 auto;">
                            <span class="material-symbols-rounded">fingerprint</span>
                            <span>Accedi con Passkey</span>
                        </button>
                    </div>
                `;
            } else {
                formHtml = `
                    <div class="form-section fade-in">
                        <form id="pin-form" class="auth-form" style="margin-bottom: 0;">
                            <div class="pin-grid" style="margin-bottom: 1rem;">
                                <input type="password" maxlength="1" class="pin-box" data-index="0" autofocus required style="width: 2.5rem; height: 3rem; font-size: 1.5rem;">
                                <input type="password" maxlength="1" class="pin-box" data-index="1" required style="width: 2.5rem; height: 3rem; font-size: 1.5rem;">
                                <input type="password" maxlength="1" class="pin-box" data-index="2" required style="width: 2.5rem; height: 3rem; font-size: 1.5rem;">
                                <input type="password" maxlength="1" class="pin-box" data-index="3" required style="width: 2.5rem; height: 3rem; font-size: 1.5rem;">
                                <input type="password" maxlength="1" class="pin-box" data-index="4" required style="width: 2.5rem; height: 3rem; font-size: 1.5rem;">
                                <input type="password" maxlength="1" class="pin-box" data-index="5" required style="width: 2.5rem; height: 3rem; font-size: 1.5rem;">
                            </div>
                        </form>
                    </div>
                `;
            }

            container.innerHTML = headerHtml + tabsHtml + formHtml + backButtonHtml;

            const tabs = container.querySelectorAll('.btn-tab');
            tabs.forEach(t => t.addEventListener('click', (e) => {
                try {
                    const newMethod = e.target.getAttribute('data-method');
                    AuthState.loginMethod = newMethod;
                    localStorage.setItem('loginMethod_' + AuthState.selectedUserId, newMethod);
                    if (newMethod === 'passkey') AuthState.passkeyAutoTriggered = false;
                    AuthLoginForm.render(el);
                } catch (_) {}
            }));

            if (currentMethod === 'password') {
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
            } else if (currentMethod === 'passkey') {
                const pkBtn = container.querySelector('#btn-login-passkey');
                if (pkBtn) {
                    pkBtn.addEventListener('click', async (e) => {
                        try {
                            if (e) e.preventDefault();
                            await AuthLoginForm.attemptLogin(el, { id: AuthState.selectedUserId, passkey: true });
                        } catch (_) {}
                    });
                    
                    if (!AuthState.passkeyAutoTriggered) {
                        AuthState.passkeyAutoTriggered = true;
                        setTimeout(() => pkBtn.click(), 300);
                    }
                }
            } else {
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
                        AuthState.loginMethod = null;
                        AuthState.passkeyAutoTriggered = false;
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
            if (result && result.requires2fa) {
                AuthTwoFaForm.render(el, {
                    challengeToken: result.challengeToken,
                    methods: result.methods || [],
                    userId: credentials.id,
                    onBack: () => AuthLoginForm.render(el)
                });
                return;
            }
            if (result && result.success) {
                try {
                    sessionStorage.setItem('currentUserId', credentials.id);
                    localStorage.setItem('lastLoggedInUserId', credentials.id);
                    if (window.electronAPI && window.electronAPI.broadcastLogin) {
                        window.electronAPI.broadcastLogin(credentials.id).catch(() => {});
                    }
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
                    toast(result?.error || `PIN errato (${3 - AuthState.pinAttempts} tentativi rimasti)`, "error");
                    if (AuthState.pinAttempts >= 3) {
                        AuthLoginForm.render(el);
                    } else if (pinInputs) {
                        pinInputs.forEach(i => { try { i.value = ''; i.classList.add('pin-error'); } catch(_) {} });
                        try { pinInputs[0].focus(); } catch(_) {}
                    }
                } else if (credentials.passkey) {
                    toast(result?.error || "Autenticazione Passkey fallita", "error");
                } else {
                    toast(result?.error || "Password errata", "error");
                }
            }
        } catch (_) {}
    }
};
export default AuthLoginForm;
