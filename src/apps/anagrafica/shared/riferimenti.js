let provinceCache = null;
let nazioniCache = null;
let comuniCache = null;
export function getComuniCache() {
    return comuniCache || [];
}
export function datalistHtml(id) {
    return `<datalist id="${id}"></datalist>`;
}
export async function populateProvinceDatalist(datalistEl) {
    if (!datalistEl) return;
    if (!provinceCache) {
        try {
            provinceCache = await window.electronAPI.anagrafica.riferimenti.getProvince();
        } catch (e) {
            provinceCache = [];
        }
    }
    datalistEl.innerHTML = provinceCache.map(p => `<option value="${p.sigla}">${p.nome}</option>`).join('');
}
export async function populateNazioniDatalist(datalistEl) {
    if (!datalistEl) return;
    if (!nazioniCache) {
        try {
            nazioniCache = await window.electronAPI.anagrafica.riferimenti.getNazioni();
        } catch (e) {
            nazioniCache = [];
        }
    }
    datalistEl.innerHTML = nazioniCache.map(n => `<option value="${n.gentilizio}">${n.nome}</option>`).join('');
}
export async function populateComuniDatalist(datalistEl) {
    if (!datalistEl) return;
    if (!comuniCache) {
        try {
            comuniCache = await window.electronAPI.anagrafica.riferimenti.getAllComuni();
        } catch (e) {
            comuniCache = [];
        }
    }
    datalistEl.innerHTML = comuniCache.map(c => `<option value="${c.n}"></option>`).join('');
}
export async function populateSuggestionDatalist(datalistEl, table, column) {
    if (!datalistEl) return;
    try {
        const values = await window.electronAPI.anagrafica.riferimenti.getSuggestions({ table, column });
        datalistEl.innerHTML = values.map(v => `<option value="${v}"></option>`).join('');
    } catch (e) {
        datalistEl.innerHTML = '';
    }
}
