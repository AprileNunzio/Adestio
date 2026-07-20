import { Router, toast } from '../../../../js/utils.js';

export default {
    render: async (el) => {
        try {
            el.innerHTML = `
                <div class="fade-in-up" style="width: 100%; margin: 0 auto; padding-top: 1rem; display: flex; flex-direction: column; gap: 2rem;">


                    <div style="display: flex; flex-wrap: wrap; gap: 2rem; align-items: flex-start;">
                        <!-- Colonna Sinistra (Locale e Globale) -->
                        <div style="flex: 1; min-width: 350px; display: flex; flex-direction: column; gap: 2rem;">
                            <div>
                                <h1 class="text-title" style="font-size: 2.2rem; margin-bottom: 0.5rem; display: flex; align-items: center; gap: 1rem;">
                                    <span class="material-symbols-rounded" style="font-size: 2.5rem; color: var(--md-primary);">dns</span>
                                    Dashboard di Rete
                                </h1>
                                <p class="text-body" style="color: var(--md-on-surface-variant);">
                                    Pannello di controllo avanzato per il monitoraggio e la riparazione dell'infrastruttura P2P.
                                </p>
                            </div>

                            <div style="background: var(--md-surface); border-radius: 16px; padding: 1.5rem; border: 1px solid var(--md-outline-variant); box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
                                <h2 class="text-title" style="font-size: 1.2rem; color: var(--md-on-surface); display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1rem;">
                                    <span class="material-symbols-rounded" style="color: var(--md-primary);">computer</span> Nodo Locale
                                </h2>
                                <div style="display: flex; justify-content: space-between; align-items: center; padding: 1rem; background: var(--md-surface-variant); border-radius: 12px;">
                                    <div>
                                        <div style="font-size: 0.9rem; color: var(--md-on-surface-variant);">Blocchi nel Ledger</div>
                                        <div style="font-size: 1.8rem; font-weight: 600; color: var(--md-primary);" id="local-blocks">--</div>
                                    </div>
                                    <div style="text-align: right;">
                                        <div style="font-size: 0.9rem; color: var(--md-on-surface-variant);">Stato</div>
                                        <div style="color: #2e7d32; font-weight: 600; display: flex; align-items: center; gap: 0.3rem;">
                                            <span class="material-symbols-rounded" style="font-size: 1.2rem;">check_circle</span> Attivo
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div style="background: rgba(179, 38, 30, 0.05); border-radius: 16px; padding: 1.5rem; border: 1px solid rgba(179, 38, 30, 0.2);">
                                <h2 class="text-title" style="font-size: 1.2rem; color: var(--md-error); display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                                    <span class="material-symbols-rounded">warning</span> Opzione Nucleare Globale
                                </h2>
                                <p class="text-body" style="font-size: 0.9rem; color: var(--md-on-surface-variant); margin-bottom: 1.5rem;">
                                    Invia un impulso UDP. Tutti i PC nella LAN si riavvieranno e cloneranno forzatamente questo database.
                                </p>
                                <button id="btn-nuke" class="btn btn-filled" style="background: var(--md-error); color: white; width: 100%; justify-content: center;">
                                    <span class="material-symbols-rounded">bomb</span> Allinea tutti i Nodi
                                </button>
                            </div>
                        </div>

                        <!-- Colonna Destra (Nodi Connessi) -->
                        <div style="flex: 2; min-width: 400px; display: flex; flex-direction: column; gap: 1rem;">
                            <div style="display: flex; justify-content: space-between; align-items: flex-end;">
                                <h2 class="text-title" style="font-size: 1.4rem; color: var(--md-on-surface);">Nodi Connessi</h2>
                                <div style="font-size: 0.85rem; color: var(--md-on-surface-variant); display: flex; align-items: center; gap: 0.3rem;">
                                    <span class="material-symbols-rounded spin" style="font-size: 1rem;" id="sync-spinner">sync</span> Live Sync
                                </div>
                            </div>
                            <div id="nodes-container" style="display: flex; flex-direction: column; gap: 1rem;">
                                <div style="padding: 2rem; text-align: center; color: var(--md-on-surface-variant); background: var(--md-surface); border-radius: 16px; border: 1px dashed var(--md-outline-variant);">
                                    Caricamento nodi in corso...
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Modal di conferma Globale -->
                    <div id="nuke-modal" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 1000; align-items: center; justify-content: center;">
                        <div style="background: var(--md-surface); padding: 2rem; border-radius: 16px; max-width: 500px; width: 90%;">
                            <h3 style="color: var(--md-error); margin-bottom: 1rem; font-size: 1.4rem;">Sei assolutamente sicuro?</h3>
                            <p style="margin-bottom: 2rem; color: var(--md-on-surface-variant);">
                                Stai per sovrascrivere i dati di tutti gli altri nodi nella rete. Qualsiasi dato offline non ancora sincronizzato sui nodi remoti andrà perso (verrà preservato nella loro cartella backups).
                            </p>
                            <div style="display: flex; gap: 1rem; justify-content: flex-end;">
                                <button id="btn-cancel-nuke" class="btn" style="background: transparent; color: var(--md-on-surface);">Annulla</button>
                                <button id="btn-confirm-nuke" class="btn btn-filled" style="background: var(--md-error); color: white;">Procedi</button>
                            </div>
                        </div>
                    </div>
                </div>
                <style>
                    .node-card {
                        background: var(--md-surface); border-radius: 12px; padding: 1rem 1.5rem; border: 1px solid var(--md-outline-variant); display: flex; align-items: center; justify-content: space-between; gap: 1rem; transition: all 0.2s; box-shadow: 0 2px 4px rgba(0,0,0,0.02);
                    }
                    .node-card:hover { border-color: var(--md-outline); box-shadow: 0 4px 8px rgba(0,0,0,0.05); }
                    .sync-bar-bg { flex: 1; height: 6px; background: var(--md-surface-variant); border-radius: 3px; overflow: hidden; margin-top: 0.5rem; position: relative; }
                    .sync-bar-fill { height: 100%; border-radius: 3px; transition: width 0.5s ease-out, background-color 0.5s; }
                    .action-btn { background: transparent; border: 1px solid var(--md-outline-variant); color: var(--md-on-surface); height: 36px; padding: 0 1rem; border-radius: 18px; font-size: 0.85rem; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 0.4rem; white-space: nowrap; }
                    .action-btn:hover { background: var(--md-surface-variant); }
                    .action-btn.danger { color: var(--md-error); border-color: rgba(179, 38, 30, 0.3); }
                    .action-btn.danger:hover { background: rgba(179, 38, 30, 0.05); }
                </style>
            `;

            // Gestione Nuke Globale
            const modal = el.querySelector('#nuke-modal');
            el.querySelector('#btn-nuke').addEventListener('click', () => modal.style.display = 'flex');
            el.querySelector('#btn-cancel-nuke').addEventListener('click', () => modal.style.display = 'none');
            const confirmBtn = el.querySelector('#btn-confirm-nuke');
            confirmBtn.addEventListener('click', async () => {
                try {
                    confirmBtn.disabled = true; confirmBtn.innerHTML = '<span class="material-symbols-rounded spin">sync</span> Inviando...';
                    const res = await window.electronAPI.forceNetworkDatabaseSync();
                    if (res && res.success) toast('Impulso globale inviato!', 'success');
                    else toast('Errore: ' + (res?.error || 'Sconosciuto'), 'error');
                } catch (e) { toast('Eccezione: ' + e.message, 'error'); } 
                finally { modal.style.display = 'none'; confirmBtn.disabled = false; confirmBtn.innerHTML = 'Procedi'; }
            });

            // Gestione Polling Nodi
            let pollTimer = null;
            const nodesContainer = el.querySelector('#nodes-container');
            const localBlocksEl = el.querySelector('#local-blocks');
            
            const renderNodes = (localBlocks, nodes) => {
                if (!nodes || nodes.length === 0) {
                    nodesContainer.innerHTML = '<div style="padding: 2rem; text-align: center; color: var(--md-on-surface-variant); background: var(--md-surface); border-radius: 16px; border: 1px dashed var(--md-outline-variant);">Nessun nodo connesso al momento.</div>';
                    return;
                }
                nodesContainer.innerHTML = '';
                nodes.forEach(n => {
                    const pct = n.syncPercentage;
                    let color = 'var(--md-error)';
                    if (pct >= 99) color = '#2e7d32'; // Verde
                    else if (pct >= 80) color = '#f57f17'; // Arancio
                    
                    const card = document.createElement('div');
                    card.className = 'node-card fade-in-up';
                    card.innerHTML = `
                        <div style="flex: 2; min-width: 150px;">
                            <div style="font-weight: 600; color: var(--md-on-surface); display: flex; align-items: center; gap: 0.4rem;">
                                <span class="material-symbols-rounded" style="font-size: 1.1rem; color: ${color};">power</span>
                                ${n.name || 'Nodo Sconosciuto'}
                            </div>
                            <div style="font-size: 0.8rem; color: var(--md-on-surface-variant); margin-top: 0.2rem;">${n.ip}:${n.port || 34567}</div>
                        </div>
                        <div style="flex: 2; min-width: 150px;">
                            <div style="display: flex; justify-content: space-between; font-size: 0.85rem; color: var(--md-on-surface-variant);">
                                <span>Blocchi: <b>${n.remoteBlocks}</b> / ${localBlocks}</span>
                                <span style="color: ${color}; font-weight: 600;">${pct}%</span>
                            </div>
                            <div class="sync-bar-bg">
                                <div class="sync-bar-fill" style="width: ${pct}%; background-color: ${color};"></div>
                            </div>
                        </div>
                        <div style="flex: 1; display: flex; flex-direction: column; gap: 0.4rem; align-items: flex-end; min-width: 200px;">
                            <button class="action-btn" onclick="window.triggerNodeAction('soft_sync', '${n.ip}', ${n.port || 34567})" title="Richiedi i pacchetti mancanti in modo non distruttivo">
                                <span class="material-symbols-rounded">download</span> Sincronizza
                            </button>
                            <div style="display: flex; gap: 0.4rem;">
                                <button class="action-btn danger" onclick="if(confirm('ATTENZIONE: Formattare questo PC e scaricare il DB dal nodo remoto?')) window.triggerNodeAction('hard_clone_from_remote', '${n.ip}', ${n.port || 34567})" title="Clona il DB dal nodo">
                                    <span class="material-symbols-rounded">file_download</span> Da Nodo
                                </button>
                                <button class="action-btn danger" onclick="if(confirm('ATTENZIONE: Forzare il nodo remoto a formattarsi e prendere il TUO database?')) window.triggerNodeAction('hard_clone_to_remote', '${n.ip}', ${n.port || 34567})" title="Sovrascrivi il nodo col tuo DB">
                                    <span class="material-symbols-rounded">publish</span> Su Nodo
                                </button>
                            </div>
                        </div>
                    `;
                    nodesContainer.appendChild(card);
                });
            };

            const poll = async () => {
                if (!document.body.contains(el)) { clearInterval(pollTimer); return; }
                try {
                    const data = await window.electronAPI.getNetworkSyncStatus();
                    if (data) {
                        localBlocksEl.textContent = data.localBlocks || 0;
                        renderNodes(data.localBlocks || 0, data.nodes || []);
                    }
                } catch(e) { console.error('Polling error', e); }
            };
            
            window.triggerNodeAction = async (action, ip, port) => {
                toast('Invio comando in corso...', 'info');
                try {
                    const res = await window.electronAPI.executeNodeAction(action, ip, port);
                    if (res && res.success) toast('Comando eseguito con successo!', 'success');
                    else toast('Errore: ' + (res?.error || 'Fallito'), 'error');
                } catch (e) { toast('Errore IPC: ' + e.message, 'error'); }
                poll();
            };

            poll();
            pollTimer = setInterval(poll, 3000);

        } catch (e) {
            el.innerHTML = `<div style="padding: 2rem; color: var(--md-error);">Errore rendering modulo Database: ${e.message}</div>`;
        }
    }
};
