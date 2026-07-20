const EVENT_LABELS = {
    login_success: 'Accesso riuscito',
    login_failed: 'Accesso fallito',
    '2fa_failed': 'Verifica 2FA fallita',
    '2fa_admin_reset': 'Reset 2FA (admin)',
    logout: 'Disconnessione'
};
const EVENT_COLORS = {
    login_success: 'var(--md-success)',
    login_failed: 'var(--md-error)',
    '2fa_failed': 'var(--md-error)',
    '2fa_admin_reset': 'var(--md-secondary)',
    logout: 'var(--md-on-surface-variant)'
};
function fmtDate(ts) {
    if (!ts) return '—';
    try { return new Date(Number(ts)).toLocaleString('it-IT'); } catch (e) { return '—'; }
}
export default {
    render: async (el) => {
        const actorUserId = sessionStorage.getItem('currentUserId');
        let state = { page: 1, pageSize: 25, filters: {} };
        el.innerHTML = `
            <div class="ra-root">
                <div style="display:flex; align-items:center; gap:0.6rem; margin-bottom:0.3rem;">
                    <span class="material-symbols-rounded" style="font-size:2rem; color: var(--md-primary);">manage_search</span>
                    <div>
                        <h2 style="margin:0; font-size:1.4rem; color: var(--md-on-surface);">Registro Accessi</h2>
                        <p style="margin:0.2rem 0 0 0; color: var(--md-on-surface-variant); font-size:0.9rem;">Storico dettagliato e affidabile di tutti gli accessi alla rete: successi, fallimenti, logout e reset 2FA, sincronizzato tra tutti i nodi.</p>
                    </div>
                </div>
                <div id="ra-content" style="margin-top:1.2rem;"></div>
            </div>
            <style>
                .ra-stats-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem; margin-bottom: 1.2rem; }
                .ra-stat-card { background: var(--md-surface-variant); border-radius: var(--shape-md); padding: 1.1rem 1.3rem; display: flex; flex-direction: column; gap: 0.2rem; border: 1px solid var(--md-outline-variant); }
                .ra-stat-value { font-size: 1.8rem; font-weight: 800; color: var(--md-primary); font-family: var(--font-heading); }
                .ra-stat-label { font-size: 0.85rem; color: var(--md-on-surface-variant); font-weight: 600; }
                .ra-table-wrap { overflow-x: auto; border: 1px solid var(--md-outline-variant); border-radius: var(--shape-md); }
                table.ra-table { width: 100%; border-collapse: collapse; font-size: 0.92rem; }
                table.ra-table th { text-align: left; padding: 0.8rem 1rem; background: var(--md-surface-variant); color: var(--md-primary); font-weight: 700; white-space: nowrap; position: sticky; top: 0; }
                table.ra-table td { padding: 0.7rem 1rem; border-top: 1px solid var(--md-outline-variant); vertical-align: middle; }
                .ra-badge { display: inline-flex; align-items: center; gap: 0.3rem; padding: 0.25rem 0.7rem; border-radius: 999px; font-size: 0.78rem; font-weight: 700; }
                .ra-filters { display: flex; flex-wrap: wrap; gap: 0.7rem; margin-bottom: 1rem; align-items: flex-end; }
                .ra-filters label { display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.78rem; font-weight: 700; color: var(--md-on-surface-variant); }
                .ra-filters input, .ra-filters select { padding: 0.55rem 0.7rem; border-radius: var(--shape-sm); border: 1px solid var(--md-outline-variant); background: var(--md-surface); font-family: var(--font-body); font-size: 0.9rem; }
                .ra-pagination { display: flex; align-items: center; gap: 0.8rem; justify-content: flex-end; margin-top: 1rem; font-size: 0.85rem; color: var(--md-on-surface-variant); }
                .ra-btn-icon-sm { background: transparent; border: 1px solid var(--md-outline-variant); border-radius: var(--shape-sm); width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; cursor: pointer; }
                .ra-btn-icon-sm:disabled { opacity: 0.4; cursor: not-allowed; }
                .ra-btn-export { display: inline-flex; align-items: center; gap: 0.4rem; background: var(--md-primary); color: white; border: none; padding: 0.6rem 1.1rem; border-radius: var(--shape-sm); font-weight: 600; cursor: pointer; }
            </style>
        `;
        async function renderAccessi() {
            const container = el.querySelector('#ra-content');
            container.innerHTML = `<div style="text-align:center; padding:3rem;"><span class="material-symbols-rounded" style="font-size:2rem; animation: spin 2s linear infinite;">sync</span></div>`;
            const [statsRes, logsRes] = await Promise.all([
                window.electronAPI.getAccessLogsStats(actorUserId),
                window.electronAPI.getAllAccessLogs({ actorUserId, ...state.filters, page: state.page, pageSize: state.pageSize })
            ]);
            if (!logsRes || !logsRes.success) {
                container.innerHTML = `<p style="color: var(--md-error);">${(logsRes && logsRes.error) || 'Errore nel caricamento del registro accessi.'}</p>`;
                return;
            }
            const stats = statsRes && statsRes.success ? statsRes : { logins7d: 0, failed7d: 0, distinctDevices7d: 0 };
            const totalPages = Math.max(Math.ceil(logsRes.total / logsRes.pageSize), 1);
            container.innerHTML = `
                <div class="ra-stats-row">
                    <div class="ra-stat-card"><div class="ra-stat-value">${stats.logins7d}</div><div class="ra-stat-label">Accessi riusciti (7gg)</div></div>
                    <div class="ra-stat-card"><div class="ra-stat-value">${stats.failed7d}</div><div class="ra-stat-label">Tentativi falliti (7gg)</div></div>
                    <div class="ra-stat-card"><div class="ra-stat-value">${stats.distinctDevices7d}</div><div class="ra-stat-label">Dispositivi distinti (7gg)</div></div>
                </div>
                <div class="ra-filters">
                    <label>Tipo evento
                        <select id="ra-f-event">
                            <option value="">Tutti</option>
                            ${Object.keys(EVENT_LABELS).map(k => `<option value="${k}" ${state.filters.eventType === k ? 'selected' : ''}>${EVENT_LABELS[k]}</option>`).join('')}
                        </select>
                    </label>
                    <label>Da
                        <input type="date" id="ra-f-from">
                    </label>
                    <label>A
                        <input type="date" id="ra-f-to">
                    </label>
                    <label>Indirizzo IP
                        <input type="text" id="ra-f-ip" placeholder="es. 192.168." value="${state.filters.ip || ''}">
                    </label>
                    <button class="ra-btn-export" id="ra-btn-search"><span class="material-symbols-rounded">search</span> Filtra</button>
                    <button class="ra-btn-export" id="ra-btn-export" style="background: var(--md-secondary);"><span class="material-symbols-rounded">download</span> Esporta CSV</button>
                </div>
                <div class="ra-table-wrap">
                    <table class="ra-table">
                        <thead><tr><th>Data/Ora</th><th>Utente</th><th>Evento</th><th>Metodo</th><th>IP</th><th>Nodo</th><th>Dispositivo</th></tr></thead>
                        <tbody>
                            ${logsRes.logs.length === 0 ? '<tr><td colspan="7" style="text-align:center; padding:2rem; color: var(--md-on-surface-variant);">Nessun risultato</td></tr>' : logsRes.logs.map(log => `
                                <tr>
                                    <td>${fmtDate(log.timestamp)}</td>
                                    <td>${log.username || log.user_id}</td>
                                    <td><span class="ra-badge" style="background: rgba(0,0,0,0.06); color: ${EVENT_COLORS[log.event_type] || 'var(--md-on-surface-variant)'};">${EVENT_LABELS[log.event_type] || log.event_type}</span></td>
                                    <td>${log.auth_method || '—'}</td>
                                    <td style="font-family: monospace;">${log.ip_address || '—'}</td>
                                    <td>${log.node_name || '—'}</td>
                                    <td>${log.device_info || '—'}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
                <div class="ra-pagination">
                    <span>Pagina ${logsRes.page} di ${totalPages} (${logsRes.total} risultati)</span>
                    <button class="ra-btn-icon-sm" id="ra-page-prev" ${logsRes.page <= 1 ? 'disabled' : ''}><span class="material-symbols-rounded">chevron_left</span></button>
                    <button class="ra-btn-icon-sm" id="ra-page-next" ${logsRes.page >= totalPages ? 'disabled' : ''}><span class="material-symbols-rounded">chevron_right</span></button>
                </div>
            `;
            const eventSel = container.querySelector('#ra-f-event');
            const fromInp = container.querySelector('#ra-f-from');
            const toInp = container.querySelector('#ra-f-to');
            const ipInp = container.querySelector('#ra-f-ip');
            container.querySelector('#ra-btn-search').addEventListener('click', () => {
                state.filters = {
                    eventType: eventSel.value || undefined,
                    dateFrom: fromInp.value ? new Date(fromInp.value + 'T00:00:00').getTime() : undefined,
                    dateTo: toInp.value ? new Date(toInp.value + 'T23:59:59').getTime() : undefined,
                    ip: ipInp.value || undefined
                };
                state.page = 1;
                renderAccessi();
            });
            container.querySelector('#ra-btn-export').addEventListener('click', async () => {
                const allRes = await window.electronAPI.getAllAccessLogs({ actorUserId, ...state.filters, page: 1, pageSize: 5000 });
                if (!allRes || !allRes.success) return;
                const header = ['Data/Ora', 'Utente', 'Evento', 'Esito', 'Metodo', 'IP', 'Nodo', 'Dispositivo'];
                const rows = allRes.logs.map(l => [fmtDate(l.timestamp), l.username || l.user_id, EVENT_LABELS[l.event_type] || l.event_type, l.success ? 'OK' : 'Fallito', l.auth_method || '', l.ip_address || '', l.node_name || '', l.device_info || '']);
                const csv = [header, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
                const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `registro_accessi_${new Date().toISOString().slice(0, 10)}.csv`;
                a.click();
                URL.revokeObjectURL(url);
            });
            const prevBtn = container.querySelector('#ra-page-prev');
            const nextBtn = container.querySelector('#ra-page-next');
            if (prevBtn) prevBtn.addEventListener('click', () => { state.page = Math.max(state.page - 1, 1); renderAccessi(); });
            if (nextBtn) nextBtn.addEventListener('click', () => { state.page = state.page + 1; renderAccessi(); });
        }
        renderAccessi();
    }
};
