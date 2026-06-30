export class NodesTable {
    constructor(container) {
        try {
            this._container = container;
            this._sortColumn = 'name';
            this._sortAsc = true;
            this._nodes = [];
            this._init();
        } catch (e) {
            console.error('[NodesTable] constructor error:', e);
        }
    }

    _init() {
        try {
            this._container.innerHTML = `
                <div class="nodes-table-header">
                    <div class="nodes-table-header-left">
                        <span class="material-symbols-rounded">table_chart</span>
                        Registro Nodi Dettagliato
                    </div>
                    <span id="table-count" style="font-size: 0.75rem; color: var(--md-on-surface-variant); font-weight: 600;">0 nodi</span>
                </div>
                <div class="nodes-table-wrap">
                    <table class="nodes-table">
                        <thead>
                            <tr id="table-thead-row"></tr>
                        </thead>
                        <tbody id="table-tbody"></tbody>
                    </table>
                </div>
            `;

            this._columns = [
                { key: 'status', label: 'Stato', sortable: false },
                { key: 'name', label: 'Nome', sortable: true },
                { key: 'ip', label: 'Indirizzo', sortable: true },
                { key: 'nodeId', label: 'Node ID', sortable: true },
                { key: 'pingMs', label: 'Latenza', sortable: true },
                { key: 'ledgerHeight', label: 'Blocchi', sortable: true },
                { key: 'reliability', label: 'Affidabilit\u00e0', sortable: true },
                { key: 'protocolVersion', label: 'Protocollo', sortable: true }
            ];

            this._renderHeader();
        } catch (e) {}
    }

    _renderHeader() {
        try {
            const row = document.getElementById('table-thead-row');
            if (!row) return;

            row.innerHTML = this._columns.map(col => {
                try {
                    const sortedClass = this._sortColumn === col.key ? 'sorted' : '';
                    const sortIcon = col.sortable
                        ? `<span class="material-symbols-rounded sort-icon">${this._sortColumn === col.key ? (this._sortAsc ? 'arrow_upward' : 'arrow_downward') : 'unfold_more'}</span>`
                        : '';
                    return `<th class="${sortedClass}" data-col="${col.key}" ${col.sortable ? 'data-sortable="true"' : ''}>${col.label}${sortIcon}</th>`;
                } catch (e) {
                    return '<th></th>';
                }
            }).join('');

            row.querySelectorAll('th[data-sortable="true"]').forEach(th => {
                try {
                    th.addEventListener('click', () => {
                        try {
                            const col = th.getAttribute('data-col');
                            if (this._sortColumn === col) {
                                this._sortAsc = !this._sortAsc;
                            } else {
                                this._sortColumn = col;
                                this._sortAsc = true;
                            }
                            this._renderHeader();
                            this._renderBody();
                        } catch (e) {}
                    });
                } catch (e) {}
            });
        } catch (e) {}
    }

    update(nodes) {
        try {
            this._nodes = nodes || [];
            const countEl = document.getElementById('table-count');
            if (countEl) countEl.textContent = `${this._nodes.length} nodi`;
            this._renderBody();
        } catch (e) {}
    }

    _renderBody() {
        try {
            const tbody = document.getElementById('table-tbody');
            if (!tbody) return;

            const sorted = [...this._nodes].sort((a, b) => {
                try {
                    let va = a[this._sortColumn];
                    let vb = b[this._sortColumn];
                    if (typeof va === 'string') va = va.toLowerCase();
                    if (typeof vb === 'string') vb = vb.toLowerCase();
                    if (va === null || va === undefined) va = '';
                    if (vb === null || vb === undefined) vb = '';
                    let cmp = 0;
                    if (typeof va === 'number' && typeof vb === 'number') cmp = va - vb;
                    else cmp = String(va).localeCompare(String(vb));
                    return this._sortAsc ? cmp : -cmp;
                } catch (e) {
                    return 0;
                }
            });

            tbody.innerHTML = sorted.map(node => {
                try {
                    const isLocal = node.isLocal;
                    const rowClass = isLocal ? 'local-node' : '';

                    const statusClass = isLocal ? 'online' : (node.status === 'Online' ? 'online' : 'syncing');
                    const statusText = isLocal ? 'Locale' : (node.status || 'Online');

                    const ipStr = `${node.ip}:${node.port || 34567}`;
                    const idStr = node.nodeId
                        ? (node.nodeId.length > 14 ? node.nodeId.substring(0, 14) + '...' : node.nodeId)
                        : 'N/A';
                    const latencyStr = isLocal ? '<1ms' : `${node.pingMs || 0}ms`;
                    const blocksStr = node.ledgerHeight !== null && node.ledgerHeight !== undefined ? node.ledgerHeight : '-';
                    const reliability = node.isLocal ? 100 : (node.reliability || 100);
                    const relColor = reliability >= 90 ? '#10b981' : (reliability >= 60 ? '#f59e0b' : '#ef4444');
                    const protoStr = `v${node.protocolVersion || 2}`;

                    return `
                        <tr class="${rowClass}">
                            <td><span class="td-status ${statusClass}"><span style="width:5px;height:5px;border-radius:50%;background:currentColor;"></span> ${this._esc(statusText)}</span></td>
                            <td style="font-weight: 600;">${this._esc(node.name || 'Nodo')}</td>
                            <td class="td-mono">${this._esc(ipStr)}</td>
                            <td class="td-mono">${this._esc(idStr)}</td>
                            <td>${latencyStr}</td>
                            <td style="font-weight: 700;">${blocksStr}</td>
                            <td>
                                <div class="td-reliability">
                                    <div class="nodes-reliability-bar">
                                        <div class="nodes-reliability-fill" style="width: ${reliability}%; background: ${relColor};"></div>
                                    </div>
                                    <span style="font-size: 0.72rem; font-weight: 600;">${reliability}%</span>
                                </div>
                            </td>
                            <td>${protoStr}</td>
                        </tr>
                    `;
                } catch (e) {
                    return '<tr><td colspan="8">-</td></tr>';
                }
            }).join('');
        } catch (e) {}
    }

    _esc(str) {
        try {
            const div = document.createElement('div');
            div.textContent = str || '';
            return div.innerHTML;
        } catch (e) {
            return '';
        }
    }
}
