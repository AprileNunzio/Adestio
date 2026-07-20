export default {
    render: async (el, params) => {
        try {
            const htmlResponse = await fetch('adestio-app://impostazioni/subapps/diagnostica_log/index.html');
            if (htmlResponse.ok) {
                el.innerHTML = await htmlResponse.text();
            } else {
                el.innerHTML = `<p>Errore caricamento UI log</p>`;
                return;
            }

            const tbody = el.querySelector('#logs-tbody');
            const btnRefresh = el.querySelector('#btn-refresh');
            const btnBack = el.querySelector('#btn-back');

            btnBack.addEventListener('click', () => {
                import('../../app.js').then(m => m.default.render(el));
            });

            const loadLogs = async () => {
                tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 2rem;">Caricamento log in corso...</td></tr>`;
                try {
                    const logs = await window.electronAPI.invoke('get_system_logs');
                    if (logs && logs.length > 0) {
                        tbody.innerHTML = logs.map(log => {
                            const dateStr = new Date(log.timestamp).toLocaleString('it-IT');
                            const isError = log.status !== 'success';
                            const badgeClass = isError ? 'status-error' : 'status-success';
                            const badgeText = isError ? 'Errore' : 'Completato';
                            
                            return `
                                <tr style="border-bottom: 1px solid var(--md-outline-variant);">
                                    <td style="padding: 1rem; color: var(--md-on-surface-variant); font-size: 0.9rem;">${dateStr}</td>
                                    <td style="padding: 1rem; font-weight: 500;">${log.app_id}</td>
                                    <td style="padding: 1rem;">${log.version || '-'}</td>
                                    <td style="padding: 1rem;">
                                        <span class="status-badge ${badgeClass}">${badgeText}</span>
                                    </td>
                                    <td style="padding: 1rem; color: var(--md-on-surface-variant); font-size: 0.9rem;">
                                        ${log.details || ''} ${log.error_message ? `<br/><span style="color:var(--md-error)">${log.error_message}</span>` : ''}
                                    </td>
                                </tr>
                            `;
                        }).join('');
                    } else {
                        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 2rem;">Nessun log trovato.</td></tr>`;
                    }
                } catch (e) {
                    console.error("Errore caricamento log:", e);
                    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 2rem; color: var(--md-error);">Errore di comunicazione col database</td></tr>`;
                }
            };

            btnRefresh.addEventListener('click', loadLogs);
            loadLogs();

        } catch (error) {
            console.error("Error loading diagnostica_log:", error);
            el.innerHTML = `<p style="color:red">Errore critico: ${error.message}</p>`;
        }
    }
};
