export class ConsensusMonitor {
    constructor(container) {
        try {
            this._container = container;
            this._events = [];
            this._init();
        } catch (e) {
            console.error('[ConsensusMonitor] constructor error:', e);
        }
    }
    _init() {
        try {
            this._container.innerHTML = `
                <div class="nodes-panel-header">
                    <span class="material-symbols-rounded">handshake</span>
                    Consenso & Eventi
                </div>
                <div class="nodes-panel-body">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem;">
                        <span class="nodes-metric-label">Stato Consenso</span>
                        <span id="consensus-badge" class="nodes-consensus-badge ok">
                            <span style="width: 6px; height: 6px; border-radius: 50%; background: currentColor;"></span>
                            In Consenso
                        </span>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                        <span class="nodes-metric-label">Errori Sync</span>
                        <span class="nodes-metric-value" id="consensus-errors" style="font-size: 0.8rem;">0</span>
                    </div>
                    <div style="border-top: 1px solid rgba(0,0,0,0.04); padding-top: 0.4rem;">
                        <span class="nodes-metric-label" style="display: block; margin-bottom: 0.3rem;">Ultimi Eventi</span>
                        <div id="consensus-timeline" class="nodes-event-timeline">
                            <div style="text-align: center; color: var(--md-on-surface-variant); font-size: 0.72rem; padding: 0.5rem 0; opacity: 0.5;">
                                In attesa di eventi...
                            </div>
                        </div>
                    </div>
                </div>
            `;
        } catch (e) {}
    }
    update(data) {
        try {
            if (!data) return;
            const badge = document.getElementById('consensus-badge');
            if (badge) {
                const syncState = (data.syncState || '').toLowerCase();
                if (syncState.includes('errore') || syncState.includes('raggiungibile') || syncState.includes('incompatibile')) {
                    badge.className = 'nodes-consensus-badge error';
                    badge.innerHTML = '<span style="width:6px;height:6px;border-radius:50%;background:currentColor;"></span> Divergenza';
                } else if (syncState.includes('corso') || syncState.includes('riconnessione') || syncState.includes('handshake')) {
                    badge.className = 'nodes-consensus-badge warn';
                    badge.innerHTML = '<span style="width:6px;height:6px;border-radius:50%;background:currentColor;"></span> Verifica...';
                } else {
                    badge.className = 'nodes-consensus-badge ok';
                    badge.innerHTML = '<span style="width:6px;height:6px;border-radius:50%;background:currentColor;"></span> In Consenso';
                }
            }
            const errorsEl = document.getElementById('consensus-errors');
            if (errorsEl) {
                const errorEvents = (data.events || []).filter(e => e.type === 'error');
                errorsEl.textContent = errorEvents.length;
                errorsEl.style.color = errorEvents.length > 0 ? '#ef4444' : 'var(--md-on-surface)';
            }
        } catch (e) {}
    }
    addEvent(event) {
        try {
            this._events.unshift(event);
            if (this._events.length > 20) {
                this._events = this._events.slice(0, 15);
            }
            this._renderTimeline();
        } catch (e) {}
    }
    setEvents(events) {
        try {
            this._events = events || [];
            this._renderTimeline();
        } catch (e) {}
    }
    _renderTimeline() {
        try {
            const timeline = document.getElementById('consensus-timeline');
            if (!timeline) return;
            if (this._events.length === 0) {
                timeline.innerHTML = `
                    <div style="text-align: center; color: var(--md-on-surface-variant); font-size: 0.72rem; padding: 0.5rem 0; opacity: 0.5;">
                        In attesa di eventi...
                    </div>
                `;
                return;
            }
            const displayed = this._events.slice(0, 8);
            timeline.innerHTML = displayed.map(ev => {
                try {
                    let dotColor = '#10b981';
                    if (ev.type === 'error') dotColor = '#ef4444';
                    else if (ev.type === 'warning') dotColor = '#f59e0b';
                    else if (ev.type === 'sync') dotColor = '#3b82f6';
                    const timeStr = this._formatEventTime(ev.timestamp);
                    const msgStr = this._escapeHtml(ev.message || '');
                    return `
                        <div class="nodes-event-item">
                            <span class="nodes-event-dot" style="background: ${dotColor};"></span>
                            <span>${msgStr}</span>
                            <span class="nodes-event-time">${timeStr}</span>
                        </div>
                    `;
                } catch (e) {
                    return '';
                }
            }).join('');
        } catch (e) {}
    }
    _formatEventTime(timestamp) {
        try {
            if (!timestamp) return '';
            const d = new Date(timestamp);
            return d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        } catch (e) {
            return '';
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
}
