import AuthState from './auth/auth_state.js';
import AuthStyles from './auth/auth_styles.js';
import AuthStatusViews from './auth/auth_status_views.js';
import AuthModal from './auth/auth_modal.js';
import AuthLoginForm from './auth/auth_login_form.js';

const AuthLogin = {
    render: async (el) => {
        try {
            await AuthState.init();

            if (window.electronAPI) {
                try {
                    window.electronAPI.onSyncUpdated(async (data) => {
                        try {
                            if (!document.body.contains(el)) return;
                            if (data && data.table === 'users') {
                                const r = await window.electronAPI.getUsersList();
                                if (r && r.users) {
                                    AuthState.users = r.users;
                                    if (!AuthState.needsUnlock && AuthState.users.length > 0) {
                                        if (AuthState.selectedUserId === null && !AuthState.isSearchModalOpen) {
                                            AuthLogin.renderSelection(el);
                                        } else if (AuthState.isSearchModalOpen) {
                                            AuthModal.updateList(el);
                                        }
                                    }
                                }
                            }
                        } catch (_) {}
                    });
                } catch (_) {}
            }

            if (AuthState.needsUnlock) {
                AuthStatusViews.renderUnlockForm(el);
                return;
            }
            if (AuthState.users.length === 0) {
                AuthStatusViews.renderEmptyState(el);
                return;
            }
            AuthLogin.renderSelection(el);
        } catch (_) {}
    },

    renderSelection: (el) => {
        try {
            if (!document.body.contains(el)) return;
            const sortedUsers = AuthState.getSortedUsers();
            const topUsers = sortedUsers.slice(0, 3);
            const remainingCount = sortedUsers.length - 3;

            let cardsHtml = '';
            topUsers.forEach(u => {
                try {
                    const initial = u.username ? u.username.charAt(0).toUpperCase() : '?';
                    cardsHtml += `
                        <div class="user-card fade-in" data-id="${u.id}">
                            <div class="user-avatar">${initial}</div>
                            <div class="user-name">${u.username}</div>
                            <div class="user-badge">${u.is_superadmin ? 'Admin' : 'Utente'}</div>
                        </div>
                    `;
                } catch (_) {}
            });

            let moreBtnHtml = '';
            if (remainingCount > 0) {
                moreBtnHtml = `
                    <button id="btn-show-all" class="btn-more-users fade-in">
                        <span class="material-symbols-rounded">person_search</span>
                        <span>Seleziona un altro utente (${remainingCount} altri...)</span>
                    </button>
                `;
            }

            el.innerHTML = `
                <div class="auth-wrapper fade-in-up">
                    <div class="auth-header">
                        <div class="brand-logo">
                            <span class="material-symbols-rounded">verified_user</span>
                        </div>
                        <h1 class="text-title">Accesso Sicuro</h1>
                        <p class="text-subtitle">Seleziona il profilo per accedere alla postazione</p>
                    </div>

                    <div class="users-grid">
                        ${cardsHtml}
                    </div>

                    ${moreBtnHtml}

                    <div id="login-container" class="login-container" style="display: none;"></div>

                    <div class="auth-footer">
                        <button id="btn-reset" class="btn-reset">
                            <span class="material-symbols-rounded">device_reset</span>
                            <span>Ripristina Postazione</span>
                        </button>
                    </div>
                </div>
                <div id="search-modal" class="search-modal" style="display: none;"></div>
                ${AuthStyles.getStyles()}
            `;

            const cards = el.querySelectorAll('.user-card');
            cards.forEach(c => {
                c.addEventListener('click', () => {
                    try {
                        const id = c.getAttribute('data-id');
                        AuthState.selectUser(id);
                        const modal = el.querySelector('#search-modal');
                        if (modal) modal.style.display = 'none';

                        cards.forEach(mc => {
                            try {
                                if (mc.getAttribute('data-id') === id) mc.classList.add('selected');
                                else mc.classList.remove('selected');
                            } catch (_) {}
                        });

                        AuthLoginForm.render(el);
                    } catch (_) {}
                });
            });

            const showAllBtn = el.querySelector('#btn-show-all');
            if (showAllBtn) {
                showAllBtn.addEventListener('click', () => {
                    try {
                        AuthModal.open(el);
                    } catch (_) {}
                });
            }

            const resetBtn = el.querySelector('#btn-reset');
            if (resetBtn) {
                resetBtn.addEventListener('click', async () => {
                    try {
                        if (confirm("Attenzione: questo eliminerà il database locale e la configurazione di questa postazione. Sei sicuro?")) {
                            await window.electronAPI.resetApp();
                        }
                    } catch (_) {}
                });
            }
        } catch (_) {}
    }
};

export default AuthLogin;
