const EVENT_LABELS = { INSERT: 'Creazione', UPDATE: 'Modifica', DELETE: 'Eliminazione' };
const EVENT_TONES = { INSERT: 'secondary', UPDATE: 'primary', DELETE: 'error' };
export function mountAuditButton(container, { tableName, recordId, label }) {
    container.innerHTML = `
        <button type="button" class="btn-icon-action audit-trail-btn" title="Storico revisioni">
            <span class="material-symbols-rounded" style="font-size:1.1rem;">help</span>
        </button>
    `;
    container.querySelector('.audit-trail-btn').addEventListener('click', async (e) => {
        e.stopPropagation();
        await openAuditModal(tableName, recordId, label);
    });
}
async function openAuditModal(tableName, recordId, label) {
    let overlay = document.getElementById('audit-trail-modal');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'audit-trail-modal';
        overlay.style.cssText = 'display:none; position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(15,23,42,0.4); z-index:10001; align-items:center; justify-content:center; backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); opacity:0; transition: opacity 0.3s ease;';
        document.body.appendChild(overlay);
    }
    overlay.innerHTML = `
        <div class="card" style="width:min(92vw, 640px); max-height:82vh; overflow-y:auto; padding:2rem; background: rgba(255,255,255,0.97); border-radius:var(--shape-xl); transform:scale(0.95); transition: transform 0.3s cubic-bezier(0.34,1.56,0.64,1);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem; gap: 1rem;">
                <h3 style="margin:0; font-family: var(--font-heading); font-size:1.4rem; color:var(--md-on-surface); font-weight:700;">Storico Revisioni${label ? ' — ' + label : ''}</h3>
                <button type="button" id="audit-trail-close" class="btn btn-icon" style="background: var(--md-surface-variant); border:none; cursor:pointer; border-radius:var(--shape-full); width:36px; height:36px; flex-shrink:0; display:flex; justify-content:center; align-items:center;">
                    <span class="material-symbols-rounded">close</span>
                </button>
            </div>
            <div id="audit-trail-content"><div style="text-align:center; padding:2rem;"><span class="material-symbols-rounded" style="animation: spin 2s linear infinite; font-size:2rem;">sync</span></div></div>
        </div>
        <style>
            .audit-event-badge { font-size: 0.75rem; font-weight: 700; padding: 0.15rem 0.6rem; border-radius: var(--shape-full); text-transform: uppercase; letter-spacing: 0.03em; }
        </style>
    `;
    overlay.style.display = 'flex';
    requestAnimationFrame(() => {
        overlay.style.opacity = '1';
        overlay.querySelector('.card').style.transform = 'scale(1)';
    });
    const close = () => {
        overlay.style.opacity = '0';
        overlay.querySelector('.card').style.transform = 'scale(0.95)';
        setTimeout(() => { overlay.style.display = 'none'; }, 300);
    };
    overlay.querySelector('#audit-trail-close').addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    const content = overlay.querySelector('#audit-trail-content');
    try {
        const revisions = await window.electronAPI.anagrafica.audit.getHistory({ tableName, recordId });
        if (!revisions || revisions.length === 0) {
            content.innerHTML = '<p style="text-align:center; color:var(--md-on-surface-variant);">Nessuna revisione registrata.</p>';
            return;
        }
        content.innerHTML = revisions.map(rev => {
            const tone = EVENT_TONES[rev.eventType] || 'primary';
            return `
            <div class="scheda-record" style="border-left-color: var(--md-${tone});">
                <div class="scheda-record-title" style="display:flex; align-items:center; gap:0.5rem;">
                    <span class="audit-event-badge" style="background: var(--md-${tone}-container); color: var(--md-on-${tone}-container);">${EVENT_LABELS[rev.eventType] || rev.eventType}</span>
                    ${rev.actorName}
                </div>
                <div class="scheda-record-sub">${new Date(rev.timestamp).toLocaleString('it-IT')}</div>
                ${rev.changes.length > 0 ? `<div style="margin-top:0.6rem; display:flex; flex-direction:column; gap:0.3rem;">${rev.changes.map(c => `
                    <div style="font-size:0.85rem;"><b>${c.field}</b>: <span style="color:var(--md-on-error-container); background:var(--md-error-container); padding:0.1rem 0.4rem; border-radius:var(--shape-xs); text-decoration:line-through;">${c.oldValue === null || c.oldValue === '' ? '—' : c.oldValue}</span> → <span style="color:var(--md-on-success-container); background:var(--md-success-container); padding:0.1rem 0.4rem; border-radius:var(--shape-xs);">${c.newValue === null || c.newValue === '' ? '—' : c.newValue}</span></div>
                `).join('')}</div>` : ''}
            </div>
        `;
        }).join('');
    } catch (e) {
        content.innerHTML = `<p style="color:var(--md-error); text-align:center;">Errore: ${e.message}</p>`;
    }
}
