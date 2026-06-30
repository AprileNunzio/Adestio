export class NodeTooltip {
    constructor(container) {
        try {
            this._container = container;
            this._el = null;
            this._visible = false;
            this._init();
        } catch (e) {
            console.error('[NodeTooltip] constructor error:', e);
        }
    }

    _init() {
        try {
            this._el = document.createElement('div');
            this._el.className = 'node-tooltip';
            this._el.innerHTML = '<div class="node-tooltip-inner"></div>';
            this._container.appendChild(this._el);
        } catch (e) {}
    }

    show(nodeData, screenX, screenY) {
        try {
            if (!nodeData || !this._el) return;

            const inner = this._el.querySelector('.node-tooltip-inner');
            if (!inner) return;

            const statusColor = nodeData.isLocal ? '#3b82f6'
                : (nodeData.status === 'Online' ? '#10b981' : '#f59e0b');
            const statusLabel = nodeData.isLocal ? 'Nodo Locale'
                : (nodeData.status || 'Online');

            const uptimeStr = this._formatUptime(nodeData.uptime || 0);
            const reliabilityStr = nodeData.isLocal ? '100%' : `${nodeData.reliability || 100}%`;
            const idStr = nodeData.nodeId ? (nodeData.nodeId.length > 20 ? nodeData.nodeId.substring(0, 20) + '...' : nodeData.nodeId) : 'N/A';
            const latencyStr = nodeData.isLocal ? '<1ms' : `${nodeData.pingMs || 0}ms`;
            const ledgerStr = nodeData.ledgerHeight !== null && nodeData.ledgerHeight !== undefined ? String(nodeData.ledgerHeight) : 'N/A';
            const protoStr = `v${nodeData.protocolVersion || 2}`;
            const portStr = nodeData.port || '34567';

            inner.innerHTML = `
                <div class="node-tooltip-name">
                    <span class="node-tooltip-status-dot" style="background: ${statusColor}; box-shadow: 0 0 8px ${statusColor};"></span>
                    ${this._escapeHtml(nodeData.name || 'Nodo')}
                </div>
                <div class="node-tooltip-ip">${this._escapeHtml(nodeData.ip)}:${portStr}</div>
                <div class="node-tooltip-divider"></div>
                <div class="node-tooltip-grid">
                    <div class="node-tooltip-field">
                        <span class="node-tooltip-field-label">Stato</span>
                        <span class="node-tooltip-field-value" style="color: ${statusColor};">${statusLabel}</span>
                    </div>
                    <div class="node-tooltip-field">
                        <span class="node-tooltip-field-label">Latenza</span>
                        <span class="node-tooltip-field-value">${latencyStr}</span>
                    </div>
                    <div class="node-tooltip-field">
                        <span class="node-tooltip-field-label">Affidabilit\u00e0</span>
                        <span class="node-tooltip-field-value">${reliabilityStr}</span>
                    </div>
                    <div class="node-tooltip-field">
                        <span class="node-tooltip-field-label">Uptime</span>
                        <span class="node-tooltip-field-value">${uptimeStr}</span>
                    </div>
                    <div class="node-tooltip-field">
                        <span class="node-tooltip-field-label">Blocchi Ledger</span>
                        <span class="node-tooltip-field-value">${ledgerStr}</span>
                    </div>
                    <div class="node-tooltip-field">
                        <span class="node-tooltip-field-label">Protocollo</span>
                        <span class="node-tooltip-field-value">${protoStr}</span>
                    </div>
                </div>
                <div class="node-tooltip-divider"></div>
                <div class="node-tooltip-field" style="margin-top: 0.1rem;">
                    <span class="node-tooltip-field-label">Node ID</span>
                    <span class="node-tooltip-field-value mono">${this._escapeHtml(idStr)}</span>
                </div>
            `;

            const rect = this._container.getBoundingClientRect();
            let x = screenX + 16;
            let y = screenY - 10;

            this._el.style.display = 'block';
            const tooltipRect = this._el.getBoundingClientRect();

            if (x + tooltipRect.width > window.innerWidth - 10) {
                x = screenX - tooltipRect.width - 16;
            }
            if (y + tooltipRect.height > window.innerHeight - 10) {
                y = window.innerHeight - tooltipRect.height - 10;
            }
            if (y < 10) y = 10;
            if (x < 10) x = 10;

            this._el.style.left = `${x}px`;
            this._el.style.top = `${y}px`;

            if (!this._visible) {
                requestAnimationFrame(() => {
                    try { this._el.classList.add('visible'); } catch (e) {}
                });
                this._visible = true;
            }
        } catch (e) {}
    }

    hide() {
        try {
            if (!this._el) return;
            this._el.classList.remove('visible');
            this._visible = false;
            setTimeout(() => {
                try { if (this._el) this._el.style.display = 'none'; } catch (e) {}
            }, 200);
        } catch (e) {}
    }

    _formatUptime(seconds) {
        try {
            if (!seconds || seconds < 0) return '0s';
            const d = Math.floor(seconds / 86400);
            const h = Math.floor((seconds % 86400) / 3600);
            const m = Math.floor((seconds % 3600) / 60);
            if (d > 0) return `${d}g ${h}h`;
            if (h > 0) return `${h}h ${m}m`;
            if (m > 0) return `${m}m`;
            return `${seconds}s`;
        } catch (e) {
            return '0s';
        }
    }

    _escapeHtml(str) {
        try {
            const div = document.createElement('div');
            div.textContent = str || '';
            return div.innerHTML;
        } catch (e) {
            return '';
        }
    }

    destroy() {
        try {
            if (this._el && this._el.parentNode) {
                this._el.parentNode.removeChild(this._el);
            }
            this._el = null;
        } catch (e) {}
    }
}
