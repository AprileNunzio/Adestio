export const STYLES = `
@keyframes notFadeIn {
    from { opacity: 0; transform: translateY(16px); }
    to { opacity: 1; transform: translateY(0); }
}
.not-page {
    width: 100%;
    min-height: 100%;
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    animation: notFadeIn 0.4s ease-out;
    overflow-y: auto;
    overflow-x: hidden;
    scrollbar-width: thin;
}
.not-page::-webkit-scrollbar { width: 6px; }
.not-page::-webkit-scrollbar-track { background: transparent; }
.not-page::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.15); border-radius: 3px; }
.not-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-shrink: 0;
}
.not-header-title h1 {
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
.not-header-title p {
    color: var(--md-on-surface-variant);
    font-size: 0.88rem;
    margin: 0;
    font-family: var(--font-body);
}
.not-header-actions {
    display: flex;
    gap: 0.6rem;
    align-items: center;
}
.not-action-btn {
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
.not-action-btn .material-symbols-rounded { font-size: 1.1rem; }
.not-action-btn.secondary {
    background: var(--md-surface);
    color: var(--md-on-surface);
    border: 1px solid var(--md-outline);
}
.not-action-btn.secondary:hover {
    background: var(--md-surface-variant);
    box-shadow: 0 4px 12px rgba(0,0,0,0.06);
    transform: translateY(-1px);
}
.not-stats-row {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 0.7rem;
    flex-shrink: 0;
}
.not-stat-card {
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
    animation: notFadeIn 0.4s ease-out backwards;
}
.not-stat-card:nth-child(1) { animation-delay: 0.05s; }
.not-stat-card:nth-child(2) { animation-delay: 0.1s; }
.not-stat-card:nth-child(3) { animation-delay: 0.15s; }
.not-stat-card:nth-child(4) { animation-delay: 0.2s; }
.not-stat-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 30px rgba(0,0,0,0.1);
}
.not-stat-icon {
    width: 42px;
    height: 42px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}
.not-stat-icon .material-symbols-rounded {
    font-size: 1.3rem;
    color: white;
}
.not-stat-info { display: flex; flex-direction: column; min-width: 0; }
.not-stat-label {
    font-size: 0.68rem;
    color: var(--md-on-surface-variant);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.not-stat-value {
    font-size: 1.4rem;
    font-weight: 800;
    color: var(--md-on-surface);
    font-family: var(--font-heading);
    line-height: 1.2;
}
.not-main-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1rem;
    flex-shrink: 0;
}
/* Preferences Panel */
.not-panel {
    background: var(--md-surface);
    backdrop-filter: blur(20px);
    border: 1px solid rgba(255,255,255,0.5);
    border-radius: 20px;
    overflow: hidden;
    box-shadow: 0 4px 20px rgba(0,0,0,0.04);
    display: flex;
    flex-direction: column;
    animation: notFadeIn 0.5s ease-out 0.15s backwards;
}
.not-panel-header {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    padding: 0.7rem 1.1rem;
    border-bottom: 1px solid var(--md-outline);
    font-weight: 700;
    font-size: 0.85rem;
    color: var(--md-on-surface);
}
.not-panel-header .material-symbols-rounded {
    font-size: 1.15rem;
    color: var(--md-primary);
}
.not-prefs-list {
    display: grid;
    /* min 420px: card spaziose che vanno a capo su piu righe quando serve
       (2 colonne su schermi larghi, 1 su schermi stretti) */
    grid-template-columns: repeat(auto-fit, minmax(420px, 1fr));
    gap: 1rem;
    padding: 1rem;
}
.not-cat-row {
    display: flex;
    align-items: center;
    gap: 1rem;
    background: var(--md-surface-variant);
    border: 1px solid var(--md-outline-variant);
    border-radius: 14px;
    padding: 1rem;
    transition: transform 0.2s;
}
.not-cat-row:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0,0,0,0.05);
}
.not-cat-icon {
    width: 42px;
    height: 42px;
    border-radius: 12px;
    background: rgba(var(--md-primary-rgb, 59,130,246), 0.12);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--md-primary);
    flex-shrink: 0;
}
/* min-width:0 permette al testo di comprimersi: assorbe lo spazio mancante
   così i toggle a destra restano sempre visibili invece di venire tagliati */
.not-cat-info { flex: 1; min-width: 0; }
.not-cat-title {
    font-weight: 700;
    color: var(--md-on-surface);
    font-size: 0.9rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.not-cat-desc {
    font-size: 0.75rem;
    color: var(--md-on-surface-variant);
    line-height: 1.3;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
}
/* flex-shrink:0 sui toggle: hanno priorità, non si comprimono mai */
.not-cat-toggles { display: flex; gap: 0.85rem; flex-shrink: 0; }
.not-toggle {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.3rem;
    font-size: 0.65rem;
    font-weight: 700;
    color: var(--md-on-surface-variant);
    text-transform: uppercase;
    letter-spacing: 0.03em;
}
.not-switch { position: relative; width: 36px; height: 20px; }
.not-switch input { opacity: 0; width: 0; height: 0; }
.not-switch-track {
    position: absolute;
    inset: 0;
    background: var(--md-outline-variant);
    border-radius: 999px;
    cursor: pointer;
    transition: 0.2s;
}
.not-switch-track::before {
    content: '';
    position: absolute;
    width: 14px;
    height: 14px;
    left: 3px;
    top: 3px;
    background: white;
    border-radius: 50%;
    transition: 0.2s;
    box-shadow: 0 1px 3px rgba(0,0,0,0.3);
}
.not-switch input:checked + .not-switch-track { background: var(--md-primary); }
.not-switch input:checked + .not-switch-track::before { transform: translateX(16px); }
/* History Table Section */
.not-table-section {
    flex-shrink: 0;
    animation: notFadeIn 0.5s ease-out 0.25s backwards;
}
.not-table-card {
    background: var(--md-surface);
    backdrop-filter: blur(20px);
    border: 1px solid rgba(255,255,255,0.5);
    border-radius: 20px;
    overflow: hidden;
    box-shadow: 0 4px 20px rgba(0,0,0,0.04);
}
.not-table-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.7rem 1.1rem;
    border-bottom: 1px solid var(--md-outline);
}
.not-table-header-left {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-weight: 700;
    font-size: 0.85rem;
    color: var(--md-on-surface);
}
.not-table-header-left .material-symbols-rounded {
    font-size: 1.1rem;
    color: var(--md-primary);
}
.not-table-filters {
    display: flex;
    gap: 1rem;
    align-items: center;
}
.not-filter-select {
    padding: 0.4rem 0.8rem;
    border-radius: 8px;
    border: 1px solid var(--md-outline);
    background: var(--md-surface-variant);
    color: var(--md-on-surface);
    font-size: 0.8rem;
    outline: none;
    cursor: pointer;
}
.not-toggle-inline {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.8rem;
    color: var(--md-on-surface-variant);
    cursor: pointer;
    font-weight: 600;
}
.not-table-wrap { overflow-x: auto; min-height: 200px; }
.not-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.82rem;
}
.not-table thead th {
    padding: 0.6rem 0.9rem;
    text-align: left;
    font-weight: 700;
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--md-on-surface-variant);
    background: var(--md-surface-variant);
    user-select: none;
    white-space: nowrap;
}
.not-table tbody tr {
    border-bottom: 1px solid rgba(0,0,0,0.03);
    transition: background 0.15s;
}
.not-table tbody tr:hover { background: rgba(59, 130, 246, 0.03); }
.not-table tbody tr.unread { background: rgba(59, 130, 246, 0.06); }
.not-table tbody td {
    padding: 0.8rem 0.9rem;
    color: var(--md-on-surface);
    vertical-align: middle;
}
.not-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.2rem 0.6rem;
    border-radius: 12px;
    font-size: 0.7rem;
    font-weight: 700;
    white-space: nowrap;
}
.not-badge.info { background: rgba(59, 130, 246, 0.1); color: var(--md-primary); }
.not-badge.warning { background: rgba(245, 158, 11, 0.1); color: #f59e0b; }
.not-badge.error { background: rgba(239, 68, 68, 0.1); color: #ef4444; }
.not-item-content {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
}
.not-item-title {
    font-weight: 700;
    color: var(--md-on-surface);
}
.not-item-msg {
    font-size: 0.78rem;
    color: var(--md-on-surface-variant);
    line-height: 1.4;
}
.not-action-link {
    font-size: 0.75rem;
    color: var(--md-primary);
    text-decoration: none;
    font-weight: 600;
    margin-top: 0.3rem;
    display: inline-block;
}
.not-action-link:hover { text-decoration: underline; }
.not-btn-mark {
    background: transparent;
    border: 1px solid var(--md-outline);
    border-radius: 6px;
    color: var(--md-on-surface);
    cursor: pointer;
    padding: 0.3rem 0.6rem;
    font-size: 0.7rem;
    font-weight: 600;
    transition: all 0.2s;
}
.not-btn-mark:hover {
    background: var(--md-primary);
    color: white;
    border-color: var(--md-primary);
}
.not-empty {
    text-align: center;
    padding: 4rem 1rem;
    color: var(--md-on-surface-variant);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
}
@media (max-width: 900px) {
    .not-stats-row { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 600px) {
    .not-stats-row { grid-template-columns: 1fr; }
    .not-header { flex-direction: column; align-items: flex-start; gap: 1rem; }
    .not-header-actions { width: 100%; justify-content: flex-end; }
    .not-prefs-list { grid-template-columns: 1fr; }
}
`;
