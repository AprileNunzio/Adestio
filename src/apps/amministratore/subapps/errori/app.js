export default {
    render: async (el, params) => {
        try {
            el.innerHTML = `
<div class="fade-in-up" style="width: 100%; height: 100%; display: flex; flex-direction: column;">
    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 2rem;">
        <div style="display: flex; align-items: center; gap: 1rem;">
            <button id="btn-back" class="btn btn-icon" style="background: var(--md-surface-variant); color: var(--md-on-surface-variant);">
                <span class="material-symbols-rounded">arrow_back</span>
            </button>
            <div>
                <h2 style="color: var(--md-primary); margin: 0; display: flex; align-items: center; gap: 0.5rem;">
                    <span class="material-symbols-rounded">bug_report</span> Gestione Errori e Log
                </h2>
                <p style="color: var(--md-on-surface-variant); margin: 0; font-size: 0.9rem;">
                    Monitora, analizza e gestisci le anomalie del sistema.
                </p>
            </div>
        </div>
        
        <div style="display: flex; gap: 1rem;">
            <button id="btn-refresh" class="btn btn-secondary">
                <span class="material-symbols-rounded" style="font-size: 1.2rem;">refresh</span> Aggiorna
            </button>
            <button id="btn-clear-all" class="btn btn-primary" style="background: var(--md-error); color: var(--md-on-error);">
                <span class="material-symbols-rounded" style="font-size: 1.2rem;">delete_sweep</span> Svuota Tutto
            </button>
        </div>
    </div>

    <div class="card" style="flex: 1; display: flex; flex-direction: column; overflow: hidden; padding: 1rem;">
        <div style="flex: 1; overflow-y: auto; border: 1px solid var(--md-outline-variant); border-radius: 8px;">
            <table style="width: 100%; border-collapse: collapse; text-align: left;">
                <thead style="background: var(--md-surface-variant); position: sticky; top: 0; z-index: 10;">
                    <tr>
                        <th style="padding: 1rem; border-bottom: 1px solid var(--md-outline-variant);">Data e Ora</th>
                        <th style="padding: 1rem; border-bottom: 1px solid var(--md-outline-variant);">App / Modulo</th>
                        <th style="padding: 1rem; border-bottom: 1px solid var(--md-outline-variant);">Azione</th>
                        <th style="padding: 1rem; border-bottom: 1px solid var(--md-outline-variant);">Esito</th>
                        <th style="padding: 1rem; border-bottom: 1px solid var(--md-outline-variant);">Dettagli Errore</th>
                        <th style="padding: 1rem; border-bottom: 1px solid var(--md-outline-variant); text-align: center;">Azioni</th>
                    </tr>
                </thead>
                <tbody id="logs-tbody">
                    <!-- Logs verranno iniettati qui -->
                </tbody>
            </table>
        </div>
    </div>
</div>

<!-- Modal di Conferma Svuotamento -->
<div id="clear-confirm-modal" class="modal-overlay" style="display: none; position: fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:1000; align-items:center; justify-content:center;">
    <div class="card fade-in-up" style="max-width: 400px; padding: 2rem; background: var(--md-surface); border-radius: 12px;">
        <h3 style="margin-top: 0; color: var(--md-error); display: flex; align-items: center; gap: 0.5rem;">
            <span class="material-symbols-rounded">warning</span> Svuota Registro
        </h3>
        <p>Sei sicuro di voler eliminare definitivamente <strong>tutti</strong> gli errori e i log di sistema? Questa operazione non può essere annullata.</p>
        <div style="display: flex; justify-content: flex-end; gap: 1rem; margin-top: 2rem;">
            <button id="btn-cancel-clear" class="btn btn-secondary">Annulla</button>
            <button id="btn-confirm-clear" class="btn btn-primary" style="background: var(--md-error); color: var(--md-on-error);">Sì, Svuota</button>
        </div>
    </div>
</div>
            `;

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
