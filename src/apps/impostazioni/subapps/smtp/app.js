export default {
    render: async (el) => {
        try {
            el.innerHTML = `
                <h3 style="color: var(--md-primary); margin-bottom: 1rem;"><span class="material-symbols-rounded">mail</span> Configurazione Server SMTP</h3>
                <p style="margin-bottom: 2rem;">Imposta i parametri per l'invio delle email di sistema.</p>
                <div style="background: var(--md-surface); padding: 1.5rem; border-radius: 12px; border: 1px solid var(--md-outline);">
                    <div style="margin-bottom: 1rem;">
                        <label class="text-label">Host SMTP</label>
                        <input type="text" class="input-field" placeholder="smtp.example.com">
                    </div>
                    <div style="margin-bottom: 1rem;">
                        <label class="text-label">Porta</label>
                        <input type="number" class="input-field" placeholder="465">
                    </div>
                    <button class="btn btn-primary"><span class="material-symbols-rounded">save</span> Salva Parametri</button>
                </div>
            `;
        } catch (e) {
            console.error(e);
            el.innerHTML = '<p>Errore modulo SMTP</p>';
        }
    }
};
