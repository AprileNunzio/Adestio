export default {
    render: async (el) => {
        try {
            const currentUserId = sessionStorage.getItem('currentUserId');
            if (!currentUserId) {
                el.innerHTML = '<p style="color: var(--md-error); padding: 2rem; text-align: center;">Utente non autenticato.</p>';
                return;
            }
            const renderAuthForm = () => {
                el.innerHTML = `
                    <div class="fade-in-up" style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; padding: 2rem;">
                        <span class="material-symbols-rounded" style="font-size: 4rem; color: var(--md-primary); margin-bottom: 1rem;">lock</span>
                        <h2 style="color: var(--md-on-surface); margin-bottom: 0.5rem; font-size: 2rem;">Verifica di Sicurezza</h2>
                        <p style="color: var(--md-on-surface-variant); text-align: center; margin-bottom: 2rem; font-size: 1.1rem;">Per accedere alle credenziali di rete confidenziali, inserisci la tua password.</p>
                        <div style="background: var(--md-surface-variant); padding: 2.5rem; border-radius: 20px; width: 100%; max-width: 450px; display: flex; flex-direction: column; gap: 1.5rem; box-shadow: 0 10px 30px rgba(0,0,0,0.1);">
                            <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                                <label style="font-weight: 600; color: var(--md-on-surface-variant); margin-left: 0.5rem;">Password</label>
                                <input type="password" id="auth-password" class="input" placeholder="La tua password..." style="width: 100%; padding: 1.2rem; border-radius: 12px; border: 1px solid var(--md-outline); background: var(--md-surface); color: var(--md-on-surface); font-size: 1.1rem; box-sizing: border-box;">
                            </div>
                            <button id="btn-verify" class="btn hover-scale" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 1.2rem; border-radius: 12px; font-weight: bold; font-size: 1.1rem; border: none; cursor: pointer; transition: transform 0.2s, box-shadow 0.2s;">
                                Sblocca Credenziali
                            </button>
                        </div>
                    </div>
                `;
                const btn = el.querySelector('#btn-verify');
                const input = el.querySelector('#auth-password');
                const handleVerify = async () => {
                    const pwd = input.value;
                    if (!pwd) return;
                    btn.innerHTML = '<span class="material-symbols-rounded" style="animation: spin 2s linear infinite;">sync</span>';
                    btn.disabled = true;
                    try {
                        const result = await window.electronAPI.loginUser({ id: currentUserId, password: pwd });
                        if (result && result.success) {
                            renderCredentials();
                        } else {
                            const { toast } = await import('../../../../js/utils.js');
                            toast("Password errata", "error");
                            btn.innerHTML = 'Sblocca Credenziali';
                            btn.disabled = false;
                            input.value = '';
                            input.focus();
                        }
                    } catch(e) {
                        console.error(e);
                        btn.innerHTML = 'Sblocca Credenziali';
                        btn.disabled = false;
                    }
                };
                btn.addEventListener('click', handleVerify);
                input.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleVerify(); });
                setTimeout(() => input.focus(), 100);
            };
            const renderCredentials = async () => {
                let networkCode = "Non disponibile";
                let copyDisabled = "disabled";
                el.innerHTML = '<div style="display: flex; justify-content: center; align-items: center; height: 100%;"><span class="material-symbols-rounded" style="animation: spin 2s linear infinite; font-size: 3rem; color: var(--md-primary);">sync</span></div>';
                if (window.electronAPI) {
                    const res = await window.electronAPI.getNetworkCode();
                    if (res && res.success && res.code) {
                        networkCode = res.code;
                        copyDisabled = "";
                    }
                }
                el.innerHTML = `
                    <div class="fade-in-up" style="width: 100%; display: flex; flex-direction: column; align-items: center; justify-content: flex-start; padding: 2rem;">
                        <!-- Header -->
                        <div style="text-align: center; margin-bottom: 3rem;">
                            <h2 style="font-size: 2.5rem; font-weight: 800; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 0.5rem; letter-spacing: -0.5px;">Credenziali di Rete</h2>
                            <p style="color: var(--md-on-surface-variant); font-size: 1.1rem; max-width: 500px; margin: 0 auto; line-height: 1.5;">
                                Gestisci l'accesso alla Blockchain e autorizza la sincronizzazione dei nuovi nodi.
                            </p>
                        </div>
                        <!-- Main Glassmorphism Card -->
                        <div style="
                            background: rgba(var(--md-surface-rgb, 255, 255, 255), 0.7);
                            backdrop-filter: blur(20px);
                            -webkit-backdrop-filter: blur(20px);
                            border: 1px solid rgba(255, 255, 255, 0.4);
                            border-radius: 24px;
                            padding: 2.5rem;
                            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(255,255,255,0.6);
                            width: 100%;
                            max-width: 650px;
                            position: relative;
                            overflow: hidden;
                            transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                        " class="hover-scale">
                            <!-- Decorative blob -->
                            <div style="position: absolute; top: -50px; right: -50px; width: 150px; height: 150px; background: linear-gradient(135deg, rgba(102, 126, 234, 0.4) 0%, rgba(118, 75, 162, 0.4) 100%); filter: blur(40px); border-radius: 50%; z-index: 0; pointer-events: none;"></div>
                            <div style="position: relative; z-index: 1;">
                                <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 1.5rem;">
                                    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); width: 48px; height: 48px; border-radius: 14px; display: flex; align-items: center; justify-content: center; box-shadow: 0 8px 16px rgba(118, 75, 162, 0.25);">
                                        <span class="material-symbols-rounded" style="color: white; font-size: 1.8rem;">security</span>
                                    </div>
                                    <div>
                                        <h3 style="font-size: 1.4rem; font-weight: 700; color: var(--md-on-surface); margin: 0;">Codice di Sicurezza</h3>
                                        <span style="font-size: 0.9rem; color: var(--md-error); font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Altamente Confidenziale</span>
                                    </div>
                                </div>
                                <p style="color: var(--md-on-surface-variant); font-size: 1.05rem; line-height: 1.6; margin-bottom: 2rem;">
                                    Questo codice rappresenta l'identità crittografica della tua rete. Condividilo <b>esclusivamente</b> con i nodi autorizzati che necessitano di agganciarsi all'infrastruttura.
                                </p>
                                <!-- Code Display Area -->
                                <div style="
                                    background: var(--md-surface-variant);
                                    padding: 2rem;
                                    border-radius: 16px;
                                    text-align: center;
                                    border: 2px dashed rgba(118, 75, 162, 0.3);
                                    position: relative;
                                ">
                                    ${networkCode === "Non disponibile" 
                                        ? `<div style="display: flex; flex-direction: column; align-items: center; gap: 0.5rem; color: var(--md-on-surface-variant);">
                                             <span class="material-symbols-rounded" style="font-size: 2.5rem; opacity: 0.5;">lock_clock</span>
                                             <span style="font-weight: 500;">Non disponibile sui database legacy.</span>
                                             <span style="font-size: 0.85rem;">Per ottenere un codice, genera una nuova rete.</span>
                                           </div>`
                                        : `<span style="font-family: 'Courier New', monospace; font-size: 2.8rem; font-weight: 800; letter-spacing: 4px; color: var(--md-primary); text-shadow: 0 2px 10px rgba(102, 126, 234, 0.2); user-select: all;" id="network-code-display">
                                            ${networkCode}
                                           </span>`
                                    }
                                </div>
                                <div style="display: flex; justify-content: center; margin-top: 2rem;">
                                    <button id="btn-copy-code" class="btn hover-scale" ${copyDisabled} style="
                                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                                        color: white;
                                        border: none;
                                        padding: 1rem 2rem;
                                        font-size: 1.1rem;
                                        font-weight: 600;
                                        border-radius: 50px;
                                        display: flex;
                                        align-items: center;
                                        gap: 10px;
                                        cursor: ${copyDisabled ? 'not-allowed' : 'pointer'};
                                        opacity: ${copyDisabled ? '0.5' : '1'};
                                        box-shadow: 0 10px 20px rgba(118, 75, 162, 0.3);
                                        transition: all 0.3s ease;
                                    ">
                                        <span class="material-symbols-rounded">content_copy</span> 
                                        Copia negli appunti
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                    <style>
                        .hover-scale:hover {
                            transform: translateY(-5px);
                            box-shadow: 0 25px 50px rgba(0, 0, 0, 0.12), inset 0 1px 0 rgba(255,255,255,0.8) !important;
                        }
                        #btn-verify:not([disabled]):hover {
                            transform: translateY(-2px);
                            box-shadow: 0 10px 20px rgba(118, 75, 162, 0.3) !important;
                        }
                        #btn-verify:not([disabled]):active {
                            transform: translateY(0);
                        }
                    </style>
                `;
                const btnCopy = el.querySelector('#btn-copy-code');
                if (btnCopy && !btnCopy.hasAttribute('disabled')) {
                    btnCopy.addEventListener('click', async () => {
                        try {
                            await navigator.clipboard.writeText(networkCode);
                            const { toast } = await import('../../../../js/utils.js');
                            toast('Codice di Sicurezza copiato negli appunti!', 'success');
                        } catch (err) {
                            console.error('Errore copia negli appunti', err);
                        }
                    });
                }
            };
            renderAuthForm();
        } catch (e) {
            console.error(e);
            el.innerHTML = '<p style="color: var(--md-error);">Errore nel caricamento delle credenziali.</p>';
        }
    }
};
