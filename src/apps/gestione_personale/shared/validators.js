const CODICI_DISPARI = {
    '0': 1, '1': 0, '2': 5, '3': 7, '4': 9, '5': 13, '6': 15, '7': 17, '8': 19, '9': 21,
    'A': 1, 'B': 0, 'C': 5, 'D': 7, 'E': 9, 'F': 13, 'G': 15, 'H': 17, 'I': 19, 'J': 21,
    'K': 2, 'L': 4, 'M': 18, 'N': 20, 'O': 11, 'P': 3, 'Q': 6, 'R': 8, 'S': 12, 'T': 14,
    'U': 16, 'V': 10, 'W': 22, 'X': 25, 'Y': 24, 'Z': 23
};
const CODICI_PARI = {
    '0': 0, '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
    'A': 0, 'B': 1, 'C': 2, 'D': 3, 'E': 4, 'F': 5, 'G': 6, 'H': 7, 'I': 8, 'J': 9,
    'K': 10, 'L': 11, 'M': 12, 'N': 13, 'O': 14, 'P': 15, 'Q': 16, 'R': 17, 'S': 18, 'T': 19,
    'U': 20, 'V': 21, 'W': 22, 'X': 23, 'Y': 24, 'Z': 25
};
const RESTO_LETTERA = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];
const CF_REGEX = /^[A-Z]{6}[0-9A-Z]{2}[A-EHLMPR-T][0-9A-Z]{2}[A-Z][0-9A-Z]{3}[A-Z]$/i;
const PIVA_REGEX = /^[0-9]{11}$/;
const IBAN_REGEX = /^[A-Z]{2}[0-9]{2}[A-Z0-9]{10,30}$/i;
export function normalizeCodiceFiscale(value) {
    return typeof value === 'string' ? value.trim().toUpperCase() : '';
}
export function isValidCodiceFiscale(value) {
    const cf = normalizeCodiceFiscale(value);
    if (!CF_REGEX.test(cf)) return false;
    let sum = 0;
    for (let i = 0; i < 15; i++) {
        const ch = cf[i];
        sum += (i % 2 === 0) ? CODICI_DISPARI[ch] : CODICI_PARI[ch];
    }
    return RESTO_LETTERA[sum % 26] === cf[15];
}
export function normalizePartitaIva(value) {
    return typeof value === 'string' ? value.trim() : '';
}
export function isValidPartitaIva(value) {
    const piva = normalizePartitaIva(value);
    if (!PIVA_REGEX.test(piva)) return false;
    let sum = 0;
    for (let i = 0; i < 10; i += 2) {
        sum += piva.charCodeAt(i) - 48;
    }
    for (let i = 1; i < 10; i += 2) {
        let n = (piva.charCodeAt(i) - 48) * 2;
        if (n > 9) n -= 9;
        sum += n;
    }
    const check = (10 - (sum % 10)) % 10;
    return check === (piva.charCodeAt(10) - 48);
}
export function normalizeIban(value) {
    return typeof value === 'string' ? value.replace(/\s+/g, '').toUpperCase() : '';
}
export function isValidIban(value) {
    const iban = normalizeIban(value);
    if (!IBAN_REGEX.test(iban)) return false;
    const rearranged = iban.slice(4) + iban.slice(0, 4);
    const converted = rearranged.replace(/[A-Z]/g, ch => (ch.charCodeAt(0) - 55).toString());
    let remainder = converted;
    while (remainder.length > 9) {
        const block = remainder.slice(0, 9);
        remainder = (parseInt(block, 10) % 97).toString() + remainder.slice(block.length);
    }
    return parseInt(remainder, 10) % 97 === 1;
}
