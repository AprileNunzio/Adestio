export class StatsCards {
    constructor(container) {
        this.container = container;
    }

    update(stats) {
        try {
            this.container.innerHTML = `
                <div class="not-stat-card">
                    <div class="not-stat-icon" style="background: linear-gradient(135deg, var(--md-primary), var(--md-secondary));">
                        <span class="material-symbols-rounded">mark_email_unread</span>
                    </div>
                    <div class="not-stat-info">
                        <span class="not-stat-label">Da Leggere</span>
                        <span class="not-stat-value">${stats.unread}</span>
                    </div>
                </div>
                <div class="not-stat-card">
                    <div class="not-stat-icon" style="background: linear-gradient(135deg, #10b981, #059669);">
                        <span class="material-symbols-rounded">notifications_active</span>
                    </div>
                    <div class="not-stat-info">
                        <span class="not-stat-label">Totali Elencate</span>
                        <span class="not-stat-value">${stats.total}</span>
                    </div>
                </div>
                <div class="not-stat-card">
                    <div class="not-stat-icon" style="background: linear-gradient(135deg, #f59e0b, #d97706);">
                        <span class="material-symbols-rounded">warning</span>
                    </div>
                    <div class="not-stat-info">
                        <span class="not-stat-label">Avvisi</span>
                        <span class="not-stat-value">${stats.warnings}</span>
                    </div>
                </div>
                <div class="not-stat-card">
                    <div class="not-stat-icon" style="background: linear-gradient(135deg, var(--md-error), #b91c1c);">
                        <span class="material-symbols-rounded">error</span>
                    </div>
                    <div class="not-stat-info">
                        <span class="not-stat-label">Critiche</span>
                        <span class="not-stat-value">${stats.errors}</span>
                    </div>
                </div>
            `;
        } catch (e) {
            console.error('[StatsCards] update error:', e);
        }
    }
}
