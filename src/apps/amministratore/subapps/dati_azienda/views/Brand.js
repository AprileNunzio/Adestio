import { toast } from '../../../../../js/utils.js';

export default {
    render: async (container, configCache, saveConfig) => {
        try {
            container.innerHTML = `
                <div class="card fade-in-up" style="padding:1.5rem; background:var(--md-surface); border-radius:16px; border:1px solid var(--md-surface-variant); max-width:900px; margin:0 auto;">
                    <div style="margin-bottom:1.5rem;">
                        <h3 style="margin:0; font-size:1.4rem; color:var(--md-on-surface);">Brand, Timbri e Firme</h3>
                        <p style="margin:0.2rem 0 0; color:var(--md-on-surface-variant); font-size:0.9rem;">Immagini utilizzate per la generazione automatica di stampe, PDF e contrattualistica ufficiale.</p>
                    </div>

                    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(250px, 1fr)); gap:1.5rem;">
                        
                        <!-- Logo Aziendale -->
                        <div style="background:var(--md-surface-variant); padding:1.5rem; border-radius:12px; border:1px solid var(--md-outline-variant); display:flex; flex-direction:column; align-items:center;">
                            <h4 style="margin:0 0 1rem; color:var(--md-primary); font-size:1rem;">Logo Aziendale</h4>
                            <div class="image-preview" id="da-preview-logo" style="width:100%; height:150px; background:${configCache.img_logo ? 'url('+configCache.img_logo+') center/contain no-repeat' : '#eee'}; border-radius:8px; margin-bottom:1rem; border:1px dashed var(--md-outline);"></div>
                            <input type="file" id="da-file-logo" accept="image/png, image/jpeg, image/svg+xml" style="display:none;">
                            <button class="btn" onclick="document.getElementById('da-file-logo').click()" style="width:100%; padding:0.6rem; display:flex; justify-content:center; gap:0.5rem; align-items:center;">
                                <span class="material-symbols-rounded">upload</span> Carica Logo
                            </button>
                            <p style="margin:0.5rem 0 0; font-size:0.75rem; color:var(--md-on-surface-variant); text-align:center;">PNG, JPG o SVG. Consigliato: 500x500px.</p>
                        </div>

                        <!-- Timbro Ufficiale -->
                        <div style="background:var(--md-surface-variant); padding:1.5rem; border-radius:12px; border:1px solid var(--md-outline-variant); display:flex; flex-direction:column; align-items:center;">
                            <h4 style="margin:0 0 1rem; color:var(--md-primary); font-size:1rem;">Timbro Ufficiale</h4>
                            <div class="image-preview" id="da-preview-timbro" style="width:100%; height:150px; background:${configCache.img_timbro ? 'url('+configCache.img_timbro+') center/contain no-repeat' : '#eee'}; border-radius:8px; margin-bottom:1rem; border:1px dashed var(--md-outline);"></div>
                            <input type="file" id="da-file-timbro" accept="image/png" style="display:none;">
                            <button class="btn" onclick="document.getElementById('da-file-timbro').click()" style="width:100%; padding:0.6rem; display:flex; justify-content:center; gap:0.5rem; align-items:center;">
                                <span class="material-symbols-rounded">upload</span> Carica Timbro
                            </button>
                            <p style="margin:0.5rem 0 0; font-size:0.75rem; color:var(--md-on-surface-variant); text-align:center;">Solo PNG con sfondo trasparente.</p>
                        </div>

                        <!-- Firma Legale Rappresentante -->
                        <div style="background:var(--md-surface-variant); padding:1.5rem; border-radius:12px; border:1px solid var(--md-outline-variant); display:flex; flex-direction:column; align-items:center;">
                            <h4 style="margin:0 0 1rem; color:var(--md-primary); font-size:1rem;">Firma Legale Rappresentante</h4>
                            <div class="image-preview" id="da-preview-firma" style="width:100%; height:150px; background:${configCache.img_firma ? 'url('+configCache.img_firma+') center/contain no-repeat' : '#eee'}; border-radius:8px; margin-bottom:1rem; border:1px dashed var(--md-outline);"></div>
                            <input type="file" id="da-file-firma" accept="image/png" style="display:none;">
                            <button class="btn" onclick="document.getElementById('da-file-firma').click()" style="width:100%; padding:0.6rem; display:flex; justify-content:center; gap:0.5rem; align-items:center;">
                                <span class="material-symbols-rounded">upload</span> Carica Firma
                            </button>
                            <p style="margin:0.5rem 0 0; font-size:0.75rem; color:var(--md-on-surface-variant); text-align:center;">Solo PNG con sfondo trasparente.</p>
                        </div>
                    </div>

                    <div style="margin-top:2rem; display:flex; justify-content:flex-end;">
                        <button id="da-btn-save-brand" class="btn primary" style="display:flex; align-items:center; gap:0.5rem; padding:0.8rem 1.5rem;">
                            <span class="material-symbols-rounded">save</span> Salva Asset Brand
                        </button>
                    </div>
                </div>
            `;

            let b64Logo = configCache.img_logo || '';
            let b64Timbro = configCache.img_timbro || '';
            let b64Firma = configCache.img_firma || '';

            const setupUploader = (inputId, previewId, callback) => {
                const input = container.querySelector('#' + inputId);
                const preview = container.querySelector('#' + previewId);
                input.addEventListener('change', (e) => {
                    const file = e.target.files[0];
                    if (!file) return;
                    
                    if (file.size > 2 * 1024 * 1024) {
                        toast('Il file è troppo grande (Max 2MB).', 'error');
                        return;
                    }

                    const reader = new FileReader();
                    reader.onload = (event) => {
                        const b64 = event.target.result;
                        preview.style.background = 'url(' + b64 + ') center/contain no-repeat';
                        callback(b64);
                    };
                    reader.readAsDataURL(file);
                });
            };

            setupUploader('da-file-logo', 'da-preview-logo', (val) => b64Logo = val);
            setupUploader('da-file-timbro', 'da-preview-timbro', (val) => b64Timbro = val);
            setupUploader('da-file-firma', 'da-preview-firma', (val) => b64Firma = val);

            container.querySelector('#da-btn-save-brand').addEventListener('click', async (ev) => {
                const btn = ev.currentTarget;
                const old = btn.innerHTML;
                btn.disabled = true;
                btn.innerHTML = '<span class="material-symbols-rounded" style="animation:spin 1s linear infinite;">sync</span> Salvataggio...';
                
                try {
                    const patch = {
                        img_logo: b64Logo,
                        img_timbro: b64Timbro,
                        img_firma: b64Firma
                    };
                    const ok = await saveConfig(patch);
                    toast(ok ? 'Asset grafici salvati con successo' : 'Errore nel salvataggio', ok ? 'success' : 'error');
                } catch (e) {
                    toast('Errore: ' + e.message, 'error');
                } finally {
                    btn.disabled = false;
                    btn.innerHTML = old;
                }
            });

        } catch (e) {
            console.error(e);
            container.innerHTML = '<div style="color:var(--md-error);">Errore rendering Brand: ' + e.message + '</div>';
        }
    }
};
