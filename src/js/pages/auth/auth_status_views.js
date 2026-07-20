import AuthStyles from './auth_styles.js';
const AuthStatusViews = {
    renderUnlockForm: (el) => {
        try {
            el.innerHTML = `
                <div class="auth-wrapper fade-in-up">
                    <div class="card-status status-warning" style="width: 400px; padding: 2rem;">
                        <span class="material-symbols-rounded icon-large" style="color: var(--color-warning);">lock_clock</span>
                        <h1 class="text-title" style="margin-bottom: 0.5rem;">Database Bloccato</h1>
                        <p class="text-body" style="margin-bottom: 1.5rem; color: var(--color-text-secondary);">
                            È stato rilevato un database sincronizzato su questo PC, ma le chiavi di sicurezza locali sono mancanti. Inserisci il <b>Codice di Rete</b> per autorizzare questo dispositivo.
                        </p>
                        <div class="form-group" style="text-align: left; width: 100%;">
                            <label class="form-label">Codice di Rete</label>
                            <div class="input-with-icon">
                                <span class="material-symbols-rounded">hub</span>
                                <input type="text" id="input-network-code" class="form-input" placeholder="Es. ABC-DEF-GHI" autocomplete="off">
                            </div>
                            <div id="unlock-error" class="error-text" style="display: none; margin-top: 0.5rem;">Codice errato o database non valido.</div>
                        </div>
                        <button id="btn-unlock-db" class="btn-action btn-primary" style="margin-top: 1rem; width: 100%;">
                            <span class="material-symbols-rounded">key</span>
                            <span>Sblocca Database</span>
                        </button>
                        <div style="margin-top: 1.5rem; border-top: 1px solid var(--color-border); padding-top: 1rem;">
                            <p class="text-body" style="font-size: 0.85rem; color: var(--color-text-secondary); margin-bottom: 0.5rem;">Se il database è effettivamente corrotto:</p>
                            <button id="btn-reset-node" class="btn-action btn-danger" style="width: 100%; padding: 0.5rem;">
                                <span class="material-symbols-rounded">delete_forever</span>
                                <span>Azzera Nodo Locale</span>
                            </button>
                        </div>
                    </div>
                </div>
                ${AuthStyles.getStyles()}
            `;
            
            const btnUnlock = el.querySelector('#btn-unlock-db');
            const inputCode = el.querySelector('#input-network-code');
            const errorText = el.querySelector('#unlock-error');
            
            if (btnUnlock && inputCode) {
                btnUnlock.addEventListener('click', async () => {
                    const code = inputCode.value.trim();
                    if (!code) return;
                    try {
                        btnUnlock.disabled = true;
                        errorText.style.display = 'none';
                        const success = await window.electronAPI.recoverDatabase(code);
                        if (success) {
                            window.location.reload();
                        } else {
                            errorText.style.display = 'block';
                            btnUnlock.disabled = false;
                        }
                    } catch (e) {
                        errorText.style.display = 'block';
                        btnUnlock.disabled = false;
                    }
                });
            }

            const btnReset = el.querySelector('#btn-reset-node');
            if (btnReset) {
                btnReset.addEventListener('click', async () => {
                    try {
                        if (confirm("Attenzione: questo eliminerà il database locale sincronizzato. Se usi OneDrive, la cancellazione potrebbe propagarsi ad altri PC. Procedere?")) {
                            await window.electronAPI.resetApp();
                        }
                    } catch (_) {}
                });
            }
        } catch (_) {}
    },
    renderEmptyState: (el) => {
        try {
            el.innerHTML = `
                <div class="auth-wrapper fade-in-up">
                    <div class="card-status status-warning">
                        <span class="material-symbols-rounded icon-large">error</span>
                        <h1 class="text-title">Nessun utente trovato</h1>
                        <p class="text-body">Il database è vuoto. Ripristina l'ambiente per creare un nuovo account amministratore.</p>
                        <button id="btn-reset-empty" class="btn-action btn-primary">
                            <span class="material-symbols-rounded">restart_alt</span>
                            <span>Ripristina Dispositivo</span>
                        </button>
                    </div>
                </div>
                ${AuthStyles.getStyles()}
            `;
            const btn = el.querySelector('#btn-reset-empty');
            if (btn) {
                btn.addEventListener('click', async () => {
                    try {
                        if (confirm("Attenzione: questo eliminerà il database locale. Sei sicuro?")) {
                            await window.electronAPI.resetApp();
                        }
                    } catch (_) {}
                });
            }
        } catch (_) {}
    }
};
export default AuthStatusViews;
