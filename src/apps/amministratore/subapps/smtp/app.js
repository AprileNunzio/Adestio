import { toast } from '../../../../js/utils.js';
export default {
    render: async (el) => {
        try {
            el.innerHTML = `
                <div class="fade-in-up" style="display: flex; flex-direction: column; height: 100%; padding: 1.5rem; overflow-y: auto; overflow-x: hidden;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 2rem;">
                        <div>
                            <h2 style="margin: 0 0 0.5rem 0; font-size: 2rem; color: var(--md-on-surface); font-weight: 800; letter-spacing: -0.02em;">Server SMTP</h2>
                            <p style="margin: 0; color: var(--md-on-surface-variant); font-size: 1.1rem;">Configura il server di posta in uscita per l'invio delle comunicazioni di sistema.</p>
                        </div>
                        <div style="display: flex; gap: 1rem;">
                            <button id="btn-test-smtp" class="btn secondary" style="display: flex; align-items: center; gap: 0.5rem;">
                                <span class="material-symbols-rounded">science</span> Test Connessione
                            </button>
                            <button id="btn-save-smtp" class="btn primary" style="display: flex; align-items: center; gap: 0.5rem;">
                                <span class="material-symbols-rounded">save</span> Salva Configurazione
                            </button>
                        </div>
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 1.5rem; margin-bottom: 2rem;">
                        <!-- Configurazione Rete -->
                        <div class="card" style="padding: 1.5rem; background: var(--md-surface); border-radius: 16px; border: 1px solid var(--md-surface-variant); display: flex; flex-direction: column; gap: 1.5rem;">
                            <div style="display: flex; align-items: center; gap: 0.8rem; border-bottom: 1px solid var(--md-surface-variant); padding-bottom: 1rem;">
                                <span class="material-symbols-rounded" style="color: var(--md-primary); font-size: 1.8rem;">router</span>
                                <h3 style="margin: 0; font-size: 1.2rem; color: var(--md-on-surface);">Parametri di Rete</h3>
                            </div>
                            <div>
                                <label class="text-label" style="display: block; margin-bottom: 0.5rem; color: var(--md-on-surface-variant); font-weight: 500;">Host SMTP</label>
                                <input type="text" id="smtp-host" class="input-field" placeholder="es. smtp.office365.com" style="width: 100%; padding: 0.8rem; border-radius: 8px; border: 1px solid var(--md-outline); background: var(--md-surface); color: var(--md-on-surface);">
                            </div>
                            <div style="display: flex; gap: 1rem;">
                                <div style="flex: 1;">
                                    <label class="text-label" style="display: block; margin-bottom: 0.5rem; color: var(--md-on-surface-variant); font-weight: 500;">Porta</label>
                                    <input type="number" id="smtp-port" class="input-field" placeholder="es. 587" style="width: 100%; padding: 0.8rem; border-radius: 8px; border: 1px solid var(--md-outline); background: var(--md-surface); color: var(--md-on-surface);">
                                </div>
                                <div style="flex: 2;">
                                    <label class="text-label" style="display: block; margin-bottom: 0.5rem; color: var(--md-on-surface-variant); font-weight: 500;">Protocollo di Sicurezza</label>
                                    <select id="smtp-security" class="input-field" style="width: 100%; padding: 0.8rem; border-radius: 8px; border: 1px solid var(--md-outline); background: var(--md-surface); color: var(--md-on-surface);">
                                        <option value="none">Nessuna (Insecure)</option>
                                        <option value="starttls" selected>STARTTLS (Consigliata)</option>
                                        <option value="ssl">SSL/TLS Implicito</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label class="text-label" style="display: block; margin-bottom: 0.5rem; color: var(--md-on-surface-variant); font-weight: 500;">Timeout Connessione (ms)</label>
                                <input type="number" id="smtp-timeout" class="input-field" placeholder="10000" style="width: 100%; padding: 0.8rem; border-radius: 8px; border: 1px solid var(--md-outline); background: var(--md-surface); color: var(--md-on-surface);">
                            </div>
                        </div>
                        <!-- Credenziali -->
                        <div class="card" style="padding: 1.5rem; background: var(--md-surface); border-radius: 16px; border: 1px solid var(--md-surface-variant); display: flex; flex-direction: column; gap: 1.5rem;">
                            <div style="display: flex; align-items: center; gap: 0.8rem; border-bottom: 1px solid var(--md-surface-variant); padding-bottom: 1rem;">
                                <span class="material-symbols-rounded" style="color: var(--md-primary); font-size: 1.8rem;">passkey</span>
                                <h3 style="margin: 0; font-size: 1.2rem; color: var(--md-on-surface);">Autenticazione</h3>
                            </div>
                            <div>
                                <label class="text-label" style="display: block; margin-bottom: 0.5rem; color: var(--md-on-surface-variant); font-weight: 500;">Nome Utente</label>
                                <input type="text" id="smtp-user" class="input-field" placeholder="admin@azienda.com" style="width: 100%; padding: 0.8rem; border-radius: 8px; border: 1px solid var(--md-outline); background: var(--md-surface); color: var(--md-on-surface);">
                            </div>
                            <div>
                                <label class="text-label" style="display: block; margin-bottom: 0.5rem; color: var(--md-on-surface-variant); font-weight: 500;">Password / App Password</label>
                                <div style="position: relative;">
                                    <input type="password" id="smtp-pass" class="input-field" placeholder="••••••••••••" style="width: 100%; padding: 0.8rem; border-radius: 8px; border: 1px solid var(--md-outline); background: var(--md-surface); color: var(--md-on-surface);">
                                    <button id="btn-toggle-pass" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: var(--md-on-surface-variant); padding: 5px;">
                                        <span class="material-symbols-rounded" id="icon-toggle-pass">visibility</span>
                                    </button>
                                </div>
                                <p style="margin: 0.5rem 0 0 0; font-size: 0.85rem; color: var(--md-on-surface-variant);">Per Google o Microsoft, utilizza una App Password invece della password dell'account.</p>
                            </div>
                            <div style="display: flex; align-items: center; gap: 0.5rem; margin-top: 0.5rem;">
                                <input type="checkbox" id="smtp-allow-self-signed" style="width: 1.2rem; height: 1.2rem; cursor: pointer;">
                                <label for="smtp-allow-self-signed" style="color: var(--md-on-surface); font-size: 0.95rem; cursor: pointer;">Ignora errori certificato SSL (Self-Signed TLS)</label>
                            </div>
                        </div>
                        <!-- Mittente -->
                        <div class="card" style="padding: 1.5rem; background: var(--md-surface); border-radius: 16px; border: 1px solid var(--md-surface-variant); display: flex; flex-direction: column; gap: 1.5rem;">
                            <div style="display: flex; align-items: center; gap: 0.8rem; border-bottom: 1px solid var(--md-surface-variant); padding-bottom: 1rem;">
                                <span class="material-symbols-rounded" style="color: var(--md-primary); font-size: 1.8rem;">contact_mail</span>
                                <h3 style="margin: 0; font-size: 1.2rem; color: var(--md-on-surface);">Identità Mittente</h3>
                            </div>
                            <div>
                                <label class="text-label" style="display: block; margin-bottom: 0.5rem; color: var(--md-on-surface-variant); font-weight: 500;">Email Mittente (Da)</label>
                                <input type="text" id="smtp-sender-email" class="input-field" placeholder="noreply@azienda.com" style="width: 100%; padding: 0.8rem; border-radius: 8px; border: 1px solid var(--md-outline); background: var(--md-surface); color: var(--md-on-surface);">
                            </div>
                            <div>
                                <label class="text-label" style="display: block; margin-bottom: 0.5rem; color: var(--md-on-surface-variant); font-weight: 500;">Nome Visualizzato</label>
                                <input type="text" id="smtp-sender-name" class="input-field" placeholder="Adestio Enterprise" style="width: 100%; padding: 0.8rem; border-radius: 8px; border: 1px solid var(--md-outline); background: var(--md-surface); color: var(--md-on-surface);">
                            </div>
                        </div>
                    </div>
                    <!-- Console Debug (Nascosta di default) -->
                    <div id="smtp-console-container" style="display: none; flex-direction: column; gap: 1rem; margin-top: 1rem;">
                        <h3 style="margin: 0; font-size: 1.2rem; color: var(--md-on-surface); display: flex; align-items: center; gap: 0.5rem;"><span class="material-symbols-rounded" style="color: var(--md-primary);">terminal</span> Handshake Trace</h3>
                        <div id="smtp-console" style="background: #1e1e1e; color: #d4d4d4; padding: 1.5rem; border-radius: 12px; font-family: 'Fira Code', monospace; font-size: 0.9rem; line-height: 1.5; white-space: pre-wrap; word-break: break-all; max-height: 300px; overflow-y: auto; border: 1px solid #333;"></div>
                    </div>
                </div>
            `;
            const config = await window.electronAPI.readConfig() || {};
            const hostIn = document.getElementById('smtp-host');
            const portIn = document.getElementById('smtp-port');
            const secIn = document.getElementById('smtp-security');
            const timeoutIn = document.getElementById('smtp-timeout');
            const userIn = document.getElementById('smtp-user');
            const passIn = document.getElementById('smtp-pass');
            const selfSignIn = document.getElementById('smtp-allow-self-signed');
            const sEmailIn = document.getElementById('smtp-sender-email');
            const sNameIn = document.getElementById('smtp-sender-name');
            if (config.smtp_host) hostIn.value = config.smtp_host;
            if (config.smtp_port) portIn.value = config.smtp_port;
            if (config.smtp_security) secIn.value = config.smtp_security;
            if (config.smtp_timeout) timeoutIn.value = config.smtp_timeout;
            if (config.smtp_user) userIn.value = config.smtp_user;
            if (config.smtp_pass) passIn.value = config.smtp_pass;
            if (config.smtp_allow_self_signed) selfSignIn.checked = true;
            if (config.smtp_sender_email) sEmailIn.value = config.smtp_sender_email;
            if (config.smtp_sender_name) sNameIn.value = config.smtp_sender_name;
            document.getElementById('btn-toggle-pass').addEventListener('click', () => {
                const icon = document.getElementById('icon-toggle-pass');
                if (passIn.type === 'password') {
                    passIn.type = 'text';
                    icon.innerText = 'visibility_off';
                } else {
                    passIn.type = 'password';
                    icon.innerText = 'visibility';
                }
            });
            const getFormData = () => {
                return {
                    smtp_host: hostIn.value.trim(),
                    smtp_port: parseInt(portIn.value) || null,
                    smtp_security: secIn.value,
                    smtp_timeout: parseInt(timeoutIn.value) || null,
                    smtp_user: userIn.value.trim(),
                    smtp_pass: passIn.value,
                    smtp_allow_self_signed: selfSignIn.checked,
                    smtp_sender_email: sEmailIn.value.trim(),
                    smtp_sender_name: sNameIn.value.trim()
                };
            };
            document.getElementById('btn-save-smtp').addEventListener('click', async () => {
                const btn = document.getElementById('btn-save-smtp');
                const oldHTML = btn.innerHTML;
                btn.innerHTML = '<span class="material-symbols-rounded" style="animation: spin 1s linear infinite;">sync</span> Salvataggio...';
                btn.disabled = true;
                const formData = getFormData();
                const newConfig = { ...config, ...formData };
                const success = await window.electronAPI.saveConfig(newConfig);
                btn.innerHTML = oldHTML;
                btn.disabled = false;
                if (success) {
                    toast('Configurazione SMTP salvata con successo!', 'success');
                } else {
                    toast('Errore durante il salvataggio della configurazione.', 'error');
                }
            });
            document.getElementById('btn-test-smtp').addEventListener('click', async () => {
                const formData = getFormData();
                if (!formData.smtp_host || !formData.smtp_port) {
                    toast('Host e Porta sono obbligatori per il test.', 'warning');
                    return;
                }
                const testEmail = prompt("Inserisci l'indirizzo email a cui inviare il messaggio di test:");
                if (!testEmail) return;
                const btn = document.getElementById('btn-test-smtp');
                const oldHTML = btn.innerHTML;
                btn.innerHTML = '<span class="material-symbols-rounded" style="animation: spin 1s linear infinite;">sync</span> Test in corso...';
                btn.disabled = true;
                const consoleCtn = document.getElementById('smtp-console-container');
                const consoleOut = document.getElementById('smtp-console');
                consoleCtn.style.display = 'flex';
                consoleOut.innerHTML = '<span style="color: #4CAF50;">[System]</span> Inizializzazione connessione verso ' + formData.smtp_host + ':' + formData.smtp_port + '...\\n';
                try {
                    const res = await window.electronAPI.testSmtpConnection(formData, testEmail);
                    if (res.success) {
                        toast('Test SMTP completato con successo!', 'success');
                        consoleOut.innerHTML += res.logs + '\\n\\n<span style="color: #4CAF50; font-weight: bold;">[Result] Connessione riuscita ed email inviata a ' + testEmail + '</span>';
                    } else {
                        toast('Errore di connessione SMTP', 'error');
                        consoleOut.innerHTML += res.logs ? res.logs + '\\n\\n' : '';
                        consoleOut.innerHTML += '<span style="color: #F44336; font-weight: bold;">[Result] ' + res.error + '</span>';
                    }
                } catch(e) {
                    toast('Errore fatale: ' + e.message, 'error');
                    consoleOut.innerHTML += '<span style="color: #F44336; font-weight: bold;">[Result] ' + e.message + '</span>';
                }
                btn.innerHTML = oldHTML;
                btn.disabled = false;
            });
        } catch (e) {
            console.error(e);
            el.innerHTML = '<div style="padding: 2rem; color: var(--md-error);">Errore di rendering modulo SMTP: ' + e.message + '</div>';
        }
    }
};
