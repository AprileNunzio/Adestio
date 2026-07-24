export const STYLES = `
@keyframes nodesPulse {
    0%, 100% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.08); opacity: 0.7; }
}
@keyframes nodesGlow {
    0%, 100% { box-shadow: 0 0 15px rgba(59, 130, 246, 0.3); }
    50% { box-shadow: 0 0 35px rgba(59, 130, 246, 0.6); }
}
@keyframes nodesFadeIn {
    from { opacity: 0; transform: translateY(16px); }
    to { opacity: 1; transform: translateY(0); }
}
@keyframes nodesSlideIn {
    from { opacity: 0; transform: translateX(-8px); }
    to { opacity: 1; transform: translateX(0); }
}
@keyframes gaugeArc {
    from { stroke-dashoffset: 283; }
}
@keyframes shimmer {
    0% { background-position: -200% center; }
    100% { background-position: 200% center; }
}
.nodes-page {
    width: 100%;
    min-height: 100%;
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    animation: nodesFadeIn 0.4s ease-out;
    overflow-y: auto;
    overflow-x: hidden;
    scrollbar-width: thin;
}
.nodes-page::-webkit-scrollbar { width: 6px; }
.nodes-page::-webkit-scrollbar-track { background: transparent; }
.nodes-page::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.15); border-radius: 3px; }
.nodes-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-shrink: 0;
}
.nodes-header-title h1 {
    font-family: var(--font-heading);
    font-size: 1.8rem;
    font-weight: 800;
    background: linear-gradient(135deg, var(--md-primary), var(--md-secondary));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    margin: 0 0 0.1rem 0;
    letter-spacing: -0.03em;
    line-height: 1.2;
}
.nodes-header-title p {
    color: var(--md-on-surface-variant);
    font-size: 0.88rem;
    margin: 0;
    font-family: var(--font-body);
}
.nodes-header-actions {
    display: flex;
    gap: 0.6rem;
    align-items: center;
}
.nodes-action-btn {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.55rem 1.1rem;
    border-radius: 12px;
    font-weight: 600;
    font-size: 0.82rem;
    font-family: var(--font-body);
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    border: none;
    outline: none;
}
.nodes-action-btn .material-symbols-rounded { font-size: 1.1rem; }
.nodes-action-btn.primary {
    background: linear-gradient(135deg, var(--md-primary), var(--md-secondary));
    color: white;
    box-shadow: 0 4px 15px rgba(59, 130, 246, 0.25);
}
.nodes-action-btn.primary:hover {
    box-shadow: 0 6px 25px rgba(59, 130, 246, 0.45);
    transform: translateY(-1px);
}
.nodes-action-btn.secondary {
    background: var(--md-surface);
    color: var(--md-on-surface);
    border: 1px solid var(--md-outline);
}
.nodes-action-btn.secondary:hover {
    background: var(--md-surface-variant);
    box-shadow: 0 4px 12px rgba(0,0,0,0.06);
    transform: translateY(-1px);
}
.nodes-stats-row {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 0.7rem;
    flex-shrink: 0;
}
.nodes-stat-card {
    background: var(--md-surface);
    backdrop-filter: blur(20px);
    border: 1px solid rgba(255,255,255,0.5);
    border-radius: 16px;
    padding: 0.85rem 1rem;
    display: flex;
    align-items: center;
    gap: 0.85rem;
    box-shadow: 0 4px 20px rgba(0,0,0,0.04);
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    animation: nodesFadeIn 0.4s ease-out backwards;
}
.nodes-stat-card:nth-child(1) { animation-delay: 0.05s; }
.nodes-stat-card:nth-child(2) { animation-delay: 0.1s; }
.nodes-stat-card:nth-child(3) { animation-delay: 0.15s; }
.nodes-stat-card:nth-child(4) { animation-delay: 0.2s; }
.nodes-stat-card:nth-child(5) { animation-delay: 0.25s; }
.nodes-stat-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 30px rgba(0,0,0,0.1);
}
.nodes-stat-icon {
    width: 42px;
    height: 42px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}
.nodes-stat-icon .material-symbols-rounded {
    font-size: 1.3rem;
    color: white;
}
.nodes-stat-info { display: flex; flex-direction: column; min-width: 0; }
.nodes-stat-label {
    font-size: 0.68rem;
    color: var(--md-on-surface-variant);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.nodes-stat-value {
    font-size: 1.4rem;
    font-weight: 800;
    color: var(--md-on-surface);
    font-family: var(--font-heading);
    line-height: 1.2;
}
.nodes-main-grid {
    display: grid;
    grid-template-columns: 1.5fr 1fr;
    gap: 1rem;
    min-height: 360px;
    flex-shrink: 0;
}
.nodes-topology-card {
    background: var(--md-surface);
    backdrop-filter: blur(20px);
    border: 1px solid rgba(255,255,255,0.5);
    border-radius: 20px;
    overflow: hidden;
    box-shadow: 0 4px 20px rgba(0,0,0,0.04);
    display: flex;
    flex-direction: column;
    animation: nodesFadeIn 0.5s ease-out 0.1s backwards;
}
.nodes-topology-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.7rem 1.1rem;
    border-bottom: 1px solid var(--md-outline);
}
.nodes-topology-header-left {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-weight: 700;
    font-size: 0.85rem;
    color: var(--md-on-surface);
}
.nodes-topology-header-left .material-symbols-rounded {
    font-size: 1.15rem;
    color: var(--md-primary);
}
.nodes-topology-count {
    font-size: 0.75rem;
    color: var(--md-on-surface-variant);
    background: var(--md-surface-variant);
    padding: 0.2rem 0.65rem;
    border-radius: 20px;
    font-weight: 600;
}
.nodes-topology-canvas-wrap {
    flex: 1;
    position: relative;
    background: linear-gradient(145deg, #070b16 0%, #0c1425 50%, #08101e 100%);
    min-height: 280px;
}
.nodes-topology-canvas-wrap canvas {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    display: block;
    cursor: default;
}
.nodes-info-section {
    display: flex;
    flex-direction: column;
    gap: 1rem;
}
.nodes-health-row {
    display: grid;
    grid-template-columns: 0.8fr 1.2fr;
    gap: 1rem;
}
.nodes-panel {
    background: var(--md-surface);
    backdrop-filter: blur(20px);
    border: 1px solid rgba(255,255,255,0.5);
    border-radius: 20px;
    overflow: hidden;
    box-shadow: 0 4px 20px rgba(0,0,0,0.04);
    display: flex;
    flex-direction: column;
    animation: nodesFadeIn 0.5s ease-out 0.15s backwards;
}
.nodes-panel-header {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    padding: 0.7rem 1.1rem;
    border-bottom: 1px solid var(--md-outline);
    font-weight: 700;
    font-size: 0.82rem;
    color: var(--md-on-surface);
}
.nodes-panel-header .material-symbols-rounded {
    font-size: 1.05rem;
    color: var(--md-primary);
}
.nodes-panel-body {
    padding: 0.85rem 1.1rem;
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
}
.nodes-health-gauge-wrap {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 1;
    padding: 0.3rem;
}
.nodes-metric-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.35rem 0;
    border-bottom: 1px solid rgba(0,0,0,0.03);
}
.nodes-metric-row:last-child { border-bottom: none; }
.nodes-metric-label {
    font-size: 0.75rem;
    color: var(--md-on-surface-variant);
    font-weight: 500;
}
.nodes-metric-value {
    font-size: 0.8rem;
    font-weight: 700;
    color: var(--md-on-surface);
}
.nodes-metric-value.mono {
    font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
    font-size: 0.72rem;
    max-width: 130px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.nodes-consensus-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.25rem 0.7rem;
    border-radius: 20px;
    font-size: 0.72rem;
    font-weight: 700;
}
.nodes-consensus-badge.ok { background: rgba(16, 185, 129, 0.1); color: #10b981; }
.nodes-consensus-badge.warn { background: rgba(245, 158, 11, 0.1); color: #f59e0b; }
.nodes-consensus-badge.error { background: rgba(239, 68, 68, 0.1); color: #ef4444; }
.nodes-event-timeline {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    max-height: 100px;
    overflow-y: auto;
    scrollbar-width: thin;
}
.nodes-event-item {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.7rem;
    color: var(--md-on-surface-variant);
    padding: 0.2rem 0;
    animation: nodesSlideIn 0.25s ease-out;
}
.nodes-event-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    flex-shrink: 0;
}
.nodes-event-time {
    font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
    font-size: 0.65rem;
    opacity: 0.6;
    margin-left: auto;
    flex-shrink: 0;
}
.nodes-table-section {
    flex-shrink: 0;
    animation: nodesFadeIn 0.5s ease-out 0.25s backwards;
}
.nodes-table-card {
    background: var(--md-surface);
    backdrop-filter: blur(20px);
    border: 1px solid rgba(255,255,255,0.5);
    border-radius: 20px;
    overflow: hidden;
    box-shadow: 0 4px 20px rgba(0,0,0,0.04);
}
.nodes-table-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.7rem 1.1rem;
    border-bottom: 1px solid var(--md-outline);
}
.nodes-table-header-left {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-weight: 700;
    font-size: 0.85rem;
    color: var(--md-on-surface);
}
.nodes-table-header-left .material-symbols-rounded {
    font-size: 1.1rem;
    color: var(--md-primary);
}
.nodes-table-wrap { overflow-x: auto; }
.nodes-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.78rem;
}
.nodes-table thead th {
    padding: 0.6rem 0.9rem;
    text-align: left;
    font-weight: 700;
    font-size: 0.68rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--md-on-surface-variant);
    background: var(--md-surface-variant);
    cursor: pointer;
    user-select: none;
    white-space: nowrap;
    transition: background 0.15s;
}
.nodes-table thead th:hover { background: rgba(59, 130, 246, 0.06); }
.nodes-table thead th .sort-icon {
    font-size: 0.8rem;
    vertical-align: middle;
    margin-left: 0.15rem;
    opacity: 0.3;
}
.nodes-table thead th.sorted .sort-icon { opacity: 1; color: var(--md-primary); }
.nodes-table tbody tr {
    border-bottom: 1px solid rgba(0,0,0,0.03);
    transition: background 0.15s;
}
.nodes-table tbody tr:hover { background: rgba(59, 130, 246, 0.03); }
.nodes-table tbody tr.local-node { background: rgba(59, 130, 246, 0.04); }
.nodes-table tbody td {
    padding: 0.55rem 0.9rem;
    color: var(--md-on-surface);
    white-space: nowrap;
}
.nodes-table .td-mono {
    font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
    font-size: 0.73rem;
}
.nodes-table .td-status {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.15rem 0.55rem;
    border-radius: 10px;
    font-size: 0.68rem;
    font-weight: 700;
}
.nodes-table .td-status.online { background: rgba(16, 185, 129, 0.1); color: #10b981; }
.nodes-table .td-status.syncing { background: rgba(245, 158, 11, 0.1); color: #f59e0b; }
.nodes-table .td-status.offline { background: rgba(239, 68, 68, 0.1); color: #ef4444; }
.nodes-table .td-reliability {
    display: flex;
    align-items: center;
    gap: 0.4rem;
}
.nodes-reliability-bar {
    width: 50px;
    height: 3px;
    background: rgba(0,0,0,0.06);
    border-radius: 2px;
    overflow: hidden;
}
.nodes-reliability-fill {
    height: 100%;
    border-radius: 2px;
    transition: width 0.4s ease;
}
.node-tooltip {
    position: fixed;
    z-index: 10000;
    pointer-events: none;
    opacity: 0;
    transform: translateY(6px) scale(0.97);
    transition: all 0.18s cubic-bezier(0.4, 0, 0.2, 1);
    max-width: 300px;
}
.node-tooltip.visible {
    opacity: 1;
    transform: translateY(0) scale(1);
}
.node-tooltip-inner {
    background: rgba(10, 15, 30, 0.94);
    backdrop-filter: blur(24px);
    border: 1px solid rgba(59, 130, 246, 0.2);
    border-radius: 14px;
    padding: 0.9rem 1.1rem;
    color: #e2e8f0;
    box-shadow: 0 16px 48px rgba(0,0,0,0.45), 0 0 30px rgba(59, 130, 246, 0.08);
}
.node-tooltip-name {
    font-weight: 700;
    font-size: 0.9rem;
    color: white;
    margin-bottom: 0.05rem;
    display: flex;
    align-items: center;
    gap: 0.4rem;
}
.node-tooltip-ip {
    font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
    font-size: 0.73rem;
    color: rgba(148, 163, 184, 0.7);
    margin-bottom: 0.6rem;
}
.node-tooltip-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.4rem 0.9rem;
}
.node-tooltip-field { display: flex; flex-direction: column; gap: 0.05rem; }
.node-tooltip-field-label {
    font-size: 0.6rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: rgba(148, 163, 184, 0.5);
    font-weight: 600;
}
.node-tooltip-field-value {
    font-size: 0.78rem;
    font-weight: 600;
    color: #e2e8f0;
}
.node-tooltip-field-value.mono {
    font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
    font-size: 0.7rem;
}
.node-tooltip-status-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    display: inline-block;
}
.node-tooltip-divider {
    height: 1px;
    background: rgba(59, 130, 246, 0.12);
    margin: 0.45rem 0;
}
.nodes-progress-bar {
    width: 100%;
    height: 3px;
    background: rgba(0,0,0,0.05);
    border-radius: 2px;
    overflow: hidden;
}
.nodes-progress-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--md-primary), var(--md-secondary));
    border-radius: 2px;
    transition: width 0.4s ease;
}
@media (max-width: 1200px) {
    .nodes-stats-row {
        grid-template-columns: repeat(3, 1fr);
    }
}
@media (max-width: 900px) {
    .nodes-stats-row {
        grid-template-columns: repeat(2, 1fr);
    }
    .nodes-main-grid {
        grid-template-columns: 1fr;
        min-height: auto;
    }
    .nodes-health-row {
        grid-template-columns: 1fr;
    }
}
@media (max-width: 600px) {
    .nodes-stats-row {
        grid-template-columns: 1fr;
    }
    .nodes-header {
        flex-direction: column;
        align-items: flex-start;
        gap: 1rem;
    }
    .nodes-header-actions {
        width: 100%;
        justify-content: space-between;
    }
}
`;
