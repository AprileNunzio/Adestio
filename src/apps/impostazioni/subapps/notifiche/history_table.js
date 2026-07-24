export class HistoryTable {
    constructor(container, dataService) {
        this.container = container;
        this.dataService = dataService;
        this.SEVERITY_ICONS = {
            info: 'info',
            warning: 'warning',
            error: 'error'
        };
        this.CATEGORY_LABELS = {
            security: 'Sicurezza',
            sync: 'Sincronizzazione',
            system: 'Sistema',
            network: 'Rete'
        };
        this._renderBase();
        this._attachBaseEvents();
    }
    _renderBase() {
        try {
            this.container.innerHTML = `
                <div class="not-table-header">
                    <div class="not-table-header-left">
                        <span class="material-symbols-rounded">history</span>
                        Cronologia Notifiche
                    </div>
                    <div class="not-table-filters">
                        <select id="not-severity-filter" class="not-filter-select">
                            <option value="all">Tutte le gravità</option>
                            <option value="info">Solo Info</option>
                            <option value="warning">Solo Avvisi</option>
                            <option value="error">Solo Critiche</option>
                        </select>
                        <label class="not-toggle-inline">
                            <input type="checkbox" id="not-unread-checkbox">
                            Solo non lette
                        </label>
                        <button id="not-mark-all-btn" class="not-action-btn secondary" style="padding: 0.4rem 0.8rem;">
                            <span class="material-symbols-rounded" style="font-size: 1rem;">done_all</span> Leggi Tutte
                        </button>
                    </div>
                </div>
                <div class="not-table-wrap">
                    <table class="not-table">
                        <thead>
                            <tr>
                                <th style="width: 50px;"></th>
                                <th>Notifica</th>
                                <th style="width: 150px;">Categoria</th>
                                <th style="width: 150px;">Data</th>
                                <th style="width: 100px; text-align: right;">Azioni</th>
                            </tr>
                        </thead>
                        <tbody id="not-table-body">
                            <tr><td colspan="5" style="text-align:center; padding: 2rem;"><span class="material-symbols-rounded" style="animation: spin 2s linear infinite;">sync</span></td></tr>
                        </tbody>
                    </table>
                </div>
            `;
            this.tbody = this.container.querySelector('#not-table-body');
        } catch (e) {
            console.error('[HistoryTable] _renderBase error:', e);
        }
    }
    _attachBaseEvents() {
        try {
            const severityFilter = this.container.querySelector('#not-severity-filter');
            const unreadCheckbox = this.container.querySelector('#not-unread-checkbox');
            const markAllBtn = this.container.querySelector('#not-mark-all-btn');
            severityFilter.addEventListener('change', (e) => {
                this.dataService.setFilters(unreadCheckbox.checked, e.target.value);
            });
            unreadCheckbox.addEventListener('change', (e) => {
                this.dataService.setFilters(e.target.checked, severityFilter.value);
            });
            markAllBtn.addEventListener('click', async () => {
                try {
                    await this.dataService.markAsRead(null, true);
                    const { toast } = await import('../../../../js/utils.js');
                    toast('Tutte le notifiche sono state segnate come lette', 'success');
                } catch (err) {
                    console.error('[HistoryTable] mark all error:', err);
                }
            });
        } catch (e) {
            console.error('[HistoryTable] _attachBaseEvents error:', e);
        }
    }
    _fmtDate(ts) {
        if (!ts) return '—';
        try { return new Date(Number(ts)).toLocaleString('it-IT'); } catch (e) { return '—'; }
    }
    update(notifications) {
        try {
            if (!notifications || notifications.length === 0) {
                this.tbody.innerHTML = `
                    <tr>
                        <td colspan="5">
                            <div class="not-empty">
                                <span class="material-symbols-rounded" style="font-size:3rem; opacity:0.3;">notifications_off</span>
                                <div>Nessuna notifica trovata.</div>
                            </div>
                        </td>
                    </tr>
                `;
                return;
            }
            this.tbody.innerHTML = notifications.map(n => {
                let metaHtml = '';
                try {
                    if (n.metadata) {
                        const meta = JSON.parse(n.metadata);
                        if (meta.actionUrl && meta.actionLabel) {
                            metaHtml = `<a href="${meta.actionUrl}" class="not-action-link">${meta.actionLabel}</a>`;
                        } else if (meta.customHtml) {
                            metaHtml = `<div style="margin-top: 0.3rem;">${meta.customHtml}</div>`;
                        }
                    }
                } catch (e) {}
                return `
                    <tr class="${n.is_read ? '' : 'unread'}">
                        <td style="text-align: center;">
                            <span class="material-symbols-rounded" style="color: var(--md-${n.severity === 'warning' ? 'error' : (n.severity === 'error' ? 'error' : 'primary')}); ${n.severity === 'warning' ? 'color:#f59e0b;' : ''}">
                                ${this.SEVERITY_ICONS[n.severity] || 'notifications'}
                            </span>
                        </td>
                        <td>
                            <div class="not-item-content">
                                <div class="not-item-title">${n.title}</div>
                                ${n.message ? `<div class="not-item-msg">${n.message}</div>` : ''}
                                ${metaHtml}
                            </div>
                        </td>
                        <td>
                            <div class="not-badge ${n.severity}">
                                ${this.CATEGORY_LABELS[n.category] || n.category}
                            </div>
                        </td>
                        <td style="font-size: 0.75rem; color: var(--md-on-surface-variant);">
                            ${this._fmtDate(n.created_at)}
                        </td>
                        <td style="text-align: right;">
                            ${!n.is_read ? `<button class="not-btn-mark" data-mark="${n.id}"><span class="material-symbols-rounded" style="font-size: 0.9rem; vertical-align: middle;">check</span></button>` : ''}
                        </td>
                    </tr>
                `;
            }).join('');
            
            this.tbody.querySelectorAll('[data-mark]').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const id = btn.getAttribute('data-mark');
                    await this.dataService.markAsRead(id);
                });
            });
        } catch (e) {
            console.error('[HistoryTable] update error:', e);
            this.tbody.innerHTML = `<tr><td colspan="5" style="color: var(--md-error); text-align:center; padding: 1rem;">Errore rendering tabella.</td></tr>`;
        }
    }
}
