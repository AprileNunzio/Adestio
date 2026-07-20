export function getCurrentUserId() {
    return sessionStorage.getItem('currentUserId') || '';
}
export async function resolveCurrentPersona() {
    const userId = getCurrentUserId();
    if (!userId) return null;
    return await window.electronAPI.anagrafica.persone.getByUserId({ userId });
}
