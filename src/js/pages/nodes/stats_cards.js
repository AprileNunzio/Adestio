export class StatsCards {
    constructor(container) {
        try {
            this._container = container;
            this._init();
        } catch (e) {
            console.error('[StatsCards] constructor error:', e);
        }
    }

    _init() {
        try {
            this._container.innerHTML = `
                <div class="nodes-stat-card" id="stat-nodes">
                    <div class="nodes-stat-icon" style="background: linear-gradient(135deg, #3b82f6, #2563eb);">
                        <span class="material-symbols-rounded">hub</span>
                    </div>
                    <div class="nodes-stat-info">
                        <span class="nodes-stat-label">Nodi Connessi</span>
                        <span class="nodes-stat-value" id="stat-nodes-val">0</span>
                    </div>
                </div>
                <div class="nodes-stat-card" id="stat-blocks">
                    <div class="nodes-stat-icon" style="background: linear-gradient(135deg, #8b5cf6, #7c3aed);">
                        <span class="material-symbols-rounded">deployed_code</span>
                    </div>
                    <div class="nodes-stat-info">
                        <span class="nodes-stat-label">Blocchi Ledger</span>
                        <span class="nodes-stat-value" id="stat-blocks-val">0</span>
                    </div>
                </div>
                <div class="nodes-stat-card" id="stat-throughput">
                    <div class="nodes-stat-icon" style="background: linear-gradient(135deg, #10b981, #059669);">
                        <span class="material-symbols-rounded">speed</span>
                    </div>
                    <div class="nodes-stat-info">
                        <span class="nodes-stat-label">Throughput</span>
                        <span class="nodes-stat-value" id="stat-throughput-val">0/m</span>
                    </div>
                </div>
                <div class="nodes-stat-card" id="stat-latency">
                    <div class="nodes-stat-icon" style="background: linear-gradient(135deg, #f59e0b, #d97706);">
                        <span class="material-symbols-rounded">timer</span>
                    </div>
                    <div class="nodes-stat-info">
                        <span class="nodes-stat-label">Latenza Media</span>
                        <span class="nodes-stat-value" id="stat-latency-val">0ms</span>
                    </div>
                </div>
                <div class="nodes-stat-card" id="stat-proto">
                    <div class="nodes-stat-icon" style="background: linear-gradient(135deg, #ec4899, #db2777);">
                        <span class="material-symbols-rounded">verified</span>
                    </div>
                    <div class="nodes-stat-info">
                        <span class="nodes-stat-label">Protocollo</span>
                        <span class="nodes-stat-value" id="stat-proto-val">v2</span>
                    </div>
                </div>
            `;
        } catch (e) {}
    }

    update(stats) {
        try {
            if (!stats) return;
            this._setVal('stat-nodes-val', stats.totalNodes || 0);
            this._setVal('stat-blocks-val', stats.totalBlocks || 0);
            this._setVal('stat-throughput-val', `${stats.throughput || 0}/m`);
            this._setVal('stat-latency-val', `${stats.avgLatency || 0}ms`);
            this._setVal('stat-proto-val', `v${stats.protocolVersion || 2}`);
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
}
