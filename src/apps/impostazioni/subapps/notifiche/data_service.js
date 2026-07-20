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
        this.severityFilter = 'all'; 
        this._setupListeners();
    }
    _setupListeners() {
        try {
            if (window.electronAPI && window.electronAPI.notifications && window.electronAPI.notifications.onNotificationNew) {
                window.electronAPI.notifications.onNotificationNew((data) => {
                    try {
                        this.loadHistory(); 
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
            const req = { userId: this.userId, unreadOnly: this.unreadOnly, page: 1, pageSize: 200 };
            const res = await window.electronAPI.notifications.list(req);
            if (res && res.success) {
                let list = res.notifications || [];
                this.stats.total = list.length;
                this.stats.unread = list.filter(n => !n.is_read).length;
                this.stats.warnings = list.filter(n => n.severity === 'warning').length;
                this.stats.errors = list.filter(n => n.severity === 'error').length;
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
