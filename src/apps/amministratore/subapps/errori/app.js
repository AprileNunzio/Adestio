export default {
    render: async (el, params) => {
        try {
            const htmlResponse = await fetch('../../apps/amministratore/subapps/errori/index.html');
            if (htmlResponse.ok) {
                el.innerHTML = await htmlResponse.text();
            } else {
                el.innerHTML = `<p>Errore caricamento UI log</p>`;
                return;
            }

            const tbody = el.querySelector('#logs-tbody');
            const btnRefresh = el.querySelector('#btn-refresh');
            const btnBack = el.querySelector('#btn-back');
            const btnClearAll = el.querySelector('#btn-clear-all');
            const modalConfirm = el.querySelector('#clear-confirm-modal');
            const btnCancelClear = el.querySelector('#btn-cancel-clear');
            const btnConfirmClear = el.querySelector('#btn-confirm-clear');

            btnBack.addEventListener('click', () => {
                import('../../app.js').then(m => m.default.render(el));
            });

            const renderLogs = (logs) => {
                if (!logs || logs.length === 0) {
                    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 2rem;">Nessun errore o log presente nel sistema.</td></tr>`;
                    return;
                }
                
                tbody.innerHTML = logs.map(log => {
                    const dateStr = new Date(log.timestamp).toLocaleString('it-IT');
                    const isError = log.success === 0;
                    const badgeClass = isError ? 'status-error' : 'status-success';
                    const badgeText = isError ? 'Errore' : 'Completato';
                    
                    return `
                        <tr style="border-bottom: 1px solid var(--md-outline-variant);">
                            <td style="padding: 1rem; color: var(--md-on-surface-variant); font-size: 0.9rem;">${dateStr}</td>
                            <td style="padding: 1rem; font-weight: 500;">${log.app_id}</td>
                            <td style="padding: 1rem;">${log.action || '-'}</td>
                            <td style="padding: 1rem;">
                                <span class="status-badge ${badgeClass}">${badgeText}</span>
                            </td>
                            <td style="padding: 1rem; color: var(--md-on-surface-variant); font-size: 0.9rem; max-width: 300px; word-wrap: break-word;">
                                ${log.error || '-'}
                            </td>
                            <td style="padding: 1rem; text-align: center;">
                                <button class="btn btn-icon btn-delete-log" data-id="${log.id}" style="color: var(--md-error);">
                                    <span class="material-symbols-rounded">delete</span>
                                </button>
                            </td>
                        </tr>
                    `;
                }).join('');

                // Attach event listeners for delete buttons
                el.querySelectorAll('.btn-delete-log').forEach(btn => {
                    btn.addEventListener('click', async (e) => {
                        const id = e.currentTarget.getAttribute('data-id');
                        if (confirm('Eliminare questo log?')) {
                            try {
                                const res = await window.electronAPI.invoke('delete_system_log', parseInt(id));
                                if (res.success) {
                                    loadLogs();
                                } else {
                                    alert('Errore cancellazione: ' + res.error);
                                }
                            } catch(err) {
                                alert('Errore IPC: ' + err.message);
                            }
                        }
                    });
                });
            };

            const loadLogs = async () => {
                tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 2rem;">Caricamento log in corso...</td></tr>`;
                try {
                    const logs = await window.electronAPI.invoke('get_system_logs'); // we can reuse the existing endpoint
                    renderLogs(logs);
                } catch (e) {
                    console.error("Errore caricamento log:", e);
                    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 2rem; color: var(--md-error);">Errore di comunicazione col database</td></tr>`;
                }
            };

            btnRefresh.addEventListener('click', loadLogs);
            
            btnClearAll.addEventListener('click', () => {
                modalConfirm.style.display = 'flex';
            });
            
            btnCancelClear.addEventListener('click', () => {
                modalConfirm.style.display = 'none';
            });
            
            btnConfirmClear.addEventListener('click', async () => {
                modalConfirm.style.display = 'none';
                try {
                    const res = await window.electronAPI.invoke('clear_system_logs');
                    if (res.success) {
                        loadLogs();
                    } else {
                        alert('Errore svuotamento: ' + res.error);
                    }
                } catch (err) {
                    alert('Errore IPC: ' + err.message);
                }
            });

            loadLogs();

        } catch (error) {
            console.error("Error loading diagnostica_log:", error);
            el.innerHTML = `<p style="color:red">Errore critico: ${error.message}</p>`;
        }
    }
};
