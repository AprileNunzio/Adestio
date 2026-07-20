import { dtFormat } from '../utils.js';

const EVENT_LABELS = {
    login_success: 'Accesso riuscito',
    login_failed: 'Accesso fallito',
    '2fa_failed': 'Verifica 2FA fallita',
    '2fa_admin_reset': 'Reset 2FA (admin)',
    logout: 'Disconnessione'
};
const EVENT_ICONS = {
    login_success: 'login',
    login_failed: 'block',
    '2fa_failed': 'gpp_bad',
    '2fa_admin_reset': 'restart_alt',
    logout: 'logout'
};

export default {
    render: async () => {
        const currentUserId = sessionStorage.getItem('currentUserId');
        if (!currentUserId) return `<div class="error-msg">Errore: Utente non identificato</div>`;

        let logs = [];
        try {
            const res = await window.electronAPI.getAccessLogs(currentUserId);
            if (res.success) {
                logs = res.logs;
            }
        } catch (e) {
            console.error(e);
        }

        const successCount = logs.filter(l => (l.event_type || 'login_success') === 'login_success').length;
        const failedCount = logs.filter(l => l.success === 0 || l.success === false).length;
        const distinctDevices = new Set(logs.map(l => l.device_info).filter(Boolean)).size;

        return `
            <div class="page-container fade-in-up" style="max-width: 1000px; margin: 0 auto;">
                <div class="page-header" style="margin-bottom: 1.5rem; border-bottom: 1px solid rgba(var(--md-primary-rgb), 0.1); padding-bottom: 1.5rem;">
                    <div style="display: flex; align-items: center; gap: 1rem;">
                        <div style="background: rgba(var(--md-primary-rgb), 0.1); padding: 1rem; border-radius: 16px; display: flex; align-items: center; justify-content: center;">
                            <span class="material-symbols-rounded" style="font-size: 2.5rem; color: var(--md-primary);">manage_search</span>
                        </div>
                        <div>
                            <h2 class="page-title" style="margin: 0; font-size: 2.2rem; font-weight: 700; color: var(--md-on-surface);">Registro Accessi</h2>
                            <p class="page-subtitle" style="margin: 0.5rem 0 0 0; font-size: 1.1rem; color: var(--md-on-surface-variant);">Storico dettagliato degli ultimi 50 eventi di autenticazione sul tuo account.</p>
                        </div>
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
                    <div style="background: var(--md-surface-variant); border: 1px solid var(--md-outline-variant); border-radius: 16px; padding: 1rem 1.3rem;">
                        <div style="font-size: 1.7rem; font-weight: 800; color: var(--md-success);">${successCount}</div>
                        <div style="font-size: 0.82rem; color: var(--md-on-surface-variant); font-weight: 600;">Accessi riusciti</div>
                    </div>
                    <div style="background: var(--md-surface-variant); border: 1px solid var(--md-outline-variant); border-radius: 16px; padding: 1rem 1.3rem;">
                        <div style="font-size: 1.7rem; font-weight: 800; color: var(--md-error);">${failedCount}</div>
                        <div style="font-size: 0.82rem; color: var(--md-on-surface-variant); font-weight: 600;">Tentativi falliti</div>
                    </div>
                    <div style="background: var(--md-surface-variant); border: 1px solid var(--md-outline-variant); border-radius: 16px; padding: 1rem 1.3rem;">
                        <div style="font-size: 1.7rem; font-weight: 800; color: var(--md-primary);">${distinctDevices}</div>
                        <div style="font-size: 0.82rem; color: var(--md-on-surface-variant); font-weight: 600;">Dispositivi distinti</div>
                    </div>
                </div>

                <div class="card p-0 glass-panel" style="overflow: hidden; border-radius: 20px; border: 1px solid rgba(var(--md-primary-rgb), 0.15); box-shadow: 0 10px 30px rgba(0,0,0,0.05); background: var(--md-surface);">
                    ${logs.length === 0 ? `
                        <div style="padding: 5rem 2rem; text-align: center; color: var(--md-on-surface-variant);">
                            <span class="material-symbols-rounded" style="font-size: 4rem; opacity: 0.3; margin-bottom: 1rem; color: var(--md-primary);">history_toggle_off</span>
                            <h3 style="margin: 0; font-size: 1.5rem; font-weight: 500; color: var(--md-on-surface);">Nessun Accesso Rilevato</h3>
                            <p style="margin-top: 0.5rem;">Non sono stati registrati accessi nel database locale per il tuo utente.</p>
                        </div>
                    ` : `
                        <div class="table-responsive">
                            <table style="width: 100%; border-collapse: separate; border-spacing: 0;">
                                <thead>
                                    <tr style="background: linear-gradient(90deg, rgba(var(--md-primary-rgb), 0.08), rgba(var(--md-primary-rgb), 0.02));">
                                        <th style="padding: 1.1rem 1.3rem; text-align: left; font-weight: 600; color: var(--md-primary); border-bottom: 2px solid rgba(var(--md-primary-rgb), 0.1);">
                                            <div style="display: flex; align-items: center; gap: 0.5rem;"><span class="material-symbols-rounded" style="font-size: 1.2rem;">calendar_clock</span> Data e Ora</div>
                                        </th>
                                        <th style="padding: 1.1rem 1.3rem; text-align: left; font-weight: 600; color: var(--md-primary); border-bottom: 2px solid rgba(var(--md-primary-rgb), 0.1);">
                                            <div style="display: flex; align-items: center; gap: 0.5rem;"><span class="material-symbols-rounded" style="font-size: 1.2rem;">event</span> Evento</div>
                                        </th>
                                        <th style="padding: 1.1rem 1.3rem; text-align: left; font-weight: 600; color: var(--md-primary); border-bottom: 2px solid rgba(var(--md-primary-rgb), 0.1);">
                                            <div style="display: flex; align-items: center; gap: 0.5rem;"><span class="material-symbols-rounded" style="font-size: 1.2rem;">key</span> Metodo</div>
                                        </th>
                                        <th style="padding: 1.1rem 1.3rem; text-align: left; font-weight: 600; color: var(--md-primary); border-bottom: 2px solid rgba(var(--md-primary-rgb), 0.1);">
                                            <div style="display: flex; align-items: center; gap: 0.5rem;"><span class="material-symbols-rounded" style="font-size: 1.2rem;">hub</span> Nodo di Rete</div>
                                        </th>
                                        <th style="padding: 1.1rem 1.3rem; text-align: left; font-weight: 600; color: var(--md-primary); border-bottom: 2px solid rgba(var(--md-primary-rgb), 0.1);">
                                            <div style="display: flex; align-items: center; gap: 0.5rem;"><span class="material-symbols-rounded" style="font-size: 1.2rem;">public</span> Indirizzo IP</div>
                                        </th>
                                        <th style="padding: 1.1rem 1.3rem; text-align: left; font-weight: 600; color: var(--md-primary); border-bottom: 2px solid rgba(var(--md-primary-rgb), 0.1);">
                                            <div style="display: flex; align-items: center; gap: 0.5rem;"><span class="material-symbols-rounded" style="font-size: 1.2rem;">devices</span> Dispositivo</div>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${logs.map((log, i) => {
                                        const eventType = log.event_type || 'login_success';
                                        const isFailure = log.success === 0 || log.success === false;
                                        return `
                                        <tr class="log-row" style="transition: all 0.2s ease; border-bottom: 1px solid var(--md-outline-variant); animation: slideIn 0.3s ease forwards; animation-delay: ${i * 0.05}s; opacity: 0; background: ${i % 2 === 0 ? 'var(--md-surface)' : 'rgba(var(--md-primary-rgb), 0.02)'};">
                                            <td style="padding: 1.1rem 1.3rem; border-bottom: 1px solid rgba(100,100,100,0.1);">
                                                <div style="display: flex; flex-direction: column;">
                                                    <strong style="color: var(--md-on-surface); font-size: 1.02rem;">${dtFormat(log.timestamp).split(',')[0]}</strong>
                                                    <span style="color: var(--md-on-surface-variant); font-size: 0.88rem;">${dtFormat(log.timestamp).split(',')[1]}</span>
                                                </div>
                                            </td>
                                            <td style="padding: 1.1rem 1.3rem; border-bottom: 1px solid rgba(100,100,100,0.1);">
                                                <div style="display: inline-flex; align-items: center; gap: 0.5rem; background: ${isFailure ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)'}; color: ${isFailure ? 'var(--md-error)' : 'var(--md-success)'}; padding: 0.35rem 0.7rem; border-radius: 999px; font-weight: 600; font-size: 0.82rem;">
                                                    <span class="material-symbols-rounded" style="font-size: 1.05rem;">${EVENT_ICONS[eventType] || 'event'}</span>
                                                    ${EVENT_LABELS[eventType] || eventType}
                                                </div>
                                            </td>
                                            <td style="padding: 1.1rem 1.3rem; border-bottom: 1px solid rgba(100,100,100,0.1); color: var(--md-on-surface-variant); font-size: 0.9rem;">
                                                ${log.auth_method || '—'}
                                            </td>
                                            <td style="padding: 1.1rem 1.3rem; border-bottom: 1px solid rgba(100,100,100,0.1);">
                                                <div style="display: inline-flex; align-items: center; gap: 0.6rem; background: rgba(var(--md-primary-rgb), 0.08); padding: 0.4rem 0.8rem; border-radius: 20px; font-weight: 500; color: var(--md-primary);">
                                                    <span class="material-symbols-rounded" style="font-size: 1.1rem;">dns</span>
                                                    ${log.node_name || 'Sconosciuto'}
                                                </div>
                                            </td>
                                            <td style="padding: 1.1rem 1.3rem; border-bottom: 1px solid rgba(100,100,100,0.1);">
                                                <div style="display: flex; align-items: center; gap: 0.6rem;">
                                                    <div style="width: 8px; height: 8px; border-radius: 50%; background: ${log.ip_address === '127.0.0.1' ? 'var(--md-primary)' : 'var(--md-secondary)'};"></div>
                                                    <span style="font-family: 'JetBrains Mono', 'Courier New', monospace; color: var(--md-on-surface-variant); font-size: 0.92rem;">${log.ip_address || 'N/D'}</span>
                                                </div>
                                            </td>
                                            <td style="padding: 1.1rem 1.3rem; border-bottom: 1px solid rgba(100,100,100,0.1);">
                                                <div style="display: flex; align-items: center; gap: 0.7rem; color: var(--md-on-surface-variant);">
                                                    <span class="material-symbols-rounded" style="background: rgba(100,100,100,0.1); padding: 0.4rem; border-radius: 8px;">computer</span>
                                                    <span style="font-weight: 500;">${log.device_info || 'N/D'}</span>
                                                </div>
                                            </td>
                                        </tr>
                                    `; }).join('')}
                                </tbody>
                            </table>
                        </div>
                    `}
                </div>
                <style>
                    @keyframes slideIn {
                        from { opacity: 0; transform: translateY(10px); }
                        to { opacity: 1; transform: translateY(0); }
                    }
                    .log-row:hover {
                        background: rgba(var(--md-primary-rgb), 0.05) !important;
                        transform: scale(1.002);
                        box-shadow: 0 4px 12px rgba(0,0,0,0.05);
                        z-index: 10;
                        position: relative;
                    }
                </style>
            </div>
        `;
    },
    afterRender: () => {
    }
};
