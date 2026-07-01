import { Router, toast } from '../utils.js';
export default {
    render: async (el) => {
        try {
            el.innerHTML = `
                <div class="card fade-in-up" style="width: 100%; max-width: 500px; text-align: center; padding: 2rem; border-radius: 28px; box-shadow: 0 8px 32px rgba(0,0,0,0.08); margin: auto;">
                    <span class="material-symbols-rounded" style="font-size: 2.5rem; color: var(--md-secondary); margin-bottom: 0.5rem;">admin_panel_settings</span>
                    <h1 class="text-title" style="margin-bottom: 0.2rem; font-size: 1.6rem; letter-spacing: -0.02em;">Nuova Rete</h1>
                    <p class="text-body" style="margin-bottom: 1.5rem; font-size: 0.95rem; color: var(--md-on-surface-variant);">Crea la rete e l'amministratore principale.</p>
                    <form id="register-form">
                        <div style="position: relative; margin-bottom: 0.8rem;">
                            <span class="material-symbols-rounded" style="position: absolute; left: 1rem; top: 0.8rem; color: var(--md-on-surface-variant);">domain</span>
                            <input type="text" id="network-name" class="input-field" placeholder="Nome della Struttura (es. Clinica Roma)" required autocomplete="off" style="padding-left: 3rem; padding-top: 0.7rem; padding-bottom: 0.7rem; font-size: 1rem; border-radius: 12px;">
                        </div>
                        <hr style="border: none; border-top: 1px solid var(--md-outline-variant); margin: 1.2rem 0;">
                        <div style="display: flex; gap: 1rem; margin-bottom: 0.8rem;">
                            <div style="flex: 1; position: relative;">
                                <span class="material-symbols-rounded" style="position: absolute; left: 1rem; top: 0.8rem; color: var(--md-on-surface-variant);">person</span>
                                <input type="text" id="cognome" class="input-field" placeholder="Cognome" required autocomplete="off" style="padding-left: 3rem; padding-top: 0.7rem; padding-bottom: 0.7rem; font-size: 1rem; border-radius: 12px; width: 100%; box-sizing: border-box;">
                            </div>
                            <div style="flex: 1; position: relative;">
                                <input type="text" id="nome" class="input-field" placeholder="Nome" required autocomplete="off" style="padding-left: 1rem; padding-top: 0.7rem; padding-bottom: 0.7rem; font-size: 1rem; border-radius: 12px; width: 100%; box-sizing: border-box;">
                            </div>
                        </div>
                        <div style="position: relative; margin-bottom: 0.8rem;">
                            <span class="material-symbols-rounded" style="position: absolute; left: 1rem; top: 0.8rem; color: var(--md-on-surface-variant);">mail</span>
                            <input type="email" id="email" class="input-field" placeholder="Indirizzo Email" required autocomplete="off" style="padding-left: 3rem; padding-top: 0.7rem; padding-bottom: 0.7rem; font-size: 1rem; border-radius: 12px;">
                        </div>
                        <div style="position: relative; margin-bottom: 1.2rem;">
                            <span class="material-symbols-rounded" style="position: absolute; left: 1rem; top: 0.8rem; color: var(--md-on-surface-variant);">lock</span>
                            <input type="password" id="password" class="input-field" placeholder="Password (in caso dimentichi il PIN)" required style="padding-left: 3rem; padding-top: 0.7rem; padding-bottom: 0.7rem; font-size: 1rem; border-radius: 12px;">
                        </div>
                        <div style="margin-bottom: 1.5rem; margin-top: 0.5rem;">
                            <label class="text-label" style="display: flex; align-items: center; gap: 0.4rem; margin-bottom: 0.6rem; text-align: left; color: var(--md-primary); font-weight: 600; font-size: 0.85rem; letter-spacing: 0.05em; text-transform: uppercase;">
                                <span class="material-symbols-rounded" style="font-size: 1.2rem;">dialpad</span> PIN di Accesso
                            </label>
                            <div id="register-pin-container" style="display: flex; gap: 0.5rem; justify-content: space-between;">
                                <input type="password" maxlength="1" class="pin-box" data-index="0" required>
                                <input type="password" maxlength="1" class="pin-box" data-index="1" required>
                                <input type="password" maxlength="1" class="pin-box" data-index="2" required>
                                <input type="password" maxlength="1" class="pin-box" data-index="3" required>
                                <input type="password" maxlength="1" class="pin-box" data-index="4" required>
                                <input type="password" maxlength="1" class="pin-box" data-index="5" required>
                            </div>
                        </div>
                        <button type="submit" class="btn btn-primary" style="width: 100%; padding-top: 0.8rem; padding-bottom: 0.8rem; font-size: 1.05rem; border-radius: 20px; font-weight: 600;">
                            <span class="material-symbols-rounded">rocket_launch</span> Avvia Rete
                        </button>
                    </form>
                </div>
            <style>
                .pin-box {
                    width: 45px;
                    height: 55px;
                    font-size: 1.5rem;
                    text-align: center;
                    border: 2px solid var(--md-outline);
                    border-radius: 8px;
                    background: var(--md-surface-variant);
                    color: var(--md-on-surface);
                    outline: none;
                    transition: all 0.2s ease;
                }
                .pin-box:focus {
                    border-color: var(--md-primary);
                    box-shadow: 0 0 8px rgba(103, 80, 164, 0.4);
                }
                .input-field {
                    margin-bottom: 0 !important;
                }
            </style>
            `;
            const form = el.querySelector('#register-form');
            const pinInputs = Array.from(el.querySelectorAll('.pin-box'));
            pinInputs.forEach((input, idx) => {
                input.addEventListener('input', (e) => {
                    try {
                        const val = e.target.value;
                        if (/[^0-9]/.test(val)) {
                            e.target.value = '';
                            return;
                        }
                        if (val !== '' && idx < pinInputs.length - 1) {
                            pinInputs[idx + 1].focus();
                        }
                    } catch(err) { console.error(err); }
                });
                input.addEventListener('keydown', (e) => {
                    try {
                        if (e.key === 'Backspace' && e.target.value === '' && idx > 0) {
                            pinInputs[idx - 1].focus();
                        }
                    } catch(err) { console.error(err); }
                });
            });
            form.addEventListener('submit', async (e) => {
                try {
                    e.preventDefault();
                    const networkName = el.querySelector('#network-name').value.trim();
                    const cognome = el.querySelector('#cognome').value.trim();
                    const nome = el.querySelector('#nome').value.trim();
                    const email = el.querySelector('#email').value.trim();
                    const password = el.querySelector('#password').value.trim();
                    const pin = pinInputs.map(i => i.value).join('');
                    if (pin.length !== 6) {
                        toast("Il PIN deve essere di 6 cifre", "error");
                        return;
                    }
                    if (!networkName || !cognome || !nome || !email || !password || !pin) {
                        toast("Compila tutti i campi", "error");
                        return;
                    }
                    if (window.electronAPI) {
                        const result = await window.electronAPI.registerUser({ nome, cognome, email, password, pin, networkName });
                        if (result && result.success) {
                            sessionStorage.setItem('currentUserId', result.id);
                            toast("Account e Rete creati con successo!", "success");
                            const networkCode = result.networkCode;
                            el.innerHTML = `
                                <div class="card fade-in-up" style="width: 100%; max-width: 600px; text-align: center; padding: 2rem; margin: auto; box-sizing: border-box;">
                                    <div style="width: 80px; height: 80px; background: var(--md-primary-container); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 1.5rem;">
                                        <span class="material-symbols-rounded" style="font-size: 3rem; color: var(--md-on-primary-container);">verified_user</span>
                                    </div>
                                    <h1 class="text-title" style="margin-bottom: 0.5rem; font-size: clamp(1.5rem, 5vw, 2rem); color: var(--md-primary);">Rete Operativa!</h1>
                                    <p class="text-body" style="margin-bottom: 2rem; font-size: clamp(0.9rem, 3vw, 1.1rem); color: var(--md-on-surface-variant);">
                                        Il database locale è stato crittografato e la tua postazione è ora il nodo principale.
                                    </p>
                                    <div style="background: var(--md-surface-variant); border: 2px dashed var(--md-outline); border-radius: 16px; padding: 1.5rem; margin-bottom: 2rem; position: relative;">
                                        <p style="font-size: 0.9rem; font-weight: bold; color: var(--md-secondary); text-transform: uppercase; letter-spacing: 0.1rem; margin-bottom: 0.5rem;">Codice di Sicurezza Rete</p>
                                        <div style="font-family: monospace; font-size: clamp(1.2rem, 4vw, 2.5rem); font-weight: bold; letter-spacing: 0.1rem; color: var(--md-on-surface); user-select: all; word-break: break-all;" id="display-network-code">
                                            ${networkCode}
                                        </div>
                                        <p style="font-size: 0.85rem; color: var(--md-on-surface-variant); margin-top: 1rem;">
                                            Custodisci questo codice. Ti servirà per collegare altri computer a questa rete.
                                        </p>
                                    </div>
                                    <div style="display: flex; gap: 1rem; justify-content: center; margin-bottom: 2rem; flex-wrap: wrap;">
                                        <button id="btn-copy-code" class="btn btn-secondary" style="flex: 1 1 calc(50% - 0.5rem); min-width: 150px; padding: 0.8rem;">
                                            <span class="material-symbols-rounded">content_copy</span> Copia
                                        </button>
                                        <button id="btn-export-code" class="btn btn-secondary" style="flex: 1 1 calc(50% - 0.5rem); min-width: 150px; padding: 0.8rem;">
                                            <span class="material-symbols-rounded">download</span> Salva in TXT
                                        </button>
                                    </div>
                                    <button id="btn-go-dashboard" class="btn btn-primary" style="width: 100%; padding: 1rem; font-size: 1.1rem;">
                                        <span class="material-symbols-rounded">space_dashboard</span> Vai alla Dashboard
                                    </button>
                                </div>
                            `;
                            el.querySelector('#btn-copy-code').addEventListener('click', () => {
                                try {
                                    navigator.clipboard.writeText(networkCode);
                                    toast("Codice copiato negli appunti!", "success");
                                } catch(e) {}
                            });
                            el.querySelector('#btn-export-code').addEventListener('click', () => {
                                try {
                                    const element = document.createElement('a');
                                    const file = new Blob([`ADESTIO ENTERPRISE - CODICE DI RETE\n\nCodice Rete: ${networkCode}\nData Creazione: ${new Date().toLocaleString()}\n\nCustodisci questo file. Il codice serve per collegare altri PC a questa rete.`], {type: 'text/plain'});
                                    element.href = URL.createObjectURL(file);
                                    element.download = 'Adestio_Codice_Rete.txt';
                                    document.body.appendChild(element);
                                    element.click();
                                    document.body.removeChild(element);
                                    toast("File salvato nei Download!", "success");
                                } catch(e) {}
                            });
                            el.querySelector('#btn-go-dashboard').addEventListener('click', () => {
                                Router.navigate('dashboard');
                            });
                        } else {
                            toast("Errore durante la creazione", "error");
                        }
                    }
                } catch (err) {
                    console.error(err);
                    toast("Errore di rete o DB", "error");
                }
            });
        } catch (e) {
            console.error(e);
            el.innerHTML = `<p>Errore rendering auth_register</p>`;
        }
    }
};
