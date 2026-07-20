export class ParticleSystem {
    constructor(ctx) {
        try {
            this._ctx = ctx;
            this._particles = [];
            this._maxParticles = 200;
        } catch (e) {
            console.error('[ParticleSystem] constructor error:', e);
        }
    }
    emit(fromX, fromY, toX, toY, color, count) {
        try {
            for (let i = 0; i < (count || 1); i++) {
                if (this._particles.length >= this._maxParticles) break;
                this._particles.push({
                    x: fromX,
                    y: fromY,
                    toX,
                    toY,
                    progress: Math.random() * 0.3,
                    speed: 0.003 + Math.random() * 0.004,
                    color: color || 'rgba(59, 130, 246, 0.8)',
                    size: 1.5 + Math.random() * 1.5,
                    trail: []
                });
            }
        } catch (e) {}
    }
    update() {
        try {
            for (let i = this._particles.length - 1; i >= 0; i--) {
                try {
                    const p = this._particles[i];
                    p.progress += p.speed;
                    p.x = p.x + (p.toX - p.x) * p.speed * 3;
                    p.y = p.y + (p.toY - p.y) * p.speed * 3;
                    const t = p.progress;
                    p.x = (1 - t) * (p.trail.length > 0 ? p.trail[0].ox : p.x) + t * p.toX;
                    p.y = (1 - t) * (p.trail.length > 0 ? p.trail[0].oy : p.y) + t * p.toY;
                    if (p.trail.length === 0) {
                        p.trail.push({ ox: p.x, oy: p.y });
                    }
                    if (p.progress >= 1) {
                        this._particles.splice(i, 1);
                    }
                } catch (e) {
                    this._particles.splice(i, 1);
                }
            }
        } catch (e) {}
    }
    draw() {
        try {
            const ctx = this._ctx;
            for (const p of this._particles) {
                try {
                    const alpha = 1 - Math.abs(p.progress - 0.5) * 2;
                    const fromX = p.trail[0]?.ox || p.x;
                    const fromY = p.trail[0]?.oy || p.y;
                    const t = p.progress;
                    const cx = (1 - t) * fromX + t * p.toX;
                    const cy = (1 - t) * fromY + t * p.toY;
                    ctx.save();
                    ctx.globalAlpha = alpha * 0.9;
                    ctx.beginPath();
                    ctx.arc(cx, cy, p.size, 0, Math.PI * 2);
                    ctx.fillStyle = p.color;
                    ctx.fill();
                    ctx.globalAlpha = alpha * 0.3;
                    ctx.beginPath();
                    ctx.arc(cx, cy, p.size * 3, 0, Math.PI * 2);
                    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, p.size * 3);
                    glow.addColorStop(0, p.color);
                    glow.addColorStop(1, 'transparent');
                    ctx.fillStyle = glow;
                    ctx.fill();
                    ctx.restore();
                } catch (e) {}
            }
        } catch (e) {}
    }
    clear() {
        try {
            this._particles = [];
        } catch (e) {}
    }
    getCount() {
        try {
            return this._particles.length;
        } catch (e) {
            return 0;
        }
    }
}
