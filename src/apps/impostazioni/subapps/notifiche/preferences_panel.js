export class PreferencesPanel {
    constructor(container, dataService) {
        this.container = container;
        this.dataService = dataService;
        
        // Nuove icone moderne per le categorie
        this.CATEGORY_ICONS = {
            security: 'gpp_maybe',
            sync: 'cloud_sync',
            system: 'memory',
            network: 'hub'
        };
    }

    render(preferences) {
        try {
            if (!preferences || preferences.length === 0) {
                this.container.innerHTML = `<div style="padding: 1.5rem; text-align: center; color: var(--md-on-surface-variant);">Nessuna preferenza disponibile.</div>`;
                return;
            }

            const html = preferences.map(p => {
                const icon = this.CATEGORY_ICONS[p.category] || 'notifications_active';
                return `
                    <div class="not-cat-row" data-category="${p.category}">
                        <div class="not-cat-icon"><span class="material-symbols-rounded">${icon}</span></div>
                        <div class="not-cat-info">
                            <div class="not-cat-title">${p.label}</div>
                            <div class="not-cat-desc">Ricevi avvisi relativi a ${p.label.toLowerCase()}</div>
                        </div>
                        <div class="not-cat-toggles">
                            <label class="not-toggle">In-App
                                <span class="not-switch"><input type="checkbox" data-field="in_app" ${p.in_app ? 'checked' : ''}><span class="not-switch-track"></span></span>
                            </label>
                            <label class="not-toggle">Email
                                <span class="not-switch"><input type="checkbox" data-field="email" ${p.email ? 'checked' : ''}><span class="not-switch-track"></span></span>
                            </label>
                            <label class="not-toggle">Suono
                                <span class="not-switch"><input type="checkbox" data-field="sound" ${p.sound ? 'checked' : ''}><span class="not-switch-track"></span></span>
                            </label>
                        </div>
                    </div>
                `;
            }).join('');

            this.container.innerHTML = html;
            this._attachEvents();
        } catch (e) {
            console.error('[PreferencesPanel] render error:', e);
            this.container.innerHTML = `<div style="color: var(--md-error); padding: 1rem;">Errore caricamento preferenze.</div>`;
        }
    }

    _attachEvents() {
        try {
            this.container.querySelectorAll('.not-cat-row').forEach(row => {
                const category = row.getAttribute('data-category');
                row.querySelectorAll('input[type="checkbox"]').forEach(input => {
                    input.addEventListener('change', async () => {
                        try {
                            const patch = {};
                            row.querySelectorAll('input[type="checkbox"]').forEach(i => { 
                                patch[i.getAttribute('data-field')] = i.checked; 
                            });
                            const r = await this.dataService.updatePreference(category, patch);
                            const { toast } = await import('../../../../js/utils.js');
                            if (r && r.success) {
                                toast('Preferenze aggiornate', 'success');
                            } else {
                                toast((r && r.error) || 'Errore salvataggio preferenze', 'error');
                            }
                        } catch (err) {
                            console.error('[PreferencesPanel] checkbox change error:', err);
                        }
                    });
                });
            });
        } catch (e) {
            console.error('[PreferencesPanel] _attachEvents error:', e);
        }
    }
}
