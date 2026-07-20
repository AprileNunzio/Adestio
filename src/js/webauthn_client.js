function base64urlToBuffer(base64url) {
    const padded = base64url.replace(/-/g, '+').replace(/_/g, '/').padEnd(base64url.length + (4 - base64url.length % 4) % 4, '=');
    const binary = atob(padded);
    const buffer = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) buffer[i] = binary.charCodeAt(i);
    return buffer.buffer;
}

function bufferToBase64url(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function prepareCreationOptions(optionsJSON) {
    return {
        ...optionsJSON,
        challenge: base64urlToBuffer(optionsJSON.challenge),
        user: { ...optionsJSON.user, id: base64urlToBuffer(optionsJSON.user.id) },
        excludeCredentials: (optionsJSON.excludeCredentials || []).map(c => ({ ...c, id: base64urlToBuffer(c.id) }))
    };
}

function prepareRequestOptions(optionsJSON) {
    return {
        ...optionsJSON,
        challenge: base64urlToBuffer(optionsJSON.challenge),
        allowCredentials: (optionsJSON.allowCredentials || []).map(c => ({ ...c, id: base64urlToBuffer(c.id) }))
    };
}

function registrationCredentialToJSON(credential) {
    const response = credential.response;
    return {
        id: credential.id,
        rawId: bufferToBase64url(credential.rawId),
        type: credential.type,
        clientExtensionResults: credential.getClientExtensionResults ? credential.getClientExtensionResults() : {},
        authenticatorAttachment: credential.authenticatorAttachment || undefined,
        response: {
            clientDataJSON: bufferToBase64url(response.clientDataJSON),
            attestationObject: bufferToBase64url(response.attestationObject),
            transports: response.getTransports ? response.getTransports() : []
        }
    };
}

function authenticationCredentialToJSON(credential) {
    const response = credential.response;
    return {
        id: credential.id,
        rawId: bufferToBase64url(credential.rawId),
        type: credential.type,
        clientExtensionResults: credential.getClientExtensionResults ? credential.getClientExtensionResults() : {},
        authenticatorAttachment: credential.authenticatorAttachment || undefined,
        response: {
            clientDataJSON: bufferToBase64url(response.clientDataJSON),
            authenticatorData: bufferToBase64url(response.authenticatorData),
            signature: bufferToBase64url(response.signature),
            userHandle: response.userHandle ? bufferToBase64url(response.userHandle) : undefined
        }
    };
}

export async function startRegistration(optionsJSON) {
    if (!window.PublicKeyCredential) throw new Error('Passkey non supportate su questo dispositivo/browser.');
    const credential = await navigator.credentials.create({ publicKey: prepareCreationOptions(optionsJSON) });
    if (!credential) throw new Error('Registrazione passkey annullata.');
    return registrationCredentialToJSON(credential);
}

export async function startAuthentication(optionsJSON) {
    if (!window.PublicKeyCredential) throw new Error('Passkey non supportate su questo dispositivo/browser.');
    const credential = await navigator.credentials.get({ publicKey: prepareRequestOptions(optionsJSON) });
    if (!credential) throw new Error('Autenticazione passkey annullata.');
    return authenticationCredentialToJSON(credential);
}

export function isWebauthnSupported() {
    return !!window.PublicKeyCredential;
}
