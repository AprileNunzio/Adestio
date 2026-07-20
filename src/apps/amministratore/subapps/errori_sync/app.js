export default {
    render: async (el, params = {}) => {
        try {
            const currentUserId = sessionStorage.getItem('currentUserId');
            if (!currentUserId) {
                throw new Error("Sessione Scaduta o Non Valida. Effettua nuovamente l'accesso.");
            }
            const resUsers = await window.electronAPI.usersGetAll({});
            const currentUser = resUsers.find(u => u.id === currentUserId);
            if (!currentUser || !currentUser.is_superadmin) {
                el.innerHTML = `
                    <div class="fade-in-up" style="display: flex; align-items: center; justify-content: center; height: 100%; width: 100%; padding: 2rem; background: linear-gradient(135deg, rgba(var(--md-error-rgb, 186,26,26), 0.05) 0%, rgba(var(--md-primary-rgb, 103,80,164), 0.05) 100%);">
                        <div style="background: rgba(255, 255, 255, 0.6); backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px); border: 1px solid rgba(255,255,255,0.4); border-radius: 32px; padding: 4rem 3rem; text-align: center; max-width: 500px; box-shadow: 0 24px 48px rgba(0,0,0,0.06), 0 0 0 1px rgba(var(--md-primary-rgb, 103,80,164), 0.1); display: flex; flex-direction: column; align-items: center; position: relative; overflow: hidden;">
                            <div style="position: absolute; top: -50%; left: -50%; width: 200%; height: 200%; background: radial-gradient(circle, rgba(var(--md-error-rgb, 186,26,26), 0.03) 0%, transparent 60%); pointer-events: none;"></div>
                            <div style="background: linear-gradient(135deg, var(--md-error), #ff5449); color: #ffffff; width: 100px; height: 100px; border-radius: 28px; display: flex; align-items: center; justify-content: center; margin-bottom: 2rem; box-shadow: 0 16px 32px rgba(186, 26, 26, 0.3), inset 0 2px 0 rgba(255,255,255,0.3); transform: rotate(-5deg); transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);">
                                <span class="material-symbols-rounded" style="font-size: 4rem; font-weight: 300;">admin_panel_settings</span>
                            </div>
                            <h2 style="margin: 0 0 1rem 0; font-size: 2.2rem; color: var(--md-on-surface); font-weight: 800; letter-spacing: -0.03em; font-family: 'Outfit', 'Inter', sans-serif;">Accesso Riservato</h2>
                            <p style="color: var(--md-on-surface-variant); font-size: 1.15rem; line-height: 1.6; margin: 0 0 2.5rem 0; font-weight: 400;">
                                Quest'area contiene log critici di sistema. L'accesso è strettamente limitato agli account con privilegi di <strong style="color: var(--md-primary); font-weight: 600;">Super Amministratore</strong>.
                            </p>
                            <button class="win-btn" onclick="if(window.Router) window.Router.back(); else window.history.back();" style="background: linear-gradient(135deg, var(--md-primary), var(--md-primary-container)); color: #ffffff; padding: 1rem 2.5rem; border-radius: 16px; font-weight: 600; font-size: 1.1rem; border: none; cursor: pointer; box-shadow: 0 8px 16px rgba(var(--md-primary-rgb, 103,80,164), 0.25); display: flex; align-items: center; gap: 0.8rem; transition: all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);">
                                <span class="material-symbols-rounded" style="font-size: 1.2rem;">arrow_back</span>
                                Torna Indietro
                            </button>
                        </div>
                    </div>
                `;
                return;
            }
            el.innerHTML = `
                <div class="fade-in-up" style="width: 100%; flex: 1; display: flex; flex-direction: column;">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 2rem;">
                        <div>
                            <h2 style="margin: 0; color: var(--md-error); display: flex; align-items: center; gap: 0.5rem; font-size: 1.8rem;">
                                <span class="material-symbols-rounded">warning</span>
                                Log Errori di Rete
                            </h2>
                            <p style="color: var(--md-on-surface-variant); margin-top: 0.5rem;">Visualizzazione e risoluzione degli errori di sincronizzazione (SuperAdmin)</p>
                        </div>
                        <div style="display: flex; gap: 1rem; align-items: center;">
                            <button id="clear-logs-btn" class="btn" style="display: flex; align-items: center; gap: 0.5rem; background: transparent; border: 1px solid var(--md-error); color: var(--md-error);">
                                <span class="material-symbols-rounded">delete_sweep</span>
                                Svuota Tutti
                            </button>
                            <button id="refresh-logs-btn" class="btn btn-primary" style="display: flex; align-items: center; gap: 0.5rem;">
                                <span class="material-symbols-rounded">refresh</span>
                                Aggiorna
                            </button>
                        </div>
                    </div>
                    <div id="logs-content" style="flex: 1; background: var(--md-surface); border-radius: 12px; border: 1px solid var(--md-outline-variant); overflow: hidden; display: flex; flex-direction: column;">
                        <div style="padding: 2rem; text-align: center; color: var(--md-on-surface-variant);">Caricamento logs...</div>
                    </div>
                </div>
            `;
            const loadLogs = async (silent = false) => {
                const container = el.querySelector('#logs-content');
                if (!container) return;
                try {
                    if (!silent) container.innerHTML = '<div style="padding: 2rem; text-align: center; color: var(--md-on-surface-variant);">Caricamento logs...</div>';
                    const res = await window.electronAPI.rbac.getDistributedLogs();
                    if (!res || !res.success) {
                        container.innerHTML = `<div style="padding: 2rem; color: var(--md-error); text-align: center;">Errore nel caricamento dei log: ${res?.error || 'Sconosciuto'}</div>`;
                        return;
                    }
                    const logs = res.logs || [];
                    if (logs.length === 0) {
                        container.innerHTML = `
                            <div style="padding: 3rem; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: var(--md-success);">
                                <span class="material-symbols-rounded" style="font-size: 4rem; margin-bottom: 1rem;">check_circle</span>
                                <h3 style="font-size: 1.5rem; margin: 0;">Nessun errore rilevato nella rete!</h3>
                                <p style="color: var(--md-on-surface-variant); margin-top: 0.5rem;">Tutti i nodi sono perfettamente sincronizzati.</p>
                            </div>
                        `;
                        return;
                    }
                    let html = `
                        <div style="overflow-y: auto; flex: 1;">
                            <table style="width: 100%; border-collapse: collapse; font-size: 0.95rem;">
                                <thead style="position: sticky; top: 0; background: var(--md-surface-variant); z-index: 10;">
                                    <tr style="text-align: left;">
                                        <th style="padding: 1rem; border-bottom: 1px solid var(--md-outline-variant);">Data/Ora</th>
                                        <th style="padding: 1rem; border-bottom: 1px solid var(--md-outline-variant);">Nodo</th>
                                        <th style="padding: 1rem; border-bottom: 1px solid var(--md-outline-variant);">Livello</th>
                                        <th style="padding: 1rem; border-bottom: 1px solid var(--md-outline-variant);">Messaggio</th>
                                        <th style="padding: 1rem; border-bottom: 1px solid var(--md-outline-variant); text-align: right;">Azioni</th>
                                    </tr>
                                </thead>
                                <tbody>
                    `;
                    for (const log of logs) {
                        const date = new Date(log.created_at * 1000).toLocaleString('it-IT');
                        const isError = log.level === 'ERROR' || log.level === 'FATAL';
                        const color = isError ? 'var(--md-error)' : 'var(--md-on-surface)';
                        let metaObj = {};
                        if (log.meta) {
                            try { metaObj = JSON.parse(log.meta); } catch(e) {}
                        }
                        const nodeName = metaObj.node_name ? metaObj.node_name : (log.node_name ? log.node_name : (log.node_id ? log.node_id.substring(0, 8) : 'Sconosciuto'));
                        const metaStr = Object.keys(metaObj).length > 0 ? JSON.stringify(metaObj, null, 2).replace(/"/g, '&quot;') : '';
                        html += `
                            <tr style="border-bottom: 1px solid var(--md-outline-variant); transition: background 0.2s;">
                                <td style="padding: 1rem; color: var(--md-on-surface-variant); white-space: nowrap;">${date}</td>
                                <td style="padding: 1rem; font-weight: 500;">
                                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                                        <span class="material-symbols-rounded" style="font-size: 1.2rem; color: var(--md-primary);">computer</span>
                                        ${nodeName}
                                    </div>
                                </td>
                                <td style="padding: 1rem; color: ${color}; font-weight: bold;">${log.level}</td>
                                <td style="padding: 1rem; max-width: 400px; word-wrap: break-word; color: ${color};">
                                    <div>${log.message}</div>
                                    ${metaStr ? `<button class="btn show-meta-btn" data-meta="${metaStr}" style="margin-top: 0.5rem; background: transparent; border: 1px solid var(--md-outline); color: var(--md-on-surface-variant); padding: 0.2rem 0.5rem; font-size: 0.8rem; border-radius: 4px; cursor: pointer; display: flex; align-items: center; gap: 0.3rem;"><span class="material-symbols-rounded" style="font-size: 1rem;">code</span> Dettagli Tecnici</button>` : ''}
                                </td>
                                <td style="padding: 1rem; text-align: right;">
                                    <button class="resolve-log-btn win-btn" data-id="${log.id}" style="padding: 0.4rem 0.8rem; border: 1px solid var(--md-success); background: transparent; color: var(--md-success); border-radius: 4px; cursor: pointer; font-size: 0.85rem; font-weight: 500;">
                                        Risolto
                                    </button>
                                </td>
                            </tr>
                        `;
                    }
                    html += `
                                </tbody>
                            </table>
                        </div>
                    `;
                    container.innerHTML = html;
                    const rows = container.querySelectorAll('tbody tr');
                    rows.forEach(r => {
                        r.addEventListener('mouseenter', () => { r.style.background = 'var(--md-surface-variant)'; });
                        r.addEventListener('mouseleave', () => { r.style.background = 'transparent'; });
                    });
                    const resolveBtns = container.querySelectorAll('.resolve-log-btn');
                    resolveBtns.forEach(btn => {
                        btn.addEventListener('click', async (e) => {
                            try {
                                const id = e.target.getAttribute('data-id');
                                const btnEl = e.target;
                                btnEl.innerHTML = '<span class="material-symbols-rounded" style="font-size: 1rem; animation: spin 1s linear infinite;">sync</span>';
                                btnEl.disabled = true;
                                const delRes = await window.electronAPI.rbac.deleteDistributedLog(id);
                                if (delRes && delRes.success) {
                                    loadLogs();
                                } else {
                                    btnEl.innerHTML = 'Errore';
                                    btnEl.style.borderColor = 'var(--md-error)';
                                    btnEl.style.color = 'var(--md-error)';
                                }
                            } catch (err) {}
                        });
                    });
                    const metaBtns = container.querySelectorAll('.show-meta-btn');
                    metaBtns.forEach(btn => {
                        btn.addEventListener('click', (e) => {
                            const metaData = e.target.closest('button').getAttribute('data-meta');
                            alert("Dettagli Tecnici (Meta):\n\n" + metaData);
                        });
                    });
                } catch (err) {
                    container.innerHTML = `<div style="padding: 2rem; color: var(--md-error); text-align: center;">Errore fatale: ${err.message}</div>`;
                }
            };
            const refreshBtn = el.querySelector('#refresh-logs-btn');
            if (refreshBtn) {
                refreshBtn.addEventListener('click', () => {
                    loadLogs();
                });
            }
            const clearBtn = el.querySelector('#clear-logs-btn');
            if (clearBtn) {
                clearBtn.addEventListener('click', async () => {
                    if (confirm("Sei sicuro di voler svuotare tutti i log di errore per questa rete?")) {
                        clearBtn.innerHTML = '<span class="material-symbols-rounded" style="animation: spin 1s linear infinite;">sync</span> Pulizia...';
                        clearBtn.disabled = true;
                        try {
                            const res = await window.electronAPI.rbac.clearDistributedLogs();
                            if (res && res.success) {
                                await loadLogs();
                            } else {
                                alert("Errore durante la pulizia dei log.");
                            }
                        } catch (e) {
                            console.error(e);
                        } finally {
                            clearBtn.innerHTML = '<span class="material-symbols-rounded">delete_sweep</span> Svuota Tutti';
                            clearBtn.disabled = false;
                        }
                    }
                });
            }
            await loadLogs();
        } catch (e) {
            el.innerHTML = `
                <div class="fade-in-up" style="display: flex; align-items: center; justify-content: center; height: 100%; width: 100%; padding: 2rem; background: radial-gradient(circle at top right, rgba(var(--md-error-rgb, 186,26,26), 0.08) 0%, transparent 60%);">
                    <div style="background: var(--md-surface); backdrop-filter: blur(20px); border: 1px solid rgba(var(--md-error-rgb, 186,26,26), 0.2); border-radius: 28px; padding: 3rem; max-width: 650px; width: 100%; display: flex; align-items: flex-start; gap: 2rem; box-shadow: 0 20px 40px rgba(0,0,0,0.08), 0 0 0 4px rgba(var(--md-error-rgb, 186,26,26), 0.05); position: relative; overflow: hidden;">
                        <div style="position: absolute; top: 0; left: 0; width: 8px; height: 100%; background: linear-gradient(to bottom, var(--md-error), #ff8a80);"></div>
                        <div style="background: linear-gradient(135deg, var(--md-error-container), #ffdad6); color: var(--md-on-error-container); min-width: 80px; height: 80px; border-radius: 24px; display: flex; align-items: center; justify-content: center; box-shadow: 0 8px 16px rgba(var(--md-error-rgb, 186,26,26), 0.15);">
                            <span class="material-symbols-rounded" style="font-size: 3.5rem; font-weight: 300;">running_with_errors</span>
                        </div>
                        <div style="flex: 1;">
                            <h3 style="margin: 0 0 0.8rem 0; font-size: 1.8rem; color: var(--md-on-surface); font-weight: 800; font-family: 'Outfit', 'Inter', sans-serif; letter-spacing: -0.02em;">Oops! Errore Fatale</h3>
                            <p style="margin: 0 0 1.5rem 0; color: var(--md-on-surface-variant); font-size: 1.1rem; line-height: 1.6;">
                                Il modulo di Sincronizzazione Log ha riscontrato un'anomalia critica e non può essere avviato correttamente.
                            </p>
                            <div style="padding: 1.5rem; background: var(--md-surface-variant); border-radius: 16px; border: 1px solid rgba(var(--md-outline-rgb, 121,116,126), 0.2); position: relative;">
                                <div style="position: absolute; top: -12px; left: 16px; background: var(--md-error); color: white; padding: 0.2rem 0.8rem; border-radius: 12px; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; box-shadow: 0 4px 8px rgba(var(--md-error-rgb, 186,26,26), 0.3);">Dettaglio Tecnico</div>
                                <code style="font-family: 'Fira Code', 'Cascadia Code', monospace; font-size: 0.95rem; color: var(--md-error); word-break: break-all; display: block; margin-top: 0.5rem;">
                                    ${e.message}
                                </code>
                            </div>
                            <div style="margin-top: 2rem; display: flex; gap: 1rem;">
                                <button class="win-btn" onclick="if(window.Router) window.Router.back(); else window.history.back();" style="background: var(--md-primary); color: var(--md-on-primary); padding: 0.8rem 2rem; border-radius: 12px; font-weight: 600; font-size: 1rem; border: none; cursor: pointer; display: flex; align-items: center; gap: 0.5rem; box-shadow: 0 6px 12px rgba(var(--md-primary-rgb, 103,80,164), 0.2); transition: all 0.2s ease;">
                                    <span class="material-symbols-rounded" style="font-size: 1.2rem;">arrow_back</span>
                                    Indietro
                                </button>
                                <button class="win-btn" onclick="window.location.reload()" style="background: transparent; color: var(--md-primary); border: 2px solid var(--md-primary); padding: 0.8rem 2rem; border-radius: 12px; font-weight: 600; font-size: 1rem; cursor: pointer; display: flex; align-items: center; gap: 0.5rem; transition: all 0.2s ease;">
                                    <span class="material-symbols-rounded" style="font-size: 1.2rem;">refresh</span>
                                    Ricarica
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }
    }
};
