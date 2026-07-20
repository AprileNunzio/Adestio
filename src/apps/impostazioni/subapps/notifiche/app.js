import { STYLES } from './styles.js';
import { DataService } from './data_service.js';
import { StatsCards } from './stats_cards.js';
import { PreferencesPanel } from './preferences_panel.js';
import { HistoryTable } from './history_table.js';

export default {
    render: async (el) => {
        try {
            // Append styles
            const styleTag = document.createElement('style');
            styleTag.textContent = STYLES;
            document.head.appendChild(styleTag);

            // Layout base
            el.innerHTML = `
                <div class="not-page">
                    <div class="not-header">
                        <div class="not-header-title">
                            <h1>Gestione Notifiche</h1>
                            <p>Controllo centrale degli avvisi di sistema, sicurezza e sincronizzazione</p>
                        </div>
                        <div class="not-header-actions">
                            <button id="not-btn-refresh" class="not-action-btn primary" style="background: linear-gradient(135deg, var(--md-primary), var(--md-secondary)); color: white;">
                                <span class="material-symbols-rounded" id="not-refresh-icon">sync</span> Aggiorna
                            </button>
                        </div>
                    </div>
                    
                    <div class="not-stats-row" id="not-stats-mount"></div>
                    
                    <div class="not-main-grid">
                        <div class="not-panel">
                            <div class="not-panel-header">
                                <span class="material-symbols-rounded">settings_suggest</span>
                                Preferenze Categorie
                            </div>
                            <div id="not-prefs-mount" class="not-prefs-list"></div>
                        </div>
                    </div>
                    
                    <div class="not-table-section">
                        <div id="not-table-mount" class="not-table-card"></div>
                    </div>
                </div>
            `;

            // Instantiate services and components
            const dataService = new DataService();
            const statsCards = new StatsCards(document.getElementById('not-stats-mount'));
            const preferencesPanel = new PreferencesPanel(document.getElementById('not-prefs-mount'), dataService);
            const historyTable = new HistoryTable(document.getElementById('not-table-mount'), dataService);

            // Bind data updates to UI components
            dataService.onStatsChange = (stats) => {
                try { statsCards.update(stats); } catch (e) { console.error(e); }
            };
            
            dataService.onPrefsChange = (prefs) => {
                try { preferencesPanel.render(prefs); } catch (e) { console.error(e); }
            };
            
            dataService.onHistoryChange = (history) => {
                try { historyTable.update(history); } catch (e) { console.error(e); }
            };

            // Setup refresh button
            const btnRefresh = document.getElementById('not-btn-refresh');
            const syncIcon = document.getElementById('not-refresh-icon');
            btnRefresh.addEventListener('click', async () => {
                try {
                    syncIcon.style.animation = 'spin 1s linear infinite';
                    await Promise.all([
                        dataService.loadPreferences(),
                        dataService.loadHistory()
                    ]);
                    setTimeout(() => {
                        try { syncIcon.style.animation = 'none'; } catch (e) {}
                    }, 500);
                } catch (e) {
                    try { syncIcon.style.animation = 'none'; } catch (e2) {}
                    console.error('Refresh error:', e);
                }
            });

            // Initial load
            await dataService.loadPreferences();
            await dataService.loadHistory();

            // Setup a cleanup observer to remove the style tag when the component is unmounted
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    mutation.removedNodes.forEach((node) => {
                        if (node === el || el.contains(node)) {
                            try {
                                if (document.head.contains(styleTag)) {
                                    document.head.removeChild(styleTag);
                                }
                                observer.disconnect();
                            } catch (e) {
                                console.error('Cleanup error:', e);
                            }
                        }
                    });
                });
            });
            
            if (el.parentNode) {
                observer.observe(el.parentNode, { childList: true });
            }

        } catch (e) {
            console.error('[NotificationsPage] render error:', e);
            el.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: var(--md-error);">
                    <div style="text-align: center;">
                        <span class="material-symbols-rounded" style="font-size: 3rem;">error</span>
                        <p>Errore nel caricamento del Gestore Notifiche</p>
                        <pre style="font-size: 0.7rem; color: var(--md-on-surface-variant);">${e.message}</pre>
                    </div>
                </div>
            `;
        }
    }
};
