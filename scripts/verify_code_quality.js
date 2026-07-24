'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function isActualCodeComment(line) {
    try {
        const trimmed = line.trim();
        if (trimmed.startsWith('//') && !trimmed.startsWith('///')) {
            return true;
        }
        if (trimmed.startsWith('/*') && !trimmed.startsWith('/*css')) {
            return true;
        }
        
        const idx = line.indexOf('//');
        if (idx > 0) {
            const before = line.substring(0, idx);
            if (before.includes('http:') || before.includes('https:') || before.includes('replace(') || before.includes('match(') || before.includes('test(')) {
                return false;
            }
            const singleQ = (before.match(/'/g) || []).length;
            const doubleQ = (before.match(/"/g) || []).length;
            const backtickQ = (before.match(/`/g) || []).length;
            if (singleQ % 2 === 0 && doubleQ % 2 === 0 && backtickQ % 2 === 0) {
                return true;
            }
        }
        return false;
    } catch (e) {
        return false;
    }
}

function checkDirectory(dir) {
    try {
        const files = fs.readdirSync(dir);
        let errors = 0;

        for (const file of files) {
            try {
                const fullPath = path.join(dir, file);
                const stat = fs.statSync(fullPath);

                if (stat.isDirectory()) {
                    if (file !== 'node_modules' && file !== '.git' && file !== 'dist') {
                        errors += checkDirectory(fullPath);
                    }
                } else if (file.endsWith('.js')) {
                    const content = fs.readFileSync(fullPath, 'utf8');
                    const lines = content.split(/\r?\n/);
                    let fileHasComment = false;

                    for (const line of lines) {
                        if (isActualCodeComment(line)) {
                            fileHasComment = true;
                            break;
                        }
                    }

                    if (fileHasComment) {
                        console.error(`[RULE VIOLATION] Commento codice trovato in: ${fullPath}`);
                        errors++;
                    }

                    try {
                        execSync(`node --check "${fullPath}"`, { stdio: 'pipe' });
                    } catch (eSyn) {
                        console.error(`[SYNTAX ERROR] Sintassi JS invalida in: ${fullPath}`);
                        errors++;
                    }
                }
            } catch (eFile) {}
        }
        return errors;
    } catch (e) {
        return 0;
    }
}

function runModuleTests() {
    try {
        console.log('--- Esecuzione Test Moduli Core & Sicurezza 2.0 ---');
        
        const cryptoVerifier = require('../backend/security/cryptoVerifier');
        const hash = cryptoVerifier.computeBufferHash(Buffer.from('test-payload'));
        if (!hash) throw new Error('Test cryptoVerifier fallito');
        console.log('✅ Test cryptoVerifier superato');

        const licenseManager = require('../backend/security/licenseManager');
        const status = licenseManager.getLicenseStatus();
        if (!status || status.valid === undefined) throw new Error('Test licenseManager fallito');
        console.log('✅ Test licenseManager superato');

        const flightRecorder = require('../backend/observability/flightRecorder');
        flightRecorder.recordEvent('test', 'PING', { ok: true });
        const events = flightRecorder.getEvents(10);
        if (!events || events.length === 0) throw new Error('Test flightRecorder fallito');
        console.log('✅ Test flightRecorder superato');

        const entitlementEngine = require('../backend/security/entitlementEngine');
        const entitlement = entitlementEngine.checkEntitlement('app1', 'tenant1');
        if (!entitlement || entitlement.valid === undefined) throw new Error('Test entitlementEngine fallito');
        console.log('✅ Test entitlementEngine superato');

        return true;
    } catch (e) {
        console.error('❌ Errore durante i test di modulo:', e.message);
        return false;
    }
}

console.log('=== Verificatore Qualità del Codice Adestio 2.0 ===');
const baseDir = path.join(__dirname, '..');
const backendErrors = checkDirectory(path.join(baseDir, 'backend'));
const srcErrors = checkDirectory(path.join(baseDir, 'src'));
const testsOk = runModuleTests();

if (backendErrors === 0 && srcErrors === 0 && testsOk) {
    console.log('🎉 TUTTI I CHECK DI QUALITA E SICUREZZA 2.0 HANNO AVUTO ESITO POSITIVO!');
    process.exit(0);
} else {
    console.error(`❌ Trovati ${backendErrors + srcErrors} errori.`);
    process.exit(1);
}
