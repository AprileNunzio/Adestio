import { toast } from '../../../../../js/utils.js';

export default {
    render: async (container, configCache, saveConfig) => {
        try {
            // Add font faces
            // Add font faces
            const style = document.createElement('style');
            style.innerHTML = `
                @font-face {
                    font-family: 'Priestacy';
                    src: url('../../../../../assets/fonts/Priestacy.otf') format('opentype');
                }
                @font-face {
                    font-family: 'Signatie';
                    src: url('../../../../../assets/fonts/Signatie.otf') format('opentype');
                }
                .firma-font-priestacy { font-family: 'Priestacy', cursive; }
                .firma-font-signatie { font-family: 'Signatie', cursive; }
            `;
            document.head.appendChild(style);

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
                        <div style="grid-column:1 / -1; background:var(--md-surface-variant); padding:1.5rem; border-radius:12px; border:1px solid var(--md-outline-variant);">
                            <h4 style="margin:0 0 1rem; color:var(--md-primary); font-size:1rem; text-align:center;">Firma Legale Rappresentante</h4>
                            
                            <div style="display:flex; gap:1rem; margin-bottom:1.5rem; justify-content:center;">
                                <label style="display:flex; align-items:center; gap:0.4rem; cursor:pointer;">
                                    <input type="radio" name="firma_mode" value="upload" checked style="accent-color:var(--md-primary);"> Carica PNG
                                </label>
                                <label style="display:flex; align-items:center; gap:0.4rem; cursor:pointer;">
                                    <input type="radio" name="firma_mode" value="generate" style="accent-color:var(--md-primary);"> Genera da Testo
                                </label>
                            </div>

                            <div style="display:flex; flex-wrap:wrap; gap:1.5rem; align-items:flex-start;">
                                
                                <div style="flex:1; min-width:250px;">
                                    <div class="image-preview" id="da-preview-firma" style="width:100%; height:150px; background:${configCache.img_firma ? 'url('+configCache.img_firma+') center/contain no-repeat' : '#eee'}; border-radius:8px; margin-bottom:1rem; border:1px dashed var(--md-outline);"></div>
                                    
                                    <div id="da-firma-upload-container">
                                        <input type="file" id="da-file-firma" accept="image/png" style="display:none;">
                                        <button class="btn" onclick="document.getElementById('da-file-firma').click()" style="width:100%; padding:0.6rem; display:flex; justify-content:center; gap:0.5rem; align-items:center;">
                                            <span class="material-symbols-rounded">upload</span> Carica Firma
                                        </button>
                                        <p style="margin:0.5rem 0 0; font-size:0.75rem; color:var(--md-on-surface-variant); text-align:center;">Solo PNG con sfondo trasparente.</p>
                                    </div>
                                    
                                    <div id="da-firma-generate-container" style="display:none; flex-direction:column; gap:0.8rem;">
                                        <input type="text" id="da-firma-text" value="${configCache.istituto_rappresentante || ''}" placeholder="Nome e Cognome" style="width:100%; padding:0.6rem; border-radius:8px; border:1px solid var(--md-outline); background:var(--md-surface); color:var(--md-on-surface); outline:none;">
                                        
                                        <select id="da-firma-font" style="width:100%; padding:0.6rem; border-radius:8px; border:1px solid var(--md-outline); background:var(--md-surface); color:var(--md-on-surface); outline:none;">
                                            <option value="Priestacy">Font: Priestacy</option>
                                            <option value="Signatie">Font: Signatie</option>
                                        </select>
                                        
                                        <button class="btn" id="da-btn-generate-firma" style="width:100%; padding:0.6rem; display:flex; justify-content:center; gap:0.5rem; align-items:center; background:var(--md-secondary); color:var(--md-on-secondary);">
                                            <span class="material-symbols-rounded">draw</span> Genera Immagine Firma
                                        </button>
                                    </div>
                                </div>
                                
                                <div style="flex:1; min-width:250px; background:var(--md-surface); padding:1rem; border-radius:8px; border:1px solid var(--md-outline);">
                                    <label style="display:flex; align-items:flex-start; gap:0.6rem; cursor:pointer;">
                                        <input type="checkbox" id="da-firma-legale-chk" ${configCache.firma_legale_cad === 'true' ? 'checked' : ''} style="margin-top:0.3rem; width:18px; height:18px; accent-color:var(--md-primary);">
                                        <span style="font-size:0.9rem; color:var(--md-on-surface); line-height:1.4;">
                                            <strong>Apponi dicitura di legge</strong><br>
                                            "Firma autografa sostituita a mezzo stampa ai sensi dell'art. 3 comma 2 del D.Lgs n.39/1993 e Firma Elettronica ai sensi dell'art. 21 del D.Lgs 82/2005 (CAD)"
                                        </span>
                                    </label>
                                    <p style="margin:0.5rem 0 0 2rem; font-size:0.75rem; color:var(--md-on-surface-variant);">Se spuntato, il sistema aggiungerà automaticamente questa dicitura sotto la firma nei documenti generati.</p>
                                </div>
                                
                            </div>
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

            // Toggle Firma Mode
            const uploadCont = container.querySelector('#da-firma-upload-container');
            const genCont = container.querySelector('#da-firma-generate-container');
            container.querySelectorAll('input[name="firma_mode"]').forEach(radio => {
                radio.addEventListener('change', (e) => {
                    if (e.target.value === 'upload') {
                        uploadCont.style.display = 'block';
                        genCont.style.display = 'none';
                    } else {
                        uploadCont.style.display = 'none';
                        genCont.style.display = 'flex';
                    }
                });
            });

            // Generation Logic
            const generateFirmaLive = () => {
                const text = container.querySelector('#da-firma-text').value.trim();
                const font = container.querySelector('#da-firma-font').value;
                if (!text) {
                    return; // Don't generate empty
                }

                const canvas = document.createElement('canvas');
                canvas.width = 600;
                canvas.height = 200;
                const ctx = canvas.getContext('2d');
                
                // Clear background (transparent)
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                
                // Draw text
                ctx.font = `60px ${font}`;
                ctx.fillStyle = '#000080'; // Dark blue ink
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(text, canvas.width / 2, canvas.height / 2);

                b64Firma = canvas.toDataURL('image/png');
                container.querySelector('#da-preview-firma').style.background = 'url(' + b64Firma + ') center/contain no-repeat';
            };

            container.querySelector('#da-firma-text').addEventListener('input', generateFirmaLive);
            container.querySelector('#da-firma-font').addEventListener('change', generateFirmaLive);

            container.querySelector('#da-btn-generate-firma').addEventListener('click', () => {
                generateFirmaLive();
                toast('Firma confermata! Ricorda di salvare.', 'success');
            });

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
                        img_firma: b64Firma,
                        firma_legale_cad: container.querySelector('#da-firma-legale-chk').checked ? 'true' : 'false'
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
