'use strict';

const crypto = require('crypto');
const fs = require('fs');

class CryptoVerifier {
    constructor() {
        try {
            this._publicKey = null;
        } catch (e) {}
    }

    setPublicKey(pemKey) {
        try {
            this._publicKey = pemKey;
            return true;
        } catch (e) {
            return false;
        }
    }

    generateKeyPair() {
        try {
            const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519', {
                publicKeyEncoding: { type: 'spki', format: 'pem' },
                privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
            });
            return { publicKey, privateKey };
        } catch (e) {
            return null;
        }
    }

    signBuffer(buffer, privateKeyPem) {
        try {
            const signature = crypto.sign(null, buffer, privateKeyPem);
            return signature.toString('base64');
        } catch (e) {
            return null;
        }
    }

    verifyBufferSignature(buffer, signatureBase64, publicKeyPem = null) {
        try {
            const keyToUse = publicKeyPem || this._publicKey;
            if (!keyToUse) return false;
            const signature = Buffer.from(signatureBase64, 'base64');
            return crypto.verify(null, buffer, keyToUse, signature);
        } catch (e) {
            return false;
        }
    }

    computeFileHash(filePath) {
        try {
            if (!fs.existsSync(filePath)) return null;
            const fileBuffer = fs.readFileSync(filePath);
            return crypto.createHash('sha256').update(fileBuffer).digest('hex');
        } catch (e) {
            return null;
        }
    }

    computeBufferHash(buffer) {
        try {
            return crypto.createHash('sha256').update(buffer).digest('hex');
        } catch (e) {
            return null;
        }
    }
}

module.exports = new CryptoVerifier();
