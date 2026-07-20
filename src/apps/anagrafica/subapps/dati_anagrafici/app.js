import { toast } from '../../../../js/utils.js';
import { personaFormHtml, readPersonaForm, fillPersonaForm, populatePersonaFormDatalists } from '../../shared/persona_form.js';
import { isValidCodiceFiscale } from '../../shared/validators.js';
import { getCurrentUserId, resolveCurrentPersona } from '../../shared/current_persona.js';
import { mountAuditButton } from '../../shared/audit_trail_button.js';
import { heroHtml, guidaHtml, AK_STYLES } from '../../shared/ui_kit.js';
const subapp = {
    render: async (el) => {
        const userId = getCurrentUserId();
        if (!userId) {
            el.innerHTML = '<p style="text-align:center; color:var(--md-error); padding:2rem;">Devi effettuare l\'accesso per gestire il tuo profilo personale.</p>';
            return;
        }
        let persona = null;
        try {
            persona = await resolveCurrentPersona();
        } catch (e) {
            el.innerHTML = `<p style="text-align:center; color:var(--md-error); padding:2rem;">Errore caricamento: ${e.message}</p>`;
            return;
        }
        let prefillNome = '';
        let prefillCognome = '';
        if (!persona) {
            try {
                const users = await window.electronAPI.usersGetAll();
                const me = users.find(u => u.id === userId);
                if (me) {
                    prefillNome = me.nome || '';
                    prefillCognome = me.cognome || '';
                }
            } catch (e) {}
        }
        el.innerHTML = `
            <div class="fade-in-up ak-root">
                ${heroHtml({
                    title: 'I Miei Dati',
                    subtitle: persona ? 'Gestisci e tieni aggiornati i tuoi dati personali.' : 'Benvenuto! Completa il tuo profilo personale.',
                    icon: 'badge',
                    tone: 'blue',
                    auditMountId: 'scheda-audit-mount'
                })}
                ${guidaHtml({
                    tone: 'blue',
                    intro: persona
                        ? 'Questa è la tua carta d\'identità digitale: i dati qui inseriti vengono riutilizzati automaticamente nelle altre sezioni (Documenti, Lavoro, Residenza).'
                        : 'Compila i campi con i tuoi dati anagrafici. Il <strong>Codice Fiscale</strong> è la chiave che collega tutte le tue informazioni, quindi va inserito con cura.',
                    steps: [
                        'Inserisci <strong>Cognome</strong>, <strong>Nome</strong> e <strong>Codice Fiscale</strong> (obbligatori).',
                        'Aggiungi sesso, stato civile e i dati di nascita e cittadinanza.',
                        'Scrivendo il <strong>Comune di nascita</strong>, la Provincia viene suggerita automaticamente.',
                        persona ? 'Premi “Salva Modifiche” per aggiornare i dati.' : 'Premi “Crea Profilo” per salvare: il Codice Fiscale non sarà più modificabile.'
                    ]
                })}
                <div class="ak-panel">
                    <div class="ak-panel-body">
                        <form id="persona-form" style="width:100%;">
                            ${personaFormHtml()}
                            <div id="persona-modal-error" class="ak-error" role="alert"></div>
                            <div class="ak-actions">
                                <button type="submit" id="btn-save-persona" class="ak-btn ak-btn-primary">
                                    <span class="material-symbols-rounded">${persona ? 'save' : 'person_add'}</span>
                                    ${persona ? 'Salva Modifiche' : 'Crea Profilo'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
            ${AK_STYLES}
        `;
        const form = el.querySelector('#persona-form');
        const modalError = el.querySelector('#persona-modal-error');
        fillPersonaForm(el, persona);
        populatePersonaFormDatalists(el);
        if (persona) {
            mountAuditButton(el.querySelector('#scheda-audit-mount'), { tableName: 'persone', recordId: persona.id, label: `${persona.cognome} ${persona.nome}` });
        }
        if (!persona) {
            el.querySelector('#persona-nome').value = prefillNome;
            el.querySelector('#persona-cognome').value = prefillCognome;
        }
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            modalError.style.display = 'none';
            const btnSave = el.querySelector('#btn-save-persona');
            btnSave.disabled = true;
            try {
                const data = readPersonaForm(el);
                if (persona) {
                    data.id = persona.id;
                    await window.electronAPI.anagrafica.persone.update(data);
                    toast('Dati aggiornati con successo', 'success');
                } else {
                    if (!data.codice_fiscale || !isValidCodiceFiscale(data.codice_fiscale)) {
                        throw new Error('Il Codice Fiscale è obbligatorio e deve essere valido: è la chiave univoca della persona');
                    }
                    data.user_id = userId;
                    const res = await window.electronAPI.anagrafica.persone.create(data);
                    toast(res && res.claimed ? 'Profilo personale recuperato e collegato al tuo account' : 'Profilo personale creato con successo', 'success');
                }
                await subapp.render(el);
            } catch (err) {
                modalError.textContent = err.message || 'Errore durante il salvataggio.';
                modalError.style.display = 'block';
            } finally {
                btnSave.disabled = false;
            }
        });
    }
};
export default subapp;
