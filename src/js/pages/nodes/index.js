import { Router } from '../../utils.js';
import { STYLES } from './styles.js';
import { DataService } from './data_service.js';
import { TopologyCanvas } from './topology_canvas.js';
import { NodeTooltip } from './node_tooltip.js';
import { StatsCards } from './stats_cards.js';
import { LedgerMetrics } from './ledger_metrics.js';
import { ConsensusMonitor } from './consensus_monitor.js';
import { NetworkHealthGauge } from './network_health.js';
import { NodesTable } from './nodes_table.js';
export default {
    render: async (el) => {
        try {
            const styleTag = document.createElement('style');
            styleTag.textContent = STYLES;
            document.head.appendChild(styleTag);
            el.innerHTML = `
                <div class="nodes-page">
                    <div class="nodes-header">
                        <div class="nodes-header-title">
                            <h1>Gestione Nodi</h1>
                            <p>Dashboard blockchain, topologia di rete e stato dei peer connessi</p>
                        </div>
                        <div class="nodes-header-actions">
                            <button id="nm-btn-sync" class="nodes-action-btn secondary">
                                <span class="material-symbols-rounded" id="nm-sync-icon">sync</span> Sincronizza
                            </button>
                            <button id="nm-btn-diag" class="nodes-action-btn primary">
                                <span class="material-symbols-rounded">troubleshoot</span> Diagnostica P2P
                            </button>
                        </div>
                    </div>
                    <div class="nodes-stats-row" id="nm-stats-mount"></div>
                    <div class="nodes-main-grid">
                        <div class="nodes-topology-card">
                            <div class="nodes-topology-header">
                                <div class="nodes-topology-header-left">
                                    <span class="material-symbols-rounded">account_tree</span>
                                    Topologia di Rete
                                </div>
                                <span class="nodes-topology-count" id="nm-topo-count">0 nodi</span>
                            </div>
                            <div class="nodes-topology-canvas-wrap">
                                <canvas id="nm-canvas"></canvas>
                            </div>
                        </div>
                        <div class="nodes-info-section">
                            <div class="nodes-health-row">
                                <div id="nm-health-mount" class="nodes-panel"></div>
                                <div id="nm-ledger-mount" class="nodes-panel"></div>
                            </div>
                            <div id="nm-consensus-mount" class="nodes-panel" style="flex: 1;"></div>
                        </div>
                    </div>
                    <div class="nodes-table-section">
                        <div id="nm-table-mount" class="nodes-table-card"></div>
                    </div>
                </div>
            `;
            const dataService = new DataService();
            const canvas = document.getElementById('nm-canvas');
            const topology = new TopologyCanvas(canvas);
            const tooltip = new NodeTooltip(document.body);
            const statsCards = new StatsCards(document.getElementById('nm-stats-mount'));
            const healthMount = document.getElementById('nm-health-mount');
            healthMount.innerHTML = `
                <div class="nodes-panel-header">
                    <span class="material-symbols-rounded">monitor_heart</span>
                    Salute Rete
                </div>
                <div id="nm-health-body" style="flex: 1;"></div>
            `;
            const healthGauge = new NetworkHealthGauge(document.getElementById('nm-health-body'));
            const ledgerMetrics = new LedgerMetrics(document.getElementById('nm-ledger-mount'));
            const consensusMonitor = new ConsensusMonitor(document.getElementById('nm-consensus-mount'));
            const nodesTable = new NodesTable(document.getElementById('nm-table-mount'));
            topology.onNodeHover((nodeData, x, y) => {
                try {
                    if (nodeData) {
                        tooltip.show(nodeData, x, y);
                    } else {
                        tooltip.hide();
                    }
                } catch (e) {}
            });
            topology.onNodeClick((nodeData) => {
                try {
                    if (nodeData && !nodeData.isLocal && nodeData.ip) {
                        dataService.addSyncEvent('sync', `Dettagli nodo ${nodeData.ip} aperto`);
                    }
                } catch (e) {}
            });
            const btnSync = document.getElementById('nm-btn-sync');
            const syncIcon = document.getElementById('nm-sync-icon');
            btnSync.addEventListener('click', async () => {
                try {
                    syncIcon.style.animation = 'spin 1s linear infinite';
                    dataService.addSyncEvent('sync', 'Sincronizzazione forzata avviata');
                    if (window.electronAPI && window.electronAPI.forceSync) {
                        await window.electronAPI.forceSync();
                    }
                    setTimeout(() => {
                        try { syncIcon.style.animation = 'none'; } catch (e) {}
                    }, 3000);
                } catch (e) {
                    try { syncIcon.style.animation = 'none'; } catch (e2) {}
                }
            });
            const btnDiag = document.getElementById('nm-btn-diag');
            btnDiag.addEventListener('click', () => {
                try {
                    Router.navigate('network_analyzer');
                } catch (e) {}
            });
            topology.start();
            let prevSyncState = '';
            const refreshAll = async () => {
                try {
                    await dataService.refresh();
                    const allNodes = dataService.getAllNodes();
                    const stats = dataService.getNetworkStats();
                    const ledger = dataService.getLedgerMetrics();
                    const health = dataService.getNetworkHealthScore();
                    topology.setNodes(allNodes);
                    const topoCount = document.getElementById('nm-topo-count');
                    if (topoCount) topoCount.textContent = `${allNodes.length} nodi`;
                    statsCards.update(stats);
                    ledgerMetrics.update(ledger);
                    healthGauge.update(health);
                    nodesTable.update(allNodes);
                    const currentSyncState = stats.syncState || '';
                    if (currentSyncState !== prevSyncState && prevSyncState !== '') {
                        let eventType = 'info';
                        if (currentSyncState.toLowerCase().includes('errore')) eventType = 'error';
                        else if (currentSyncState.toLowerCase().includes('corso')) eventType = 'sync';
                        else if (currentSyncState.toLowerCase().includes('sincronizzato')) eventType = 'success';
                        dataService.addSyncEvent(eventType, currentSyncState);
                    }
                    prevSyncState = currentSyncState;
                    consensusMonitor.update({
                        syncState: currentSyncState,
                        events: dataService.getSyncEvents()
                    });
                    consensusMonitor.setEvents(dataService.getSyncEvents());
                } catch (e) {
                    console.error('[NodesPage] refreshAll error:', e);
                }
            };
            await refreshAll();
            const intervalId = setInterval(() => {
                try {
                    if (!document.getElementById('nm-canvas')) {
                        clearInterval(intervalId);
                        topology.stop();
                        tooltip.destroy();
                        healthGauge.destroy();
                        dataService.destroy();
                        try { document.head.removeChild(styleTag); } catch (e) {}
                        return;
                    }
                    refreshAll();
                } catch (e) {
                    clearInterval(intervalId);
                }
            }, 3000);
            if (window.electronAPI && window.electronAPI.onSyncStateChanged) {
                window.electronAPI.onSyncStateChanged((event, data) => {
                    try {
                        if (data && data.state) {
                            let eventType = 'info';
                            if (data.state.toLowerCase().includes('errore')) eventType = 'error';
                            else if (data.state.toLowerCase().includes('sincronizzato')) eventType = 'success';
                            else eventType = 'sync';
                            dataService.addSyncEvent(eventType, data.state);
                        }
                    } catch (e) {}
                });
            }
        } catch (e) {
            console.error('[NodesPage] render error:', e);
            el.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: var(--md-error);">
                    <div style="text-align: center;">
                        <span class="material-symbols-rounded" style="font-size: 3rem;">error</span>
                        <p>Errore nel caricamento della pagina Gestione Nodi</p>
                    </div>
                </div>
            `;
        }
    }
};
