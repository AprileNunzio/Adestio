export class DataService {
    constructor() {
        this.userId = sessionStorage.getItem('currentUserId');
        this.preferences = [];
        this.notifications = [];
        this.stats = {
            total: 0,
            unread: 0,
            warnings: 0,
            errors: 0
        };
        this.onStatsChange = null;
        this.onPrefsChange = null;
        this.onHistoryChange = null;
        this.unreadOnly = false;
        this.severityFilter = 'all'; // all, info, warning, error
        this._setupListeners();
    }

    _setupListeners() {
        try {
            if (window.electronAPI && window.electronAPI.notifications && window.electronAPI.notifications.onNotificationNew) {
                window.electronAPI.notifications.onNotificationNew((data) => {
                    try {
                        this.loadHistory(); // Reload history and stats when a new notification arrives
                    } catch (e) {
                        console.error('[DataService] Error handling new notification:', e);
                    }
                });
            }
        } catch (e) {
            console.error('[DataService] Error setting up listeners:', e);
        }
    }

    setFilters(unreadOnly, severity) {
        try {
            this.unreadOnly = unreadOnly;
            this.severityFilter = severity;
            this.loadHistory();
        } catch (e) {
            console.error('[DataService] setFilters error:', e);
        }
    }

    async loadPreferences() {
        try {
            const res = await window.electronAPI.notifications.getPreferences(this.userId);
            if (res && res.success) {
                this.preferences = res.preferences || [];
                if (this.onPrefsChange) this.onPrefsChange(this.preferences);
            }
        } catch (e) {
            console.error('[DataService] loadPreferences error:', e);
        }
    }

    async updatePreference(category, patch) {
        try {
            const data = { userId: this.userId, category, ...patch };
            const r = await window.electronAPI.notifications.setPreference(data);
            return r;
        } catch (e) {
            console.error('[DataService] updatePreference error:', e);
            return { success: false, error: e.message };
        }
    }

    async loadHistory() {
        try {
            // Fetch a large enough batch to calculate some stats, or we could rely on a dedicated stats endpoint
            // For now, we load all up to a reasonable limit, or just apply filters to the API.
            // Since the API accepts unreadOnly, we pass it. The API might not accept severity filtering out-of-the-box,
            // so we might have to filter locally if the API doesn't support it.
            const req = { userId: this.userId, unreadOnly: this.unreadOnly, page: 1, pageSize: 200 };
            const res = await window.electronAPI.notifications.list(req);
            
            if (res && res.success) {
                let list = res.notifications || [];
                
                // Calculate stats based on the fetched data (or ideal would be a backend stats call)
                // For demonstration, we calculate stats on the returned dataset.
                this.stats.total = list.length;
                this.stats.unread = list.filter(n => !n.is_read).length;
                this.stats.warnings = list.filter(n => n.severity === 'warning').length;
                this.stats.errors = list.filter(n => n.severity === 'error').length;
                
                // Local severity filter
                if (this.severityFilter !== 'all') {
                    list = list.filter(n => n.severity === this.severityFilter);
                }
                
                this.notifications = list;

                if (this.onStatsChange) this.onStatsChange(this.stats);
                if (this.onHistoryChange) this.onHistoryChange(this.notifications);
            }
        } catch (e) {
            console.error('[DataService] loadHistory error:', e);
        }
    }

    async markAsRead(id = null, all = false) {
        try {
            if (all) {
                await window.electronAPI.notifications.markRead({ userId: this.userId, all: true });
            } else if (id) {
                await window.electronAPI.notifications.markRead({ userId: this.userId, id });
            }
            await this.loadHistory();
        } catch (e) {
            console.error('[DataService] markAsRead error:', e);
        }
    }
}
