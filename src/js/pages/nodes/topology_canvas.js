import { ParticleSystem } from './particle_system.js';
export class TopologyCanvas {
    constructor(canvasElement) {
        try {
            this._canvas = canvasElement;
            this._ctx = canvasElement.getContext('2d');
            this._particles = new ParticleSystem(this._ctx);
            this._nodes = [];
            this._positions = new Map();
            this._hoveredNode = null;
            this._animFrame = null;
            this._running = false;
            this._time = 0;
            this._onHoverCb = null;
            this._onClickCb = null;
            this._mouseX = 0;
            this._mouseY = 0;
            this._dpr = window.devicePixelRatio || 1;
            this._particleTimer = 0;
            this._gridOffset = 0;
            this._handleMouseMove = this._handleMouseMove.bind(this);
            this._handleMouseLeave = this._handleMouseLeave.bind(this);
            this._handleClick = this._handleClick.bind(this);
            this._handleResize = this.resize.bind(this);
            this._canvas.addEventListener('mousemove', this._handleMouseMove);
            this._canvas.addEventListener('mouseleave', this._handleMouseLeave);
            this._canvas.addEventListener('click', this._handleClick);
            window.addEventListener('resize', this._handleResize);
        } catch (e) {
            console.error('[TopologyCanvas] constructor error:', e);
        }
    }
    onNodeHover(cb) { this._onHoverCb = cb; }
    onNodeClick(cb) { this._onClickCb = cb; }
    setNodes(allNodes) {
        try {
            this._nodes = allNodes || [];
            this._computeLayout();
        } catch (e) {}
    }
    resize() {
        try {
            const rect = this._canvas.parentElement.getBoundingClientRect();
            this._canvas.width = rect.width * this._dpr;
            this._canvas.height = rect.height * this._dpr;
            this._canvas.style.width = rect.width + 'px';
            this._canvas.style.height = rect.height + 'px';
            this._ctx.setTransform(this._dpr, 0, 0, this._dpr, 0, 0);
            this._computeLayout();
        } catch (e) {}
    }
    start() {
        try {
            this._running = true;
            this.resize();
            this._loop();
        } catch (e) {}
    }
    stop() {
        try {
            this._running = false;
            if (this._animFrame) {
                cancelAnimationFrame(this._animFrame);
                this._animFrame = null;
            }
            this._canvas.removeEventListener('mousemove', this._handleMouseMove);
            this._canvas.removeEventListener('mouseleave', this._handleMouseLeave);
            this._canvas.removeEventListener('click', this._handleClick);
            window.removeEventListener('resize', this._handleResize);
        } catch (e) {}
    }
    _computeLayout() {
        try {
            this._positions.clear();
            const w = this._canvas.width / this._dpr;
            const h = this._canvas.height / this._dpr;
            const cx = w / 2;
            const cy = h / 2;
            if (this._nodes.length === 0) return;
            const localNode = this._nodes.find(n => n.isLocal);
            const peers = this._nodes.filter(n => !n.isLocal);
            if (localNode) {
                this._positions.set(localNode.nodeId || 'local', { x: cx, y: cy, node: localNode, radius: 22 });
            }
            if (peers.length === 0) return;
            const maxRadius = Math.min(w, h) * 0.38;
            const rings = [];
            if (peers.length <= 8) {
                rings.push({ nodes: peers, radius: maxRadius * 0.7 });
            } else if (peers.length <= 20) {
                const inner = peers.slice(0, 8);
                const outer = peers.slice(8);
                rings.push({ nodes: inner, radius: maxRadius * 0.5 });
                rings.push({ nodes: outer, radius: maxRadius * 0.85 });
            } else {
                const r1 = peers.slice(0, 8);
                const r2 = peers.slice(8, 22);
                const r3 = peers.slice(22);
                rings.push({ nodes: r1, radius: maxRadius * 0.35 });
                rings.push({ nodes: r2, radius: maxRadius * 0.6 });
                rings.push({ nodes: r3, radius: maxRadius * 0.88 });
            }
            for (const ring of rings) {
                try {
                    const count = ring.nodes.length;
                    const angleStep = (Math.PI * 2) / count;
                    const startAngle = -Math.PI / 2;
                    for (let i = 0; i < count; i++) {
                        const angle = startAngle + angleStep * i;
                        const x = cx + Math.cos(angle) * ring.radius;
                        const y = cy + Math.sin(angle) * ring.radius;
                        const nodeKey = ring.nodes[i].nodeId || ring.nodes[i].ip || `peer-${i}`;
                        this._positions.set(nodeKey, {
                            x, y,
                            node: ring.nodes[i],
                            radius: ring.radius < maxRadius * 0.5 ? 14 : 12
                        });
                    }
                } catch (e) {}
            }
        } catch (e) {}
    }
    _loop() {
        try {
            if (!this._running) return;
            this._time += 0.016;
            this._particleTimer += 0.016;
            this._update();
            this._draw();
            this._animFrame = requestAnimationFrame(() => this._loop());
        } catch (e) {
            if (this._running) {
                this._animFrame = requestAnimationFrame(() => this._loop());
            }
        }
    }
    _update() {
        try {
            this._particles.update();
            if (this._particleTimer > 0.8) {
                this._particleTimer = 0;
                this._emitDataParticles();
            }
        } catch (e) {}
    }
    _emitDataParticles() {
        try {
            const localPos = Array.from(this._positions.values()).find(p => p.node.isLocal);
            if (!localPos) return;
            for (const [, pos] of this._positions) {
                try {
                    if (pos.node.isLocal) continue;
                    if (Math.random() > 0.4) continue;
                    const color = pos.node.status === 'Online'
                        ? 'rgba(16, 185, 129, 0.8)'
                        : 'rgba(245, 158, 11, 0.8)';
                    if (Math.random() > 0.5) {
                        this._particles.emit(localPos.x, localPos.y, pos.x, pos.y, color, 1);
                    } else {
                        this._particles.emit(pos.x, pos.y, localPos.x, localPos.y, 'rgba(59, 130, 246, 0.8)', 1);
                    }
                } catch (e) {}
            }
        } catch (e) {}
    }
    _draw() {
        try {
            const ctx = this._ctx;
            const w = this._canvas.width / this._dpr;
            const h = this._canvas.height / this._dpr;
            ctx.clearRect(0, 0, w, h);
            this._drawGrid(w, h);
            this._drawConnections(w, h);
            this._particles.draw();
            this._drawNodes();
        } catch (e) {}
    }
    _drawGrid(w, h) {
        try {
            const ctx = this._ctx;
            const spacing = 30;
            ctx.strokeStyle = 'rgba(59, 130, 246, 0.04)';
            ctx.lineWidth = 0.5;
            for (let x = 0; x < w; x += spacing) {
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, h);
                ctx.stroke();
            }
            for (let y = 0; y < h; y += spacing) {
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(w, y);
                ctx.stroke();
            }
        } catch (e) {}
    }
    _drawConnections() {
        try {
            const ctx = this._ctx;
            const localPos = Array.from(this._positions.values()).find(p => p.node.isLocal);
            if (!localPos) return;
            for (const [, pos] of this._positions) {
                try {
                    if (pos.node.isLocal) continue;
                    const isHovered = this._hoveredNode && (
                        (this._hoveredNode.nodeId || this._hoveredNode.ip) ===
                        (pos.node.nodeId || pos.node.ip)
                    );
                    const grad = ctx.createLinearGradient(localPos.x, localPos.y, pos.x, pos.y);
                    if (isHovered) {
                        grad.addColorStop(0, 'rgba(59, 130, 246, 0.6)');
                        grad.addColorStop(1, 'rgba(139, 92, 246, 0.6)');
                        ctx.lineWidth = 2.5;
                    } else {
                        grad.addColorStop(0, 'rgba(59, 130, 246, 0.15)');
                        grad.addColorStop(1, 'rgba(139, 92, 246, 0.08)');
                        ctx.lineWidth = 1;
                    }
                    ctx.strokeStyle = grad;
                    ctx.beginPath();
                    ctx.moveTo(localPos.x, localPos.y);
                    ctx.lineTo(pos.x, pos.y);
                    ctx.stroke();
                    if (isHovered) {
                        ctx.save();
                        ctx.shadowColor = 'rgba(59, 130, 246, 0.3)';
                        ctx.shadowBlur = 8;
                        ctx.strokeStyle = grad;
                        ctx.beginPath();
                        ctx.moveTo(localPos.x, localPos.y);
                        ctx.lineTo(pos.x, pos.y);
                        ctx.stroke();
                        ctx.restore();
                    }
                } catch (e) {}
            }
        } catch (e) {}
    }
    _drawNodes() {
        try {
            const ctx = this._ctx;
            for (const [, pos] of this._positions) {
                try {
                    const isLocal = pos.node.isLocal;
                    const isHovered = this._hoveredNode && (
                        (this._hoveredNode.nodeId || this._hoveredNode.ip) ===
                        (pos.node.nodeId || pos.node.ip)
                    );
                    let baseColor, glowColor, labelColor;
                    if (isLocal) {
                        baseColor = '#3b82f6';
                        glowColor = 'rgba(59, 130, 246, 0.4)';
                        labelColor = '#93c5fd';
                    } else if (pos.node.status === 'Online') {
                        baseColor = '#10b981';
                        glowColor = 'rgba(16, 185, 129, 0.3)';
                        labelColor = '#6ee7b7';
                    } else {
                        baseColor = '#f59e0b';
                        glowColor = 'rgba(245, 158, 11, 0.3)';
                        labelColor = '#fcd34d';
                    }
                    const r = pos.radius;
                    const pulseR = r + Math.sin(this._time * 2 + pos.x * 0.01) * 2;
                    const hoverScale = isHovered ? 1.25 : 1;
                    ctx.save();
                    const outerGlow = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, pulseR * 2.5 * hoverScale);
                    outerGlow.addColorStop(0, glowColor);
                    outerGlow.addColorStop(1, 'transparent');
                    ctx.fillStyle = outerGlow;
                    ctx.beginPath();
                    ctx.arc(pos.x, pos.y, pulseR * 2.5 * hoverScale, 0, Math.PI * 2);
                    ctx.fill();
                    if (isLocal) {
                        const ringAlpha = 0.15 + Math.sin(this._time * 3) * 0.1;
                        ctx.strokeStyle = `rgba(59, 130, 246, ${ringAlpha})`;
                        ctx.lineWidth = 1.5;
                        ctx.beginPath();
                        ctx.arc(pos.x, pos.y, pulseR * 1.8 * hoverScale, 0, Math.PI * 2);
                        ctx.stroke();
                    }
                    const nodeGrad = ctx.createRadialGradient(
                        pos.x - r * 0.3, pos.y - r * 0.3, 0,
                        pos.x, pos.y, pulseR * hoverScale
                    );
                    nodeGrad.addColorStop(0, this._lighten(baseColor, 30));
                    nodeGrad.addColorStop(1, baseColor);
                    ctx.fillStyle = nodeGrad;
                    ctx.beginPath();
                    ctx.arc(pos.x, pos.y, pulseR * hoverScale, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.arc(pos.x, pos.y, pulseR * hoverScale, 0, Math.PI * 2);
                    ctx.stroke();
                    const label = isLocal ? 'LOCAL' : (pos.node.name || pos.node.ip || '').substring(0, 20);
                    ctx.fillStyle = labelColor;
                    ctx.font = `600 ${isLocal ? '9' : '8'}px Inter, sans-serif`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'top';
                    ctx.fillText(label, pos.x, pos.y + pulseR * hoverScale + 6);
                    if (!isLocal && pos.node.ip) {
                        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
                        ctx.font = '400 7px Inter, sans-serif';
                        ctx.fillText(pos.node.ip, pos.x, pos.y + pulseR * hoverScale + 18);
                    }
                    if (isLocal) {
                        ctx.fillStyle = 'white';
                        ctx.font = '700 12px "Material Symbols Rounded"';
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.fillText('hub', pos.x, pos.y);
                    }
                    ctx.restore();
                } catch (e) {}
            }
        } catch (e) {}
    }
    _lighten(hex, percent) {
        try {
            const num = parseInt(hex.replace('#', ''), 16);
            const r = Math.min(255, (num >> 16) + percent);
            const g = Math.min(255, ((num >> 8) & 0x00FF) + percent);
            const b = Math.min(255, (num & 0x0000FF) + percent);
            return `rgb(${r}, ${g}, ${b})`;
        } catch (e) {
            return hex;
        }
    }
    _handleMouseMove(e) {
        try {
            const rect = this._canvas.getBoundingClientRect();
            this._mouseX = e.clientX - rect.left;
            this._mouseY = e.clientY - rect.top;
            let found = null;
            for (const [, pos] of this._positions) {
                try {
                    const dx = this._mouseX - pos.x;
                    const dy = this._mouseY - pos.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    const hitRadius = pos.radius * 2;
                    if (dist <= hitRadius) {
                        found = pos.node;
                        break;
                    }
                } catch (e) {}
            }
            if (found !== this._hoveredNode) {
                this._hoveredNode = found;
                this._canvas.style.cursor = found ? 'pointer' : 'default';
            }
            if (this._onHoverCb) {
                if (found) {
                    this._onHoverCb(found, e.clientX, e.clientY);
                } else {
                    this._onHoverCb(null, 0, 0);
                }
            }
        } catch (e) {}
    }
    _handleMouseLeave() {
        try {
            this._hoveredNode = null;
            this._canvas.style.cursor = 'default';
            if (this._onHoverCb) this._onHoverCb(null, 0, 0);
        } catch (e) {}
    }
    _handleClick(e) {
        try {
            if (this._hoveredNode && this._onClickCb) {
                this._onClickCb(this._hoveredNode);
            }
        } catch (e) {}
    }
}
