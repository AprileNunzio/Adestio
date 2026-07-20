export class LedgerMetrics {
    constructor(container) {
        try {
            this._container = container;
            this._init();
        } catch (e) {
            console.error('[LedgerMetrics] constructor error:', e);
        }
    }
    _init() {
        try {
            this._container.innerHTML = `
                <div class="nodes-panel-header">
                    <span class="material-symbols-rounded">database</span>
                    Metriche Blockchain
                </div>
                <div class="nodes-panel-body" id="ledger-metrics-body">
                    <div class="nodes-metric-row">
                        <span class="nodes-metric-label">Altezza Ledger</span>
                        <span class="nodes-metric-value" id="lm-height">0</span>
                    </div>
                    <div class="nodes-metric-row">
                        <span class="nodes-metric-label">Ultimo Blocco</span>
                        <span class="nodes-metric-value mono" id="lm-hash">N/A</span>
                    </div>
                    <div class="nodes-metric-row">
                        <span class="nodes-metric-label">Timestamp</span>
                        <span class="nodes-metric-value" id="lm-time">-</span>
                    </div>
                    <div class="nodes-metric-row">
                        <span class="nodes-metric-label">DAG Tips</span>
                        <span class="nodes-metric-value" id="lm-tips">1</span>
                    </div>
                    <div class="nodes-metric-row">
                        <span class="nodes-metric-label">Blocchi Pendenti</span>
                        <span class="nodes-metric-value" id="lm-pending">0</span>
                    </div>
                    <div class="nodes-metric-row">
                        <span class="nodes-metric-label">Stato Sync</span>
                        <span class="nodes-metric-value" id="lm-sync" style="font-size: 0.75rem;">-</span>
                    </div>
                </div>
            `;
        } catch (e) {}
    }
    update(metrics) {
        try {
            if (!metrics) return;
            this._setVal('lm-height', metrics.height || 0);
            const hashStr = metrics.lastBlockHash && metrics.lastBlockHash !== 'N/A'
                ? metrics.lastBlockHash.substring(0, 16) + '...'
                : 'N/A';
            this._setVal('lm-hash', hashStr);
            const timeStr = metrics.lastBlockTime
                ? this._formatTime(metrics.lastBlockTime)
                : '-';
            this._setVal('lm-time', timeStr);
            this._setVal('lm-tips', metrics.dagTips || 1);
            this._setVal('lm-pending', metrics.pendingBlocks || 0);
            const syncEl = document.getElementById('lm-sync');
            if (syncEl) {
                syncEl.textContent = metrics.syncState || '-';
                const state = (metrics.syncState || '').toLowerCase();
                if (state.includes('errore') || state.includes('raggiungibile')) {
                    syncEl.style.color = '#ef4444';
                } else if (state.includes('corso') || state.includes('riconnessione')) {
                    syncEl.style.color = '#f59e0b';
                } else {
                    syncEl.style.color = '#10b981';
                }
            }
            const pendingEl = document.getElementById('lm-pending');
            if (pendingEl) {
                const pending = metrics.pendingBlocks || 0;
                pendingEl.style.color = pending > 0 ? '#f59e0b' : 'var(--md-on-surface)';
            }
        } catch (e) {}
    }
    _setVal(id, val) {
        try {
            const el = document.getElementById(id);
            if (el && el.textContent !== String(val)) {
                el.textContent = val;
            }
        } catch (e) {}
    }
    _formatTime(timestamp) {
        try {
            if (!timestamp) return '-';
            const d = new Date(timestamp);
            const now = new Date();
            const diffMs = now - d;
            const diffSec = Math.floor(diffMs / 1000);
            if (diffSec < 60) return `${diffSec}s fa`;
            if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m fa`;
            if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h fa`;
            return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
        } catch (e) {
            return '-';
        }
    }
}
