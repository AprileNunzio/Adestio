export default {
    render: async (el, params = {}) => {
        el.innerHTML = `
            <div class="fade-in-up" style="width: 100%; height: 100%; display: flex; flex-direction: column;">
                <div style="display: flex; flex-wrap: wrap; align-items: flex-start; justify-content: space-between; gap: 1.5rem; margin-bottom: 2rem; width: 100%;">
                    <div style="flex: 1; min-width: 300px;">
                        <h1 class="text-title" style="font-size: 2.4rem; color: var(--md-primary); margin-bottom: 0.2rem; letter-spacing: -0.02em; text-align: left;">Gestione Utenti</h1>
                        <p class="text-body" style="color: var(--md-on-surface-variant); font-size: 1.1rem; text-align: left;">Cerca, Modifica e Gestisci l'accesso degli utenti al nodo</p>
                    </div>
                    <div style="display: flex; gap: 1rem; align-items: center; flex-shrink: 0; width: 100%; max-width: 500px; justify-content: flex-end;">
                        <div style="position: relative; flex: 1;">
                            <span class="material-symbols-rounded" style="position: absolute; left: 1rem; top: 0.9rem; color: var(--md-on-surface-variant);">search</span>
                            <input type="text" id="user-search" class="input" placeholder="Cerca utente per nome o email..." style="padding-left: 3rem; padding-top: 0.8rem; padding-bottom: 0.8rem; width: 100%; border-radius: 28px; background: var(--md-surface-variant); border: 1px solid var(--md-outline-variant); font-size: 1.05rem; box-shadow: inset 0 2px 4px rgba(0,0,0,0.05); transition: all 0.2s ease;">
                        </div>
                        <button id="btn-add-user" class="btn btn-primary" style="display: flex; align-items: center; gap: 0.5rem; padding: 0.8rem 1.5rem; border-radius: 28px; font-size: 1rem; box-shadow: 0 4px 15px rgba(59,130,246,0.3); flex-shrink: 0;">
                            <span class="material-symbols-rounded">person_add</span>
                            Nuovo Utente
                        </button>
                    </div>
                </div>
                <div id="users-content" style="flex: 1; overflow-y: auto; background: var(--md-surface); border-radius: 20px; padding: 2rem; border: 1px solid var(--md-outline-variant); box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
                    <div style="text-align: center; padding: 2rem;">
                        <span class="material-symbols-rounded" style="animation: spin 2s linear infinite; font-size: 2rem;">sync</span>
                    </div>
                </div>
            </div>
            <!-- Modale Reset Password/PIN / Nuovo Utente (Premium Glassmorphism) -->
            <div id="user-modal" style="display: none; position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(15, 23, 42, 0.4); z-index: 10000; align-items: center; justify-content: center; backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); opacity: 0; transition: opacity 0.3s ease;">
                <div class="card" style="width: 100%; max-width: 480px; padding: 2.5rem; background: rgba(255, 255, 255, 0.95); box-shadow: 0 20px 50px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.6); border-radius: 28px; transform: scale(0.95); transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); border: 1px solid rgba(255,255,255,0.4);">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                        <h3 id="modal-title" style="margin: 0; font-family: var(--font-heading); font-size: 1.8rem; color: var(--md-on-surface); font-weight: 700; letter-spacing: -0.5px;">Nuovo Utente</h3>
                        <button id="btn-close-modal" class="btn btn-icon" style="background: rgba(0,0,0,0.04); color: var(--md-on-surface-variant); border: none; cursor: pointer; border-radius: 50%; width: 40px; height: 40px; display: flex; justify-content: center; align-items: center; transition: all 0.2s;">
                            <span class="material-symbols-rounded">close</span>
                        </button>
                    </div>
                    <form id="user-form" style="display: flex; flex-direction: column; gap: 1.2rem;">
                        <input type="hidden" id="user-id">
                        <div style="display: flex; gap: 1rem;">
                            <div class="premium-input-group" style="flex: 1;">
                                <span class="material-symbols-rounded icon">badge</span>
                                <input type="text" id="user-nome" class="premium-input" placeholder="Nome" required>
                            </div>
                            <div class="premium-input-group" style="flex: 1;">
                                <span class="material-symbols-rounded icon">badge</span>
                                <input type="text" id="user-cognome" class="premium-input" placeholder="Cognome" required>
                            </div>
                        </div>
                        <div class="premium-input-group">
                            <span class="material-symbols-rounded icon">email</span>
                            <input type="email" id="user-email" class="premium-input" placeholder="Indirizzo Email">
                        </div>
                        <div style="display: flex; gap: 1rem;">
                            <div class="premium-input-group" style="flex: 1;">
                                <span class="material-symbols-rounded icon">dialpad</span>
                                <input type="text" id="user-pin" class="premium-input" placeholder="PIN (es. 1234)">
                            </div>
                            <div class="premium-input-group" style="flex: 2;">
                                <span class="material-symbols-rounded icon">lock</span>
                                <input type="password" id="user-password" class="premium-input" placeholder="Password">
                            </div>
                        </div>
                        <div id="modal-error" style="color: var(--md-error); font-size: 0.9rem; text-align: center; display: none; background: rgba(244,67,54,0.1); padding: 0.8rem; border-radius: 12px; margin-top: 0.5rem;"></div>
                        <div style="display: flex; justify-content: flex-end; gap: 1rem; margin-top: 1.5rem;">
                            <button type="button" id="btn-cancel-modal" class="btn" style="background: transparent; color: var(--md-on-surface-variant); border: none; padding: 0.8rem 1.5rem; border-radius: 16px; cursor: pointer; font-weight: 600;">Annulla</button>
                            <button type="submit" id="btn-save-modal" class="btn btn-primary" style="padding: 0.8rem 2rem; border-radius: 16px; font-weight: 600; box-shadow: 0 4px 15px rgba(59,130,246,0.3); transition: all 0.2s;">Salva</button>
                        </div>
                    </form>
                </div>
            </div>
            <style>
                .premium-input-group {
                    position: relative;
                    width: 100%;
                }
                .premium-input-group .icon {
                    position: absolute;
                    left: 1.2rem;
                    top: 50%;
                    transform: translateY(-50%);
                    color: var(--md-outline);
                    transition: color 0.2s;
                }
                .premium-input {
                    width: 100%;
                    padding: 1rem 1rem 1rem 3.5rem;
                    border-radius: 16px;
                    border: 1px solid var(--md-outline-variant);
                    background: rgba(255,255,255,0.7);
                    color: var(--md-on-surface);
                    font-size: 1.05rem;
                    transition: all 0.2s ease;
                    outline: none;
                }
                .premium-input:focus {
                    background: #fff;
                    border-color: var(--md-primary);
                    box-shadow: 0 0 0 4px rgba(59,130,246,0.1);
                }
                .premium-input:focus + .icon {
                    color: var(--md-primary);
                }
                #btn-close-modal:hover {
                    background: rgba(0,0,0,0.08) !important;
                    color: var(--md-error) !important;
                }
                .users-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
                    gap: 1.2rem;
                }
                .user-card {
                    background: var(--md-surface);
                    border: 1px solid var(--md-outline-variant);
                    border-radius: 12px;
                    padding: 1.2rem;
                    display: flex;
                    flex-direction: column;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.02);
                    transition: all 0.2s;
                }
                .user-card:hover {
                    box-shadow: 0 6px 12px rgba(0,0,0,0.08);
                    transform: translateY(-2px);
                    border-color: var(--md-primary);
                }
                .user-card.blocked {
                    opacity: 0.7;
                    border-color: var(--md-error);
                    background: rgba(244, 67, 54, 0.03);
                }
                .user-card.blocked:hover {
                    opacity: 1;
                }
                .status-badge {
                    padding: 0.2rem 0.6rem;
                    border-radius: 8px;
                    font-size: 0.75rem;
                    font-weight: 600;
                    display: inline-flex;
                    align-items: center;
                    gap: 0.2rem;
                }
                .status-active {
                    background: rgba(76, 175, 80, 0.1);
                    color: #4CAF50;
                }
                .status-blocked {
                    background: rgba(244, 67, 54, 0.1);
                    color: var(--md-error);
                }
                .btn-icon-action {
                    background: transparent;
                    border: 1px solid var(--md-outline-variant);
                    color: var(--md-on-surface-variant);
                    cursor: pointer;
                    padding: 0.6rem;
                    border-radius: 8px;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s;
                }
                .btn-icon-action:hover {
                    background: var(--md-surface-variant);
                    color: var(--md-primary);
                    border-color: var(--md-primary);
                }
                .btn-icon-action.danger {
                    color: var(--md-error);
                }
                .btn-icon-action.danger:hover {
                    background: rgba(244, 67, 54, 0.1);
                    border-color: var(--md-error);
                }
                .input {
                    background: var(--md-surface-variant);
                    border: 1px solid var(--md-outline-variant);
                    color: var(--md-on-surface);
                }
                .action-row {
                    display: flex;
                    justify-content: flex-end;
                    gap: 0.5rem;
                    margin-top: 1.5rem;
                    padding-top: 1.5rem;
                    border-top: 1px solid var(--md-outline-variant);
                }
            </style>
        `;
        const tabContent = el.querySelector('#users-content');
        const searchInput = el.querySelector('#user-search');
        const modal = el.querySelector('#user-modal');
        const form = el.querySelector('#user-form');
        const modalError = el.querySelector('#modal-error');
        let rawUsers = [];
        const renderUsers = (filter = '') => {
            if (rawUsers.length === 0) {
                tabContent.innerHTML = '<p style="text-align:center; color: var(--md-on-surface-variant);">Nessun utente trovato.</p>';
                return;
            }
            const filtered = rawUsers.filter(u => 
                u.username.toLowerCase().includes(filter.toLowerCase()) || 
                (u.email && u.email.toLowerCase().includes(filter.toLowerCase()))
            );
            if (filtered.length === 0) {
                tabContent.innerHTML = '<p style="text-align:center; color: var(--md-on-surface-variant);">Nessun utente corrisponde alla ricerca.</p>';
                return;
            }
            let html = '<div class="users-grid">';
            filtered.forEach(u => {
                const isBlocked = (u.is_deleted === 1);
                const badge = isBlocked 
                    ? `<span class="status-badge status-blocked"><span class="material-symbols-rounded" style="font-size: 1rem;">block</span> Bloccato</span>`
                    : `<span class="status-badge status-active"><span class="material-symbols-rounded" style="font-size: 1rem;">check_circle</span> Attivo</span>`;
                const blockAction = isBlocked
                    ? `<button class="btn-icon-action btn-unblock" data-id="${u.id}" title="Sblocca Utente"><span class="material-symbols-rounded">lock_open</span></button>`
                    : `<button class="btn-icon-action danger btn-block" data-id="${u.id}" title="Blocca Accesso Utente"><span class="material-symbols-rounded">block</span></button>`;
                html += `
                    <div class="user-card fade-in-up ${isBlocked ? 'blocked' : ''}">
                        <div style="display: flex; align-items: flex-start; gap: 0.8rem;">
                            <div style="width: 48px; height: 48px; border-radius: 12px; background: var(--md-primary); color: var(--md-on-primary); display: flex; align-items: center; justify-content: center; font-size: 1.5rem; font-weight: bold; flex-shrink: 0;">
                                ${u.username.charAt(0).toUpperCase()}
                            </div>
                            <div style="flex: 1; overflow: hidden;">
                                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                                    <div style="font-size: 1.1rem; font-weight: 600; color: var(--md-on-surface); text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${u.username}</div>
                                    ${badge}
                                </div>
                                <div style="font-size: 0.85rem; color: var(--md-on-surface-variant); margin-top: 0.1rem; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${u.email || 'Nessuna email'}</div>
                                <div style="display: flex; flex-wrap: wrap; gap: 0.4rem; margin-top: 0.4rem; align-items: center;">
                                    <span style="font-size: 0.75rem; background: ${u.is_superadmin ? 'var(--md-primary-container)' : 'var(--md-surface-variant)'}; color: ${u.is_superadmin ? 'var(--md-on-primary-container)' : 'var(--md-on-surface-variant)'}; padding: 0.15rem 0.5rem; border-radius: 6px; font-weight: 600;">
                                        ${u.is_superadmin ? 'Amministratore' : 'Utente Standard'}
                                    </span>
                                    ${u.must_change_password ? '<span style="font-size: 0.75rem; background: rgba(244,143,33,0.1); color: #f48f21; padding: 0.15rem 0.5rem; border-radius: 6px; font-weight: 600;">Cambio PWD Richiesto</span>' : ''}
                                </div>
                                <div style="font-size: 0.75rem; color: var(--md-outline); margin-top: 0.6rem; display: flex; align-items: center; gap: 0.2rem;">
                                    <span class="material-symbols-rounded" style="font-size: 0.9rem;">history</span> 
                                    <span>Ultimo accesso: ${u.last_login > 0 ? new Date(u.last_login).toLocaleString() : 'Mai'}</span>
                                </div>
                            </div>
                        </div>
                        <div class="action-row" style="margin-top: 1rem; padding-top: 1rem;">
                            <button class="btn-icon-action btn-edit" data-id="${u.id}" title="Ripristina Credenziali">
                                <span class="material-symbols-rounded" style="font-size: 1.2rem;">key</span>
                            </button>
                            ${blockAction}
                            <button class="btn-icon-action danger btn-delete" data-id="${u.id}" title="Elimina Utente Definitivamente">
                                <span class="material-symbols-rounded" style="font-size: 1.2rem;">delete_forever</span>
                            </button>
                        </div>
                    </div>
                `;
            });
            html += '</div>';
            tabContent.innerHTML = html;
            // Bind events
            tabContent.querySelectorAll('.btn-edit').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const id = e.currentTarget.getAttribute('data-id');
                    const user = rawUsers.find(ru => ru.id === id);
                    if (user) openModal(user);
                });
            });
            tabContent.querySelectorAll('.btn-block').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const id = e.currentTarget.getAttribute('data-id');
                    const currentUserId = sessionStorage.getItem('currentUserId');
                    if (id === currentUserId) {
                        alert('Azione bloccata: Non puoi disabilitare il tuo stesso account.');
                        return;
                    }
                    try {
                        // Verifica se è l'ultimo Super Admin
                        const rolesData = await window.electronAPI.rbac.getAllUsers();
                        const userRoles = rolesData.find(r => r.id === id);
                        if (userRoles && userRoles.roles && userRoles.roles.some(r => r.name === 'Super Admin')) {
                            let superAdminCount = 0;
                            rolesData.forEach(u => {
                                if (u.roles && u.roles.some(role => role.name === 'Super Admin')) {
                                    superAdminCount++;
                                }
                            });
                            if (superAdminCount <= 1) {
                                alert('Azione bloccata: Questo utente è l\'unico Super Admin attivo rimasto. Se lo blocchi, perderai il controllo del nodo.');
                                return;
                            }
                        }
                        if (confirm('Sei sicuro di voler bloccare questo utente? Non potrà più accedere.')) {
                            await window.electronAPI.usersDelete({ id });
                            await loadUsers(searchInput.value);
                        }
                    } catch (err) {
                        alert('Errore: ' + err.message);
                    }
                });
            });
            tabContent.querySelectorAll('.btn-unblock').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const id = e.currentTarget.getAttribute('data-id');
                    if (confirm('Vuoi sbloccare e ripristinare l\'accesso per questo utente?')) {
                        try {
                            await window.electronAPI.usersRestore({ id });
                            await loadUsers(searchInput.value);
                        } catch (err) {
                            alert('Errore: ' + err.message);
                        }
                    }
                });
            });
            tabContent.querySelectorAll('.btn-delete').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const id = e.currentTarget.getAttribute('data-id');
                    const currentUserId = sessionStorage.getItem('currentUserId');
                    if (id === currentUserId) {
                        alert('Azione bloccata: Non puoi eliminare il tuo stesso account.');
                        return;
                    }
                    if (confirm('ATTENZIONE: Sei sicuro di voler ELIMINARE DEFINITIVAMENTE questo utente?\nQuesta operazione cancellerà il record dal database e da tutti i nodi connessi. L\'azione è irreversibile.')) {
                        try {
                            await window.electronAPI.usersHardDelete({ id });
                            await loadUsers(searchInput.value);
                        } catch (err) {
                            alert('Errore: ' + err.message);
                        }
                    }
                });
            });
        };
        const loadUsers = async (filterText = '') => {
            try {
                rawUsers = await window.electronAPI.usersGetAll();
                renderUsers(filterText);
            } catch (err) {
                tabContent.innerHTML = `<p style="color:var(--md-error); text-align:center;">Errore caricamento: ${err.message}</p>`;
            }
        };
        searchInput.addEventListener('input', (e) => {
            renderUsers(e.target.value);
        });
        const openModal = (user = null) => {
            modalError.style.display = 'none';
            if (user) {
                el.querySelector('#modal-title').innerText = 'Ripristina Credenziali';
                el.querySelector('#user-id').value = user.id;
                el.querySelector('#user-nome').value = user.nome || '';
                el.querySelector('#user-cognome').value = user.cognome || '';
                el.querySelector('#user-email').value = user.email || '';
                el.querySelector('#user-pin').value = user.pin || '';
                el.querySelector('#user-password').placeholder = 'Nuova Password (Lascia vuoto per non modificare)';
                el.querySelector('#user-password').required = false;
            } else {
                el.querySelector('#modal-title').innerText = 'Nuovo Utente';
                form.reset();
                el.querySelector('#user-id').value = '';
                el.querySelector('#user-password').placeholder = 'Password (Obbligatoria)';
                el.querySelector('#user-password').required = true;
            }
            modal.style.display = 'flex';
            setTimeout(() => {
                modal.style.opacity = '1';
                modal.querySelector('.card').style.transform = 'scale(1)';
            }, 10);
        };
        const closeModal = () => {
            modal.style.opacity = '0';
            modal.querySelector('.card').style.transform = 'scale(0.95)';
            setTimeout(() => {
                modal.style.display = 'none';
            }, 300);
        };
        el.querySelector('#btn-add-user').addEventListener('click', () => openModal());
        el.querySelector('#btn-close-modal').addEventListener('click', closeModal);
        el.querySelector('#btn-cancel-modal').addEventListener('click', closeModal);
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            modalError.style.display = 'none';
            const btnSave = el.querySelector('#btn-save-modal');
            btnSave.disabled = true;
            btnSave.innerHTML = '<span class="material-symbols-rounded" style="animation: spin 1s linear infinite;">sync</span> Salvataggio...';
            try {
                const id = el.querySelector('#user-id').value;
                const data = {
                    nome: el.querySelector('#user-nome').value,
                    cognome: el.querySelector('#user-cognome').value,
                    email: el.querySelector('#user-email').value,
                    pin: el.querySelector('#user-pin').value,
                    password: el.querySelector('#user-password').value
                };
                if (id) {
                    data.id = id;
                    await window.electronAPI.usersUpdate(data);
                } else {
                    await window.electronAPI.usersCreate(data);
                }
                closeModal();
                await loadUsers(searchInput.value);
            } catch (err) {
                modalError.innerText = err.message || 'Errore durante il salvataggio.';
                modalError.style.display = 'block';
            } finally {
                btnSave.disabled = false;
                btnSave.innerHTML = 'Salva';
            }
        });
        loadUsers();
    }
};
