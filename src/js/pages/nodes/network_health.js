export class NetworkHealthGauge {
    constructor(container) {
        try {
            this._container = container;
            this._currentScore = 0;
            this._targetScore = 0;
            this._animFrame = null;
            this._init();
        } catch (e) {
            console.error('[NetworkHealthGauge] constructor error:', e);
        }
    }

    _init() {
        try {
            this._container.innerHTML = `
                <div class="nodes-health-gauge-wrap">
                    <svg viewBox="0 0 120 120" width="130" height="130">
                        <defs>
                            <linearGradient id="gauge-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" style="stop-color:#ef4444"/>
                                <stop offset="50%" style="stop-color:#f59e0b"/>
                                <stop offset="100%" style="stop-color:#10b981"/>
                            </linearGradient>
                        </defs>
                        <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(0,0,0,0.05)" stroke-width="8" stroke-linecap="round"
                            stroke-dasharray="236 78" transform="rotate(135 60 60)"/>
                        <circle id="gauge-arc" cx="60" cy="60" r="50" fill="none" stroke="url(#gauge-grad)" stroke-width="8" stroke-linecap="round"
                            stroke-dasharray="0 314" transform="rotate(135 60 60)" style="transition: stroke-dasharray 0.8s cubic-bezier(0.4, 0, 0.2, 1);"/>
                        <text id="gauge-text" x="60" y="56" text-anchor="middle" dominant-baseline="middle"
                            font-size="22" font-weight="800" fill="var(--md-on-surface)" font-family="var(--font-heading)">0</text>
                        <text x="60" y="72" text-anchor="middle" dominant-baseline="middle"
                            font-size="8" fill="var(--md-on-surface-variant)" font-family="var(--font-body)" font-weight="600">SALUTE RETE</text>
                    </svg>
                </div>
            `;
        } catch (e) {}
    }

    update(score) {
        try {
            this._targetScore = Math.max(0, Math.min(100, Math.round(score)));
            this._animate();
        } catch (e) {}
    }

    _animate() {
        try {
            if (this._animFrame) cancelAnimationFrame(this._animFrame);

            const step = () => {
                try {
                    const diff = this._targetScore - this._currentScore;
                    if (Math.abs(diff) < 1) {
                        this._currentScore = this._targetScore;
                        this._render();
                        return;
                    }
                    this._currentScore += diff * 0.08;
                    this._render();
                    this._animFrame = requestAnimationFrame(step);
                } catch (e) {}
            };
            step();
        } catch (e) {}
    }

    _render() {
        try {
            const arc = this._container.querySelector('#gauge-arc');
            const text = this._container.querySelector('#gauge-text');
            if (!arc || !text) return;

            const maxArc = 236;
            const arcLength = (this._currentScore / 100) * maxArc;
            arc.setAttribute('stroke-dasharray', `${arcLength} ${314 - arcLength}`);
            text.textContent = Math.round(this._currentScore);

            let color = '#10b981';
            if (this._currentScore < 30) color = '#ef4444';
            else if (this._currentScore < 60) color = '#f59e0b';
            else if (this._currentScore < 80) color = '#3b82f6';
            text.setAttribute('fill', color);
        } catch (e) {}
    }

    destroy() {
        try {
            if (this._animFrame) cancelAnimationFrame(this._animFrame);
            this._container.innerHTML = '';
        } catch (e) {}
    }
}
