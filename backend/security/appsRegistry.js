const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { app } = require('electron');

class AppsRegistry {
    constructor() {
        try {
            this.registryPath = path.join(app.getPath('userData'), 'apps_registry.json');
            this.installedAppsPath = path.join(app.getPath('userData'), 'installed_apps');
            this.ensureDirectories();
            this.loadRegistry();
        } catch (e) {
            console.error(e);
        }
    }

    ensureDirectories() {
        try {
            if (!fs.existsSync(this.installedAppsPath)) {
                fs.mkdirSync(this.installedAppsPath, { recursive: true });
            }
            if (!fs.existsSync(this.registryPath)) {
                fs.writeFileSync(this.registryPath, JSON.stringify({}, null, 4), 'utf8');
            }
        } catch (e) {
            console.error(e);
        }
    }

    loadRegistry() {
        try {
            const data = fs.readFileSync(this.registryPath, 'utf8');
            this.registry = JSON.parse(data);
        } catch (e) {
            this.registry = {};
        }
    }

    saveRegistry() {
        try {
            fs.writeFileSync(this.registryPath, JSON.stringify(this.registry, null, 4), 'utf8');
        } catch (e) {
            console.error(e);
        }
    }

    verifyHash(filePath, expectedHash) {
        try {
            if (!fs.existsSync(filePath)) {
                return false;
            }
            const fileBuffer = fs.readFileSync(filePath);
            const hashSum = crypto.createHash('sha256');
            hashSum.update(fileBuffer);
            const hex = hashSum.digest('hex');
            return hex === expectedHash;
        } catch (e) {
            console.error(e);
            return false;
        }
    }

    verifySignature(data, signature, publicKey) {
        try {
            const verify = crypto.createVerify('SHA256');
            verify.update(data);
            verify.end();
            return verify.verify(publicKey, signature, 'hex');
        } catch (e) {
            console.error(e);
            return false;
        }
    }

    registerApp(appId, metadata) {
        try {
            if (!metadata.hash || !metadata.publisherKey || !metadata.signature) {
                throw new Error("Missing required metadata for secure registration.");
            }
            const dataToVerify = `${appId}:${metadata.hash}:${JSON.stringify(metadata.permissions || [])}`;
            const isValid = this.verifySignature(dataToVerify, metadata.signature, metadata.publisherKey);
            
            if (!isValid) {
                throw new Error("Invalid signature. App registration rejected.");
            }

            this.registry[appId] = metadata;
            this.saveRegistry();
            return true;
        } catch (e) {
            console.error(e);
            return false;
        }
    }

    installAppLocally(appId, packagePath) {
        try {
            const metadata = this.registry[appId];
            if (!metadata) {
                throw new Error("App not registered on blockchain/registry.");
            }
            
            const isHashValid = this.verifyHash(packagePath, metadata.hash);
            if (!isHashValid) {
                throw new Error("Package hash does not match registered metadata. Possible tampering.");
            }

            const targetDir = path.join(this.installedAppsPath, appId);
            if (!fs.existsSync(targetDir)) {
                fs.mkdirSync(targetDir, { recursive: true });
            }
            const targetFile = path.join(targetDir, 'app_bundle.zip');
            fs.copyFileSync(packagePath, targetFile);
            
            metadata.installed = true;
            this.saveRegistry();
            
            return true;
        } catch (e) {
            console.error(e);
            return false;
        }
    }

    getAppPermissions(appId) {
        try {
            const metadata = this.registry[appId];
            if (!metadata) return [];
            return metadata.permissions || [];
        } catch (e) {
            console.error(e);
            return [];
        }
    }
    
    isAppInstalledAndVerified(appId) {
        try {
            const metadata = this.registry[appId];
            if (!metadata || !metadata.installed) return false;
            
            const targetFile = path.join(this.installedAppsPath, appId, 'app_bundle.zip');
            return this.verifyHash(targetFile, metadata.hash);
        } catch (e) {
            console.error(e);
            return false;
        }
    }
}

module.exports = new AppsRegistry();
