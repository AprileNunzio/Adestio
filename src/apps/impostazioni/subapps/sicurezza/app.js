import TwofaPanel from '../../../../js/shared/twofa_panel.js';

export default {
    render: async (el) => {
        const userId = sessionStorage.getItem('currentUserId');
        if (!userId) { el.innerHTML = `<p style="padding:2rem; text-align:center; color: var(--md-error);">Utente non autenticato.</p>`; return; }

        el.innerHTML = `
            <div style="display:flex; align-items:center; gap:0.6rem; margin-bottom:1rem;">
                <span class="material-symbols-rounded" style="font-size:2rem; color: var(--md-primary);">verified_user</span>
                <div>
                    <h2 style="margin:0; font-size:1.4rem; color: var(--md-on-surface);">Sicurezza</h2>
                    <p style="margin:0.2rem 0 0 0; color: var(--md-on-surface-variant); font-size:0.9rem;">Gestisci l'autenticazione a due fattori (TOTP e Passkey) del tuo account.</p>
                </div>
            </div>
            <div id="sic-twofa-panel"></div>
        `;

        TwofaPanel.render(el.querySelector('#sic-twofa-panel'), userId);
    }
};
