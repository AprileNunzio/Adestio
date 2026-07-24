export default {
    render: async (el, params = {}) => {
        try {
            await window.electronAPI.rbac.syncPermissionsFromManifests();
        } catch(e) { console.error("Errore sync permissions", e); }
        el.innerHTML = `
            <div class="fade-in-up" style="width: 100%; height: 100%; display: flex; flex-direction: column;">
                <div style="margin-bottom: 1.5rem;">
                    <h1 class="text-title" style="font-size: 2rem; color: var(--md-primary); margin-bottom: 0.2rem;">Sistema RBAC</h1>
                    <p class="text-body" style="color: var(--md-on-surface-variant); font-size: 1rem;">Gestione centralizzata e automatica dei permessi</p>
                </div>
                <div style="flex: 1; display: flex; gap: 1.5rem; overflow: hidden;">
                    <!-- Sidebar: Gruppi e Utenti -->
                    <div style="width: 300px; display: flex; flex-direction: column; background: var(--md-surface); border-radius: 20px; border: 1px solid var(--md-outline-variant); box-shadow: 0 4px 12px rgba(0,0,0,0.05); overflow: hidden;">
                        <div style="padding: 1rem; border-bottom: 1px solid var(--md-outline-variant); background: rgba(var(--md-primary-rgb, 102, 126, 234), 0.05); display: flex; justify-content: space-between; align-items: center;">
                            <h3 style="margin: 0; color: var(--md-primary); font-size: 1.1rem;">Assegnatari</h3>
                            <button id="btn-add-group" class="btn btn-icon" style="background: var(--md-primary); color: white; border-radius: 50%; padding: 0.3rem;" title="Nuovo Gruppo" onclick="window.createNewGroup()"><span class="material-symbols-rounded">add</span></button>
                        </div>
                        <div style="padding: 0.8rem; border-bottom: 1px solid var(--md-outline-variant); background: var(--md-surface);">
                            <div style="position: relative;">
                                <span class="material-symbols-rounded" style="position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--md-on-surface-variant); font-size: 1.2rem;">search</span>
                                <input type="text" id="rbac-search-input" placeholder="Cerca gruppo o utente..." onkeyup="window.filterRbacItems(this.value)" style="width: 100%; padding: 0.6rem 0.6rem 0.6rem 2.2rem; border-radius: 12px; border: 1px solid var(--md-outline); background: var(--md-surface-variant); color: var(--md-on-surface); outline: none;">
                            </div>
                        </div>
                        <div id="rbac-sidebar-content" style="flex: 1; overflow-y: auto; padding: 1rem;">
                            <div style="text-align: center;"><span class="material-symbols-rounded" style="animation: spin 2s linear infinite;">sync</span></div>
                        </div>
                    </div>
                    <!-- Main Area: Apps & Permissions -->
                    <div id="rbac-main-content" style="flex: 1; background: var(--md-surface); border-radius: 20px; border: 1px solid var(--md-outline-variant); box-shadow: 0 4px 12px rgba(0,0,0,0.05); overflow-y: auto; padding: 2rem; position: relative;">
                        <div style="display: flex; height: 100%; align-items: center; justify-content: center; flex-direction: column; color: var(--md-on-surface-variant); opacity: 0.6;">
                            <span class="material-symbols-rounded" style="font-size: 4rem; margin-bottom: 1rem;">admin_panel_settings</span>
                            <h2>Seleziona un Gruppo o Utente</h2>
                            <p>Scegli un assegnatario dalla colonna di sinistra per gestire i suoi permessi.</p>
                        </div>
                    </div>
                </div>
            </div>
            <style>
                .rbac-item { padding: 0.8rem; border-radius: 12px; cursor: pointer; transition: background 0.2s; display: flex; align-items: center; gap: 0.8rem; margin-bottom: 0.5rem; color: var(--md-on-surface); }
                .rbac-item:hover { background: var(--md-surface-variant); }
                .rbac-item.active { background: var(--md-primary); color: white; }
                .rbac-item.active .material-symbols-rounded { color: white; }
                .app-card { background: var(--md-surface-variant); border-radius: 16px; padding: 1.5rem; cursor: pointer; transition: all 0.2s; text-align: center; border: 2px solid transparent; }
                .app-card:hover { transform: translateY(-5px); box-shadow: 0 10px 20px rgba(0,0,0,0.1); border-color: var(--md-primary); }
                .perm-row { display: flex; justify-content: space-between; align-items: center; padding: 1rem; border-bottom: 1px solid var(--md-outline-variant); }
                .perm-row:last-child { border-bottom: none; }
                .switch { position: relative; display: inline-block; width: 44px; height: 24px; }
                .switch input { opacity: 0; width: 0; height: 0; }
                .slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #ccc; transition: .4s; border-radius: 24px; }
                .slider:before { position: absolute; content: ""; height: 18px; width: 18px; left: 3px; bottom: 3px; background-color: white; transition: .4s; border-radius: 50%; }
                input:checked + .slider { background-color: var(--md-primary); }
                input:checked + .slider:before { transform: translateX(20px); }
            </style>
        `;
        const sidebar = el.querySelector('#rbac-sidebar-content');
        const main = el.querySelector('#rbac-main-content');
        let appsCache = [];
        let subAppsCache = {};
        let allUsersCache = [];
        let currentGroupUsers = []; 
        let currentTarget = null; 
        const loadData = async () => {
            try {
                const [groups, users, apps] = await Promise.all([
                    window.electronAPI.rbac.getAllGroups(),
                    window.electronAPI.rbac.getAllUsers(),
                    window.electronAPI.getAppsRegistry()
                ]);
                appsCache = apps;
                for (const app of apps) {
                    const subapps = await window.electronAPI.getSubAppsRegistry(app.id);
                    subAppsCache[app.id] = subapps;
                }
                allUsersCache = users;
                let html = '<div style="font-weight: bold; margin: 0.5rem 0; color: var(--md-on-surface-variant);">Gruppi</div>';
                groups.forEach(g => {
                    html += `<div class="rbac-item" data-type="group" data-id="${g.id}" data-name="${g.name}" data-superadmin="${g.is_superadmin ? 1 : 0}">
                                <span class="material-symbols-rounded">group</span> ${g.name}
                             </div>`;
                });
                html += '<div style="font-weight: bold; margin: 1.5rem 0 0.5rem 0; color: var(--md-on-surface-variant);">Utenti</div>';
                users.forEach(u => {
                    html += `<div class="rbac-item" data-type="user" data-id="${u.id}" data-name="${u.username}" data-superadmin="${u.is_superadmin ? 1 : 0}">
                                <span class="material-symbols-rounded">person</span> ${u.username}
                             </div>`;
                });
                sidebar.innerHTML = html;
                sidebar.querySelectorAll('.rbac-item').forEach(item => {
                    item.addEventListener('click', () => {
                        sidebar.querySelectorAll('.rbac-item').forEach(i => i.classList.remove('active'));
                        item.classList.add('active');
                        currentTarget = {
                            type: item.dataset.type,
                            id: item.dataset.id,
                            name: item.dataset.name,
                            isSuperadmin: item.dataset.superadmin === '1'
                        };
                        renderAppsGrid();
                    });
                });
            } catch(e) {
                if (window.electronAPI && window.electronAPI.logError) window.electronAPI.logError(e.stack || e.message);
                sidebar.innerHTML = `<p style="color:var(--md-error);">Errore: ${e.message}</p>`;
            }
        };
        const renderAppsGrid = async () => {
            if (!currentTarget) return;
            let membersSection = '';
            if (currentTarget.type === 'group') {
                try {
                    currentGroupUsers = await window.electronAPI.rbac.getGroupUsers(currentTarget.id);
                    const membersNames = allUsersCache.filter(u => currentGroupUsers.includes(u.id)).map(u => u.username).join(', ');
                    membersSection = `
                        <div style="background: var(--md-surface-variant); padding: 1rem; border-radius: 12px; margin-bottom: 2rem; display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <div style="font-weight: 600; color: var(--md-on-surface);">Membri del Gruppo (${currentGroupUsers.length})</div>
                                <div style="font-size: 0.85rem; color: var(--md-on-surface-variant); margin-top: 0.2rem;">${membersNames || 'Nessun membro assegnato'}</div>
                            </div>
                            <button class="btn" style="background: var(--md-primary); color: white;" onclick="window.manageGroupMembers()">
                                <span class="material-symbols-rounded" style="font-size: 1rem; margin-right: 0.4rem;">manage_accounts</span> Gestisci
                            </button>
                        </div>
                    `;
                } catch (e) {
                    membersSection = `<div style="color:var(--md-error);">Errore caricamento membri</div>`;
                }
            }
            let html = `
                <h2 style="margin-top:0; margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem;">
                    <span class="material-symbols-rounded">${currentTarget.type === 'group' ? 'group' : 'person'}</span>
                    Permessi per: <span style="color: var(--md-primary);">${currentTarget.name}</span>
                </h2>
                ${membersSection}
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 1.5rem;">
            `;
            appsCache.forEach(app => {
                const iconPath = app.icon
                    ? (app.icon.includes('//') ? app.icon : (app.core || app.bundled ? `apps/${app.folder}/${app.icon}` : `adestio-app://${app.folder}/${app.icon}`))
                    : null;
                const iconHtml = (app.icon && app.icon.includes('.'))
                    ? `<img src="${iconPath}" style="width: 48px; height: 48px; margin-bottom: 1rem; object-fit: contain;" onerror="this.src='icone/applicazione_generica.png'">`
                    : `<span class="material-symbols-rounded" style="font-size: 3rem; color: var(--md-primary); margin-bottom: 1rem;">${app.icon || 'apps'}</span>`;
                html += `
                    <div class="app-card fade-in-up" onclick="window.openAppPermissions('${app.id}')">
                        ${iconHtml}
                        <div style="font-weight: 600; color: var(--md-on-surface);">${app.name}</div>
                    </div>
                `;
            });
            html += `</div>`;
            main.innerHTML = html;
        };
        window.openAppPermissions = async (appId) => {
            if (!currentTarget) return;
            const app = appsCache.find(a => a.id === appId);
            if (!app) return;
            main.innerHTML = `<div style="text-align:center;"><span class="material-symbols-rounded" style="animation: spin 2s linear infinite;">sync</span></div>`;
            try {
                let targetPerms = [];
                if (currentTarget.type === 'group') {
                    targetPerms = await window.electronAPI.rbac.getGroupPermissions(currentTarget.id);
                } else {
                    targetPerms = await window.electronAPI.rbac.getUserPermissions(currentTarget.id);
                }
                const subapps = subAppsCache[appId] || [];
                const appIconPath = app.icon
                    ? (app.icon.includes('//') ? app.icon : (app.core || app.bundled ? `apps/${app.folder}/${app.icon}` : `adestio-app://${app.folder}/${app.icon}`))
                    : null;
                const appIconHtml = (app.icon && app.icon.includes('.'))
                    ? `<img src="${appIconPath}" style="width: 1.2em; height: 1.2em; object-fit: contain;" onerror="this.src='icone/applicazione_generica.png'">`
                    : `<span class="material-symbols-rounded">${app.icon || 'apps'}</span>`;
                let allPermsList = [];
                if (app.rbacPermissions) app.rbacPermissions.forEach(p => allPermsList.push(`${app.id}:${p.id}`));
                subapps.forEach(sub => {
                    if (sub.rbacPermissions) sub.rbacPermissions.forEach(p => allPermsList.push(`${app.id}:${sub.id}:${p.id}`));
                });
                const allChecked = allPermsList.length > 0 && allPermsList.every(p => targetPerms.includes(p));
                const globalCheckedAttr = allChecked ? 'checked' : '';
                const disabledAttr = currentTarget.isSuperadmin ? 'disabled' : '';
                let html = `
                    <button class="btn btn-icon" onclick="window.closeAppPermissions()" style="margin-bottom: 1.5rem;">
                        <span class="material-symbols-rounded">arrow_back</span> Torna alla griglia
                    </button>
                    <h2 style="margin-top:0; display: flex; align-items: center; gap: 0.5rem; color: var(--md-primary);">
                        ${appIconHtml} ${app.name}
                    </h2>
                `;
                if (currentTarget.isSuperadmin) {
                    html += `
                        <div style="background: rgba(var(--md-error-rgb, 179, 38, 30), 0.1); color: var(--md-error); padding: 1rem; border-radius: 12px; margin-bottom: 2rem; display: flex; align-items: center; gap: 0.8rem;">
                            <span class="material-symbols-rounded">admin_panel_settings</span>
                            <span><b>Attenzione:</b> Questo utente è un Super Admin. Ha accesso illimitato a tutto il sistema. I permessi granulari vengono ignorati e non possono essere modificati.</span>
                        </div>
                    `;
                }
                html += `
                    <div class="perm-row" style="background: rgba(var(--md-primary-rgb, 102, 126, 234), 0.1); border-radius: 12px; margin-bottom: 2rem; border-bottom: none;">
                        <div>
                            <div style="font-weight: 600; color: var(--md-primary);">Accesso Globale Applicazione</div>
                            <div style="font-size: 0.85rem; color: var(--md-on-surface-variant);">Abilita o disabilita rapidamente tutti i permessi per questa applicazione.</div>
                        </div>
                        <label class="switch">
                            <input type="checkbox" onchange="window.toggleAllAppPermissions('${appId}', this.checked)" ${globalCheckedAttr} ${disabledAttr}>
                            <span class="slider"></span>
                        </label>
                    </div>
                `;
                
                if (app.rbacPermissions && app.rbacPermissions.length > 0) {
                    html += `<div style="background: var(--md-surface-variant); border-radius: 12px; margin-bottom: 2rem;">`;
                    app.rbacPermissions.forEach(p => {
                        const permId = `${app.id}:${p.id}`;
                        const checked = targetPerms.includes(permId) ? 'checked' : '';
                        html += `
                            <div class="perm-row">
                                <div>
                                    <div style="font-weight: 600; color: var(--md-on-surface);">${p.label || p.id}</div>
                                </div>
                                <label class="switch">
                                    <input type="checkbox" onchange="window.togglePermission('${permId}', this.checked)" ${checked} ${disabledAttr}>
                                    <span class="slider"></span>
                                </label>
                            </div>
                        `;
                    });
                    html += `</div>`;
                }
                
                subapps.forEach(sub => {
                    if (sub.rbacPermissions && sub.rbacPermissions.length > 0) {
                        const subIconPath = (app.core || app.bundled)
                            ? `apps/${app.folder}/subapps/${sub.folder}/${sub.icon}`
                            : `adestio-app://${app.folder}/subapps/${sub.folder}/${sub.icon}`;
                        const subIconHtml = (sub.icon && sub.icon.includes('.'))
                            ? `<img src="${subIconPath}" style="width: 1.2em; height: 1.2em; object-fit: contain;" onerror="this.src='icone/applicazione_generica.png'">`
                            : `<span class="material-symbols-rounded" style="font-size: 1.2rem;">${sub.icon || 'extension'}</span>`;
                        html += `<h3 style="margin: 1.5rem 0 1rem 0; font-size: 1.1rem; display: flex; align-items: center; gap: 0.5rem;">
                            ${subIconHtml} Sotto-modulo: ${sub.name}
                        </h3>`;
                        html += `<div style="background: var(--md-surface-variant); border-radius: 12px; margin-bottom: 1rem;">`;
                        sub.rbacPermissions.forEach(p => {
                            const permId = `${app.id}:${sub.id}:${p.id}`;
                            const checked = targetPerms.includes(permId) ? 'checked' : '';
                            html += `
                                <div class="perm-row">
                                    <div>
                                        <div style="font-weight: 600; color: var(--md-on-surface);">${p.label || p.id}</div>
                                    </div>
                                    <label class="switch">
                                        <input type="checkbox" onchange="window.togglePermission('${permId}', this.checked)" ${checked} ${disabledAttr}>
                                        <span class="slider"></span>
                                    </label>
                                </div>
                            `;
                        });
                        html += `</div>`;
                    }
                });
                if ((!app.rbacPermissions || app.rbacPermissions.length === 0) && subapps.every(s => !s.rbacPermissions || s.rbacPermissions.length === 0)) {
                    html += `<p style="color: var(--md-on-surface-variant); font-style: italic;">Nessun permesso specifico dichiarato da questa applicazione.</p>`;
                }
                main.innerHTML = html;
            } catch(e) {
                main.innerHTML = `<p style="color:var(--md-error);">Errore: ${e.message}</p>`;
            }
        };
        window.closeAppPermissions = () => {
            renderAppsGrid();
        };
        window.togglePermission = async (permId, value) => {
            if (!currentTarget) return;
            try {
                if (currentTarget.type === 'group') {
                    await window.electronAPI.rbac.setGroupPermission(currentTarget.id, permId, value);
                } else {
                    await window.electronAPI.rbac.setUserPermission(currentTarget.id, permId, value);
                }
            } catch(e) {
                console.error("Errore salvataggio permesso", e);
                if (window.electronAPI && window.electronAPI.logError) window.electronAPI.logError(e.stack || e.message);
                const { toast } = await import('../../../../js/utils.js');
                toast("Errore salvataggio permesso", "error");
            }
        };
        window.toggleAllAppPermissions = async (appId, value) => {
            if (!currentTarget) return;
            main.innerHTML = `<div style="text-align:center;"><span class="material-symbols-rounded" style="animation: spin 2s linear infinite;">sync</span></div>`;
            try {
                const app = appsCache.find(a => a.id === appId);
                const subapps = subAppsCache[appId] || [];
                const promises = [];
                if (app && app.rbacPermissions) {
                    app.rbacPermissions.forEach(p => {
                        const permId = `${app.id}:${p.id}`;
                        promises.push(window.togglePermission(permId, value, true));
                    });
                }
                subapps.forEach(sub => {
                    if (sub.rbacPermissions) {
                        sub.rbacPermissions.forEach(p => {
                            const permId = `${app.id}:${sub.id}:${p.id}`;
                            promises.push(window.togglePermission(permId, value, true));
                        });
                    }
                });
                await Promise.all(promises);
                window.openAppPermissions(appId);
            } catch(e) {
                if (window.electronAPI && window.electronAPI.logError) window.electronAPI.logError(e.stack || e.message);
            }
        };
        window.createNewGroup = () => {
            const modalHtml = `
                <div id="rbac-group-modal" style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; animation: fadeIn 0.2s ease;">
                    <div style="background: var(--md-surface); padding: 2rem; border-radius: 20px; width: 400px; max-width: 90%; box-shadow: 0 10px 25px rgba(0,0,0,0.2);">
                        <h2 style="margin-top: 0; color: var(--md-primary);">Nuovo Gruppo</h2>
                        <p style="color: var(--md-on-surface-variant); margin-bottom: 1.5rem;">Inserisci il nome del nuovo gruppo assegnatario.</p>
                        <input type="text" id="rbac-new-group-name" class="input" placeholder="Nome gruppo..." style="width: 100%; padding: 0.8rem; border-radius: 12px; border: 1px solid var(--md-outline); background: var(--md-surface-variant); color: var(--md-on-surface); font-size: 1rem; margin-bottom: 1.5rem;">
                        <div class="perm-row" style="padding: 0 0 1.5rem 0; border: none;">
                            <div>
                                <div style="font-weight: 600; color: var(--md-on-surface);">Membri Super Admin</div>
                                <div style="font-size: 0.8rem; color: var(--md-error);">Accesso totale al sistema per tutti i membri.</div>
                            </div>
                            <label class="switch">
                                <input type="checkbox" id="rbac-new-group-superadmin">
                                <span class="slider"></span>
                            </label>
                        </div>
                        <div style="display: flex; justify-content: flex-end; gap: 1rem;">
                            <button class="btn" style="background: transparent; color: var(--md-on-surface);" onclick="document.getElementById('rbac-group-modal').remove()">Annulla</button>
                            <button class="btn" style="background: var(--md-primary); color: white;" onclick="window.submitNewGroup()">Crea</button>
                        </div>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', modalHtml);
            document.getElementById('rbac-new-group-name').focus();
        };
        window.submitNewGroup = async () => {
            const input = document.getElementById('rbac-new-group-name');
            const saInput = document.getElementById('rbac-new-group-superadmin');
            if (!input) return;
            const name = input.value.trim();
            if (!name) return;
            try {
                const res = await window.electronAPI.rbac.createGroup(name, '', saInput.checked);
                if (res) {
                    loadData();
                    document.getElementById('rbac-group-modal').remove();
                } else {
                    const { toast } = await import('../../../../js/utils.js');
                    toast("Errore durante la creazione del gruppo", "error");
                }
            } catch(e) {
                if (window.electronAPI && window.electronAPI.logError) window.electronAPI.logError(e.stack || e.message);
            }
        };
        window.manageGroupMembers = () => {
            if (!currentTarget || currentTarget.type !== 'group') return;
            let usersHtml = '';
            allUsersCache.forEach(u => {
                const isChecked = currentGroupUsers.includes(u.id) ? 'checked' : '';
                usersHtml += `
                    <div class="perm-row" style="padding: 0.8rem; border-bottom: 1px solid var(--md-outline-variant);">
                        <div style="font-weight: 600; color: var(--md-on-surface);">${u.username}</div>
                        <label class="switch">
                            <input type="checkbox" class="rbac-member-checkbox" value="${u.id}" ${isChecked}>
                            <span class="slider"></span>
                        </label>
                    </div>
                `;
            });
            const modalHtml = `
                <div id="rbac-members-modal" style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; animation: fadeIn 0.2s ease;">
                    <div style="background: var(--md-surface); padding: 2rem; border-radius: 20px; width: 500px; max-width: 90%; max-height: 80vh; display: flex; flex-direction: column; box-shadow: 0 10px 25px rgba(0,0,0,0.2);">
                        <h2 style="margin-top: 0; color: var(--md-primary);">Gestione Membri</h2>
                        <p style="color: var(--md-on-surface-variant); margin-bottom: 1rem;">Seleziona gli utenti da includere in <b>${currentTarget.name}</b></p>
                        <div style="flex: 1; overflow-y: auto; background: var(--md-surface-variant); border-radius: 12px; margin-bottom: 1.5rem;">
                            ${usersHtml || '<div style="padding: 1rem; color: var(--md-on-surface-variant);">Nessun utente disponibile.</div>'}
                        </div>
                        <div style="display: flex; justify-content: flex-end; gap: 1rem;">
                            <button class="btn" style="background: transparent; color: var(--md-on-surface);" onclick="document.getElementById('rbac-members-modal').remove()">Annulla</button>
                            <button class="btn" style="background: var(--md-primary); color: white;" onclick="window.submitGroupMembers()">Salva</button>
                        </div>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', modalHtml);
        };
        window.submitGroupMembers = async () => {
            if (!currentTarget || currentTarget.type !== 'group') return;
            const checkboxes = document.querySelectorAll('.rbac-member-checkbox:checked');
            const selectedIds = Array.from(checkboxes).map(cb => cb.value);
            try {
                const res = await window.electronAPI.rbac.updateGroupUsers(currentTarget.id, selectedIds);
                if (res) {
                    document.getElementById('rbac-members-modal').remove();
                    renderAppsGrid();
                    const { toast } = await import('../../../../js/utils.js');
                    toast("Membri aggiornati con successo", "success");
                } else {
                    const { toast } = await import('../../../../js/utils.js');
                    toast("Errore durante l'aggiornamento dei membri", "error");
                }
            } catch(e) {
                if (window.electronAPI && window.electronAPI.logError) window.electronAPI.logError(e.stack || e.message);
            }
        };
        window.filterRbacItems = (query) => {
            query = (query || '').toLowerCase();
            const items = sidebar.querySelectorAll('.rbac-item');
            items.forEach(item => {
                const name = item.dataset.name.toLowerCase();
                if (name.includes(query)) {
                    item.style.display = 'flex';
                } else {
                    item.style.display = 'none';
                }
            });
            const headers = sidebar.querySelectorAll('div[style*="font-weight: bold"]');
            headers.forEach(h => {
                h.style.display = query ? 'none' : 'block';
            });
        };
        loadData();
    }
};
