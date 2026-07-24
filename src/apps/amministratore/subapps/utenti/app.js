const CF_CODICI_DISPARI = {
    '0': 1, '1': 0, '2': 5, '3': 7, '4': 9, '5': 13, '6': 15, '7': 17, '8': 19, '9': 21,
    'A': 1, 'B': 0, 'C': 5, 'D': 7, 'E': 9, 'F': 13, 'G': 15, 'H': 17, 'I': 19, 'J': 21,
    'K': 2, 'L': 4, 'M': 18, 'N': 20, 'O': 11, 'P': 3, 'Q': 6, 'R': 8, 'S': 12, 'T': 14,
    'U': 16, 'V': 10, 'W': 22, 'X': 25, 'Y': 24, 'Z': 23
};
const CF_CODICI_PARI = {
    '0': 0, '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
    'A': 0, 'B': 1, 'C': 2, 'D': 3, 'E': 4, 'F': 5, 'G': 6, 'H': 7, 'I': 8, 'J': 9,
    'K': 10, 'L': 11, 'M': 12, 'N': 13, 'O': 14, 'P': 15, 'Q': 16, 'R': 17, 'S': 18, 'T': 19,
    'U': 20, 'V': 21, 'W': 22, 'X': 23, 'Y': 24, 'Z': 25
};
const CF_RESTO_LETTERA = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];
const CF_REGEX = /^[A-Z]{6}[0-9]{2}[A-EHLMPR-T][0-9]{2}[A-Z][0-9]{3}[A-Z]$/;
function isValidCodiceFiscale(value) {
    const cf = (value || '').trim().toUpperCase();
    if (!CF_REGEX.test(cf)) return false;
    let sum = 0;
    for (let i = 0; i < 15; i++) {
        const ch = cf[i];
        sum += (i % 2 === 0) ? CF_CODICI_DISPARI[ch] : CF_CODICI_PARI[ch];
    }
    return CF_RESTO_LETTERA[sum % 26] === cf[15];
}
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
                <div id="twofa-policy-banner" style="display: flex; align-items: center; justify-content: space-between; gap: 1rem; background: var(--md-surface-variant); border: 1px solid var(--md-outline-variant); border-radius: 16px; padding: 1rem 1.5rem; margin-bottom: 1.5rem;">
                    <div>
                        <div style="font-weight:700; color: var(--md-on-surface);">Richiedi 2FA per tutti gli utenti</div>
                        <div style="font-size:0.85rem; color: var(--md-on-surface-variant); margin-top:0.2rem;">Segna come obbligatoria l'attivazione di TOTP o Passkey per ogni account del nodo.</div>
                    </div>
                    <label class="tp-switch">
                        <input type="checkbox" id="twofa-policy-toggle">
                        <span class="tp-switch-track"></span>
                    </label>
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
                            <span class="material-symbols-rounded icon">fingerprint</span>
                            <input type="text" id="user-cf" class="premium-input" placeholder="Codice Fiscale (obbligatorio, associa l'utente alla sua anagrafica personale)" style="text-transform: uppercase;" required>
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
                .tp-switch { position: relative; width: 46px; height: 26px; flex-shrink: 0; }
                .tp-switch input { opacity: 0; width: 0; height: 0; }
                .tp-switch-track { position: absolute; inset: 0; background: var(--md-outline-variant); border-radius: 999px; cursor: pointer; transition: 0.2s; }
                .tp-switch-track::before { content: ''; position: absolute; width: 20px; height: 20px; left: 3px; top: 3px; background: white; border-radius: 50%; transition: 0.2s; box-shadow: 0 1px 3px rgba(0,0,0,0.3); }
                .tp-switch input:checked + .tp-switch-track { background: var(--md-primary); }
                .tp-switch input:checked + .tp-switch-track::before { transform: translateX(20px); }
                .status-2fa-on { background: rgba(16,185,129,0.12); color: var(--md-success); }
                .status-2fa-off { background: rgba(100,116,139,0.12); color: var(--md-on-surface-variant); }
            </style>
        `;
        const tabContent = el.querySelector('#users-content');
        const searchInput = el.querySelector('#user-search');
        const modal = el.querySelector('#user-modal');
        const form = el.querySelector('#user-form');
        const modalError = el.querySelector('#modal-error');
        const actorUserId = sessionStorage.getItem('currentUserId');
        const policyToggle = el.querySelector('#twofa-policy-toggle');
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
                                    <span class="status-badge ${(u.totpEnabled || u.passkeysCount > 0) ? 'status-2fa-on' : 'status-2fa-off'}">
                                        <span class="material-symbols-rounded" style="font-size: 1rem;">verified_user</span>
                                        ${(u.totpEnabled || u.passkeysCount > 0) ? '2FA attiva' : '2FA non attiva'}
                                    </span>
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
                            ${(u.totpEnabled || u.passkeysCount > 0) ? `<button class="btn-icon-action danger btn-reset-2fa" data-id="${u.id}" title="Reset 2FA"><span class="material-symbols-rounded" style="font-size: 1.2rem;">restart_alt</span></button>` : ''}
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
            tabContent.querySelectorAll('.btn-reset-2fa').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const id = e.currentTarget.getAttribute('data-id');
                    if (!confirm('Confermi il reset della 2FA per questo utente? Dovrà riconfigurare TOTP/Passkey al prossimo accesso.')) return;
                    try {
                        const r = await window.electronAPI.twofa.adminReset({ actorUserId, targetUserId: id });
                        if (r && r.success) await loadUsers(searchInput.value);
                        else alert((r && r.error) || 'Errore durante il reset');
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
                try {
                    const twofaRes = await window.electronAPI.twofa.adminListStatus(actorUserId);
                    if (twofaRes && twofaRes.success) {
                        const byId = {};
                        twofaRes.users.forEach(u => { byId[u.id] = u; });
                        rawUsers = rawUsers.map(u => ({ ...u, totpEnabled: byId[u.id] ? byId[u.id].totpEnabled : false, passkeysCount: byId[u.id] ? byId[u.id].passkeysCount : 0 }));
                        if (policyToggle) policyToggle.checked = rawUsers.length > 0 && twofaRes.users.every(u => u.twofaRequired);
                    }
                } catch (_) {}
                renderUsers(filterText);
            } catch (err) {
                tabContent.innerHTML = `<p style="color:var(--md-error); text-align:center;">Errore caricamento: ${err.message}</p>`;
            }
        };
        if (policyToggle) {
            policyToggle.addEventListener('change', async () => {
                const { toast } = await import('../../../../js/utils.js');
                const r = await window.electronAPI.twofa.setPolicy({ actorUserId, required: policyToggle.checked });
                if (r && r.success) toast('Policy 2FA aggiornata', 'success');
                else { toast((r && r.error) || 'Errore aggiornamento policy', 'error'); policyToggle.checked = !policyToggle.checked; }
            });
        }
        searchInput.addEventListener('input', (e) => {
            renderUsers(e.target.value);
        });
        const openModal = (user = null) => {
            modalError.style.display = 'none';
            const cfInput = el.querySelector('#user-cf');
            if (user) {
                el.querySelector('#modal-title').innerText = 'Ripristina Credenziali';
                el.querySelector('#user-id').value = user.id;
                el.querySelector('#user-nome').value = user.nome || '';
                el.querySelector('#user-cognome').value = user.cognome || '';
                el.querySelector('#user-email').value = user.email || '';
                el.querySelector('#user-pin').value = user.pin || '';
                el.querySelector('#user-password').placeholder = 'Nuova Password (Lascia vuoto per non modificare)';
                el.querySelector('#user-password').required = false;
                cfInput.value = user.codice_fiscale || 'Non associato';
                cfInput.disabled = true;
                cfInput.required = false;
            } else {
                el.querySelector('#modal-title').innerText = 'Nuovo Utente';
                form.reset();
                el.querySelector('#user-id').value = '';
                el.querySelector('#user-password').placeholder = 'Password (Obbligatoria)';
                el.querySelector('#user-password').required = true;
                cfInput.disabled = false;
                cfInput.required = true;
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
                    const codiceFiscale = el.querySelector('#user-cf').value.trim().toUpperCase();
                    if (!isValidCodiceFiscale(codiceFiscale)) {
                        throw new Error('Il Codice Fiscale è obbligatorio e deve essere valido');
                    }
                    data.codice_fiscale = codiceFiscale;
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
