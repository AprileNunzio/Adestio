import AuthStyles from './auth_styles.js';

const AuthStatusViews = {
    renderUnlockForm: (el) => {
        try {
            el.innerHTML = `
                <div class="auth-wrapper fade-in-up">
                    <div class="card-status status-error">
                        <span class="material-symbols-rounded icon-large">link_off</span>
                        <h1 class="text-title">Nodo Desincronizzato</h1>
                        <p class="text-body">Il database locale crittografato è corrotto o irraggiungibile. Nel paradigma Blockchain, questo nodo deve essere ripristinato e risincronizzato dalla rete.</p>
                        <button id="btn-reset-node" class="btn-action btn-danger">
                            <span class="material-symbols-rounded">delete_forever</span>
                            <span>Azzera Nodo Locale</span>
                        </button>
                    </div>
                </div>
                ${AuthStyles.getStyles()}
            `;
            const btn = el.querySelector('#btn-reset-node');
            if (btn) {
                btn.addEventListener('click', async () => {
                    try {
                        if (confirm("Attenzione: questo eliminerà il database locale corrotto. Potrai risincronizzarti subito dopo. Procedere?")) {
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
