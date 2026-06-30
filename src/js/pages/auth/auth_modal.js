import AuthState from './auth_state.js';
import AuthLoginForm from './auth_login_form.js';

const AuthModal = {
    open: (el) => {
        try {
            AuthState.isSearchModalOpen = true;
            const modal = el.querySelector('#search-modal');
            if (!modal) return;
            modal.style.display = 'flex';
            modal.innerHTML = `
                <div class="modal-content fade-in-scale">
                    <div class="modal-header">
                        <div class="modal-title-box">
                            <span class="material-symbols-rounded">manage_search</span>
                            <h2>Directory Utenti</h2>
                        </div>
                        <button id="btn-close-modal" class="btn-icon">
                            <span class="material-symbols-rounded">close</span>
                        </button>
                    </div>
                    <div class="search-bar-box">
                        <span class="material-symbols-rounded search-icon">search</span>
                        <input type="text" id="live-search-input" class="search-input" placeholder="Cerca per nome, cognome o email..." autocomplete="off">
                    </div>
                    <div id="modal-users-grid" class="modal-grid"></div>
                </div>
            `;

            AuthModal.updateList(el, '');

            const searchInput = modal.querySelector('#live-search-input');
            if (searchInput) {
                setTimeout(() => { try { searchInput.focus(); } catch(_) {} }, 50);
                searchInput.addEventListener('input', (e) => {
                    try {
                        AuthModal.updateList(el, e.target.value || '');
                    } catch (_) {}
                });
            }

            const closeBtn = modal.querySelector('#btn-close-modal');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => {
                    try {
                        AuthState.isSearchModalOpen = false;
                        modal.style.display = 'none';
                    } catch (_) {}
                });
            }
        } catch (_) {}
    },

    updateList: (el, queryFilter = null) => {
        try {
            const modalGrid = el.querySelector('#modal-users-grid');
            if (!modalGrid) return;
            const searchInput = el.querySelector('#live-search-input');
            const query = (queryFilter !== null ? queryFilter : (searchInput ? searchInput.value : '')).toLowerCase().trim();

            const sortedUsers = AuthState.getSortedUsers();
            const filtered = sortedUsers.filter(u => {
                try {
                    const name = (u.username || '').toLowerCase();
                    const nome = (u.nome || '').toLowerCase();
                    const cognome = (u.cognome || '').toLowerCase();
                    const email = (u.email || '').toLowerCase();
                    return name.includes(query) || nome.includes(query) || cognome.includes(query) || email.includes(query);
                } catch (_) { return false; }
            });

            if (filtered.length === 0) {
                modalGrid.innerHTML = `
                    <div class="no-results">
                        <span class="material-symbols-rounded">person_off</span>
                        <p>Nessun utente corrisponde alla ricerca</p>
                    </div>
                `;
                return;
            }

            let html = '';
            filtered.forEach(u => {
                try {
                    const initial = u.username ? u.username.charAt(0).toUpperCase() : '?';
                    const fullName = [u.nome, u.cognome].filter(Boolean).join(' ');
                    html += `
                        <div class="modal-user-card" data-id="${u.id}">
                            <div class="modal-avatar">${initial}</div>
                            <div class="modal-user-info">
                                <div class="modal-username">${u.username}</div>
                                ${fullName ? `<div class="modal-fullname">${fullName}</div>` : ''}
                            </div>
                            <span class="material-symbols-rounded arrow-icon">arrow_forward_ios</span>
                        </div>
                    `;
                } catch (_) {}
            });

            modalGrid.innerHTML = html;

            const cards = modalGrid.querySelectorAll('.modal-user-card');
            cards.forEach(c => {
                c.addEventListener('click', () => {
                    try {
                        const id = c.getAttribute('data-id');
                        AuthState.selectUser(id);
                        const modal = el.querySelector('#search-modal');
                        if (modal) modal.style.display = 'none';

                        const mainCards = el.querySelectorAll('.user-card');
                        mainCards.forEach(mc => {
                            try {
                                if (mc.getAttribute('data-id') === id) mc.classList.add('selected');
                                else mc.classList.remove('selected');
                            } catch (_) {}
                        });

                        AuthLoginForm.render(el);
                    } catch (_) {}
                });
            });
        } catch (_) {}
    }
};

export default AuthModal;
