import TwofaPanel from '../shared/twofa_panel.js';
export default {
    render: async (el) => {
        const userId = sessionStorage.getItem('currentUserId');
        if (!userId) { el.innerHTML = `<p style="padding:2rem; text-align:center; color: var(--md-error);">Utente non autenticato.</p>`; return; }
        el.innerHTML = `
            <div class="fade-in-up as-root" style="max-width: 900px; margin: 0 auto; padding: 2rem 1.5rem 3rem;">
                <h1 class="text-title" style="font-size: 2rem; color: var(--md-primary); margin: 0;">Sicurezza Account</h1>
                <p class="text-body" style="color: var(--md-on-surface-variant); margin: 0.3rem 0 1.8rem 0;">Gestisci l'autenticazione a due fattori e lo storico degli accessi del tuo account.</p>
                <div id="as-twofa-panel"></div>
                <div id="as-log-card" class="as-card"></div>
            </div>
            <style>
                .as-card { background: var(--md-surface); border: 1px solid var(--md-outline-variant); border-radius: 20px; padding: 1.8rem; margin-bottom: 1.5rem; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
            </style>
        `;
        async function loadAccessLog() {
            const card = el.querySelector('#as-log-card');
            card.innerHTML = `<div style="text-align:center; padding:1rem;"><span class="material-symbols-rounded" style="animation: spin 2s linear infinite;">sync</span></div>`;
            try {
                const { default: ImpostazioniAccessi } = await import('./impostazioni_accessi.js');
                card.innerHTML = await ImpostazioniAccessi.render();
                card.style.padding = '0';
            } catch (e) {
                console.error(e);
                card.innerHTML = `<p style="color: var(--md-error);">Errore nel caricamento dello storico accessi.</p>`;
            }
        }
        TwofaPanel.render(el.querySelector('#as-twofa-panel'), userId);
        loadAccessLog();
    }
};
